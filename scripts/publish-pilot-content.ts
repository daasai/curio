import { Database } from 'bun:sqlite';
import { resolve } from 'path';

const sourcePath = resolve(process.argv[2] || 'data/curio.db');
const targetPath = resolve(process.argv[3] || sourcePath);
const columns = [
  'id', 'vocab_ids', 'genre', 'chapter_index', 'title', 'story_text', 'vocab_highlights',
  'choice_prompt', 'choice_trigger_position', 'choices', 'branch_stories', 'chapter_summary',
  'quality_score', 'created_at', 'status', 'generation_metadata', 'storyline_id', 'version',
  'core_words', 'new_context_words', 'review_words', 'quality_report', 'published_at',
] as const;

type ContentRow = Record<(typeof columns)[number], unknown>;

const source = new Database(sourcePath, { readonly: true });
const target = new Database(targetPath);

try {
  const sourceRows = source.query(`
    SELECT ${columns.join(', ')}
    FROM content_library
    WHERE status = 'published'
    ORDER BY chapter_index ASC, version DESC
  `).all() as ContentRow[];

  if (sourceRows.length !== 10 || sourceRows.some((row) => Number(row.version) < 2)) {
    throw new Error(`源内容必须恰有 10 个 v2+ 已发布章节，实际为 ${sourceRows.length}`);
  }

  const targetWords = new Set((target.query('SELECT word FROM vocab_library').all() as Array<{ word: string }>)
    .map((row) => row.word.toLowerCase()));
  for (const row of sourceRows) {
    const words = JSON.parse(String(row.vocab_ids)) as string[];
    const missing = words.filter((word) => !targetWords.has(word.toLowerCase()));
    if (missing.length > 0) throw new Error(`目标词库缺少 ${row.id} 的词：${missing.join(', ')}`);
  }

  const assignments = columns.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const upsert = target.query(`
    INSERT INTO content_library (${columns.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${assignments}
  `);

  target.transaction(() => {
    target.query(`
      UPDATE content_library
      SET status = 'retired'
      WHERE chapter_index BETWEEN 1 AND 10 AND status IN ('published', 'qa_passed')
    `).run();
    for (const row of sourceRows) upsert.run(...columns.map((column) => row[column]));
  })();

  console.log(`PILOT_CONTENT_PUBLISHED: ${sourceRows.length} chapters -> ${targetPath}`);
} finally {
  source.close();
  target.close();
}
