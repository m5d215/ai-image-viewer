import { Hono } from 'hono';
import { getDb } from '../db/connection';
import { syncImages } from '../services/sync';

let lastSyncTime: string | null = null;
let lastSyncResult: { added: number; updated: number; deleted: number; unchanged: number } | null =
  null;

const sync = new Hono();

// POST /api/sync - trigger full scan
sync.post('/', async (c) => {
  const db = getDb();
  const result = await syncImages(db);
  lastSyncTime = new Date().toISOString();
  lastSyncResult = result;
  return c.json({ data: result });
});

// GET /api/sync/status - return last sync time and result
sync.get('/status', (c) => {
  return c.json({
    data: {
      lastSyncTime,
      lastSyncResult,
    },
  });
});

export { sync };
