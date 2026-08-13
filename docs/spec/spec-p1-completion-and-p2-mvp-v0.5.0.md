# Curio P1 收尾与 P2 学习闭环 MVP 研发规格说明书

> **版本**：v0.5.0
> **对应 PRD**：`docs/prd/prd-v0.4.1.md`
> **状态**：Ready for Engineering Review
> **日期**：2026-08-10
> **替代关系**：替代 `spec-p1-completion-and-p2-mvp-v0.4.1.md`；原文件保留为历史记录
> **触发原因**：2026-08-08 全量代码 Review 发现实现层存在安全债与数据可信度债，其中多项源于 Spec 未覆盖或约束不足
> **面向对象**：Frontend / Backend / AI Data Engineering / Content QA / DevOps

---

## 0. 本版相对 v0.4.1 的变更摘要

本版为**增量修订**，不推翻 v0.4.1 的领域模型与接口设计，而是：补齐 Spec 未覆盖的缺口，把 Review 发现的实现偏离项强化为带验收的硬约束，并新增安全与工程规范两章。未在本文件重写的章节，仍以 v0.4.1 原文为准。

| Review 发现 | 性质 | 本版处置 | 章节 |
|---|---|---|---|
| 旧路由 `index.ts` 仅凭 `userId` 操作、明文 token | 代码偏离不变量#2 | 强化下线为 Phase 0.5 硬门禁 | §14 |
| `JWT_SECRET` 缺省值可伪造 session | Spec 缺口 | 新增密钥管理不变量 + 启动校验 | §2、§16 |
| CORS `origin:'*'` 与凭证并存 | Spec 缺口 | 新增 CORS 白名单约束 | §16 |
| `dangerouslySetInnerHTML` 渲染后端文本 | Spec 缺口 | 新增内容净化不变量 | §2、§16 |
| 登录锁定用进程内 `Map` | Spec 模糊 | 明确锁定必须持久化 | §4.1、§16 |
| `normalizePhone` 正则双反斜杠失效 | Spec 缺口 | 给出规范化算法 | §4.1 |
| scheduler 用 UTC、learning 用 Asia/Shanghai | 代码偏离不变量#10 | 统一时区 + 增加测试用例 | §11、§13 |
| SM-2 状态机一次 correct 即 mastered | Spec 缺口 | 给出词汇状态合法转移图 | §4.2 |
| `JSON.parse` 无 try-catch 致 500 | Spec 缺口 | 新增解析容错不变量 | §2 |
| accuracy 无数据返回 80（假数据） | 代码偏离不变量#9 | 增加假数据检测测试 | §13 |
| Onboarding 偏好/诊断未持久化 | Spec 缺口 | 新增 Onboarding 写入接口 | §4.2 |
| `retryQueue` 入队不消费 | 代码偏离§5.3 | 明确重试队列消费契约 | §5.3 |
| `App.tsx` 1645 行单文件 / 全程 any / 死依赖 | Spec 缺口 | 新增前端工程规范 | §17 |
| HTTP 明文 + `ALLOW_HTTP_COOKIES:true` | Spec 缺口 | 新增部署安全配置 | §18 |
| CONTEXT.md 称「apiClient 未调用」已过时 | 文档漂移 | 同步更新 CONTEXT.md | §19 |

---

## 1. 目标与非目标

与 v0.4.1 §1 一致，无变更。

本版新增一个 P1 子目标：**试点上线前完成安全加固与旧路由下线**（见 §14 Phase 0.5），否则不得进入用户测试。

---

## 2. 不变量（增补）

下列规则是实现和测试共同遵守的接口约束。第 1–12 条沿用 v0.4.1，本版新增第 13–18 条：

1–12. （同 v0.4.1）

> 重点复述两条 Review 直接相关的既有不变量：
> - **#2**：业务请求不接受客户端声明的 `userId`。用户身份来自已验证会话。
> - **#9**：无有效样本时指标返回 `null`，不得用 80% 等默认值填充。

**新增不变量：**

13. **密钥不得硬编码**。`JWT_SECRET` 等签名密钥必须来自环境变量；进程启动时若检测到缺省值（如 `default_secret_for_dev`）且 `NODE_ENV=production`，必须拒绝启动并记录安全事件。

