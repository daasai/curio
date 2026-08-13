import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export * from './schema';
export { schema };

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  // Ensure write-ahead logging (WAL) mode for better concurrency in SQLite
  sqlite.exec('PRAGMA journal_mode = WAL;');
  return drizzle(sqlite, { schema });
}
