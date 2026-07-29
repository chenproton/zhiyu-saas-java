#!/bin/bash
#
# deploy.sh - 知育 SaaS 统一部署脚本（Docker 容器化）
#
# 开发环境（多 Agent 协作，分支隔离）：
#   ./deploy.sh --branch feat/agent-xxx [--backend-only|-b] [--frontend-only|-f] ...
#   基于 master 创建隔离工作树，仅合入指定分支改动，健康检查通过后自动合并。
#
# 演示/生产环境：
#   ./deploy.sh --demo [--backend-only|-b] [--frontend-only|-f] [--skip-pull] ...
#   直接 git pull master → 构建 → 部署 → 健康检查，无需分支。
#
# 架构：
#   - PostgreSQL + Redis + Go 后端 → Docker Compose 管理
#   - Next.js 前端（edu）→ PM2 管理
#   - OpenResty → Docker 容器反向代理
#
set -euo pipefail

BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_BACKUP=false
SKIP_CHECKS=false
SKIP_MERGE=false
FORCE_INSTALL=0
RUN_TYPECHECK=false
USE_TURBOPACK=true
BRANCH_NAME=""
BUILD_TREE=""
ORIGINAL_PROJECT_ROOT=""
DEMO_MODE=false
SKIP_PULL=false
CLEAN_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only|-b) BACKEND_ONLY=true; shift ;;
    --frontend-only|-f) FRONTEND_ONLY=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --force-install) FORCE_INSTALL=1; shift ;;
    --typecheck) RUN_TYPECHECK=true; shift ;;
    --turbopack) USE_TURBOPACK=true; shift ;;
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --demo) DEMO_MODE=true; shift ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --help|-h)
      echo "用法："
      echo "  开发环境: $0 --branch <分支名> [选项]"
      echo "  演示环境: $0 --demo [选项]"
      echo ""
      echo "选项："
      echo "  --backend-only,-b    仅部署后端（Docker Compose）"
      echo "  --frontend-only,-f   仅部署前端（PM2）"
      echo "  --skip-backup        跳过数据库备份"
      echo "  --skip-checks        跳过代码检查"
      echo "  --force-install      强制重装依赖"
      echo "  --typecheck          部署前执行 tsc --noEmit"
      echo "  --turbopack          使用 Turbopack 构建"
      echo "  --clean              强制清理构建缓存，从 master 全新构建"
      echo "  --skip-merge         跳过自动合并到 master（仅分支模式）"
      echo "  --skip-pull          跳过 git pull（仅 demo 模式）"
      exit 0
      ;;
    *) echo "错误：未知参数 $1" >&2; exit 1 ;;
  esac
done

if [[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]]; then
  echo "错误：--backend-only 和 --frontend-only 不能同时使用" >&2; exit 1
fi
if [[ "$DEMO_MODE" == "true" && -n "$BRANCH_NAME" ]]; then
  echo "错误：--demo 和 --branch 不能同时使用" >&2; exit 1
fi

export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ORIGINAL_PROJECT_ROOT="$PROJECT_ROOT"

BACKEND_PORT=8080
EDU_PORT=3020
PM2_EDU_NAME="zhiyu-edu"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
BACKUP_PREFIX="zhiyu-saas"

# ──────── 工作区洁净校验 ────────
if [[ -n "$BRANCH_NAME" ]]; then
  echo "==> 校验本地工作区..."
  if [[ -n "$(git -C "$ORIGINAL_PROJECT_ROOT" status --porcelain 2>/dev/null)" ]]; then
    echo "错误：本地工作区不干净，请先提交或清理" >&2
    git -C "$ORIGINAL_PROJECT_ROOT" status --short
    exit 1
  fi
fi

