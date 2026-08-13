import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { createDb, schema } from 'curio-db';
import { join } from 'path';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { verifySession } from './auth';
import { recordVocabInteraction } from './scheduler';
import { parseStoredJson, toShanghaiDate } from './utils';

const learningRoutes = new Hono();

function getDb() {
  const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/curio.db');
  return createDb(dbPath);
}

async function getVerifiedUserId(c: any): Promise<string | null> {
  const cookieValue = getCookie(c, 'curio_session');
  if (!cookieValue) return null;
  return await verifySession(cookieValue);
}

function parseWordFamilyForms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value.split(',').map((form) => form.trim()).filter(Boolean);
}

async function enrichWordFamily(record: any, db: any) {
  const forms = parseWordFamilyForms(record.wordFamily);
  if (forms.length === 0) return { ...record, wordFamily: [] };

  const relatedRows = await db.select({
    word: schema.vocabLibrary.word,
    pos: schema.vocabLibrary.pos,
    meaningCn: schema.vocabLibrary.meaningCn,
  }).from(schema.vocabLibrary).where(inArray(schema.vocabLibrary.word, forms));
  const relatedByWord = new Map(relatedRows.map((row: any) => [row.word, row]));

  return {
    ...record,
    wordFamily: forms.map((form) => {
      const related = relatedByWord.get(form);
      return {
        form,
        pos: related?.pos || '',
        meaning: related?.meaningCn || '',
      };
    }),
  };
}

async function getSnapshotData(userId: string, db: any = getDb()) {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user) return null;

  let progress = await db.select().from(schema.storyProgress).where(and(eq(schema.storyProgress.userId, userId), eq(schema.storyProgress.storylineId, 'canglan_mist'))).get();
  
  if (!progress) {
    const now = new Date().toISOString();
    await db.insert(schema.storyProgress).values({
      id: `${userId}_canglan_mist`,
      userId,
      storylineId: 'canglan_mist',
      currentChapterIndex: 1,
      firstStartedAt: now,
      revision: 0
    });
    progress = await db.select().from(schema.storyProgress).where(and(eq(schema.storyProgress.userId, userId), eq(schema.storyProgress.storylineId, 'canglan_mist'))).get();
  }

  const streakDays = user.streak || 0;
  
  let chapterRecord = await db.select().from(schema.contentLibrary)
    .where(and(eq(schema.contentLibrary.chapterIndex, progress!.currentChapterIndex), eq(schema.contentLibrary.status, 'published')))
    .orderBy(desc(schema.contentLibrary.version))
    .get();

  if (!chapterRecord) {
    chapterRecord = await db.select().from(schema.contentLibrary)
      .where(and(eq(schema.contentLibrary.chapterIndex, progress!.currentChapterIndex), eq(schema.contentLibrary.status, 'qa_passed')))
      .orderBy(desc(schema.contentLibrary.version))
      .get();
  }

  let chapter = null;
  if (chapterRecord) {
    chapter = {
      id: chapterRecord.id,
      chapterIndex: chapterRecord.chapterIndex,
      coreWords: parseStoredJson<string[]>(chapterRecord.coreWords, 'content_library.core_words', []),
      title: chapterRecord.title,
      chapterSummary: chapterRecord.chapterSummary,
      storyText: chapterRecord.storyText,
      vocabHighlights: parseStoredJson<unknown[]>(chapterRecord.vocabHighlights, 'content_library.vocab_highlights', []),
      choicePrompt: chapterRecord.choicePrompt,
      choices: parseStoredJson<unknown[]>(chapterRecord.choices, 'content_library.choices'),
      branchStories: parseStoredJson<Record<string, string>>(chapterRecord.branchStories, 'content_library.branch_stories'),
      illustration: chapterRecord.illustration
        ? parseStoredJson<Record<string, unknown>>(chapterRecord.illustration, 'content_library.illustration')
        : null,
    };
  }

  return {
    user: {
      diagnosticLevel: user.diagnosticLevel,
      mustChangePassword: Boolean(user.mustChangePassword),
      preferences: {
        genres: user.storyGenrePreferences ? user.storyGenrePreferences.split(',') : [],
        intensity: user.intensity
      }
    },
    progress: {
      storylineId: progress!.storylineId,
      nextChapterIndex: progress!.currentChapterIndex,
      completedChapterCount: progress!.currentChapterIndex - 1,
      activeSessionId: progress!.activeSessionId,
      streakDays,
      revision: progress!.revision
    },
    chapter
  };
}

