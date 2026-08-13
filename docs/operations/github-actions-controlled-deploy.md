# GitHub Actions 受控部署配置

本方案自动验证代码；`main` 的成功 CI 只会创建一个等待人工批准的生产部署，不会直接上线。

## GitHub 配置

在仓库 Settings → Environments 创建 `production`：

1. 仅允许 `main` 部署并指定部署审批人。只有存在另一位审批人时才启用“阻止自行审批”；单人审批人启用它会永久阻塞发布。
2. 添加 Environment secrets：
   - `DEPLOY_SSH_PRIVATE_KEY`：专用部署账号的 ed25519 私钥；只授予此环境。
   - `DEPLOY_SSH_KNOWN_HOSTS`：通过受信渠道取得的服务器 `ssh-ed25519` 主机指纹行；不要在 workflow 中执行 `ssh-keyscan`。
3. 添加 Environment variables：
   - `DEPLOY_SSH_HOST`、`DEPLOY_SSH_USER`、`DEPLOY_SSH_PORT`
   - `DEPLOY_TARGET`：服务器上的绝对项目目录，例如 `/var/www/curio`
   - `DEPLOY_BUN_BIN`：部署账号可执行的 Bun 1.2.18 绝对路径。

`DEPLOY_SSH_PORT` 和 `DEPLOY_BUN_BIN` 也必须显式配置，避免 workflow 猜测服务器的账户或运行时。

## 服务器前置条件

- 部署账号只能访问 Curio 项目目录和所需的 PM2 进程；不得复用 root 密码登录。
- `.env` 权限为 600，`data/curio.db` 可由部署账号安全备份；两者不由 GitHub 覆盖。
- 部署账号的 PM2 必须管理 `curio-api`，并能执行现有 `deploy.sh`。若当前 PM2 由 root 管理，先完成独立的、可回滚的运行账户迁移，再启用生产 Environment。
- `rsync`、Bun 1.2.18、Node/npm、PM2、Nginx 均已在服务器验证可用。
- Bun 必须由部署账号执行；当前约定路径为 `/home/deploy/.bun/bin/bun-1.2.18`，并通过 `DEPLOY_BUN_BIN` 显式传给部署与 PM2。

## 发布与恢复

部署 workflow 先运行 `scripts/backup-db.ts`，再把当前代码（排除 `.env`、`data/`、依赖、既有备份）复制到 `.deploy-backups/<commit>`。新代码同步后由 `deploy.sh` 运行构建、`npm run test:content` 内容门禁、PM2 重载和本机健康检查。章节内容属于业务数据，CI 不复制它们；CI 只在临时数据库中校验词库、来源审计与代码测试。

失败时不要直接覆盖数据库：先检查 GitHub 日志和服务器 PM2 日志；如需回滚代码，从对应 `.deploy-backups/<commit>` 恢复代码，同时保留 `.env` 与 `data/`。数据库回滚必须使用部署前生成的备份，并在维护窗口验证恢复结果。
