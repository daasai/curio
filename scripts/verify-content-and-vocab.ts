import { Database } from 'bun:sqlite';
import { resolve } from 'path';
import { existsSync } from 'fs';

type ChapterRow = {
  id: string;
  chapter_index: number;
  version: number | null;
  title: string;
  story_text: string;
  vocab_ids: string;
  vocab_highlights: string;
  core_words: string | null;
  new_context_words: string | null;
  review_words: string | null;
  choices: string;
  branch_stories: string;
  illustration: string | null;
  status: string | null;
};

type Highlight = { word?: string; type?: string };
type Choice = { id?: string; isCorrect?: boolean };
type Illustration = { assetPath?: string; alt?: string; placement?: string; panelCount?: number; assetVersion?: string };

const databasePath = resolve(process.argv[2] || 'data/curio.db');
const failures: string[] = [];
const warnings: string[] = [];
const disallowedTargetWords = new Set(['a', 'an', 'the', 'a.m.', 'p.m.']);

function fail(message: string) {
  failures.push(message);
}

function parseStringArray(value: string | null | undefined, label: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      fail(`${label}: 不是字符串数组`);
      return [];
    }
    return parsed.map((word) => word.trim()).filter(Boolean);
  } catch {
    fail(`${label}: JSON 无法解析`);
    return [];
  }
}

function parseHighlights(value: string, label: string): Highlight[] {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) {
      fail(`${label}: 不是数组`);
      return [];
    }
    return parsed;
  } catch {
    fail(`${label}: JSON 无法解析`);
    return [];
  }
}

function parseChoices(value: string, label: string): Choice[] {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) {
      fail(`${label}: 不是数组`);
      return [];
    }
    return parsed;
  } catch {
    fail(`${label}: JSON 无法解析`);
    return [];
  }
}

function parseBranches(value: string, label: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail(`${label}: 不是对象`);
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    fail(`${label}: JSON 无法解析`);
    return {};
  }
}

function narrativeLength(value: string): number {
  return [...value].filter((char) => !/\s/.test(char)).length;
}

function wordKey(word: string) {
  return word.trim().toLowerCase();
}

function containsSentenceWithWord(storyText: string, word: string): boolean {
  const fragments = storyText.split(/[。！？]/).map((item) => item.trim()).filter(Boolean);
  const lower = wordKey(word);
  return fragments.some((fragment) => fragment.toLowerCase().includes(lower));
}

function parseIllustration(value: string | null, label: string): Illustration | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail(`${label}: 不是对象`);
      return null;
    }
    return parsed as Illustration;
  } catch {
    fail(`${label}: JSON 无法解析`);
    return null;
  }
}

if (!existsSync(databasePath)) {
  console.error(`CONTENT_AUDIT_FAIL: 找不到数据库 ${databasePath}`);
  process.exit(1);
}

const db = new Database(databasePath, { readonly: true });
const vocabRows = db.query(`
  SELECT word, phonetic, pos, meaning_cn, word_family
  FROM vocab_library
`).all() as Array<{ word: string; phonetic: string; pos: string; meaning_cn: string; word_family: string | null }>;

if (vocabRows.length !== 3500) {
  fail(`词库数量应为 3500，实际为 ${vocabRows.length}`);
}

const vocabulary = new Map<string, { phonetic: string; pos: string; meaning: string }>();
let wordsWithVerifiedFamily = 0;
for (const row of vocabRows) {
  const key = wordKey(row.word);
  if (!key) fail('词库存在空词头');
  if (vocabulary.has(key)) fail(`词库存在大小写重复词头: ${row.word}`);
  if (!row.phonetic?.trim()) fail(`词库词 ${row.word} 缺少音标`);
  if (!row.pos?.trim()) fail(`词库词 ${row.word} 缺少词性`);
  if (!row.meaning_cn?.trim()) fail(`词库词 ${row.word} 缺少中文释义`);
  vocabulary.set(key, { phonetic: row.phonetic, pos: row.pos, meaning: row.meaning_cn });
  const family = row.word_family?.split(',').map(wordKey).filter(Boolean) || [];
  if (family.length > 0) wordsWithVerifiedFamily += 1;
  if (new Set(family).size !== family.length) fail(`词库词 ${row.word} 的词族存在重复词形`);
  if (family.includes(key)) fail(`词库词 ${row.word} 的词族不得包含自身`);
}

const chapters = db.query(`
  SELECT id, chapter_index, version, title, story_text, vocab_ids, vocab_highlights,
         core_words, new_context_words, review_words, choices, branch_stories, illustration, status
  FROM content_library
  WHERE status IN ('published', 'qa_passed')
  ORDER BY chapter_index ASC, version DESC
`).all() as ChapterRow[];

if (chapters.length !== 10) {
  fail(`可用于试点的章节应为 10，实际为 ${chapters.length}`);
}

