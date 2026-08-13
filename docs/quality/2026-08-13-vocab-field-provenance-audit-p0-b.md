# Curio 3500 词字段来源、覆盖率、冲突与归属审计（P0-B）

> 审计日期：2026-08-13  
> 实施目录：`/Users/shawn/Nexus/Curio`  
> 数据范围：`data/curio_gaokao_vocabulary.csv` 与 `data/curio.db/vocab_library`  
> 结论状态：**P0-B 已完成；通过但保留已披露限制**  
> 变更边界：未修改生产 CSV，未写入或 reseed 生产数据库，未部署、提交或推送

## 一、结论

本次已经把当前 3500 词 CSV 绑定到可核验的历史构建产物：当前文件与独立词库流水线的正式输出逐字节相同，SHA-256 均为 `60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022`。该流水线的 3500 行 evidence、`SOURCES.json`、字段生成代码和必要的 ECDICT 选定字段已固定到 Nexus 审计目录。因此，结论不是由“字段非空”反推来源，而是由以下证据链共同支持：

```text
固定上游文件/hash + 构建代码/hash + 3500 行 selected-source evidence
                             |
                             v
历史正式 CSV（SHA-256 60d4...022）
                             || 逐字节相同
                             v
Nexus 当前 CSV --seed.ts--> vocab_library（3500 行、7 字段差异 0）
```

主要发现：

- `phonetic`、`pos`、`meaning_cn`、`level`、`gaokao_frequency`、`tags` 均为 3500/3500 非空；`word_family` 为 189/3500 非空，共 196 个关系成员。
- 七个字段在 CSV 与 SQLite 之间均无冲突；现有格式规则下无格式异常、无字面占位值。
- ECDICT **实际参与过**：3296 行词性选择 ECDICT，527 行释义选择 ECDICT；3494 个词有正的 `bnc` 或 `frq` 排名输入，ECDICT 的 `gk` 标签也参与扩展词筛选。
- ECDICT **没有生成当前产品 `tags` 或 `word_family`**。`tags` 来自 Curio 的中文关键词/词性回退规则与 18 个显式覆盖；`word_family` 来自 Curio 的保守表面词缀规则。
- 3301 个 `tags` 是低信息量回退值 `action` 或 `description`。它们不是字面占位符，但不能作为细粒度语义分类质量的证据，更不能归属为 ECDICT `tag`。
- 上游候选值之间的完整冲突无法逐行重建：原 evidence 只保留最终选中的 source label，没有保留所有候选原值及逐次取舍。该项明确记为“无法确认”，没有反推。

## 二、现有流水线与写入边界

### 2.1 Nexus 内可见链路

- `packages/db/src/seed.ts` 读取 CSV 八列并 upsert 到 `vocab_library`。它不下载或增强词典数据。
- `packages/db/src/schema.ts` 定义 8 个词库业务字段，不含运行时 provenance 列。
- `scripts/verify-content-and-vocab.ts` 检查 3500 词、基础必填和词族结构，并检查章节引用；它不验证外部词典归属。
- `apps/api/src/learning.ts` 只把已存的 `word_family` 解析成前端所需的结构化结果；它不生成词族。
- repair 脚本只修复 `content_library` 的章节内容、分支与高亮，不改 `vocab_library`。

CSV 到 SQLite 的只读逐字段比对结果为 0 差异。生产 CSV 与数据库审计前后 hash 分别保持为：

| 对象 | SHA-256 |
|---|---|
| `data/curio_gaokao_vocabulary.csv` | `60d4b0201abd7a72787d0be12b45bc88edfc3ee6335563e4c2d7bbe4f650d022` |
| `data/curio.db` 审计快照 | `764752f8d044e1cb13f6683c33d65a52e70f3317b77146afa7ef5cfffa65690b` |

数据库整库 hash 会受其他业务数据和 WAL 状态影响，只用于证明本次没有写库，不作为词库发布版本标识。

### 2.2 历史构建证据如何与当前数据绑定

历史构建工程不在 Nexus 仓库内，也没有自身 Git commit；因此不能仅引用其路径作为版本。此次采用更窄的绑定方式：

1. 对比历史正式输出与当前 CSV，确认逐字节相同；
2. 固定构建输出 hash、evidence hash、`SOURCES.json` hash；
3. 固定参与字段生成的构建代码文件 hash；
4. 将 3500 行 evidence、ECDICT 3500 词相关字段和原 `SOURCES.json` 快照迁入 Nexus 审计目录；
5. 审计脚本重新计算 `level`、`word_family`、`tags` 规则并与当前值比对。

这能确认当前 CSV 对应哪一次固定产物和生成规则，但不能补造原流水线没有记录的逐字段候选冲突或人工审核人信息。

## 三、逐字段审计结果

