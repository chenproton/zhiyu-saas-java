#!/bin/bash
#
# deploy.sh - 知育 SaaS 全 Docker 化一键部署/更新脚本
#
# 功能：
#   1. 空白服务器首次部署：自动安装 Docker/Go/Node/pnpm 等依赖，初始化数据库+种子数据
#   2. 已有服务升级：增量构建，仅编译变更部分，跳过未改动的镜像构建
#
# 用法：
#   ./deploy.sh --branch feat/xxx    分支隔离部署
#   ./deploy.sh --local              本地当前目录直接部署
#   ./deploy.sh --install-deps       仅安装/检查依赖（Docker, Go, Node, pnpm）
#
set -euo pipefail

# ──────────────────────── 参数解析 ────────────────────────
BACKEND_ONLY=false; FRONTEND_ONLY=false
SKIP_CHECKS=false; SKIP_MERGE=false; FORCE_INSTALL=0
BRANCH_NAME=""; CLEAN_BUILD=false; INSTALL_DEPS_ONLY=false
BACKEND_PORT=8080; EDU_PORT=3020
DEPLOY_DIR="/opt/zhiyu-saas"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend|-b) BACKEND_ONLY=true; shift ;;
    --frontend|-f) FRONTEND_ONLY=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --force-install) FORCE_INSTALL=1; shift ;;
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --local) BRANCH_NAME=""; shift ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --install-deps) INSTALL_DEPS_ONLY=true; shift ;;
    --help|-h)
      echo "用法:"
      echo "  $0 --branch <分支名>   分支隔离部署"
      echo "  $0 --local             本地目录直接部署"
      echo "  $0 --install-deps      仅安装系统依赖"
      echo ""
      echo "选项: --backend|-b 仅后端  --frontend|-f 仅前端"
      echo "      --force-install 强制重装  --clean 清缓存  --skip-checks"
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

[[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]] && { echo "错误：--backend 和 --frontend 互斥" >&2; exit 1; }

# ──────────────────────── 路径 ────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGINAL_ROOT="$SCRIPT_DIR"
PROJECT_ROOT="$SCRIPT_DIR"
DEPLOY_COMPOSE="$DEPLOY_DIR/docker-compose.yml"
BUILD_CACHE="$DEPLOY_DIR/.build-cache"

# ──────────────────────── 依赖自动安装 ────────────────────────
install_deps() {
  echo "==> 检查系统依赖..."

  # ── Docker ──
  if ! command -v docker >/dev/null 2>&1; then
    echo "  安装 Docker..."
    if command -v apt-get >/dev/null 2>&1; then
      curl -fsSL https://get.docker.com | bash 2>/dev/null || {
        apt-get update -qq && apt-get install -y -qq docker.io docker-compose-v2 && \
        systemctl enable --now docker; }
    elif command -v yum >/dev/null 2>&1; then
      yum install -y docker && systemctl enable --now docker
    else
      echo "  错误：请手动安装 Docker (https://docs.docker.com/engine/install/)" >&2; exit 1
    fi
  fi

  if ! docker compose version >/dev/null 2>&1; then
    docker_compose_plugin_install || true
  fi

  # Ensure docker daemon is running
  if ! docker info >/dev/null 2>&1; then
    systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
    sleep 2
  fi

  # ── Go ──
  if ! command -v go >/dev/null 2>&1; then
    echo "  安装 Go..."
    GO_VER="1.25.0"
    ARCH=$(uname -m); [[ "$ARCH" == "x86_64" ]] && ARCH="amd64"; [[ "$ARCH" == "aarch64" ]] && ARCH="arm64"
    curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-${ARCH}.tar.gz" -o /tmp/go.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz && rm -f /tmp/go.tar.gz
    export PATH="/usr/local/go/bin:$PATH"
    echo "export PATH=\"/usr/local/go/bin:\$PATH\"" >> /etc/profile.d/go.sh 2>/dev/null || true
  fi
  export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

  # ── Node.js + pnpm ──
  if ! command -v node >/dev/null 2>&1; then
    echo "  安装 Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
    apt-get install -y -qq nodejs 2>/dev/null || {
      # Fallback: install via node binary
      curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -o /tmp/node.tar.xz
      tar -C /usr/local --strip-components=1 -xJf /tmp/node.tar.xz && rm -f /tmp/node.tar.xz; }
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "  安装 pnpm..."
    npm install -g pnpm 2>/dev/null || corepack enable pnpm 2>/dev/null || true
  fi

  # ── PostgreSQL client ──
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    if ! command -v psql >/dev/null 2>&1; then
      apt-get install -y -qq postgresql-client 2>/dev/null || \
        yum install -y postgresql 2>/dev/null || true
    fi
  fi

  # ── Python3 (for URL decode) ──
  if ! command -v python3 >/dev/null 2>&1; then
    apt-get install -y -qq python3 2>/dev/null || yum install -y python3 2>/dev/null || true
  fi

  # ── git ──
  if ! command -v git >/dev/null 2>&1; then
    apt-get install -y -qq git 2>/dev/null || yum install -y git 2>/dev/null || true
  fi

  echo "  依赖检查完成"
}

