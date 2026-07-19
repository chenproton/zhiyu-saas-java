#!/bin/bash
#
# deploy.sh - 本地构建发布脚本（Next.js 双前端 + Go 后端 + PostgreSQL）
# 运行时产物部署到代码目录之外（默认 /opt/zhiyu-saas），实现代码与运行数据分离。
#
# 用法：
#   ./deploy.sh                  # 全量部署（前端 + 后端 + 数据库备份）
#   ./deploy.sh --backend-only   # 仅部署后端
#   ./deploy.sh --frontend-only  # 仅部署前端（商城 + 教育管理）
#   ./deploy.sh --skip-backup    # 跳过数据库备份
#   ./deploy.sh --skip-checks    # 跳过代码检查
#
set -euo pipefail

# ==================== 参数解析 ====================
BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_BACKUP=false
SKIP_CHECKS=false
FORCE_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only|-b)
      BACKEND_ONLY=true
      shift
      ;;
    --frontend-only|-f)
      FRONTEND_ONLY=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS=true
      shift
      ;;
    --force-install)
      FORCE_INSTALL=1
      shift
      ;;
    --help|-h)
      echo "用法：$0 [--backend-only|-b] [--frontend-only|-f] [--skip-backup] [--skip-checks] [--force-install]"
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      echo "用法：$0 [--backend-only|-b] [--frontend-only|-f] [--skip-backup] [--skip-checks] [--force-install]" >&2
      exit 1
      ;;
  esac
done

if [[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]]; then
  echo "错误：--backend-only 和 --frontend-only 不能同时使用" >&2
  exit 1
fi

# ==================== 配置区 ====================
BACKEND_PORT=8080
MARKETPLACE_PORT=3010
EDU_PORT=3020

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# 部署目标目录：代码目录之外，可通过环境变量覆盖
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"

# 项目内构建目录
BACKEND_DIR="$PROJECT_ROOT/backend"
BACKEND_BIN_NEW="$BACKEND_DIR/bin/server.new"

MARKETPLACE_DIR="$PROJECT_ROOT/apps/marketplace"
EDU_DIR="$PROJECT_ROOT/apps/edu"

MARKETPLACE_STANDALONE="$MARKETPLACE_DIR/.next/standalone/apps/marketplace"
EDU_STANDALONE="$EDU_DIR/.next/standalone/apps/edu"

# ==================== 加载环境变量 ====================
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

# 允许 .env 覆盖端口和部署目录
MARKETPLACE_PORT="${MARKETPLACE_PORT_ENV:-$MARKETPLACE_PORT}"
EDU_PORT="${EDU_PORT_ENV:-$EDU_PORT}"
BACKEND_PORT="${BACKEND_PORT_ENV:-$BACKEND_PORT}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"

# 部署目录结构（在 .env 加载后重新计算）
DEPLOY_BACKEND_DIR="$DEPLOY_DIR/backend"
DEPLOY_BACKEND_BIN="$DEPLOY_BACKEND_DIR/bin/server"
DEPLOY_MARKETPLACE_DIR="$DEPLOY_DIR/apps/marketplace"
DEPLOY_EDU_DIR="$DEPLOY_DIR/apps/edu"
DEPLOY_MARKETPLACE_STANDALONE="$DEPLOY_MARKETPLACE_DIR/.next/standalone/apps/marketplace"
DEPLOY_EDU_STANDALONE="$DEPLOY_EDU_DIR/.next/standalone/apps/edu"

DEPLOY_DATA_DIR="$DEPLOY_DIR/data"
DEPLOY_UPLOAD_DIR="${UPLOAD_DIR:-$DEPLOY_DATA_DIR/uploads}"
DEPLOY_LOG_DIR="$DEPLOY_DIR/logs"
DEPLOY_BACKUP_DIR="$DEPLOY_DIR/backups"
DEPLOY_ROLLBACK_DIR="$DEPLOY_DIR/.rollback"
DEPLOY_TMP_DIR="$DEPLOY_DIR/.deploy"
DEPLOY_ECOSYSTEM_CONFIG="$DEPLOY_DIR/ecosystem.config.js"

