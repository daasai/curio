import { Database } from 'bun:sqlite';
import { resolve, join } from 'path';
import { unlinkSync, mkdirSync, existsSync } from 'fs';

export function createTestDb() {
  if (!process.env.JWT_SECRET) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    process.env.JWT_SECRET = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  const prodDbPath1 = resolve(process.cwd(), 'data/curio.db');
  const prodDbPath2 = resolve(__dirname, '../../../data/curio.db');

  if (process.env.DB_PATH) {
    const currentDbPath = resolve(process.env.DB_PATH);
    if (currentDbPath === prodDbPath1 || currentDbPath === prodDbPath2) {
      throw new Error(`CRITICAL: Test is trying to use production database at ${currentDbPath}`);
    }
  }

  const scratchDir = resolve(process.cwd(), '.scratch/tests');
  if (!existsSync(scratchDir)) {
    try { mkdirSync(scratchDir, { recursive: true }); } catch (e) {}
  }

  const dbPath = join(scratchDir, `curio_test_${Date.now()}_${Math.floor(Math.random() * 100000)}.db`);
  
  if (dbPath === prodDbPath1 || dbPath === prodDbPath2) {
    throw new Error(`CRITICAL: Test DB path cannot be production database: ${dbPath}`);
  }

  const sqlite = new Database(dbPath);
  // Use DELETE mode for isolated test files so WAL files aren't locked across handles
  sqlite.exec('PRAGMA journal_mode = DELETE;');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT,
      pin_hash TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      password_updated_at TEXT,
      invite_code TEXT,
      status TEXT DEFAULT 'active',
      timezone TEXT DEFAULT 'Asia/Shanghai',
      updated_at TEXT,
      created_at TEXT NOT NULL,
      diagnostic_level TEXT,
      story_genre_preferences TEXT,
      intensity TEXT,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT
    );
    CREATE TABLE IF NOT EXISTS vocab_library (
      word TEXT PRIMARY KEY,
      phonetic TEXT NOT NULL,
      pos TEXT NOT NULL,
      meaning_cn TEXT NOT NULL,
      level INTEGER NOT NULL,
      gaokao_frequency TEXT NOT NULL,
      word_family TEXT,
      tags TEXT
    );
    CREATE TABLE IF NOT EXISTS user_vocab_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word TEXT NOT NULL REFERENCES vocab_library(word) ON DELETE CASCADE,
      status TEXT NOT NULL,
      seen_count INTEGER NOT NULL DEFAULT 0,
      clicked_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      incorrect_count INTEGER NOT NULL DEFAULT 0,
      interval INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      next_review_at TEXT,
      last_reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS content_library (
      id TEXT PRIMARY KEY,
      vocab_ids TEXT NOT NULL,
      genre TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      story_text TEXT NOT NULL,
      vocab_highlights TEXT NOT NULL,
      choice_prompt TEXT NOT NULL,
      choice_trigger_position REAL NOT NULL DEFAULT 0.7,
      choices TEXT NOT NULL,
      branch_stories TEXT NOT NULL,
      chapter_summary TEXT NOT NULL,
      quality_score REAL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      storyline_id TEXT DEFAULT 'canglan_mist',
      version INTEGER DEFAULT 1,
      core_words TEXT DEFAULT '[]',
      new_context_words TEXT DEFAULT '[]',
      review_words TEXT DEFAULT '[]',
      generation_metadata TEXT,
      quality_report TEXT,
      published_at TEXT,
      illustration TEXT
    );
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL REFERENCES content_library(id),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_seconds INTEGER,
      choice_selected TEXT,
      is_correct INTEGER
    );
    CREATE TABLE IF NOT EXISTS word_clicks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word TEXT NOT NULL REFERENCES vocab_library(word) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL,
      clicked_at TEXT NOT NULL
    );
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
    );
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
    );
    CREATE TABLE IF NOT EXISTS learning_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      event_type TEXT NOT NULL,
      payload TEXT,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chapter_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      chapter_version_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(user_id, chapter_version_id)
    );
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
  sqlite.close();

  // Set environment variable for test execution
  process.env.DB_PATH = dbPath;

  return {
    dbPath,
    cleanup: () => {
      try {
        if (existsSync(dbPath)) unlinkSync(dbPath);
      } catch (err) {}
    }
  };
}
