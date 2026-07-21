#!/bin/bash
#
# deploydemo.sh - 演示环境部署脚本
#
# 说明：
#   本脚本把 Next.js 前端构建并部署到远程演示服务器，
#   后端和数据库复用当前服务器的已有服务（不迁移、不重启后端）。
#
# 用法：
#   ./deploydemo.sh                  # 全量构建并部署前端到演示服务器
#   ./deploydemo.sh --skip-build     # 跳过本地构建，直接上传当前 .next/standalone
#   ./deploydemo.sh --skip-checks    # 跳过代码检查
#   ./deploydemo.sh --help           # 显示帮助
#
set -euo pipefail

# ==================== 参数解析 ====================
SKIP_BUILD=false
SKIP_CHECKS=false
FORCE_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=true
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
      echo "用法：$0 [--skip-build] [--skip-checks] [--force-install]"
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      echo "用法：$0 [--skip-build] [--skip-checks] [--force-install]" >&2
      exit 1
      ;;
  esac
done

# ==================== 配置区 ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# 演示环境配置（可通过环境变量覆盖）
DEMO_HOST="${DEMO_HOST:-demo2.zhiyu.com.cn}"
DEMO_USER="${DEMO_USER:-root}"
DEMO_PASS="${DEMO_PASS:-lEL9cHcBQMjCEqp6}"
DEMO_SSH_KEY="${DEMO_SSH_KEY:-}"
DEMO_PORT="${DEMO_PORT:-3010}"
DEMO_API_URL="${DEMO_API_URL:-http://111.170.170.202:8080/api/v1}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/saas}"
SSH_PORT="${SSH_PORT:-22}"

SITE_NAME="saas"
FRONTEND_PORT="$DEMO_PORT"

EDU_DIR="$PROJECT_ROOT/apps/edu"
STANDALONE_DIR="$EDU_DIR/.next/standalone"
APP_DIR="$STANDALONE_DIR/apps/edu"
TMP_PKG_DIR="/dev/shm/zhiyu-saas-demo-pkg"

# ==================== 加载环境变量 ====================
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

# ==================== 清理函数 ====================
cleanup() {
  rm -rf "$TMP_PKG_DIR"
}

trap 'cleanup' EXIT

# ==================== 必需变量校验 ====================
REQUIRED_VARS=(DEMO_HOST DEMO_USER DEMO_API_URL)
for v in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "错误：缺少必需环境变量 ${v}，请在执行前设置" >&2
    echo "示例：" >&2
    echo "  export DEMO_HOST=demo.zhiyu.com.cn" >&2
    echo "  export DEMO_USER=root" >&2
    echo "  export DEMO_API_URL=http://你的后端IP:8080/api/v1" >&2
    exit 1
  fi
done

if [[ -z "$DEMO_PASS" && -z "$DEMO_SSH_KEY" ]]; then
  echo "错误：必须提供 DEMO_PASS（密码）或 DEMO_SSH_KEY（私钥路径）之一用于 SSH 登录" >&2
  exit 1
fi

# ==================== 本地依赖检查 ====================
echo "==> 检查本地部署依赖..."
LOCAL_DEPS_OK=true

for dep in pnpm node rsync ssh; do
  if ! command -v "$dep" > /dev/null 2>&1; then
    echo "错误：本地缺少必需工具 ${dep}，请先安装" >&2
    LOCAL_DEPS_OK=false
  fi
done

if [[ "$LOCAL_DEPS_OK" != "true" ]]; then
  exit 1
fi

# 构建 SSH 命令
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -p $SSH_PORT"
if [[ -n "$DEMO_SSH_KEY" && -f "$DEMO_SSH_KEY" ]]; then
  SSH_CMD="ssh -i $DEMO_SSH_KEY $SSH_OPTS"
else
  if ! command -v sshpass > /dev/null 2>&1; then
    echo "错误：使用密码登录时需要 sshpass，请先安装" >&2
    exit 1
  fi
  export SSHPASS="$DEMO_PASS"
  SSH_CMD="sshpass -e ssh $SSH_OPTS"
fi

cd "$PROJECT_ROOT"

# ==================== 代码检查 ====================
if [[ "$SKIP_CHECKS" != "true" && "$SKIP_BUILD" != "true" ]]; then
  echo "==> 运行代码检查..."
  echo "  前端类型检查..."
  (cd "$PROJECT_ROOT" && pnpm --filter @zhiyu/edu typecheck) || {
    echo "错误：前端 TypeScript 类型检查未通过，拒绝部署" >&2
    exit 1
  }
else
  echo "==> 跳过代码检查"
fi

# ==================== 安装前端依赖 ====================
if [[ "$SKIP_BUILD" != "true" ]]; then
  if [[ ! -d "node_modules" || "$FORCE_INSTALL" == "1" ]]; then
    echo "==> 安装前端依赖..."
    pnpm install --prefer-offline --no-frozen-lockfile
  else
    echo "==> node_modules 已存在，跳过依赖安装（设置 --force-install 可强制重新安装）"
  fi
fi

