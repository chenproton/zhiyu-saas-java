#!/bin/bash
#
# deploy.sh - 知育 SaaS 全 Docker 化部署脚本
#
# 用法:
#   分支部署:  ./deploy.sh --branch feat/xxx [--backend|-b] [--frontend|-f] [--skip-checks] [--clean]
#   本地部署:  ./deploy.sh --local [--backend|-b] [--frontend|-f]
#
set -euo pipefail

BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_CHECKS=false
SKIP_MERGE=false
FORCE_INSTALL=0
BRANCH_NAME=""
CLEAN_BUILD=false
BACKEND_PORT="${BACKEND_PORT:-8080}"
EDU_PORT="${EDU_PORT:-3020}"

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
    --help|-h)
      echo "用法: $0 --branch <分支名>|--local [选项]"
      echo "  --branch <n>  部署指定分支 (git worktree + merge)"
      echo "  --local       直接从当前目录构建部署"
      echo "  --backend,-b  仅后端"
      echo "  --frontend,-f 仅前端"
      echo "  --skip-checks 跳过代码检查"
      echo "  --force-install 强制重装 pnpm 依赖"
      echo "  --clean       清理构建缓存"
      echo "  --skip-merge  不自动合并到 master"
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

[[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]] && { echo "错误：--backend 和 --frontend 互斥" >&2; exit 1; }

# ─── 路径配置 ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGINAL_PROJECT_ROOT="$SCRIPT_DIR"
PROJECT_ROOT="$SCRIPT_DIR"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
DEPLOY_COMPOSE="$DEPLOY_DIR/docker-compose.yml"
BUILD_CACHE="$DEPLOY_DIR/.build-cache"

# ─── 环境加载 ───
[[ -f "$PROJECT_ROOT/.env" ]] && { set -a; source "$PROJECT_ROOT/.env"; set +a; }
BACKEND_PORT="${PORT:-$BACKEND_PORT}"
IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"
DB_USER="${DB_USER:-zhiyu_saas}"
DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(echo "${DATABASE_URL:-}" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' | python3 -c 'import urllib.parse,sys; print(urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null || echo "")
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}', safe=''))" 2>/dev/null || echo "$DB_PASSWORD")
MIGRATE_URL="postgres://${DB_USER}:${DB_PASSWORD_ENCODED}@127.0.0.1:5433/${DB_NAME}?sslmode=disable"
export IMAGE_TAG BACKEND_PORT EDU_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET

# ─── git 校验 ───
if [[ -n "$BRANCH_NAME" ]]; then
  [[ -n "$(git -C "$ORIGINAL_PROJECT_ROOT" status --porcelain 2>/dev/null)" ]] && {
    echo "错误：工作区不干净" >&2; git -C "$ORIGINAL_PROJECT_ROOT" status --short; exit 1; }
  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  lc=$(git -C "$ORIGINAL_PROJECT_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  oc=$(git -C "$ORIGINAL_PROJECT_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && { echo "错误：origin/$BRANCH_NAME 不存在" >&2; exit 1; }
  [[ "$lc" != "$oc" ]] && { echo "错误：分支未推送" >&2; exit 1; }
fi

# ─── 排除依赖检查 (Go) ───
checkdep() { command -v "$1" >/dev/null 2>&1 || { echo "错误：缺少 $1" >&2; exit 1; }; }
[[ "$FRONTEND_ONLY" != "true" ]] && { for d in go docker psql pg_dump; do checkdep "$d"; done; }
[[ "$BACKEND_ONLY" != "true" ]] && { checkdep node; checkdep docker; }
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

# ─── 部署锁 ───
LOCK_FILE="/tmp/zhiyu-deploy.lock"
exec {LOCK_FD}>"$LOCK_FILE"
flock "$LOCK_FD" || { echo "等待部署锁..."; flock "$LOCK_FD"; }

cleanup() { exec {LOCK_FD}>&- 2>/dev/null || true; }
trap cleanup EXIT

# ─── 目录初始化 ───
mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" "$DEPLOY_DIR/.rollback" "$BUILD_CACHE"

# ═════════════════════════════════════════════════════════════════
# 分支模式：构建 worktree
# ═════════════════════════════════════════════════════════════════
BUILD_ROOT="$PROJECT_ROOT"
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  echo "==> 构建分支: $BRANCH_NAME"

  if [[ "$CLEAN_BUILD" == "true" ]]; then
    git -C "$ORIGINAL_PROJECT_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
    rm -rf "$BUILD_TREE"
  fi

  if [[ -e "$BUILD_TREE/.git" ]]; then
    echo "  复用缓存"
    git -C "$BUILD_TREE" checkout --detach --force origin/master 2>/dev/null || true
    rm -rf "$BUILD_TREE/apps/edu/.next" "$BUILD_TREE/backend/bin" 2>/dev/null || true
  else
    [[ -d "$BUILD_TREE" ]] && rm -rf "$BUILD_TREE"
    git -C "$ORIGINAL_PROJECT_ROOT" worktree add --detach "$BUILD_TREE" origin/master || {
      echo "错误：无法创建 worktree" >&2; exit 1; }
  fi

  git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit || {
    echo "错误：合并冲突" >&2; git -C "$BUILD_TREE" merge --abort 2>/dev/null; exit 1; }
  [[ -f "$ORIGINAL_PROJECT_ROOT/.env" ]] && cp "$ORIGINAL_PROJECT_ROOT/.env" "$BUILD_TREE/.env"

  BUILD_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$BUILD_ROOT/backend"
EDU_DIR="$BUILD_ROOT/apps/edu"

# ═════════════════════════════════════════════════════════════════
# 构建后端
# ═════════════════════════════════════════════════════════════════
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo ""; echo "==> 构建后端"

  BIN_HASH=$(md5sum "$BACKEND_DIR/cmd/server/main.go" 2>/dev/null | awk '{print $1}')
  CACHED_HASH=""; [[ -f "$BUILD_CACHE/backend-bin-hash" ]] && CACHED_HASH=$(cat "$BUILD_CACHE/backend-bin-hash")

  if [[ -n "$CACHED_HASH" && "$BIN_HASH" == "$CACHED_HASH" && -n "$(docker images -q zhiyu-backend:$IMAGE_TAG 2>/dev/null)" ]]; then
    echo "  = 跳过 (源码未变更且镜像已存在)"
  else
    echo "  编译 (CGO_ENABLED=0)..."
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

  # 数据库备份 (优先 Docker PG，不可用时回退到宿主机 PG)
  BACKUP_URL="$MIGRATE_URL"
  if ! pg_isready -d "$BACKUP_URL" >/dev/null 2>&1; then
    BACKUP_URL="${DATABASE_URL:-}"
  fi
  if [[ -n "$BACKUP_URL" ]] && pg_isready -d "$BACKUP_URL" >/dev/null 2>&1; then
    BT=$(date +%Y%m%d-%H%M%S)
    pg_dump -d "$BACKUP_URL" -Fc -Z 6 > "$DEPLOY_DIR/backups/backup-$BT.dump" 2>/dev/null && \
      echo "  备份: backup-$BT.dump" || true
    find "$DEPLOY_DIR/backups" -name "backup-*.dump" -mtime +14 -delete 2>/dev/null || true
  fi
fi

# ═════════════════════════════════════════════════════════════════
# 构建前端
# ═════════════════════════════════════════════════════════════════
if [[ "$BACKEND_ONLY" != "true" ]]; then
  echo ""; echo "==> 构建前端"

  # 检测是否需构建
  CHANGED=false
  if [[ -n "$BRANCH_NAME" ]]; then
    CHANGED_FILES=$(git -C "$BUILD_ROOT" diff --name-only HEAD origin/master 2>/dev/null | grep -E "^apps/edu/|^packages/" || true)
    [[ -n "$CHANGED_FILES" ]] && CHANGED=true
  fi
  [[ ! -d "$EDU_DIR/.next" ]] && CHANGED=true
  [[ "$FORCE_INSTALL" == "1" ]] && CHANGED=true

  if $CHANGED; then
    echo "  安装依赖..."
    (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || { echo "错误：pnpm install 失败" >&2; exit 1; }

    echo "  构建 Next.js..."
    rm -rf "$EDU_DIR/.next"
    (cd "$BUILD_ROOT" && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/edu build) || { echo "错误：前端构建失败" >&2; exit 1; }

    echo "  构建 Docker 镜像..."
    docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR/.next/standalone" 2>&1 | tail -3
  else
    echo "  = 跳过 (无变更)"
  fi
fi

# ═════════════════════════════════════════════════════════════════
# Docker 部署
# ═════════════════════════════════════════════════════════════════
echo ""; echo "==> 部署到 Docker"

cp "$BUILD_ROOT/deploy/docker-compose.yml" "$DEPLOY_COMPOSE"

echo "  停止宿主机 PostgreSQL/Redis（端口由 Docker 接管）..."
systemctl stop postgresql 2>/dev/null || true
systemctl stop redis-server 2>/dev/null || redis-cli shutdown 2>/dev/null || true

EXISTING=$(docker compose -f "$DEPLOY_COMPOSE" ps -q 2>/dev/null | wc -l | tr -d ' ')

if [[ "$EXISTING" -eq 0 ]]; then
  echo "  首次启动基础服务..."
  docker compose -f "$DEPLOY_COMPOSE" up -d postgres redis
  for i in $(seq 1 30); do
    docker compose -f "$DEPLOY_COMPOSE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
    sleep 2
  done
fi

echo "  数据库迁移..."
for i in $(seq 1 15); do psql "$MIGRATE_URL" -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

if [[ ! -f "$DEPLOY_DIR/.migration-baseline-done" ]]; then
  echo "  应用 baseline schema..."
  psql "$MIGRATE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null
  psql "$MIGRATE_URL" -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3
  psql "$MIGRATE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null
  touch "$DEPLOY_DIR/.migration-baseline-done"

  echo "  检测种子数据..."
  DOCKER_USER_COUNT=$(psql "$MIGRATE_URL" -t -A -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
  if [[ "$DOCKER_USER_COUNT" == "0" ]]; then
    if [[ -n "${DATABASE_URL:-}" ]] && pg_isready -d "${DATABASE_URL:-}" >/dev/null 2>&1; then
      echo "  首次部署：从宿主机 PG 迁移数据到 Docker PG..."
      pg_dump "${DATABASE_URL:-}" --data-only --no-owner --inserts 2>/dev/null > "$DEPLOY_DIR/.seed_data.sql"
      if [[ -s "$DEPLOY_DIR/.seed_data.sql" ]]; then
        psql "$MIGRATE_URL" -f "$DEPLOY_DIR/.seed_data.sql" 2>&1 | tail -3
        echo "  数据迁移完成 ($(wc -l < "$DEPLOY_DIR/.seed_data.sql") 行)"
      fi
      rm -f "$DEPLOY_DIR/.seed_data.sql"
    else
      echo "  全新环境：运行种子数据初始化..."
      (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/seed/main.go) || {
        echo "  警告：种子初始化失败，请手动执行: go run ./cmd/seed/main.go" >&2
      }
      echo "  种子数据已初始化 (运营方租户: platform / 管理员: admin / admin123)"
    fi
  fi
else
  echo "  增量迁移..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/migrate/main.go up) || echo "  警告：增量迁移可能已是最新"
fi

echo "  启动服务..."
docker compose -f "$DEPLOY_COMPOSE" up -d --remove-orphans 2>&1 | tail -5

echo ""; echo "==> 等待健康检查..."
OK=true
for svc in backend frontend; do
  for i in $(seq 1 30); do
    S=$(docker compose -f "$DEPLOY_COMPOSE" ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
    [[ "$S" == "healthy" ]] && { echo "  $svc healthy"; break; }
    sleep 2
  done
  [[ "$(docker compose -f "$DEPLOY_COMPOSE" ps "$svc" --format '{{.Health}}' 2>/dev/null)" != "healthy" ]] && {
    echo "  $svc 未就绪" >&2; OK=false; }
done

[[ "$OK" != "true" ]] && { echo "部署失败" >&2; docker compose -f "$DEPLOY_COMPOSE" logs backend --tail 30; exit 1; }

docker compose -f "$DEPLOY_COMPOSE" ps
docker builder prune --all --force >/dev/null 2>&1 || true

# ═════════════════════════════════════════════════════════════════
# Nginx + 合并
# ═════════════════════════════════════════════════════════════════
NGINX_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
NGINX_DST="/opt/1panel/www/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  cmp -s "$NGINX_CONF" "$NGINX_DST" 2>/dev/null || { cp "$NGINX_CONF" "$NGINX_DST"; echo "  Nginx 配置已更新"; }
  docker exec openresty nginx -t 2>/dev/null && docker exec openresty nginx -s reload 2>/dev/null && echo "  OpenResty 重载成功" || true
fi

if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  echo ""; echo "==> 合并 $BRANCH_NAME → master"
  git -C "$ORIGINAL_PROJECT_ROOT" checkout master 2>/dev/null && \
  git -C "$ORIGINAL_PROJECT_ROOT" pull origin master --ff-only 2>/dev/null && \
  git -C "$ORIGINAL_PROJECT_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null && \
  git -C "$ORIGINAL_PROJECT_ROOT" push origin master 2>/dev/null && \
  echo "  ✅ 已合并" || echo "  ⚠️  合并跳过"
fi

echo ""; echo "✨ 部署完成！"
echo "   后端: http://localhost:$BACKEND_PORT"
echo "   前端: http://localhost:$EDU_PORT"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"
