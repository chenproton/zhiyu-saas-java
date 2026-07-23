#!/bin/bash
#
# deploydemo.sh - 知育 SaaS 演示服务器部署脚本
# 在目标服务器上直接执行，拉取代码 → 构建 → 部署 → 健康检查
#
# 用法：
#   ./deploydemo.sh                  # 全量部署（前端 + 后端）
#   ./deploydemo.sh --backend-only   # 仅部署后端
#   ./deploydemo.sh --frontend-only  # 仅部署前端
#   ./deploydemo.sh --skip-checks    # 跳过代码检查
#   ./deploydemo.sh --skip-backup    # 跳过数据库备份
#   ./deploydemo.sh --skip-pull      # 跳过 git pull
#
set -euo pipefail

# ==================== 参数解析 ====================
BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_CHECKS=false
SKIP_BACKUP=false
SKIP_PULL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only) BACKEND_ONLY=true; shift ;;
    --frontend-only) FRONTEND_ONLY=true; shift ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --help|-h)
      echo "用法：$0 [--backend-only] [--frontend-only] [--skip-checks] [--skip-backup] [--skip-pull]"
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]]; then
  echo "错误：--backend-only 和 --frontend-only 不能同时使用" >&2
  exit 1
fi

# ==================== 路径配置 ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
MARKETPLACE_DIR="$PROJECT_ROOT/apps/marketplace"
EDU_DIR="$PROJECT_ROOT/apps/edu"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
MARKETPLACE_PORT="${MARKETPLACE_PORT:-3010}"
EDU_PORT="${EDU_PORT:-3020}"

# Go 编译环境（中国大陆服务器使用 goproxy.cn 加速）
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"

# 加载 .env
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

BACKEND_PORT="${BACKEND_PORT_ENV:-${PORT:-$BACKEND_PORT}}"
MARKETPLACE_PORT="${MARKETPLACE_PORT_ENV:-$MARKETPLACE_PORT}"
EDU_PORT="${EDU_PORT_ENV:-$EDU_PORT}"

# ==================== 依赖检查 ====================
echo "==> 检查本地依赖..."
DEPS_OK=true

for dep in go node pnpm pm2 psql git; do
  if ! command -v "$dep" > /dev/null 2>&1; then
    echo "错误：缺少 $dep" >&2
    DEPS_OK=false
  fi
done

if [[ "$FRONTEND_ONLY" != "true" ]] && ! command -v pg_dump > /dev/null 2>&1 && [[ "$SKIP_BACKUP" != "true" ]]; then
  echo "错误：缺少 pg_dump（使用 --skip-backup 跳过数据库备份）" >&2
  DEPS_OK=false
fi

if [[ "$DEPS_OK" != "true" ]]; then
  exit 1
fi

# ==================== 必需环境变量 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  REQUIRED_VARS=(DATABASE_URL JWT_SECRET)
  for v in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!v:-}" ]]; then
      echo "错误：缺少环境变量 ${v}，请在 .env 中配置" >&2
      exit 1
    fi
  done
fi

# ==================== 拉取最新代码 ====================
if [[ "$SKIP_PULL" != "true" ]]; then
  echo "==> 拉取最新代码..."
  git pull origin master 2>&1 || {
    echo "错误：git pull 失败，使用 --skip-pull 跳过" >&2
    exit 1
  }
  echo "  当前 commit: $(git rev-parse --short HEAD)"
else
  echo "==> 跳过 git pull（--skip-pull）"
fi

# ==================== 辅助函数 ====================
health_check() {
  local url="$1"
  local max="${2:-20}"
  local interval="${3:-2}"
  local attempt=0
  while [[ $attempt -lt $max ]]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep "$interval"
    ((attempt++))
  done
  return 1
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
    ((elapsed++))
  done
  return 1
}

# ==================== 准备部署目录 ====================
echo "==> 准备部署目录: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/backend/bin" \
  "$DEPLOY_DIR/apps/marketplace" \
  "$DEPLOY_DIR/apps/edu" \
  "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" \
  "$DEPLOY_DIR/backups" \
  "$DEPLOY_DIR/.rollback"

# ==================== 代码检查 ====================
if [[ "$SKIP_CHECKS" != "true" ]]; then
  echo "==> 运行代码检查..."
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    echo "  Go 编译检查..."
    (cd "$BACKEND_DIR" && go build -o /dev/null ./cmd/server/main.go) || {
      echo "错误：Go 编译失败" >&2
      exit 1
    }
  fi
else
  echo "==> 跳过代码检查"
fi

