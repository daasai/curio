import { Database } from 'bun:sqlite';
import { resolve } from 'path';
import { ensureRuntimeSchema } from '../apps/api/src/runtime-schema';

const databasePath = resolve(process.argv[2] || 'data/curio.db');
const chapterId = 'chapter_1_v2';
const replacements = new Map([
  ['a', 'logical'],
  ['a.m.', 'contradictory'],
  ['abandon', 'danger'],
]);

ensureRuntimeSchema(databasePath);
const db = new Database(databasePath);
try {
  const chapter = db.query(`
    SELECT id, story_text, vocab_ids, vocab_highlights, new_context_words, status
    FROM content_library WHERE id = ?
  `).get(chapterId) as {
    id: string; story_text: string; vocab_ids: string; vocab_highlights: string; new_context_words: string; status: string;
  } | null;
  if (!chapter || chapter.status !== 'published') throw new Error(`Published chapter ${chapterId} was not found`);

  const storyText = chapter.story_text
    .replace('严密的 a 从', '严密的 logical analysis，从')
    .replace('明显的 a.m.，', '明显的 contradictory signals，')
    .replace('极度的 abandon 之中', '极度的 danger 之中');
  if (storyText === chapter.story_text) throw new Error('Expected malformed Chapter 1 vocabulary placements were not found');

  const mapWords = (value: string) => JSON.stringify((JSON.parse(value) as string[]).map((word) => replacements.get(word) || word));
  const highlights = JSON.stringify((JSON.parse(chapter.vocab_highlights) as Array<{ word: string; type: string }>).map((item) => ({
    ...item,
    word: replacements.get(item.word) || item.word,
  })));

  db.query(`
    UPDATE content_library
    SET story_text = ?, vocab_ids = ?, vocab_highlights = ?, new_context_words = ?
    WHERE id = ?
  `).run(storyText, mapWords(chapter.vocab_ids), highlights, mapWords(chapter.new_context_words), chapterId);
  console.log(`Chapter 1 vocabulary contract repaired for ${chapterId}.`);
} finally {
  db.close();
}
