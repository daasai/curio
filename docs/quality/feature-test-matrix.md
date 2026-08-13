# Curio P1 全量质量地图

本文件是发布门禁的覆盖清单。每一个 P1 功能必须至少拥有一个可执行验证；没有可执行验证的功能不得标记为已覆盖。

| 功能域 | 必须验证的状态与异常 | 自动化证据 |
|---|---|---|
| 受控身份 | 激活、登录、错误 PIN、锁定、禁用、会话恢复、越权 | `apps/api/tests/auth.test.ts` |
| 章节会话 | 启动、恢复、章节顺序、重复开始、重复完成、并发修订 | `apps/api/tests/learning.test.ts` |
| 词汇查阅 | 每个高亮词有真实词条；点击幂等；刷新后仍可查询 | `scripts/verify-content-and-vocab.ts`、`tests/e2e/learning-journey.spec.ts` |
| 词汇本 | 查阅词与展示词一致；无 Mock 回退；刷新与重新登录后一致 | `tests/e2e/learning-journey.spec.ts` |
| 关键抉择 | 正确路径、每个错误支线、未完成支线禁止完成、辨析首答 | `apps/api/tests/learning.test.ts`、内容审计 |
| 学习报告与海报 | 无样本为 `null`；查阅不等于掌握；海报和报告一致且无手机号 | `apps/api/tests/report.test.ts` |
| 内容发布 | 10 章、15 词预算、词条可解析、正文覆盖、显式词类 | `scripts/verify-content-and-vocab.ts` |
| 失败恢复 | 断网、超时、重试、响应丢失、409 冲突不重复写入 | API 集成测试与 E2E 路由故障注入（待逐项扩展） |
| 兼容性与视觉 | Chrome、375px/390px、无横向溢出、关键页截图；WebKit 在 CI 安装浏览器后二次运行 | Playwright 项目与人工确认的视觉基准 |

## 质量规则

1. 服务端是学习事实源；前端状态只可作为短暂投影。
2. 测试数据库必须位于 `.scratch/`，不得读写 `data/curio.db`。
3. 每一个已发现缺陷，先建立可重复失败的测试，再修复。
4. 状态测试必须覆盖正常、重复、刷新、跨设备和网络失败五类路径。
5. 浏览器测试保存失败截图、trace 和视频；视觉基准须经人工确认后才可作为回归标准。
