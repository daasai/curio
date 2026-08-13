# ADR-0008：采用 GitHub Actions 受控生产部署

日期：2026-08-13
状态：Proposed

## 上下文（Context）

Curio 已有一台以 PM2、Nginx、SQLite 和 `deploy.sh` 运行的受邀试点服务器。`sync-deploy.sh` 已明确排除远端 `.env` 与 `data/`，而 SQLite 和密钥都不能进入 GitHub。当前没有仓库内的自动 CI 或受控部署记录；本地 Playwright 因 Node 18 无法运行，但 GitHub-hosted runner 可使用 Node 20。

## 决策（Decision）

采用 GitHub-hosted runner 自动运行 CI；仅当 `main` 的 CI 成功时创建生产部署任务。部署任务引用 GitHub `production` Environment，必须在环境中人工批准后才可读取 SSH 密钥。批准后，workflow 通过受限部署账号连接服务器：先备份 SQLite 与前一份代码，再用 `sync-deploy.sh` 同步代码，最后运行既有 `deploy.sh` 与健康检查。

不在现网服务器运行 self-hosted runner；不把 `.env`、SQLite、备份或 SSH 主机指纹写入仓库。

## 后果（Consequences）

每次 PR 和 main 推送都获得一致的自动校验，生产部署可追踪且不会并发执行。生产发布多了一个人工批准步骤，首次部署还需由运维方配置 GitHub Environment、部署账号、SSH 指纹与服务器运行时。代码同步失败或部署门禁失败时，数据库备份和 `.deploy-backups/<commit>` 留在服务器供人工恢复；本决策不承诺自动数据库回滚。
