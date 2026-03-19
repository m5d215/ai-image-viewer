import { Database } from 'bun:sqlite';
import { env } from '../config';

let instance: Database | null = null;

export function getDb(): Database {
  if (instance === null) {
    instance = new Database(env.DB_PATH);
    instance.run('PRAGMA journal_mode = WAL');
    instance.run('PRAGMA foreign_keys = ON');
  }
  return instance;
}