| 字段 | 非空 | 格式异常 | CSV↔DB 冲突 | 可追溯结论 |
|---|---:|---:|---:|---|
| `phonetic` | 3500 | 0 | 0 | 3478 行选择 `ipa-dict(en_US/CMUdict)`；22 行为同形异音人工覆盖 |
| `pos` | 3500 | 0 | 0 | ECDICT 3296；功能词规则 177；教师资料 9；WordNet 8；情态动词规则 8；核心覆盖 2 |
| `meaning_cn` | 3500 | 0 | 0 | 教师资料释义 2915；ECDICT 527；人工覆盖 58 |
| `level` | 3500 | 0 | 0 | 由试卷命中、ECDICT `bnc/frq`、课标层级、词长排序及固定 800/800/900/1000 配额生成；3500 行复算一致 |
| `gaokao_frequency` | 3500 | 0 | 0 | GAOKAO-Bench 2010–2022 的 30 个年份-卷别单元；`>=5 high`、`2–4 medium`、其余 low；3500 行复算一致 |
| `word_family` | 189 | 0 | 0 | 由 Curio 表面词缀规则生成；规则可复算，但原 evidence 无专门逐行来源列，记为部分可追溯 |
| `tags` | 3500 | 0 | 0 | Curio 中文关键词/词性回退 + 18 个覆盖；不是 ECDICT `tag`，原 evidence 无专门逐行来源列，记为部分可追溯 |

覆盖率高只表示字段有值。音标口径、释义权利、语义正确性和上游冲突仍以 evidence、固定来源和披露边界为准。

### 3.1 格式、占位与冲突

- 当前发布规则下 0 个格式异常：音标斜杠格式、词性枚举、中文释义、Level、频率枚举、词族成员存在性和标签枚举均通过。
- 0 个字面占位值：未发现 `TODO`、`unknown`、`#VALUE!`、`待补` 等标记。
- `tags` 中 3301 行为规则回退 `action/description`，另列为“低信息量生成值”，不能因其非空而视为高质量语义标签。
- CSV 与数据库 7 个被审计字段差异 0；无缺失或额外数据库词头。
- 无法给出“所有上游候选值的冲突数”：原 evidence 只保留被选中的 source label，不保留所有候选原值。机器结果把该项写为 `not_confirmable_from_selected-source-only_evidence`。

## 四、word_family 四类分级

分类单位是 3500 个词头，不是唯一词族或边的数量。

| 分类 | 词头数 | 判定口径 | 处理边界 |
|---|---:|---|---|
| 可靠值 `reliable_value` | 157 | 当前非空；成员均在 3500 词内；结构合法；复算匹配固定保守词缀策略；未命中已知语义漂移/同形风险对 | 保留现状；仍不等于获得外部词源学认证 |
| 可自动补齐候选 `auto_fill_candidate` | 118 | 当前为空；固定 ECDICT `exchange` 给出词库内双向候选 | 只自动生成候选清单，不自动写库；需抽样和规则门禁后再决定 |
| 需人工复核 `manual_review` | 40 | 32 个当前非空值命中表面相似但语义/同形风险；8 个空值仅有单向或歧义 ECDICT 候选 | 逐项核对词义、词性、学生学习价值和展示关系 |
| 不应补齐 `should_not_fill` | 3185 | 当前为空，且固定来源没有满足本次保守门槛的词库内候选 | 保持空值，不为覆盖率制造关系 |

40 个需人工复核中，已有值的典型风险包括：`apart/apartment`、`base/basement`、`count/discount`、`disease/ease`、`display/play`、`hard/hardly`、`late/lately`、`less/unless`。这些关系说明“表面词缀可复算”不等于“适合学习展示”。

118 个 `auto_fill_candidate` 的含义是“候选可由固定规则自动生成”，不是“可无审核直接写入”。例如 ECDICT `exchange` 可能把屈折变化、同形词或词性变化连在一起；本次没有修改任何词族值。

## 五、ECDICT 实际使用结论

ECDICT 不是未来候选而已，它确实参与了产生当前 CSV 的历史构建：

- 3296 行 `pos` 的 selected source 为 ECDICT；
- 527 行 `meaning_cn` 的 selected source 为 ECDICT；
- 3494 个词在固定快照中有正的 `bnc` 或 `frq`，作为 Level 排序输入；
- ECDICT `gk` 标签参与课标外扩展词的候选排序。

同时必须保留三条否定边界：

- 产品 `tags` 来自 Curio 内容规则，ECDICT `tag` 只在扩展词筛选中作为 `gk` 信号；
- 当前 `word_family` 来自 Curio 的表面词缀规则，不来自 ECDICT `exchange`，后者本次只用于生成候选审计清单；
- ECDICT 是聚合词典。仓库 MIT License 不足以单独证明每个上游词典事实都已获得商业使用许可。

