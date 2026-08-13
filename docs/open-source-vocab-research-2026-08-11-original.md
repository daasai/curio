# 记单词开源项目调研与 Curio 借鉴分析报告

> 调研时间：2026-08-11 ｜ 分析对象：Curio 项目（AI 沉浸式高考词汇学习产品）
> 报告定位：基于 10 个主流记单词开源项目的调研，结合 Curio 当前架构与产品目标，给出具体的、可落地的技术借鉴方案

---

## 一、Curio 项目概况

### 1.1 产品定位

Curio 是一款面向高中生的 AI 英语词汇沉浸式学习产品，核心差异化在于：

- 将高考 3500 词嵌入**连载悬疑故事**（苍澜市世界观，主角林亦）
- 通过**关键抉择**机制在剧情 70% 处验证词义理解，错误选项对应具体词义误解
- **词汇双轨制**：核心词（承载抉择）+ 语境词（自然复现）
- **双利益方**：学生看故事进度，家长看学习报告
- 当前处于 **P1 受控试点阶段**（5-10 名受邀高中生）

### 1.2 技术栈

| 层 | 技术选型 | 关键文件 |
|---|---------|---------|
| 前端 | React 19 + Vite 5 + Zustand 4.5 | `apps/web/src/App.tsx`、`store.ts` |
| 后端 | Hono 4 + Bun 运行时 | `apps/api/src/server.ts`、`index.ts` |
| 数据库 | SQLite（bun:sqlite）+ Drizzle ORM 0.30 | `packages/db/src/schema.ts` |
| 间隔重复 | SM-2 算法（自实现） | `apps/api/src/scheduler/sm2.ts` |
| 内容生成 | 火山引擎方舟（豆包模型），离线脚本模式 | `scripts/complete-chapters.ts` |
| 部署 | PM2 + Nginx | `ecosystem.config.js` |

### 1.3 当前数据模型

数据库 12 张表，核心表结构：

- **vocab_library**（3500 词）：word, phonetic, pos, meaning_cn, level(1-4), gaokao_frequency, word_family, tags
- **user_vocab_state**（SM-2 调度）：status(unseen→context_word→core_word_tested→mastered), interval, easeFactor(默认2.5), nextReviewAt
- **content_library**（预生成章节）：storyText, vocabHighlights, choices, branchStories, coreWords/newContextWords/reviewWords
- **learning_events**：eventType, payload, occurredAt

### 1.4 分析维度

本报告从以下 5 个维度评估各开源项目的借鉴价值：

1. **数据层** — 词库数据、词典数据的丰富度与可集成性
2. **算法层** — 间隔重复算法的先进性与迁移成本
3. **交互层** — 学习模式、UI 组件、用户体验设计
4. **AI 层** — AI 驱动学习的能力与实现路径
5. **架构层** — 全栈设计、内容生产工作流的参考价值

---

## 二、调研项目总览

共筛选 10 个代表性项目，按定位分类：

| 分类 | 项目 | Stars | 语言 | License | 平台 |
|------|------|-------|------|---------|------|
| 算法引擎 | AnkiDroid | ~24k | Kotlin | Apache-2.0 | Android |
| 桌面应用 | ToastFish | ~6k | C# (.NET) | MIT | Windows |
| 桌面应用 | MuJing (幕境) | — | Kotlin/Rust | Apache-2.0 | Win/macOS |
| 桌面应用 | Enjoy | ~27k | TypeScript | MPL-2.0 | Web/桌面/移动 |
| Web 应用 | Qwerty Learner | ~16k | TypeScript | GPL | Web/桌面 |
| Web 应用 | TypeWords | ~5.9k | TypeScript (Vue/Nuxt) | GPL-3.0 | Web/小程序 |
| Web 应用 | remix-words-funny | ~920 | TypeScript (Remix) | — | Web |
| Web 应用 | WordPecker | — | TypeScript | — | Web |
| 移动端 | Memo | — | Dart (Flutter) | — | 移动端 |
| 词库数据 | ECDICT | ~2.4k | Python | MIT | 数据库 |

---

## 三、逐项借鉴分析

### 3.1 ECDICT — 词库数据增强

> 仓库：`skywind3000/ECDICT` ｜ Stars: ~2.4k ｜ License: MIT ｜ 76 万词条

#### 与 Curio 的关系

ECDICT 是中文背单词生态的数据基石。Curio 的 `vocab_library` 表当前只有 7 个字段，数据维度有限。ECDICT 可以直接丰富 Curio 的词汇数据层。

