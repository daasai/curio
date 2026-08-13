# Curio P1 收尾与 P2 MVP 研发规格说明书 (Spec)

> ⚠️ **历史版本**：本文件已由 [`spec-p1-completion-and-p2-mvp-v0.4.1.md`](./spec-p1-completion-and-p2-mvp-v0.4.1.md) 替代，仅保留用于追溯。

> **对应 PRD 版本**：v0.4  
> **面向对象**：全栈研发工程团队 (Frontend / Backend / AI Data Engineering)  
> **文档状态**：Ready for Engineering  

---

## Problem Statement

高中生在使用词汇软件背单词时面面临「孤立符号易遗忘」、「刷词枯燥难坚持」以及「考场阅读语境中认不出」三大痛点。同时，家长（付费决策者）无法在现有竞品中直观看到孩子在“真实语境阅读理解”上的量化进步。

目前的研发进展中，虽然已完成 3500 词库与前 10 章预制高密度连载故事落库，但存在**前端与后端数据脱节（依赖内存刷新丢失）**、**手机号登录与持久化未接入**、**支线汇流无感纠错文本占位未补全**以及**家长报告缺乏真实的成长长图导出**等断层问题，无法满足高可用测试与商业化转化的要求。

---

## Solution

1. **全面打通前后端数据流**：前端 Zustand store 全面对接现有的 REST API 接口，实现手机号登录、持久化记住登录状态（`localStorage` Token）与无缝静默恢复。
2. **高密度连载与支线汇流补全**：依托数据库已存的 10 章（15 词/章）故事正文，将 `branch_stories` 中的单句占位符补全为 **100~150 字带有词义纠偏功能的真正支线叙事**。
3. **家长端真实成长海报导出**：废除家长报告中的 Mock 数据，对接 `/api/report/parent` 真实计算用户激活词汇量与迁移准确率，并实现 Canvas/HTML 生成微信分享长图。
4. **离线 SM-2 预制 Patch 机制 (P2)**：基于用户按天推进的连载进度，通过离线 AI 脚本在基底章节中注入最多 5 个到期复现旧词（Level 3 嵌入），保障遗忘曲线闭环。

---

## User Stories

### 1. 账号与状态持久化 (Auth & Persistence)
1. As a 高中生用户, I want to 通过手机号码一键登录/注册账号, so that 我的学习进度与词汇记录可以安全保存在云端。
2. As a 用户, I want 应用在我下次打开时自动记住登录状态（静默登录）, so that 我无需频繁重复输入手机号。
3. As a 用户, I want 在重新刷新页面或更换设备登录后看到正确的连续打卡 Streak 天数与起点诊断水平, so that 我的学习成就得以延续。

### 2. 沉浸式高密度故事阅读 (Reading & Dual-Track Vocab)
4. As a 高中生用户, I want 在阅读《苍澜迷雾》主线章节时看到 15 个金色高亮的高考词汇, so that 我可以在精美故事语境中自然吸收核心与背景词汇。
5. As a 用户, I want 点击金色高亮单词时弹出轻量卡片, so that 我可以查阅音标（含英音/美音真人发音）、词性、中文释义、词族（Word Family）与近义词辨析（如 ambiguous vs vague）。
6. As a 用户, I want 查阅过的单词自动加入「我的词汇世界」（词汇本）, so that 我随时可以回顾带有故事原文引用的场景词汇。

### 3. 关键抉择与支线汇流 (Critical Choice & Branch Convergence)
7. As a 用户, I want 在章节 70% 处遭遇与剧情紧密绑定的「关键抉择」题目, so that 我可以用对核心词汇的准确理解推动剧情发展。
8. As a 用户, I want 在做出正确决策时获得绿色通关反馈与叙事性肯定, so that 我能获得推理成功的自驱成就感。
9. As a 用户, I want 在做错决策时触发 100~150 字的支线汇流剧情, so that 我能在故事发展的逻辑后果中自然体会词义偏差并无感纠错汇回主线。
10. As a 用户, I want 在完成关键抉择后参与「帮 Elena 完成推理记录」的输出填空, so that 进一步巩固核心词汇的拼写与精准辨析（Level C 输出萌芽）。

### 4. 家长端成果与海报分享 (Parent Report & Poster Share)
11. As a 家长（付费决策者）, I want 随时查看孩子英语词汇学习简报, so that 我能清晰看到阅读词汇激活数（Level A+B）、真题迁移正确率以及对比基线诊断的进步幅度。
12. As a 家长, I want 点击「生成分享图片/链接」时获得一张排版精美的学习进展海报长图, so that 我可以保存海报并分享到微信朋友圈展示孩子的学习成效。

