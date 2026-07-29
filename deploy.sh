#!/bin/bash
#
# deploy.sh - 知育 SaaS 全 Docker 化一键部署/更新脚本
#
# 功能：
#   1. 空白服务器首次部署：自动安装 Docker/Go/Node/pnpm 等依赖，
#      自动生成 .env，初始化数据库 + 种子数据。
#   2. 已有服务升级：源码级增量构建，未变更的镜像直接跳过，数据库自动迁移。
#
# 用法：
#   ./deploy.sh --branch feat/xxx    分支隔离部署
#   ./deploy.sh --local              本地当前目录直接部署
#   ./deploy.sh --install-deps       仅安装/检查依赖
#   ./deploy.sh --install-nginx      在空白服务器上同时安装并配置 Nginx
#
set -euo pipefail

# ──────────────────────── 默认值 ────────────────────────
BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_CHECKS=false
SKIP_MERGE=false
FORCE_INSTALL=0
CLEAN_BUILD=false
INSTALL_DEPS_ONLY=false
INSTALL_NGINX=false
BRANCH_NAME=""
BACKEND_PORT=8080
EDU_PORT=3020
DEPLOY_DIR="/opt/zhiyu-saas"
NGINX_DST="/opt/1panel/www/conf.d/zhiyu-saas.conf"
ROLLBACK_KEEP=5

# ──────────────────────── 参数解析 ────────────────────────
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
    --install-nginx) INSTALL_NGINX=true; shift ;;
    --help|-h)
      cat <<EOF
用法:
  $0 --branch <分支名>   分支隔离部署
  $0 --local             本地目录直接部署
  $0 --install-deps      仅安装系统依赖
  $0 --install-nginx     自动安装/配置 Nginx（仅在空白服务器使用）

选项:
  --backend|-b       仅后端
  --frontend|-f      仅前端
  --force-install    强制重装依赖/重新构建
  --clean            清理 worktree 与构建缓存
  --skip-checks      跳过部分检查
  --skip-merge       分支部署后不自动合并回 master
EOF
      exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

[[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]] && {
  echo "错误：--backend 和 --frontend 互斥" >&2; exit 1; }

# ──────────────────────── 基础路径 ────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ──────────────────────── 工具函数 ────────────────────────
log() { echo "==> $*"; }
warn() { echo "  警告：$*" >&2; }
error() { echo "  错误：$*" >&2; exit 1; }

url_encode() {
  local raw="${1:-}"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$raw"
  else
    # 仅保留 URL 安全字符，兜底
    echo "$raw" | sed 's/[^A-Za-z0-9._~/-]//g'
  fi
}

url_decode() {
  local raw="${1:-}"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import urllib.parse,sys; print(urllib.parse.unquote(sys.argv[1]))" "$raw"
  else
    echo "$raw"
  fi
}

rand_str() {
  local len="${1:-24}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$((len * 2))" | tr -dc 'A-Za-z0-9' | head -c "$len"
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$len"
  fi
}

is_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]]; }

pkg_update_done=false
pkg_update() {
  is_root || return 0
  $pkg_update_done && return 0
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq || true
  fi
  pkg_update_done=true
}

pkg_install() {
  is_root || { warn "非 root 用户，跳过系统包安装：$*"; return 0; }
  pkg_update
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq "$@" 2>/dev/null || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "$@" 2>/dev/null || true
  else
    warn "未识别包管理器，请手动安装：$*"
  fi
}

detect_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif docker-compose version >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

