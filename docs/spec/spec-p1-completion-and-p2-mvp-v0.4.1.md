# Curio P1 收尾与 P2 学习闭环 MVP 研发规格说明书

> **版本**：v0.4.1  
> **对应 PRD**：`docs/prd/prd-v0.4.1.md`  
> **状态**：Ready for Engineering Review  
> **日期**：2026-07-29  
> **替代关系**：替代 `spec-p1-completion-and-p2-mvp.md`；原文件保留为历史记录  
> **面向对象**：Frontend / Backend / AI Data Engineering / Content QA

---

## 1. 目标与非目标

### 1.1 P1 交付目标

交付一个可供 5–10 名高中生连续测试 7 天的受控 Web 版本，完整支持：

1. 安全程度与受控试点相匹配的账号登录；
2. 《苍澜迷雾》10 章按顺序阅读和恢复；
3. 词汇查阅、关键抉择、支线纠偏和近义词辨析；
4. 服务端可靠保存学习状态；
5. 基于真实事件的学生首页与家长报告；
6. 本地 PNG 成果海报导出；
7. 可用于验证留存与词义理解的事件数据。

### 1.2 P2 交付目标

在 P1 闭环稳定后，加入：

- 章节级固定间隔语境复现；
- 独立、未见语境的迁移测验；
- 内容版本管理与发布门禁。

### 1.3 明确非目标

- P1 不提供公开注册、短信 OTP、独立家长账号或公开分享链接；
- P1/P2 不进行实时 LLM 个体生成；
- P2 固定复现不是个体 SM-2，不根据个人答题结果改变正文；
- P1 不实现真人发音；
- P1/P2 不声称提高高考分数或 Level C 写作能力。

---

## 2. 不变量

以下规则是实现和测试共同遵守的接口约束：

1. **服务端是学习事实源**。前端内存状态只是交互投影。
2. **业务请求不接受客户端声明的 `userId`**。用户身份来自已验证会话。
3. **同一章节首次完成只计数一次**。重复请求返回相同结果，不制造重复进度。
4. **主线章节严格顺序推进**。调度不得为了词汇匹配跳章或重复推荐已完成章。
5. **每章词汇总量恰好为 15**，复现词包含在 15 词之内。
6. **核心词必须显式声明**，不得依赖 `vocabIds[0]` 等数组位置约定。
7. **每个错误选项都必须存在对应支线**。
8. **故事内答题与独立迁移测验分开统计**。
9. **无有效样本时指标返回 `null`**，不得用 80% 等默认值填充。
10. **学习日以 `Asia/Shanghai` 自然日计算**。
11. **内容生成只创建新版本，不原地覆盖已发布内容**。
12. **测试不得连接 `data/curio.db`**，必须使用临时隔离数据库。

---

## 3. 领域模型

### 3.1 核心对象

#### PilotIdentity

受控试点身份，包含：

- `userId`
- `phone`：规范化中国大陆手机号，仅用于受控测试身份；
- `pinHash`：首次激活后设置的测试 PIN 哈希；
- `status`：`invited | active | disabled`
- `createdAt`

手机号不得出现在学习事件或海报中。

#### StoryProgress

用户在一条主线上的唯一进度：

- `userId`
- `storylineId`
- `currentChapterIndex`
- `activeSessionId | null`
- `firstStartedAt`
- `lastCompletedAt | null`
- `revision`

`(userId, storylineId)` 唯一。

#### LearningSession

一次章节学习过程：

- `id`
- `userId`
- `chapterVersionId`
- `status`：`active | completed | abandoned`
- `startedAt`
- `completedAt | null`
- `firstChoiceOptionId | null`
- `firstChoiceCorrect | null`
- `branchCompletedAt | null`
- `discriminationFirstCorrect | null`
- `discriminationFinalCorrect | null`

同一用户、同一章节版本最多存在一个 `active` 会话。

#### ChapterContent

版本化章节内容：

- `chapterVersionId`
- `storylineId`
- `chapterIndex`
- `version`
- `status`：`draft | qa_passed | published | retired`
- `title`
- `storyText`
- `coreWords[]`
- `newContextWords[]`
- `reviewWords[]`
- `highlights[]`
- `criticalChoice`
- `chapterSummary`
- `generationMetadata`
- `qualityReport`

词汇容量不变量：

```text
unique(coreWords + newContextWords + reviewWords).length === 15
coreWords.length >= 1 && coreWords.length <= 2
reviewWords.length >= 0 && reviewWords.length <= 5
```

`criticalChoice` 必须包含：

