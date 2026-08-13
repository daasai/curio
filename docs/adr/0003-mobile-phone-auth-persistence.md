# 账号体系采用手机号登录及本地 Token 持久化

PRD v0.3 规划在 P2 实现完整用户账号与跨端数据同步。在 P1 迭代对齐中，决定将**手机号登录与持久化状态**提前至 P1 必做范围。

## 决策内容

1. **主身份标识**：采用中国大陆高中生与家长更习惯的**手机号码**（Mobile Phone Number）作为核心账户标识，替代原设计的纯 Email 认证。
2. **记住登录状态**：客户端（Web 端）通过 `localStorage` 存储 JWT Token 与 `userId`。应用加载时自动检测持久化 Token 进行静默登录与状态恢复，避免用户重复登录。
3. **数据打通**：Zustand 内存 Store 与后端 Hono REST API 强制同步，所有阅读会话（`readingSessions`）、词汇交互（`wordClicks`）及 Streak 状态必须真实落盘。

## Downstream Changes

- **Schema 修改**：`packages/db/src/schema.ts` 中的 `users` 表结构需添加 `phone` 字段（`text('phone').unique()`），并允许 `email` 可空。
- **API 接口**：`/api/auth/login` 支持手机号鉴权与验证码/快捷登录。
- **前端 Onboarding**：在偏好配置完成后或入口处增加手机号绑定/登录弹窗。