# ──────────────────────── 代码仓库定位（支持空白服务器） ────────────────────────
ensure_project_root() {
  if git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
    ORIGINAL_ROOT="$PROJECT_ROOT"
    log "使用本地仓库: $PROJECT_ROOT"
    return
  fi

  if [[ -z "${REPO_URL:-}" ]]; then
    error "当前目录不是 git 仓库，且未设置 REPO_URL，无法自动拉取代码。\n      请设置 REPO_URL 后重试，例如：\n      export REPO_URL=https://github.com/your-org/zhiyu-saas.git"
  fi

  PROJECT_ROOT="$DEPLOY_DIR/source"
  ORIGINAL_ROOT="$PROJECT_ROOT"

  if [[ -d "$PROJECT_ROOT/.git" ]]; then
    log "更新已存在的代码目录: $PROJECT_ROOT"
    git -C "$PROJECT_ROOT" fetch origin --tags || true
    git -C "$PROJECT_ROOT" reset --hard "origin/master" || true
  else
    log "从 $REPO_URL 克隆代码..."
    rm -rf "$PROJECT_ROOT"
    git clone "$REPO_URL" "$PROJECT_ROOT"
  fi
}

# ──────────────────────── 环境配置生成 ────────────────────────
generate_env() {
  local target="$1"
  local example="$PROJECT_ROOT/.env.example"
  [[ -f "$example" ]] || error "缺少 .env.example 模板"

  log "未找到 .env，基于 .env.example 自动生成..."
  cp "$example" "$target"

  local db_pass jwt_secret
  db_pass="$(rand_str 24)"
  jwt_secret="$(rand_str 64)"

  # 生成与 docker-compose.yml 映射端口一致的本地数据库连接串
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://zhiyu_saas:${db_pass}@127.0.0.1:5433/zhiyu-saas?sslmode=disable|" "$target"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$target"

  # 补全部署相关变量（如未在模板中设置）
  grep -q '^DEPLOY_DIR=' "$target" || echo "DEPLOY_DIR=${DEPLOY_DIR}" >> "$target"
  grep -q '^REPO_URL=' "$target" || echo "REPO_URL=${REPO_URL:-}" >> "$target"
  grep -q '^NGINX_CONTAINER=' "$target" || echo "NGINX_CONTAINER=${NGINX_CONTAINER:-}" >> "$target"
  grep -q '^ROLLBACK_KEEP=' "$target" || echo "ROLLBACK_KEEP=${ROLLBACK_KEEP}" >> "$target"

  chmod 600 "$target"
  log "已生成 $target（管理员账号：admin / admin123）"
}

ensure_env() {
  local env_file="$PROJECT_ROOT/.env"

  # 优先使用项目中的 .env；若不存在则回退到已部署的 .env（避免升级时重新生成密码导致数据库连不上）
  if [[ ! -f "$env_file" && -f "$DEPLOY_DIR/.env" ]]; then
    log "复用已部署的 .env"
    cp -f "$DEPLOY_DIR/.env" "$env_file"
  fi

  if [[ ! -f "$env_file" ]]; then
    generate_env "$env_file"
  fi

  # 加载环境变量
  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  set +a

  # 同步到部署目录，供 docker compose 使用
  cp -f "$env_file" "$DEPLOY_DIR/.env"
  chmod 600 "$DEPLOY_DIR/.env"
}