14. **CORS 不得开放至 `*`**。生产环境只允许显式配置的前端来源；凭证接口与 `credentials: 'include'` 互斥于 `origin: '*'`。

15. **服务端可控文本渲染前必须净化**。前端渲染来自 `storyText`、`branchText`、`choicePrompt` 等后端字段的富文本时，必须经过白名单净化（允许段落/加粗/高亮等安全节点，剥离 `<script>`/事件属性/`javascript:` 伪协议）。不得对后端文本使用未经净化的 `dangerouslySetInnerHTML`。

16. **存储 JSON 字段解析必须容错**。对 `choices`、`branchStories`、`vocabHighlights`、`coreWords` 等以 JSON 字符串持久化的字段，读取时必须用 try-catch 包裹；解析失败时返回结构化错误 `CONTENT_CORRUPT`，不得抛出未处理异常导致 500。

17. **词汇状态只能沿合法转移图变化**（见 §4.2）。`mastered` 不得因 `clicked` 事件回退；单次 `correct` 不得直接跃迁至 `mastered`。

18. **登录锁定状态必须可跨进程恢复**。失败计数与锁定截止时间必须持久化存储，不得仅存于进程内内存。

---

## 3. 领域模型

与 v0.4.1 §3 一致，无变更。

---

## 4. 模块与接口

### 4.1 Auth Module（修订）

v0.4.1 的接口契约不变，本版补充实现规范以消除 Review 发现的实现歧义。

#### 4.1.1 手机号规范化算法

`phone` 在写入与比对前必须经过 `normalizePhone`，算法如下（实现须用单反斜杠正则，禁止转义双写）：

```text
输入: 任意字符串
1. 去除所有空白字符       → regex /\s+/g  (替换为 '')
2. 仅保留数字与前置加号   → regex /[^\d+]/g (替换为 '')
3. 若以 +86 开头则去前缀  → regex /^\+86/ (替换为 '')
4. 校验: 长度恰为 11 且以 1 开头，否则拒绝为 INVALID_PHONE
输出: 11 位数字字符串，如 "13800000000"
```

实现必须通过脏数据测试：`"  +86 138-0000-0000 "`、`"138 0000 0000"`、`"+8613800000000"` 均规范化为 `"13800000000"`；`"23800000000"`、`"1380000000"`（10 位）返回 `INVALID_PHONE`。

#### 4.1.2 登录锁定持久化

- 失败计数与 `lockedUntil` 时间戳必须写入持久化存储（数据库表或等价 KV），禁止仅存于进程内 `Map`；
- 多实例部署时，任一实例的失败计数对其他实例可见；
- 锁定解除（`lockedUntil` 到期）后计数清零，重新开始计数。

#### 4.1.3 密钥管理

- `JWT_SECRET` 由环境变量注入，最小长度 32 字节；启动时缺省值检测见 §2 不变量#13；
- PIN 哈希继续使用 bcrypt（cost ≥ 10）；
- 会话值不得出现在日志、响应体或前端可读存储中。

### 4.2 LearningSession Module（修订）

v0.4.1 的四个接口不变，本版补充 Onboarding 写入接口与词汇状态机。

#### 4.2.1 Onboarding 偏好与诊断写入接口（新增）

Review 发现 `setupUserPreferencesApi` 从未被调用，导致 Onboarding 采集的题材偏好、强度与基线诊断结果仅存前端，基线丢失使 P1 效果对比失去起点。新增写入接口：

```http
POST /api/learning/onboarding
```

请求：

```json
{
  "commandId": "uuid",
  "preferences": { "genres": ["mystery"], "intensity": "medium" },
  "diagnostic": {
    "itemSetVersion": "baseline-v1",
    "correctCount": 6,
    "itemCount": 10,
    "derivedLevel": "intermediate"
  }
}
```

契约：

- 需已认证会话；用户身份从会话读取，不接受 `userId`；
- `commandId` 为幂等键，重复提交返回首次结果；
- 写入 `users.diagnostic_level`、`users.story_genre_preferences`、`users.intensity`，并落 `assessment_attempts`（`assessment_kind='baseline'`）；
- 每用户基线诊断仅记录一次；重复提交不覆盖已记录基线，返回 `409 BASELINE_ALREADY_SET`；
- 调用后 `GET /api/learning/snapshot` 的 `user.diagnosticLevel` 与 `user.preferences` 必须反映写入值。

