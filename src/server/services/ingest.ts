import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import path from 'path';
import type { Database } from 'bun:sqlite';
import exifr from 'exifr';
import sharp from 'sharp';
import { z } from 'zod';
import { ThumbPath } from '../../shared/brands';
import { env, exifFieldMapping } from '../config';

// XMP fields can be either a plain string or { lang, value } object
const XmpStringValue = z.union([
  z.string(),
  z.object({ value: z.string() }).transform((v) => v.value),
]);

const ExifResult = z.object({
  [exifFieldMapping.prompt]: XmpStringValue.optional(),
  [exifFieldMapping.title]: XmpStringValue.optional(),
});

interface IngestResult {
  title: string | null;
  prompt: string | null;
  width: number;
  height: number;
  fileSize: number;
  fileMtime: string;
  thumbPath: string;
}

function generateThumbPath(filePath: string): string {
  const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 16);
  return path.join(env.THUMB_DIR, `${hash}.webp`);
}

export async function ingestFile(filePath: string, _db: Database): Promise<IngestResult> {
  // Read EXIF metadata
  const rawExif: unknown = await exifr.parse(filePath, { xmp: true }).catch(() => null);
  const exifParsed = ExifResult.safeParse(rawExif);
  const exifData = exifParsed.success ? exifParsed.data : {};

  const promptValue = exifData[exifFieldMapping.prompt] ?? null;
  const titleValue = exifData[exifFieldMapping.title] ?? null;

  // Get image dimensions
  const metadata = await sharp(filePath).metadata();
  const width = metadata.width;
  const height = metadata.height;

  // Generate thumbnail (long side 400px, WebP, quality 80)
  const thumbDest = generateThumbPath(filePath);
  await sharp(filePath)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbDest);

  const thumbPathBranded = ThumbPath.parse(thumbDest);

  // Get file stats
  const fileStat = await stat(filePath);
  const fileSize = fileStat.size;
  const fileMtime = fileStat.mtime.toISOString();

  return {
    title: titleValue,
    prompt: promptValue,
    width,
    height,
    fileSize,
    fileMtime,
    thumbPath: thumbPathBranded,
  };
}