# ==================== 安装依赖 ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  echo "==> 安装前端依赖..."
  pnpm install --prefer-offline --no-frozen-lockfile || {
    echo "错误：pnpm install 失败" >&2
    exit 1
  }
fi

# ==================== 构建后端 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 构建 Go 后端..."
  mkdir -p "$BACKEND_DIR/bin"
  go build -C "$BACKEND_DIR" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go || {
    echo "错误：Go 构建失败" >&2
    exit 1
  }
  echo "  后端构建完成"
fi

# ==================== 构建前端 ====================
if [[ "$BACKEND_ONLY" != "true" ]]; then
  echo "==> 构建商城前端..."
  rm -rf "$MARKETPLACE_DIR/.next/standalone"
  NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    pnpm --filter @zhiyu/marketplace build || {
    echo "错误：商城构建失败" >&2
    exit 1
  }
  # 组装 standalone 产物
  STANDALONE_M="$MARKETPLACE_DIR/.next/standalone/apps/marketplace"
  mkdir -p "$STANDALONE_M/.next/server"
  rsync -a --delete --exclude="*.map" "$MARKETPLACE_DIR/.next/server/" "$STANDALONE_M/.next/server/"
  if [[ -d "$MARKETPLACE_DIR/.next/static" ]]; then
    mkdir -p "$STANDALONE_M/.next/static"
    rsync -a --delete --exclude="*.map" "$MARKETPLACE_DIR/.next/static/" "$STANDALONE_M/.next/static/"
  fi
  if [[ -d "$MARKETPLACE_DIR/public" ]]; then
    mkdir -p "$STANDALONE_M/public"
    rsync -a --delete --exclude="*.map" "$MARKETPLACE_DIR/public/" "$STANDALONE_M/public/"
  fi
  echo "  商城构建完成"

  echo "==> 构建教育管理前端..."
  rm -rf "$EDU_DIR/.next/standalone"
  NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    pnpm --filter @zhiyu/edu build || {
    echo "错误：教育管理构建失败" >&2
    exit 1
  }
  STANDALONE_E="$EDU_DIR/.next/standalone/apps/edu"
  mkdir -p "$STANDALONE_E/.next/server"
  rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/server/" "$STANDALONE_E/.next/server/"
  if [[ -d "$EDU_DIR/.next/static" ]]; then
    mkdir -p "$STANDALONE_E/.next/static"
    rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/static/" "$STANDALONE_E/.next/static/"
  fi
  if [[ -d "$EDU_DIR/public" ]]; then
    mkdir -p "$STANDALONE_E/public"
    rsync -a --delete --exclude="*.map" "$EDU_DIR/public/" "$STANDALONE_E/public/"
  fi
  echo "  教育管理构建完成"
fi