### 5. 遗忘曲线复现与调度 (SM-2 Scheduling & Offline Patch)
13. As a 正在按天阅读的用户, I want 曾经学过的旧词根据遗忘曲线在后续章节中以语境词形式自然复现（最多 5 词/章）, so that 我可以在新语境中巩固旧词记忆而不觉得生硬或超载。

---

## Implementation Decisions

### 1. 架构模块划分与接口调整

#### User Auth & Persistence Module
- 前端 `store.ts` 引入 `localStorage` 键值 `curio_auth_token` 与 `curio_user_id`。
- 启动应用时自动读取本地 Token，若存在则调用 `GET /api/user/profile` 恢复 State；不存在则引导至手机号登录框。
- 修改 `packages/db/src/schema.ts` 扩展 `users` 表结构，添加 `phone` 字段（`text('phone').unique()`）。

#### State & API Synchronization Layer
- 在 `useAppStore` 中，将所有修改状态的 Action（`completeOnboarding`, `unlockWord`, `completeChapter1` 等）全面对接 `apiClient.ts`。
- 读写分离：内存 State 保证 UI 无卡顿流畅响应，后台异步 Promise 确保操作落盘 SQLite。

#### Poster Generation Component
- 在 `ParentScreen` 组件中使用 HTML5 `<canvas>` 或 `html2canvas` 节点渲染技术，将学习简报 Dom 结构转化为 Base64 图片 DataURL。
- 弹窗呈现海报预览图，提供「长按或点击保存图片」按钮。

#### Branch Stories Complement (Database Update)
- 执行数据补全更新，为 `content_library` 中的 10 章预置数据填入符合故事圣经标准的 100~150 字完整支线 Markdown 叙事。

### 2. 架构拓扑与契约

```
[Web Client (Vite + React)]
   │
   ├── Token Storage (localStorage)
   └── Zustand App Store
         │
         ├── (Async HTTP / REST)
         ▼
[API Server (Hono Node Service)]
   │
   ├── Auth Controller (/api/auth/login)
   ├── Reading Session Controller (/api/reading/session)
   ├── Scheduler Engine (apps/api/src/scheduler/index.ts)
   └── Report Controller (/api/report/parent)
         │
         ▼
[SQLite DB (data/curio.db via Drizzle ORM)]
   ├── users
   ├── vocab_library (3,500 rows)
   ├── content_library (10 chapters)
   └── user_vocab_state (SM-2 records)
```

---

## Testing Decisions

### 1. 测试接缝与准则
- **最高测试接缝 (Highest Seam)**：使用 API 服务级别的集成测试（`server.fetch(new Request(...))`）验证完整 REST 契约与数据库状态演变。
- **外部行为校验**：测试只针对 HTTP 状态码、JSON 响应体以及 DB 最终落地结果，不侵入测试函数内部实现。

### 2. 覆盖的模块与用例
1. **API Auth & Setup Tests (`apps/api/tests/auth_and_progress.test.ts`)**：
   - 验证手机号登录创建/更新 `users` 记录。
   - 验证静默登录 Profile 获取。
2. **Reading & SM-2 Progress Tests**：
   - 验证提交阅读会话后，`streak` 算子按连续活跃日期递增或归零。
   - 验证词汇答对后 `user_vocab_state` 的 `interval` 与 `next_review_at` 按 SM-2 正确更新。
3. **Parent Report API Test**：
   - 验证 `GET /api/report/parent` 能够根据数据库真实 `correct_count` 正确算出真实迁移准确率。

### 3. 参考的基准测试代码
现有 `apps/api/tests/auth_and_progress.test.ts` 和 `apps/api/tests/sm2.test.ts` 作为标准集成测试参照范本。

---

## Out of Scope

1. **移动端 Native App 开发**：仅限于 Web 响应式端，移动端 App 留待 P3 阶段。
2. **实时在线 LLM 逐人生成**：P1/P2 阶段复现词仅采用离线 AI 批量 Patch 预置方案，不包含在线高并发 LLM 实时整章生成。
3. **第三方 SMS 短信验证码服务挂载**：手机号登录在 P1 测试阶段采用手机号+基础验证模式，暂不接入收费短信网关。

---

## Further Notes

- 项目数据库结构支持通过 `packages/db/src/seed.ts` 进行无损重新播种。
- 成果海报样式需保持高颜值暗黑金色视觉语言，突出「高考核心词汇激活数」与「仿真真题迁移准确率」两个关键利益点。