# ──────── 分支一致性校验 ────────
if [[ -n "$BRANCH_NAME" ]]; then
  echo "==> 校验分支一致性..."
  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  local_commit=$(git -C "$ORIGINAL_PROJECT_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  origin_commit=$(git -C "$ORIGINAL_PROJECT_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  if [[ -z "$origin_commit" ]]; then
    echo "错误：origin/$BRANCH_NAME 不存在，请先 git push" >&2; exit 1
  fi
  if [[ "$local_commit" != "$origin_commit" ]]; then
    echo "错误：本地 $BRANCH_NAME 与 origin/$BRANCH_NAME 不一致，请先 git push" >&2; exit 1
  fi
  echo "  分支一致性校验通过"
fi

# ──────── 部署锁 ────────
LOCK_FILE="/tmp/zhiyu-deploy.lock"
exec {LOCK_FD}>"$LOCK_FILE"
echo "==> 检查部署锁..."
if ! flock --nonblock "$LOCK_FD" 2>/dev/null; then
  echo "  另一部署正在进行中，等待其完成..."
  flock "$LOCK_FD"
fi
echo "  已获取部署锁"

cleanup() {
  exec {LOCK_FD}>&- 2>/dev/null || true
  rm -rf "$DEPLOY_TMP_DIR"
}
trap 'cleanup' EXIT

# ──────── 演示模式：拉取最新代码 ────────
PREV_COMMIT=""
if [[ "$DEMO_MODE" == "true" ]]; then
  if [[ "$SKIP_PULL" != "true" ]]; then
    echo "==> 拉取最新代码..."
    PREV_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "")
    git -C "$PROJECT_ROOT" pull origin master 2>&1 || {
      echo "错误：git pull 失败，使用 --skip-pull 跳过" >&2; exit 1
    }
  else
    echo "==> 跳过 git pull（--skip-pull）"
    if [[ -f "$DEPLOY_DIR/.last-commit" ]]; then PREV_COMMIT=$(cat "$DEPLOY_DIR/.last-commit"); fi
  fi
fi

# ──────── 分支模式：工作树构建 ────────
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  echo "==> 分支隔离部署模式"
  echo "  目标分支: $BRANCH_NAME"

  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  git -C "$ORIGINAL_PROJECT_ROOT" worktree prune 2>/dev/null || true

  if [[ "$CLEAN_BUILD" == "true" ]]; then
    echo "  强制清理构建缓存（--clean）..."
    git -C "$ORIGINAL_PROJECT_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
    rm -rf "$BUILD_TREE"
  fi

  if [[ -e "$BUILD_TREE/.git" ]] && git -C "$BUILD_TREE" rev-parse --git-dir >/dev/null 2>&1; then
    echo "  复用构建缓存: $BUILD_TREE"
    git -C "$BUILD_TREE" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
    git -C "$BUILD_TREE" checkout --detach --force origin/master || {
      echo "错误：无法切换到最新 master" >&2; exit 1
    }
    rm -rf "$BUILD_TREE/apps/edu/.next" "$BUILD_TREE/backend/bin" "$BUILD_TREE/backend/tmp"
  else
    [[ -d "$BUILD_TREE" ]] && { rm -rf "$BUILD_TREE"; }
    git -C "$ORIGINAL_PROJECT_ROOT" worktree add --detach "$BUILD_TREE" origin/master 2>/dev/null || {
      git -C "$ORIGINAL_PROJECT_ROOT" worktree add --detach "$BUILD_TREE" master || {
        echo "错误：无法创建 git worktree" >&2; rm -rf "$BUILD_TREE"; exit 1
      }
    }
  fi

  echo "  合并分支 $BRANCH_NAME ..."
  if git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null; then
    echo "  已合并 origin/$BRANCH_NAME"
  elif git -C "$BUILD_TREE" merge "$BRANCH_NAME" --no-edit 2>/dev/null; then
    echo "  已合并本地 $BRANCH_NAME（请确认分支已推送）"
  else
    echo "错误：分支 $BRANCH_NAME 与 master 存在冲突，请先 rebase" >&2
    git -C "$BUILD_TREE" merge --abort 2>/dev/null || true; exit 1
  fi

  [[ -f "$ORIGINAL_PROJECT_ROOT/.env" ]] && cp "$ORIGINAL_PROJECT_ROOT/.env" "$BUILD_TREE/.env"

  if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo "  安装/更新前端依赖..."
    (cd "$BUILD_TREE" && pnpm install --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_TREE" && pnpm install --no-frozen-lockfile) || {
      echo "错误：pnpm install 失败" >&2; exit 1
    }
  fi

  PROJECT_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$PROJECT_ROOT/backend"