前端必须在 Onboarding 完成步骤调用本接口；未调用成功不得标记 Onboarding 完成。

#### 4.2.2 词汇状态合法转移图

`userVocabState.status` 只允许以下转移：

```text
unseen ──(首次在章节出现)──▶ context_word
context_word ──(作为核心词完成关键抉择且首答正确)──▶ core_word_tested
core_word_tested ──(辨析任务通过 / 复现中连续 correct 达阈值)──▶ mastered
context_word ──(作为核心词完成关键抉择且首答错误,经支线纠偏后)──▶ core_word_tested
mastered ──(禁止回退)── ✗
```

禁止：

- 单次 `correct` 事件直接将 `context_word` 跃迁至 `mastered`；
- `clicked`（词汇浮层打开）事件改变任何状态，`clicked` 仅累加 `clickedCount`；
- `mastered` 因任何事件回退至 `context_word`。

P2 阶段若启用个人化调度，转移规则变更须经新 ADR 记录，不得在本 Spec 范围内擅改。

### 4.3 Content Catalog Module

与 v0.4.1 §4.3 一致。补充：`getPublishedChapter` 返回的 `storyText` 等富文本字段，前端必须按不变量#15 净化后渲染。

### 4.4 Report Module

与 v0.4.1 §4.4 一致。强化：`transferAssessment` 当前恒为 `null`（迁移测验未实现），不得用任何默认值填充；前端显示「数据积累中」。

---

## 5. 客户端状态与同步策略（修订）

### 5.1 Store 分层

沿用 v0.4.1。补充工程规范见 §17。

### 5.2 启动恢复

沿用 v0.4.1。

### 5.3 乐观更新与重试队列（修订契约）

v0.4.1 描述了重试队列但未定义消费契约，导致实现层出现「入队不消费」死代码。本版明确：

- 重试队列只保存事件 `eventId` 与**非敏感 payload**（不含手机号、PIN）；
- 队列必须有一个**消费者**：应用恢复网络连接、页面 `visibilitychange` 回前台、或定时（默认 30s）触发消费，逐条重发至 `/api/learning/session/:sessionId/event`；
- 服务端按 `eventId` 幂等返回，已存在的事件直接成功，不重复累加；
- 队列上限 50 条，超出时丢弃最旧事件并上报 `RETRY_QUEUE_OVERFLOW` 埋点，不得静默丢数据无记录；
- 队列持久化到 `localStorage`（仅 eventId + 非敏感 payload），刷新后恢复。

---

## 6. 数据库变更

与 v0.4.1 §6 一致。补充：

- 新增 `auth_lockouts` 表（或等价结构）持久化登录锁定：字段含 `phone`、`failedCount`、`lockedUntil`、`lastFailedAt`；
- 不在 `users` 表存储明文 token、PIN 或会话值。

---

## 7. P1 内容补全

与 v0.4.1 §7 一致，无变更。

---

## 8. P2 固定间隔复现

与 v0.4.1 §8 一致，无变更。

---

## 9. 独立迁移测验

与 v0.4.1 §9 一致，无变更。

---

## 10. 家长报告与海报

与 v0.4.1 §10 一致。强化：Review 发现 `index.ts:463` 无数据时返回 `80`，本版重申不变量#9 为硬约束，并增加专项测试（见 §13.2 用例 16）。

---

## 11. Streak 规则（强化时区一致性）

沿用 v0.4.1 §11 全部规则。本版针对 Review 发现的时区不一致强化：

- `nextReviewAt`、`todayStr`、`lastActiveDate` 等一切「学习日」判定字段，**统一使用 `Asia/Shanghai` 自然日**计算与存储（格式 `YYYY-MM-DD`）；
- 禁止在 scheduler 用 UTC 日期截断后直接比较；
- 日期转换必须经过单一 `toShanghaiDate(isoTimestamp): string` 工具函数，禁止各模块自行 `new Date().toISOString().slice(0,10)`；
- 该函数须有单元测试覆盖跨日边界（如 UTC 16:00 = 上海次日 00:00）。

---

## 12. 错误处理

沿用 v0.4.1 §12 的统一错误体。本版新增错误码：