```ts
type CriticalChoice = {
  coreWord: string;
  triggerPosition: 0.7;
  prompt: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    misconception: string | null;
  }>;
  branchByWrongOption: Record<string, string>;
  correctFeedback: string;
  discriminationTask: {
    prompt: string;
    options: string[];
    correctOption: string;
    feedbackByWrongOption: Record<string, string>;
  };
};
```

#### LearningEvent

不可变的行为记录：

- `id`：客户端生成 UUID，同时作为幂等键；
- `userId`
- `sessionId`
- `eventType`
- `payload`
- `occurredAt`
- `receivedAt`

P1 事件类型：

- `chapter_started`
- `word_opened`
- `critical_choice_submitted`
- `branch_completed`
- `discrimination_submitted`
- `chapter_completed`
- `poster_exported`

---

## 4. 模块与接口

### 4.1 Auth Module

该模块隐藏手机号规范化、PIN 校验、限流、会话签发和注销细节。

#### HTTP 接口

```http
POST /api/auth/pilot/activate
POST /api/auth/pilot/login
POST /api/auth/logout
GET  /api/me
```

激活请求：

```json
{
  "phone": "13800000000",
  "inviteCode": "ADMIN-ISSUED-CODE",
  "pin": "6-digit-pin"
}
```

登录请求：

```json
{
  "phone": "13800000000",
  "pin": "6-digit-pin"
}
```

成功后由服务端写入签名会话 Cookie：

- `HttpOnly`
- `Secure`（生产环境）
- `SameSite=Lax`
- 有效期 7 天
- 不在 `localStorage` 保存 Token 或 `userId`

错误规则：

- 手机号、邀请码或 PIN 错误统一返回 `401 INVALID_CREDENTIALS`；
- 单个手机号连续 5 次失败后锁定 15 分钟；
- `disabled` 用户返回 `403 ACCOUNT_DISABLED`；
- 日志不得记录完整手机号、PIN 或会话值。

正式公开发布前，本模块必须替换为带 OTP 或等价验证的认证实现；受控试点实现不得直接升级为生产认证。

### 4.2 LearningSession Module

这是前端与学习状态之间的主要 seam。模块内部负责顺序推进、会话恢复、事件幂等、进度更新和报告所需事实写入。

#### HTTP 接口

```http
GET  /api/learning/snapshot
POST /api/learning/session/start
POST /api/learning/session/:sessionId/event
POST /api/learning/session/:sessionId/complete
```

`GET /api/learning/snapshot` 返回：

```ts
type LearningSnapshot = {
  user: {
    diagnosticLevel: 'basic' | 'intermediate' | 'advanced' | null;
    preferences: { genres: string[]; intensity: 'light' | 'medium' | 'deep' };
  };
  progress: {
    storylineId: 'canglan_mist';
    nextChapterIndex: number;
    completedChapterCount: number;
    activeSessionId: string | null;
    streakDays: number;
    revision: number;
  };
  chapter: ChapterContentView | null;
};
```

`POST /api/learning/session/start`：

- 无活动会话时创建下一章会话；
- 已有活动会话时返回原会话；
- 已完成全部 10 章时返回 `409 STORY_COMPLETED`；
- 不接受 `chapterId` 或 `userId`，由服务端根据进度决定章节。

`POST /api/learning/session/:sessionId/event` 请求：

```json
{
  "eventId": "uuid",
  "type": "word_opened",
  "payload": { "word": "ambiguous" },
  "occurredAt": "2026-07-29T12:00:00.000Z"
}
```

幂等规则：同一 `eventId` 重试返回首次写入结果；同一事件不得重复累加。

`POST /api/learning/session/:sessionId/complete` 请求：

```json
{
  "commandId": "uuid",
  "clientRevision": 7
}
```

完成前置条件：

- 已提交关键抉择；
- 若首答错误，已完成对应支线；
- 已至少提交一次近义词辨析任务。

返回新的 `LearningSnapshot`。同一 `commandId` 重试必须返回相同快照；章节已完成时再次提交不能增加章节数或 Streak。

### 4.3 Content Catalog Module

内容目录依赖本地可替代的 SQLite。生产与测试通过同一模块接口运行，测试将数据库路径替换为临时 SQLite；P1 不为单一实现额外制造仓储 port。模块向 LearningSession 只暴露：

```ts
getPublishedChapter(storylineId, chapterIndex): ChapterContent
validateChapter(candidate): QualityReport
publishChapterVersion(chapterVersionId): PublishedChapter
```

实现不得让调用者了解 JSON 字段布局、核心词位置或版本选择细节。

### 4.4 Report Module

```http
GET  /api/report/learning
POST /api/report/poster-exported
```

报告返回：