EDU_DIR="$PROJECT_ROOT/apps/edu"

# ──────── 加载 .env ────────
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a; source "$PROJECT_ROOT/.env"; set +a
fi
BACKEND_PORT="${PORT:-$BACKEND_PORT}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"

if [[ "$DEMO_MODE" != "true" && -z "$BRANCH_NAME" ]]; then
  echo "错误：多 Agent 协作模式下必须指定 --branch <分支名>" >&2
  echo "用法: $0 --branch <分支名> [其他参数]" >&2; exit 1
fi

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  for v in DATABASE_URL JWT_SECRET; do
    [[ -z "${!v:-}" ]] && { echo "错误：缺少必需环境变量 ${v}" >&2; exit 1; }
  done
fi

# ──────── 依赖检查 ────────
echo "==> 检查依赖..."
DEPS_OK=true
for dep in go node pnpm docker git; do
  command -v "$dep" >/dev/null 2>&1 || { echo "错误：缺少 $dep" >&2; DEPS_OK=false; }
done
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  for dep in psql pg_dump; do
    command -v "$dep" >/dev/null 2>&1 || { echo "错误：缺少 $dep" >&2; DEPS_OK=false; }
  done
fi
[[ "$DEPS_OK" != "true" ]] && exit 1

# ──────── 路径 ────────
BACKEND_BIN_NEW="$BACKEND_DIR/bin/server.new"
EDU_STANDALONE_ROOT="$EDU_DIR/.next/standalone"
EDU_STANDALONE="$EDU_STANDALONE_ROOT/apps/edu"
DEPLOY_EDU_DIR="$DEPLOY_DIR/apps/edu"
DEPLOY_EDU_STANDALONE_ROOT="$DEPLOY_EDU_DIR/.next/standalone"
DEPLOY_EDU_STANDALONE="$DEPLOY_EDU_STANDALONE_ROOT/apps/edu"
DEPLOY_UPLOAD_DIR="${UPLOAD_DIR:-$DEPLOY_DIR/data/uploads}"
DEPLOY_LOG_DIR="$DEPLOY_DIR/logs"
DEPLOY_BACKUP_DIR="$DEPLOY_DIR/backups"
DEPLOY_ROLLBACK_DIR="$DEPLOY_DIR/.rollback"
DEPLOY_TMP_DIR="$DEPLOY_DIR/.deploy"
DEPLOY_COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ROLLBACK_KEEP="${ROLLBACK_KEEP:-10}"
BACKUP_DIR="$DEPLOY_BACKUP_DIR"

