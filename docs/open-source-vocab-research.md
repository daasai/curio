# 记单词开源项目调研与 Curio 借鉴分析报告（复核修订版）

> 修订日期：2026-08-13  
> 分析对象：Curio（面向高中生的叙事化高考词汇学习产品）  
> 证据口径：开源项目官方仓库、README、License，以及 Curio 当前源码和 SQLite 数据  
> 版本关系：本版替代 2026-08-11 初稿；[初稿归档](./open-source-vocab-research-2026-08-11-original.md)与[逐项复核记录](./open-source-vocab-research-review.md)保留供追溯

---

## 一、执行结论

开源项目能够为 Curio 提供三类有效输入：

1. **已验证的产品机制**：真实语境、主动回忆、听写/拼写、间隔重复、学习过程统计。
2. **可复用的技术资源**：ECDICT 的词频与词形字段、MIT 协议的 `ts-fsrs`、若干开源项目的交互实现。
3. **待验证的 Curio 产品假设**：把主动回忆嵌入悬疑故事、用家长报告辅助判断、角色化 AI 解释等。

本次复核后，不再把以下事项列为“立即开发”：

- 不重新做“ECDICT 全量回填”。P0-B 已完成真实来源与缺口审计：`word_family` 当前 189 条非空，另有 118 个机器候选和 40 个需人工复核词头；候选未写回词库。
- 不开发“发音按钮”。当前词汇本已经有 UK/US 发音和 Web Speech 降级。
- 不直接把 SM-2 替换成 FSRS。先补齐评分、复习日志和实验指标，再做离线回放与小规模对照。
- 不把实时 AI 对话、语音评分、个性化故事和教师内容市场纳入近期排期。它们是新产品假设，不是本次开源调研已经验证的需求。

修订后的优先级是：

| 优先级 | 动作 | 目的 |
|---|---|---|
| P0 | 移除源码凭证回退并轮换已暴露凭证 | 先消除真实安全风险 |
| P0 | 建立 3500 词逐字段来源、覆盖率和冲突审计 | 决定 ECDICT 还需补什么，而不是先灌数据 |
| P1 | 定义 FSRS 实验所需的评分与 review log | 验证是否值得迁移 |
| P1 | 只试一种主动回忆任务 | 用受控试点验证学习价值和挫败成本 |
| P1 | 先访谈家长的判断问题，再选择报告图表 | 避免用“更多图表”代替价值验证 |

---

## 二、事实、推断与提案的边界

本文使用以下标签：

- **已确认事实**：能由项目官方仓库、License、Curio 当前代码或数据库直接验证。
- **合理推断**：从事实推导，但还没有 Curio 用户数据验证。
- **产品提案**：可能值得尝试的方案，不代表竞品已经证明其有效。
- **待验证**：需要用户实验、来源审计、法律审查或技术原型才能判断。

开源项目“存在某功能”只能证明该功能可以被实现，不能自动证明：

- 它能提升 Curio 的学习效果或留存；
- 它适合 5–10 名高中生受控试点；
- 它能带来家长付费；
- 它能在原报告估算的天数内完成；
- 它的代码或数据可以无条件用于商业产品。

Stars 是易变的热度信号，不再用于排序。技术选型优先看：功能证据、许可证、维护状态、接口边界、与 Curio 核心假设的关系，以及最小验证成本。

---

## 三、Curio 当前基线

### 3.1 产品与阶段

**已确认事实**：Curio 当前仍是 5–10 人受控试点，核心闭环为：

- 高考 3500 词；
- 《苍澜迷雾》单条悬疑主线；
- 核心词与语境词双轨；
- 关键抉择、错误支线和近义辨析；
- 学生进度、词汇本和本地可导出的家长报告。

实时逐人生成故事、公开注册、独立家长账号和教师内容市场不属于当前试点范围。

### 3.2 技术与数据