const chapterIndexes = new Set<number>();
for (const chapter of chapters) {
  const prefix = `第 ${chapter.chapter_index} 章 (${chapter.id})`;
  if (chapterIndexes.has(chapter.chapter_index)) fail(`${prefix}: 存在重复发布章节序号`);
  chapterIndexes.add(chapter.chapter_index);
  if (!chapter.title.trim()) fail(`${prefix}: 缺少标题`);
  if (!chapter.story_text.trim()) fail(`${prefix}: 缺少正文`);

  const coreWords = parseStringArray(chapter.core_words, `${prefix} core_words`);
  const contextWords = parseStringArray(chapter.new_context_words, `${prefix} new_context_words`);
  const reviewWords = parseStringArray(chapter.review_words, `${prefix} review_words`);
  const legacyWords = parseStringArray(chapter.vocab_ids, `${prefix} vocab_ids`);
  const hasExplicitRoles = coreWords.length + contextWords.length + reviewWords.length > 0;
  const targetWords = hasExplicitRoles ? [...coreWords, ...contextWords, ...reviewWords] : legacyWords;

  if (!hasExplicitRoles) {
    fail(`${prefix}: 仍依赖 vocab_ids，缺少显式 core_words/new_context_words/review_words`);
  }
  if (coreWords.length < 1 || coreWords.length > 2) {
    fail(`${prefix}: 核心词数量应为 1–2，实际为 ${coreWords.length}`);
  }
  if (reviewWords.length > 5) fail(`${prefix}: 复现词数量不得超过 5，实际为 ${reviewWords.length}`);

  const targetKeys = targetWords.map(wordKey);
  if (new Set(targetKeys).size !== targetKeys.length) fail(`${prefix}: 三类目标词存在重复`);
  if (targetWords.length !== 15) fail(`${prefix}: 目标词总数应为 15，实际为 ${targetWords.length}`);

  const highlights = parseHighlights(chapter.vocab_highlights, `${prefix} vocab_highlights`);
  const highlightedKeys = new Set<string>();
  for (const highlight of highlights) {
    if (!highlight.word?.trim()) {
      fail(`${prefix}: 存在没有词头的高亮项`);
      continue;
    }
    const key = wordKey(highlight.word);
    highlightedKeys.add(key);
    if (!vocabulary.has(key)) fail(`${prefix}: 高亮词 ${highlight.word} 不在词库中`);
    if (highlight.type !== 'core' && highlight.type !== 'context') {
      fail(`${prefix}: 高亮词 ${highlight.word} 的 type 必须是 core 或 context`);
    }
  }

  for (const word of targetWords) {
    const key = wordKey(word);
    if (disallowedTargetWords.has(key)) fail(`${prefix}: 目标词 ${word} 是功能词或时间缩写，不能作为章节学习目标`);
    if (!vocabulary.has(key)) fail(`${prefix}: 目标词 ${word} 不在词库中`);
    if (!highlightedKeys.has(key)) fail(`${prefix}: 目标词 ${word} 未作为高亮词返回给前端`);
    if (!chapter.story_text.toLowerCase().includes(key)) fail(`${prefix}: 目标词 ${word} 未出现在正文中`);
    if (!containsSentenceWithWord(chapter.story_text, word)) fail(`${prefix}: 目标词 ${word} 缺少可展示的正文语境句`);
  }

  const illustration = parseIllustration(chapter.illustration, `${prefix} illustration`);
  if (illustration) {
    if (!illustration.assetPath?.startsWith('/assets/')) fail(`${prefix}: 插画 assetPath 必须是本地 /assets/ 路径`);
    if (!illustration.alt?.trim()) fail(`${prefix}: 插画缺少替代文本`);
    if (illustration.placement !== 'before_story') fail(`${prefix}: 插画 placement 必须为 before_story`);
    if (illustration.panelCount !== 4) fail(`${prefix}: 插画 panelCount 必须为 4`);
    if (!illustration.assetVersion?.trim()) fail(`${prefix}: 插画缺少 assetVersion`);
    if (illustration.assetPath && !existsSync(resolve('apps/web/public', illustration.assetPath.slice(1)))) {
      fail(`${prefix}: 插画文件不存在 ${illustration.assetPath}`);
    }
  }

  const coreHighlightCount = highlights.filter((item) => item.type === 'core').length;
  if (coreHighlightCount < 1 || coreHighlightCount > 2) {
    warnings.push(`${prefix}: 高亮核心词数量为 ${coreHighlightCount}；请在显式字段补齐后复核一致性`);
  }

  const choices = parseChoices(chapter.choices, `${prefix} choices`);
  const branches = parseBranches(chapter.branch_stories, `${prefix} branch_stories`);
  for (const choice of choices) {
    if (choice.isCorrect) continue;
    if (!choice.id) {
      fail(`${prefix}: 错误选项缺少 id`);
      continue;
    }
    const branch = branches[choice.id];
    if (typeof branch !== 'string' || !branch.trim()) {
      fail(`${prefix}: 错误选项 ${choice.id} 缺少支线汇流`);
      continue;
    }
    const length = narrativeLength(branch);
    if (length < 100 || length > 150) {
      fail(`${prefix}: 错误选项 ${choice.id} 支线汇流应为 100–150 字，实际为 ${length} 字`);
    }
  }
}

db.close();

console.log(`CONTENT_AUDIT: 词库 ${vocabRows.length} 条；词族已验证 ${wordsWithVerifiedFamily} 条；可用章节 ${chapters.length} 章。`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const message of failures.slice(0, 80)) console.error(`FAIL: ${message}`);
if (failures.length > 80) console.error(`FAIL: 另有 ${failures.length - 80} 项未展开`);

if (failures.length > 0) {
  console.error(`CONTENT_AUDIT_FAIL: 共 ${failures.length} 项质量问题。`);
  process.exit(1);
}

console.log('CONTENT_AUDIT_PASS');