learningRoutes.get('/api/learning/vocabulary', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  const list = await db.select({
    word: schema.vocabLibrary.word,
    phonetic: schema.vocabLibrary.phonetic,
    pos: schema.vocabLibrary.pos,
    meaningCn: schema.vocabLibrary.meaningCn,
    status: schema.userVocabState.status,
    seenCount: schema.userVocabState.seenCount,
    clickedCount: schema.userVocabState.clickedCount,
  }).from(schema.userVocabState)
    .innerJoin(schema.vocabLibrary, eq(schema.userVocabState.word, schema.vocabLibrary.word))
    .where(eq(schema.userVocabState.userId, userId));
  return c.json({ list: await Promise.all(list.map((item) => enrichWordFamily(item, db))) });
});

learningRoutes.get('/api/learning/vocabulary/:word', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);
  const word = c.req.param('word').trim().toLowerCase();
  const item = await db.select().from(schema.vocabLibrary).where(eq(schema.vocabLibrary.word, word)).get();
  if (!item) return c.json({ error: { code: 'VOCAB_NOT_FOUND' } }, 404);
  return c.json({ item: await enrichWordFamily(item, db) });
});

learningRoutes.get('/api/learning/snapshot', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  const snapshot = await getSnapshotData(userId, db);
  if (!snapshot) return c.json({ error: { code: 'USER_NOT_FOUND' } }, 404);

  return c.json(snapshot);
});

learningRoutes.post('/api/learning/onboarding', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_REQUEST' } }, 400);
  }
  const { commandId, preferences, diagnostic } = body || {};
  const genres = preferences?.genres;
  const intensity = preferences?.intensity;
  const correctCount = diagnostic?.correctCount;
  const itemCount = diagnostic?.itemCount;
  const derivedLevel = diagnostic?.derivedLevel;
  const itemSetVersion = diagnostic?.itemSetVersion;
  if (typeof commandId !== 'string' || !commandId || !Array.isArray(genres) || !genres.every((genre: unknown) => typeof genre === 'string')
    || !['light', 'medium', 'deep'].includes(intensity) || !Number.isInteger(correctCount) || !Number.isInteger(itemCount)
    || correctCount < 0 || itemCount < 1 || correctCount > itemCount || typeof derivedLevel !== 'string' || !derivedLevel
    || typeof itemSetVersion !== 'string' || !itemSetVersion) {
    return c.json({ error: { code: 'INVALID_REQUEST' } }, 400);
  }

  const priorCommand = await db.select().from(schema.assessmentAttempts)
    .where(eq(schema.assessmentAttempts.commandId, commandId)).get();
  if (priorCommand) {
    if (priorCommand.userId !== userId) return c.json({ error: { code: 'FORBIDDEN' } }, 403);
    return c.json({ success: true, idempotent: true });
  }
  const baseline = await db.select().from(schema.assessmentAttempts)
    .where(and(eq(schema.assessmentAttempts.userId, userId), eq(schema.assessmentAttempts.assessmentKind, 'baseline'))).get();
  if (baseline) return c.json({ error: { code: 'BASELINE_ALREADY_SET', retryable: false } }, 409);

  const now = new Date().toISOString();
  await db.update(schema.users).set({
    diagnosticLevel: derivedLevel,
    storyGenrePreferences: genres.join(','),
    intensity,
    updatedAt: now,
  }).where(eq(schema.users.id, userId));
  await db.insert(schema.assessmentAttempts).values({
    id: `baseline_${userId}_${Date.now()}`,
    userId,
    assessmentKind: 'baseline',
    commandId,
    itemSetVersion,
    correctCount,
    itemCount,
    derivedLevel,
    createdAt: now,
  });
  return c.json({ success: true });
});