ROLLBACK_KEEP="${ROLLBACK_KEEP:-10}"
BACKUP_DIR="$DEPLOY_BACKUP_DIR"

# ==================== 清理函数 ====================
cleanup() {
  rm -rf "$DEPLOY_TMP_DIR"
}

trap 'cleanup' EXIT

# ==================== Git 自动提交推送 ====================
# 每次部署前自动提交所有未保存的修改，确保代码仓库与线上一致
echo "==> 检查本地未提交修改..."
cd "$PROJECT_ROOT"
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  STAMP="$(date '+%Y-%m-%d_%H:%M:%S')"
  git add -A
  git commit -m "deploy(auto): $STAMP — 部署前自动提交未保存的修改" || true
  git push 2>/dev/null || echo "  警告：git push 失败，继续部署..."
  echo "  已自动提交并推送未保存的修改 ($STAMP)"
else
  echo "  无未提交修改，跳过"
fi

# ==================== 必需变量校验 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  REQUIRED_VARS=(DATABASE_URL JWT_SECRET)
  for v in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!v:-}" ]]; then
      echo "错误：缺少必需环境变量 ${v}，请在 .env 中配置" >&2
      exit 1
    fi
  done
fi

# ==================== 本地依赖检查 ====================
echo "==> 检查本地部署依赖..."
LOCAL_DEPS_OK=true

# 所有模式均需要 pm2
if ! command -v pm2 > /dev/null 2>&1; then
  echo "错误：本地缺少必需工具 pm2，请先安装" >&2
  LOCAL_DEPS_OK=false
fi

# 前端（full / frontend-only）
if [[ "$BACKEND_ONLY" != "true" ]]; then
  for dep in pnpm node; do
    if ! command -v "$dep" > /dev/null 2>&1; then
      echo "错误：本地缺少必需工具 ${dep}，请先安装" >&2
      LOCAL_DEPS_OK=false
    fi
  done
fi

# 后端（full / backend-only）
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  for dep in go psql; do
    if ! command -v "$dep" > /dev/null 2>&1; then
      echo "错误：本地缺少必需工具 ${dep}，请先安装" >&2
      LOCAL_DEPS_OK=false
    fi
  done
  if ! command -v pg_dump > /dev/null 2>&1 && [[ "$SKIP_BACKUP" != "true" ]]; then
    echo "错误：本地缺少 pg_dump，无法执行数据库备份（使用 --skip-backup 跳过）" >&2
    LOCAL_DEPS_OK=false
  fi
fi

if [[ "$LOCAL_DEPS_OK" != "true" ]]; then
  exit 1
fi

# ==================== 辅助函数 ====================

