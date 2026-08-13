#!/usr/bin/env bash

# ==============================================================================
# Curio 受控试点/生产环境构建与 PM2 启动部署脚本
# ==============================================================================

set -euo pipefail

project_root="$(cd "$(dirname "$0")" && pwd)"
cd "$project_root"

echo "🚀 开始 Curio 生产环境构建与部署..."

# The lockfile format is part of the release contract. Do not let an older Bun
# silently rewrite it and then continue with an unverified reload.
required_bun_version="${BUN_VERSION:-1.2.18}"
if [ -n "${BUN_BIN:-}" ]; then
  bun_bin="$BUN_BIN"
elif [ -x /root/.bun/bin/bun ]; then
  bun_bin="/root/.bun/bin/bun"
else
  bun_bin="$(command -v bun || true)"
fi

if [ -z "$bun_bin" ] || [ ! -x "$bun_bin" ]; then
  echo "❌ 找不到 Bun；请设置 BUN_BIN 为已安装的 Bun 可执行文件。"
  exit 1
fi

actual_bun_version="$($bun_bin --version)"
if [ "$actual_bun_version" != "$required_bun_version" ]; then
  echo "❌ Bun 版本必须为 $required_bun_version，当前为 $actual_bun_version。"
  exit 1
fi

# 1. 检查环境变量与数据边界。部署目标必须预先安全注入配置，
# 不得用仓库模板覆盖真实配置，也不得静默创建空生产数据库。
if [ ! -f .env ]; then
  echo "❌ 未发现 .env；请通过受控渠道注入环境配置后重试。"
  exit 1
fi
if [ ! -f data/curio.db ]; then
  echo "❌ 未发现 data/curio.db；请先恢复或安全注入已备份的数据文件。"
  exit 1
fi

env_mode="$(stat -c '%a' .env 2>/dev/null || stat -f '%Lp' .env)"
if [ $((8#$env_mode & 077)) -ne 0 ]; then
  echo "❌ .env 权限过宽；请限制为仅部署账号可读写。"
  exit 1
fi

echo "🔐 正在校验必需安全变量..."
"$bun_bin" -e '
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    console.error("❌ JWT_SECRET 必须通过环境或密钥管理服务注入，且至少 32 字节。");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP_COOKIES === "true") {
    console.error("❌ 生产环境不得启用 ALLOW_HTTP_COOKIES。");
    process.exit(1);
  }
'

# 2. 安装依赖包
echo "📦 正在安装依赖包..."
package_registry="${BUN_REGISTRY:-https://registry.npmjs.org}"
"$bun_bin" install --frozen-lockfile --registry="$package_registry"

# Explicit, idempotent migrations run before the process receives traffic.
echo "🗃️ 正在校验学习表与手机号唯一性..."
"$bun_bin" scripts/migrate-learning-schema.ts
"$bun_bin" scripts/migrate-phone-uniqueness.ts

# 3. 构建前端生产产物
echo "🏗️ 正在构建前端 React 静态产物..."
npm run build

echo "📚 正在执行发布内容门禁..."
"$bun_bin" scripts/verify-content-and-vocab.ts

# 4. 使用 PM2 启动/重启后端 API 服务
echo "⚡ 正在使用 PM2 启动/重启后端服务..."
pm2 startOrReload ecosystem.config.js --update-env

echo "🔎 验证 API 健康状态..."
health_ready=false
for attempt in 1 2 3 4 5 6; do
  if curl --fail --silent --show-error http://127.0.0.1:5123/api/health >/dev/null; then
    health_ready=true
    break
  fi
  sleep 2
done
if [ "$health_ready" != "true" ]; then
  echo "❌ API 在启动等待窗口内未通过健康检查。"
  exit 1
fi

echo "==========================================================="
echo "🎉 Curio 生产部署完成！"
echo "  └─ 后端 API: http://127.0.0.1:5123"
echo "  └─ 前端产物: apps/web/dist"
echo "==========================================================="
