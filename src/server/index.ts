import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serveStatic } from 'hono/bun';
import { env } from './config';
import { getDb } from './db/connection';
import { initializeDatabase } from './db/schema';
import { images } from './routes/images';
import { sync } from './routes/sync';
import { tags } from './routes/tags';

const app = new Hono();

// Conditional basic auth
if (env.AUTH_USER != null && env.AUTH_PASS != null) {
  app.use(
    '/*',
    basicAuth({
      username: env.AUTH_USER,
      password: env.AUTH_PASS,
    }),
  );
}

// Mount API routes
app.route('/api/images', images);
app.route('/api/tags', tags);
// Mount image-tag routes at the top level since they use /api/images/:id/tags pattern
app.route('/api', tags);
app.route('/api/sync', sync);

// Serve static files for SPA (production)
app.use('/*', serveStatic({ root: './dist/client' }));
app.use('/*', serveStatic({ root: './dist/client', path: 'index.html' }));

// Initialize database on startup
const db = getDb();
initializeDatabase(db);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
