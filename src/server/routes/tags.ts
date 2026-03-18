import { Hono } from 'hono';
import { z } from 'zod';
import { ImageId, TagId } from '../../shared/brands';
import { TagCreateBody, TagRow } from '../../shared/schemas';
import { getDb } from '../db/connection';

const TagWithCount = TagRow.extend({
  image_count: z.number().int(),
});

const tags = new Hono();

// GET /api/tags - list all tags with image count
tags.get('/', (c) => {
  const db = getDb();
  const rows: unknown[] = db
    .query(
      `SELECT tags.*, COUNT(image_tags.image_id) as image_count
       FROM tags
       LEFT JOIN image_tags ON tags.id = image_tags.tag_id
       GROUP BY tags.id
       ORDER BY tags.name`,
    )
    .all();
  const parsed = rows.map((row) => TagWithCount.parse(row));
  return c.json({ data: parsed });
});

// POST /api/tags - create tag
tags.post('/', async (c) => {
  const body: unknown = await c.req.json();
  const bodyParsed = TagCreateBody.safeParse(body);
  if (!bodyParsed.success) {
    return c.json({ error: bodyParsed.error.issues }, 400);
  }
  const db = getDb();

  // Check for duplicate
  const existing: unknown = db.query('SELECT * FROM tags WHERE name = ?1').get(bodyParsed.data.name);
  if (existing !== null) {
    return c.json({ error: 'Tag already exists' }, 409);
  }

  const result: unknown = db
    .query('INSERT INTO tags (name) VALUES (?1) RETURNING *')
    .get(bodyParsed.data.name);
  const tag = TagRow.parse(result);
  return c.json({ data: tag }, 201);
});

// DELETE /api/tags/:id - delete tag
tags.delete('/:id', (c) => {
  const idParsed = TagId.safeParse(Number(c.req.param('id')));
  if (!idParsed.success) {
    return c.json({ error: 'Invalid tag ID' }, 400);
  }
  const db = getDb();
  const existing: unknown = db.query('SELECT * FROM tags WHERE id = ?1').get(idParsed.data);
  if (existing === null) {
    return c.json({ error: 'Tag not found' }, 404);
  }
  db.query('DELETE FROM tags WHERE id = ?1').run(idParsed.data);
  return c.json({ success: true });
});

// POST /api/images/:imageId/tags - add tag to image
tags.post('/images/:imageId/tags', async (c) => {
  const imageIdParsed = ImageId.safeParse(Number(c.req.param('imageId')));
  if (!imageIdParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const body: unknown = await c.req.json();
  const bodyParsed = z.object({ tag_id: TagId }).safeParse(body);
  if (!bodyParsed.success) {
    return c.json({ error: bodyParsed.error.issues }, 400);
  }

  const db = getDb();

  // Verify image exists
  const image: unknown = db.query('SELECT id FROM images WHERE id = ?1').get(imageIdParsed.data);
  if (image === null) {
    return c.json({ error: 'Image not found' }, 404);
  }

  // Verify tag exists
  const tag: unknown = db.query('SELECT id FROM tags WHERE id = ?1').get(bodyParsed.data.tag_id);
  if (tag === null) {
    return c.json({ error: 'Tag not found' }, 404);
  }

  // Check if already tagged
  const existing: unknown = db
    .query('SELECT * FROM image_tags WHERE image_id = ?1 AND tag_id = ?2')
    .get(imageIdParsed.data, bodyParsed.data.tag_id);
  if (existing !== null) {
    return c.json({ error: 'Tag already assigned to image' }, 409);
  }

  db.query('INSERT INTO image_tags (image_id, tag_id) VALUES (?1, ?2)').run(
    imageIdParsed.data,
    bodyParsed.data.tag_id,
  );
  return c.json({ success: true }, 201);
});

// DELETE /api/images/:imageId/tags/:tagId - remove tag from image
tags.delete('/images/:imageId/tags/:tagId', (c) => {
  const imageIdParsed = ImageId.safeParse(Number(c.req.param('imageId')));
  if (!imageIdParsed.success) {
    return c.json({ error: 'Invalid image ID' }, 400);
  }
  const tagIdParsed = TagId.safeParse(Number(c.req.param('tagId')));
  if (!tagIdParsed.success) {
    return c.json({ error: 'Invalid tag ID' }, 400);
  }

  const db = getDb();
  const existing: unknown = db
    .query('SELECT * FROM image_tags WHERE image_id = ?1 AND tag_id = ?2')
    .get(imageIdParsed.data, tagIdParsed.data);
  if (existing === null) {
    return c.json({ error: 'Tag not assigned to image' }, 404);
  }

  db.query('DELETE FROM image_tags WHERE image_id = ?1 AND tag_id = ?2').run(
    imageIdParsed.data,
    tagIdParsed.data,
  );
  return c.json({ success: true });
});

export { tags };
