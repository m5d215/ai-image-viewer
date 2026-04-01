import type { Database } from 'bun:sqlite';
import { z } from 'zod';
import { ImageRow } from '../../shared/schemas';
import type { ImageRow as ImageRowType } from '../../shared/types';
import { buildCombinedTagFilter } from '../db/queries';

interface SearchResult {
  data: ImageRowType[];
  total: number;
}

interface SearchOptions {
  query: string;
  limit: number;
  offset: number;
  includeTagIds?: number[];
  excludeTagIds?: number[];
  tagMode?: 'and' | 'or';
}

export function searchImages(db: Database, options: SearchOptions): SearchResult {
  const { query, limit, offset, includeTagIds = [], excludeTagIds = [], tagMode = 'or' } = options;

  if (includeTagIds.length > 0 || excludeTagIds.length > 0) {
    // ?1 is reserved for FTS MATCH, tag filter params start from ?2
    const filter = buildCombinedTagFilter(includeTagIds, excludeTagIds, tagMode, 2);
    const paramOffset = filter.params.length + 1; // +1 for MATCH param

    const matchClause = 'images_fts MATCH ?1';
    const tagWhere = filter.where.replace(/^WHERE /, '');
    const fullWhere =
      tagWhere.length > 0 ? `WHERE ${matchClause} AND ${tagWhere}` : `WHERE ${matchClause}`;

    const dataSql = `SELECT DISTINCT images.* FROM images
       JOIN images_fts ON images.id = images_fts.rowid
       ${filter.join}
       ${fullWhere}
       ${filter.groupBy}
       ORDER BY rank
       LIMIT ?${String(paramOffset + 1)} OFFSET ?${String(paramOffset + 2)}`;
    const rows: unknown[] = db.query(dataSql).all(query, ...filter.params, limit, offset);

    let countSql: string;
    if (filter.groupBy !== '') {
      countSql = `SELECT COUNT(*) as count FROM (SELECT images.id FROM images
         JOIN images_fts ON images.id = images_fts.rowid
         ${filter.join}
         ${fullWhere}
         ${filter.groupBy})`;
    } else {
      countSql = `SELECT COUNT(DISTINCT images.id) as count FROM images
         JOIN images_fts ON images.id = images_fts.rowid
         ${filter.join}
         ${fullWhere}`;
    }
    const countRow = db.query(countSql).get(query, ...filter.params);
    const total = z.object({ count: z.number() }).parse(countRow).count;

    return {
      data: rows.map((row) => ImageRow.parse(row)),
      total,
    };
  }

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
