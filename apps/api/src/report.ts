import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { createDb, schema } from 'curio-db';
import { join } from 'path';
import { eq, and } from 'drizzle-orm';
import { verifySession } from './auth';
import { toShanghaiDate } from './utils';

const reportRoutes = new Hono();

function getDb() {
  const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/curio.db');
  return createDb(dbPath);
}

async function getVerifiedUserId(c: any): Promise<string | null> {
  const cookieValue = getCookie(c, 'curio_session');
  if (!cookieValue) return null;
  return await verifySession(cookieValue);
}

reportRoutes.get('/api/report/learning', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  // 1. validLearningDays, completedChapters
  const completions = await db.select().from(schema.chapterCompletions).where(eq(schema.chapterCompletions.userId, userId));
  
  const uniqueChapters = new Set<string>();
  const uniqueDays = new Set<string>();
  
  for (const comp of completions) {
    uniqueChapters.add(comp.chapterVersionId);
    uniqueDays.add(toShanghaiDate(comp.completedAt));
  }
  
  const completedChapters = uniqueChapters.size;
  const validLearningDays = uniqueDays.size;

  // 2. lookedUpUniqueWords
  const events = await db.select().from(schema.learningEvents)
    .where(and(eq(schema.learningEvents.userId, userId), eq(schema.learningEvents.eventType, 'word_opened')));
  
  const uniqueWords = new Set<string>();
  for (const e of events) {
    try {
      const payload = JSON.parse(e.payload);
      if (payload.word) {
        uniqueWords.add(payload.word);
      }
    } catch (err) {}
  }
  const lookedUpUniqueWords = uniqueWords.size;

  // 3. coreFirstAttempt & discriminationFirstAttempt
  const sessions = await db.select().from(schema.learningSessions).where(eq(schema.learningSessions.userId, userId));
  
  let coreNum = 0;
  let coreDen = 0;
  
  let discNum = 0;
  let discDen = 0;

  for (const s of sessions) {
    if (s.firstChoiceCorrect !== null) {
      coreDen++;
      if (s.firstChoiceCorrect === 1) coreNum++;
    }
    if (s.discriminationFirstCorrect !== null) {
      discDen++;
      if (s.discriminationFirstCorrect === 1) discNum++;
    }
  }

  const coreFirstAttempt = {
    numerator: coreNum,
    denominator: coreDen,
    ratePct: coreDen > 0 ? Math.round((coreNum / coreDen) * 100) : null
  };

  const discriminationFirstAttempt = {
    numerator: discNum,
    denominator: discDen,
    ratePct: discDen > 0 ? Math.round((discNum / discDen) * 100) : null
  };

  return c.json({
    generatedAt: new Date().toISOString(),
    validLearningDays,
    completedChapters,
    lookedUpUniqueWords,
    coreFirstAttempt,
    discriminationFirstAttempt,
    transferAssessment: null,
    baselineChange: null
  });
});

reportRoutes.post('/api/report/poster-exported', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  const now = new Date().toISOString();
  await db.insert(schema.learningEvents).values({
    id: `event_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    sessionId: 'none',
    eventType: 'poster_exported',
    payload: JSON.stringify({}),
    occurredAt: now,
    receivedAt: now
  });

  return c.json({ success: true });
});

export { reportRoutes };