# ──────────────────────── 依赖自动安装 ────────────────────────
install_deps() {
  log "检查系统依赖..."

  # 基础工具
  pkg_install curl ca-certificates gnupg lsb-release rsync git python3 openssl

  # ── Docker ──
  if ! command -v docker >/dev/null 2>&1; then
    log "安装 Docker..."
    if command -v apt-get >/dev/null 2>&1 && is_root; then
      # 优先使用官方脚本；失败时退回到包管理器
      curl -fsSL https://get.docker.com | bash 2>/dev/null || {
        pkg_install docker.io docker-compose-v2
        systemctl enable --now docker 2>/dev/null || true
      }
    elif command -v yum >/dev/null 2>&1 && is_root; then
      yum install -y docker
      systemctl enable --now docker 2>/dev/null || true
    else
      error "请手动安装 Docker (https://docs.docker.com/engine/install/)"
    fi
  fi

  if [[ -z "$(detect_docker_compose)" ]]; then
    log "安装 Docker Compose 插件..."
    pkg_install docker-compose-plugin || {
      # 兜底：安装独立 docker-compose
      curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose 2>/dev/null || true
      chmod +x /usr/local/bin/docker-compose 2>/dev/null || true
    }
  fi

  # 确保 docker daemon 运行
  if ! docker info >/dev/null 2>&1; then
    systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
    sleep 2
  fi

  # ── Go ──
  GO_MIN="1.25.0"
  install_go=true
  if command -v go >/dev/null 2>&1; then
    local gv
    gv="$(go version | awk '{print $3}' | sed 's/go//')"
    if [[ "$gv" == "$GO_MIN" || "$gv" > "$GO_MIN" ]]; then
      install_go=false
    else
      warn "当前 Go $gv 低于 $GO_MIN，将重新安装"
    fi
  fi

  if $install_go || [[ "$FORCE_INSTALL" == "1" ]]; then
    log "安装 Go $GO_MIN..."
    GO_VER="$GO_MIN"
    ARCH=$(uname -m)
    [[ "$ARCH" == "x86_64" ]] && ARCH="amd64"
    [[ "$ARCH" == "aarch64" ]] && ARCH="arm64"
    curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-${ARCH}.tar.gz" -o /tmp/go.tar.gz || \
    curl -fsSL "https://goproxy.cn/dl/go${GO_VER}.linux-${ARCH}.tar.gz" -o /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm -f /tmp/go.tar.gz
    export PATH="/usr/local/go/bin:$PATH"
    mkdir -p /etc/profile.d
    echo 'export PATH="/usr/local/go/bin:$PATH"' > /etc/profile.d/go.sh
  fi
  export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

  # ── Node.js + pnpm ──
  NODE_MIN=22
  install_node=true
  if command -v node >/dev/null 2>&1; then
    local nv
    nv="$(node -v | sed 's/v//;s/\..*//')"
    [[ "$nv" -ge "$NODE_MIN" ]] && install_node=false
  fi

  if $install_node || [[ "$FORCE_INSTALL" == "1" ]]; then
    log "安装 Node.js ${NODE_MIN}..."
    if command -v apt-get >/dev/null 2>&1 && is_root; then
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN}.x" | bash - 2>/dev/null
      pkg_install nodejs
    fi
    if ! command -v node >/dev/null 2>&1; then
      # 兜底二进制安装
      NODE_TAR="node-v22.12.0-linux-x64.tar.xz"
      curl -fsSL "https://nodejs.org/dist/v22.12.0/${NODE_TAR}" -o /tmp/node.tar.xz
      tar -C /usr/local --strip-components=1 -xJf /tmp/node.tar.xz
      rm -f /tmp/node.tar.xz
    fi
  fi

  if ! command -v pnpm >/dev/null 2>&1 || [[ "$FORCE_INSTALL" == "1" ]]; then
    log "安装 pnpm..."
    npm install -g pnpm 2>/dev/null || corepack enable pnpm 2>/dev/null || true
  fi

  # ── PostgreSQL client ──
  if [[ "$FRONTEND_ONLY" != "true" ]]; then
    if ! command -v psql >/dev/null 2>&1; then
      pkg_install postgresql-client || true
    fi
  fi

  log "依赖检查完成"
}

# ──────────────────────── 哈希/缓存工具 ────────────────────────
cache_file() { echo "$BUILD_CACHE/$1"; }

hash_files() {
  # 参数：要 hash 的路径列表
  find "$@" -type f 2>/dev/null | sort | md5sum | awk '{print $1}'
}