learningRoutes.post('/api/learning/session/start', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  let progress = await db.select().from(schema.storyProgress).where(and(eq(schema.storyProgress.userId, userId), eq(schema.storyProgress.storylineId, 'canglan_mist'))).get();
  
  if (!progress) {
    const now = new Date().toISOString();
    await db.insert(schema.storyProgress).values({
      id: `${userId}_canglan_mist`,
      userId,
      storylineId: 'canglan_mist',
      currentChapterIndex: 1,
      firstStartedAt: now,
      revision: 0
    });
    progress = await db.select().from(schema.storyProgress).where(and(eq(schema.storyProgress.userId, userId), eq(schema.storyProgress.storylineId, 'canglan_mist'))).get();
  }
  
  if (progress?.activeSessionId) {
    // Return existing snapshot
    const snapshot = await getSnapshotData(userId, db);
    return c.json(snapshot, 200);
  }

  if (progress && progress.currentChapterIndex > 10) {
    return c.json({ error: { code: 'STORY_COMPLETED' } }, 409);
  }

  let chapterRecord = await db.select().from(schema.contentLibrary)
    .where(and(eq(schema.contentLibrary.chapterIndex, progress!.currentChapterIndex), eq(schema.contentLibrary.status, 'published')))
    .orderBy(desc(schema.contentLibrary.version))
    .get();

  if (!chapterRecord) {
    chapterRecord = await db.select().from(schema.contentLibrary)
      .where(and(eq(schema.contentLibrary.chapterIndex, progress!.currentChapterIndex), eq(schema.contentLibrary.status, 'qa_passed')))
      .orderBy(desc(schema.contentLibrary.version))
      .get();
  }
  
  if (!chapterRecord) {
    return c.json({ error: { code: 'CHAPTER_NOT_FOUND' } }, 404);
  }

  const sessionId = `session_${userId}_${Date.now()}`;
  const now = new Date().toISOString();

  await db.insert(schema.learningSessions).values({
    id: sessionId,
    userId,
    chapterVersionId: chapterRecord.id,
    storylineId: 'canglan_mist',
    status: 'active',
    startedAt: now,
  });

  await db.update(schema.storyProgress)
    .set({ activeSessionId: sessionId })
    .where(eq(schema.storyProgress.id, progress!.id));

  // Return new snapshot
  const snapshot = await getSnapshotData(userId, db);
  return c.json(snapshot, 200);
});

learningRoutes.post('/api/learning/session/:sessionId/event', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  const sessionId = c.req.param('sessionId');
  const session = await db.select().from(schema.learningSessions).where(eq(schema.learningSessions.id, sessionId)).get();

  if (!session || session.userId !== userId) {
    return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_REQUEST' } }, 400);
  }
  const { eventId, eventType, payload, occurredAt } = body || {};

  const validEventTypes = ['chapter_started', 'word_opened', 'critical_choice_submitted', 'branch_completed', 'discrimination_submitted', 'chapter_completed', 'poster_exported'];
  if (typeof eventId !== 'string' || !eventId || !validEventTypes.includes(eventType)) {
    return c.json({ error: { code: 'INVALID_EVENT_TYPE' } }, 400);
  }

  const existingEvent = await db.select().from(schema.learningEvents).where(eq(schema.learningEvents.id, eventId)).get();
  if (existingEvent) {
    return c.json({ success: true, idempotent: true });
  }

  if (eventType === 'word_opened') {
    const word = typeof payload?.word === 'string' ? payload.word.trim().toLowerCase() : '';
    const vocabulary = word
      ? await db.select().from(schema.vocabLibrary).where(eq(schema.vocabLibrary.word, word)).get()
      : null;
    if (!vocabulary) {
      return c.json({ error: { code: 'INVALID_WORD' } }, 422);
    }
  }

  const now = new Date().toISOString();
  await db.insert(schema.learningEvents).values({
    id: eventId,
    userId,
    sessionId,
    eventType,
    payload: JSON.stringify(payload || {}),
    occurredAt: typeof occurredAt === 'string' ? occurredAt : now,
    receivedAt: now
  });

  if (eventType === 'word_opened') {
    const word = payload.word.trim().toLowerCase();
    await recordVocabInteraction(db, userId, word, 'clicked');
  } else if (eventType === 'critical_choice_submitted' && session.firstChoiceOptionId === null) {
    await db.update(schema.learningSessions).set({
      firstChoiceOptionId: payload.optionId,
      firstChoiceCorrect: payload.isCorrect ? 1 : 0
    }).where(eq(schema.learningSessions.id, sessionId));
  } else if (eventType === 'branch_completed') {
    await db.update(schema.learningSessions).set({
      branchCompletedAt: now
    }).where(eq(schema.learningSessions.id, sessionId));
  } else if (eventType === 'discrimination_submitted') {
    const updateData: any = { discriminationFinalCorrect: payload.isCorrect ? 1 : 0 };
    if (session.discriminationFirstCorrect === null) {
      updateData.discriminationFirstCorrect = payload.isCorrect ? 1 : 0;
    }
    await db.update(schema.learningSessions).set(updateData).where(eq(schema.learningSessions.id, sessionId));
  }

  return c.json({ success: true });
});

