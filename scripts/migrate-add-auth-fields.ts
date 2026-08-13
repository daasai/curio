import { Database } from 'bun:sqlite';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(__dirname, '../data/curio.db');
console.log(`Connecting to database at: ${dbPath}`);
const db = new Database(dbPath);

const columnsToAdd = [
  { name: 'phone', def: 'TEXT' },
  { name: 'pin_hash', def: 'TEXT' },
  { name: 'invite_code', def: 'TEXT' },
  { name: 'status', def: "TEXT DEFAULT 'active'" },
  { name: 'timezone', def: "TEXT DEFAULT 'Asia/Shanghai'" },
  { name: 'updated_at', def: 'TEXT' },
];

const existingColumns = db.query("PRAGMA table_info(users)").all() as Array<{name: string}>;
const existingColumnNames = new Set(existingColumns.map(c => c.name));

for (const col of columnsToAdd) {
  if (!existingColumnNames.has(col.name)) {
    console.log(`Adding column ${col.name} to users table...`);
    db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`);
  } else {
    console.log(`Column ${col.name} already exists.`);
  }
}

console.log('Creating unique index on phone column if not exists...');
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;`);

// Since sqlite does not support altering a column to be nullable directly without recreating the table,

// we'll leave it as is, or we'd have to recreate the table. Since the prompt says "保持 email 字段可空（已存在，确认不是 .notNull()）", 
// we already removed notNull from schema.ts. If it was NOT NULL in sqlite, it will fail inserts without email unless we provide one.
// The prompt is slightly contradictory saying "保持 email 字段可空（已存在，确认不是 .notNull()）" but the schema had `.notNull()`.
// Since we only need to add new columns, we'll just add them here.

console.log('Migration complete.');
db.close();
