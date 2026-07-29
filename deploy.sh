#!/bin/bash
#
# deploy.sh - 知育 SaaS 一键部署/更新
#
# 用法:
#   ./deploy.sh --branch feat/xxx    # 分支隔离部署
#   ./deploy.sh                      # 部署 master 最新代码
#
# 选项:
#   --clean      清空构建缓存，全量重建
#   --skip-merge 部署成功不自动合并到 master
#
# 所有行为自动判断:
#   首次运行 → 安装依赖、生成 .env、初始化数据库+种子数据
#   后续运行 → 增量更新，仅编译变更部分
#   前后端变更 → 各自独立判断，无变更则跳过
#
set -euo pipefail

# ── 参数 ──
BRANCH_NAME=""; CLEAN_BUILD=false; SKIP_MERGE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --help|-h)
      echo "用法: $0 --branch <分支名> [--clean] [--skip-merge]"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

# ── 常量 ──
BACKEND_PORT=8080; EDU_PORT=3020
DEPLOY_DIR="/opt/zhiyu-saas"
NGINX_DST="/etc/nginx/conf.d/zhiyu-saas.conf"
OFFLINE_DIR="${OFFLINE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/offline}"
NODE_VERSION="${NODE_VERSION:-22.12.0}"

# 确保非交互式 shell 也能找到本脚本安装的 Go/Node/pnpm
export PATH="/usr/local/go/bin:/usr/local/bin:$PATH"

# ── 工具函数 ──
log()   { echo "==> $*"; }
warn()  { echo "  警告：$*" >&2; }
die()   { echo "  错误：$*" >&2; exit 1; }
is_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]]; }

# 检查端口是否被占用（包含本机进程与 Docker 容器映射）
port_in_use() {
  local port="$1"
  ss -tlnp 2>/dev/null | awk '{print $4}' | grep -qE ":${port}$" && return 0
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "0\.0\.0\.0:${port}->|127\.0\.0\.1:${port}->|\*:${port}->" && return 0
  return 1
}

# 端口冲突解决：首选端口被占用时依次尝试备用端口及后续 9 个递增端口
resolve_port() {
  local name="$1" primary="$2" fallback="$3"
  local port
  for port in "$primary" "$fallback" $(seq $((fallback + 1)) $((fallback + 9))); do
    if ! port_in_use "$port"; then
      if [[ "$port" != "$primary" ]]; then
        warn "${name} 端口 ${primary} 已被占用，已自动切换至 ${port}"
      fi
      echo "$port"
      return 0
    fi
  done
  die "${name} 端口 ${primary} 及备用端口 ${fallback}-$((fallback + 9)) 均已被占用，请手动释放或修改 .env 中的 ${name}"
}

# 更新 .env 中的变量（不存在则追加）
update_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

url_decode() {
  command -v python3 >/dev/null 2>&1 && \
    python3 -c "import urllib.parse,sys; print(urllib.parse.unquote(sys.argv[1]))" "$1" || echo "$1"
}
url_encode() {
  command -v python3 >/dev/null 2>&1 && \
    python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1" || echo "$1"
}
rand_str() {
  local len="${1:-24}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$((len * 2))" | tr -dc 'A-Za-z0-9' | head -c "$len"
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$len"
  fi
}

pkg_updated=false
pkg_install() {
  is_root || return 0
  $pkg_updated || { apt-get update -qq 2>/dev/null || yum makecache -q 2>/dev/null || true; pkg_updated=true; }
  if command -v apt-get >/dev/null 2>&1; then apt-get install -y -qq "$@" 2>/dev/null || true
  elif command -v yum >/dev/null 2>&1; then yum install -y "$@" 2>/dev/null || true
  fi
}

detect_docker_compose() {
  docker compose version >/dev/null 2>&1 && { echo "docker compose"; return; }
  docker-compose version >/dev/null 2>&1 && { echo "docker-compose"; return; }
  echo ""
}

# 保留最近 N 个镜像（按 image 创建时间），清理过旧的镜像及其所有标签
prune_old_images() {
  local repo="$1" keep="${2:-5}"
  local ids
  ids=$(docker images --format '{{.ID}}|{{.CreatedAt}}' "$repo" 2>/dev/null | \
         sort -t'|' -k2 -r | tail -n +$((keep + 1)) | cut -d'|' -f1 | sort -u)
  for id in $ids; do
    [[ -n "$id" ]] || continue
    docker rmi "$id" >/dev/null 2>&1 || true
  done
}