#### 具体借鉴项

| ECDICT 字段 | Curio 现状 | 借鉴价值 | 落地方式 |
|-------------|-----------|---------|---------|
| `bnc_freq` / `collins_freq` | 仅有 `gaokao_frequency`(high/medium/low) | 更精确的难度分级 | 用语料词频交叉验证 level 1-4 分级 |
| `sw` (词形变化) | `word_family` 字段为空 | 自动填充词族 | 脚本批量回填，支撑核心词形态变化测验 |
| `tag` (语义标签) | `tags` 字段为空 | 按主题匹配故事场景 | 提升 Level 3 嵌入质量——故事生成时按 tag 选择词汇 |
| `exchange` (词形交换) | 无 | 丰富测验维度 | 关键抉择可增加词形变化选项 |
| 例句数据 | 无（依赖 AI 生成故事） | 词汇本卡片辅助语境 | `vocab-scene-card` 展示 ECDICT 例句 |

#### 落地路径

```
1. 下载 ECDICT CSV (ecdict.csv)
2. 写脚本：scripts/enrich-vocab-from-ecdict.ts
   - 读取 data/curio_gaokao_vocabulary.csv 的 3500 词
   - 从 ECDICT CSV 中匹配对应条目
   - 回填 word_family, tags, 补充 phonetic 缺失值
3. 更新 packages/db/src/seed.ts，支持新字段导入
4. 运行 db:seed 重新灌入增强后的数据
```

**预估工作量**：1-2 天 ｜ **风险**：低（MIT 协议，纯数据增强）

---

### 3.2 MuJing (幕境) — 语境学习方法论参考

> 仓库：`tangshimin/MuJing` ｜ 语言: Kotlin/Rust ｜ License: Apache-2.0

#### 与 Curio 的关系

MuJing 与 Curio 在**理念上最接近**——都强调「真实语境」而非孤立背词。虽然技术栈不同，但设计思路高度可迁移。

#### 具体借鉴项

**① FSRS 算法替换 SM-2（最高价值）**

Curio 当前 SM-2 实现（`apps/api/src/scheduler/sm2.ts`）：

```typescript
// 当前：SM-2 的固定公式
let nextEaseFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
// 间隔规则：q>=3 递增（0→1天, 1→3天, 其他→prev*EF），q<3 重置为 1天
```

MuJing 采用的 **FSRS（Free Spaced Repetition Scheduler）** 是 SM-2 的下一代算法：
- 基于记忆稳定性模型，而非固定公式
- 根据用户历史记忆表现预测最优复习时机
- 复习效率比 SM-2 提升约 30%

Curio 的 `user_vocab_state` 表已有 `easeFactor`、`interval`、`nextReviewAt` 字段，迁移到 FSRS 只需：
- 替换 `calculateSM2()` 为 `calculateFSRS()`
- 新增 `stability`、`retrievability` 字段
- `recordVocabInteraction()` 的 quality 映射调整为 FSRS 的 4 级评级

