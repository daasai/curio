# 《记单词开源项目调研》复核报告

> 复核对象：[`open-source-vocab-research.md`](./open-source-vocab-research.md)  
> 复核日期：2026-08-13  
> 证据口径：开源项目官方仓库、README、License 与 Curio 当前源码/SQLite；Stars 仅作当日快照，不作为选型依据。

## 一、结论

原报告可作为**产品灵感清单**，但不宜直接作为研发路线图。10 个项目本身大多真实，若干交互方向也值得参考；然而报告存在会改变优先级的事实错误：许可证错报、项目能力错归因、ECDICT 字段误读、Curio 当前状态过时，以及把产品设想和工期写成已经由竞品证明的结论。

建议撤回原报告的三项“立即行动”：

1. **ECDICT 全量回填**：Curio 当前 3500 词中 `tags` 已覆盖 3500 条，`word_family` 已有 189 条；应先做来源与缺口审计，不能按“字段为空”重新灌库。
2. **新增发音按钮**：当前 React 页面已经有 UK/US 发音入口和 Web Speech 降级，不是待开发功能。
3. **2–3 天直接迁移 FSRS**：FSRS 值得实验，但 Curio 当前主要是二元行为映射，尚缺完整的四级评分、卡片状态与可训练复习历史；应先定义实验和数据合同。

## 二、关键事实复核