install_deps
[[ "$INSTALL_DEPS_ONLY" == "true" ]] && { echo "✨ 依赖安装完毕"; exit 0; }

# ──────────────────────── 环境加载 ────────────────────────
[[ -f "$PROJECT_ROOT/.env" ]] && { set -a; source "$PROJECT_ROOT/.env"; set +a; }
BACKEND_PORT="${PORT:-$BACKEND_PORT}"

IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"

DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(echo "${DATABASE_URL:-}" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' | python3 -c 'import urllib.parse,sys; print(urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null || echo "")
DB_PASSWORD_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}', safe=''))" 2>/dev/null || echo "$DB_PASSWORD")
MIGRATE_URL="postgres://${DB_USER}:${DB_PASSWORD_ENC}@127.0.0.1:5433/${DB_NAME}?sslmode=disable"

export IMAGE_TAG BACKEND_PORT EDU_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET

# ──────────────────────── git 校验 ────────────────────────
if [[ -n "$BRANCH_NAME" ]]; then
  [[ -n "$(git -C "$ORIGINAL_ROOT" status --porcelain 2>/dev/null)" ]] && {
    echo "错误：工作区不干净" >&2; git -C "$ORIGINAL_ROOT" status --short; exit 1; }
  git -C "$ORIGINAL_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  lc=$(git -C "$ORIGINAL_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  oc=$(git -C "$ORIGINAL_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && { echo "错误：origin/$BRANCH_NAME 不存在" >&2; exit 1; }
  [[ "$lc" != "$oc" ]] && { echo "错误：分支未推送" >&2; exit 1; }
fi

# ──────────────────────── 部署锁 ────────────────────────
LOCK_FILE="/tmp/zhiyu-deploy.lock"
exec {LOCK_FD}>"$LOCK_FILE"
flock "$LOCK_FD" || { echo "等待部署锁..."; flock "$LOCK_FD"; }

cleanup() { exec {LOCK_FD}>&- 2>/dev/null || true; }
trap cleanup EXIT

# ──────────────────────── 目录初始化 ────────────────────────
mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" "$DEPLOY_DIR/.rollback" "$BUILD_CACHE"

# ═══════════════════════════════════════════════════════════
# 分支模式：构建 worktree
# ═══════════════════════════════════════════════════════════
BUILD_ROOT="$PROJECT_ROOT"
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  echo "==> 分支: $BRANCH_NAME"

  if [[ "$CLEAN_BUILD" == "true" ]]; then
    git -C "$ORIGINAL_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
    rm -rf "$BUILD_TREE"
  fi

  if [[ -e "$BUILD_TREE/.git" ]]; then
    echo "  复用 worktree"
    git -C "$BUILD_TREE" checkout --detach --force origin/master 2>/dev/null || true
  else
    [[ -d "$BUILD_TREE" ]] && rm -rf "$BUILD_TREE"
    git -C "$ORIGINAL_ROOT" worktree add --detach "$BUILD_TREE" origin/master || {
      echo "错误：无法创建 worktree" >&2; exit 1; }
  fi

  rm -rf "$BUILD_TREE/apps/edu/.next" "$BUILD_TREE/backend/bin" 2>/dev/null || true
  git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit || {
    echo "错误：合并冲突" >&2; git -C "$BUILD_TREE" merge --abort 2>/dev/null; exit 1; }
  [[ -f "$ORIGINAL_ROOT/.env" ]] && cp "$ORIGINAL_ROOT/.env" "$BUILD_TREE/.env"

  BUILD_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$BUILD_ROOT/backend"
EDU_DIR="$BUILD_ROOT/apps/edu"

# ═══════════════════════════════════════════════════════════
# 构建后端
# ═══════════════════════════════════════════════════════════
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo ""; echo "==> 构建后端"

  BIN_HASH=$(md5sum "$BACKEND_DIR/cmd/server/main.go" 2>/dev/null | awk '{print $1}')
  CACHED_HASH=""; [[ -f "$BUILD_CACHE/backend-bin-hash" ]] && CACHED_HASH=$(cat "$BUILD_CACHE/backend-bin-hash")

  if [[ -n "$CACHED_HASH" && "$BIN_HASH" == "$CACHED_HASH" && -n "$(docker images -q zhiyu-backend:$IMAGE_TAG 2>/dev/null)" ]]; then
    echo "  = 跳过 (无变更)"
  else
    echo "  编译..."
    CGO_ENABLED=0 go build -C "$BACKEND_DIR" -ldflags="-s -w" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go

    echo "  Docker 镜像 ($(du -h "$BACKEND_DIR/bin/server" | cut -f1))..."
    TMPCTX=$(mktemp -d)
    cp "$BACKEND_DIR/bin/server" "$TMPCTX/server"
    mkdir -p "$TMPCTX/migrations"
    rsync -a --delete "$BACKEND_DIR/migrations/" "$TMPCTX/migrations/"
    docker build -t "zhiyu-backend:$IMAGE_TAG" -f "$BACKEND_DIR/Dockerfile" "$TMPCTX" 2>&1 | tail -3
    rm -rf "$TMPCTX"
    echo "$BIN_HASH" > "$BUILD_CACHE/backend-bin-hash"
  fi
fi

# ═══════════════════════════════════════════════════════════
# 构建前端
# ═══════════════════════════════════════════════════════════
if [[ "$BACKEND_ONLY" != "true" ]]; then
  echo ""; echo "==> 构建前端"

  CHANGED=false
  if [[ -n "$BRANCH_NAME" ]]; then
    FILES=$(git -C "$BUILD_ROOT" diff --name-only HEAD origin/master 2>/dev/null | grep -E "^apps/edu/|^packages/" || true)
    [[ -n "$FILES" ]] && CHANGED=true
  fi
  [[ ! -d "$EDU_DIR/.next/standalone" ]] && CHANGED=true
  [[ "$FORCE_INSTALL" == "1" ]] && CHANGED=true

  if $CHANGED; then
    echo "  安装依赖..."
    (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || { echo "错误：pnpm install 失败" >&2; exit 1; }

    echo "  构建 Next.js..."
    rm -rf "$EDU_DIR/.next"
    (cd "$BUILD_ROOT" && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/edu build) || { echo "错误：前端构建失败" >&2; exit 1; }

    echo "  组装 standalone..."
    SD="$EDU_DIR/.next/standalone/apps/edu"
    [[ -d "$EDU_DIR/.next/static" ]] && { mkdir -p "$SD/.next/static"; rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/static/" "$SD/.next/static/"; }
    [[ -d "$EDU_DIR/public" ]] && { mkdir -p "$SD/public"; rsync -a --delete "$EDU_DIR/public/" "$SD/public/"; }

    echo "  Docker 镜像..."
    docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR/.next/standalone" 2>&1 | tail -3
  else
    echo "  = 跳过 (无变更)"
  fi
fi

# ═══════════════════════════════════════════════════════════
# Docker 部署
# ═══════════════════════════════════════════════════════════
echo ""; echo "==> 部署到 Docker"

cp "$BUILD_ROOT/deploy/docker-compose.yml" "$DEPLOY_COMPOSE"

docker compose -f "$DEPLOY_COMPOSE" up -d --remove-orphans 2>&1 | tail -5

# ── 等待 PostgreSQL 就绪 ──
for i in $(seq 1 30); do
  docker compose -f "$DEPLOY_COMPOSE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done

# ── 数据库迁移 ──
echo "  数据库迁移..."
for i in $(seq 1 15); do psql "$MIGRATE_URL" -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

if [[ ! -f "$DEPLOY_DIR/.migration-baseline-done" ]]; then
  psql "$MIGRATE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null
  psql "$MIGRATE_URL" -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3
  psql "$MIGRATE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null
  touch "$DEPLOY_DIR/.migration-baseline-done"

  echo "  初始化种子数据..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/seed/main.go) || {
    echo "  警告：种子初始化失败" >&2; }
  echo "  = 运营方租户: platform / 管理员: admin / admin123"
else
  echo "  增量迁移..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/migrate/main.go up) || echo "  警告：迁移可能已是最新"
fi

# ── 等待健康检查 ──
echo ""; echo "==> 等待服务就绪..."
OK=true
for svc in backend frontend; do
  found=false
  for i in $(seq 1 45); do
    S=$(docker compose -f "$DEPLOY_COMPOSE" ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
    if [[ "$S" == "healthy" ]]; then
      echo "  $svc healthy"; found=true; break
    fi
    sleep 2
  done
  if ! $found; then
    echo "  $svc 未就绪" >&2; OK=false
  fi
done

[[ "$OK" != "true" ]] && { echo "部署失败" >&2; docker compose -f "$DEPLOY_COMPOSE" logs backend --tail 30; exit 1; }

docker compose -f "$DEPLOY_COMPOSE" ps
docker builder prune --all --force >/dev/null 2>&1 || true

# ═══════════════════════════════════════════════════════════
# Nginx + 合并
# ═══════════════════════════════════════════════════════════
NGINX_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
NGINX_DST="/opt/1panel/www/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  cmp -s "$NGINX_CONF" "$NGINX_DST" 2>/dev/null || { cp "$NGINX_CONF" "$NGINX_DST"; echo "  Nginx 配置已更新"; }
  docker exec openresty nginx -t 2>/dev/null && docker exec openresty nginx -s reload 2>/dev/null && echo "  OpenResty 重载成功" || echo "  警告：OpenResty 未运行，跳过" >&2
fi

if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  echo ""; echo "==> 合并 $BRANCH_NAME → master"
  git -C "$ORIGINAL_ROOT" checkout master 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" pull origin master --ff-only 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" push origin master 2>/dev/null && \
  echo "  ✅ 已合并" || echo "  ⚠️  合并跳过"
fi

echo ""; echo "✨ 部署完成！"
echo "   后端: http://localhost:$BACKEND_PORT"
echo "   前端: http://localhost:$EDU_PORT"
echo "   管理: admin / admin123  (SaaS 登录)"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"
