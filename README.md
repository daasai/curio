# Curio

> 让英语词汇进入故事，而不是停留在词表里。

Curio 是面向高中生的受邀试点英语词汇学习产品。它将高考词汇嵌入连载悬疑故事，在关键剧情节点用词义理解驱动选择，并把阅读、查词、纠偏和学习记录连成一个可回看的学习过程。

当前版本适合小范围受控试点，不是面向公众的成熟在线教育服务。产品需求、研发规格和已知边界分别见 [CONTEXT.md](CONTEXT.md)、[PRD](docs/prd/prd-v0.4.1.md) 与 [研发规格](docs/spec/spec-p1-completion-and-p2-mvp-v0.5.0.md)。

## 产品定位与价值

传统背词的难点不只是“记住释义”，而是难以在真实阅读中识别、理解和运用词义。Curio 以故事为载体，尝试让用户经历：

1. 在情节中初次遇见词汇；
2. 在关键抉择中主动判断词义；
3. 答错时沿叙事支线理解误解造成的后果；
4. 在词卡、后续章节与学习报告中回看自己的学习轨迹。

它服务于两类利益相关者：学生获得连续、低打断的阅读学习体验；家长可以查看基于服务端记录生成的学习回顾。学习报告呈现的是行为与答题信号，不等同于词汇掌握、迁移能力或学习效果的最终证明。

## 已实现功能

| 功能 | 当前实现 |
| --- | --- |
| 连载学习 | `苍澜迷雾` 单条悬疑主线，当前发布 10 个章节；每章总预算为 15 个高考词汇。 |
| 关键抉择与纠偏 | 章节剧情中触发词义判断；错误选项进入对应支线，完成支线后再汇回主线。 |
| 语境词卡 | 点击高亮词查看释义、音标与发音、章节语境、可验证的词族及近义辨析。 |
| 入门诊断 | 登录后完成词汇理解摸底、题材偏好和阅读强度设置；结果持久化为个人基线。 |
| 进度与学习记录 | 会话、章节完成、查词和关键抉择记录保存在 SQLite；刷新或重新登录后从服务端恢复。 |
| 学习报告 | 显示有效学习天数、完成章节数、查阅词数和关键抉择/辨析的首次作答情况，可导出本地海报。 |
| 受控身份 | 手机号+密码登录、邀请激活接口、HttpOnly 会话 Cookie、连续失败锁定和密码修改。 |
| 内容与发布门禁 | 提供内容结构、15 词预算、词条可解析性、错误支线等校验；完整检查还覆盖 API、前端构建和浏览器旅程。 |

## 交付边界

- “AI”描述的是产品与内容生产方向；当前学习运行时不调用大模型，也不提供对话式辅导。
- 数据库中有词汇复习状态字段，但共享预制章节尚不能按个人状态选择不同正文版本；对外应称“固定间隔语境复现”，不应宣称已经实现个体化 SM-2 调度。
- 当前内容仅覆盖已发布的 10 个章节；词汇库目标为高考 3500 词，不代表 3500 词均已进入故事。
- 部署者须自行确认词汇数据来源、许可、内容版权、未成年人保护、隐私告知与适用法律要求；仓库的内容和数据不构成这些事项的授权或合规结论。

## 技术结构

- 前端：React、Vite、Zustand
- API：Bun、Hono
- 数据：SQLite、Drizzle ORM
- 测试：Bun test、Playwright
- 生产进程：PM2 + Nginx

```text
浏览器
  ├─ React/Vite 静态站点
  └─ /api → Nginx → Bun/Hono API → SQLite
```

## 本地运行

### 前置条件

- Node.js（用于前端构建）
- Bun `1.2.18`（项目锁文件与正式部署脚本以此版本为准）
- npm

1. 安装依赖并准备本地配置：

```bash
npm install
cp .env.example .env
```

2. 编辑 `.env`。本地至少应设置一个不少于 32 字节的 `JWT_SECRET`；保留 `NODE_ENV=development`、`PORT=5123` 和 `DB_PATH=./data/curio.db` 即可使用默认本地地址。

3. 如果要从空 SQLite 文件初始化，而不是使用仓库中的试点数据，先创建目标目录，再建表和导入词汇：

```bash
mkdir -p data
DB_URL=./data/curio.db npm run db:push
npm run db:seed
```

> 空库只包含表结构和词汇库。章节内容、受邀用户和已发布状态需要由运营方按内容发布流程另行导入；不要把含真实用户数据的 `data/curio.db` 直接分发或提交。

4. 分别启动 API 与 Web：

```bash
npm run dev:api
npm run dev:web
```

打开 `http://localhost:5173`。Vite 会将 `/api` 代理到默认的 `http://localhost:8899`；若 API 按 `.env` 的 `PORT=5123` 启动，请在启动前设置：

```bash
VITE_API_PROXY_TARGET=http://localhost:5123 npm run dev:web
```

## 自部署（Linux + HTTPS）

