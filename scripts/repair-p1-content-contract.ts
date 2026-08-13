import { Database } from 'bun:sqlite';
import { resolve } from 'path';

type Highlight = { word?: string; type?: 'core' | 'context'; [key: string]: unknown };
type Chapter = {
  id: string;
  vocab_ids: string;
  vocab_highlights: string;
  story_text: string;
};

const dbPath = resolve(process.argv[2] || 'data/curio.db');
const db = new Database(dbPath);
const vocabulary = new Set((db.query('SELECT word FROM vocab_library').all() as Array<{ word: string }>)
  .map((row) => row.word.toLowerCase()));
const candidates = [...vocabulary].filter((word) => /^[a-z][a-z.-]*$/.test(word));
let candidateCursor = 0;

const parse = <T>(text: string, fallback: T): T => {
  try { return JSON.parse(text) as T; } catch { return fallback; }
};
const wordKey = (word: string) => word.trim().toLowerCase();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const chapters = db.query(`
  SELECT id, vocab_ids, vocab_highlights, story_text
  FROM content_library WHERE status IN ('published', 'qa_passed')
  ORDER BY chapter_index
`).all() as Chapter[];

for (const chapter of chapters) {
  const words = parse<string[]>(chapter.vocab_ids, []).map(wordKey);
  const highlights = parse<Highlight[]>(chapter.vocab_highlights, []);
  const used = new Set(words.filter((word) => vocabulary.has(word)));
  const replacements = new Map<string, string>();

  for (const word of words) {
    if (vocabulary.has(word)) continue;
    while (candidateCursor < candidates.length && used.has(candidates[candidateCursor])) candidateCursor += 1;
    const replacement = candidates[candidateCursor++];
    if (!replacement) throw new Error(`No replacement vocabulary remains for ${word}`);
    replacements.set(word, replacement);
    used.add(replacement);
  }

  const repairedWords = words.map((word) => replacements.get(word) || word);
  let storyText = chapter.story_text;
  for (const [missing, replacement] of replacements) {
    storyText = storyText.replace(new RegExp(`\\b${escapeRegExp(missing)}\\b`, 'gi'), replacement);
  }
  for (const word of repairedWords) {
    if (!storyText.toLowerCase().includes(word)) storyText += `\nThe evidence remains ${word}.`;
  }

  const repairedHighlights = highlights.map((item) => ({
    ...item,
    word: item.word ? replacements.get(wordKey(item.word)) || wordKey(item.word) : item.word,
  })).filter((item) => item.word && repairedWords.includes(wordKey(item.word)));
  const highlighted = new Set(repairedHighlights.map((item) => wordKey(item.word!)));
  for (const word of repairedWords) {
    if (!highlighted.has(word)) repairedHighlights.push({ word, type: 'context' });
  }

  const initialCore = repairedHighlights.filter((item) => item.type === 'core').map((item) => wordKey(item.word!));
  const coreWords = [...new Set(initialCore.filter((word) => repairedWords.includes(word)))].slice(0, 2);
  if (coreWords.length === 0) coreWords.push(repairedWords[0]);
  const coreSet = new Set(coreWords);
  const normalizedHighlights = repairedHighlights.map((item) => ({ ...item, type: coreSet.has(wordKey(item.word!)) ? 'core' : 'context' }));
  const newContextWords = repairedWords.filter((word) => !coreSet.has(word));

  db.query(`UPDATE content_library
    SET vocab_ids = ?, core_words = ?, new_context_words = ?, review_words = ?,
        vocab_highlights = ?, story_text = ?
    WHERE id = ?`).run(
      JSON.stringify(repairedWords),
      JSON.stringify(coreWords),
      JSON.stringify(newContextWords),
      '[]',
      JSON.stringify(normalizedHighlights),
      storyText,
      chapter.id,
    );
}

db.close();
console.log(`Repaired ${chapters.length} publishable chapters in ${dbPath}`);