# ==================== 构建前端 ====================
if [[ "$SKIP_BUILD" != "true" ]]; then
  echo ""
  echo "==> 构建前端（API 指向: $DEMO_API_URL）..."

  # 演示环境通过 Next.js rewrite 代理 API 请求到远程后端
  # DEMO_API_URL 形如 http://host:port/api/v1，取前缀作为代理目标
  API_PROXY_URL="${DEMO_API_URL%/api/v1}"
  API_PROXY_URL="${API_PROXY_URL%/api}"
  export API_PROXY_URL
  rm -rf "$STANDALONE_DIR"
  pnpm --filter @zhiyu/edu build || {
    echo "错误：前端构建失败" >&2
    exit 1
  }

  echo "==> standalone 产物已由 Next.js 自动生成"
else
  if [[ ! -f "$APP_DIR/server.js" ]]; then
    echo "错误：--skip-build 模式下本地 standalone 产物不存在：$APP_DIR/server.js" >&2
    echo "   请先运行一次完整构建，或去掉 --skip-build" >&2
    exit 1
  fi
  echo "==> 跳过构建，使用现有 standalone 产物"
fi

# ==================== 准备远程部署包 ====================
echo ""
echo "==> 复制 standalone 产物到临时目录..."
rm -rf "$TMP_PKG_DIR"
mkdir -p "$TMP_PKG_DIR"
rsync -a --delete --exclude="*.map" --exclude="*.log" --exclude="logs/" "$STANDALONE_DIR/" "$TMP_PKG_DIR/"

# ==================== 上传并部署到远程服务器 ====================
echo ""
echo "==> 上传并部署到演示服务器 $DEMO_HOST ..."

$SSH_CMD "$DEMO_USER@$DEMO_HOST" "rm -rf $REMOTE_DIR && mkdir -p $REMOTE_DIR && chown $DEMO_USER:$DEMO_USER $REMOTE_DIR"

rsync -az --delete \
  -e "$SSH_CMD" \
  --timeout=300 \
  --exclude='*.map' \
  --exclude='*.log' \
  --exclude='logs/' \
  "$TMP_PKG_DIR/" \
  "$DEMO_USER@$DEMO_HOST:$REMOTE_DIR/"

# 上传远程 PM2 配置文件
cat > "$TMP_PKG_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [
    {
      name: '${SITE_NAME}',
      cwd: '${REMOTE_DIR}/apps/edu',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: ${FRONTEND_PORT},
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: ${FRONTEND_PORT},
        HOSTNAME: '0.0.0.0',
      },
      error_file: '${REMOTE_DIR}/logs/error.log',
      out_file: '${REMOTE_DIR}/logs/out.log',
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

rsync -az \
  -e "$SSH_CMD" \
  "$TMP_PKG_DIR/ecosystem.config.js" \
  "$DEMO_USER@$DEMO_HOST:$REMOTE_DIR/ecosystem.config.js"

# ==================== 远程启动服务 ====================
echo ""
echo "==> 远程启动 PM2 服务 ..."

$SSH_CMD "$DEMO_USER@$DEMO_HOST" "export SITE_NAME='$SITE_NAME'; export REMOTE_DIR='$REMOTE_DIR'; export FRONTEND_PORT='$FRONTEND_PORT'; bash -s" << 'REMOTE_EOF'
  set -euo pipefail

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  NODE_BIN=$(command -v node || echo "/usr/local/bin/node")
  if [[ ! -x "$NODE_BIN" ]]; then
    echo "错误：远程服务器未找到 node，请先安装 Node.js" >&2
    exit 1
  fi

  if ! command -v pm2 &>/dev/null; then
    echo ">>> 远程安装 pm2..."
    "$NODE_BIN" "$(command -v npm || echo '/usr/local/bin/npm')" install -g pm2
  fi

  cd "$REMOTE_DIR"
  mkdir -p logs

  # 删除旧服务，确保演示服务器只保留一个 saas 前端
  pm2 delete "saas" &>/dev/null || true
  pm2 delete "saas-demo" &>/dev/null || true

  # 确保端口未被旧进程占用，避免 stale inode / 文件句柄问题
  PID=$(lsof -t -i:"$FRONTEND_PORT" 2>/dev/null || true)
  if [[ -n "$PID" ]]; then
    echo "  发现端口 $FRONTEND_PORT 仍被占用，正在清理..."
    kill -9 "$PID" 2>/dev/null || true
    sleep 1
  fi

  PORT="$FRONTEND_PORT" HOSTNAME="0.0.0.0" pm2 start ecosystem.config.js --env production

  pm2 save > /dev/null
REMOTE_EOF

# ==================== 健康检查 ====================
echo ""
echo "==> 等待演示环境服务就绪..."
sleep 3

if $SSH_CMD "$DEMO_USER@$DEMO_HOST" "curl -sf -o /dev/null http://127.0.0.1:$FRONTEND_PORT/portal/login" > /dev/null 2>&1; then
  echo "  演示前端健康检查通过: http://$DEMO_HOST:$FRONTEND_PORT/portal/login"
else
  echo "  警告：演示前端健康检查未通过，请登录远程服务器查看 PM2 日志" >&2
  echo "       ssh $DEMO_USER@$DEMO_HOST" >&2
  echo "       pm2 logs $SITE_NAME" >&2
  exit 1
fi

echo ""
echo "✨ 演示环境部署完成！"
echo "   前端访问: http://$DEMO_HOST:$FRONTEND_PORT"
echo "   后端复用: $DEMO_API_URL"
echo ""
