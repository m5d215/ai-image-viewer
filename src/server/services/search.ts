import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import { ImageRow } from '../../shared/schemas';
import type { ImageRow as ImageRowType } from '../../shared/types';

interface SearchResult {
  data: ImageRowType[];
  total: number;
}

export function searchImages(
  db: Database,
  query: string,
  limit: number,
  offset: number,
): SearchResult {
  const rows: unknown[] = db
    .query(
      `SELECT images.* FROM images
       JOIN images_fts ON images.id = images_fts.rowid
       WHERE images_fts MATCH ?1
       ORDER BY rank
       LIMIT ?2 OFFSET ?3`,
    )
    .all(query, limit, offset);

  const countRow = db
    .query(
      `SELECT COUNT(*) as count FROM images
       JOIN images_fts ON images.id = images_fts.rowid
       WHERE images_fts MATCH ?1`,
    )
    .get(query);
  const total = z.object({ count: z.number() }).parse(countRow).count;

  return {
    data: rows.map((row) => ImageRow.parse(row)),
    total,
  };
}