- `INVALID_PHONE`：手机号规范化失败；
- `CONTENT_CORRUPT`：存储 JSON 字段解析失败（见不变量#16）；
- `BASELINE_ALREADY_SET`：基线诊断已记录，重复提交；
- `RETRY_QUEUE_OVERFLOW`：客户端重试队列溢出（埋点，非用户可见错误）。

---

## 13. 测试策略（增补）

### 13.1 测试接缝

沿用 v0.4.1 §13.1。

### 13.2 P0 集成用例（增补 16–22）

v0.4.1 §13.2 的 1–15 条继续有效，本版新增：

16. **假数据检测**：报告接口在无答题数据时，`coreFirstAttempt` 等指标返回 `null`，禁止返回任何数值默认值（针对 Review 发现的 `80` 假数据）。
17. **旧路由越权**：`apps/api/src/index.ts` 中所有接受 `userId` 参数的旧路由，若保留则必须返回 401/403（未认证/不接受客户端 userId）；试点上线前旧路由应已下线，本测试用于回归防护。
18. **normalizePhone 脏数据**：传入 `"+86 138-0000-0000"`、`"  13800000000 "`、`"+8613800000000"` 均规范化成功；`"23800000000"`、`"12345"` 返回 `INVALID_PHONE`。
19. **时区跨日**：UTC 16:00（上海次日 00:00）完成章节，归入上海次日学习日；Streak 计算与 `nextReviewAt` 一致。
20. **词汇状态不回退**：对已 `mastered` 的词触发 `clicked` 事件，状态保持 `mastered`，仅 `clickedCount+1`。
21. **JSON 解析容错**：向 `content_library.choices` 注入损坏 JSON，读取该章节返回 `CONTENT_CORRUPT`，不返回 500。
22. **Onboarding 持久化**：调用 `POST /api/learning/onboarding` 后刷新页面，`GET /api/learning/snapshot` 返回的 `diagnosticLevel` 与 `preferences` 反映写入值；重复提交返回 `409 BASELINE_ALREADY_SET`。

### 13.3 内容测试

沿用 v0.4.1 §13.3。

### 13.4 客户端验收

沿用 v0.4.1 §13.4。补充：验证 `storyText` 渲染时 `dangerouslySetInnerHTML` 的输入经过净化（可在测试构建注入含 `<script>` 的脏文本，断言不执行）。

---

## 14. 实施顺序（插入 Phase 0.5）

v0.4.1 的 Phase 0–5 沿用，本版在 Phase 0 与 Phase 1 之间插入：

### Phase 0.5：安全加固与旧路由下线（试点上线硬门禁）

> 本阶段为 P1 用户测试的前置条件。未完成不得进入 Phase 1 之后的用户可用状态。

1. **旧路由下线**：移除 `apps/api/src/index.ts` 中所有仅凭 `userId` 参数操作的无鉴权路由；保留功能迁移至 `auth.ts`/`learning.ts`/`report.ts` 并套统一会话中间件。无法立即迁移的接口返回 410 Gone。
2. **密钥强制**：`server.ts` 启动时检测 `JWT_SECRET`，若为缺省值且 `NODE_ENV=production` 则拒绝启动。
3. **CORS 收紧**：生产 `origin` 改为环境变量 `ALLOWED_ORIGINS` 白名单。
4. **内容净化**：前端新增 `sanitizeStoryHtml()` 工具（基于 DOMPurify 或等价白名单），所有 `dangerouslySetInnerHTML` 包裹该函数。
5. **锁定持久化**：`auth.ts` 登录锁定改用 `auth_lockouts` 表。
6. **normalizePhone 修复**：按 §4.1.1 重写正则并补单元测试。
7. **时区统一**：抽取 `toShanghaiDate` 工具函数，scheduler 与 learning 统一调用。

### Phase 1–5

沿用 v0.4.1，其中 Phase 1 增补：实现 `POST /api/learning/onboarding` 并打通前端调用（见 §4.2.1）。

---

## 15. Definition of Done（增补）

v0.4.1 的 P1 DoD 全部继续有效，本版新增：

