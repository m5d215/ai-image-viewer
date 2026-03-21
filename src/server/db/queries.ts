import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import type { ImageId, TagId } from '../../shared/types';
import { ImageRow, TagRow } from '../../shared/schemas';
import { ImageId as ImageIdSchema } from '../../shared/brands';

const SORTABLE_COLUMNS = ['created_at', 'file_mtime', 'file_name', 'file_size'] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];
export type SortOrder = 'asc' | 'desc';

interface ListOptions {
  limit: number;
  offset: number;
  sort?: SortColumn;
  order?: SortOrder;
  includeTagIds?: number[];
  excludeTagIds?: number[];
  tagMode?: 'and' | 'or';
}

export function isSortColumn(value: string): value is SortColumn {
  return SORTABLE_COLUMNS.some((col) => col === value);
}

export function isSortOrder(value: string): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

interface TagFilter {
  join: string;
  where: string;
  groupBy: string;
  params: number[];
}

export function buildCombinedTagFilter(
  includeTagIds: number[],
  excludeTagIds: number[],
  includeMode: 'and' | 'or',
  startIndex = 1,
): TagFilter {
  const params: number[] = [];
  let paramIndex = startIndex;

  let join = '';
  const whereClauses: string[] = [];
  let groupBy = '';

  // Include filter
  if (includeTagIds.length > 0) {
    const includePlaceholders = includeTagIds.map((_, i) => `?${String(paramIndex + i)}`).join(', ');
    paramIndex += includeTagIds.length;
    params.push(...includeTagIds);

    join = 'JOIN image_tags ON images.id = image_tags.image_id';
    whereClauses.push(`image_tags.tag_id IN (${includePlaceholders})`);

    if (includeMode === 'and') {
      groupBy = `GROUP BY images.id HAVING COUNT(DISTINCT image_tags.tag_id) = ${String(includeTagIds.length)}`;
    }
  }

  // Exclude filter
  if (excludeTagIds.length > 0) {
    const excludePlaceholders = excludeTagIds.map((_, i) => `?${String(paramIndex + i)}`).join(', ');
    paramIndex += excludeTagIds.length;
    params.push(...excludeTagIds);

    whereClauses.push(`images.id NOT IN (SELECT image_id FROM image_tags WHERE tag_id IN (${excludePlaceholders}))`);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return { join, where, groupBy, params };
}

export function getAllImages(db: Database, options: ListOptions): z.infer<typeof ImageRow>[] {
  const column = options.sort ?? 'created_at';
  const order = options.order ?? 'desc';

  const includeTagIds = options.includeTagIds ?? [];
  const excludeTagIds = options.excludeTagIds ?? [];
  if (includeTagIds.length > 0 || excludeTagIds.length > 0) {
    const mode = options.tagMode ?? 'or';
    const filter = buildCombinedTagFilter(includeTagIds, excludeTagIds, mode);
    const paramOffset = filter.params.length;
    const sql = `SELECT DISTINCT images.* FROM images ${filter.join} ${filter.where} ${filter.groupBy} ORDER BY images.${column} ${order} LIMIT ?${String(paramOffset + 1)} OFFSET ?${String(paramOffset + 2)}`;
    const rows: unknown[] = db.query(sql).all(...filter.params, options.limit, options.offset);
    return rows.map((row) => ImageRow.parse(row));
  }

  const rows: unknown[] = db
    .query(`SELECT * FROM images ORDER BY ${column} ${order} LIMIT ?1 OFFSET ?2`)
    .all(options.limit, options.offset);
  return rows.map((row) => ImageRow.parse(row));
}

export function countImages(db: Database, options?: { includeTagIds?: number[]; excludeTagIds?: number[]; tagMode?: 'and' | 'or' }): number {
  const includeTagIds = options?.includeTagIds ?? [];
  const excludeTagIds = options?.excludeTagIds ?? [];
  if (includeTagIds.length > 0 || excludeTagIds.length > 0) {
    const mode = options?.tagMode ?? 'or';
    const filter = buildCombinedTagFilter(includeTagIds, excludeTagIds, mode);

    if (filter.groupBy !== '') {
      const sql = `SELECT COUNT(*) as count FROM (SELECT images.id FROM images ${filter.join} ${filter.where} ${filter.groupBy})`;
      const row = db.query(sql).get(...filter.params);
      return z.object({ count: z.number() }).parse(row).count;
    }

    const sql = `SELECT COUNT(DISTINCT images.id) as count FROM images ${filter.join} ${filter.where}`;
    const row = db.query(sql).get(...filter.params);
    return z.object({ count: z.number() }).parse(row).count;
  }

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

export function getImageTags(db: Database, imageId: ImageId): z.infer<typeof TagRow>[] {
  const rows: unknown[] = db
    .query(
      `SELECT tags.* FROM tags
       JOIN image_tags ON tags.id = image_tags.tag_id
       WHERE image_tags.image_id = ?1`,
    )
    .all(imageId);
  return rows.map((row) => TagRow.parse(row));
}

export function bulkAddTagToImages(db: Database, imageIds: ImageId[], tagId: TagId): void {
  const stmt = db.query('INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?1, ?2)');
  const transaction = db.transaction(() => {
    for (const imageId of imageIds) {
      stmt.run(imageId, tagId);
    }
  });
  transaction();
}