# ──────── 辅助函数 ────────
get_git_commit() { git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown"; }

health_check() {
  local url="$1" max="${2:-12}" interval="${3:-2}" attempt=0
  while [[ $attempt -lt $max ]]; do
    curl -sf -o /dev/null "$url" >/dev/null 2>&1 && return 0
    sleep "$interval"; ((attempt++)) || true
  done
  return 1
}

assemble_standalone() {
  local app_dir="$1" app_name="$2"
  local sd="$app_dir/.next/standalone/apps/$app_name"
  [[ ! -d "$app_dir/.next/server" ]] && { echo "错误：$app_name 缺少 .next/server" >&2; return 1; }
  mkdir -p "$sd/.next/server" "$sd/.next/static" "$sd/public"
  rsync -a --delete --exclude="*.map" "$app_dir/.next/server/" "$sd/.next/server/"
  [[ -d "$app_dir/.next/static" ]] && rsync -a --delete --exclude="*.map" "$app_dir/.next/static/" "$sd/.next/static/"
  [[ -d "$app_dir/public" ]] && rsync -a --delete --exclude="*.map" "$app_dir/public/" "$sd/public/"
}

restore_rollback() {
  local snap="$1"
  cd /tmp 2>/dev/null || cd / || true
  echo ""; echo "==> 部署失败，开始回滚..."
  echo "  停止服务..."
  docker compose -f "$DEPLOY_COMPOSE_FILE" down 2>/dev/null || true
  pm2 stop "$PM2_EDU_NAME" 2>/dev/null || true; pm2 delete "$PM2_EDU_NAME" 2>/dev/null || true

  [[ -d "$snap/edu" ]] && {
    rm -rf "$DEPLOY_EDU_STANDALONE_ROOT"
    mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
    mv "$snap/edu" "$DEPLOY_EDU_STANDALONE_ROOT"
  }

  docker compose -f "$DEPLOY_COMPOSE_FILE" up -d --remove-orphans 2>/dev/null || true
  if [[ -d "$DEPLOY_EDU_STANDALONE" ]]; then
    pm2 start "$DEPLOY_DIR/ecosystem.edu.config.js" --env production 2>/dev/null || true
    pm2 save >/dev/null
  fi
  sleep 3

  local ok=true
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    health_check "http://127.0.0.1:$BACKEND_PORT/health" 12 2 && echo "  后端回滚健康检查通过" || { echo "  错误：后端回滚健康检查失败" >&2; ok=false; }
  fi
  if [[ "$BACKEND_ONLY" != "true" ]]; then
    health_check "http://127.0.0.1:$EDU_PORT/portal/login" 12 2 && echo "  教育管理回滚健康检查通过" || { echo "  错误：教育管理回滚健康检查失败" >&2; ok=false; }
  fi
  [[ "$ok" == "true" ]] && echo "  ✨ 回滚完成" || echo "  ⚠️  回滚后服务仍未恢复" >&2
}

# ──────── 准备部署目录 ────────
echo "==> 准备部署目录: $DEPLOY_DIR"
mkdir -p "$DEPLOY_EDU_DIR" "$DEPLOY_UPLOAD_DIR" "$DEPLOY_LOG_DIR" "$DEPLOY_BACKUP_DIR" "$DEPLOY_ROLLBACK_DIR"
if [[ -d "$PROJECT_ROOT/public/uploads" && -z "$(ls -A "$DEPLOY_UPLOAD_DIR" 2>/dev/null)" ]]; then
  echo "  迁移已有上传文件..."
  rsync -a "$PROJECT_ROOT/public/uploads/" "$DEPLOY_UPLOAD_DIR/" || true
fi

# ──────── 回滚快照 ────────
SNAPSHOT_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_DIR="$DEPLOY_ROLLBACK_DIR/$SNAPSHOT_TIMESTAMP"
mkdir -p "$SNAPSHOT_DIR"
if [[ "$BACKEND_ONLY" != "true" && -d "$DEPLOY_EDU_STANDALONE_ROOT" ]]; then
  mv "$DEPLOY_EDU_STANDALONE_ROOT" "$SNAPSHOT_DIR/edu"
fi
rm -f "$DEPLOY_ROLLBACK_DIR/latest"; ln -s "$SNAPSHOT_DIR" "$DEPLOY_ROLLBACK_DIR/latest"
echo "  快照已保存: $SNAPSHOT_DIR"
find "$DEPLOY_ROLLBACK_DIR" -maxdepth 1 -type d -name '2*' 2>/dev/null | sort | head -n -"$ROLLBACK_KEEP" | xargs -r rm -rf || true

# ──────── 代码检查 ────────
if [[ "$SKIP_CHECKS" != "true" ]]; then
  echo "==> 运行代码检查..."
  if command -v golangci-lint >/dev/null 2>&1; then
    golangci-lint run "$PROJECT_ROOT/backend/..." || { echo "错误：Go lint 未通过" >&2; exit 1; }
  fi
  if [[ "$BACKEND_ONLY" != "true" && "$RUN_TYPECHECK" == "true" ]]; then
    (cd "$PROJECT_ROOT" && pnpm --filter @zhiyu/edu typecheck) || { echo "错误：TypeScript 类型检查未通过" >&2; exit 1; }
  fi
else
  echo "==> 跳过代码检查"
fi

cd "$PROJECT_ROOT"

# ──────── 安装前端依赖 ────────
if [[ "$BACKEND_ONLY" != "true" ]]; then
  if [[ ! -d "node_modules" || "$FORCE_INSTALL" == "1" ]]; then
    echo "==> 安装前端依赖..."
    pnpm install --prefer-offline --frozen-lockfile 2>/dev/null || pnpm install --prefer-offline --no-frozen-lockfile || {
      echo "错误：pnpm install 失败" >&2; exit 1
    }
  fi
fi

# ──────── 构建 Go 后端 ────────
GO_BUILD_PID=""
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 构建 Go 后端..."
  mkdir -p "$BACKEND_DIR/bin"
  CGO_ENABLED=0 go build -C "$BACKEND_DIR" -ldflags="-s -w" -o "$BACKEND_BIN_NEW" ./cmd/server/main.go &
  GO_BUILD_PID=$!
fi

# ──────── 数据库备份（后台） ────────
BACKUP_PID=""
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}-backup-${BACKUP_TIMESTAMP}.dump"
if [[ "$SKIP_BACKUP" != "true" && "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 数据库备份..."
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  (
    if pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
      pg_dump -d "$DATABASE_URL" -Fc -Z 6 > "$BACKUP_FILE.tmp" 2>/dev/null && \
        mv "$BACKUP_FILE.tmp" "$BACKUP_FILE" && chmod 600 "$BACKUP_FILE"
    fi
  ) &
  BACKUP_PID=$!
fi

# ──────── 构建前端 ────────
if [[ "$BACKEND_ONLY" != "true" ]]; then
  BUILD_EDU=true
  if [[ -n "$BRANCH_NAME" ]]; then
    CHANGED_FILES=$(git -C "$PROJECT_ROOT" diff --name-only HEAD origin/master 2>/dev/null || echo "")
    if [[ -n "$CHANGED_FILES" ]] && ! echo "$CHANGED_FILES" | grep -qE "^(apps/edu/|packages/|package\.json|pnpm-lock|pnpm-workspace|tsconfig|turbo)"; then
      [[ "$FRONTEND_ONLY" != "true" ]] && { BUILD_EDU=false; echo "==> 无前端变更，跳过构建"; }
    fi
  fi
  [[ "$BUILD_EDU" == "false" && ! -d "$SNAPSHOT_DIR/edu" ]] && { BUILD_EDU=true; echo "  无快照可用，将构建 edu"; }

  if [[ "$BUILD_EDU" == "true" ]]; then
    echo "==> 构建教育管理前端..."
    rm -rf "$EDU_DIR/.next/standalone" "$EDU_DIR/.next/server" "$EDU_DIR/.next/static"
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/edu build ${USE_TURBOPACK:+--turbopack} || {
      echo "错误：前端构建失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
    }
    assemble_standalone "$EDU_DIR" "edu"
  else
    if [[ -d "$SNAPSHOT_DIR/edu" ]]; then
      mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
      cp -a "$SNAPSHOT_DIR/edu" "$DEPLOY_EDU_STANDALONE_ROOT"
    fi
  fi
fi

# ──────── 等待 Go 构建 ────────
if [[ -n "$GO_BUILD_PID" ]]; then
  wait "$GO_BUILD_PID" || { echo "错误：Go 构建失败" >&2; exit 1; }
  echo "  后端二进制: $BACKEND_BIN_NEW"
fi

[[ -n "$BACKUP_PID" ]] && { wait "$BACKUP_PID"; echo "  备份完成: $BACKUP_FILE"; find "$BACKUP_DIR" -maxdepth 1 -name "${BACKUP_PREFIX}-backup-*.dump" -type f -mtime +14 -delete 2>/dev/null || true; }

# =========================================================================
# Docker 部署
# =========================================================================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  DOCKER_COMPOSE_SRC="$PROJECT_ROOT/deploy/docker-compose.yml"
  [[ ! -f "$DOCKER_COMPOSE_SRC" ]] && { echo "错误：$DOCKER_COMPOSE_SRC 不存在" >&2; exit 1; }

  IMAGE_TAG="$(get_git_commit)"
  echo ""; echo "==> Docker 构建: zhiyu-backend:$IMAGE_TAG"

  cp "$DOCKER_COMPOSE_SRC" "$DEPLOY_COMPOSE_FILE"

  DB_USER="zhiyu_saas"; DB_NAME="zhiyu-saas"
  set -a; source "$PROJECT_ROOT/.env" 2>/dev/null || true; set +a
  DB_PASSWORD=$(echo "$DATABASE_URL" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' | python3 -c 'import urllib.parse,sys; print(urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null || echo "")
  [[ -z "$DB_PASSWORD" ]] && { echo "错误：无法解析 DB_PASSWORD" >&2; exit 1; }
  export DB_USER DB_PASSWORD DB_NAME JWT_SECRET IMAGE_TAG BACKEND_PORT

  mkdir -p "$BACKEND_DIR/bin"; cp "$BACKEND_BIN_NEW" "$BACKEND_DIR/bin/server"
  docker build -t "zhiyu-backend:$IMAGE_TAG" -f "$BACKEND_DIR/Dockerfile" "$BACKEND_DIR" 2>&1 | tail -5 || {
    echo "错误：Docker 镜像构建失败" >&2; exit 1
  }

  echo "  同步 migrations..."
  mkdir -p "$DEPLOY_DIR/migrations"
  rsync -a --delete "$BACKEND_DIR/migrations/" "$DEPLOY_DIR/migrations/"

  EXISTING=$(docker compose -f "$DEPLOY_COMPOSE_FILE" ps -q 2>/dev/null | wc -l || echo "0")
  if [[ "$EXISTING" -eq 0 ]]; then
    echo "  首次启动 PostgreSQL + Redis..."
    docker compose -f "$DEPLOY_COMPOSE_FILE" up -d postgres redis
    for i in $(seq 1 30); do
      docker compose -f "$DEPLOY_COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
      sleep 2
    done
    for i in $(seq 1 10); do
      docker compose -f "$DEPLOY_COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && break
      sleep 1
    done
  fi

  echo "  数据库迁移..."
  MIGRATE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5433/${DB_NAME}?sslmode=disable"
  for i in $(seq 1 15); do psql "$MIGRATE_URL" -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/migrate/main.go up) || {
    echo "  警告：迁移未完成，可能已是最新" >&2
  }

  echo "  启动容器..."
  docker compose -f "$DEPLOY_COMPOSE_FILE" up -d --remove-orphans 2>&1 | tail -5

  echo ""; echo "==> 等待服务就绪..."
  for i in $(seq 1 30); do
    STATUS=$(docker compose -f "$DEPLOY_COMPOSE_FILE" ps backend --format '{{.Health}}' 2>/dev/null || echo "starting")
    [[ "$STATUS" == "healthy" ]] && { echo "  后端健康检查通过"; break; }
    sleep 2
  done
  if [[ "$(docker compose -f "$DEPLOY_COMPOSE_FILE" ps backend --format '{{.Health}}' 2>/dev/null)" != "healthy" ]]; then
    echo "错误：后端未能在 60s 内变为 healthy" >&2
    docker compose -f "$DEPLOY_COMPOSE_FILE" logs backend --tail 30
    restore_rollback "$SNAPSHOT_DIR"; exit 1
  fi

  docker compose -f "$DEPLOY_COMPOSE_FILE" ps
  docker builder prune --all --force >/dev/null 2>&1 || true
  echo "  ✨ 容器全部就绪"
fi

# =========================================================================
# 前端部署（PM2）
# =========================================================================
if [[ "$BACKEND_ONLY" != "true" && "$BUILD_EDU" == "true" && -d "$EDU_STANDALONE_ROOT" ]]; then
  echo ""; echo "==> 部署前端..."
  rm -rf "$DEPLOY_EDU_STANDALONE_ROOT"
  mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
  cp -a "$EDU_STANDALONE_ROOT" "$DEPLOY_EDU_STANDALONE_ROOT" || { echo "错误：前端复制失败" >&2; exit 1; }
  rm -rf "$EDU_STANDALONE_ROOT"

  mkdir -p "$(dirname "$DEPLOY_DIR/ecosystem.edu.config.js")"
  cat > "$DEPLOY_DIR/ecosystem.edu.config.js" <<EOF
module.exports = {
  apps: [{
    name: '$PM2_EDU_NAME',
    cwd: '$DEPLOY_EDU_STANDALONE',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: $EDU_PORT, HOSTNAME: '0.0.0.0' },
    error_file: '$DEPLOY_LOG_DIR/edu-error.log',
    out_file: '$DEPLOY_LOG_DIR/edu-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true, max_restarts: 5, min_uptime: '10s',
    max_memory_restart: '1G', kill_timeout: 5000, listen_timeout: 10000,
  }]
};
EOF

  pm2 stop "$PM2_EDU_NAME" 2>/dev/null || true
  pm2 delete "$PM2_EDU_NAME" 2>/dev/null || true
  pm2 start "$DEPLOY_DIR/ecosystem.edu.config.js" --env production || {
    echo "错误：PM2 启动前端失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
  pm2 save >/dev/null

  echo "  等待前端就绪..."
  health_check "http://127.0.0.1:$EDU_PORT/portal/login" 15 2 && echo "  前端健康检查通过" || {
    echo "错误：前端健康检查失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
fi

# ──────── 记录部署 ────────
[[ "$DEMO_MODE" == "true" ]] && { mkdir -p "$DEPLOY_DIR"; git -C "$PROJECT_ROOT" rev-parse HEAD > "$DEPLOY_DIR/.last-commit"; }

# ──────── 自动合并 ────────
if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  echo ""; echo "==> 合并 $BRANCH_NAME → master..."
  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  if git -C "$ORIGINAL_PROJECT_ROOT" checkout master 2>/dev/null; then
    git -C "$ORIGINAL_PROJECT_ROOT" pull origin master --ff-only 2>/dev/null || true
    if git -C "$ORIGINAL_PROJECT_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null; then
      git -C "$ORIGINAL_PROJECT_ROOT" push origin master 2>/dev/null && echo "  ✅ 已合并 $BRANCH_NAME → origin/master" || echo "  ⚠️  推送失败" >&2
    else
      echo "  ⚠️  合并失败，请手动: cd $ORIGINAL_PROJECT_ROOT && git merge $BRANCH_NAME && git push" >&2
    fi
  fi
fi

# ──────── 同步 OpenResty ────────
NGINX_CONF_SRC="$PROJECT_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
NGINX_CONF_DST="/opt/1panel/www/conf.d/zhiyu-saas.conf"
NGINX_CONTAINER="${NGINX_CONTAINER:-openresty}"
if [[ -f "$NGINX_CONF_SRC" ]]; then
  echo "==> 同步反向代理配置..."
  if [[ -f "$NGINX_CONF_DST" ]]; then
    if ! cmp -s "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; then cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; echo "  已更新"; else echo "  未变更"; fi
  else
    cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; echo "  已安装"
  fi
  docker exec "$NGINX_CONTAINER" nginx -t 2>/dev/null && docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null && echo "  OpenResty 重载成功" || echo "  警告：OpenResty 重载失败" >&2
fi

echo ""
echo "✨ 部署完成！"
echo "   后端: http://localhost:$BACKEND_PORT"
echo "   前端: http://localhost:$EDU_PORT"
echo "   回滚: $SNAPSHOT_DIR"
[[ -n "$BRANCH_NAME" && "$SKIP_MERGE" == "true" ]] && echo "" && echo "📌 已跳过自动合并，请手动: git checkout master && git merge $BRANCH_NAME && git push"
