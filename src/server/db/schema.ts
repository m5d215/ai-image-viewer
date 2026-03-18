import type { Database } from 'bun:sqlite';

export function initializeDatabase(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path   TEXT NOT NULL UNIQUE,
      file_name   TEXT NOT NULL,
      title       TEXT,
      prompt      TEXT,
      width       INTEGER,
      height      INTEGER,
      file_size   INTEGER,
      file_mtime  TEXT NOT NULL,
      thumb_path  TEXT,
      created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
      title,
      prompt,
      content='images',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS images_ai AFTER INSERT ON images BEGIN
      INSERT INTO images_fts(rowid, title, prompt)
      VALUES (new.id, new.title, new.prompt);
    END;

    CREATE TRIGGER IF NOT EXISTS images_ad AFTER DELETE ON images BEGIN
      INSERT INTO images_fts(images_fts, rowid, title, prompt)
      VALUES ('delete', old.id, old.title, old.prompt);
    END;

    CREATE TRIGGER IF NOT EXISTS images_au AFTER UPDATE ON images BEGIN
      INSERT INTO images_fts(images_fts, rowid, title, prompt)
      VALUES ('delete', old.id, old.title, old.prompt);
      INSERT INTO images_fts(rowid, title, prompt)
      VALUES (new.id, new.title, new.prompt);
    END;

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (image_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_images_created  ON images(created_at);
    CREATE INDEX IF NOT EXISTS idx_images_mtime    ON images(file_mtime);
    CREATE INDEX IF NOT EXISTS idx_image_tags_tag  ON image_tags(tag_id);
  `);
}