# ==================== 数据库备份 ====================
if [[ "$SKIP_BACKUP" != "true" && "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 备份数据库..."
  BACKUP_FILE="$DEPLOY_DIR/backups/zhiyu-demo-$(date +%Y%m%d-%H%M%S).dump"
  if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
    pg_dump -d "$DATABASE_URL" -Fc -Z 6 > "$BACKUP_FILE.tmp" 2>/dev/null && mv "$BACKUP_FILE.tmp" "$BACKUP_FILE" && chmod 600 "$BACKUP_FILE" || {
      echo "  警告：数据库备份失败，继续部署..."
      rm -f "$BACKUP_FILE.tmp"
    }
    echo "  备份完成: $BACKUP_FILE"
    # 保留最近 14 天备份
    find "$DEPLOY_DIR/backups" -name 'zhiyu-demo-*.dump' -mtime +14 -delete 2>/dev/null || true
  else
    echo "  PostgreSQL 未就绪，跳过备份"
  fi
fi

# ==================== 停止旧服务 ====================
echo "==> 停止旧服务..."

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  pm2 stop zhiyu-demo-backend 2>/dev/null || true
  pm2 delete zhiyu-demo-backend 2>/dev/null || true
  wait_for_port_release "$BACKEND_PORT" 10 || {
    pid=$(lsof -t -i:"$BACKEND_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  }
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  for app in zhiyu-demo-marketplace zhiyu-demo-edu; do
    pm2 stop "$app" 2>/dev/null || true
    pm2 delete "$app" 2>/dev/null || true
  done
  wait_for_port_release "$MARKETPLACE_PORT" 10 || {
    pid=$(lsof -t -i:"$MARKETPLACE_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  }
  wait_for_port_release "$EDU_PORT" 10 || {
    pid=$(lsof -t -i:"$EDU_PORT" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  }
fi

sleep 1

# ==================== 复制产物到部署目录 ====================
echo "==> 部署产物到 $DEPLOY_DIR..."

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  cp "$BACKEND_DIR/bin/server" "$DEPLOY_DIR/backend/bin/server"
  chmod +x "$DEPLOY_DIR/backend/bin/server"
  cp "$PROJECT_ROOT/.env" "$DEPLOY_DIR/backend/.env"
  chmod 600 "$DEPLOY_DIR/backend/.env"
  echo "  后端已部署"
fi

if [[ "$BACKEND_ONLY" != "true" ]]; then
  MARKETPLACE_STANDALONE_ROOT="$MARKETPLACE_DIR/.next/standalone"
  if [[ -d "$MARKETPLACE_STANDALONE_ROOT" ]]; then
    rm -rf "$DEPLOY_DIR/apps/marketplace/.next/standalone"
    mkdir -p "$(dirname "$DEPLOY_DIR/apps/marketplace/.next/standalone")"
    cp -a "$MARKETPLACE_STANDALONE_ROOT" "$DEPLOY_DIR/apps/marketplace/.next/standalone"
    echo "  商城前端已部署"
  fi

  EDU_STANDALONE_ROOT="$EDU_DIR/.next/standalone"
  if [[ -d "$EDU_STANDALONE_ROOT" ]]; then
    rm -rf "$DEPLOY_DIR/apps/edu/.next/standalone"
    mkdir -p "$(dirname "$DEPLOY_DIR/apps/edu/.next/standalone")"
    cp -a "$EDU_STANDALONE_ROOT" "$DEPLOY_DIR/apps/edu/.next/standalone"
    echo "  教育管理前端已部署"
  fi
fi

# ==================== 生成 PM2 配置 ====================
cat > "$DEPLOY_DIR/ecosystem.config.js" << PM2EOF
module.exports = {
  apps: [
    {
      name: 'zhiyu-demo-backend',
      cwd: '$DEPLOY_DIR/backend',
      script: './bin/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        PORT: $BACKEND_PORT,
        UPLOAD_DIR: '$DEPLOY_DIR/data/uploads',
      },
      error_file: '$DEPLOY_DIR/logs/backend-error.log',
      out_file: '$DEPLOY_DIR/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
    },
    {
      name: 'zhiyu-demo-marketplace',
      cwd: '$DEPLOY_DIR/apps/marketplace/.next/standalone/apps/marketplace',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $MARKETPLACE_PORT,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '$DEPLOY_DIR/logs/marketplace-error.log',
      out_file: '$DEPLOY_DIR/logs/marketplace-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      kill_timeout: 5000,
    },
    {
      name: 'zhiyu-demo-edu',
      cwd: '$DEPLOY_DIR/apps/edu/.next/standalone/apps/edu',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $EDU_PORT,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '$DEPLOY_DIR/logs/edu-error.log',
      out_file: '$DEPLOY_DIR/logs/edu-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      kill_timeout: 5000,
    },
  ],
};
PM2EOF

# ==================== 数据库迁移 ====================
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  echo "==> 执行数据库迁移..."
  (cd "$BACKEND_DIR" && go run ./cmd/migrate/main.go up) || {
    echo "错误：数据库迁移失败" >&2
    exit 1
  }
fi

# ==================== PM2 启动 ====================
echo ""
echo "==> 启动服务..."

if [[ "$FRONTEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_DIR/ecosystem.config.js" --only "zhiyu-demo-marketplace,zhiyu-demo-edu" --env production || {
    echo "错误：PM2 启动失败" >&2
    exit 1
  }
elif [[ "$BACKEND_ONLY" == "true" ]]; then
  pm2 start "$DEPLOY_DIR/ecosystem.config.js" --only "zhiyu-demo-backend" --env production || {
    echo "错误：PM2 启动失败" >&2
    exit 1
  }
else
  pm2 start "$DEPLOY_DIR/ecosystem.config.js" --env production || {
    echo "错误：PM2 启动失败" >&2
    exit 1
  }
fi

pm2 save

# ==================== 健康检查 ====================
echo ""
echo "==> 健康检查..."

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
  echo ""
  echo "⚠️  部分服务健康检查失败，请检查日志:" >&2
  echo "   pm2 logs --lines 50" >&2
  exit 1
fi

echo ""
echo "✨ 部署完成！"
echo "   部署目录: $DEPLOY_DIR"
echo "   后端 API: http://localhost:$BACKEND_PORT"
echo "   商城前端: http://localhost:$MARKETPLACE_PORT"
echo "   教育管理: http://localhost:$EDU_PORT"
echo "   日志目录: $DEPLOY_DIR/logs"
echo ""
echo "   查看日志: pm2 logs"
echo "   查看状态: pm2 status"