以下步骤面向具备 Linux、Nginx 和 PM2 运维能力的部署者。建议先在隔离环境完成演练，再迁移真实试点数据。生产环境必须使用 HTTPS；不应以 IP + HTTP 方式承载真实用户会话。

### 1. 准备服务器

- 安装 Node.js、npm、PM2、Nginx 和 **Bun 1.2.18**。
- 将项目放到固定目录（示例：`/var/www/curio`）。`ecosystem.config.js` 默认即使用这个路径；若使用其他目录，先同步修改其中的 `cwd` 与 Bun 可执行文件路径。
- 以受控方式将 SQLite 数据库放在 `data/curio.db`，并在发布前完成备份。生产数据库、`.env` 和任何备份都不应被同步脚本覆盖。

### 2. 配置环境变量

将 `.env.example` 复制为服务器上的 `.env`，并至少设置：

```dotenv
NODE_ENV=production
PORT=5123
DB_PATH=./data/curio.db
DB_URL=./data/curio.db
JWT_SECRET=请通过密钥管理服务注入不少于32字节的随机值
ALLOWED_ORIGINS=https://your-domain.example
ALLOW_HTTP_COOKIES=false
BUN_VERSION=1.2.18
BUN_BIN=/root/.bun/bin/bun-1.2.18
VITE_API_BASE_URL=/api
```

将 `.env` 权限限制为部署账号可读写，例如 `chmod 600 .env`。不要把实际密钥、手机号、密码、数据库或备份提交到仓库。`LLM_*` 配置只供离线内容生成脚本使用；日常学习服务不需要它们。

### 3. 构建、迁移并启动

在项目根目录执行：

```bash
./deploy.sh
```

脚本会检查 Bun 版本、`.env` 权限、`JWT_SECRET`、数据库存在性，使用冻结锁文件安装依赖，运行学习表/手机号唯一性迁移，构建前端并执行内容门禁，最后通过 PM2 重载 API 和本机健康检查。

部署完成后检查：

```bash
curl --fail http://127.0.0.1:5123/api/health
pm2 status curio-api
```

### 4. 配置 Nginx 与 TLS

以 [nginx.conf.example](nginx.conf.example) 为基础：

1. 替换域名、证书路径和项目根目录；
2. 将 `/` 指向 `apps/web/dist`，将 `/api/` 反向代理到 `127.0.0.1:5123`；
3. 配置有效 TLS 证书；HTTP 仅用于 301 跳转 HTTPS；
4. 测试配置并平滑重载 Nginx；
5. 从浏览器验证登录、章节开始/完成、刷新恢复和报告读取。

Cookie 是否设置 `Secure` 取决于反向代理传入的 `X-Forwarded-Proto`。请保留示例中的该请求头，且始终让 `ALLOW_HTTP_COOKIES=false`。

### 数据同步与备份

发布代码前，可先预览安全同步范围：

```bash
scripts/sync-deploy.sh deploy-user@example.com:/var/www/curio/
```

确认差异后才追加 `--apply`。该脚本默认排除 `.env`、`data/`、依赖和测试产物，不会删除远端未知文件。

备份 SQLite 数据库：

```bash
bun scripts/backup-db.ts
```

该脚本生成带时间戳的备份及源数据库的 SHA-256。对于 WAL 模式数据库，应在服务维护窗口中验证备份可恢复性；重要升级前保留可回滚的代码目录和已验证备份。

## 验证与质量门禁

```bash
# API 测试使用隔离数据库，不会写入 data/curio.db
npm run test:api

# 词汇与内容发布校验
npm run test:content

# 浏览器旅程测试
npm run test:e2e

# 发布前完整检查
npm run quality:check
```

完整检查包括凭据泄露扫描、前端构建、隔离 API 测试、内容校验和 Playwright 测试。运行浏览器测试前，请确保本机已具备 Playwright 所需浏览器环境。

## GitHub CI 与受控部署

仓库在 PR 和 `main` 推送时自动运行 CI。只有 `main` 的 CI 成功后，GitHub 才会创建 `production` 部署并等待人工批准；生产密钥只配置在该 Environment 中。完整的 GitHub 配置、服务器前置条件和恢复边界见 [受控部署说明](docs/operations/github-actions-controlled-deploy.md)。

## 目录概览

```text
apps/web/              React 学习端
apps/api/              Hono API、鉴权、学习会话与报告
packages/db/           SQLite schema、数据库访问与词库导入
data/                  SQLite 数据库、词汇 CSV 与审计结果
scripts/               迁移、备份、内容校验与受控同步脚本
docs/prd/              产品需求
docs/spec/             研发规格
docs/adr/              关键决策记录
```

## 相关文档

- [当前产品术语与阶段边界](CONTEXT.md)
- [P1 功能测试地图](docs/quality/feature-test-matrix.md)
- [词汇字段来源审计](docs/quality/2026-08-13-vocab-field-provenance-audit-p0-b.md)
- [部署前安全修复说明](docs/security/2026-08-13-p0-a-credential-remediation.md)

## 许可与贡献

仓库暂未声明开源许可证。在获得维护者明确授权前，不应将其视为可再分发、商用或公开部署的软件。