| 原报告结论 | 复核结果 | 证据与修正 |
|---|---|---|
| ECDICT 约 2.4k Stars、76 万词条 | **需修正** | 官方仓库当前约 7.7k Stars；README 历史记录写明 2017 年版本已收词 222 万。规模会随数据版本变化，报告应固定 commit/release，而不是写无来源的 76 万。[ECDICT](https://github.com/skywind3000/ECDICT) |
| ECDICT 有 `bnc_freq` / `collins_freq` | **错误** | 官方字段名是 `bnc`、`frq`、`collins`，不存在报告所写两个字段名。[ECDICT 数据格式](https://github.com/skywind3000/ECDICT#%E6%95%B0%E6%8D%AE%E6%A0%BC%E5%BC%8F) |
| `sw` 是词形变化，可回填 `word_family` | **错误** | `sw` 是去除非字母数字后的模糊匹配键；词形变化在 `exchange`，二者不能混用。[ECDICT 模糊匹配](https://github.com/skywind3000/ECDICT#%E6%A8%A1%E7%B3%8A%E5%8C%B9%E9%85%8D) |
| `tag` 是故事主题语义标签 | **错误** | 官方说明中的 `tag` 是中考、高考、四六级、雅思等考试/词表标签，不是人物、场景或语义主题标签。
| ECDICT 可直接提供例句 | **不成立** | 官方字段表把 `detail` 中的例句标为“待添加”。必须先检查实际选定数据版本的覆盖率和授权来源，不能把字段存在等同于内容可用。
| ECDICT 是 MIT，因此数据可无条件直接使用 | **证据不足** | 仓库是 MIT，但词典聚合数据还涉及上游来源与可追溯性。对商业产品应保留具体数据版本、来源清单和归属审计；“低风险”不能仅由仓库 License 推导。
| MuJing 是 Apache-2.0，并采用 FSRS | **错误/未证实** | 当前仓库标注 GPL-3.0；官方 README 能确认真实影视/文档语境、字幕抄写、听写和词库链接，但未证明其采用 FSRS。[MuJing](https://github.com/tangshimin/MuJing) |
| MuJing 有“100LS 跟读”和 Whisper，可用于 ASR QA | **未确认** | 当前官方 README 能确认跟读、字幕与视频能力，但原报告没有给出 100LS、Whisper 集成的源码或文档位置。即使存在 ASR，也不能推出“ASR 可验证文本朗读流畅度”这一测量有效性结论。
| FSRS TypeScript 实现是 `fsrs4anki`，AGPL-3.0 | **错误** | 面向 TypeScript 的实现是 [`open-spaced-repetition/ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)，当前为 MIT；`fsrs4anki` 也是 MIT，且是 Anki 调度器/优化器项目，不是报告所述 AGPL TypeScript 包。[fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki) |
| FSRS 迁移只需替换函数和增加两个字段 | **严重低估** | `ts-fsrs` 明确包含 card 状态、四级 Rating、review log、desired retention，并将参数训练放在独立 optimizer/binding 中。Curio 还需事件语义、历史迁移、时区、短期学习步骤、回滚及 A/B 指标设计。[ts-fsrs README](https://github.com/open-spaced-repetition/ts-fsrs#basic-usage) |
| FSRS “效率提升约 30%”可作为 Curio 收益 | **需限定** | FSRS 社区材料声称在相同保持率下可减少约 20–30% 复习，但这是特定数据与比较口径的结果，不能直接外推为 Curio 的 30% 学习效率提升，更不能写成排期收益。[ABC of FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS) |
| Qwerty Learner 约 16k Stars，GPL | **部分过时** | 当前约 22.8k Stars，GPL-3.0；错词重输、音标/发音、默写和速度/正确率可由 README 确认。[Qwerty Learner](https://github.com/RealKai42/qwerty-learner) |
| 可直接参考 `Review.tsx`、`Speaker.tsx`、`Dictionary.tsx`、`useKeyboard.ts` | **未确认** | 原报告未提供固定 commit，列出的具体路径未被官方 README 支持。采用代码前必须以固定 commit 重新定位，并遵守 GPL；不能凭组件名推定存在。
| TypeWords 有“跟打/辨认/复习/默写”四模式 | **部分错误** | 官方列出的词练习模式是跟打、听写、自测、默写，并另有智能模式/自由模式。原报告把它重新解释成“辨认、按 SRS 复习”等 Curio 方案，属于产品提案而非项目事实。[TypeWords](https://github.com/zyronon/TypeWords) |
| AnkiDroid 约 24k Stars、Apache-2.0 | **错误** | 当前官方仓库约 11.5k Stars，许可证为 GPL-3.0。Anki/AnkiDroid 与共享牌组、统计、FSRS 的事实还应分别引用，不应混为一个项目。[AnkiDroid](https://github.com/ankidroid/Anki-Android) |
| Anki 有“6000+ 预制牌组”，可证明教师故事线方向 | **未确认且推论过度** | 原报告未给一手统计来源。共享牌组只能证明内容分发机制存在，不能证明教师发布 Curio 故事线的需求、合规性或商业价值。
| Enjoy 为 MPL-2.0、约 27k Stars | **错误/过时** | `everyone-can-use-english` 当前约 34.5k Stars，许可证为 GPL-3.0；仓库同时含图书、1000 小时材料和 Enjoy 代码，不能把当前线上产品全部能力默认归入可复用源码。[Enjoy 仓库](https://github.com/ZuodaoTech/everyone-can-use-english) |
| 火山引擎 ASR 可复用 `LLM_API_KEY` | **错误且有安全风险** | ASR、语音评分和 LLM 通常是不同产品、endpoint 与授权范围，必须按官方服务单独验证。Curio 的离线脚本还存在凭证回退写入源码的问题；在继续任何 AI 集成前，应先移除并轮换凭证。本文不记录凭证值。
| WordPecker 是无许可证项目，核心是 AI 语音智能体 | **错误/错焦** | 当前仓库是 MIT，README 主要证明自建词表、测验和 LLM 生成课程；“叙事化角色划词对话”是 Curio 自己的产品构想，不是 WordPecker 已验证能力。[WordPecker](https://github.com/baturyilmaz/wordpecker-app) |
| remix-words-funny 是 Remix + T3、152,543 词 | **部分过时/未确认** | 当前仓库描述为 React Router v7 + tRPC + Drizzle + PostgreSQL 等；152,543 词未在仓库首页得到一手确认。若要借鉴索引，必须先定位真实数据模型与固定 commit。[remix-words-funny](https://github.com/SteveSuv/remix-words-funny) |
| Memo 无许可证、只作低价值移动端参考 | **错误/评价不足** | Memo 是 BSD-3-Clause 的 Flutter SRS，官方 README 说明目标构建为 Android/iOS。它可用于移动架构参考，但“已停更”和优先级应以 commit/release 时间及 Curio 需求判断。[Memo](https://github.com/olmps/memo) |
| ToastFish 已停更，证明“场景嵌入”方向可行 | **证据不足** | MIT、Windows 通知栏、自定义词表等事实可确认；“已停更”需给截止日期，“证明产品方向可行”则需要用户、留存或效果数据，Stars 和项目存在本身不构成验证。[ToastFish](https://github.com/Uahh/ToastFish) |

## 三、Curio 基线复核

以下为 2026-08-13 对当前 `/Users/shawn/Nexus/Curio` 的只读核查：

- 技术栈、12 张业务表、3500 词和自实现 SM-2 基本属实；`vocab_library` 实际有 **8 个**字段，不是“只有 7 个字段”。见 [`schema.ts`](../packages/db/src/schema.ts)。
- 当前 SQLite 中 `tags` 为 **3500/3500**，非空 `word_family` 为 **189/3500**。原报告“二者为空”“未使用 ECDICT”的判断没有做来源追踪，不能成立。
- 当前词汇本已经提供 UK/US 发音，使用有道语音 URL并在失败时降级到 Web Speech。见 [`App.tsx`](../apps/web/src/App.tsx)。因此“新增发音按钮”不是需求。
- 当前家长报告并非仅有原报告引用的 3 个旧静态指标；React 页面已经使用真实报告接口展示有效学习天数、章节数、查词数及两类正确率。报告引用了根目录旧 `index.html`，没有以当前 React 实现为准。
- `content_library` 当前有 20 条版本记录；产品范围仍为 10 个章节。统计时必须区分“章节版本行数”和“唯一章节数”。
- `scripts/complete-chapters.ts` 是离线脚本，其 `callLLM()` 不能直接在 Web 请求链路中复用；实时 AI 功能需要服务端接口、权限、限流、未成年人数据边界、成本与内容安全设计。

## 四、建议后的优先级

### P0：先修证据和安全边界

1. 移除源码中的凭证回退并轮换已暴露凭证；为不同 AI 服务建立独立授权与环境变量。
2. 为现有 3500 词生成来源审计：每个字段的来源、许可证/归属、覆盖率、冲突规则和质量门禁。
3. 将原调研表改为“项目事实 / Curio 当前事实 / 产品假设 / 待验证收益”四列，并为每项固定仓库 commit 与核查日期。

### P1：做小实验，不先做平台级迁移

1. **FSRS 可行性实验**：先保留 SM-2；定义 Again/Hard/Good/Easy 或等价行为、完整 review log、目标保持率和对照指标，再用 `ts-fsrs` 做离线回放。没有足够历史时用默认参数不等于已获得个性化收益。
2. **练习模式实验**：只选一种与 Curio 核心假设互补的主动回忆任务（例如核心词拼写），用 5–10 人试点验证完成率、挫败率和次日保持，不一次开发四种模式。
3. **家长报告实验**：先验证家长真正需要的判断问题和数据定义，再决定热力图或曲线；图表数量不等于付费价值。

### 暂不进入排期

- 实时角色化 AI 划词对话、实时个性化故事、语音评分、教师故事线市场。它们都属于新的产品假设，尚未被本次开源项目事实验证，并会显著扩大安全、成本、内容与未成年人合规范围。

## 五、最终判断

原报告中可保留的高置信方向是：真实语境、多次主动回忆、可解释的复习调度、学习过程可视化。不能保留为事实或承诺的是：ECDICT 可直接补齐词族/语义标签/例句、MuJing 已验证 FSRS、FSRS 可在 2–3 天替换并带来 30%+ 收益、Curio 尚无发音、以及 AI/教师生态的工期和商业收益。

后续若要重写原报告，建议保留本复核稿作为审计记录，另建新版本，不覆盖原文。