backend_hash() {
  hash_files "$BACKEND_DIR" \
    \( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' -o -name '*.sql' \) \
    -not -path '*/bin/*'
}

frontend_hash() {
  hash_files "$BUILD_ROOT/apps/edu" "$BUILD_ROOT/packages" \
    -not -path '*/node_modules/*' \
    -not -path '*/.next/*' \
    -not -path '*/.git/*'
}

pnpm_lock_hash() {
  md5sum "$BUILD_ROOT/pnpm-lock.yaml" 2>/dev/null | awk '{print $1}'
}

image_exists() {
  docker images -q "$1" 2>/dev/null | grep -q .
}

# ──────────────────────── Nginx 处理 ────────────────────────
install_nginx() {
  is_root || error "自动安装 Nginx 需要 root 权限"
  log "安装 Nginx..."
  pkg_install nginx

  local conf_src="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
  local site_dst="/etc/nginx/sites-available/zhiyu-saas.conf"
  cp "$conf_src" "$site_dst"
  ln -sf "$site_dst" /etc/nginx/sites-enabled/zhiyu-saas.conf

  nginx -t && systemctl reload nginx
  log "Nginx 已安装并加载配置"
}

update_nginx() {
  local conf_src="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
  [[ -f "$conf_src" ]] || { warn "未找到 Nginx 配置模板"; return; }

  if [[ -n "${NGINX_CONTAINER:-}" ]]; then
    if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
      cp -f "$conf_src" "$NGINX_DST"
      docker exec "$NGINX_CONTAINER" nginx -t 2>/dev/null && \
        docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null && \
        log "Nginx 容器 $NGINX_CONTAINER 重载成功" || warn "Nginx 配置测试/重载失败"
    else
      warn "Nginx 容器 $NGINX_CONTAINER 未运行"
    fi
    return
  fi

  # 1Panel OpenResty 路径兼容
  if [[ -d "$(dirname "$NGINX_DST")" ]]; then
    cp -f "$conf_src" "$NGINX_DST"
    log "Nginx 配置已更新到 $NGINX_DST"
    if docker ps --format '{{.Names}}' | grep -qx openresty; then
      docker exec openresty nginx -t 2>/dev/null && \
        docker exec openresty nginx -s reload 2>/dev/null && \
        log "OpenResty 重载成功" || warn "OpenResty 重载失败"
    fi
    return
  fi

  if [[ "$INSTALL_NGINX" == "true" ]]; then
    install_nginx
    return
  fi

  warn "未检测到 Nginx/OpenResty，跳过反向代理配置（使用 --install-nginx 可自动安装）"
}

# ═══════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════

# 允许通过环境变量覆盖默认值
DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
NGINX_DST="${NGINX_DST:-/opt/1panel/www/conf.d/zhiyu-saas.conf}"
ROLLBACK_KEEP="${ROLLBACK_KEEP:-5}"
REPO_URL="${REPO_URL:-}"
NGINX_CONTAINER="${NGINX_CONTAINER:-}"

DEPLOY_COMPOSE="$DEPLOY_DIR/docker-compose.yml"
BUILD_CACHE="$DEPLOY_DIR/.build-cache"

mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" "$DEPLOY_DIR/.rollback" "$BUILD_CACHE"

install_deps
[[ "$INSTALL_DEPS_ONLY" == "true" ]] && { log "✨ 依赖安装完毕"; exit 0; }

ensure_project_root
ensure_env

BACKEND_PORT="${PORT:-$BACKEND_PORT}"
EDU_PORT="${EDU_PORT:-3020}"

IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"

# 解析数据库连接信息
DB_USER="${DB_USER:-zhiyu_saas}"
DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD="$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_PASSWORD_ENC="$(url_encode "$DB_PASSWORD")"
MIGRATE_URL="postgres://${DB_USER}:${DB_PASSWORD_ENC}@127.0.0.1:5433/${DB_NAME}?sslmode=disable"

export IMAGE_TAG BACKEND_PORT EDU_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET REPO_URL NGINX_CONTAINER ROLLBACK_KEEP

# ──────────────────────── git 校验（分支模式） ────────────────────────
if [[ -n "$BRANCH_NAME" ]]; then
  [[ -n "$(git -C "$ORIGINAL_ROOT" status --porcelain 2>/dev/null)" ]] && {
    error "工作区不干净"; }
  git -C "$ORIGINAL_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  lc=$(git -C "$ORIGINAL_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  oc=$(git -C "$ORIGINAL_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && error "origin/$BRANCH_NAME 不存在"
  [[ "$lc" != "$oc" ]] && error "分支未推送"
fi

# ──────────────────────── 部署锁 ────────────────────────
LOCK_FILE="/tmp/zhiyu-deploy.lock"
if command -v flock >/dev/null 2>&1; then
  exec {LOCK_FD}>"$LOCK_FILE"
  flock "$LOCK_FD" || { log "等待部署锁..."; flock "$LOCK_FD"; }
  cleanup() { exec {LOCK_FD}>&- 2>/dev/null || true; }
  trap cleanup EXIT
fi

# ═══════════════════════════════════════════════════════════
# 分支模式：构建 worktree
# ═══════════════════════════════════════════════════════════
BUILD_ROOT="$PROJECT_ROOT"
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  log "分支: $BRANCH_NAME"

  if [[ "$CLEAN_BUILD" == "true" ]]; then
    git -C "$ORIGINAL_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
    rm -rf "$BUILD_TREE"
  fi

  if [[ -e "$BUILD_TREE/.git" ]]; then
    log "复用 worktree"
    git -C "$BUILD_TREE" checkout --detach --force origin/master 2>/dev/null || true
  else
    [[ -d "$BUILD_TREE" ]] && rm -rf "$BUILD_TREE"
    git -C "$ORIGINAL_ROOT" worktree add --detach "$BUILD_TREE" origin/master || {
      error "无法创建 worktree"; }
  fi

  rm -rf "$BUILD_TREE/apps/edu/.next" "$BUILD_TREE/backend/bin" 2>/dev/null || true
  git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit || {
    error "合并冲突"; git -C "$BUILD_TREE" merge --abort 2>/dev/null; }
  [[ -f "$ORIGINAL_ROOT/.env" ]] && cp "$ORIGINAL_ROOT/.env" "$BUILD_TREE/.env"

  BUILD_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$BUILD_ROOT/backend"
EDU_DIR="$BUILD_ROOT/apps/edu"

# 记录回滚镜像
PREV_BACKEND_IMAGE="$(docker inspect --format='{{.Config.Image}}' zhiyu-backend 2>/dev/null || true)"
PREV_FRONTEND_IMAGE="$(docker inspect --format='{{.Config.Image}}' zhiyu-edu 2>/dev/null || true)"
{
  echo "PREV_BACKEND_IMAGE=${PREV_BACKEND_IMAGE}"
  echo "PREV_FRONTEND_IMAGE=${PREV_FRONTEND_IMAGE}"
} > "$BUILD_CACHE/previous-images"

# ═══════════════════════════════════════════════════════════
# 构建后端
# ═══════════════════════════════════════════════════════════
if [[ "$FRONTEND_ONLY" != "true" ]]; then
  log "构建后端"

  BACKEND_HASH="$(backend_hash)"
  CACHED_HASH=""
  [[ -f "$(cache_file backend-src-hash)" ]] && CACHED_HASH=$(cat "$(cache_file backend-src-hash)")

  if [[ "$CLEAN_BUILD" != "true" && -n "$CACHED_HASH" && "$BACKEND_HASH" == "$CACHED_HASH" ]] && image_exists "zhiyu-backend:$IMAGE_TAG"; then
    log "  = 跳过 (无变更)"
  else
    log "  编译..."
    CGO_ENABLED=0 go build -C "$BACKEND_DIR" -ldflags="-s -w" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go

    log "  Docker 镜像 ($(du -h "$BACKEND_DIR/bin/server" | cut -f1))..."
    TMPCTX=$(mktemp -d)
    cp "$BACKEND_DIR/bin/server" "$TMPCTX/server"
    mkdir -p "$TMPCTX/migrations"
    rsync -a --delete "$BACKEND_DIR/migrations/" "$TMPCTX/migrations/"
    docker build -t "zhiyu-backend:$IMAGE_TAG" -f "$BACKEND_DIR/Dockerfile" "$TMPCTX" 2>&1 | tail -3
    rm -rf "$TMPCTX"
    echo "$BACKEND_HASH" > "$(cache_file backend-src-hash)"
  fi
fi

# ═══════════════════════════════════════════════════════════
# 构建前端
# ═══════════════════════════════════════════════════════════
if [[ "$BACKEND_ONLY" != "true" ]]; then
  log "构建前端"

  FRONTEND_HASH="$(frontend_hash)"
  CACHED_HASH=""
  [[ -f "$(cache_file frontend-src-hash)" ]] && CACHED_HASH=$(cat "$(cache_file frontend-src-hash)")

  if [[ "$CLEAN_BUILD" != "true" && -n "$CACHED_HASH" && "$FRONTEND_HASH" == "$CACHED_HASH" ]] && image_exists "zhiyu-edu:$IMAGE_TAG"; then
    log "  = 跳过 (无变更)"
  else
    # 依赖安装：仅当 node_modules 缺失、强制重装或 pnpm-lock.yaml 变更时执行
    NEED_INSTALL=false
    [[ ! -d "$BUILD_ROOT/node_modules" ]] && NEED_INSTALL=true
    [[ "$FORCE_INSTALL" == "1" ]] && NEED_INSTALL=true
    if [[ -f "$BUILD_ROOT/pnpm-lock.yaml" ]]; then
      LOCK_HASH="$(pnpm_lock_hash)"
      LOCK_CACHED=""
      [[ -f "$(cache_file pnpm-lock-hash)" ]] && LOCK_CACHED=$(cat "$(cache_file pnpm-lock-hash)")
      [[ "$LOCK_HASH" != "$LOCK_CACHED" ]] && NEED_INSTALL=true
    fi

    if $NEED_INSTALL; then
      log "  安装依赖..."
      (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
      (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || \
        error "pnpm install 失败"
      pnpm_lock_hash > "$(cache_file pnpm-lock-hash)" 2>/dev/null || true
    else
      log "  = 依赖已是最新，跳过安装"
    fi

    log "  构建 Next.js..."
    rm -rf "$EDU_DIR/.next"
    (cd "$BUILD_ROOT" && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      pnpm --filter @zhiyu/edu build) || error "前端构建失败"

    log "  组装 standalone..."
    SD="$EDU_DIR/.next/standalone/apps/edu"
    [[ -d "$EDU_DIR/.next/server" ]] && {
      mkdir -p "$SD/.next/server"
      rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/server/" "$SD/.next/server/"
    }
    [[ -d "$EDU_DIR/.next/static" ]] && {
      mkdir -p "$SD/.next/static"
      rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/static/" "$SD/.next/static/"
    }
    [[ -d "$EDU_DIR/public" ]] && {
      mkdir -p "$SD/public"
      rsync -a --delete "$EDU_DIR/public/" "$SD/public/"
    }

    log "  Docker 镜像..."
    docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR/.next/standalone" 2>&1 | tail -3
    echo "$FRONTEND_HASH" > "$(cache_file frontend-src-hash)"
  fi
fi

# ═══════════════════════════════════════════════════════════
# Docker 部署
# ═══════════════════════════════════════════════════════════
log "部署到 Docker"

DOCKER_COMPOSE_CMD="$(detect_docker_compose)"
[[ -z "$DOCKER_COMPOSE_CMD" ]] && error "未找到可用的 docker compose"

compose() {
  $DOCKER_COMPOSE_CMD -f "$DEPLOY_COMPOSE" "$@"
}

cp "$BUILD_ROOT/deploy/docker-compose.yml" "$DEPLOY_COMPOSE"

# 确保 .env 始终与部署目录同步
cp -f "$BUILD_ROOT/.env" "$DEPLOY_DIR/.env" 2>/dev/null || cp -f "$PROJECT_ROOT/.env" "$DEPLOY_DIR/.env"
chmod 600 "$DEPLOY_DIR/.env"

compose up -d --remove-orphans 2>&1 | tail -5

# ── 等待 PostgreSQL 就绪 ──
for i in $(seq 1 30); do
  compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done

# ── 数据库迁移 ──
log "数据库迁移..."
for i in $(seq 1 15); do psql "$MIGRATE_URL" -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

if [[ ! -f "$DEPLOY_DIR/.migration-baseline-done" ]]; then
  psql "$MIGRATE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null || true
  psql "$MIGRATE_URL" -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3
  psql "$MIGRATE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null || true
  touch "$DEPLOY_DIR/.migration-baseline-done"

  log "初始化种子数据..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/seed/main.go) || {
    warn "种子初始化失败"; }
  log "  = 运营方租户: platform / 管理员: admin / admin123"
else
  log "增量迁移..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/migrate/main.go up) || warn "迁移可能已是最新"
fi

# ── 等待健康检查 ──
log "等待服务就绪..."
OK=true
for svc in backend frontend; do
  found=false
  for i in $(seq 1 45); do
    S=$(compose ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
    if [[ "$S" == "healthy" ]]; then
      log "  $svc healthy"; found=true; break
    fi
    sleep 2
  done
  if ! $found; then
    warn "$svc 未就绪"; OK=false
  fi
done

if [[ "$OK" != "true" ]]; then
  error "部署失败，准备回滚..."

  if [[ -f "$BUILD_CACHE/previous-images" ]]; then
    # shellcheck source=/dev/null
    source "$BUILD_CACHE/previous-images"
    if [[ -n "${PREV_BACKEND_IMAGE:-}" && -n "${PREV_FRONTEND_IMAGE:-}" ]]; then
      log "回滚到上一个镜像..."
      ROLLBACK_TAG_BACKEND=$(echo "$PREV_BACKEND_IMAGE" | cut -d: -f2)
      ROLLBACK_TAG_FRONTEND=$(echo "$PREV_FRONTEND_IMAGE" | cut -d: -f2)
      # 仅当两个 tag 一致时使用同一 IMAGE_TAG，否则分别处理（通常一致）
      if [[ "$ROLLBACK_TAG_BACKEND" == "$ROLLBACK_TAG_FRONTEND" ]]; then
        IMAGE_TAG="$ROLLBACK_TAG_BACKEND" compose up -d --no-deps 2>&1 | tail -5
      else
        # 分别回退：先改服务镜像名再启动
        compose stop backend frontend 2>/dev/null || true
        docker tag "$PREV_BACKEND_IMAGE" "zhiyu-backend:rollback"
        docker tag "$PREV_FRONTEND_IMAGE" "zhiyu-edu:rollback"
        IMAGE_TAG=rollback compose up -d --no-deps 2>&1 | tail -5
      fi
    fi
  fi

  compose logs backend --tail 30
  exit 1
fi

compose ps

# 清理旧镜像，保留当前与上一个
if [[ -f "$BUILD_CACHE/previous-images" ]]; then
  # shellcheck source=/dev/null
  source "$BUILD_CACHE/previous-images"
  for img in zhiyu-backend zhiyu-edu; do
    prev_tag=""
    [[ "$img" == "zhiyu-backend" && -n "${PREV_BACKEND_IMAGE:-}" ]] && prev_tag=$(echo "$PREV_BACKEND_IMAGE" | cut -d: -f2)
    [[ "$img" == "zhiyu-edu" && -n "${PREV_FRONTEND_IMAGE:-}" ]] && prev_tag=$(echo "$PREV_FRONTEND_IMAGE" | cut -d: -f2)
    docker images "$img" --format '{{.Repository}}:{{.Tag}}' | \
      grep -v ":${IMAGE_TAG}$" | \
      { [[ -n "$prev_tag" ]] && grep -v ":${prev_tag}$" || cat; } | \
      xargs -r docker rmi 2>/dev/null || true
  done
fi

docker builder prune --all --force >/dev/null 2>&1 || true

# ═══════════════════════════════════════════════════════════
# Nginx + 合并
# ═══════════════════════════════════════════════════════════
update_nginx

if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  log "合并 $BRANCH_NAME → master"
  git -C "$ORIGINAL_ROOT" checkout master 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" pull origin master --ff-only 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" push origin master 2>/dev/null && \
  log "✅ 已合并" || warn "合并跳过"
fi

log "✨ 部署完成！"
echo "   后端: http://localhost:$BACKEND_PORT"
echo "   前端: http://localhost:$EDU_PORT"
echo "   管理: admin / admin123  (SaaS 登录)"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"
