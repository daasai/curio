import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync } from 'fs';

const dbPath = join(process.cwd(), 'data', 'curio.db');

if (!existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

const columns = db.query(`PRAGMA table_info(content_library);`).all() as { name: string }[];
const hasStatus = columns.some((col) => col.name === 'status');

if (!hasStatus) {
  console.log("Adding 'status' column to content_library...");
  db.exec(`ALTER TABLE content_library ADD COLUMN status TEXT DEFAULT 'draft';`);
} else {
  console.log("'status' column already exists.");
}

console.log("Updating all existing content to status = 'draft'...");
db.exec(`UPDATE content_library SET status = 'draft';`);

console.log("Migration completed.");
db.close();