```ts
type LearningReport = {
  generatedAt: string;
  validLearningDays: number;
  completedChapters: number;
  lookedUpUniqueWords: number;
  coreFirstAttempt: MetricRate;
  discriminationFirstAttempt: MetricRate;
  transferAssessment: MetricRate | null;
  baselineChange: {
    baselineCorrect: number;
    followupCorrect: number;
    itemCount: number;
    deltaPoints: number;
  } | null;
};

type MetricRate = {
  numerator: number;
  denominator: number;
  ratePct: number;
};
```

显示规则：

- `denominator === 0` 时相应指标为 `null`；
- 迁移测验不足 10 个有效题时，前端显示“数据积累中”；
- 不返回或显示同省排名、预测分数、模拟准确率；
- 查阅词汇只能命名为“查阅词汇数”，不能命名为“掌握词汇数”或“Level A+B 激活数”。

---

## 5. 客户端状态与同步策略

### 5.1 Store 分层

`useAppStore` 只保留两类状态：

1. **服务端快照投影**：用户、进度、当前章节、报告；
2. **临时 UI 状态**：当前弹窗、已选选项、加载状态、错误提示。

删除或替换以下硬编码状态：

- `hasCompletedChapter1`
- `completeChapter1`
- `VOCAB_MOCK` 作为正式数据源
- `simulatedAccuracy`
- `simulatedTotalWords`
- `diagImprovePct`

### 5.2 启动恢复

应用启动状态机：

```text
booting
  → GET /api/me
  → 401: unauthenticated
  → 200: GET /api/learning/snapshot
  → ready
  → 网络失败: recoverable_error + 重试按钮
```

恢复完成前不展示默认首页，避免先显示 Mock 进度再跳变。

### 5.3 乐观更新

- 词汇浮层打开可以立即响应，并在后台发送幂等事件；失败时进入本地重试队列；
- 关键抉择、支线完成、辨析提交和章节完成必须得到服务端确认后才能进入不可逆的下一状态；
- 页面刷新后以服务端快照恢复，不能依赖 Zustand 内存；
- 重试队列只保存事件 UUID 与非敏感 payload，不保存手机号或 PIN。

---

## 6. 数据库变更

### 6.1 users

将 `email` 改为可空，新增：

- `phone`：唯一、可空；P1 试点用户必填；
- `pin_hash`
- `status`
- `timezone`，P1 固定为 `Asia/Shanghai`；
- `updated_at`

不得在 `users` 表中保存可直接复用的明文 Token。

### 6.2 新增表

#### story_progress

- 唯一键：`(user_id, storyline_id)`
- 保存 `current_chapter_index`、`active_session_id`、`revision` 和时间字段。

#### learning_sessions

- 保存章节版本与学习状态；
- 索引：`(user_id, status)`；
- 通过事务保证同一用户同一主线最多一个活动会话。

#### learning_events

- `id` 为客户端事件 UUID，主键即幂等键；
- 保存事件类型、JSON payload 和时间；
- 索引：`(user_id, event_type, occurred_at)`。

#### chapter_completions

- 唯一键：`(user_id, chapter_version_id)`；
- 用于去重首次完成事实；
- 重看和重复提交不增加记录。

#### assessment_attempts

- `assessment_kind`：`baseline | transfer_followup`
- `item_set_version`
- `correct_count`
- `item_count`
- `completed_at`

### 6.3 内容表迁移

现有 `content_library` 保留，但必须新增或迁移出：

- `storyline_id`
- `version`
- `status`
- `core_words`
- `new_context_words`
- `review_words`
- `generation_metadata`
- `quality_report`
- `published_at`

在迁移期间可以保留 `vocab_ids` 作为派生兼容字段，但新实现不得从数组第一项推断核心词。

### 6.4 迁移要求

- 使用显式数据库迁移，不允许仅修改 Drizzle Schema；
- 迁移前备份 `data/curio.db`；
- 迁移脚本可重复执行或能检测已执行状态；
- `packages/db/src/seed.ts` 只播种词库，不能再被描述为“无损重新播种全部项目数据”；
- 内容补全使用独立脚本生成新版本，不覆盖原始 10 章样稿。

---

## 7. P1 内容补全

### 7.1 当前数据处理

当前 10 章均标记为 `draft`。每章执行：

1. 扩写正文至 600–900 中文字；
2. 显式指定 1–2 个核心词；
3. 确保三类词合计恰好 15 个；
4. 校验 15 词均在正文中自然出现；
5. 为每个错误选项生成独立 100–150 字支线；
6. 增加所有路径共用的近义词辨析任务；
7. 运行自动质量校验；
8. 由至少一名人工审核者确认后发布。

