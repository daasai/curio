import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDb, schema } from 'curio-db';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-utils';
import { recordVocabInteraction } from '../src/scheduler';

describe('Learning vocabulary persistence contract', () => {
  let testDbInfo: { dbPath: string; cleanup: () => void };
  let app: any;
  let cookie: string;
  let sessionId: string;
  let db: ReturnType<typeof createDb>;

  beforeAll(async () => {
    testDbInfo = createTestDb();
    process.env.DB_PATH = testDbInfo.dbPath;
    db = createDb(testDbInfo.dbPath);

    await db.insert(schema.users).values({
      id: 'vocab_contract_user',
      phone: '13800001001',
      createdAt: new Date().toISOString(),
      status: 'active',
      streak: 0,
    });
    await db.insert(schema.vocabLibrary).values({
      word: 'ambiguous',
      phonetic: '/æmˈbɪɡjuəs/',
      pos: 'adj.',
      meaningCn: '模糊的；有歧义的',
      level: 1,
      gaokaoFrequency: 'high',
    });
    await db.insert(schema.vocabLibrary).values([
      {
        word: 'ambiguity',
        phonetic: '/ˌæmbɪˈɡjuːəti/',
        pos: 'n.',
        meaningCn: '歧义性；含糊不清',
        level: 1,
        gaokaoFrequency: 'medium',
      },
      {
        word: 'unambiguous',
        phonetic: '/ˌʌnæmˈbɪɡjuəs/',
        pos: 'adj.',
        meaningCn: '明确的；无歧义的',
        level: 2,
        gaokaoFrequency: 'low',
      },
    ]);
    await db.insert(schema.contentLibrary).values({
      id: 'vocab_contract_chapter_1',
      vocabIds: '["ambiguous"]',
      genre: 'mystery',
      chapterIndex: 1,
      title: 'Vocabulary contract chapter',
      storyText: 'The message was ambiguous.',
      vocabHighlights: '[{"word":"ambiguous","type":"core"}]',
      choicePrompt: 'What does ambiguous mean?',
      choices: '[]',
      branchStories: '{}',
      chapterSummary: 'Summary',
      createdAt: new Date().toISOString(),
      status: 'published',
    });

    app = (await import('../src/index')).default;
    const { signSession } = await import('../src/auth');
    cookie = `curio_session=${await signSession('vocab_contract_user')}`;

    const start = await app.fetch(new Request('http://localhost/api/learning/session/start', {
      method: 'POST',
      headers: { Cookie: cookie },
    }));
    const snapshot = await start.json();
    sessionId = snapshot.progress.activeSessionId;
  });

  afterAll(() => testDbInfo.cleanup());

  it('records a looked-up word once in the durable vocabulary state', async () => {
    const request = () => app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'vocab-open-001',
        eventType: 'word_opened',
        payload: { word: 'ambiguous' },
        occurredAt: '2026-07-30T00:00:00.000Z',
      }),
    }));

    expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(200);

    const state = await db.select().from(schema.userVocabState)
      .where(eq(schema.userVocabState.id, 'vocab_contract_user_ambiguous')).get();

    expect(state).toMatchObject({
      userId: 'vocab_contract_user',
      word: 'ambiguous',
      status: 'context_word',
      seenCount: 0,
      clickedCount: 1,
    });
  });

  it('returns structured word-family records with related vocabulary meanings', async () => {
    await db.update(schema.vocabLibrary)
      .set({ wordFamily: 'ambiguity,unambiguous' })
      .where(eq(schema.vocabLibrary.word, 'ambiguous'));

    const response = await app.fetch(new Request('http://localhost/api/learning/vocabulary/ambiguous', {
      headers: { Cookie: cookie },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.item.wordFamily).toEqual([
      { form: 'ambiguity', pos: 'n.', meaning: '歧义性；含糊不清' },
      { form: 'unambiguous', pos: 'adj.', meaning: '明确的；无歧义的' },
    ]);
  });

  it('returns an explicit empty word-family list when no verified relation exists', async () => {
    await db.update(schema.vocabLibrary)
      .set({ wordFamily: null })
      .where(eq(schema.vocabLibrary.word, 'ambiguous'));

    const response = await app.fetch(new Request('http://localhost/api/learning/vocabulary/ambiguous', {
      headers: { Cookie: cookie },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.item.wordFamily).toEqual([]);
    expect(body.item.meaningCn).toBe('模糊的；有歧义的');
  });

  it('never regresses a mastered word when it is opened again', async () => {
    await recordVocabInteraction(db, 'vocab_contract_user', 'ambiguous', 'correct');
    await recordVocabInteraction(db, 'vocab_contract_user', 'ambiguous', 'correct');
    const mastered = await db.select().from(schema.userVocabState)
      .where(eq(schema.userVocabState.id, 'vocab_contract_user_ambiguous')).get();
    expect(mastered?.status).toBe('mastered');

    await recordVocabInteraction(db, 'vocab_contract_user', 'ambiguous', 'clicked');
    const reopened = await db.select().from(schema.userVocabState)
      .where(eq(schema.userVocabState.id, 'vocab_contract_user_ambiguous')).get();
    expect(reopened?.status).toBe('mastered');
    expect(reopened?.clickedCount).toBe((mastered?.clickedCount || 0) + 1);
  });
});
