import { Database } from 'bun:sqlite';
import { env } from '../config';

let instance: Database | null = null;

export function getDb(): Database {
  if (instance === null) {
    instance = new Database(env.DB_PATH);
    instance.exec('PRAGMA journal_mode = WAL');
    instance.exec('PRAGMA foreign_keys = ON');
  }
  return instance;
}
