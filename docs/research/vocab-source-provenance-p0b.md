# Curio 3500 词来源与归属边界取证基线（P0-B，证据迁入前）

> **状态说明（2026-08-13）**：本文保留“仅看 Nexus 原始内容时能够确认什么”的独立取证基线。主任务随后定位并独立核验了历史构建工程：其正式 CSV 与 Nexus 当前 CSV 的 SHA-256 完全一致，并已把 evidence、来源清单和必要的固定字段快照迁入 Nexus。当前完整结论以[正式审计报告](../quality/2026-08-13-vocab-field-provenance-audit-p0-b.md)为准；下文“当前仓库缺少 evidence/SOURCES”的表述只描述迁入前状态。

> 核查日期：2026-08-13  
> 核查范围：`/Users/shawn/Nexus/Curio` 当前工作副本中的源码、文档、CSV 与 SQLite；必要时引用上游官方仓库。  
> 结论口径：字段非空、CSV 与数据库一致、文档曾提到某数据源，均不等于已证明该字段来自该数据源。

## 结论

当前仓库可以确认的是：`data/curio_gaokao_vocabulary.csv` 是可见的词库导入源，`packages/db/src/seed.ts` 将其 8 个字段按名称写入 `vocab_library`；2026-08-13 的只读比对中，CSV 3500 行与数据库 3500 行在 8 个字段上逐项一致。

当前仓库无法确认的是：3500 个词头以及 `phonetic`、`pos`、`meaning_cn`、`level`、`gaokao_frequency`、`word_family`、`tags` 各字段分别由哪个上游、哪个版本、哪条规则或哪次人工复核产生。仓库中没有逐行 evidence/provenance、`SOURCES.json`、构建词库的生成器、上游快照或其 hash，也没有可把当前 CSV 绑定到某次上游构建的发布清单。因此，本次不能把 ECDICT、IPA-dict、CMUdict、WordNet、GAOKAO-Bench、教师 PDF 或任何其他来源归属到当前数据行。

特别是 ECDICT：仓库文档把它列为候选增强资源，并提出未来下载、匹配与回填的方案；但仓库中不存在 `ecdict.csv`、ECDICT 依赖、下载/匹配代码或 `enrich-vocab-from-ecdict.ts`。现有证据既不能证明 ECDICT 实际参与了当前 CSV，也不能证明它一定没有参与过仓库之外的历史制作。正确状态是 **“当前仓库无法确认是否使用”**。

## 1. 当前可复现的数据流

```text
data/curio_gaokao_vocabulary.csv
            |
            | packages/db/src/seed.ts（逐列 upsert）
            v
data/curio.db / vocab_library
            |
            +-- apps/api/src/learning.ts（查询并展示词汇、词族）
            +-- scripts/verify-content-and-vocab.ts（数量、必填、词族结构和内容引用门禁）

CSV 还被 scripts/generate-stories.ts 读取，用于离线章节内容生成；
该脚本不生成或补全词库字段。
```

证据：

- [`packages/db/src/seed.ts`](../../packages/db/src/seed.ts) 固定读取 `data/curio_gaokao_vocabulary.csv`，将 8 列映射到 `vocab_library`，冲突时覆盖对应字段。它不读取任何外部词典，也不写 source/provenance。
- [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts) 的 `vocab_library` 只有 8 个业务字段，没有 `source`、`source_version`、`source_record_id`、`license`、`reviewed_by` 或 `generated_at`。
- [`scripts/generate-stories.ts`](../../scripts/generate-stories.ts) 只从 CSV 读取 `word`、`phonetic`、`pos`、`meaning_cn`、`level` 作为故事生成输入，不是词库构建器。
- [`apps/api/src/learning.ts`](../../apps/api/src/learning.ts) 将 `word_family` 解析成词形，并尝试在同一 `vocab_library` 中补充这些词形的词性和释义；这属于运行时展示，不产生词族，也不证明词族来源。
- [`scripts/verify-content-and-vocab.ts`](../../scripts/verify-content-and-vocab.ts) 读取 SQLite 做门禁：3500 行、词头唯一、音标/词性/释义非空、词族不重复且不含自身、章节目标词存在等。它把“词族非空行数”命名为 `wordsWithVerifiedFamily`，但并没有查询外部来源或验证词源关系；该变量名不能作为 provenance 证据。

