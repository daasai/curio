import { Database } from 'bun:sqlite';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, resolve } from 'path';
import { createTestDb } from '../apps/api/tests/test-utils';

const targetPath = resolve('.scratch/e2e/curio-e2e.db');
mkdirSync(dirname(targetPath), { recursive: true });
// SQLite may replay a stale WAL even after the main fixture is replaced. Clear
// all three files so every E2E run starts from one self-consistent database.
for (const path of [targetPath, `${targetPath}-wal`, `${targetPath}-shm`]) {
  if (existsSync(path)) rmSync(path);
}

const temporary = createTestDb();
copyFileSync(temporary.dbPath, targetPath);
temporary.cleanup();

const db = new Database(targetPath);
const now = new Date().toISOString();
const pinHash = await Bun.password.hash('123456', { algorithm: 'bcrypt', cost: 4 });

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_user', '13800001002', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_recovery_user', '13800001003', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_chapter_reset_user', '13800001004', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

// This user deliberately has no diagnostic profile. It keeps the onboarding
// persistence-and-refresh E2E path independent from the chapter fixtures.
db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak)
  VALUES ('e2e_onboarding_user', '13800001005', ?, 'active', ?, 0)
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_home_metrics_user', '13800001006', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_home_chapter_user', '13800001007', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak)
  VALUES ('e2e_onboarding_mobile_user', '13800001008', ?, 'active', ?, 0)
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_chapter_reset_mobile_user', '13800001009', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_safari_mobile_user', '13800001010', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO users (id, phone, pin_hash, status, created_at, streak, story_genre_preferences, intensity)
  VALUES ('e2e_learning_mobile_user', '13800001011', ?, 'active', ?, 0, 'mystery', 'medium')
`).run(pinHash, now);

db.query(`
  INSERT INTO vocab_library (word, phonetic, pos, meaning_cn, level, gaokao_frequency)
  VALUES ('cascade', '/kæˈskeɪd/', 'n./v.', '层叠落下；级联', 2, 'medium')
`).run();

db.query(`
  INSERT INTO vocab_library (word, phonetic, pos, meaning_cn, level, gaokao_frequency)
  VALUES ('ambiguous', '/æmˈbɪɡjuəs/', 'adj.', '模糊的；歧义的', 1, 'high')
`).run();

db.query(`
  INSERT INTO content_library (
    id, vocab_ids, genre, chapter_index, title, story_text, vocab_highlights,
    choice_prompt, choices, branch_stories, chapter_summary, created_at, status, illustration
  ) VALUES (
    'e2e_chapter_1', '["cascade","ambiguous"]', 'mystery', 1, '测试章节',
    'The evidence began to cascade through the city archive, leaving an ambiguous clue.',
    '[{"word":"cascade","type":"core"},{"word":"ambiguous","type":"context"}]',
    'Which meaning fits cascade?',
    '[{"id":"A","text":"忽略线索","isCorrect":false,"reason":"需要回到证据核对"},{"id":"B","text":"层叠落下","isCorrect":true,"reason":"正确"}]',
    '{"A":"支线汇流"}', 'E2E fixture', ?, 'published',
    '{"assetPath":"/assets/canglan-mist-chapter-1-comic-v1.png","alt":"E2E four-panel comic","placement":"before_story","panelCount":4,"assetVersion":"v1"}'
  )
`).run(now);

db.query(`
  INSERT INTO content_library (
    id, vocab_ids, genre, chapter_index, title, story_text, vocab_highlights,
    choice_prompt, choices, branch_stories, chapter_summary, created_at, status
  ) VALUES (
    'e2e_chapter_2', '["cascade","ambiguous"]', 'mystery', 2, '第二测试章节',
    'The clue began to cascade through the harbor, leaving an ambiguous signal.',
    '[{"word":"cascade","type":"core"},{"word":"ambiguous","type":"context"}]',
    'Which meaning fits ambiguous?',
    '[{"id":"A","text":"忽略线索","isCorrect":false,"reason":"需要回到证据核对"},{"id":"B","text":"层叠落下","isCorrect":true,"reason":"正确"}]',
    '{"A":"第二章支线汇流"}', 'E2E fixture chapter 2', ?, 'published'
  )
`).run(now);

db.query(`
  INSERT INTO content_library (
    id, vocab_ids, genre, chapter_index, title, story_text, vocab_highlights,
    choice_prompt, choices, branch_stories, chapter_summary, created_at, status
  ) VALUES (
    'e2e_chapter_3', '["cascade","ambiguous"]', 'mystery', 3, '第三测试章节',
    'The final clue began to cascade through the archive, leaving an ambiguous trace.',
    '[{"word":"cascade","type":"core"},{"word":"ambiguous","type":"context"}]',
    'Which meaning fits cascade?',
    '[{"id":"A","text":"忽略线索","isCorrect":false,"reason":"需要回到证据核对"},{"id":"B","text":"层叠落下","isCorrect":true,"reason":"正确"}]',
    '{"A":"第三章支线汇流"}', 'E2E fixture chapter 3', ?, 'published'
  )
`).run(now);

db.close();
console.log(`E2E fixture ready: ${targetPath}`);
