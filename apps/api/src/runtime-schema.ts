import { Database } from 'bun:sqlite';

/**
 * Creates additive v0.5.0/v0.6.0 schema before the API accepts traffic. This keeps a
 * rolling deployment from silently falling back to process-local lock state.
 * Destructive or column-changing migrations remain an explicit DB operation.
 */
function addColumnIfMissing(sqlite: Database, table: string, column: string, definition: string): void {
  const columns = sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function ensureRuntimeSchema(dbPath: string): void {
  const sqlite = new Database(dbPath);
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS auth_lockouts (
        phone TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_failed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS assessment_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assessment_kind TEXT NOT NULL,
        command_id TEXT NOT NULL UNIQUE,
        item_set_version TEXT NOT NULL,
        correct_count INTEGER NOT NULL,
        item_count INTEGER NOT NULL,
        derived_level TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    addColumnIfMissing(sqlite, 'users', 'password_hash', 'TEXT');
    addColumnIfMissing(sqlite, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(sqlite, 'users', 'password_updated_at', 'TEXT');
    addColumnIfMissing(sqlite, 'content_library', 'illustration', 'TEXT');
  } finally {
    sqlite.close();
  }
}