get_git_commit() {
  git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

get_applied_migrations() {
  psql "$DATABASE_URL" -t -A -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || true
}

save_snapshot() {
  local snapshot_dir="$1"
  local mode="$2"
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
  local port="$1"
  local timeout="${2:-10}"
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if ! lsof -ti:"$port" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((elapsed++)) || true
  done
  return 1
}

health_check() {
  local url="$1"
  local max_attempts="${2:-12}"
  local interval="${3:-2}"
  local attempt=0
  while [[ $attempt -lt $max_attempts ]]; do
    if curl -sf -o /dev/null "$url" > /dev/null 2>&1; then
      return 0
    fi
    sleep "$interval"
    ((attempt++)) || true
  done
  return 1
}

# 组装单个前端应用的 standalone 产物（在项目目录内）
assemble_standalone() {
  local app_dir="$1"
  local app_name="$2"
  local standalone_dir="$app_dir/.next/standalone/apps/$app_name"

  if [[ ! -d "$app_dir/.next/server" ]]; then
    echo "错误：$app_name 构建后缺少 .next/server 目录" >&2
    return 1
  fi

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

# 生成部署目录下的 PM2 生态配置文件
generate_ecosystem_config() {
  mkdir -p "$(dirname "$DEPLOY_ECOSYSTEM_CONFIG")"
  cat > "$DEPLOY_ECOSYSTEM_CONFIG" <<EOF
module.exports = {
  apps: [
    {
      name: 'zhiyu-backend',
      cwd: '$DEPLOY_BACKEND_DIR',
      script: './bin/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: $BACKEND_PORT,
        UPLOAD_DIR: '$DEPLOY_UPLOAD_DIR',
      },
      env_production: {
        PORT: $BACKEND_PORT,
        UPLOAD_DIR: '$DEPLOY_UPLOAD_DIR',
      },
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
      name: 'zhiyu-marketplace',
      cwd: '$DEPLOY_MARKETPLACE_STANDALONE',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $MARKETPLACE_PORT,
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: $MARKETPLACE_PORT,
        HOSTNAME: '0.0.0.0',
      },
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
      name: 'zhiyu-edu',
      cwd: '$DEPLOY_EDU_STANDALONE',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $EDU_PORT,
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: $EDU_PORT,
        HOSTNAME: '0.0.0.0',
      },
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

# 迁移项目内已有上传到部署目录（仅首次）
migrate_uploads() {
  local src="$PROJECT_ROOT/public/uploads"
  local dst="$DEPLOY_UPLOAD_DIR"
  if [[ -d "$src" && ! -d "$dst" ]]; then
    echo "  迁移已有上传文件到 $dst ..."
    mkdir -p "$dst"
    rsync -a "$src/" "$dst/" || true
  fi
}

restore_rollback() {
  local snapshot_dir="$1"
  echo ""
  echo "==> 部署失败，开始回滚..."

  echo "  停止当前进程..."
  if [[ "$FRONTEND_ONLY" == "true" ]]; then
    pm2 stop "zhiyu-marketplace" "zhiyu-edu" &>/dev/null || true
    pm2 delete "zhiyu-marketplace" "zhiyu-edu" &>/dev/null || true
  elif [[ "$BACKEND_ONLY" == "true" ]]; then
    pm2 stop "zhiyu-backend" &>/dev/null || true
    pm2 delete "zhiyu-backend" &>/dev/null || true
  else
    pm2 stop all &>/dev/null || true
    pm2 delete all &>/dev/null || true
  fi
  sleep 1

  if [[ -f "$snapshot_dir/server" ]]; then
    echo "  恢复后端二进制..."
    mkdir -p "$(dirname "$DEPLOY_BACKEND_BIN")"
    cp "$snapshot_dir/server" "$DEPLOY_BACKEND_BIN"
  fi

  if [[ -d "$snapshot_dir/marketplace" ]]; then
    echo "  恢复商城 standalone 产物..."
    rm -rf "$DEPLOY_MARKETPLACE_STANDALONE"
    mkdir -p "$(dirname "$DEPLOY_MARKETPLACE_STANDALONE")"
    mv "$snapshot_dir/marketplace" "$DEPLOY_MARKETPLACE_STANDALONE"
  fi

  if [[ -d "$snapshot_dir/edu" ]]; then
    echo "  恢复教育管理 standalone 产物..."
    rm -rf "$DEPLOY_EDU_STANDALONE"
    mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE")"
    mv "$snapshot_dir/edu" "$DEPLOY_EDU_STANDALONE"
  fi

  echo "  重启旧版本服务..."
  generate_ecosystem_config
  if [[ "$FRONTEND_ONLY" == "true" ]]; then
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "zhiyu-marketplace,zhiyu-edu" --env production || true
  elif [[ "$BACKEND_ONLY" == "true" ]]; then
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "zhiyu-backend" --env production || true
  else
    pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --env production || true
  fi
  sleep 3

  local rollback_ok=true
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    if health_check "http://127.0.0.1:$BACKEND_PORT/health"; then
      echo "  后端回滚后健康检查通过"
    else
      echo "  错误：后端回滚后健康检查失败" >&2
      rollback_ok=false
    fi
  fi

  if [[ "$BACKEND_ONLY" != "true" ]]; then
    if health_check "http://127.0.0.1:$MARKETPLACE_PORT/login"; then
      echo "  商城回滚后健康检查通过"
    else
      echo "  错误：商城回滚后健康检查失败" >&2
      rollback_ok=false
    fi

    if health_check "http://127.0.0.1:$EDU_PORT/portal/login"; then
      echo "  教育管理回滚后健康检查通过"
    else
      echo "  错误：教育管理回滚后健康检查失败" >&2
      rollback_ok=false
    fi
  fi

  if [[ "$rollback_ok" == "true" ]]; then
    echo "  ✨ 回滚完成，服务已恢复到部署前状态"
  else
    echo "  ⚠️  回滚后服务仍未恢复，请手动检查 PM2 日志" >&2
  fi

  echo ""
  echo "⚠️  注意：如果本次部署应用了新的数据库 migration，代码已回滚但 schema 可能仍处在新版本。" >&2
  echo "    请检查 $snapshot_dir/snapshot.json 中的 applied_migrations_before，必要时手动执行对应 down migration。" >&2
}

# ==================== 准备部署目录 ====================
echo "==> 准备部署目录: $DEPLOY_DIR"
mkdir -p "$DEPLOY_BACKEND_DIR/bin" "$DEPLOY_MARKETPLACE_DIR" "$DEPLOY_EDU_DIR" \
  "$DEPLOY_DATA_DIR" "$DEPLOY_UPLOAD_DIR" "$DEPLOY_LOG_DIR" \
  "$DEPLOY_BACKUP_DIR" "$DEPLOY_ROLLBACK_DIR"

migrate_uploads

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
if [[ "$BACKEND_ONLY" != "true" && -d "$DEPLOY_MARKETPLACE_STANDALONE" ]]; then
  mv "$DEPLOY_MARKETPLACE_STANDALONE" "$SNAPSHOT_DIR/marketplace"
fi
if [[ "$BACKEND_ONLY" != "true" && -d "$DEPLOY_EDU_STANDALONE" ]]; then
  mv "$DEPLOY_EDU_STANDALONE" "$SNAPSHOT_DIR/edu"
fi

rm -f "$DEPLOY_ROLLBACK_DIR/latest"
ln -s "$SNAPSHOT_DIR" "$DEPLOY_ROLLBACK_DIR/latest"

echo "  快照已保存: $SNAPSHOT_DIR"

# 只保留最近 ROLLBACK_KEEP 个快照，超出则删除最旧的
find "$DEPLOY_ROLLBACK_DIR" -maxdepth 1 -type d -name '2*' 2>/dev/null | sort | head -n -"$ROLLBACK_KEEP" | xargs -r rm -rf || true

# ==================== 代码检查 ====================
if [[ "$SKIP_CHECKS" != "true" ]]; then
  echo "==> 运行代码检查..."

  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    echo "  Go 编译检查..."
    (cd "$BACKEND_DIR" && go build -o /tmp/zhiyu-server-check ./cmd/server/main.go) || {
      echo "错误：Go 后端编译失败，拒绝部署" >&2
      exit 1
    }
    rm -f /tmp/zhiyu-server-check
  fi

  if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo "  前端类型检查..."
    (cd "$PROJECT_ROOT" && pnpm --filter @zhiyu/marketplace typecheck && pnpm --filter @zhiyu/edu typecheck) || {
      echo "错误：前端 TypeScript 类型检查未通过，拒绝部署" >&2
      exit 1
    }
  fi
else
  echo "==> 跳过代码检查（--skip-checks）"
fi

cd "$PROJECT_ROOT"

# ==================== 安装前端依赖 ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  if [[ ! -d "node_modules" || "$FORCE_INSTALL" == "1" ]]; then
    echo "==> 安装前端依赖..."
    pnpm install --prefer-offline --no-frozen-lockfile
  else
    echo "==> node_modules 已存在，跳过依赖安装（设置 --force-install 可强制重新安装）"
  fi
fi

# ==================== 构建后端 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 构建 Go 后端..."
  mkdir -p "$BACKEND_DIR/bin"
  go build -C "$BACKEND_DIR" -o "$BACKEND_BIN_NEW" ./cmd/server/main.go || {
    echo "错误：Go 后端构建失败" >&2
    exit 1
  }
  echo "  后端二进制: $BACKEND_BIN_NEW"
fi

# ==================== 构建前端 ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  echo "==> 构建商城前端..."
  rm -rf "$MARKETPLACE_DIR/.next/standalone"
  NODE_ENV=production pnpm --filter @zhiyu/marketplace build || {
    echo "错误：商城前端构建失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
  assemble_standalone "$MARKETPLACE_DIR" "marketplace"
  echo "  商城产物: $MARKETPLACE_STANDALONE"

  echo "==> 构建教育管理前端..."
  rm -rf "$EDU_DIR/.next/standalone"
  NODE_ENV=production pnpm --filter @zhiyu/edu build || {
    echo "错误：教育管理前端构建失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
  assemble_standalone "$EDU_DIR" "edu"
  echo "  教育管理产物: $EDU_STANDALONE"
fi

# ==================== 数据库备份 ====================
if [[ "$SKIP_BACKUP" != "true" && "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 备份数据库..."
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/zhiyu-saas-backup-${BACKUP_TIMESTAMP}.dump"

  if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
    pg_dump -d "$DATABASE_URL" -Fc -Z 6 > "$BACKUP_FILE.tmp" && mv "$BACKUP_FILE.tmp" "$BACKUP_FILE" && chmod 600 "$BACKUP_FILE" || {
      echo "错误：数据库备份失败" >&2
      exit 1
    }
    echo "  备份完成: $BACKUP_FILE"

    find "$BACKUP_DIR" -maxdepth 1 -name 'zhiyu-saas-backup-*.dump' -type f -mtime +14 -delete
  else
    echo "  警告：PostgreSQL 未就绪，跳过备份"
  fi
else
  echo "==> 跳过数据库备份"
fi

# ==================== 停止旧服务（优雅停机） ====================
echo "==> 停止旧服务..."

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  pm2 stop "zhiyu-backend" &>/dev/null || true
  pm2 delete "zhiyu-backend" &>/dev/null || true
  if ! wait_for_port_release "$BACKEND_PORT" 10; then
    echo "  警告：后端端口 $BACKEND_PORT 仍未释放，尝试强制清理..." >&2
    backend_pid=$(lsof -t -i:"$BACKEND_PORT" 2>/dev/null || true)
    [[ -n "$backend_pid" ]] && kill -9 "$backend_pid" 2>/dev/null || true
  fi
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  for app in zhiyu-marketplace zhiyu-edu; do
    pm2 stop "$app" &>/dev/null || true
    pm2 delete "$app" &>/dev/null || true
  done

  if ! wait_for_port_release "$MARKETPLACE_PORT" 10; then
    echo "  警告：商城端口 $MARKETPLACE_PORT 仍未释放，尝试强制清理..." >&2
    pid=$(lsof -t -i:"$MARKETPLACE_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  fi

  if ! wait_for_port_release "$EDU_PORT" 10; then
    echo "  警告：教育管理端口 $EDU_PORT 仍未释放，尝试强制清理..." >&2
    pid=$(lsof -t -i:"$EDU_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  fi
fi

sleep 1

# ==================== 原子交换产物到部署目录 ====================
echo "==> 切换到新版本..."

if [[ "$FRONTEND_ONLY" != "true" && -f "$BACKEND_BIN_NEW" ]]; then
  mkdir -p "$(dirname "$DEPLOY_BACKEND_BIN")"
  [[ -f "$DEPLOY_BACKEND_BIN" ]] && mv "$DEPLOY_BACKEND_BIN" "$DEPLOY_BACKEND_DIR/bin/server.prev"
  mv "$BACKEND_BIN_NEW" "$DEPLOY_BACKEND_BIN"
  chmod +x "$DEPLOY_BACKEND_BIN"
  echo "  后端已切换"
fi

if [[ "$BACKEND_ONLY" != "true" && -d "$MARKETPLACE_STANDALONE" ]]; then
  echo "  复制商城 standalone 到部署目录..."
  rm -rf "$DEPLOY_MARKETPLACE_STANDALONE"
  mkdir -p "$(dirname "$DEPLOY_MARKETPLACE_STANDALONE")"
  cp -aL "$MARKETPLACE_STANDALONE" "$DEPLOY_MARKETPLACE_STANDALONE"
  rm -rf "$MARKETPLACE_STANDALONE"
  echo "  商城前端已切换"
fi

if [[ "$BACKEND_ONLY" != "true" && -d "$EDU_STANDALONE" ]]; then
  echo "  复制教育管理 standalone 到部署目录..."
  rm -rf "$DEPLOY_EDU_STANDALONE"
  mkdir -p "$(dirname "$DEPLOY_EDU_STANDALONE")"
  cp -aL "$EDU_STANDALONE" "$DEPLOY_EDU_STANDALONE"
  rm -rf "$EDU_STANDALONE"
  echo "  教育管理前端已切换"
fi

# ==================== 生成 PM2 配置文件 ====================
generate_ecosystem_config

# ==================== 数据库迁移 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 执行数据库迁移..."
  (cd "$BACKEND_DIR" && go run ./cmd/migrate/main.go up) || {
    echo "错误：数据库迁移失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
fi

# ==================== PM2 启动 ====================
echo ""
echo "==> 本地 PM2 启动服务..."

if [[ "$FRONTEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "zhiyu-marketplace,zhiyu-edu" --env production || {
    echo "错误：PM2 启动失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
elif [[ "$BACKEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --only "zhiyu-backend" --env production || {
    echo "错误：PM2 启动失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
else
  pm2 start "$DEPLOY_ECOSYSTEM_CONFIG" --env production || {
    echo "错误：PM2 启动失败" >&2
    restore_rollback "$SNAPSHOT_DIR"
    exit 1
  }
fi

pm2 save > /dev/null

# ==================== 健康检查 ====================
echo ""
echo "==> 等待服务就绪并执行健康检查..."

HEALTH_OK=true

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  if health_check "http://127.0.0.1:$BACKEND_PORT/health" 15 2; then
    echo "  后端健康检查通过: http://127.0.0.1:$BACKEND_PORT/health"
  else
    echo "  错误：后端健康检查失败" >&2
    HEALTH_OK=false
  fi
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  if health_check "http://127.0.0.1:$MARKETPLACE_PORT/login" 15 2; then
    echo "  商城健康检查通过: http://127.0.0.1:$MARKETPLACE_PORT/login"
  else
    echo "  错误：商城健康检查失败" >&2
    HEALTH_OK=false
  fi

  if health_check "http://127.0.0.1:$EDU_PORT/portal/login" 15 2; then
    echo "  教育管理健康检查通过: http://127.0.0.1:$EDU_PORT/portal/login"
  else
    echo "  错误：教育管理健康检查失败" >&2
    HEALTH_OK=false
  fi
fi

if [[ "$HEALTH_OK" != "true" ]]; then
  restore_rollback "$SNAPSHOT_DIR"
  exit 1
fi

# ==================== 清理旧产物 ====================
[[ -f "$DEPLOY_BACKEND_DIR/bin/server.prev" ]] && rm -f "$DEPLOY_BACKEND_DIR/bin/server.prev"

echo ""
echo "✨ 本地发布完成！"
echo "   部署目录: $DEPLOY_DIR"
echo "   商城访问: http://localhost:$MARKETPLACE_PORT"
echo "   教育管理访问: http://localhost:$EDU_PORT"
echo "   后端 API: http://localhost:$BACKEND_PORT"
echo "   上传目录: $DEPLOY_UPLOAD_DIR"
echo "   日志目录: $DEPLOY_LOG_DIR"
echo "   回滚快照: $SNAPSHOT_DIR"
echo ""
