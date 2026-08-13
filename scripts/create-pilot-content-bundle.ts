import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, resolve } from 'path';

const sourcePath = resolve(process.argv[2] || 'data/curio.db');
const bundlePath = resolve(process.argv[3] || '.scratch/release/pilot-content-v2.db');
mkdirSync(dirname(bundlePath), { recursive: true });
if (existsSync(bundlePath)) rmSync(bundlePath);

const columns = [
  'id', 'vocab_ids', 'genre', 'chapter_index', 'title', 'story_text', 'vocab_highlights',
  'choice_prompt', 'choice_trigger_position', 'choices', 'branch_stories', 'chapter_summary',
  'quality_score', 'created_at', 'status', 'generation_metadata', 'storyline_id', 'version',
  'core_words', 'new_context_words', 'review_words', 'quality_report', 'published_at',
] as const;

const source = new Database(sourcePath, { readonly: true });
const bundle = new Database(bundlePath);
try {
  const rows = source.query(`SELECT ${columns.join(', ')} FROM content_library WHERE status = 'published' ORDER BY chapter_index`).all() as Array<Record<string, unknown>>;
  if (rows.length !== 10 || rows.some((row) => Number(row.version) < 2)) {
    throw new Error(`源数据库必须含 10 个 v2+ 已发布章节，实际为 ${rows.length}`);
  }
  bundle.exec(`CREATE TABLE content_library (${columns.map((column) => `${column} TEXT`).join(', ')}, PRIMARY KEY (id))`);
  const insert = bundle.query(`INSERT INTO content_library (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
  bundle.transaction(() => {
    for (const row of rows) insert.run(...columns.map((column) => row[column]));
  })();
  console.log(`PILOT_CONTENT_BUNDLE_READY: ${bundlePath}`);
} finally {
  source.close();
  bundle.close();
}
