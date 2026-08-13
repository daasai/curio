# Curio 词族风险项人工审核决策

> 审核日期：2026-08-13  
> 审核范围：P0-B 标记为 `manual_review` 的 40 个词头  
> 审核者：Codex，依据用户要求采用推荐结果  
> 实施状态：已于 2026-08-13 通过受控脚本实施到生产 CSV，并用既有 seed 流程同步 SQLite；未部署、提交或推送。

## 一、审核结论

40 个风险词头合并双向关系后对应 25 个关系级决策：

| 决策 | 数量 | 含义 |
|---|---:|---|
| 删除现有关系 | 14 | 现代语义不透明、表面拼写误命中或会误导学习者 |
| 保留现有关系 | 2 | 构词、语义和当前义项相容 |
| 替换现有关系 | 1 | `live/lively` 改为 `life/lively` |
| 接受新候选 | 5 | 建立经义项限定的双向关系 |
| 修正字段后接受 | 1 | 修正 `tire/tired` 词性与释义后建立关系 |
| 拒绝候选 | 2 | `fee/feed` 和 ECDICT 标记为现在分词的 `will/willing` |

机器可执行的逐项决策见 [`word-family-manual-decisions.csv`](../../data/audits/vocab-p0b/review/word-family-manual-decisions.csv)。

## 已实施记录与未处理范围

- 已实施 25 个关系级决策：14 删除、2 保留、1 替换、5 新增、1 原子字段修正后新增、2 拒绝（拒绝项未产生写入）。
- 词族统计从 189 个非空词头、196 个关系成员变为 174 个非空词头、180 个关系成员；共 43 个受审核词头发生字段或词族变化。
- `tire/tired` 的词性、释义和双向词族已作为一个原子更新写入。
- 其余 118 个 `auto_fill_candidate` 没有处理；本次没有重做 tags、释义或其他词条，也不构成英语教师复核或词源学认证。
- 可复现脚本、dry-run diff、更新前本地备份、决策 hash 和回滚说明见 [`controlled-updates/2026-08-13-word-family-manual-review`](../../data/audits/vocab-p0b/controlled-updates/2026-08-13-word-family-manual-review/)。

## 二、批准删除的关系

- `apart / apartment`
- `bare / barely`
- `base / basement`
- `count / discount`
- `cover / discover`
- `disease / ease`
- `dismiss / miss`
- `display / play`
- `hard / hardly`
- `late / lately`
- `less / unless`
- `like / likely`
- `near / nearly`
- `short / shortly`

这些关系可能有历史词源或表面拼写联系，但不符合 Curio 当前“无需额外解释即可帮助高中生理解”的词族展示标准。

## 三、批准保留或替换的关系

- 保留 `like / unlike`。
- 保留 `most / mostly`。
- 删除 `live / lively`，替换为 `life / lively`。替换用于规避 `live` 的多词性和发音混淆，同时保留“生命—有生气的”学习联系。

## 四、批准新增的关系

- `can / could`：限“能、可以”的情态动词义项。
- `confuse / confused`。
- `interest / interesting`：限“兴趣”义项，不包含“利息”。
- `paint / painting`。
- `train / training`：限“训练、培训”义项，不包含“火车”。

上述关系按当前无类型数据结构写成双向关系。实施时不得删除同一词头上不属于本次范围且已验证的其他成员。

## 五、修正字段后新增

`tire / tired` 关系批准，但必须作为一个原子变更完成：

| 词 | 批准后的词性 | 批准后的中文释义 |
|---|---|---|
| `tire` | `n./v.` | `轮胎；使疲劳；使厌倦` |
| `tired` | `adj.` | `疲倦的；厌烦的` |

当前 `tired` 的释义混入“轮胎”义项；未完成字段修正前不得只添加词族关系。

## 六、拒绝的候选

- `fee / feed`：两词不构成词族，拒绝 ECDICT `exchange` 候选。
- `will / willing`：拒绝把 `willing` 视为 `will` 的现在分词。现有 `willing / willingness` 保持不变；未来若要关联 `will`，需要能够表达义项和关系类型的数据模型。

## 七、实施门禁

更新任务必须满足：

1. 以审核 CSV 为唯一变更清单，不处理其余 118 个机器候选；
2. 通过脚本生成补丁，不手工编辑生产数据库；
3. 关系去重、不含自身、成员均在 3500 词内；
4. 本次批准的关系保持双向一致；
5. `tire/tired` 字段修正与词族关系原子落地；
6. 输出变更前后逐词差异和可恢复备份；
7. 更新生产 CSV 后通过 seed 流程同步数据库，不得直接执行无记录的 SQL 修改；
8. 通过词库审计、内容门禁、API 测试、构建及词汇卡相关浏览器验证；
9. 不部署、不提交、不推送。

## 八、证据边界

本次是面向 Curio 当前词卡体验的编辑审核，不是词源学认证。ECDICT `exchange` 只作为候选证据；当它与当前词义、词性或学习者透明度冲突时，以产品语义审核结果为准。词族字段当前不表达具体义项和关系类型，因此多义词关系均在本文件中明确限定适用义项。