| 项目 | 当前事实 | 证据 |
|---|---|---|
| 前端 | React 19、Vite 5、Zustand 4.5 | `apps/web/package.json` |
| 后端 | Hono 4、Bun | `apps/api/package.json`、`apps/api/src/server.ts` |
| 数据 | SQLite、Drizzle ORM 0.30、12 张业务表 | `packages/db/src/schema.ts` |
| 词库 | 3500 词；8 个基础字段 | `data/curio_gaokao_vocabulary.csv`、`vocab_library` |
| 词族与标签 | `word_family` 非空 189 条；`tags` 非空 3500 条 | 2026-08-13 本地 SQLite 查询 |
| 调度 | 自实现 SM-2；状态表有 interval、ease factor、next review | `apps/api/src/scheduler/` |
| 发音 | UK/US 有道语音；失败时 Web Speech 降级 | `apps/web/src/App.tsx` |
| 家长报告 | 展示有效学习天数、章节数、查词数及两类正确率 | `apps/web/src/App.tsx`、`apps/api/src/report.ts` |
| 内容生成 | 火山引擎方舟离线脚本，不在用户请求链路实时生成 | `scripts/complete-chapters.ts` |

`content_library` 当前有 20 条版本记录，但产品范围是 10 个章节。后续统计必须区分“章节版本行数”和“唯一章节数”。

### 3.3 当前最高风险

**整改状态（2026-08-13）**：当前工作副本已移除 `scripts/complete-chapters.ts` 的凭证回退，并完成 API 固定签名回退、环境文件、部署同步和静态门禁整改。本文不记录凭证值。外部供应商凭证尚未由用户在控制台轮换，因此 P0-A 仅“代码与部署边界已交付”，不能标记为整体关闭。详见 [P0-A 凭证安全整改记录](security/2026-08-13-p0-a-credential-remediation.md)。

**必须动作**：

1. 已完成：移除源码中的真实凭证和固定签名回退；
2. 待用户完成：在火山引擎控制台禁用旧凭证并创建最小权限的新凭证；
3. 已完成：代码只接受环境变量或密钥管理服务注入，缺失时快速失败；
4. 待后续能力立项时执行：ASR、语音评分和 LLM 分别验证服务、endpoint、权限与计费，不能假定共享一个 key。

---

## 四、开源项目复核与可借鉴边界

### 4.1 ECDICT：先做来源与字段审计

仓库：[skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) ｜ License：MIT

**已确认事实**：官方数据字段包括 `word`、`phonetic`、`definition`、`translation`、`pos`、`collins`、`oxford`、`tag`、`bnc`、`frq`、`exchange`、`detail` 和 `audio`。

需要纠正三项字段理解：

- `sw` 是去除非字母数字后的模糊匹配键，不是词形变化或词族；
- `exchange` 才记录过去式、过去分词、现在分词、复数、比较级和 lemma 等变换；
- `tag` 是中考、高考、四六级、雅思等考试/词表标签，不是适合故事生成的主题语义标签。

官方字段表还把 `detail` 中的例句和 `audio` 标为“待添加”。实际使用前必须检查固定数据版本的真实覆盖率，不能因字段存在就假定内容可用。

**对 Curio 的合理用途**：

- 用 `bnc`、`frq`、`collins` 辅助检查现有 Level 1–4 分层；
- 用 `exchange` 作为词形候选，再经过高中范围、词性和中文释义校验；
- 用 `phonetic` 或释义补缺，但必须保留字段级来源与冲突规则。

**不建议**：直接覆盖 Curio 已有 `word_family`、`tags`、音标和释义。MIT 是仓库许可证，不等于聚合数据的每个上游来源均已完成商业使用审计。

### 4.2 FSRS：值得实验，不宜立即替换