**参考实现**：[open-spaced-repetition/fsrs4anki](https://github.com/open-spaced-repetition) 提供 TypeScript 实现。

**② 词库链接功能**

MuJing 支持跨来源关联同一词汇。Curio 可借鉴：在 `content_library` 中增加跨章节词汇出现追踪，让学生看到「这个词在第 3 章首次出现，第 7 章复现，第 12 章成为核心词」的完整路径。

**③ 多样化练习模式**

MuJing 的字幕抄写 + 听写测试 + 100LS 跟读训练，启示 Curio 在「读故事 + 选择题」之外增加轻量练习模式。

**④ Whisper 自动字幕**

MuJing 集成 Whisper 生成字幕的思路，可参考用于 Curio 的故事内容 QA——用 ASR 验证故事文本的朗读流畅度。

#### 落地路径

```
FSRS 迁移（P1 优先级）：
1. 在 packages/db/src/schema.ts 的 userVocabState 表添加：
   - stability: real('stability')
   - difficulty: real('difficulty')
2. 新建 apps/api/src/scheduler/fsrs.ts，实现 FSRS 核心
3. 替换 scheduler/index.ts 中对 calculateSM2 的调用
4. 编写迁移脚本：scripts/migrate-sm2-to-fsrs.ts
5. 更新测试：apps/api/tests/sm2.test.ts → fsrs.test.ts
```

**预估工作量**：2-3 天 ｜ **风险**：中（需数据迁移，但字段兼容）

---

### 3.3 Qwerty Learner — 交互设计与 UX 模式

> 仓库：`RealKai42/qwerty-learner` ｜ Stars: ~16k ｜ 语言: TypeScript (React + Vite + Tauri)

#### 与 Curio 的关系

同为 React + Vite 技术栈，组件设计和 UX 模式可直接参考源码。Qwerty Learner 的极简设计和「肌肉记忆」理念对 Curio 的词汇本和练习模式有直接参考价值。

#### 具体借鉴项

| Qwerty Learner 设计 | Curio 应用场景 | 实现建议 | 参考源码位置 |
|--------------------|--------------|---------|-------------|
| **错词强制重输** | 关键抉择答错后，支线汇流结尾增加「输入核心词」环节 | `choiceState === 'wrong-branch'` 后追加输入验证 | `src/components/Review.tsx` |
| **音标即时显示 + 英美发音切换** | 词汇本卡片当前无发音按钮 | `vocab-scene-card` 添加发音按钮，复用现有有道 CDN | `src/components/Speaker.tsx` |
| **词库进度可视化** | 首页学习档案增强 | 当前 `profile-vocab-count` 只有数字，可增加进度环 | `src/components/Dictionary.tsx` |
| **极简阅读模式** | 阅读器界面净化 | 进一步移除 `reader-body` 中的非必要元素 | 整体设计语言 |
| **快捷键支持** | 桌面端体验 | 方向键翻页、空格选择 | `src/hooks/useKeyboard.ts` |

#### 组件级参考

Qwerty Learner 的发音组件是现成的 React 实现，可直接参考其 API 设计：

```typescript
// 参考 Qwerty Learner 的 Speaker 组件设计
// Curio 的 vocab-scene-card 中添加：
<button className="vocab-pronounce-btn" onClick={() => speak(word)}>
  <SpeakerIcon />
</button>
// 复用 Curio 现有的有道 CDN：dict.youdao.com/dictvoice
```

**预估工作量**：发音按钮半天 ｜ 错词重输 1 天 ｜ **风险**：低

---

### 3.4 TypeWords — 练习模式多样化

> 仓库：`zyronon/TypeWords` ｜ Stars: ~5.9k ｜ 语言: TypeScript (Vue → Nuxt)

#### 与 Curio 的关系

Curio 目前学习模式单一（读故事 → 选择题），TypeWords 的 4 种模式设计直接可迁移。

#### 具体借鉴项

| TypeWords 模式 | Curio 适配方案 | 产品价值 | 技术路径 |
|---------------|--------------|---------|---------|
| **跟打模式** | 故事正文高亮词跟打，强化拼写记忆 | 补充当前仅有「阅读理解」的维度 | 新增 `practice` screen，复用 story-content |
| **辨认模式** | 给出中文释义，从 4 个英文词中选正确 | 轻量化练习，适合碎片时间 | 复用 `choice-section` 组件结构 |
| **复习模式** | 按记忆曲线推送到期词汇 | 与 SM-2/FSRS 调度器直接对接 | 从 `user_vocab_state` 取 `nextReviewAt <= today` 的词 |
| **默写模式** | 给释义，输入英文词 | 最高难度验证，可替代关键抉择作为升级考核 | 输入框 + 对比逻辑 |

#### 落地路径

```
1. 在 apps/web/src/App.tsx 新增 'practice' screen 状态
2. 在 store.ts 添加 practice 相关 state（mode, currentWord, results）
3. 新增 apps/web/src/components/Practice/
   - FollowType.tsx    （跟打模式）
   - Recognition.tsx    （辨认模式）
   - Review.tsx         （复习模式）
   - Dictation.tsx      （默写模式）
4. 练习数据通过现有 learning_events API 记录
5. 复用 recordVocabInteraction() 更新词汇状态
```

**预估工作量**：3-5 天 ｜ **风险**：低（新增功能，不影响现有流程）

---

### 3.5 Anki/AnkiDroid — 间隔重复算法生态与数据可视化

> 仓库：`ankidroid/Anki-Android` ｜ Stars: ~24k ｜ License: Apache-2.0

#### 与 Curio 的关系

Curio 已实现 SM-2，Anki 生态的以下方面值得参考：

#### 具体借鉴项

**① 家长报告数据可视化**

当前 Curio 家长报告（`index.html` 的 `#parent-screen`）只有 3 个数字指标：

```html
<div class="report-stat-num" id="parent-stat-words">--</div>
<div class="report-stat-num" id="parent-stat-accuracy">--</div>
<div class="report-stat-num" id="parent-stat-improvement">--</div>
```

Anki Stats 页面的可视化设计可大幅提升家长端的「效果可见感」：

| Anki Stats 设计 | Curio 家长报告增强 | 实现建议 |
|----------------|-------------------|---------|
| 30 天学习热力图 | 展示每日学习量分布 | SVG 热力图，从 `learning_events` 聚合 |
| 遗忘曲线预测图 | 展示词汇记忆衰减趋势 | 从 `user_vocab_state` 的 interval/easeFactor 计算 |
| 各难度级别掌握分布饼图 | 展示 level 1-4 的掌握比例 | 从 `vocabLibrary.level` + `userVocabState.status` 聚合 |
| 预习/复习/学习比例图 | 展示新词 vs 复习词比例 | 从 `learning_events` 的 eventType 分布 |

**② 卡片内容多模态**

Anki 支持文本、图片、音频、视频、LaTeX。Curio 的 `content_library.vocabHighlights` 当前是文本高亮坐标，未来可扩展为多媒体标注。

**③ 牌组共享机制**

Anki 的 6000+ 预制牌组共享生态启示 Curio：未来可让教师/学校发布自定义故事线（`storylineId` 字段已预留）。

**预估工作量**：热力图 2 天 ｜ **风险**：低

---

### 3.6 Enjoy — AI 驱动学习体验

> 仓库：`ZuodaoTech/everyone-can-use-english` ｜ Stars: ~27k ｜ License: MPL-2.0

#### 与 Curio 的关系

Enjoy 的 AI 驱动方向是 Curio 未来 P2+ 阶段最值得参考的。两者都是 TypeScript 技术栈。

#### 具体借鉴项

| Enjoy 能力 | Curio 应用场景 | 技术路径 |
|-----------|--------------|---------|
| **AI 语音评测** | 关键抉择前的朗读环节 | 接入火山引擎 ASR + 评分 API，复用 `LLM_API_KEY` |
| **翻译教练** | 词汇本中的 AI 例句生成 | 用现有 `scripts/complete-chapters.ts` 的 `callLLM()` |
| **AI 个性化内容** | P3 阶段：从固定章节 → 个性化故事生成 | 基于用户 `user_vocab_state` 动态选择词汇组合，调用 LLM 实时生成 |
| **1000 小时训练计划** | 「叙事化 Streak」升级为多阶段训练计划 | 将 streak 从天数扩展为阶段目标（侦探新手→侦探→首席侦探） |

**预估工作量**：AI 例句生成 2 天 ｜ 语音评测 5-7 天 ｜ 个性化生成 1-2 周

---

### 3.7 WordPecker — AI 对话式学习

> 仓库：`baturyilmaz/wordpecker-app` ｜ 语言: TypeScript

#### 与 Curio 的关系

WordPecker 的 AI 语音智能体对话模式对 Curio 的启发在于**划词学习**的交互设计。

#### 具体借鉴项

**最有价值的设计：叙事化 AI 划词对话**

用户阅读故事时，点击高亮词不仅查看词义，还可以触发一个轻量 AI 对话——以故事角色的身份解释词义：

> 用户点击 "ambiguous" → AI 角色（林亦）说：
> "你遇到了 'ambiguous' 这个词。在我父亲的信中，有一句措辞非常 ambiguous，让我犹豫了很久。它的意思是'模糊的、有歧义的'——就像那个夜晚的雾色，让我看不清真相。"

这比当前的静态词义提示更有沉浸感，且与 Curio 的叙事核心完全一致。

**技术路径**：复用 `scripts/complete-chapters.ts` 的 `callLLM()` 函数，传入当前章节上下文 + 词汇 + 角色设定，生成角色化的词义解释。

**预估工作量**：3-5 天 ｜ **风险**：中（需控制 LLM 调用成本）

---

### 3.8 remix-words-funny — 全栈架构参考

> 仓库：`SteveSuv/remix-words-funny` ｜ Stars: ~920 ｜ 语言: TypeScript (Remix + T3 Stack)

#### 与 Curio 的关系

Curio 已有成熟的 monorepo 架构，但 remix-words-funny 的 152,543 词大词库设计有参考价值：如果未来扩展到四六级/考研/雅思，可参考其词库索引设计。

**借鉴价值**：低（Curio 当前 3500 词规模，SQLite 完全够用，暂无扩展需求）

---

### 3.9 ToastFish — 场景化设计启发

> 仓库：`Uahh/ToastFish` ｜ Stars: ~6k ｜ 语言: C# (.NET) ｜ 已停更

#### 与 Curio 的关系

技术栈不同（C# vs TypeScript），但其「摸鱼背单词」的场景化思路有启发：Curio 的差异化定位本身就是「场景化学习」（悬疑故事），ToastFish 验证了「特定场景嵌入」的产品方向可行性。

**借鉴价值**：理念参考，无直接技术借鉴

---

### 3.10 Memo — 移动端参考

> 仓库：`olmps/memo` ｜ 语言: Dart (Flutter) ｜ 已停更

#### 与 Curio 的关系

Memo 面向程序员、Flutter 跨平台。如果 Curio 未来做移动端，Flutter 是可选方案之一，但当前 P1 阶段 Web 优先，暂无借鉴需求。

**借鉴价值**：低（移动端 P3+ 才考虑）

---

## 四、横向对比分析

### 4.1 借鉴价值矩阵

按「对 Curio 的价值」和「迁移成本」两个维度评估：

| 项目 | 借鉴价值 | 迁移成本 | 优先级 | 核心借鉴点 |
|------|---------|---------|--------|-----------|
| **ECDICT** | ★★★★★ | ★☆☆☆☆ | P0 | 词库数据回填 |
| **MuJing** | ★★★★★ | ★★★☆☆ | P1 | FSRS 算法替换 |
| **Qwerty Learner** | ★★★★☆ | ★★☆☆☆ | P0-P1 | 发音组件、错词重输 |
| **TypeWords** | ★★★★☆ | ★★☆☆☆ | P1 | 4 种练习模式 |
| **Anki** | ★★★☆☆ | ★★☆☆☆ | P1 | 家长报告数据可视化 |
| **Enjoy** | ★★★★☆ | ★★★★☆ | P2-P3 | AI 语音评测、个性化生成 |
| **WordPecker** | ★★★☆☆ | ★★★☆☆ | P2 | AI 划词对话 |
| remix-words-funny | ★★☆☆☆ | — | — | 大词库架构参考 |
| ToastFish | ★☆☆☆☆ | — | — | 场景化设计理念 |
| Memo | ★☆☆☆☆ | — | — | 移动端参考 |

### 4.2 技术栈契合度

| 技术栈 | 项目 | 与 Curio 的契合度 |
|--------|------|------------------|
| TypeScript / React | Qwerty Learner | 极高（可直接参考源码） |
| TypeScript / Vue | TypeWords | 高（设计可迁移，代码需转换） |
| TypeScript / Remix | remix-words-funny | 中（架构不同但模式可参考） |
| TypeScript | Enjoy, WordPecker | 高（API 调用模式可参考） |
| Kotlin / Rust | MuJing | 低（仅方法论可迁移） |
| Python | ECDICT | 低（仅数据可使用） |
| C# / Dart | ToastFish, Memo | 无（仅理念参考） |

### 4.3 关键趋势与 Curio 的位置

调研发现的 6 个趋势，对照 Curio 的定位：

| 趋势 | Curio 当前状态 | 启示 |
|------|--------------|------|
| AI 融合成主流 | 有 AI 内容生成（离线脚本） | P3 应走向实时 AI 个性化 |
| 打字 + 记忆双效 | 无打字模式 | 可引入轻量打字练习 |
| 场景化学习兴起 | 核心优势（悬疑故事） | 继续深化叙事差异化 |
| SRS 仍是底层共识 | 已实现 SM-2 | 应升级到 FSRS |
| ECDICT 是数据基石 | 未使用 ECDICT | P0 优先回填 |
| 全栈 Web 为主流 | 已是 Web 优先 | 方向正确 |

---

## 五、实施优先级与路线图

### 5.1 P0 — 立即可做（1-2 周）

| 序号 | 借鉴项 | 来源 | 工作量 | 预期收益 |
|------|-------|------|--------|---------|
| 1 | ECDICT 词库数据回填 | ECDICT | 1-2 天 | 数据质量基础提升，word_family/tags 填充 |
| 2 | 词汇本增加发音按钮 | Qwerty Learner | 半天 | 体验补全，复用有道 CDN |
| 3 | 错词强制重输 | Qwerty Learner | 1 天 | 关键抉择答错后记忆强化 |

### 5.2 P1 — 近期计划（2-4 周）

| 序号 | 借鉴项 | 来源 | 工作量 | 预期收益 |
|------|-------|------|--------|---------|
| 4 | SM-2 → FSRS 算法升级 | MuJing / Anki 生态 | 2-3 天 | 复习效率提升 30%+ |
| 5 | 练习模式扩展（辨认/默写） | TypeWords | 3-5 天 | 学习维度丰富 |
| 6 | 家长报告增加热力图/曲线图 | Anki Stats | 2 天 | 家长端价值感提升 |

### 5.3 P2 — 中期计划（1-2 月）

| 序号 | 借鉴项 | 来源 | 工作量 | 预期收益 |
|------|-------|------|--------|---------|
| 7 | AI 划词对话（叙事化提示） | WordPecker | 3-5 天 | 沉浸感差异化 |
| 8 | AI 例句生成 | Enjoy | 2 天 | 词汇本内容丰富 |
| 9 | 叙事化 Streak 升级为多阶段 | Enjoy | 2 天 | 长期动力系统 |

### 5.4 P3 — 远期计划（3+ 月）

| 序号 | 借鉴项 | 来源 | 工作量 | 预期收益 |
|------|-------|------|--------|---------|
| 10 | AI 语音评测/跟读 | Enjoy | 5-7 天 | 口语维度扩展 |
| 11 | 个性化实时故事生成 | Enjoy + MuJing | 1-2 周 | P3 核心差异化 |
| 12 | 教师自定义故事线发布 | Anki 牌组共享 | 1-2 周 | B 端市场扩展 |

### 5.5 路线图时间线

```
2026 Q3                          2026 Q4                          2027 Q1
─────────────────────────────────────────────────────────────────────────
P0: 数据增强 + 体验补全           P2: AI 能力扩展                   P3: 个性化与生态
├─ ECDICT 回填                   ├─ AI 划词对话                    ├─ AI 语音评测
├─ 发音按钮                       ├─ AI 例句生成                    ├─ 实时故事生成
└─ 错词重输                       └─ 多阶段训练计划                 └─ 教师故事线发布

P1: 算法升级 + 模式扩展
├─ FSRS 替换 SM-2
├─ 4 种练习模式
└─ 家长报告可视化
```

---

## 六、技术资源清单

可直接引入或参考的具体资源：

| 资源 | 来源 | 协议 | 用途 |
|------|------|------|------|
| ECDICT CSV 数据 | `skywind3000/ECDICT` | MIT | 词库数据回填 |
| FSRS TypeScript 实现 | `open-spaced-repetition/fsrs4anki` | AGPL-3.0 | 算法参考（需注意协议） |
| Qwerty Learner 发音组件 | `RealKai42/qwerty-learner` `src/components/` | GPL | 组件设计参考 |
| Anki 热力图插件 | Anki 社区插件 | — | 可视化设计参考 |
| TypeWords 练习模式 | `zyronon/TypeWords` | GPL-3.0 | 模式设计参考 |
| Enjoy AI 集成模式 | `ZuodaoTech/everyone-can-use-english` | MPL-2.0 | AI 调用参考 |

> **协议注意**：GPL/AGPL 项目仅参考设计思路，不直接引入代码。MIT/Apache-2.0 项目可直接使用数据和代码。MPL-2.0 项目需注意文件级 copyleft 义务。

---

## 七、总结

Curio 的核心差异化在于「叙事化语境学习 + 关键抉择机制」，这在调研的 10 个项目中是独特的。借鉴方向应聚焦于**强化而非稀释**这一差异化：

1. **数据层（ECDICT）**：丰富词汇数据，让 Level 3 嵌入更精准
2. **算法层（FSRS）**：让复习调度更科学，但不改变「故事中复现」的核心形式
3. **交互层（Qwerty Learner / TypeWords）**：增加轻量练习模式，补充「读故事」之外的学习维度
4. **AI 层（Enjoy / WordPecker）**：未来走向个性化生成，让每个学生有专属故事
5. **可视化层（Anki Stats）**：让家长端从「数字」升级为「图表」，提升付费决策信心

最值得立即行动的三件事：
- **ECDICT 回填** — 1-2 天，数据是所有功能的基础
- **发音按钮** — 半天，体验补全的最低成本
- **FSRS 升级** — 2-3 天，算法层最大 ROI

---

*本报告基于公开开源项目信息与 Curio 项目代码分析整理。Stars 数据可能存在时间偏差，建议访问对应 GitHub 仓库获取最新数据。*
