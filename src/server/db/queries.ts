import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import type { ImageId } from '../../shared/types';
import { ImageRow } from '../../shared/schemas';
import { ImageId as ImageIdSchema } from '../../shared/brands';

const SORTABLE_COLUMNS = ['created_at', 'file_mtime', 'file_name', 'file_size'] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];
export type SortOrder = 'asc' | 'desc';

interface ListOptions {
  limit: number;
  offset: number;
  sort?: SortColumn;
  order?: SortOrder;
}

export function isSortColumn(value: string): value is SortColumn {
  return (SORTABLE_COLUMNS as readonly string[]).includes(value);
}

export function isSortOrder(value: string): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

export function getAllImages(db: Database, options: ListOptions): z.infer<typeof ImageRow>[] {
  const column = options.sort ?? 'created_at';
  const order = options.order ?? 'desc';
  const rows: unknown[] = db
    .query(`SELECT * FROM images ORDER BY ${column} ${order} LIMIT ?1 OFFSET ?2`)
    .all(options.limit, options.offset);
  return rows.map((row) => ImageRow.parse(row));
}

export function countImages(db: Database): number {
  const row = db.query('SELECT COUNT(*) as count FROM images').get();
  return z.object({ count: z.number() }).parse(row).count;
}

export function getImageById(db: Database, id: ImageId): z.infer<typeof ImageRow> | null {
  const row: unknown = db.query('SELECT * FROM images WHERE id = ?1').get(id);
  if (row === null) {
    return null;
  }
  return ImageRow.parse(row);
}

export function searchImages(
  db: Database,
  query: string,
  limit: number,
  offset: number,
): z.infer<typeof ImageRow>[] {
  const rows: unknown[] = db
    .query(
      `SELECT images.* FROM images
       JOIN images_fts ON images.id = images_fts.rowid
       WHERE images_fts MATCH ?1
       ORDER BY rank
       LIMIT ?2 OFFSET ?3`,
    )
    .all(query, limit, offset);
  return rows.map((row) => ImageRow.parse(row));
}

interface InsertImageData {
  file_path: string;
  file_name: string;
  title: string | null;
  prompt: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  file_mtime: string;
  thumb_path: string | null;
}

export function insertImage(db: Database, data: InsertImageData): ImageId {
  const result = db
    .query(
      `INSERT INTO images (file_path, file_name, title, prompt, width, height, file_size, file_mtime, thumb_path)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       RETURNING id`,
    )
    .get(
      data.file_path,
      data.file_name,
      data.title,
      data.prompt,
      data.width,
      data.height,
      data.file_size,
      data.file_mtime,
      data.thumb_path,
    );
  const parsed = z.object({ id: ImageIdSchema }).parse(result);
  return parsed.id;
}

interface UpdateImageData {
  title?: string | null;
  prompt?: string | null;
  width?: number | null;
  height?: number | null;
  file_size?: number | null;
  file_mtime?: string;
  thumb_path?: string | null;
}

export function updateImage(db: Database, id: ImageId, data: UpdateImageData): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const entries = Object.entries(data);
  for (const [key, value] of entries) {
    fields.push(`${key} = ?${String(paramIndex)}`);
    values.push(value);
    paramIndex++;
  }

  if (fields.length === 0) {
    return;
  }

  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
  values.push(id);

  const bindValues: (string | number | null)[] = [];
  for (const v of values) {
    if (typeof v === 'string' || typeof v === 'number' || v === null) {
      bindValues.push(v);
    }
  }
  bindValues.push(id);
  db.query(`UPDATE images SET ${fields.join(', ')} WHERE id = ?${String(paramIndex)}`).run(
    ...bindValues,
  );
}

export function deleteImage(db: Database, id: ImageId): void {
  db.query('DELETE FROM images WHERE id = ?1').run(id);
}
