#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: scripts/sync-deploy.sh <user@host:/absolute/target/> [--apply]"
  exit 2
fi

target="$1"
mode="${2:-}"
if [[ "$target" != *@*:*/* ]] || [[ "$target" == *":/" ]]; then
  echo "❌ 目标必须是明确的远程项目目录，不能是服务器根目录。"
  exit 2
fi
if [ -n "$mode" ] && [ "$mode" != "--apply" ]; then
  echo "❌ 未知参数；仅支持 --apply。"
  exit 2
fi

project_root="$(cd "$(dirname "$0")/.." && pwd)"
rsync_args=(
  -az
  --exclude=.git/
  --exclude=.env
  --exclude='.env.*'
  --exclude=data/
  --exclude=node_modules/
  --exclude=.scratch/
  --exclude=playwright-report/
  --exclude=test-results/
)
if [ "$mode" != "--apply" ]; then
  rsync_args+=(--dry-run --itemize-changes)
  echo "🔎 仅预览同步；不会修改远端。确认后追加 --apply。"
fi

# Unknown server-side files remain untouched; synchronization is additive.
rsync "${rsync_args[@]}" "$project_root/" "$target"
