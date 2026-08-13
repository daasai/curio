import { expect, it, describe, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { schema } from 'curio-db';
import { createTestDb } from './test-utils';

describe('Report Module', () => {
  let app: any;
  let db: any;
  let sqlite: Database;
  let signSession: (userId: string) => Promise<string>;
  let testDbInfo: any;
  let cookie: string;
  const testUserId = 'test_user_report';

  beforeAll(async () => {
    testDbInfo = createTestDb();
    
    // Setup tables if needed
    sqlite = new (await import('bun:sqlite')).Database(testDbInfo.dbPath);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS chapter_completions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_version_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE(user_id, chapter_version_id)
      );
      CREATE TABLE IF NOT EXISTS learning_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS learning_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        chapter_version_id TEXT NOT NULL,
        storyline_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        branch_completed_at TEXT,
        first_choice_option_id TEXT,
        first_choice_correct INTEGER,
        discrimination_first_correct INTEGER,
        discrimination_final_correct INTEGER
      );
    `);

    sqlite.close();

    // Dynamically import after setting DB_PATH
    app = (await import('../src/index')).default;
    signSession = (await import('../src/auth')).signSession;

    const { createDb } = await import('curio-db');
    db = createDb(testDbInfo.dbPath);

    await db.insert(schema.users).values({
      id: testUserId,
      email: 'test_report@curio.app',
      createdAt: new Date().toISOString(),
      streak: 5,
      lastActiveDate: '2026-07-29',
      status: 'active'
    });

    const sessionCookie = await signSession(testUserId);
    cookie = `curio_session=${sessionCookie}`;
  });

  afterAll(() => {
    testDbInfo.cleanup();
  });

  it('Case 11: ratePct is null when no question data', async () => {
    const res = await app.fetch(new Request('http://localhost/api/report/learning', {
      headers: { 'Cookie': cookie }
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.coreFirstAttempt.ratePct).toBeNull();
    expect(data.discriminationFirstAttempt.ratePct).toBeNull();
    expect(data.coreFirstAttempt.denominator).toBe(0);
    expect(data.discriminationFirstAttempt.denominator).toBe(0);
  });

  it('Case 12: word_opened increases lookedUpUniqueWords but not coreFirstAttempt', async () => {
    const now = new Date().toISOString();
    await db.insert(schema.learningEvents).values({
      id: 'event_1',
      userId: testUserId,
      sessionId: 'sess_1',
      eventType: 'word_opened',
      payload: JSON.stringify({ word: 'ambiguous' }),
      occurredAt: now,
      receivedAt: now
    });
    
    await db.insert(schema.learningEvents).values({
      id: 'event_2',
      userId: testUserId,
      sessionId: 'sess_1',
      eventType: 'word_opened',
      payload: JSON.stringify({ word: 'vague' }),
      occurredAt: now,
      receivedAt: now
    });

    const res = await app.fetch(new Request('http://localhost/api/report/learning', {
      headers: { 'Cookie': cookie }
    }));
    const data = await res.json();
    
    expect(data.lookedUpUniqueWords).toBe(2);
    expect(data.coreFirstAttempt.denominator).toBe(0);
  });

  it('Case 14: Report data strictly matches deduplicated calculation', async () => {
    // Add some completions with same date and different date
    await db.insert(schema.chapterCompletions).values({
      id: 'comp_1',
      userId: testUserId,
      chapterVersionId: 'chap_1',
      completedAt: '2026-07-28T10:00:00.000Z'
    });
    
    // Duplicate chapter (should fail because of UNIQUE, but we can simulate multiple chapters same day)
    await db.insert(schema.chapterCompletions).values({
      id: 'comp_2',
      userId: testUserId,
      chapterVersionId: 'chap_2',
      completedAt: '2026-07-28T15:00:00.000Z'
    });

    // Different day
    await db.insert(schema.chapterCompletions).values({
      id: 'comp_3',
      userId: testUserId,
      chapterVersionId: 'chap_3',
      completedAt: '2026-07-30T10:00:00.000Z'
    });

    // Add sessions
    await db.insert(schema.learningSessions).values({
      id: 'sess_1',
      userId: testUserId,
      chapterVersionId: 'chap_1',
      storylineId: 'story_1',
      status: 'completed',
      startedAt: '2026-07-28T10:00:00.000Z',
      firstChoiceCorrect: 1,
      discriminationFirstCorrect: 1
    });

    await db.insert(schema.learningSessions).values({
      id: 'sess_2',
      userId: testUserId,
      chapterVersionId: 'chap_2',
      storylineId: 'story_1',
      status: 'completed',
      startedAt: '2026-07-28T15:00:00.000Z',
      firstChoiceCorrect: 0,
      discriminationFirstCorrect: 1
    });

    // Duplicate word lookup
    const now = new Date().toISOString();
    await db.insert(schema.learningEvents).values({
      id: 'event_3',
      userId: testUserId,
      sessionId: 'sess_1',
      eventType: 'word_opened',
      payload: JSON.stringify({ word: 'ambiguous' }),
      occurredAt: now,
      receivedAt: now
    });

    const res = await app.fetch(new Request('http://localhost/api/report/learning', {
      headers: { 'Cookie': cookie }
    }));
    const data = await res.json();
    
    expect(data.completedChapters).toBe(3);
    expect(data.validLearningDays).toBe(2);
    // ambiguous and vague were added before, now ambiguous again. Total 2.
    expect(data.lookedUpUniqueWords).toBe(2);
    
    // coreNum = 1, coreDen = 2 => 50%
    expect(data.coreFirstAttempt.numerator).toBe(1);
    expect(data.coreFirstAttempt.denominator).toBe(2);
    expect(data.coreFirstAttempt.ratePct).toBe(50);
    
    // discNum = 2, discDen = 2 => 100%
    expect(data.discriminationFirstAttempt.numerator).toBe(2);
    expect(data.discriminationFirstAttempt.denominator).toBe(2);
    expect(data.discriminationFirstAttempt.ratePct).toBe(100);
  });
});