# 检查本地离线资源是否存在
offline_file() {
  local path="$OFFLINE_DIR/$1"
  [[ -f "$path" ]] && echo "$path" && return 0
  return 1
}

# 加载 offline/docker-images/ 下的镜像 tar 包
load_offline_images() {
  [[ -d "$OFFLINE_DIR/docker-images" ]] || return 0
  local loaded=false
  for tar in "$OFFLINE_DIR"/docker-images/*.tar; do
    [[ -f "$tar" ]] || continue
    log "加载本地 Docker 镜像: $(basename "$tar")"
    docker load -i "$tar" 2>&1 | tail -2
    loaded=true
  done
  $loaded && log "本地 Docker 镜像加载完成"
}

# 执行数据库迁移；若 migrate 工具失败，使用 psql 兜底逐个执行未应用迁移文件
run_migrations() {
  local backend_dir="$1" migrate_url="$2"
  if (cd "$backend_dir" && DATABASE_URL="$migrate_url" go run ./cmd/migrate/main.go up); then
    return 0
  fi

  warn "migrate 工具执行失败，尝试使用 psql 兜底执行未应用迁移..."
  local applied_versions
  applied_versions=$(psql "$migrate_url" -Atc "SELECT version FROM schema_migrations;" 2>/dev/null || true)

  local failed=false
  for f in "$backend_dir"/migrations/*.up.sql; do
    [[ -f "$f" ]] || continue
    local version
    version=$(basename "$f" | sed 's/_.*//')
    if echo "$applied_versions" | grep -qx "$version"; then
      continue
    fi
    log "  兜底执行: $(basename "$f")"
    if psql "$migrate_url" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -5; then
      psql "$migrate_url" -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING;" >/dev/null || true
    else
      failed=true
      warn "兜底迁移失败: $(basename "$f")"
    fi
  done

  if $failed; then
    return 1
  fi
  return 0
}