### 7.2 自动质量门禁

门禁失败时禁止发布：

- 正文字数不在 600–900；
- 词汇总数不是 15 或存在重复角色；
- 核心词不是 1–2 个；
- 复现词超过 5 个；
- 任一目标词未出现在正文；
- 正确选项不是唯一；
- 任一错误选项缺少 `misconception` 或支线；
- 任一支线不在 100–150 字；
- 核心词、选项和辨析任务引用不一致；
- 内容版本缺少生成与审核元数据。

### 7.3 人工检查

- 英语词义和词性正确；
- 干扰项对应真实词义误区；
- 不理解词义时不能仅凭剧情常识答对；
- 前后章节人物、线索和时间线连续；
- 词汇嵌入达到 Level 3，不使用括号直译；
- 内容适合未成年人。

---

## 8. P2 固定间隔复现

### 8.1 声称边界

P2 使用由章节序号决定的固定复现计划。它不读取个人 `easeFactor` 或 `nextReviewAt` 来重写章节，因此对外统一命名为：

> 固定间隔语境复现（Fixed-Interval Contextual Recurrence）

### 8.2 内容计划

- 初次出现词按照 `+1、+3、+7` 章优先安排复现；
- 每章最多 5 个复现词；
- 超出容量的词顺延一章，并记录偏移；
- 复现词必须处于不同于首次出现的新语境；
- 复现词占用 15 词总预算，不能额外加入；
- Patch 结果写为新的 `chapterVersionId`。

### 8.3 个体数据用途

P2 仍可记录用户答对、答错和查阅行为，用于：

- 分析固定复现对不同学生的效果；
- 识别未来个体调度所需信号；
- 不用于改变当前章节正文。

只有当系统能够根据个人状态选择不同内容版本时，才可以恢复“个体 SM-2 调度”的命名。

---

## 9. 独立迁移测验

### 9.1 设计原则

- 题干句子不得来自故事原文；
- 测试词可相同，但语境、人物和主题必须不同；
- 基线与后测使用等值而非相同题组；
- 题目先由英语教师或内容审核者确认；
- 故事内关键抉择结果不得混入迁移测验分子或分母。

### 9.2 P2 最小方案

- Onboarding：10 道基线题；
- 完成至少 4 章或达到第 7 日窗口：10 道等值迁移题；
- 报告同时显示 `correct / total`、百分比、题组版本和测试日期；
- 未完成后测时显示“数据积累中”，不计算进步幅度。

---

## 10. 家长报告与海报

### 10.1 报告数据

P1 只展示：

- 有效学习天数；
- 去重完成章节数；
- 去重查阅词汇数；
- 核心词首答正确数 / 有效题数；
- 近义词辨析首答正确数 / 有效题数；
- 迁移数据状态。

禁止出现：

- 模拟正确率；
- 默认进步百分比；
- “高于同省 X% 学生”；
- “科学见证分数成长”；
- 将查阅词数命名为掌握或激活词数。

### 10.2 PNG 导出

P1 选择 `html2canvas` 作为 DOM 到 Canvas adapter：

- 新增明确依赖并锁定版本；
- 海报画布目标宽度 1080px；
- 输出 PNG Blob，通过浏览器下载或系统分享能力保存；
- 不生成 Base64 持久化数据；
- 海报不使用无 CORS 授权的远程图片；
- 导出失败时显示错误和重试；
- 按钮文案为“保存学习海报”，不写“图片 / 链接”。

P1 海报仅含学习昵称或匿名称呼，不含手机号、用户 ID 或可公开查询的链接。

---

## 11. Streak 规则

- 学习日：`Asia/Shanghai` 当天首次完成任一未完成章节；
- 同日完成多章只增加一个有效学习日，不重复增加 Streak；
- 回看已完成章节不更新 Streak；
- 与上一个有效学习日相差 1 天：`streak + 1`；
- 相差超过 1 天：重置为 1；
- 同一完成命令重试不改变 Streak；
- 服务端使用上海日期计算，不能使用 UTC 日期字符串直接截断。

---

## 12. 错误处理

