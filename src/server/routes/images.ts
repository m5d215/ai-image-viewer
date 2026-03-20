import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { ImageId } from '../../shared/brands';
import { ImagePatchBody, SearchQuery } from '../../shared/schemas';
import { getDb } from '../db/connection';
import type { SortColumn, SortOrder } from '../db/queries';
import { countImages, getAllImages, getImageById, getImageTags, isSortColumn, isSortOrder, updateImage } from '../db/queries';
import { searchImages } from '../services/search';

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
  order: z.string().optional(),
  includeTags: z.string().optional(),
  excludeTags: z.string().optional(),
  tagMode: z.enum(['and', 'or']).default('or'),
});

const images = new Hono();

// GET /api/images - list with pagination
images.get('/', (c) => {
  const parsed = ListQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  const { page, limit, sort, order, includeTags, excludeTags, tagMode } = parsed.data;
  const offset = (page - 1) * limit;
  const db = getDb();
  const listOptions: { limit: number; offset: number; sort?: SortColumn; order?: SortOrder; includeTagIds?: number[]; excludeTagIds?: number[]; tagMode?: 'and' | 'or' } = { limit, offset };
  if (typeof sort === 'string' && isSortColumn(sort)) {
    listOptions.sort = sort;
  }
  if (typeof order === 'string' && isSortOrder(order)) {
    listOptions.order = order;
  }

  // Parse include tag IDs from comma-separated string
  if (typeof includeTags === 'string' && includeTags.length > 0) {
    const tagIdResults = includeTags.split(',').map((s) => z.coerce.number().int().positive().safeParse(s.trim()));
    const validTagIds: number[] = [];
    for (const result of tagIdResults) {
      if (!result.success) {
        return c.json({ error: 'Invalid tag ID in includeTags parameter' }, 400);
      }
      validTagIds.push(result.data);
    }
    listOptions.includeTagIds = validTagIds;
    listOptions.tagMode = tagMode;
  }

  // Parse exclude tag IDs from comma-separated string
  if (typeof excludeTags === 'string' && excludeTags.length > 0) {
    const tagIdResults = excludeTags.split(',').map((s) => z.coerce.number().int().positive().safeParse(s.trim()));
    const validTagIds: number[] = [];
    for (const result of tagIdResults) {
      if (!result.success) {
        return c.json({ error: 'Invalid tag ID in excludeTags parameter' }, 400);
      }
      validTagIds.push(result.data);
    }
    listOptions.excludeTagIds = validTagIds;
    listOptions.tagMode = tagMode;
  }

  const rows = getAllImages(db, listOptions);
  const countOptions: { includeTagIds?: number[]; excludeTagIds?: number[]; tagMode?: 'and' | 'or' } = {};
  if (listOptions.includeTagIds) {
    countOptions.includeTagIds = listOptions.includeTagIds;
  }
  if (listOptions.excludeTagIds) {
    countOptions.excludeTagIds = listOptions.excludeTagIds;
  }
  if (listOptions.tagMode) {
    countOptions.tagMode = listOptions.tagMode;
  }
  const total = countImages(db, countOptions);
  return c.json({ data: rows, total, page, limit });
});

// GET /api/images/search - FTS5 search (must be before :id to avoid conflict)
images.get('/search', (c) => {
  const parsed = SearchQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  const { q, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const db = getDb();
  const result = searchImages(db, q, limit, offset);
  return c.json({ data: result.data, total: result.total, page, limit });
});

// GET /api/images/:id - get by ID (includes tags)
images.get('/:id', (c) => {
  const idParsed = ImageId.safeParse(Number(c.req.param('id')));
  if (!idParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const db = getDb();
  const row = getImageById(db, idParsed.data);
  if (row === null) {
    return c.json({ error: 'Image not found' }, 404);
  }
  const imageTags = getImageTags(db, idParsed.data);
  return c.json({ data: { ...row, tags: imageTags } });
});

// PATCH /api/images/:id - update metadata
images.patch('/:id', async (c) => {
  const idParsed = ImageId.safeParse(Number(c.req.param('id')));
  if (!idParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const body: unknown = await c.req.json();
  const bodyParsed = ImagePatchBody.safeParse(body);
  if (!bodyParsed.success) {
    return c.json({ error: bodyParsed.error.issues }, 400);
  }
  const db = getDb();
  const existing = getImageById(db, idParsed.data);
  if (existing === null) {
    return c.json({ error: 'Image not found' }, 404);
  }
  const updateData: { title?: string | null } = {};
  if (bodyParsed.data.title !== undefined) {
    updateData.title = bodyParsed.data.title;
  }
  updateImage(db, idParsed.data, updateData);
  const updated = getImageById(db, idParsed.data);
  return c.json({ data: updated });
});

// GET /api/images/:id/file - serve original image file
images.get('/:id/file', (c) => {
  const idParsed = ImageId.safeParse(Number(c.req.param('id')));
  if (!idParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const db = getDb();
  const row = getImageById(db, idParsed.data);
  if (row === null) {
    return c.json({ error: 'Image not found' }, 404);
  }
  const file = Bun.file(row.file_path);
  return stream(c, async (s) => {
    const readable = file.stream();
    const reader = readable.getReader();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- streaming loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await s.write(value);
    }
  });
});

// GET /api/images/:id/thumb - serve thumbnail
images.get('/:id/thumb', (c) => {
  const idParsed = ImageId.safeParse(Number(c.req.param('id')));
  if (!idParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const db = getDb();
  const row = getImageById(db, idParsed.data);
  if (row === null) {
    return c.json({ error: 'Image not found' }, 404);
  }
  if (row.thumb_path === null) {
    return c.json({ error: 'Thumbnail not available' }, 404);
  }
  const file = Bun.file(row.thumb_path);
  return stream(c, async (s) => {
    const readable = file.stream();
    const reader = readable.getReader();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- streaming loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await s.write(value);
    }
  });
});

export { images };
