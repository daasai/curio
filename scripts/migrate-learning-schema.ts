import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const dbPath = process.env.DB_PATH || resolve(__dirname, '../data/curio.db');
console.log(`Migrating database at: ${dbPath}`);

const db = new Database(dbPath);

// Create story_progress
db.exec(`
  CREATE TABLE IF NOT EXISTS story_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    storyline_id TEXT NOT NULL DEFAULT 'canglan_mist',
    current_chapter_index INTEGER NOT NULL DEFAULT 1,
    active_session_id TEXT,
    first_started_at TEXT NOT NULL,
    last_completed_at TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, storyline_id)
  )
`);

// Create learning_sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS learning_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    chapter_version_id TEXT NOT NULL,
    storyline_id TEXT NOT NULL DEFAULT 'canglan_mist',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    first_choice_option_id TEXT,
    first_choice_correct INTEGER,
    branch_completed_at TEXT,
    discrimination_first_correct INTEGER,
    discrimination_final_correct INTEGER
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON learning_sessions(user_id, status)`);

// Create learning_events
db.exec(`
  CREATE TABLE IF NOT EXISTS learning_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_id TEXT NOT NULL REFERENCES learning_sessions(id),
    event_type TEXT NOT NULL,
    payload TEXT,
    occurred_at TEXT NOT NULL,
    received_at TEXT NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_events_user_type_time ON learning_events(user_id, event_type, occurred_at)`);

// Create chapter_completions
db.exec(`
  CREATE TABLE IF NOT EXISTS chapter_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    chapter_version_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    UNIQUE(user_id, chapter_version_id)
  )
`);

// Extend content_library
const tableInfo = db.query(`PRAGMA table_info(content_library)`).all() as any[];
const columnNames = tableInfo.map(col => col.name);

const alterTable = (colName: string, def: string) => {
  if (!columnNames.includes(colName)) {
    db.exec(`ALTER TABLE content_library ADD COLUMN ${colName} ${def}`);
    console.log(`Added column ${colName} to content_library`);
  }
};

alterTable('storyline_id', "TEXT DEFAULT 'canglan_mist'");
alterTable('version', "INTEGER DEFAULT 1");
alterTable('core_words', "TEXT DEFAULT '[]'");
alterTable('new_context_words', "TEXT DEFAULT '[]'");
alterTable('review_words', "TEXT DEFAULT '[]'");
alterTable('generation_metadata', "TEXT");
alterTable('quality_report', "TEXT");
alterTable('published_at', "TEXT");

// Update published_at for existing published/qa_passed records
db.exec(`
  UPDATE content_library 
  SET published_at = datetime('now') 
  WHERE status IN ('qa_passed', 'published') AND published_at IS NULL
`);

console.log('Migration completed successfully.');
db.close();