统一错误体：

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "学习进度已在另一设备更新",
    "retryable": true
  }
}
```

必须定义并覆盖：

- `UNAUTHENTICATED`
- `INVALID_CREDENTIALS`
- `ACCOUNT_DISABLED`
- `SESSION_NOT_FOUND`
- `SESSION_ALREADY_COMPLETED`
- `INVALID_EVENT_SEQUENCE`
- `REVISION_CONFLICT`
- `CONTENT_NOT_AVAILABLE`
- `NETWORK_UNAVAILABLE`（客户端归一化）

发生 `REVISION_CONFLICT` 时，客户端重新获取快照并提示用户，不静默覆盖服务端状态。

---

## 13. 测试策略

### 13.1 测试接缝

主要测试通过 Auth Module、LearningSession Module、Content Catalog Module 和 Report Module 的外部接口完成。测试断言可观察结果，不依赖内部函数调用。

每个测试创建临时 SQLite 数据库并播种最小 fixture；测试结束后删除临时数据库。测试进程如果检测到路径等于 `data/curio.db` 必须立即失败。

### 13.2 P0 集成用例

1. 未认证请求任何学习或报告接口，返回 401；
2. 用户不能通过请求参数读取或修改其他用户数据；
3. 同一章节完成命令发送两次，章节数和 Streak 只增加一次；
4. 网络响应丢失后使用同一幂等键重试，返回同一结果；
5. 上海时间 00:30 完成章节，归入正确自然日；
6. 刷新页面后恢复同一活动章节和已提交状态；
7. 章节严格从 1 推进到 10，词汇匹配不能跳章；
8. 15 词总量包含复现词，任何章节不得出现第 16 个目标词；
9. 每个错误选项均能找到独立支线；
10. 首答错误后未完成支线，不能完成章节；
11. 报告无答题数据时正确率为 `null`；
12. 查阅一个词只增加查阅词汇数，不增加核心词正确数；
13. 重看章节不增加完成章数和 Streak；
14. 海报内容与报告接口数据一致，且不包含手机号；
15. 所有测试使用临时数据库，现有 `data/curio.db` 内容不变化。

### 13.3 内容测试

为 `ChapterContent` Schema 建立自动校验，10 章全部通过才允许发布。输出报告至少包括：

- 字数；
- 三类词汇数量及去重总数；
- 目标词正文覆盖；
- 正确选项唯一性；
- 错误选项到支线的完整映射；
- 支线字数；
- 内容哈希与版本。

### 13.4 客户端验收

至少覆盖 Chrome、Safari iOS 和微信内置浏览器：

- 登录与会话恢复；
- 弱网重试；
- 词汇浮层；
- 关键抉择两条路径；
- 刷新恢复；
- PNG 海报生成与保存；
- 375px 宽度下无横向溢出。

---

## 14. 实施顺序

### Phase 0：数据保护与测试基线

1. 增加临时测试数据库工厂；
2. 禁止现有集成测试写入正式 `data/curio.db`；
3. 为现有数据库建立备份与迁移脚本；
4. 将当前 10 章标记为 `draft`。

### Phase 1：身份与学习事实源

1. 实现受控试点 Auth Module；
2. 新增 StoryProgress、LearningSession、LearningEvent 与 Completion 数据结构；
3. 实现四个 LearningSession 接口；
4. 实现幂等、修订号和上海自然日 Streak。

### Phase 2：前端接入

1. 启动时恢复 `/api/me` 和学习快照；
2. 将首页、阅读器和词汇本改为服务端数据；
3. 删除第一章专用动作和正式路径中的 Mock 数据；
4. 实现失败、重试和冲突状态。

### Phase 3：内容门禁与 10 章补全

1. 建立 ChapterContent Schema；
2. 逐章扩写、补全核心词、错误支线和辨析任务；
3. 自动校验；
4. 人工审核；
5. 发布新内容版本。

### Phase 4：真实报告与海报

1. 实现 Report Module；
2. 替换模拟数字和过度声称；
3. 实现 PNG Blob 导出；
4. 完成三类移动浏览器验证。

### Phase 5：P2 学习闭环

1. 生成固定间隔复现计划；
2. 创建而非覆盖 Patch 内容版本；
3. 接入独立迁移测验；
4. 基于 P1 数据决定是否立项第二题材和主动推送。

---

## 15. Definition of Done

P1 只有同时满足以下条件才可以标记完成：

- 10 章全部通过自动和人工内容门禁；
- 受控账号能够跨设备恢复学习状态；
- 所有业务接口从认证会话获取用户身份；
- 章节顺序、幂等、Streak 和报告指标测试全部通过；
- 前端正式路径不再读取第一章硬编码数据或家长报告 Mock 数字；
- 弱网失败可见且可重试；
- 家长报告只展示指标字典允许的真实数据；
- PNG 海报在 Chrome、Safari iOS、微信内置浏览器验证通过；
- 测试运行前后 `data/curio.db` 哈希不变；
- 完成 5–10 名用户试点所需的事件观测和问题反馈入口。

P2 只有在 P1 Definition of Done 全部满足后才能启动。

---

*文档版本：v0.4.1｜状态：Ready for Engineering Review*
