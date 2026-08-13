import { eq, and, lte, or, inArray, sql } from 'drizzle-orm';
import { schema } from 'curio-db';
import { calculateSM2 } from './sm2';
import { addShanghaiDays, parseStoredJson, toShanghaiDate } from '../utils';

export interface DailySchedule {
  coreWords: string[];
  contextWords: string[];
  reviewWords: string[];
  chapterId: string | null;
}

/**
 * Vocab Scheduler to decide today's words and match them with a pre-generated story.
 */
export async function getDailySchedule(
  db: any,
  userId: string,
  intensity: 'light' | 'medium' | 'deep' = 'medium',
  preferredGenres: string[] = ['mystery']
): Promise<DailySchedule> {
  // 1. Determine session word count limit based on intensity
  // Light: 3, Medium: 5, Deep: 8
  const limitMap = { light: 3, medium: 5, deep: 8 };
  const maxWords = limitMap[intensity] || 5;

  const todayStr = toShanghaiDate();

  // 2. Fetch words due for review today
  const reviewStates = await db
    .select()
    .from(schema.userVocabState)
    .where(
      and(
        eq(schema.userVocabState.userId, userId),
        lte(schema.userVocabState.nextReviewAt, todayStr)
      )
    )
    .limit(maxWords);

  const reviewWords = reviewStates.map((s: any) => s.word);

  // 3. If review words fill up the session, we just schedule reviews
  if (reviewWords.length >= maxWords) {
    // Find a chapter that contains as many of these review words as possible
    const chapterId = await findBestMatchingChapter(db, reviewWords, preferredGenres);
    return {
      coreWords: [],
      contextWords: [],
      reviewWords: reviewWords.slice(0, maxWords),
      chapterId,
    };
  }

  // 4. Otherwise, we need to introduce new words.
  // Find words the user has never seen (no userVocabState record)
  // We prioritize by level (1 -> 2 -> 3 -> 4)
  const remainingSlots = maxWords - reviewWords.length;

  const seenStates = await db
    .select({ word: schema.userVocabState.word })
    .from(schema.userVocabState)
    .where(eq(schema.userVocabState.userId, userId));
  const seenWordSet = new Set(seenStates.map((s: any) => s.word));

  // Fetch candidate new words from vocabLibrary (Level 1 first)
  let candidateNewWords: string[] = [];
  for (let lvl = 1; lvl <= 4; lvl++) {
    const candidates = await db
      .select({ word: schema.vocabLibrary.word })
      .from(schema.vocabLibrary)
      .where(eq(schema.vocabLibrary.level, lvl));
    
    const unseen = candidates
      .map((c: any) => c.word)
      .filter((w: string) => !seenWordSet.has(w));
    
    if (unseen.length > 0) {
      candidateNewWords = unseen;
      break;
    }
  }

  // We need to pick new words and match them with a pre-generated story chapter.
  // Ideally, we find a story chapter whose vocab_ids are available in our candidate pool or review pool.
  const targetNewCount = Math.min(remainingSlots, candidateNewWords.length);
  const nextNewWords = candidateNewWords.slice(0, targetNewCount);

  const combinedWords = [...reviewWords, ...nextNewWords];

  // Match the best story chapter
  const chapterId = await findBestMatchingChapter(db, combinedWords, preferredGenres);

  // Once chapter is chosen, we look at the actual vocab list inside that chapter
  let chapterVocabs: string[] = [];
  if (chapterId) {
    const chapter = await db
      .select()
      .from(schema.contentLibrary)
      .where(eq(schema.contentLibrary.id, chapterId))
      .get();
    if (chapter) {
      chapterVocabs = parseStoredJson<string[]>(chapter.vocabIds, 'content_library.vocab_ids');
    }
  }

  // Double-track classification based on the chosen chapter:
  // - Core words: 1-2 words (typically the primary target of the chapter choice)
  // - Context words: the rest
  const coreWords: string[] = [];
  const contextWords: string[] = [];

  if (chapterId) {
    const chapter = await db
      .select()
      .from(schema.contentLibrary)
      .where(eq(schema.contentLibrary.id, chapterId))
      .get();
    if (chapter) {
      // Retrieve target word for the choice
      const choiceKeyword = parseStoredJson<string[]>(chapter.vocabIds, 'content_library.vocab_ids')[0]; // Primary core word is the first element
      if (choiceKeyword) coreWords.push(choiceKeyword);
      
      chapterVocabs.forEach(w => {
        if (w !== choiceKeyword) {
          contextWords.push(w);
        }
      });
    }
  }

  return {
    coreWords,
    contextWords,
    reviewWords,
    chapterId,
  };
}