# ── 哈希计算 ──
# 基于文件内容哈希，避免构建路径不同导致缓存失效
source_hash() {
  find "$@" -type f \( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' -o -name '*.sql' -o -name 'Dockerfile' \) \
    -not -path '*/bin/*' -print0 2>/dev/null | sort -z | xargs -0 -r md5sum | \
    awk '{print $1}' | sort | md5sum | awk '{print $1}'
}
frontend_hash() {
  find "$1/apps/edu" "$1/packages" -type f \
    -not -path '*/node_modules/*' -not -path '*/.next/*' \
    -not -name '*.tsbuildinfo' -not -name '*.map' -print0 2>/dev/null | sort -z | xargs -0 -r md5sum | \
    awk '{print $1}' | sort | md5sum | awk '{print $1}'
}
lock_hash() { md5sum "$1/pnpm-lock.yaml" 2>/dev/null | awk '{print $1}'; }

# ════════════════════════════════════════════
# 1. 自动安装系统依赖
# ════════════════════════════════════════════
log "检查系统依赖..."
is_root && pkg_install curl ca-certificates rsync git python3 openssl

# Docker
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker..."
  is_root || die "需要 root 安装 Docker"
  if local_docker_script=$(offline_file "get-docker.sh"); then
    log "  使用本地安装脚本: $local_docker_script"
    bash "$local_docker_script" 2>/dev/null || pkg_install docker.io
  else
    curl -fsSL https://get.docker.com | bash 2>/dev/null || pkg_install docker.io
  fi
  systemctl enable --now docker 2>/dev/null || true
fi
if ! docker info >/dev/null 2>&1; then
  systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true; sleep 2
fi

# 配置 Docker Hub 镜像加速（支持 .env 覆盖，每次部署按 .env 刷新，避免旧镜像源过期）
configure_docker_mirrors() {
  is_root || return 0
  local daemon_file="/etc/docker/daemon.json"
  local mirrors=""

  if [[ -n "${DOCKER_REGISTRY_MIRRORS:-}" ]]; then
    mirrors=$(python3 -c "import sys; print('\n'.join(x.strip() for x in sys.argv[1].split(',') if x.strip()))" "$DOCKER_REGISTRY_MIRRORS")
  else
    # .env 未配置时探测默认 mirror，任意一个可用即采用
    for url in "https://docker.1panel.live" "https://docker.m.daocloud.io"; do
      if timeout 10 curl -fsSLI "${url}/v2/" >/dev/null 2>&1; then
        mirrors="$url"
        break
      fi
    done
  fi

  mkdir -p /etc/docker
  local tmp_file
  tmp_file=$(mktemp)
  python3 - <<PY
import json, os
mirrors = [m.strip() for m in """${mirrors}""".strip().splitlines() if m.strip()]
config = {"registry-mirrors": mirrors} if mirrors else {}
with open("$tmp_file", "w") as f:
    json.dump(config, f, indent=2)
PY

  if [[ -f "$daemon_file" ]] && diff -q "$tmp_file" "$daemon_file" >/dev/null 2>&1; then
    rm -f "$tmp_file"
    return 0
  fi

  [[ -f "$daemon_file" ]] && cp -f "$daemon_file" "${daemon_file}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
  mv -f "$tmp_file" "$daemon_file"

  if [[ -n "$mirrors" ]]; then
    log "已配置 Docker Hub 镜像加速：$(echo "$mirrors" | tr '\n' ' ')"
  else
    log "未配置 Docker Hub 镜像加速（使用 docker hub 直连）"
  fi

  systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || true
  sleep 2
}
configure_docker_mirrors

if [[ -z "$(detect_docker_compose)" ]]; then
  pkg_install docker-compose-plugin || true
fi
DOCKER_COMPOSE=$(detect_docker_compose)
[[ -z "$DOCKER_COMPOSE" ]] && die "未找到可用的 docker compose"
compose() { $DOCKER_COMPOSE -f "$DEPLOY_COMPOSE" "$@"; }

# Nginx（宿主标准 nginx，作为统一网关）
if ! command -v nginx >/dev/null 2>&1; then
  log "安装 Nginx..."
  is_root || die "需要 root 安装 Nginx"
  pkg_install nginx
fi
systemctl unmask nginx 2>/dev/null || true
systemctl enable --now nginx 2>/dev/null || true
# 禁用 Ubuntu/Debian 默认站点，并清理可能存在的旧 zhiyu-saas 站点配置，避免 server 块冲突
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/zhiyu-saas /etc/nginx/sites-available/zhiyu-saas

# Go
if ! command -v go >/dev/null 2>&1; then
  is_root || die "需要 root 安装 Go"
  log "安装 Go..."
  ARCH=$(uname -m); [[ "$ARCH" == "x86_64" ]] && ARCH="amd64"; [[ "$ARCH" == "aarch64" ]] && ARCH="arm64"
  GO_VERSION="${GO_VERSION:-1.23.7}"
  GO_TARBALL="go${GO_VERSION}.linux-${ARCH}.tar.gz"
  GO_DOWNLOADED=false
  if local_go=$(offline_file "$GO_TARBALL"); then
    log "  使用本地 Go 安装包: $local_go"
    cp -f "$local_go" /tmp/go.tar.gz
    GO_DOWNLOADED=true
  else
    for url in \
      "https://mirrors.aliyun.com/golang/${GO_TARBALL}" \
      "https://go.dev/dl/${GO_TARBALL}" \
      "https://goproxy.cn/dl/${GO_TARBALL}"; do
      if curl -fsSL "$url" -o /tmp/go.tar.gz 2>/dev/null; then
        log "  下载 Go ${GO_VERSION} 成功: $url"
        GO_DOWNLOADED=true
        break
      fi
      warn "下载失败: $url"
    done
  fi
  [[ "$GO_DOWNLOADED" == "true" ]] || die "无法下载 Go ${GO_VERSION}，请检查 GO_VERSION、offline/ 目录或网络"
  rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz && rm -f /tmp/go.tar.gz
  export PATH="/usr/local/go/bin:$PATH"
  echo 'export PATH="/usr/local/go/bin:$PATH"' > /etc/profile.d/go.sh
fi
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

# Node.js + pnpm
if ! command -v node >/dev/null 2>&1; then
  is_root || die "需要 root 安装 Node.js"
  log "安装 Node.js..."
  NODE_TARBALL_NAME="node-v${NODE_VERSION}-linux-x64.tar.xz"
  NODE_TARBALL="/tmp/node.tar.xz"
  HAVE_NODE_TARBALL=false
  NODE_INSTALLED=false

  if local_node=$(offline_file "$NODE_TARBALL_NAME"); then
    log "  使用本地 Node.js 安装包: $local_node"
    cp -f "$local_node" "$NODE_TARBALL"
    HAVE_NODE_TARBALL=true
  elif command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
    pkg_install nodejs
    command -v node >/dev/null 2>&1 && NODE_INSTALLED=true
  fi

  # apt 安装成功则无需再解压 tarball；否则必须下载/使用本地 tarball 解压
  if [[ "$NODE_INSTALLED" != "true" ]]; then
    if [[ "$HAVE_NODE_TARBALL" != "true" ]]; then
      curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL_NAME}" -o "$NODE_TARBALL" 2>/dev/null || \
        die "无法下载 Node.js ${NODE_VERSION}，请检查 offline/ 目录或网络"
      HAVE_NODE_TARBALL=true
    fi
    tar -C /usr/local --strip-components=1 -xJf "$NODE_TARBALL" && rm -f "$NODE_TARBALL"
  fi
fi
if ! command -v pnpm >/dev/null 2>&1; then
  local_pnpm_tgz=""
  for f in "$OFFLINE_DIR"/pnpm-*.tgz; do
    [[ -f "$f" ]] && { local_pnpm_tgz="$f"; break; }
  done
  if [[ -n "$local_pnpm_tgz" ]]; then
    log "  使用本地 pnpm 安装包: $local_pnpm_tgz"
    npm install -g "$local_pnpm_tgz" 2>/dev/null || die "本地 pnpm 安装失败"
  else
    npm install -g pnpm 2>/dev/null || corepack enable pnpm 2>/dev/null || true
  fi
fi

# PostgreSQL client
command -v psql >/dev/null 2>&1 || pkg_install postgresql-client

log "依赖准备完成"

# ════════════════════════════════════════════
# 2. 代码仓库 & 环境配置
# ════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 定位仓库：当前是 git 目录直接用，否则从 REPO_URL clone
if git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
  ORIGINAL_ROOT="$PROJECT_ROOT"
else
  [[ -z "${REPO_URL:-}" ]] && die "当前不是 git 仓库，请设置环境变量 REPO_URL 后重试"
  PROJECT_ROOT="$DEPLOY_DIR/source"
  ORIGINAL_ROOT="$PROJECT_ROOT"
  if [[ -d "$PROJECT_ROOT/.git" ]]; then
    git -C "$PROJECT_ROOT" fetch origin --tags || true
    git -C "$PROJECT_ROOT" reset --hard origin/master || true
  else
    log "克隆代码: $REPO_URL"
    rm -rf "$PROJECT_ROOT"
    git clone "$REPO_URL" "$PROJECT_ROOT"
  fi
fi

# .env 配置 — 首次自动生成，后续复用
ENV_FILE="$PROJECT_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$DEPLOY_DIR/.env" ]]; then
    cp "$DEPLOY_DIR/.env" "$ENV_FILE"
    log "复用已部署的 .env"
  else
    [[ -f "$PROJECT_ROOT/.env.example" ]] || die "缺少 .env.example 模板"
    cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
    db_pass=$(rand_str 24)
    jwt_secret=$(rand_str 64)
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://zhiyu_saas:${db_pass}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/zhiyu-saas?sslmode=disable|" "$ENV_FILE"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$ENV_FILE"
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${db_pass}|" "$ENV_FILE"
    # 写入部署相关默认值，便于用户后续修改
    {
      echo ""
      echo "# 部署配置（由 deploy.sh 首次生成）"
      echo "GO_VERSION=${GO_VERSION:-1.23.7}"
      echo "NGINX_SERVER_NAME=${NGINX_SERVER_NAME:-_}"
      echo "NGINX_DEFAULT_SERVER=${NGINX_DEFAULT_SERVER:-default_server}"
      echo "NGINX_PORT=${NGINX_PORT:-80}"
      echo "BACKEND_PORT=${BACKEND_PORT:-8080}"
      echo "EDU_PORT=${EDU_PORT:-3020}"
      echo "POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT:-5433}"
      echo "KKFILEVIEW_HOST_PORT=${KKFILEVIEW_HOST_PORT:-8012}"
      echo "ENABLE_KKFILEVIEW=${ENABLE_KKFILEVIEW:-false}"
      echo "KKFILEVIEW_IMAGE=${KKFILEVIEW_IMAGE:-fangzhengjin/kkfileview:4.4.0}"
      echo "DOCKER_REGISTRY_MIRRORS=${DOCKER_REGISTRY_MIRRORS:-}"
      echo "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-admin123}"
    } >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "已生成 .env（管理员: admin / admin123）"
  fi
fi
set -a; source "$ENV_FILE"; set +a

# ════════════════════════════════════════════
# 端口冲突检测与自动回退
# ════════════════════════════════════════════
NGINX_PORT=$(resolve_port "NGINX_PORT" "${NGINX_PORT:-80}" "2026")
BACKEND_PORT=$(resolve_port "BACKEND_PORT" "${BACKEND_PORT:-8080}" "8081")
EDU_PORT=$(resolve_port "EDU_PORT" "${EDU_PORT:-3020}" "3021")
POSTGRES_HOST_PORT=$(resolve_port "POSTGRES_HOST_PORT" "${POSTGRES_HOST_PORT:-5433}" "5434")
KKFILEVIEW_HOST_PORT=$(resolve_port "KKFILEVIEW_HOST_PORT" "${KKFILEVIEW_HOST_PORT:-8012}" "8013")

update_env_var "$ENV_FILE" "NGINX_PORT" "$NGINX_PORT"
update_env_var "$ENV_FILE" "BACKEND_PORT" "$BACKEND_PORT"
update_env_var "$ENV_FILE" "EDU_PORT" "$EDU_PORT"
update_env_var "$ENV_FILE" "POSTGRES_HOST_PORT" "$POSTGRES_HOST_PORT"
update_env_var "$ENV_FILE" "KKFILEVIEW_HOST_PORT" "$KKFILEVIEW_HOST_PORT"

# 如果数据库 host 端口发生变化，同步更新 DATABASE_URL 中的 host 端口
if [[ "$DATABASE_URL" != *":${POSTGRES_HOST_PORT}/zhiyu-saas"* ]]; then
  DATABASE_URL=$(echo "$DATABASE_URL" | sed -E "s|@127\.0\.0\.1:[0-9]+/|@127.0.0.1:${POSTGRES_HOST_PORT}/|")
  update_env_var "$ENV_FILE" "DATABASE_URL" "$DATABASE_URL"
fi

set -a; source "$ENV_FILE"; set +a

# 输出最终端口信息，方便用户访问
log "服务端口配置："
[[ "$NGINX_PORT" != "80" ]] && log "  nginx 监听端口: ${NGINX_PORT}（80 被占用，已自动切换）"
log "  前端入口: http://<服务器IP>:${NGINX_PORT}/portal/login"

DEPLOY_COMPOSE="$DEPLOY_DIR/docker-compose.yml"
BUILD_CACHE="$DEPLOY_DIR/.build-cache"
IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"

# 将 IMAGE_TAG 写回 .env，确保 docker compose 能读取到实际镜像标签
if grep -q "^IMAGE_TAG=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "$ENV_FILE"
else
  echo "IMAGE_TAG=${IMAGE_TAG}" >> "$ENV_FILE"
fi
set -a; source "$ENV_FILE"; set +a

# 数据库连接
DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")
DB_PASSWORD="${DB_PASSWORD:-}"
MIGRATE_URL="postgres://${DB_USER}:$(url_encode "$DB_PASSWORD")@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${DB_NAME}?sslmode=disable"
export IMAGE_TAG BACKEND_PORT EDU_PORT POSTGRES_HOST_PORT KKFILEVIEW_HOST_PORT NGINX_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET

# ── 分支校验 ──
if [[ -n "$BRANCH_NAME" ]]; then
  [[ -n "$(git -C "$ORIGINAL_ROOT" status --porcelain 2>/dev/null)" ]] && die "工作区不干净，请先提交或清理"
  git -C "$ORIGINAL_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  lc=$(git -C "$ORIGINAL_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  oc=$(git -C "$ORIGINAL_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && die "origin/$BRANCH_NAME 不存在，请先 git push"
  [[ "$lc" != "$oc" ]] && die "本地 $BRANCH_NAME 与 origin 不一致，请先 git push"
fi

# ── 部署锁 ──
LOCK_FILE="/tmp/zhiyu-deploy.lock"
if command -v flock >/dev/null 2>&1; then
  exec {LOCK_FD}>"$LOCK_FILE"
  flock "$LOCK_FD" || { log "等待部署锁..."; flock "$LOCK_FD"; }
  cleanup() { exec {LOCK_FD}>&- 2>/dev/null || true; }
  trap cleanup EXIT
fi

# ════════════════════════════════════════════
# 3. 分支 worktree
# ════════════════════════════════════════════
BUILD_ROOT="$PROJECT_ROOT"
if [[ -n "$BRANCH_NAME" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  log "构建分支: $BRANCH_NAME"

  [[ "$CLEAN_BUILD" == "true" ]] && { git -C "$ORIGINAL_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true; rm -rf "$BUILD_TREE"; }

  if [[ -e "$BUILD_TREE/.git" ]]; then
    git -C "$BUILD_TREE" checkout --detach --force origin/master 2>/dev/null || true
  else
    [[ -d "$BUILD_TREE" ]] && rm -rf "$BUILD_TREE"
    git -C "$ORIGINAL_ROOT" worktree add --detach "$BUILD_TREE" origin/master || die "无法创建 worktree"
  fi

  # 保留 apps/edu/.next 以复用 Next.js 增量产物；仅清理后端编译产物
  rm -rf "$BUILD_TREE/backend/bin" 2>/dev/null || true
  git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit || { git -C "$BUILD_TREE" merge --abort 2>/dev/null; die "合并冲突，请先 rebase master"; }
  [[ -f "$ORIGINAL_ROOT/.env" ]] && cp "$ORIGINAL_ROOT/.env" "$BUILD_TREE/.env"
  BUILD_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$BUILD_ROOT/backend"
EDU_DIR="$BUILD_ROOT/apps/edu"

mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" "$DEPLOY_DIR/.rollback" "$BUILD_CACHE"

# 记录当前镜像（用于回滚）
PREV_BACKEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-backend 2>/dev/null || true)"
PREV_FRONTEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-edu 2>/dev/null || true)"

# ════════════════════════════════════════════
# 4. 构建后端（变更自动检测）
# ════════════════════════════════════════════
BACKEND_HASH=$(source_hash "$BACKEND_DIR")
BUILD_BACKEND=true
[[ "$CLEAN_BUILD" != "true" ]] && [[ -f "$BUILD_CACHE/backend-hash" ]] && \
  [[ "$BACKEND_HASH" == "$(cat "$BUILD_CACHE/backend-hash")" ]] && \
  [[ -n "$(docker images -q "zhiyu-backend:$BACKEND_HASH" 2>/dev/null)" ]] && BUILD_BACKEND=false

if $BUILD_BACKEND; then
  log "构建后端"
  mkdir -p "$BUILD_CACHE/go-cache"
  CGO_ENABLED=0 GOCACHE="$BUILD_CACHE/go-cache" \
    go build -C "$BACKEND_DIR" -ldflags="-s -w" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go

  TMPCTX=$(mktemp -d)
  cp "$BACKEND_DIR/bin/server" "$TMPCTX/server"
  mkdir -p "$TMPCTX/migrations"
  rsync -a --delete "$BACKEND_DIR/migrations/" "$TMPCTX/migrations/"
  docker build -t "zhiyu-backend:$IMAGE_TAG" -f "$BACKEND_DIR/Dockerfile" "$TMPCTX" 2>&1 | tail -3
  docker tag "zhiyu-backend:$IMAGE_TAG" "zhiyu-backend:$BACKEND_HASH"
  rm -rf "$TMPCTX"
  echo "$BACKEND_HASH" > "$BUILD_CACHE/backend-hash"
else
  log "后端: 无变更，跳过"
  # 当前 commit 标签也要指向同一镜像，compose 才能正常拉起
  docker tag "zhiyu-backend:$BACKEND_HASH" "zhiyu-backend:$IMAGE_TAG" 2>/dev/null || true
fi

# ════════════════════════════════════════════
# 5. 构建前端（变更自动检测）
# ════════════════════════════════════════════
FRONTEND_HASH=$(frontend_hash "$BUILD_ROOT")
BUILD_FRONTEND=true
[[ "$CLEAN_BUILD" != "true" ]] && [[ -f "$BUILD_CACHE/frontend-hash" ]] && \
  [[ "$FRONTEND_HASH" == "$(cat "$BUILD_CACHE/frontend-hash")" ]] && \
  [[ -n "$(docker images -q "zhiyu-edu:$FRONTEND_HASH" 2>/dev/null)" ]] && BUILD_FRONTEND=false

# 依赖版本变化时，即使源码文件没动也要重新安装依赖并构建前端
NEED_INSTALL=false
[[ ! -d "$BUILD_ROOT/node_modules" ]] && NEED_INSTALL=true
LOCK_HASH=$(lock_hash "$BUILD_ROOT")
CACHED_LOCK=""; [[ -f "$BUILD_CACHE/lock-hash" ]] && CACHED_LOCK=$(cat "$BUILD_CACHE/lock-hash")
[[ "$LOCK_HASH" != "$CACHED_LOCK" ]] && { NEED_INSTALL=true; BUILD_FRONTEND=true; }

if $BUILD_FRONTEND; then
  log "构建前端"

  if $NEED_INSTALL; then
    log "  安装依赖..."
    (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || die "pnpm install 失败"
    echo "$LOCK_HASH" > "$BUILD_CACHE/lock-hash"
  fi

  [[ "$CLEAN_BUILD" == "true" ]] && rm -rf "$EDU_DIR/.next"
  (cd "$BUILD_ROOT" && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    pnpm --filter @zhiyu/edu build) || die "前端构建失败"

  SD="$EDU_DIR/.next/standalone/apps/edu"
  [[ -d "$EDU_DIR/.next/server" ]] && { mkdir -p "$SD/.next/server"; rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/server/" "$SD/.next/server/"; }
  [[ -d "$EDU_DIR/.next/static" ]] && { mkdir -p "$SD/.next/static"; rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/static/" "$SD/.next/static/"; }
  [[ -d "$EDU_DIR/public" ]] && { mkdir -p "$SD/public"; rsync -a --delete "$EDU_DIR/public/" "$SD/public/"; }

  docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR/.next/standalone" 2>&1 | tail -3
  docker tag "zhiyu-edu:$IMAGE_TAG" "zhiyu-edu:$FRONTEND_HASH"
  echo "$FRONTEND_HASH" > "$BUILD_CACHE/frontend-hash"
else
  log "前端: 无变更，跳过"
  docker tag "zhiyu-edu:$FRONTEND_HASH" "zhiyu-edu:$IMAGE_TAG" 2>/dev/null || true
fi

# ════════════════════════════════════════════
# 6. Docker 部署
# ════════════════════════════════════════════
log "部署到 Docker"

cp "$BUILD_ROOT/deploy/docker-compose.yml" "$DEPLOY_COMPOSE"
cp -f "$BUILD_ROOT/.env" "$DEPLOY_DIR/.env" 2>/dev/null || cp -f "$PROJECT_ROOT/.env" "$DEPLOY_DIR/.env"
chmod 600 "$DEPLOY_DIR/.env"

# 收养旧版独立 kkfileview 容器：若存在非 compose 管理的同名容器，先停掉移除，避免端口/名称冲突
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx '^kkfileview$'; then
  log "发现旧版独立 kkfileview 容器，正在接管..."
  docker stop kkfileview >/dev/null 2>&1 || true
  docker rm kkfileview >/dev/null 2>&1 || true
fi

# 优先加载本地 Docker 镜像，避免无法联网时 pull 失败
load_offline_images

COMPOSE_PROFILES=""
[[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]] && COMPOSE_PROFILES="--profile kkfileview"
compose up -d --remove-orphans $COMPOSE_PROFILES 2>&1 | tail -5

# 等待 PG
for i in $(seq 1 30); do
  compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done

# 数据库迁移
log "数据库迁移..."
for i in $(seq 1 15); do psql "$MIGRATE_URL" -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

# 迁移前备份（失败仅警告，不阻断部署）
BACKUP_FILE="$DEPLOY_DIR/backups/zhiyu-saas-$(date +%Y%m%d-%H%M%S).sql"
compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null \
  || { warn "数据库备份失败，已跳过"; rm -f "$BACKUP_FILE"; }

if [[ ! -f "$DEPLOY_DIR/.migration-done" ]]; then
  psql "$MIGRATE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null || true
  psql "$MIGRATE_URL" -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3
  psql "$MIGRATE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null || true
  touch "$DEPLOY_DIR/.migration-done"

  # baseline 之后补齐后续增量迁移（migrate 自动跳过 schema_migrations 已记录版本）
  run_migrations "$BACKEND_DIR" "$MIGRATE_URL" || die "数据库迁移失败"

  log "初始化种子数据..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" go run ./cmd/seed/main.go) || warn "种子初始化失败"
  log "  运营方租户: platform / 管理员: admin / admin123"
else
  run_migrations "$BACKEND_DIR" "$MIGRATE_URL" || die "数据库迁移失败"
fi

# 健康检查
log "等待服务就绪..."
OK=true
for svc in backend frontend; do
  found=false
  for i in $(seq 1 45); do
    S=$(compose ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
    [[ "$S" == "healthy" ]] && { log "  $svc healthy"; found=true; break; }
    sleep 2
  done
  $found || { warn "$svc 未就绪"; OK=false; }
done

if ! $OK; then
  if [[ -z "$PREV_BACKEND" || -z "$PREV_FRONTEND" ]]; then
    compose logs backend --tail 30
    die "部署失败，且没有旧镜像可回滚（首次部署），请排查后重试"
  fi
  log "部署失败，回滚旧镜像..."
  docker tag "$PREV_BACKEND" "zhiyu-backend:rollback" 2>/dev/null || true
  docker tag "$PREV_FRONTEND" "zhiyu-edu:rollback" 2>/dev/null || true
  IMAGE_TAG=rollback compose up -d --no-deps backend frontend 2>&1 | tail -3
  compose logs backend --tail 30
  die "部署失败，已回滚"
fi

# 等待 kkfileview 就绪（非核心服务，仅避免 nginx 重载到未就绪端口）
if [[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]]; then
  for i in $(seq 1 60); do
    wget -qO- http://127.0.0.1:${KKFILEVIEW_HOST_PORT}/kkfileview/onlinePreview >/dev/null 2>&1 && { log "  kkfileview ready"; break; }
    sleep 2
  done
fi

compose ps
[[ "$CLEAN_BUILD" == "true" ]] && docker builder prune --all --force >/dev/null 2>&1 || true

# 清理过旧的镜像标签，每侧保留最近 5 个
prune_old_images "zhiyu-backend" 5
prune_old_images "zhiyu-edu" 5

# ════════════════════════════════════════════
# 7. Nginx + 合并
# ════════════════════════════════════════════
NGINX_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  NGINX_SERVER_NAME="${NGINX_SERVER_NAME:-_}"
  NGINX_DEFAULT_SERVER="${NGINX_DEFAULT_SERVER:-default_server}"
  sed -e 's/\${NGINX_SERVER_NAME:-_}/'"${NGINX_SERVER_NAME}"'/g' \
      -e 's/\${NGINX_DEFAULT_SERVER:-default_server}/'"${NGINX_DEFAULT_SERVER}"'/g' \
      -e 's/\${NGINX_PORT:-80}/'"${NGINX_PORT}"'/g' \
      -e 's/\${BACKEND_PORT:-8080}/'"${BACKEND_PORT}"'/g' \
      -e 's/\${EDU_PORT:-3020}/'"${EDU_PORT}"'/g' \
      -e 's/\${KKFILEVIEW_HOST_PORT:-8012}/'"${KKFILEVIEW_HOST_PORT}"'/g' \
      "$NGINX_CONF" > "$NGINX_DST"

  if ! nginx -t 2>/dev/null; then
    warn "nginx 配置测试失败，常见原因："
    warn "  1. ${NGINX_PORT} 端口已被其他进程占用"
    warn "  2. 系统中存在其他 nginx 配置语法冲突"
    warn "可手动检查：nginx -t"
    die "Nginx 配置测试失败"
  fi

  if systemctl is-active nginx >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null && log "Nginx 重载成功" || {
      warn "nginx 重载失败，可能 ${NGINX_PORT} 端口被占用"
      die "Nginx 重载失败"
    }
  else
    systemctl start nginx 2>/dev/null && log "Nginx 启动成功" || {
      warn "nginx 启动失败，常见原因："
      warn "  - ${NGINX_PORT} 端口被占用（如其他 Docker 容器映射了该端口）"
      warn "  - 可执行 ss -tlnp | grep :${NGINX_PORT} 查看占用进程"
      warn "  - 或修改 .env 中的 NGINX_PORT 使用其他端口"
      die "Nginx 启动失败"
    }
  fi
fi

if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
  log "合并 $BRANCH_NAME → master"
  git -C "$ORIGINAL_ROOT" checkout master 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" pull origin master --ff-only 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>/dev/null && \
  git -C "$ORIGINAL_ROOT" push origin master 2>/dev/null && log "✅ 已合并" || warn "合并跳过"
fi

log "✨ 部署完成！"
echo "   外部入口: http://<服务器IP>:${NGINX_PORT}/portal/login"
echo "   nginx 端口: ${NGINX_PORT}"
echo "   后端容器: http://localhost:${BACKEND_PORT}"
echo "   前端容器: http://localhost:${EDU_PORT}"
echo "   管理: admin / admin123  (SaaS 登录)"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"