learningRoutes.post('/api/learning/session/:sessionId/complete', async (c) => {
  const db = getDb();
  const userId = await getVerifiedUserId(c);
  if (!userId) return c.json({ error: { code: 'UNAUTHENTICATED' } }, 401);

  const sessionId = c.req.param('sessionId');
  const session = await db.select().from(schema.learningSessions).where(eq(schema.learningSessions.id, sessionId)).get();

  if (!session || session.userId !== userId) {
    return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  }

  let completionBody: any;
  try {
    completionBody = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_REQUEST' } }, 400);
  }
  const { commandId, clientRevision } = completionBody || {};
  if (typeof commandId !== 'string' || !commandId || !Number.isInteger(clientRevision)) {
    return c.json({ error: { code: 'INVALID_REQUEST' } }, 400);
  }
  const now = new Date().toISOString();

  // Check Idempotency
  const existingCompletion = await db.select().from(schema.chapterCompletions)
    .where(and(eq(schema.chapterCompletions.userId, userId), eq(schema.chapterCompletions.chapterVersionId, session.chapterVersionId))).get();
  
  if (existingCompletion) {
    const snapshot = await getSnapshotData(userId, db);
    return c.json({ ...snapshot, idempotent: true });
  }

  // Preconditions
  // Update session object to get latest in case it was modified recently (e.g. by concurrent event)
  const currentSession = await db.select().from(schema.learningSessions).where(eq(schema.learningSessions.id, sessionId)).get();
  
  if (currentSession!.firstChoiceOptionId === null || 
      (currentSession!.firstChoiceCorrect === 0 && currentSession!.branchCompletedAt === null) ||
      currentSession!.discriminationFirstCorrect === null) {
    return c.json({ error: { code: 'PRECONDITION_FAILED' } }, 422);
  }

  const progress = await db.select().from(schema.storyProgress).where(and(eq(schema.storyProgress.userId, userId), eq(schema.storyProgress.storylineId, 'canglan_mist'))).get();

  if (progress!.revision !== clientRevision) {
    return c.json({ error: { code: 'REVISION_CONFLICT', retryable: true } }, 409);
  }

  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  
  const todayStr = toShanghaiDate();
  let nextStreak = user!.streak;
  if (user!.lastActiveDate !== todayStr) {
    if (user!.lastActiveDate) {
      const lastDate = new Date(user!.lastActiveDate);
      const today = new Date(todayStr);
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        nextStreak += 1;
      } else {
        nextStreak = 1;
      }
    } else {
      nextStreak = 1;
    }
  }

  await db.update(schema.users).set({
    streak: nextStreak,
    lastActiveDate: todayStr
  }).where(eq(schema.users.id, userId));

  await db.insert(schema.chapterCompletions).values({
    id: `${userId}_${session.chapterVersionId}`,
    userId,
    chapterVersionId: session.chapterVersionId,
    completedAt: now
  }).onConflictDoNothing();

  await db.update(schema.storyProgress).set({
    currentChapterIndex: progress!.currentChapterIndex + 1,
    activeSessionId: null,
    lastCompletedAt: now,
    revision: progress!.revision + 1
  }).where(eq(schema.storyProgress.id, progress!.id));

  await db.update(schema.learningSessions).set({
    status: 'completed',
    completedAt: now
  }).where(eq(schema.learningSessions.id, sessionId));

  // Return new snapshot
  const snapshot = await getSnapshotData(userId, db);
  return c.json(snapshot, 200);
});

export { learningRoutes };