/**
 * Finds the story chapter that has the highest overlap with the target words.
 */
async function findBestMatchingChapter(
  db: any,
  targetWords: string[],
  preferredGenres: string[]
): Promise<string | null> {
  const genres = preferredGenres.length > 0 ? preferredGenres : ['mystery'];
  
  // Fetch chapters in preferred genres
  const chapters = await db
    .select()
    .from(schema.contentLibrary)
    .where(inArray(schema.contentLibrary.genre, genres));

  if (chapters.length === 0) {
    // Fallback: fetch any chapters
    const fallback = await db.select().from(schema.contentLibrary).limit(5);
    return fallback[0]?.id || null;
  }

  let bestChapterId: string | null = null;
  let maxOverlap = -1;

  for (const ch of chapters) {
    const chVocabs = parseStoredJson<string[]>(ch.vocabIds, 'content_library.vocab_ids');
    const overlap = chVocabs.filter(w => targetWords.includes(w)).length;
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestChapterId = ch.id;
    }
  }

  return bestChapterId || chapters[0].id;
}

/**
 * Updates vocabulary state in DB based on study actions (Correct/Incorrect/Clicked).
 */
export async function recordVocabInteraction(
  db: any,
  userId: string,
  word: string,
  action: 'correct' | 'incorrect' | 'clicked'
) {
  const stateId = `${userId}_${word}`;
  
  // Find current state
  let state = await db
    .select()
    .from(schema.userVocabState)
    .where(eq(schema.userVocabState.id, stateId))
    .get();

  if (!state) {
    // Opening a word creates its context state, but is not an answer and does
    // not alter SM-2. A first answer only promotes it to core_word_tested.
    const isAnswer = action !== 'clicked';
    const initStatus = isAnswer ? 'core_word_tested' : 'context_word';
    const quality = action === 'correct' ? 5 : 2;
    const sm2 = isAnswer ? calculateSM2(quality, 0, 2.5) : null;

    await db.insert(schema.userVocabState).values({
      id: stateId,
      userId,
      word,
      status: initStatus,
      seenCount: isAnswer ? 1 : 0,
      clickedCount: action === 'clicked' ? 1 : 0,
      correctCount: action === 'correct' ? 1 : 0,
      incorrectCount: action === 'incorrect' ? 1 : 0,
      interval: sm2?.interval || 0,
      easeFactor: sm2?.easeFactor || 2.5,
      nextReviewAt: sm2 ? addShanghaiDays(sm2.interval) : null,
      lastReviewedAt: isAnswer ? new Date().toISOString() : null,
    });
  } else {
    // Update existing state
    let nextStatus = state.status;
    let correctInc = 0;
    let incorrectInc = 0;
    let clickedInc = 0;

    if (action === 'correct') {
      // One correct answer is never enough to skip to mastered. A second
      // verified answer is the current MVP threshold; mastered never regresses.
      nextStatus = state.status === 'mastered'
        ? 'mastered'
        : state.status === 'core_word_tested' && state.correctCount + 1 >= 2
          ? 'mastered'
          : 'core_word_tested';
      correctInc = 1;
    } else if (action === 'incorrect') {
      nextStatus = state.status === 'mastered' ? 'mastered' : 'core_word_tested';
      incorrectInc = 1;
    } else if (action === 'clicked') {
      clickedInc = 1;
    }

    // `clicked` is purely observational. In particular it must not change
    // state, interval, review date, or answer counters of a mastered word.
    const isAnswer = action !== 'clicked';
    const sm2 = isAnswer
      ? calculateSM2(action === 'correct' ? 5 : 2, state.interval, state.easeFactor)
      : null;

    await db
      .update(schema.userVocabState)
      .set({
        status: nextStatus,
        seenCount: state.seenCount + (isAnswer ? 1 : 0),
        clickedCount: state.clickedCount + clickedInc,
        correctCount: state.correctCount + correctInc,
        incorrectCount: state.incorrectCount + incorrectInc,
        interval: sm2?.interval ?? state.interval,
        easeFactor: sm2?.easeFactor ?? state.easeFactor,
        nextReviewAt: sm2 ? addShanghaiDays(sm2.interval) : state.nextReviewAt,
        lastReviewedAt: isAnswer ? new Date().toISOString() : state.lastReviewedAt,
      })
      .where(eq(schema.userVocabState.id, stateId));
  }
}
