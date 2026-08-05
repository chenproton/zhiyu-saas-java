#!/bin/bash
# start.sh - 启动知与 SaaS 全部服务（已安装后使用）
set -euo pipefail

DEPLOY_DIR="/opt/zhiyu-saas"
[[ -f "$DEPLOY_DIR/docker-compose.yml" ]] || { echo "未检测到安装记录，请先运行 ./install.sh" >&2; exit 1; }

if grep -q '^ENABLE_KKFILEVIEW=true' "$DEPLOY_DIR/.env" 2>/dev/null; then
  export COMPOSE_PROFILES="kkfileview"
fi

docker compose -f "$DEPLOY_DIR/docker-compose.yml" up -d --remove-orphans
sleep 5
docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps
echo ""
echo "入口: http://<服务器IP>:$(grep '^NGINX_PORT=' "$DEPLOY_DIR/.env" | cut -d= -f2)/portal/login"
