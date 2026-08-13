import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. 用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  mustChangePassword: integer('must_change_password').default(0).notNull(),
  passwordUpdatedAt: text('password_updated_at'),
  inviteCode: text('invite_code'),
  status: text('status').default('active'),
  timezone: text('timezone').default('Asia/Shanghai'),
  updatedAt: text('updated_at'),
  createdAt: text('created_at').notNull(),
  diagnosticLevel: text('diagnostic_level'), // Onboarding基线诊断水平: 'basic', 'intermediate', 'advanced'
  storyGenrePreferences: text('story_genre_preferences'), // 逗号分隔的偏好
  intensity: text('intensity'), // 'relax', 'normal', 'hard'
  streak: integer('streak').default(0).notNull(),
  lastActiveDate: text('last_active_date'), // YYYY-MM-DD
});

// 2. 词汇库 (3500词)
export const vocabLibrary = sqliteTable('vocab_library', {
  word: text('word').primaryKey(),
  phonetic: text('phonetic').notNull(),
  pos: text('pos').notNull(),
  meaningCn: text('meaning_cn').notNull(),
  level: integer('level').notNull(), // 1, 2, 3, 4
  gaokaoFrequency: text('gaokao_frequency').notNull(), // 'high', 'medium', 'low'
  wordFamily: text('word_family'), // 逗号分隔
  tags: text('tags'), // 逗号分隔
});

// 3. 用户词汇状态表 (SM-2 调度)
export const userVocabState = sqliteTable('user_vocab_state', {
  id: text('id').primaryKey(), // userId + "_" + word
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  word: text('word').notNull().references(() => vocabLibrary.word, { onDelete: 'cascade' }),
  status: text('status').notNull(), // 'unseen', 'context_word', 'core_word_tested', 'mastered'
  seenCount: integer('seen_count').default(0).notNull(),
  clickedCount: integer('clicked_count').default(0).notNull(),
  correctCount: integer('correct_count').default(0).notNull(),
  incorrectCount: integer('incorrect_count').default(0).notNull(),
  interval: integer('interval').default(0).notNull(), // 间隔天数
  easeFactor: real('ease_factor').default(2.5).notNull(), // SM-2 Ease Factor
  nextReviewAt: text('next_review_at'), // YYYY-MM-DD
  lastReviewedAt: text('last_reviewed_at'), // ISO string
});

// 4. 故事章节内容库 (预生成故事)
export const contentLibrary = sqliteTable('content_library', {
  id: text('id').primaryKey(), // 唯一 ID (例如 uuid 或 hash)
  vocabIds: text('vocab_ids').notNull(), // JSON 字符串数组, e.g. ["word1", "word2"]
  genre: text('genre').notNull(), // 'mystery', 'sci-fi', etc.
  chapterIndex: integer('chapter_index').notNull(),
  title: text('title').notNull(),
  storyText: text('story_text').notNull(), // 包含词汇高亮的文章正文
  vocabHighlights: text('vocab_highlights').notNull(), // JSON 高亮位置坐标等
  choicePrompt: text('choice_prompt').notNull(), // 关键抉择提问
  choiceTriggerPosition: real('choice_trigger_position').default(0.7).notNull(),
  choices: text('choices').notNull(), // JSON choices list: [{ label: 'A', text: '...', isCorrect: false }, ...]
  branchStories: text('branch_stories').notNull(), // JSON branch story mapping: { 'A': '支线A内容...', ... }
  chapterSummary: text('chapter_summary').notNull(),
  qualityScore: real('quality_score'),
  createdAt: text('created_at').notNull(),
  status: text('status').default('draft'),
  
  // 新扩展字段
  storylineId: text('storyline_id').default('canglan_mist'),
  version: integer('version').default(1),
  coreWords: text('core_words').default('[]'),
  newContextWords: text('new_context_words').default('[]'),
  reviewWords: text('review_words').default('[]'),
  generationMetadata: text('generation_metadata'),
  qualityReport: text('quality_report'),
  publishedAt: text('published_at'),
  illustration: text('illustration'),
});

// 5. 用户阅读记录表
export const readingSessions = sqliteTable('reading_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => contentLibrary.id),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  durationSeconds: integer('duration_seconds'),
  choiceSelected: text('choice_selected'),
  isCorrect: integer('is_correct'), // 0 or 1
});

// 6. 词汇点击记录表 (用于调度升级判定)
export const wordClicks = sqliteTable('word_clicks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  word: text('word').notNull().references(() => vocabLibrary.word, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull(),
  clickedAt: text('clicked_at').notNull(),
});

// 7. 故事进度表
export const storyProgress = sqliteTable('story_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  storylineId: text('storyline_id').notNull().default('canglan_mist'),
  currentChapterIndex: integer('current_chapter_index').notNull().default(1),
  activeSessionId: text('active_session_id'),
  firstStartedAt: text('first_started_at').notNull(),
  lastCompletedAt: text('last_completed_at'),
  revision: integer('revision').notNull().default(0),
});

// 8. 学习会话表
export const learningSessions = sqliteTable('learning_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  chapterVersionId: text('chapter_version_id').notNull(),
  storylineId: text('storyline_id').notNull().default('canglan_mist'),
  status: text('status').notNull().default('active'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  firstChoiceOptionId: text('first_choice_option_id'),
  firstChoiceCorrect: integer('first_choice_correct'),
  branchCompletedAt: text('branch_completed_at'),
  discriminationFirstCorrect: integer('discrimination_first_correct'),
  discriminationFinalCorrect: integer('discrimination_final_correct'),
});

// 9. 学习事件表
export const learningEvents = sqliteTable('learning_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sessionId: text('session_id').notNull().references(() => learningSessions.id),
  eventType: text('event_type').notNull(),
  payload: text('payload'),
  occurredAt: text('occurred_at').notNull(),
  receivedAt: text('received_at').notNull(),
});

// 10. 章节完成记录表
export const chapterCompletions = sqliteTable('chapter_completions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  chapterVersionId: text('chapter_version_id').notNull(),
  completedAt: text('completed_at').notNull(),
});

// 11. 登录失败与锁定状态。以手机号为主键，确保多进程共享同一份状态。
export const authLockouts = sqliteTable('auth_lockouts', {
  phone: text('phone').primaryKey(),
  failedCount: integer('failed_count').notNull().default(0),
  lockedUntil: text('locked_until'),
  lastFailedAt: text('last_failed_at'),
});

// 12. 诊断/迁移测验记录。commandId 用于 Onboarding 的幂等写入。
export const assessmentAttempts = sqliteTable('assessment_attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assessmentKind: text('assessment_kind').notNull(),
  commandId: text('command_id').notNull().unique(),
  itemSetVersion: text('item_set_version').notNull(),
  correctCount: integer('correct_count').notNull(),
  itemCount: integer('item_count').notNull(),
  derivedLevel: text('derived_level').notNull(),
  createdAt: text('created_at').notNull(),
});