## 六、固定来源、版本、许可证与归属边界

完整机器清单位于 `data/audits/vocab-p0b/source-lock.json` 与 `result/source-manifest.json`。摘要如下：

| 来源 | 固定版本/hash | URL / License | 上游归属边界 |
|---|---|---|---|
| 普通高中英语课程标准 | 2017 版、2020 修订；PDF `8ebd6b…c1be` | 人教社 PDF URL；License 未记录 | 只用于词头基线；未复制正文/释义；更广复用权无法确认 |
| 教师 PDF | 用户提供快照；PDF `88d179…7f4d0` | URL、License 均未记录 | 候选词头与 2915 条选中释义；授权和上游归属无法确认，是当前最高许可证缺口 |
| ipa-dict `en_US` | commit 未记录；文件 `2af6f1…b70d` | 官方 GitHub；MIT | `en_US` 源自 CMUdict 转换，仍需保留 CMUdict 归属 |
| CMUdict | commit 未记录；文件 `819178…1d22` | 官方 GitHub；BSD-style | 发音清单与交叉验证；需保留原 notice |
| ECDICT | commit 未记录；文件 `1a6947…c3cf` | 官方 GitHub；仓库 MIT | 聚合数据的逐项上游商业授权不能由仓库 License 代替 |
| Princeton WordNet | 3.0；License `773117…443f` | 官方 License 页；WordNet 3.0 License | 只作 8 行词性 fallback；当前词族不是 WordNet 产物 |
| GAOKAO-Bench | commit `6dbb24f8d8439041e5431c4c184a582182a6ce9c` | 官方 GitHub；Apache-2.0 | 仅 2010–2022 的 30 个可得卷单元，不等于完整全国/省卷覆盖 |
| 构建代码 | 无 Git commit；按 6 个代码文件 hash 固定 | 本地历史构建工程 | 可以复算本次规则；不能提供仓库级版本历史 |

因此，“版本已固定”在不同来源上含义不同：GAOKAO-Bench 有 commit，WordNet 有正式版本，文件型来源只有内容 hash，构建工程只有代码文件 hash。没有 commit 的来源不得写成已确认 commit。

## 七、产物与复现

### 7.1 可重复脚本

```bash
npm run audit:vocab
```

脚本：[`scripts/audit-vocab-provenance.ts`](../../scripts/audit-vocab-provenance.ts)

### 7.2 机器可读结果

目录：[`data/audits/vocab-p0b/`](../../data/audits/vocab-p0b/)

- `source-lock.json`：人工审计固定的版本、hash、URL、License 和归属边界；
- `input/SOURCES.json`：原构建来源清单快照；
- `input/curio_gaokao_vocabulary_evidence.csv`：3500 行 selected-source evidence 快照；
- `input/ecdict-selected-fields.csv`：本次 3500 词相关的 ECDICT 固定字段快照；
- `result/summary.json`：总览、字段统计、ECDICT 使用量和限制；
- `result/field-summary.csv`：逐字段覆盖、异常、占位、冲突与追溯状态；
- `result/provenance.csv`：3500×7 的逐字段 selected source/规则状态；
- `result/word-family-classification.csv`：3500 词四类分级与候选；
- `result/conflicts.csv`：CSV↔DB 冲突；当前仅表头，表示 0 条；
- `result/findings.csv`：格式异常和字面占位；当前仅表头，表示 0 条；
- `result/source-manifest.json`：来源锁、原 manifest 与本次被审计文件 hash。

## 八、验证结果

| 验证 | 结果 |
|---|---|
| `npm run audit:vocab` | `PASS_WITH_DISCLOSED_LIMITATIONS`；3500 词；CSV↔DB 冲突 0 |
| `npm run test:vocab-audit` | 1 pass / 0 fail；包含生产 CSV/DB 前后 hash 不变断言 |
| `npm run test:content` | `CONTENT_AUDIT_PASS`；3500 词、189 个非空词族、10 个可用章节 |
| `npm run test:api` | 34 pass / 0 fail；含词汇持久化与空词族合同 |
| 原始词库流水线 `pytest` | 25 pass / 0 fail；禁用缓存和字节码写入运行 |

## 九、最小下一动作

不改词库的最小后续动作是：先人工复核 `word-family-classification.csv` 中 40 个 `manual_review` 词头，确认应删除、保留或改成哪一条关系；再对 118 个 `auto_fill_candidate` 抽样制定可接受门槛。只有形成明确的关系定义、人工判定记录和回归测试后，才考虑单独的数据变更批次。

许可证最小动作是：补齐教师 PDF 的来源、授权人与授权范围；为 ipa-dict、CMUdict、ECDICT 固定上游 commit 或 release，并保存对应 LICENSE/NOTICE。完成前，不把“仓库 License 已知”写成“全部聚合数据商业权利已确认”。

