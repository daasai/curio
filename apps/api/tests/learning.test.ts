import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { createTestDb } from './test-utils';
import { createDb, schema } from 'curio-db';
import { eq } from 'drizzle-orm';

function getShanghaiDateOffset(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

describe('Learning Module API', () => {
  let testDbInfo: { dbPath: string, cleanup: () => void };
  let cookie: string;
  let testUserId = 'test_user_1';
  let db: ReturnType<typeof createDb>;
  let app: any;
  let signSession: any;

  beforeAll(async () => {
    testDbInfo = createTestDb();
    process.env.DB_PATH = testDbInfo.dbPath;
    
    // Create required tables missing from test-utils but added via schema changes
    const sqlite = new (await import('bun:sqlite')).Database(testDbInfo.dbPath);
    sqlite.exec(`
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
    `);
    
    // Add missing columns to content_library for tests
    const tableInfo = sqlite.query(`PRAGMA table_info(content_library)`).all() as any[];
    const columnNames = tableInfo.map(col => col.name);
    
    const alterTable = (colName: string, def: string) => {
      if (!columnNames.includes(colName)) {
        sqlite.exec(`ALTER TABLE content_library ADD COLUMN ${colName} ${def}`);
      }
    };
    
    alterTable('storyline_id', "TEXT DEFAULT 'canglan_mist'");
    alterTable('version', "INTEGER DEFAULT 1");
    alterTable('core_words', "TEXT DEFAULT '[]'");
    alterTable('new_context_words', "TEXT DEFAULT '[]'");
    alterTable('review_words', "TEXT DEFAULT '[]'");
    alterTable('generation_metadata', "TEXT");
    alterTable('quality_report', "TEXT");
    alterTable('published_at', "TEXT");

    sqlite.close();

    // Dynamically import after setting DB_PATH
    app = (await import('../src/index')).default;
    signSession = (await import('../src/auth')).signSession;

    db = createDb(testDbInfo.dbPath);

    // Seed test data
    await db.insert(schema.users).values({
      id: testUserId,
      email: 'test@curio.app',
      createdAt: new Date().toISOString(),
      streak: 5,
      lastActiveDate: getShanghaiDateOffset(-1),
      status: 'active'
    });

    await db.insert(schema.vocabLibrary).values({
      word: 'ambiguous',
      phonetic: '/æmˈbɪɡjuəs/',
      pos: 'adj.',
      meaningCn: '模糊的；有歧义的',
      level: 1,
      gaokaoFrequency: 'high',
    });

    await db.insert(schema.users).values({
      id: 'test_user_2',
      email: 'test2@curio.app',
      createdAt: new Date().toISOString(),
      streak: 0,
      status: 'active'
    });

    try {
      await db.insert(schema.contentLibrary).values({
        id: 'chapter_1_v1',
        vocabIds: '[]',
        genre: 'mystery',
        chapterIndex: 1,
        title: 'Chapter 1',
        storyText: 'Text 1',
        vocabHighlights: '[]',
        choicePrompt: 'Choice 1?',
        choices: '[]',
        branchStories: '{}',
        chapterSummary: 'Summary 1',
        createdAt: new Date().toISOString(),
        status: 'published',
        version: 1,
        illustration: JSON.stringify({
          assetPath: '/assets/chapter-test.png',
          alt: 'Chapter test illustration',
          placement: 'before_story',
          panelCount: 4,
          assetVersion: 'v1',
        }),
      });
      console.log('Inserted chapter 1 successfully');
    } catch (e) {
      console.error('Failed to insert chapter 1:', e);
    }

    const check = await db.select().from(schema.contentLibrary).get();
    console.log('contentLibrary check:', check);

    const sessionCookie = await signSession(testUserId);
    cookie = `curio_session=${sessionCookie}`;
  });

  afterAll(() => {
    testDbInfo.cleanup();
  });

  it('1. Returns 401 for unauthenticated request to /api/learning/snapshot', async () => {
    const res = await app.fetch(new Request('http://localhost/api/learning/snapshot'));
    expect(res.status).toBe(401);
  });

  let sessionId: string;
  let initialRevision: number;

  it('2. Start session creates and returns snapshot, and is idempotent', async () => {
    const res1 = await app.fetch(new Request('http://localhost/api/learning/session/start', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    }));
    
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.progress.activeSessionId).toBeDefined();
    expect(data1.progress.nextChapterIndex).toBe(1);
    expect(data1.chapter.illustration).toMatchObject({
      assetPath: '/assets/chapter-test.png',
      panelCount: 4,
    });
    
    sessionId = data1.progress.activeSessionId;
    initialRevision = data1.progress.revision;

    // Idempotent start
    const res2 = await app.fetch(new Request('http://localhost/api/learning/session/start', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    }));
    const data2 = await res2.json();
    expect(data2.progress.activeSessionId).toBe(sessionId);
  });

  it('3. Submit word_opened event is idempotent', async () => {
    const eventId = 'evt_123';
    
    const sendEvent = () => app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, eventType: 'word_opened', payload: { word: 'ambiguous' } })
    }));

    const res1 = await sendEvent();
    expect(res1.status).toBe(200);
    
    const res2 = await sendEvent();
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.idempotent).toBe(true);
  });

  it('4. Calling complete without submitting choice returns 422', async () => {
    const res = await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: 'cmd_1', clientRevision: initialRevision })
    }));
    
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('PRECONDITION_FAILED');
  });

  it('5. Calling complete with incorrect choice but no branch_completed returns 422', async () => {
    // Submit wrong choice
    await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_choice', eventType: 'critical_choice_submitted', payload: { optionId: 'A', isCorrect: false } })
    }));

    const res = await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: 'cmd_2', clientRevision: initialRevision })
    }));
    
    expect(res.status).toBe(422);
  });

  it('6. Full flow completes chapter, increments index, and updates streak', async () => {
    // Complete branch
    await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_branch', eventType: 'branch_completed' })
    }));

    // Submit discrimination
    await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_disc', eventType: 'discrimination_submitted', payload: { isCorrect: true } })
    }));

    // Complete session
    const res = await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: 'cmd_complete', clientRevision: initialRevision })
    }));
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress.nextChapterIndex).toBe(2);
    expect(data.progress.activeSessionId).toBeNull();
    // Assuming mock date is 'today', previous was 'yesterday', streak should be 6
    expect(data.progress.streakDays).toBe(6);
  });

  it('7. Retrying complete is idempotent', async () => {
    // Retrying with same command/revision should return current snapshot with idempotent: true
    const res = await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: 'cmd_complete', clientRevision: initialRevision })
    }));
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.idempotent).toBe(true);
    expect(data.progress.nextChapterIndex).toBe(2);
  });

  it('9. User B cannot access User A session (403)', async () => {
    const sessionCookie2 = await signSession('test_user_2');
    const cookie2 = `curio_session=${sessionCookie2}`;

    const res = await app.fetch(new Request(`http://localhost/api/learning/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Cookie': cookie2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_other', eventType: 'word_opened' })
    }));
    
    expect(res.status).toBe(403);
  });
});
