import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDb, schema } from 'curio-db';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-utils';

describe('v0.5.0 onboarding and content safety', () => {
  let testDb: { dbPath: string; cleanup: () => void };
  let db: ReturnType<typeof createDb>;
  let app: any;
  let cookie: string;

  beforeAll(async () => {
    testDb = createTestDb();
    process.env.DB_PATH = testDb.dbPath;
    db = createDb(testDb.dbPath);
    await db.insert(schema.users).values({
      id: 'onboarding_user', phone: '13800001002', status: 'active', createdAt: new Date().toISOString(), streak: 0,
    });
    app = (await import('../src/index')).default;
    const { signSession } = await import('../src/auth');
    cookie = `curio_session=${await signSession('onboarding_user')}`;
  });

  afterAll(() => testDb.cleanup());

  it('persists onboarding exactly once and exposes it through snapshot', async () => {
    const submit = (commandId: string) => app.fetch(new Request('http://localhost/api/learning/onboarding', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId,
        preferences: { genres: ['mystery'], intensity: 'medium' },
        diagnostic: { itemSetVersion: 'baseline-v1', correctCount: 3, itemCount: 4, derivedLevel: 'intermediate' },
      }),
    }));
    expect((await submit('baseline-command-1')).status).toBe(200);
    expect((await submit('baseline-command-1')).status).toBe(200);
    expect((await submit('baseline-command-2')).status).toBe(409);
    const snapshot = await app.fetch(new Request('http://localhost/api/learning/snapshot', { headers: { Cookie: cookie } }));
    expect(snapshot.status).toBe(200);
    expect((await snapshot.json()).user).toMatchObject({ diagnosticLevel: 'intermediate', preferences: { genres: ['mystery'], intensity: 'medium' } });
  });

  it('returns CONTENT_CORRUPT instead of 500 for malformed persisted chapter JSON', async () => {
    await db.insert(schema.contentLibrary).values({
      id: 'corrupt_chapter', vocabIds: '[]', genre: 'mystery', chapterIndex: 1, title: 'Corrupt', storyText: 'text',
      vocabHighlights: '[]', choicePrompt: 'question', choices: '{', branchStories: '{}', chapterSummary: 'summary',
      createdAt: new Date().toISOString(), status: 'published', version: 2,
    });
    const result = await app.fetch(new Request('http://localhost/api/learning/snapshot', { headers: { Cookie: cookie } }));
    expect(result.status).toBe(422);
    expect((await result.json()).error.code).toBe('CONTENT_CORRUPT');
    await db.delete(schema.contentLibrary).where(eq(schema.contentLibrary.id, 'corrupt_chapter'));
  });
});
