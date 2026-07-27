#!/bin/bash
#
# deploy.sh - 知育 SaaS 统一部署脚本
#
# 开发环境（多 Agent 协作，分支隔离）：
#   ./deploy.sh --branch feat/agent-xxx [--backend-only|-b] [--frontend-only|-f] ...
#   基于 master 创建隔离工作树，仅合入指定分支改动，健康检查通过后自动合并。
#
# 演示/生产环境（当前服务器直接部署）：
#   ./deploy.sh --demo [--backend-only|-b] [--frontend-only|-f] [--skip-pull] ...
#   直接 git pull master → 构建 → 部署 → 健康检查，无需分支。
#
# 两种模式共享：回滚快照、增量构建、Nginx 同步、部署锁、数据库备份。
#
set -euo pipefail

# ==================== 参数解析 ====================
BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_BACKUP=false
SKIP_CHECKS=false
SKIP_MERGE=false
FORCE_INSTALL=0
SKIP_TYPECHECK=false
USE_TURBOPACK=false
BRANCH_NAME=""
BUILD_TREE=""
ORIGINAL_PROJECT_ROOT=""
DEMO_MODE=false
SKIP_PULL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only|-b) BACKEND_ONLY=true; shift ;;
    --frontend-only|-f) FRONTEND_ONLY=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --force-install) FORCE_INSTALL=1; shift ;;
    --skip-typecheck) SKIP_TYPECHECK=true; shift ;;
    --turbopack) USE_TURBOPACK=true; shift ;;
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --demo) DEMO_MODE=true; shift ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --help|-h)
      echo "用法："
      echo "  开发环境: $0 --branch <分支名> [选项]"
      echo "  演示环境: $0 --demo [选项]"
      echo ""
      echo "选项："
      echo "  --backend-only,-b    仅部署后端"
      echo "  --frontend-only,-f   仅部署前端"
      echo "  --skip-backup        跳过数据库备份"
      echo "  --skip-checks        跳过代码检查"
      echo "  --force-install      强制重装依赖"
      echo "  --skip-typecheck     跳过前端类型检查"
      echo "  --turbopack          使用 Turbopack 构建"
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

# ==================== 模式配置 ====================
if [[ "$DEMO_MODE" == "true" ]]; then
  export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
  export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
  PM2_BACKEND_NAME="zhiyu-demo-backend"
  PM2_MARKETPLACE_NAME="zhiyu-demo-marketplace"
  PM2_EDU_NAME="zhiyu-demo-edu"
  BACKUP_PREFIX="zhiyu-demo"
else
  PM2_BACKEND_NAME="zhiyu-backend"
  PM2_MARKETPLACE_NAME="zhiyu-marketplace"
  PM2_EDU_NAME="zhiyu-edu"
  BACKUP_PREFIX="zhiyu-saas"
fi

# ==================== 路径配置 ====================
BACKEND_PORT=8080
MARKETPLACE_PORT=3010
EDU_PORT=3020

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ORIGINAL_PROJECT_ROOT="$PROJECT_ROOT"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
BACKEND_DIR="$PROJECT_ROOT/backend"
MARKETPLACE_DIR="$PROJECT_ROOT/apps/marketplace"
EDU_DIR="$PROJECT_ROOT/apps/edu"

# ==================== 部署锁 ====================
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

# ==================== 演示模式：拉取最新代码 ====================
PREV_COMMIT=""
if [[ "$DEMO_MODE" == "true" ]]; then
  if [[ "$SKIP_PULL" != "true" ]]; then
    echo "==> 拉取最新代码..."
    PREV_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "")
    git -C "$PROJECT_ROOT" pull origin master 2>&1 || {
      echo "错误：git pull 失败，使用 --skip-pull 跳过" >&2; exit 1
    }
    echo "  当前 commit: $(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
  else
    echo "==> 跳过 git pull（--skip-pull）"
    if [[ -f "$DEPLOY_DIR/.last-commit" ]]; then
      PREV_COMMIT=$(cat "$DEPLOY_DIR/.last-commit")
    fi
  fi
fi