- 旧路由 `index.ts` 中无鉴权接口已下线或迁移，无任何接口接受客户端声明 `userId`；
- `JWT_SECRET` 在生产环境来自环境变量，缺省值启动检测通过；
- CORS 生产配置不含 `*`；
- 前端所有后端富文本渲染经净化函数，脏文本注入测试通过；
- 登录锁定状态持久化，进程重启后锁定未解除；
- `normalizePhone` 脏数据测试通过；
- scheduler 与 learning 时区一致，跨日测试用例通过；
- Onboarding 偏好与基线诊断持久化至后端，刷新后 snapshot 反映写入值；
- 重试队列有消费者且上限溢出有埋点。

P2 启动前置条件不变：P1 DoD（含本版增补项）全部满足。

---

## 16. 安全与密钥管理（新增）

本节集中规定跨模块的安全约束，作为不变量#13–#16 的展开。

| 领域 | 约束 |
|---|---|
| 签名密钥 | `JWT_SECRET` 环境变量注入，≥32 字节；启动缺省值检测；禁止入库 |
| 会话存储 | HttpOnly + Secure（生产）+ SameSite=Lax cookie；禁止 localStorage 存 token/userId |
| CORS | 生产白名单 `ALLOWED_ORIGINS`；凭证接口禁用 `origin:'*'` |
| 内容净化 | 后端富文本字段渲染前白名单净化；禁未净化 `dangerouslySetInnerHTML` |
| 错误泄露 | 禁止响应体回显 `err.message` 或堆栈；统一错误体（§12） |
| 输入校验 | 所有写入接口用 zod 或等价 schema 校验 body/query，禁止 `c: any` 透传 |
| 登录锁定 | 持久化存储；5 次失败锁 15 分钟；日志不含完整手机号/PIN |
| PIN 存储 | bcrypt cost ≥ 10；不得明文或可逆加密存储 |

---

## 17. 前端工程规范（新增）

Review 发现 `App.tsx` 1645 行单文件、全程 `any`、死依赖等问题。本节为 P1 收尾期的工程卫生要求，不阻塞功能但须在 DoD 前完成：

- **组件拆分**：`App.tsx` 按屏幕拆分至 `components/screens/{Landing,Onboarding,Home,Reader,Vocab,Parent}.tsx`，单文件目标 < 300 行；
- **类型安全**：定义 `Snapshot`、`ChapterContent`、`LearningEvent` 等领域类型，消除 `loadSnapshot(any)`、`currentChapter: any`；新代码禁止 `any`，存量 `any` 须有 TODO 注释；
- **死依赖清理**：移除未使用的 `lucide-react`；清理 `apiClient.ts` 中 8 个 v1 死函数；
- **副作用卫生**：`useEffect` 依赖数组完整；定时器/监听器在 unmount 清理；render 内禁止 `Math.random()`（改 `useMemo`）；
- **样式卫生**：内联 `style={{}}` 改 className，便于主题切换；
- **CONTEXT.md 同步**：更新「apiClient 未调用」为「核心学习闭环已打通，Onboarding 待持久化」（本版完成后改为「已打通」）。

---

## 18. 部署安全配置（新增）

| 项 | 约束 |
|---|---|
| 传输层 | 生产必须 HTTPS；`nginx.conf` 启用 TLS，禁止试点公网跑纯 HTTP |
| Cookie | 生产禁用 `ALLOW_HTTP_COOKIES`；仅在本地开发设 true |
| 反代头 | `X-Forwarded-Proto` 透传，后端据以判定是否设置 cookie Secure 标志 |
| 进程 | PM2 单实例（与持久化锁定、进程内 Map 失效前提一致）；扩容至多实例前必须先迁移所有进程内状态 |
| 环境变量 | `.env` 不入库；`.env.example` 仅含占位符不含真实密钥 |
| 健康检查 | `deploy.sh` 的 `/api/health` 验证保留；新增启动期密钥检测失败时 health 返回 503 |

---

## 19. 文档同步

本版完成后须同步更新：

- `CONTEXT.md` §「前后端打通」条目：由「apiClient.ts已封装，App.tsx/store.ts未调用」更新为「核心学习闭环已打通（auth/snapshot/session/event/vocab/report），Onboarding 持久化随 v0.5.0 Phase 1 落地」；
- 本 Spec 落地后新增 ADR-0007 记录「安全加固与旧路由下线」决策。

---

*文档版本：v0.5.0｜状态：Ready for Engineering Review｜触发：2026-08-08 全量代码 Review*