### repair 脚本边界

仓库内与 repair 相关的脚本修改的是 `content_library` 的章节词汇角色、正文与高亮，不修改 `vocab_library`：

- [`scripts/repair-p1-content-contract.ts`](../../scripts/repair-p1-content-contract.ts)
- [`scripts/repair-chapter-1-vocab-contract.ts`](../../scripts/repair-chapter-1-vocab-contract.ts)
- [`scripts/repair-branch-convergence.ts`](../../scripts/repair-branch-convergence.ts)

全仓源码检索到的 `vocab_library` 写入点只有正式 seed 和 E2E 测试数据初始化；没有词典增强或逐字段修复器。因而不能从 repair 脚本推导任何词库来源。

## 2. 当前快照与可确认边界

本次只读核查得到：

| 对象 | 结果 | 能证明什么 | 不能证明什么 |
|---|---:|---|---|
| `data/curio_gaokao_vocabulary.csv` | 3500 数据行；SHA-256 `60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022` | 固定本次审计输入快照 | 不能绑定上游版本或生成过程 |
| `data/curio.db` | `vocab_library` 3500 行 | 当前运行库的词库规模 | 整库还含用户/内容数据且有 WAL 活动，整库 hash 不是稳定的词库发布标识 |
| CSV ↔ SQLite | 8 字段、3500 行逐项一致，差异 0 | 当前数据库词库内容与 CSV 同步 | 不能证明历史上一定由本次 seed 产生，更不能证明 CSV 字段上游 |
| `phonetic` / `pos` / `meaning_cn` | 均 3500/3500 非空 | 覆盖率事实 | 非空不代表来源、正确性、英美音口径或人工复核状态 |
| `word_family` | 189/3500 非空 | 现状覆盖率 | 不能证明由 ECDICT `exchange`、WordNet、规则或人工产生 |
| `tags` | 3500/3500 非空 | 现状覆盖率 | 不能证明是 ECDICT 考试标签；字段值也可能是 Curio 内容分类 |

当前目录没有 `.git` 元数据，因此也不能给本工作副本或 CSV 绑定项目 commit。文件时间戳只能描述当前文件副本，不能替代来源版本。

## 3. 逐字段 provenance 判断

| 字段 | 仓库能确认的直接来源 | 上游归属 | 版本/hash/URL/license | 当前结论 |
|---|---|---|---|---|
| `word` | CSV；seed 转小写后写入 SQLite | 未知 | 缺失 | 无法逐行确认 |
| `phonetic` | CSV 原值写入 SQLite | 未知 | 缺失 | 无法确认词典、音标体系及英美音口径 |
| `pos` | CSV 原值写入 SQLite | 未知 | 缺失 | 无法确认来源及缩写规范的制定者 |
| `meaning_cn` | CSV 原值写入 SQLite | 未知 | 缺失 | 无法确认词典/教师/人工编辑归属及许可 |
| `level` | CSV 文本转整数写入 SQLite | 未知 | 缺失 | 无生成规则、配额证据或复核记录 |
| `gaokao_frequency` | CSV 原值写入 SQLite | 未知 | 缺失 | 无语料清单、年份/试卷范围、计数方式或阈值证据 |
| `word_family` | CSV 非空则原值写入 SQLite | 未知 | 缺失 | 无逐条关系证据；不能从表面形似反推 |
| `tags` | CSV 非空则原值写入 SQLite | 未知 | 缺失 | 无标签词表定义与生成规则；不能归属于 ECDICT `tag` |

这里的“CSV”是仓库内直接输入文件，不是上游权利来源。它解决了“数据库从哪里读”，没有解决“CSV 每个值从哪里来”。

## 4. ECDICT 是否实际参与

### 仓库内正向证据

没有找到。

- 源码、依赖与数据目录中没有 ECDICT 数据快照或引用。
- 没有下载、解析、匹配 ECDICT 的实现。
- 没有 ECDICT commit、release、文件 hash、匹配统计、冲突清单或逐行 evidence。

### 容易被误读、但不能证明已参与的材料