# ==================== 分支模式：工作树构建 ====================
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  echo "==> 分支隔离部署模式"
  echo "  目标分支: $BRANCH_NAME"

  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  git -C "$ORIGINAL_PROJECT_ROOT" worktree prune 2>/dev/null || true

  if [[ -e "$BUILD_TREE/.git" ]] && git -C "$BUILD_TREE" rev-parse --git-dir >/dev/null 2>&1; then
    echo "  复用构建缓存: $BUILD_TREE"
    git -C "$BUILD_TREE" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
    git -C "$BUILD_TREE" checkout --detach --force origin/master || {
      echo "错误：无法切换到最新 master" >&2; exit 1
    }
    echo "  清理上次构建产物..."
    rm -rf "$BUILD_TREE/apps/marketplace/.next" "$BUILD_TREE/apps/edu/.next" \
           "$BUILD_TREE/backend/bin" "$BUILD_TREE/backend/tmp"
  else
    [[ -d "$BUILD_TREE" ]] && { echo "  清理残留目录: $BUILD_TREE"; rm -rf "$BUILD_TREE"; }
    echo "  创建构建工作树: $BUILD_TREE"
    git -C "$ORIGINAL_PROJECT_ROOT" worktree add --detach "$BUILD_TREE" origin/master 2>/dev/null || {
      echo "  尝试基于本地 master..."
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
    git -C "$BUILD_TREE" merge --abort 2>/dev/null || true
    exit 1
  fi

  [[ -f "$ORIGINAL_PROJECT_ROOT/.env" ]] && cp "$ORIGINAL_PROJECT_ROOT/.env" "$BUILD_TREE/.env"

  if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo "  安装/更新前端依赖..."
    if [[ "$FORCE_INSTALL" == "1" ]]; then
      (cd "$BUILD_TREE" && pnpm install --no-frozen-lockfile) || {
        echo "错误：pnpm install 失败" >&2; exit 1
      }
    else
      (cd "$BUILD_TREE" && pnpm install --frozen-lockfile) || {
        echo "  提示：frozen-lockfile 安装失败，尝试更新 lockfile..."
        (cd "$BUILD_TREE" && pnpm install --no-frozen-lockfile) || {
          echo "错误：pnpm install 失败" >&2; exit 1
        }
      }
    fi
  fi

  PROJECT_ROOT="$BUILD_TREE"
  BACKEND_DIR="$PROJECT_ROOT/backend"
  MARKETPLACE_DIR="$PROJECT_ROOT/apps/marketplace"
  EDU_DIR="$PROJECT_ROOT/apps/edu"
  echo "  构建根目录: $PROJECT_ROOT"
fi

# ==================== 加载 .env ====================
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

BACKEND_PORT="${BACKEND_PORT_ENV:-${PORT:-$BACKEND_PORT}}"
MARKETPLACE_PORT="${MARKETPLACE_PORT_ENV:-$MARKETPLACE_PORT}"
EDU_PORT="${EDU_PORT_ENV:-$EDU_PORT}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"

# ==================== --branch 强制校验 ====================
if [[ "$DEMO_MODE" != "true" && -z "$BRANCH_NAME" ]]; then
  echo "错误：多 Agent 协作模式下必须指定 --branch <分支名>" >&2
  echo "用法: $0 --branch <分支名> [其他参数]" >&2
  echo "演示环境请使用: $0 --demo" >&2
  exit 1
fi

# ==================== 必需变量校验 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  for v in DATABASE_URL JWT_SECRET; do
    [[ -z "${!v:-}" ]] && { echo "错误：缺少必需环境变量 ${v}" >&2; exit 1; }
  done
fi

# ==================== 依赖检查 ====================
echo "==> 检查本地依赖..."
DEPS_OK=true

for dep in go node pnpm pm2 psql git; do
  command -v "$dep" >/dev/null 2>&1 || { echo "错误：缺少 $dep" >&2; DEPS_OK=false; }
done

if [[ "$FRONTEND_ONLY" != "true" ]] && ! command -v pg_dump >/dev/null 2>&1 && [[ "$SKIP_BACKUP" != "true" ]]; then
  echo "错误：缺少 pg_dump（使用 --skip-backup 跳过）" >&2; DEPS_OK=false
fi

[[ "$DEPS_OK" != "true" ]] && exit 1

# ==================== 部署目录结构 ====================
BACKEND_BIN_NEW="$BACKEND_DIR/bin/server.new"
MARKETPLACE_STANDALONE_ROOT="$MARKETPLACE_DIR/.next/standalone"
EDU_STANDALONE_ROOT="$EDU_DIR/.next/standalone"
MARKETPLACE_STANDALONE="$MARKETPLACE_STANDALONE_ROOT/apps/marketplace"
EDU_STANDALONE="$EDU_STANDALONE_ROOT/apps/edu"

DEPLOY_BACKEND_DIR="$DEPLOY_DIR/backend"
DEPLOY_BACKEND_BIN="$DEPLOY_BACKEND_DIR/bin/server"
DEPLOY_MARKETPLACE_DIR="$DEPLOY_DIR/apps/marketplace"
DEPLOY_EDU_DIR="$DEPLOY_DIR/apps/edu"
DEPLOY_MARKETPLACE_STANDALONE_ROOT="$DEPLOY_MARKETPLACE_DIR/.next/standalone"
DEPLOY_EDU_STANDALONE_ROOT="$DEPLOY_EDU_DIR/.next/standalone"
DEPLOY_MARKETPLACE_STANDALONE="$DEPLOY_MARKETPLACE_STANDALONE_ROOT/apps/marketplace"
DEPLOY_EDU_STANDALONE="$DEPLOY_EDU_STANDALONE_ROOT/apps/edu"

DEPLOY_DATA_DIR="$DEPLOY_DIR/data"
DEPLOY_UPLOAD_DIR="${UPLOAD_DIR:-$DEPLOY_DATA_DIR/uploads}"
DEPLOY_LOG_DIR="$DEPLOY_DIR/logs"
DEPLOY_BACKUP_DIR="$DEPLOY_DIR/backups"
DEPLOY_ROLLBACK_DIR="$DEPLOY_DIR/.rollback"
DEPLOY_TMP_DIR="$DEPLOY_DIR/.deploy"
DEPLOY_ECOSYSTEM_CONFIG="$DEPLOY_DIR/ecosystem.config.js"

ROLLBACK_KEEP="${ROLLBACK_KEEP:-10}"
BACKUP_DIR="$DEPLOY_BACKUP_DIR"

# ==================== 辅助函数 ====================

get_git_commit() { git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown"; }

get_applied_migrations() {
  psql "$DATABASE_URL" -t -A -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || true
}

save_snapshot() {
  local snapshot_dir="$1" mode="$2"
  mkdir -p "$snapshot_dir"
  cat > "$snapshot_dir/snapshot.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(get_git_commit)",
  "mode": "$mode",
  "applied_migrations_before": [
$(if [[ "$mode" != "frontend-only" ]]; then get_applied_migrations | sed 's/^/    "/; s/$/",/' | sed '$ s/,$//'; fi)
  ]
}
EOF
}

wait_for_port_release() {
  local port="$1" timeout="${2:-10}" elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if ! lsof -ti:"$port" > /dev/null 2>&1; then return 0; fi
    sleep 1; ((elapsed++)) || true
  done
  return 1
}

health_check() {
  local url="$1" max_attempts="${2:-12}" interval="${3:-2}" attempt=0
  while [[ $attempt -lt $max_attempts ]]; do
    if curl -sf -o /dev/null "$url" > /dev/null 2>&1; then return 0; fi
    sleep "$interval"; ((attempt++)) || true
  done
  return 1
}

assemble_standalone() {
  local app_dir="$1" app_name="$2" standalone_dir="$app_dir/.next/standalone/apps/$app_name"
  [[ ! -d "$app_dir/.next/server" ]] && { echo "错误：$app_name 缺少 .next/server" >&2; return 1; }
  mkdir -p "$standalone_dir/.next/server"
  rsync -a --delete --exclude="*.map" "$app_dir/.next/server/" "$standalone_dir/.next/server/"
  if [[ -d "$app_dir/.next/static" ]]; then
    mkdir -p "$standalone_dir/.next/static"
    rsync -a --delete --exclude="*.map" "$app_dir/.next/static/" "$standalone_dir/.next/static/"
  fi
  if [[ -d "$app_dir/public" ]]; then
    mkdir -p "$standalone_dir/public"
    rsync -a --delete --exclude="*.map" "$app_dir/public/" "$standalone_dir/public/"
  fi
}

generate_ecosystem_config() {
  mkdir -p "$(dirname "$DEPLOY_ECOSYSTEM_CONFIG")"
  cat > "$DEPLOY_ECOSYSTEM_CONFIG" <<EOF
module.exports = {
  apps: [
    {
      name: '$PM2_BACKEND_NAME',
      cwd: '$DEPLOY_BACKEND_DIR',
      script: './bin/server',
      instances: 1,
      exec_mode: 'fork',
      env: { PORT: $BACKEND_PORT, UPLOAD_DIR: '$DEPLOY_UPLOAD_DIR' },
      env_production: { PORT: $BACKEND_PORT, UPLOAD_DIR: '$DEPLOY_UPLOAD_DIR' },
      error_file: '$DEPLOY_LOG_DIR/backend-error.log',
      out_file: '$DEPLOY_LOG_DIR/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: '$PM2_MARKETPLACE_NAME',
      cwd: '$DEPLOY_MARKETPLACE_STANDALONE',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: $MARKETPLACE_PORT, HOSTNAME: '0.0.0.0' },
      env_production: { NODE_ENV: 'production', PORT: $MARKETPLACE_PORT, HOSTNAME: '0.0.0.0' },
      error_file: '$DEPLOY_LOG_DIR/marketplace-error.log',
      out_file: '$DEPLOY_LOG_DIR/marketplace-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: '$PM2_EDU_NAME',
      cwd: '$DEPLOY_EDU_STANDALONE',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: $EDU_PORT, HOSTNAME: '0.0.0.0' },
      env_production: { NODE_ENV: 'production', PORT: $EDU_PORT, HOSTNAME: '0.0.0.0' },
      error_file: '$DEPLOY_LOG_DIR/edu-error.log',
      out_file: '$DEPLOY_LOG_DIR/edu-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
EOF
}

restore_rollback() {
  local snapshot_dir="$1"
  cd /tmp 2>/dev/null || cd / 2>/dev/null || true
  echo ""; echo "==> 部署失败，开始回滚..."
  echo "  停止当前进程..."
  if [[ "$FRONTEND_ONLY" == "true" ]]; then
    pm2 stop "$PM2_MARKETPLACE_NAME" "$PM2_EDU_NAME" &>/dev/null || true
    pm2 delete "$PM2_MARKETPLACE_NAME" "$PM2_EDU_NAME" &>/dev/null || true
  elif [[ "$BACKEND_ONLY" == "true" ]]; then
    pm2 stop "$PM2_BACKEND_NAME" &>/dev/null || true
    pm2 delete "$PM2_BACKEND_NAME" &>/dev/null || true
  else
    pm2 stop all &>/dev/null || true
    pm2 delete all &>/dev/null || true
  fi
  sleep 1

  [[ -f "$snapshot_dir/server" ]] && {
    mkdir -p "$(dirname "$DEPLOY_BACKEND_BIN")"; cp "$snapshot_dir/server" "$DEPLOY_BACKEND_BIN"
  }
  [[ -d "$snapshot_dir/marketplace" ]] && {
    rm -rf "$DEPLOY_MARKETPLACE_STANDALONE_ROOT"
    mkdir -p "$(dirname "$DEPLOY_MARKETPLACE_STANDALONE_ROOT")"
    mv "$snapshot_dir/marketplace" "$DEPLOY_MARKETPLACE_STANDALONE_ROOT"
  }
  [[ -d "$snapshot_dir/edu" ]] && {
    rm -rf "$DEPLOY_EDU_STANDALONE_ROOT"
    mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
    mv "$snapshot_dir/edu" "$DEPLOY_EDU_STANDALONE_ROOT"
  }

  echo "  重启旧版本服务..."
  generate_ecosystem_config
  if [[ "$FRONTEND_ONLY" == "true" ]]; then
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "$PM2_MARKETPLACE_NAME,$PM2_EDU_NAME" --env production || true
  elif [[ "$BACKEND_ONLY" == "true" ]]; then
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "$PM2_BACKEND_NAME" --env production || true
  else
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --env production || true
  fi
  sleep 3

  local rollback_ok=true
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    if health_check "http://127.0.0.1:$BACKEND_PORT/health" 12 2; then
      echo "  后端回滚后健康检查通过"
    else
      echo "  错误：后端回滚后健康检查失败" >&2; rollback_ok=false
    fi
  fi
  if [[ "$BACKEND_ONLY" != "true" ]]; then
    if health_check "http://127.0.0.1:$MARKETPLACE_PORT/login" 12 2; then
      echo "  商城回滚后健康检查通过"
    else
      echo "  错误：商城回滚后健康检查失败" >&2; rollback_ok=false
    fi
    if health_check "http://127.0.0.1:$EDU_PORT/portal/login" 12 2; then
      echo "  教育管理回滚后健康检查通过"
    else
      echo "  错误：教育管理回滚后健康检查失败" >&2; rollback_ok=false
    fi
  fi

  [[ "$rollback_ok" == "true" ]] && echo "  ✨ 回滚完成" || echo "  ⚠️  回滚后服务仍未恢复" >&2
  echo "  ⚠️  migration 已应用但无法自动回滚，检查 $snapshot_dir/snapshot.json" >&2
}

# ==================== 准备部署目录 ====================
echo "==> 准备部署目录: $DEPLOY_DIR"
mkdir -p "$DEPLOY_BACKEND_DIR/bin" "$DEPLOY_MARKETPLACE_DIR" "$DEPLOY_EDU_DIR" \
  "$DEPLOY_DATA_DIR" "$DEPLOY_UPLOAD_DIR" "$DEPLOY_LOG_DIR" \
  "$DEPLOY_BACKUP_DIR" "$DEPLOY_ROLLBACK_DIR"

# 迁移已有上传文件
if [[ -d "$PROJECT_ROOT/public/uploads" ]]; then
  mkdir -p "$DEPLOY_UPLOAD_DIR"
  if [[ -z "$(ls -A "$DEPLOY_UPLOAD_DIR" 2>/dev/null)" ]]; then
    echo "  迁移已有上传文件到 $DEPLOY_UPLOAD_DIR ..."
    rsync -a "$PROJECT_ROOT/public/uploads/" "$DEPLOY_UPLOAD_DIR/" || true
  fi
fi

# ==================== 创建回滚快照 ====================
echo "==> 创建部署回滚快照..."
SNAPSHOT_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_DIR="$DEPLOY_ROLLBACK_DIR/$SNAPSHOT_TIMESTAMP"
mkdir -p "$SNAPSHOT_DIR"

DEPLOY_MODE="full"
[[ "$BACKEND_ONLY" == "true" ]] && DEPLOY_MODE="backend-only"
[[ "$FRONTEND_ONLY" == "true" ]] && DEPLOY_MODE="frontend-only"

save_snapshot "$SNAPSHOT_DIR" "$DEPLOY_MODE"

if [[ "$FRONTEND_ONLY" != "true" && -f "$DEPLOY_BACKEND_BIN" ]]; then
  cp "$DEPLOY_BACKEND_BIN" "$SNAPSHOT_DIR/server"
fi
if [[ "$BACKEND_ONLY" != "true" && -d "$DEPLOY_MARKETPLACE_STANDALONE_ROOT" ]]; then
  mv "$DEPLOY_MARKETPLACE_STANDALONE_ROOT" "$SNAPSHOT_DIR/marketplace"
fi
if [[ "$BACKEND_ONLY" != "true" && -d "$DEPLOY_EDU_STANDALONE_ROOT" ]]; then
  mv "$DEPLOY_EDU_STANDALONE_ROOT" "$SNAPSHOT_DIR/edu"
fi

rm -f "$DEPLOY_ROLLBACK_DIR/latest"
ln -s "$SNAPSHOT_DIR" "$DEPLOY_ROLLBACK_DIR/latest"
echo "  快照已保存: $SNAPSHOT_DIR"

find "$DEPLOY_ROLLBACK_DIR" -maxdepth 1 -type d -name '2*' 2>/dev/null | sort | head -n -"$ROLLBACK_KEEP" | xargs -r rm -rf || true

# ==================== 代码检查 ====================
if [[ "$SKIP_CHECKS" != "true" ]]; then
  echo "==> 运行代码检查..."
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    echo "  Go 编译检查..."
    (cd "$BACKEND_DIR" && go build -o /tmp/zhiyu-server-check ./cmd/server/main.go) || {
      echo "错误：Go 后端编译失败" >&2; exit 1
    }
    rm -f /tmp/zhiyu-server-check
  fi
  if [[ "$BACKEND_ONLY" != "true" ]]; then
    if [[ "$SKIP_TYPECHECK" == "true" ]]; then
      echo "  跳过前端类型检查（--skip-typecheck）"
    else
      echo "  前端类型检查..."
      (cd "$PROJECT_ROOT" && pnpm --filter @zhiyu/marketplace typecheck && pnpm --filter @zhiyu/edu typecheck) || {
        echo "错误：TypeScript 类型检查未通过" >&2; exit 1
      }
    fi
  fi
else
  echo "==> 跳过代码检查（--skip-checks）"
fi

cd "$PROJECT_ROOT"

# ==================== 安装前端依赖 ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  if [[ -n "$BRANCH_NAME" && "$FORCE_INSTALL" != "1" ]]; then
    echo "==> 分支模式依赖已在上一步安装，跳过（使用 --force-install 可强制重装）"
  elif [[ ! -d "node_modules" || "$FORCE_INSTALL" == "1" ]]; then
    echo "==> 安装前端依赖..."
    pnpm install --prefer-offline --frozen-lockfile || {
      echo "  提示：frozen-lockfile 安装失败，尝试更新 lockfile..."
      pnpm install --prefer-offline --no-frozen-lockfile || {
        echo "错误：pnpm install 失败" >&2; exit 1
      }
    }
  else
    echo "==> node_modules 已存在，跳过依赖安装（设置 --force-install 可强制重新安装）"
  fi
fi

# ==================== 构建后端 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 构建 Go 后端..."
  mkdir -p "$BACKEND_DIR/bin"
  go build -C "$BACKEND_DIR" -o "$BACKEND_BIN_NEW" ./cmd/server/main.go || {
    echo "错误：Go 后端构建失败" >&2; exit 1
  }
  echo "  后端二进制: $BACKEND_BIN_NEW"
fi

# ==================== 构建前端（增量构建） ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  BUILD_MARKETPLACE=true
  BUILD_EDU=true

  # 检测变更文件，决定增量还是全量构建
  if [[ "$DEMO_MODE" == "true" ]]; then
    # 演示模式：对比 git pull 前后的 commit
    if [[ -n "$PREV_COMMIT" ]] && [[ "$SKIP_PULL" != "true" || -n "$PREV_COMMIT" ]]; then
      CHANGED_FILES=$(git -C "$PROJECT_ROOT" diff --name-only "$PREV_COMMIT" HEAD 2>/dev/null || echo "")
      if [[ -n "$CHANGED_FILES" ]]; then
        BUILD_MARKETPLACE=false
        BUILD_EDU=false
        echo "$CHANGED_FILES" | grep -q "^apps/marketplace/" && { BUILD_MARKETPLACE=true; echo "  检测到商城改动，将构建 marketplace"; }
        echo "$CHANGED_FILES" | grep -q "^apps/edu/" && { BUILD_EDU=true; echo "  检测到教育管理改动，将构建 edu"; }
        if echo "$CHANGED_FILES" | grep -qE "^(packages/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.json|turbo\.json)"; then
          BUILD_MARKETPLACE=true; BUILD_EDU=true
          echo "  检测到共享依赖/根配置改动，全量构建"
        fi
        if [[ "$BUILD_MARKETPLACE" == "false" && "$BUILD_EDU" == "false" ]]; then
          [[ "$FRONTEND_ONLY" == "true" ]] && { BUILD_MARKETPLACE=true; BUILD_EDU=true; }
          [[ "$FRONTEND_ONLY" != "true" ]] && echo "==> 无前端文件变更，跳过构建"
        fi
      else
        echo "==> 无变更，但仍进行全量构建（首次或基准缺失）"
      fi
    else
      echo "==> 未找到上次部署记录，进行全量构建"
    fi
  elif [[ -n "$BRANCH_NAME" ]]; then
    # 开发模式：对比分支与 master 的差异
    CHANGED_FILES=$(git -C "$PROJECT_ROOT" diff --name-only HEAD origin/master 2>/dev/null || git -C "$PROJECT_ROOT" diff --name-only HEAD master 2>/dev/null || echo "")
    if [[ -n "$CHANGED_FILES" ]]; then
      BUILD_MARKETPLACE=false
      BUILD_EDU=false
      echo "$CHANGED_FILES" | grep -q "^apps/marketplace/" && { BUILD_MARKETPLACE=true; echo "  检测到商城改动，将构建 marketplace"; }
      echo "$CHANGED_FILES" | grep -q "^apps/edu/" && { BUILD_EDU=true; echo "  检测到教育管理改动，将构建 edu"; }
      if echo "$CHANGED_FILES" | grep -qE "^(packages/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.json|turbo\.json)"; then
        BUILD_MARKETPLACE=true; BUILD_EDU=true
        echo "  检测到共享依赖/根配置改动，全量构建"
      fi
      if [[ "$BUILD_MARKETPLACE" == "false" && "$BUILD_EDU" == "false" && "$FRONTEND_ONLY" == "true" ]]; then
        BUILD_MARKETPLACE=true; BUILD_EDU=true
        echo "  frontend-only 模式下全量构建"
      fi
    fi
  fi

  # 如果没有快照可用，强制执行构建
  [[ "$BUILD_MARKETPLACE" == "false" && ! -d "$SNAPSHOT_DIR/marketplace" ]] && { BUILD_MARKETPLACE=true; echo "  无商城快照，将构建 marketplace"; }
  [[ "$BUILD_EDU" == "false" && ! -d "$SNAPSHOT_DIR/edu" ]] && { BUILD_EDU=true; echo "  无教育管理快照，将构建 edu"; }

  BUILD_ARGS=""
  [[ "$USE_TURBOPACK" == "true" ]] && { BUILD_ARGS="--turbopack"; echo "  使用 Turbopack 构建"; }

  if [[ "$BUILD_MARKETPLACE" == "true" ]]; then
    echo "==> 构建商城前端..."
    rm -rf "$MARKETPLACE_DIR/.next"
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/marketplace build $BUILD_ARGS || {
      echo "错误：商城前端构建失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
    }
    assemble_standalone "$MARKETPLACE_DIR" "marketplace"
    echo "  商城产物: $MARKETPLACE_STANDALONE"
  else
    echo "==> 跳过商城构建（无改动）"
    if [[ -d "$SNAPSHOT_DIR/marketplace" ]]; then
      mkdir -p "$(dirname "$DEPLOY_MARKETPLACE_STANDALONE_ROOT")"
      cp -a "$SNAPSHOT_DIR/marketplace" "$DEPLOY_MARKETPLACE_STANDALONE_ROOT"
      echo "  从快照恢复商城产物"
    fi
  fi

  if [[ "$BUILD_EDU" == "true" ]]; then
    echo "==> 构建教育管理前端..."
    rm -rf "$EDU_DIR/.next"
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/edu build $BUILD_ARGS || {
      echo "错误：教育管理前端构建失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
    }
    assemble_standalone "$EDU_DIR" "edu"
    echo "  教育管理产物: $EDU_STANDALONE"
  else
    echo "==> 跳过教育管理构建（无改动）"
    if [[ -d "$SNAPSHOT_DIR/edu" ]]; then
      mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
      cp -a "$SNAPSHOT_DIR/edu" "$DEPLOY_EDU_STANDALONE_ROOT"
      echo "  从快照恢复教育管理产物"
    fi
  fi
fi

# ==================== 数据库备份 ====================
if [[ "$SKIP_BACKUP" != "true" && "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 备份数据库..."
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/${BACKUP_PREFIX}-backup-${BACKUP_TIMESTAMP}.dump"
  if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
    pg_dump -d "$DATABASE_URL" -Fc -Z 6 > "$BACKUP_FILE.tmp" && mv "$BACKUP_FILE.tmp" "$BACKUP_FILE" && chmod 600 "$BACKUP_FILE" || {
      if [[ "$DEMO_MODE" == "true" ]]; then
        echo "  警告：数据库备份失败，继续部署..."; rm -f "$BACKUP_FILE.tmp"
      else
        echo "错误：数据库备份失败" >&2; exit 1
      fi
    }
    echo "  备份完成: $BACKUP_FILE"
    find "$BACKUP_DIR" -maxdepth 1 -name "${BACKUP_PREFIX}-backup-*.dump" -type f -mtime +14 -delete
  else
    echo "  警告：PostgreSQL 未就绪，跳过备份"
  fi
else
  echo "==> 跳过数据库备份"
fi

# ==================== 停止旧服务 ====================
echo "==> 停止旧服务..."

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  pm2 stop "$PM2_BACKEND_NAME" &>/dev/null || true
  pm2 delete "$PM2_BACKEND_NAME" &>/dev/null || true
  if ! wait_for_port_release "$BACKEND_PORT" 10; then
    echo "  警告：后端端口 $BACKEND_PORT 未释放，强制清理..." >&2
    pid=$(lsof -t -i:"$BACKEND_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  fi
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  for app in "$PM2_MARKETPLACE_NAME" "$PM2_EDU_NAME"; do
    pm2 stop "$app" &>/dev/null || true
    pm2 delete "$app" &>/dev/null || true
  done
  for port in "$MARKETPLACE_PORT" "$EDU_PORT"; do
    if ! wait_for_port_release "$port" 10; then
      pid=$(lsof -t -i:"$port" 2>/dev/null || true)
      [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
    fi
  done
fi

sleep 1

# ==================== 部署产物到目标目录 ====================
echo "==> 切换到新版本..."

if [[ "$FRONTEND_ONLY" != "true" && -f "$BACKEND_BIN_NEW" ]]; then
  mkdir -p "$(dirname "$DEPLOY_BACKEND_BIN")"
  [[ -f "$DEPLOY_BACKEND_BIN" ]] && mv "$DEPLOY_BACKEND_BIN" "$DEPLOY_BACKEND_DIR/bin/server.prev"
  mv "$BACKEND_BIN_NEW" "$DEPLOY_BACKEND_BIN"
  chmod +x "$DEPLOY_BACKEND_BIN"
  if [[ -f "$PROJECT_ROOT/.env" ]]; then
    cp "$PROJECT_ROOT/.env" "$DEPLOY_BACKEND_DIR/.env"
    chmod 600 "$DEPLOY_BACKEND_DIR/.env"
  fi
  echo "  后端已切换"
fi

if [[ "$BACKEND_ONLY" != "true" && "$BUILD_MARKETPLACE" == "true" && -d "$MARKETPLACE_STANDALONE_ROOT" ]]; then
  echo "  复制商城 standalone 到部署目录..."
  rm -rf "$DEPLOY_MARKETPLACE_STANDALONE_ROOT"
  mkdir -p "$(dirname "$DEPLOY_MARKETPLACE_STANDALONE_ROOT")"
  cp -a "$MARKETPLACE_STANDALONE_ROOT" "$DEPLOY_MARKETPLACE_STANDALONE_ROOT"
  rm -rf "$MARKETPLACE_STANDALONE_ROOT"
  echo "  商城前端已切换"
fi

if [[ "$BACKEND_ONLY" != "true" && "$BUILD_EDU" == "true" && -d "$EDU_STANDALONE_ROOT" ]]; then
  echo "  复制教育管理 standalone 到部署目录..."
  rm -rf "$DEPLOY_EDU_STANDALONE_ROOT"
  mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE_ROOT")"
  cp -a "$EDU_STANDALONE_ROOT" "$DEPLOY_EDU_STANDALONE_ROOT" || {
    echo "错误：教育管理 standalone 复制失败" >&2; exit 1
  }
  rm -rf "$EDU_STANDALONE_ROOT"
  echo "  教育管理前端已切换"
fi

# ==================== 生成 PM2 配置 ====================
generate_ecosystem_config

# ==================== 数据库迁移 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 执行数据库迁移..."
  (cd "$BACKEND_DIR" && go run ./cmd/migrate/main.go up) || {
    echo "错误：数据库迁移失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
fi

# ==================== PM2 启动 ====================
echo ""
echo "==> PM2 启动服务..."

if [[ "$FRONTEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "$PM2_MARKETPLACE_NAME,$PM2_EDU_NAME" --env production || {
    echo "错误：PM2 启动失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
elif [[ "$BACKEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "$PM2_BACKEND_NAME" --env production || {
    echo "错误：PM2 启动失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
else
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --env production || {
    echo "错误：PM2 启动失败" >&2; restore_rollback "$SNAPSHOT_DIR"; exit 1
  }
fi

pm2 save > /dev/null

# ==================== 健康检查 ====================
echo ""
echo "==> 等待服务就绪..."

HEALTH_OK=true

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  if health_check "http://127.0.0.1:$BACKEND_PORT/health" 15 2; then
    echo "  后端健康检查通过: http://127.0.0.1:$BACKEND_PORT/health"
  else
    echo "  错误：后端健康检查失败" >&2; HEALTH_OK=false
  fi
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  if health_check "http://127.0.0.1:$MARKETPLACE_PORT/login" 15 2; then
    echo "  商城健康检查通过: http://127.0.0.1:$MARKETPLACE_PORT/login"
  else
    echo "  错误：商城健康检查失败" >&2; HEALTH_OK=false
  fi
  if health_check "http://127.0.0.1:$EDU_PORT/portal/login" 15 2; then
    echo "  教育管理健康检查通过: http://127.0.0.1:$EDU_PORT/portal/login"
  else
    echo "  错误：教育管理健康检查失败" >&2; HEALTH_OK=false
  fi
fi

if [[ "$HEALTH_OK" != "true" ]]; then
  restore_rollback "$SNAPSHOT_DIR"; exit 1
fi

# ==================== 记录部署 commit（演示模式增量构建用） ====================
if [[ "$DEMO_MODE" == "true" ]]; then
  mkdir -p "$DEPLOY_DIR"
  git -C "$PROJECT_ROOT" rev-parse HEAD > "$DEPLOY_DIR/.last-commit"
fi

# ==================== 自动合并分支到 master（仅开发模式） ====================
if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  echo ""
  echo "==> 自动合并 $BRANCH_NAME 到 master..."
  git -C "$ORIGINAL_PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  if git -C "$ORIGINAL_PROJECT_ROOT" checkout master 2>/dev/null; then
    git -C "$ORIGINAL_PROJECT_ROOT" pull origin master --ff-only 2>/dev/null || git -C "$ORIGINAL_PROJECT_ROOT" pull origin master 2>/dev/null || true
    local_merge_ok=false
    if git -C "$ORIGINAL_PROJECT_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null; then
      local_merge_ok=true
    elif git -C "$ORIGINAL_PROJECT_ROOT" merge "$BRANCH_NAME" --no-edit 2>/dev/null; then
      echo "  （使用本地分支合并）"; local_merge_ok=true
    fi
    if $local_merge_ok; then
      if git -C "$ORIGINAL_PROJECT_ROOT" push origin master 2>/dev/null; then
        echo "  ✅ 已合并 $BRANCH_NAME 到 origin/master"
      else
        echo "  ⚠️  本地已合并但推送失败" >&2
      fi
    else
      echo "  ⚠️  自动合并失败，请手动: cd $ORIGINAL_PROJECT_ROOT && git merge $BRANCH_NAME && git push" >&2
    fi
  else
    echo "  ⚠️  无法切换到 master，跳过自动合并" >&2
  fi
fi

# ==================== 同步反向代理配置 ====================
NGINX_CONF_SRC="$PROJECT_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
NGINX_CONF_DST="/opt/1panel/www/conf.d/zhiyu-saas.conf"
NGINX_CONTAINER="${NGINX_CONTAINER:-openresty}"

if [[ -f "$NGINX_CONF_SRC" ]]; then
  echo "==> 同步反向代理配置..."
  if [[ -f "$NGINX_CONF_DST" ]]; then
    if ! cmp -s "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; then
      cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; echo "  已更新: $NGINX_CONF_DST"
    else
      echo "  配置未变更，跳过"
    fi
  else
    cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; echo "  已安装: $NGINX_CONF_DST"
  fi
  if docker exec "$NGINX_CONTAINER" nginx -t 2>/dev/null; then
    docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true
    echo "  OpenResty 重载成功"
  else
    echo "  警告：OpenResty 容器未就绪或配置测试失败，跳过重载" >&2
  fi
else
  echo "==> 未找到反向代理配置模板，跳过 nginx 同步"
fi

# ==================== 清理 ====================
[[ -f "$DEPLOY_BACKEND_DIR/bin/server.prev" ]] && rm -f "$DEPLOY_BACKEND_DIR/bin/server.prev"

# ==================== 完成 ====================
echo ""
echo "✨ 部署完成！"
echo "   部署目录: $DEPLOY_DIR"
echo "   后端 API: http://localhost:$BACKEND_PORT"
echo "   商城访问: http://localhost:$MARKETPLACE_PORT"
echo "   教育管理: http://localhost:$EDU_PORT"
echo "   日志目录: $DEPLOY_LOG_DIR"
echo "   回滚快照: $SNAPSHOT_DIR"
if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" == "true" ]]; then
  echo ""
  echo "📌 部署已验证通过（已跳过自动合并），请手动合并:"
  echo "   cd $ORIGINAL_PROJECT_ROOT && git checkout master && git merge $BRANCH_NAME && git push"
fi
echo ""
