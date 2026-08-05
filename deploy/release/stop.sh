#!/bin/bash
# stop.sh - 停止知与 SaaS 全部服务（数据保留在 Docker 卷中，可随时 start.sh 恢复）
set -euo pipefail

DEPLOY_DIR="/opt/zhiyu-saas"
[[ -f "$DEPLOY_DIR/docker-compose.yml" ]] || { echo "未检测到安装记录，请先运行 ./install.sh" >&2; exit 1; }

if grep -q '^ENABLE_KKFILEVIEW=true' "$DEPLOY_DIR/.env" 2>/dev/null; then
  export COMPOSE_PROFILES="kkfileview"
fi

docker compose -f "$DEPLOY_DIR/docker-compose.yml" down
echo "已停止（数据库/上传数据保留）"