- 2026-08-11 初稿 [`docs/open-source-vocab-research-2026-08-11-original.md`](../open-source-vocab-research-2026-08-11-original.md) 写的是未来方案：下载 `ecdict.csv`、新增 `scripts/enrich-vocab-from-ecdict.ts`、匹配后回填并 reseed。仓库现状中这些产物不存在。
- 复核稿 [`docs/open-source-vocab-research-review.md`](../open-source-vocab-research-review.md) 已明确指出，不能因字段当前非空推断 ECDICT 已使用或未使用。
- 修订稿 [`docs/open-source-vocab-research.md`](../open-source-vocab-research.md) 把 ECDICT 降为待做字段级审计的候选来源，并要求固定版本、保留上游来源清单和归属审计。

### 官方上游边界

ECDICT 官方仓库为 [`skywind3000/ECDICT`](https://github.com/skywind3000/ECDICT)，仓库标注 MIT License。官方字段说明区分了 `sw`（模糊匹配键）与 `exchange`（词形变化），并说明 `tag` 是考试/词表标签；这些事实可用于评估未来候选字段，不能反向证明当前 Curio 字段来自 ECDICT。

此外，ECDICT 是聚合词典。即使未来固定某个 ECDICT commit 并保留 MIT LICENSE，仍需对实际采用字段的上游数据归属做单独审查；仓库级 MIT 标注不能自动回答聚合内容每一行的上游权利来源。本报告不是法律意见。

本次没有给出“Curio 所用 ECDICT commit”，因为当前仓库根本没有证据表明选定或使用了某个版本。虚构一个当前 HEAD hash 会造成错误归属。

## 5. 其他曾用于构建的候选来源

在当前 Nexus 仓库中，未找到 IPA-dict、CMUdict、WordNet、GAOKAO-Bench、课程标准词表、教师 PDF 的以下任一项：数据快照、固定 URL/commit、文件 hash、LICENSE/NOTICE、生成器配置、字段映射、逐行证据或冲突处理记录。因此：

- 不应把音标归属于 IPA-dict 或 CMUdict；
- 不应把词性、释义或词族归属于 WordNet；
- 不应把 `gaokao_frequency` 归属于 GAOKAO-Bench；
- 不应把词头、释义或音标归属于课程标准附件或教师 PDF；
- 也不能仅凭数据风格或覆盖率反推来源。

这些名称若在仓库外的历史构建工程中确实出现，也必须把那套工程的 `SOURCES`、evidence、构建版本和生成结果迁入或以不可变链接引用后，才能成为本仓库的可审计证据。

## 6. 许可证与上游归属清单

| 资源 | 当前角色 | 固定版本/内容 hash | URL | License / 归属结论 |
|---|---|---|---|---|
| Curio 当前 CSV | 实际导入源 | SHA-256 `60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022` | 仓库内文件 | 仓库无该数据集的 LICENSE/NOTICE；上游归属无法确认 |
| ECDICT | 文档中的候选增强源，未证实参与当前数据 | 未选择 | https://github.com/skywind3000/ECDICT | 官方仓库 MIT；聚合数据的逐项上游边界仍需审查 |
| IPA-dict / CMUdict / WordNet / GAOKAO-Bench / 教师 PDF 等 | 当前仓库无可验证角色 | 缺失 | 缺失 | 不得归属；版本、URL、hash、许可证均无法从当前仓库确认 |

## 7. 要达到“可逐行确认”还缺什么

最小动作不是修改 3500 词，而是找回并固定已有构建证据：

1. 将产生当前 CSV 的构建工程定位到不可变版本，记录代码 commit；
2. 保存每个输入文件的官方 URL、下载日期、commit/release、SHA-256、LICENSE/NOTICE 与上游所有者；
3. 导入与当前 CSV 一一对应的逐行 evidence，至少包含 `word`、每字段 source id、source record key、变换规则、冲突选择、人工复核状态；
4. 保存机器可读 `SOURCES.json` 与构建/验证报告，并验证 evidence 行与当前 CSV hash 相匹配；
5. 对无法恢复逐行证据的值明确标为 `unknown`，不要基于字段非空、拼写形似或第三方覆盖率补写 provenance。

在这些证据补齐前，可完成字段覆盖率与格式质量审计，但不能把“质量看起来合理”升级成“来源已确认”。