资源：[`open-spaced-repetition/ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) ｜ License：MIT

**已确认事实**：`ts-fsrs` 是面向 TypeScript 的 FSRS 调度工具；它包含卡片状态、Again/Hard/Good/Easy 四级评分、期望保持率和 review log，并提供独立的参数训练能力。

原报告把 MuJing 作为 FSRS 采用案例，证据不足；MuJing 官方 README 没有证明这一点。原报告引用的 `fsrs4anki` 也不是 AGPL 的 TypeScript 包：[`fsrs4anki`](https://github.com/open-spaced-repetition/fsrs4anki) 当前为 MIT，主要面向 Anki 调度与优化。

FSRS 社区材料称，在特定比较口径下，为达到相同保持率可减少约 20%–30% 复习。但该结果不能直接写成“Curio 学习效率提升 30%”。Curio 的故事复现、核心词抉择和点击行为不等同于标准卡片复习。

**迁移前置条件**：

1. 定义 Curio 行为如何映射到 Again/Hard/Good/Easy，或证明二元评分足够；
2. 保存完整 review log，而不只是最新 interval 和 ease factor；
3. 定义目标保持率、工作量和学习效果指标；
4. 处理历史迁移、时区、短期学习步骤、回滚和双算法并行；
5. 先对匿名化历史数据离线回放，再在小样本中 A/B 对照。

因此，FSRS 当前是**实验项**，不是 2–3 天的 P1 替换任务。

### 4.3 MuJing：真实语境与跨媒体练习

仓库：[tangshimin/MuJing](https://github.com/tangshimin/MuJing) ｜ License：GPL-3.0

**已确认能力**：从电影、美剧、字幕和文档生成词库；视频片段语境；拼写、字幕抄写、听写、跟读；不同来源词库链接。

**对 Curio 的合理启发**：让同一个词的跨章节出现轨迹可见，或在故事外增加一种轻量主动回忆任务。

**边界**：原报告中的 FSRS、100LS 和 Whisper 说法缺少可定位的一手证据；“使用 ASR 验证故事朗读流畅度”也是待验证的测量方法，不能直接进入路线图。

### 4.4 Qwerty Learner：主动拼写，而非新增发音

仓库：[RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner) ｜ License：GPL-3.0

**已确认能力**：错词重新输入、音标与发音、章节默写、速度和正确率反馈。

**对 Curio 的产品提案**：在错误支线完成后，试验一次核心词拼写或回忆任务。但它必须验证是否破坏故事节奏，不能仅因竞品存在就设为 P0。

原报告列出的具体组件路径未绑定固定 commit，不能作为可直接复制的代码位置；如需参考源码，应重新定位并遵守 GPL。Curio 已经实现发音，不再列入待办。

### 4.5 TypeWords：模式清单不能直接变成 Curio 需求

仓库：[zyronon/TypeWords](https://github.com/zyronon/TypeWords) ｜ License：GPL-3.0

**已确认能力**：词汇跟打、听写、自测、默写，智能模式和自由模式；另有文章跟打与听写。

原报告将其改写成“辨认、复习”等四种 Curio 模式，不是项目原始事实。对 5–10 人试点，同时开发四种模式会扩大范围并稀释叙事核心。

**建议实验**：只选“核心词主动拼写”一种任务，以完成率、放弃率、次日保持和对故事沉浸的影响作为判断依据。

### 4.6 Anki / AnkiDroid：参考调度与统计，不复制生态结论

仓库：[ankidroid/Anki-Android](https://github.com/ankidroid/Anki-Android) ｜ License：GPL-3.0

**已确认能力**：成熟的间隔重复、卡片复习、统计与多媒体内容生态。原报告把 Anki、AnkiDroid、共享牌组和社区插件混写，并错误标注 AnkiDroid 为 Apache-2.0。

**对 Curio 的合理启发**：

- 让到期复习、历史表现和数据定义清晰可见；
- 报告展示应回答具体问题，而不是追求图表数量；
- 多媒体能力可以作为远期内容模型参考。

“6000+ 预制牌组”缺少固定的一手统计来源；即使共享生态成立，也不能据此证明教师发布 Curio 故事线有需求或商业价值。

### 4.7 Enjoy：AI 能力需按源码与服务边界核查

仓库：[ZuodaoTech/everyone-can-use-english](https://github.com/ZuodaoTech/everyone-can-use-english) ｜ License：GPL-3.0

该仓库同时包含图书、1000 小时材料和 Enjoy 相关代码。它能证明 AI 辅助英语学习、语音训练和长期训练计划的产品方向存在，但不能把当前线上服务的全部能力默认视为开源代码能力。

**对 Curio 的合理启发**：长期目标可探索语音训练和个性化内容，但必须单独验证模型服务、评分有效性、未成年人数据处理、成本和内容安全。

原报告所写 MPL-2.0 不正确；“复用 `LLM_API_KEY` 接入 ASR”也不成立。

### 4.8 WordPecker：LLM 课程是真实能力，角色对话是 Curio 提案

仓库：[baturyilmaz/wordpecker-app](https://github.com/baturyilmaz/wordpecker-app) ｜ License：MIT

**已确认能力**：用户自建词表、互动测验和 LLM 生成课程。

“以林亦身份解释高亮词”的角色化对话是 Curio 自己的产品提案，不是 WordPecker 已验证的能力。它还会引入延迟、成本、答案泄露、内容一致性和未成年人交互边界，暂不进入近期排期。

### 4.9 其余项目：保留为低优先级样本

| 项目 | 已确认事实 | 对 Curio 的结论 |
|---|---|---|
| [ToastFish](https://github.com/Uahh/ToastFish) | MIT；Windows 通知栏学习、自定义词表 | 说明特定使用场景可以塑造交互，但不能以项目存在证明产品方向有效 |
| [Memo](https://github.com/olmps/memo) | BSD-3-Clause；Flutter；面向 Android/iOS 的 SRS | 可作远期移动架构样本，当前无须选 Flutter |
| [remix-words-funny](https://github.com/SteveSuv/remix-words-funny) | 当前描述为 React Router v7、tRPC、Drizzle、PostgreSQL 等 | Curio 3500 词和 SQLite 尚无扩容压力，不优先研究其索引架构 |

### 4.10 许可证与数据边界

- MIT、BSD、GPL 等标注只描述所核查仓库的许可状态，不构成对其中全部数据、模型、媒体或第三方依赖的法律结论。
- “参考一种交互思想”和“复制源码或结构化实现”是两件事。GPL 项目可以用于研究产品机制；如需复制、修改或分发代码，必须单独做许可证与分发方式评估。
- AnkiDroid 主仓库标注 GPL-3.0，但其 README 还列出后端/API 等组件的不同许可证；任何具体集成都应追到目标组件，而不是用主仓库许可证概括整个生态。
- ECDICT 是聚合词典。商业接入前要固定数据版本、保留上游来源清单，并对准备使用的字段逐项确认归属和许可。
- 未找到明确 License 的仓库只能用于阅读和事实研究，不能默认获得复制、修改或分发权限。

---

## 五、修订后的实施路线

### 5.1 P0：本周处理

#### A. 凭证安全

- **代码与部署边界已交付（2026-08-13）**：删除源码默认凭证，补充快速失败、部署保护和静态门禁；
- **外部轮换待办**：在火山引擎控制台禁用旧凭证并安全注入新凭证；
- **历史审计待办**：在恢复完整 Git 元数据并取得平台权限后检查提交历史、历史部署包、构建缓存和日志；
- 为 LLM、ASR、语音评分分别定义授权和成本边界。

这是一项已发现风险的修复，不是开源项目借鉴。状态边界和人工动作见 [P0-A 凭证安全整改记录](security/2026-08-13-p0-a-credential-remediation.md)。

#### B. 词库字段来源审计

**完成状态（2026-08-13）**：P0-B 已完成并通过审计门禁。当前 CSV 已通过相同 SHA-256 绑定到历史正式构建产物；已固定 3500 行 evidence、来源版本/hash/许可证边界和 ECDICT 相关字段快照。CSV 与 SQLite 七字段冲突为 0；ECDICT 确认参与词性、部分释义、扩展词筛选和 Level 排序，但没有生成产品 `tags` 或当前 `word_family`。完整发现、不可确认边界、验证结果和最小下一动作见 [P0-B 正式审计报告](quality/2026-08-13-vocab-field-provenance-audit-p0-b.md)，机器结果见 [`data/audits/vocab-p0b/`](../data/audits/vocab-p0b/)。

为 3500 词生成可复查结果：

| 字段 | 需要回答的问题 |
|---|---|
| phonetic | 当前来源、缺失率、英美音口径 |
| meaning_cn / pos | 来源、冲突规则、人工复核状态 |
| level / gaokao_frequency | 分级依据和可复现计算方式 |
| word_family | 189 条如何生成；其余是缺失还是不适用 |
| tags | 当前标签含义；是否只是内容标签而非来源证据 |
| ECDICT 候选字段 | 固定版本、覆盖率、上游归属、可用边界 |

输出应区分“已有可靠值、可自动补齐、需人工复核、不应补齐”，避免为追求覆盖率制造伪词族或低质量释义。

### 5.2 P1：受控实验

#### A. 单一主动回忆实验

产品提案：错误支线完成后，对核心词增加一次短拼写任务。

验证指标：

- 任务完成率与放弃率；
- 故事完成时长变化；
- 次日同义辨析或新语境识别；
- 学生是否认为任务打断剧情；
- 错误后是否产生挫败或机械重复。

只有出现正向行为和访谈证据，才扩展到听写、自测或更多模式。

#### B. FSRS 离线可行性实验

1. 先设计 review log 与四级评分映射；
2. 用 `ts-fsrs` 和现有 SM-2 对同一历史事件离线回放；
3. 比较到期量、预计保持率、异常间隔和首次复习时机；
4. 小样本双轨运行，保留一键回滚；
5. 在有足够数据后，再决定是否替换。

本阶段不承诺 30% 收益，也不删除 SM-2。

#### C. 家长报告问题验证

先访谈家长要做什么判断，例如：

- 孩子是否持续完成学习；
- 哪类词反复失败；
- 当前数据是否足以判断变化；
- 需要采取什么低风险支持动作。

只有问题稳定后，才选择热力图、趋势图或分布图。每张图必须标明数据定义、时间范围、样本量和“不等同于提分”的边界。

### 5.3 暂不排期

- 实时角色化 AI 划词对话；
- 实时个性化故事；
- AI 语音评分；
- 教师自定义故事线发布市场；
- 因扩展考试词库而更换数据库。

重新进入排期的条件是：P1 核心闭环已经稳定、出现真实用户需求或付费行为、完成未成年人隐私与内容安全评审，并有可控成本和回滚方案。

---

## 六、落地决策表

| 候选项 | 当前结论 | 下一验证动作 | 决策门槛 |
|---|---|---|---|
| ECDICT | 已确认历史使用，但不可直接全量覆盖 | 先复核 40 个词族风险项，再抽样 118 个机器候选 | 关系正确、逐条有证据且归属边界可接受 |
| FSRS | 有潜力，暂不替换 SM-2 | 补 review log，离线回放 | 比现有调度更稳定且试点负担可控 |
| 核心词拼写 | 值得做单一实验 | 错误支线后小范围试验 | 保持提升信号大于剧情中断成本 |
| 更多练习模式 | 暂缓 | 等单一实验结果 | 用户主动需要且不稀释故事主线 |
| 家长图表 | 先验证问题 | 家长访谈 + 数据定义 | 能支持明确判断而非仅增加观感 |
| 实时 AI 对话/故事 | 暂缓 | 未来做单章原型 | 有需求、成本、安全和质量证据 |
| 语音评分 | 暂缓 | 先定义测量目标 | 评分有效且服务授权独立可控 |
| 教师内容生态 | 暂缓 | 先访谈教师/学校 | 出现真实制作与发布行为 |

---

## 七、来源

### 开源项目一手资料

- [ECDICT 官方仓库](https://github.com/skywind3000/ECDICT)
- [MuJing 官方仓库](https://github.com/tangshimin/MuJing)
- [Qwerty Learner 官方仓库](https://github.com/RealKai42/qwerty-learner)
- [TypeWords 官方仓库](https://github.com/zyronon/TypeWords)
- [AnkiDroid 官方仓库](https://github.com/ankidroid/Anki-Android)
- [Enjoy / everyone-can-use-english 官方仓库](https://github.com/ZuodaoTech/everyone-can-use-english)
- [WordPecker 官方仓库](https://github.com/baturyilmaz/wordpecker-app)
- [ToastFish 官方仓库](https://github.com/Uahh/ToastFish)
- [Memo 官方仓库](https://github.com/olmps/memo)
- [remix-words-funny 官方仓库](https://github.com/SteveSuv/remix-words-funny)
- [ts-fsrs 官方仓库](https://github.com/open-spaced-repetition/ts-fsrs)
- [fsrs4anki 官方仓库](https://github.com/open-spaced-repetition/fsrs4anki)
- [ABC of FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)

### Curio 本地证据

- `apps/web/package.json`
- `apps/web/src/App.tsx`
- `apps/api/src/scheduler/sm2.ts`
- `apps/api/src/scheduler/index.ts`
- `apps/api/src/report.ts`
- `packages/db/src/schema.ts`
- `data/curio_gaokao_vocabulary.csv`
- `data/curio.db`
- `scripts/complete-chapters.ts`

---

## 八、最终建议

Curio 应继续强化“叙事化语境 + 关键抉择”的核心，而不是一次性复制通用背词产品的模式集合。当前最重要的不是增加功能，而是：

1. 修复已发现的凭证风险；
2. 证明词库每个关键字段可靠且可追溯；
3. 用一个主动回忆实验验证学习增益与剧情成本；
4. 用离线和小样本数据决定是否迁移 FSRS；
5. 让家长报告回答真实判断问题，并明确不把短期行为数据包装成提分证据。

只有在这些前提成立后，AI 对话、语音评分、实时故事和教师生态才值得进入下一轮产品研究。
