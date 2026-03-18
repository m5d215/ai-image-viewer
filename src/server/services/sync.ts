import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import { ImageId as ImageIdSchema } from '../../shared/brands';
import { ImageRow, SyncResult } from '../../shared/schemas';
import type { SyncResult as SyncResultType } from '../../shared/types';
import { env } from '../config';
import { deleteImage, insertImage, updateImage } from '../db/queries';
import { ingestFile } from './ingest';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

interface FileInfo {
  filePath: string;
  mtime: string;
  size: number;
}

async function scanDirectory(dir: string): Promise<FileInfo[]> {
  const results: FileInfo[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await scanDirectory(fullPath);
      results.push(...nested);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        const fileStat = await stat(fullPath);
        results.push({
          filePath: fullPath,
          mtime: fileStat.mtime.toISOString(),
          size: fileStat.size,
        });
      }
    }
  }

  return results;
}

export async function syncImages(db: Database): Promise<SyncResultType> {
  // Scan file system
  const files = await scanDirectory(env.IMAGE_DIR);
  const fileMap = new Map<string, FileInfo>();
  for (const file of files) {
    fileMap.set(file.filePath, file);
  }

  // Get all existing DB records
  const dbRows: unknown[] = db.query('SELECT * FROM images').all();
  const parsedRows = dbRows.map((row) => ImageRow.parse(row));
  const dbMap = new Map<string, z.infer<typeof ImageRow>>();
  for (const row of parsedRows) {
    dbMap.set(row.file_path, row);
  }

  let added = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  // Process files that exist on disk
  for (const [filePath, file] of fileMap) {
    const dbRecord = dbMap.get(filePath);

    if (dbRecord == null) {
      // New file: ingest and insert
      const result = await ingestFile(filePath, db);
      insertImage(db, {
        file_path: filePath,
        file_name: path.basename(filePath),
        title: result.title,
        prompt: result.prompt,
        width: result.width,
        height: result.height,
        file_size: result.fileSize,
        file_mtime: result.fileMtime,
        thumb_path: result.thumbPath,
      });
      added++;
    } else if (file.mtime !== dbRecord.file_mtime || file.size !== dbRecord.file_size) {
      // Changed file: re-ingest and update
      const result = await ingestFile(filePath, db);
      const imageId = ImageIdSchema.parse(dbRecord.id);
      updateImage(db, imageId, {
        title: result.title,
        prompt: result.prompt,
        width: result.width,
        height: result.height,
        file_size: result.fileSize,
        file_mtime: result.fileMtime,
        thumb_path: result.thumbPath,
      });
      updated++;
    } else {
      // Unchanged
      unchanged++;
    }
  }

  // Process DB records whose files no longer exist
  for (const [filePath, dbRecord] of dbMap) {
    if (!fileMap.has(filePath)) {
      // Delete thumbnail if it exists
      if (dbRecord.thumb_path !== null) {
        await unlink(dbRecord.thumb_path).catch(() => {
          // Thumbnail may already be gone
        });
      }
      const imageId = ImageIdSchema.parse(dbRecord.id);
      deleteImage(db, imageId);
      deleted++;
    }
  }

  return SyncResult.parse({ added, updated, deleted, unchanged });
}
