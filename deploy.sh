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
#   --gates      构建前执行质量门禁（默认跳过，GitHub Actions 已覆盖；go vet/test、pnpm typecheck/lint）
#   --skip-merge 部署成功不自动合并到 master
#
# 所有行为自动判断:
#   首次运行 → 安装依赖、生成 .env、初始化数据库+种子数据
#   后续运行 → 增量更新，仅编译变更部分
#   前后端变更 → 各自独立判断，无变更则跳过
#
set -euo pipefail

# ── 参数 ──
BRANCH_NAME=""; CLEAN_BUILD=false; SKIP_MERGE=false; FORCE_FLAG=false; GATES_FLAG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --force) FORCE_FLAG=true; shift ;;
    --gates) GATES_FLAG=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --help|-h)
      echo "用法: $0 --branch <分支名> [--clean] [--force] [--gates] [--skip-merge]"; exit 0 ;;
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

# 检查端口是否被占用（包含本机进程与 Docker 容器映射）。
# 本项目自身容器（zhiyu-* / kkfileview）发布的端口不算占用——compose up 会重建这些容器并释放端口；
# allow_nginx=true 时（仅 NGINX_PORT）自身 nginx 监听的端口也不算占用——本脚本会重写 zhiyu-saas.conf 并 reload，
# 真正的冲突由后续 nginx -t 兜底报错。
port_in_use() {
  local port="$1" allow_nginx="${2:-false}"
  if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '^(zhiyu-[a-z-]+|kkfileview) ' | grep -qE "(0\.0\.0\.0|127\.0\.0\.1|\*):${port}->"; then
    return 1
  fi
  if [[ "$allow_nginx" == "true" ]] && ss -tlnp 2>/dev/null | awk -v p="$port" '$4 ~ ":" p "$"' | grep -q '"nginx"'; then
    return 1
  fi
  ss -tlnp 2>/dev/null | awk '{print $4}' | grep -qE ":${port}$" && return 0
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "0\.0\.0\.0:${port}->|127\.0\.0\.1:${port}->|\*:${port}->" && return 0
  return 1
}

# 端口冲突解决：首选端口被占用时依次尝试备用端口及后续 9 个递增端口
resolve_port() {
  local name="$1" primary="$2" fallback="$3" allow_nginx="${4:-false}"
  local port
  for port in "$primary" "$fallback" $(seq $((fallback + 1)) $((fallback + 9))); do
    if ! port_in_use "$port" "$allow_nginx"; then
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
  if command -v apt-get >/dev/null 2>&1; then
    # 锁定内核元包，避免 apt install 其他包时顺带升级内核导致需要重启
    apt-mark hold linux-image-generic linux-headers-generic 2>/dev/null || true
    apt-get install -y -qq "$@" 2>/dev/null || true
  elif command -v yum >/dev/null 2>&1; then yum install -y "$@" 2>/dev/null || true
  fi
}

detect_docker_compose() {
  docker compose version >/dev/null 2>&1 && { echo "docker compose"; return; }
  docker-compose version >/dev/null 2>&1 && { echo "docker-compose"; return; }
  echo ""
}

# 清理旧构建镜像：每侧仅保留最近 keep 个（默认 1，即当前在用镜像）。
# 历史问题：镜像同时带 IMAGE_TAG 与内容 hash 两个标签，docker rmi <id> 会因
# "referenced in multiple repositories" 失败并被 || true 吞掉，导致旧镜像永远删不掉。
# 修复要点：
#   1. 先按 ID 去重再计数，避免多标签把最新镜像挤进待删列表
#   2. 用 -f 强制删除（连带所有标签）
#   3. 仍被任何容器（含已停止）引用的镜像不动，docker 本身也会拒绝删除
prune_old_images() {
  local repo="$1" keep="${2:-1}"
  local used ids id
  used=$(docker ps -a --format '{{.Image}}' 2>/dev/null | grep -E "^${repo}:" | \
           while read -r img; do docker images -q "$img" 2>/dev/null; done | sort -u)
  # 按创建时间倒序，再用 awk 按 ID 去重（保留首次出现=最新记录），保持行序即新旧顺序。
  # 注意：不能用 sort -u -k1,1 去重——它会按 ID 重新排序，破坏时间序，
  # 导致"保留最新 keep 个"实际变成"保留 ID 最小 keep 个"，旧镜像漏删
  ids=$(docker images --format '{{.ID}}|{{.CreatedAt}}' "$repo" 2>/dev/null | \
          sort -t'|' -k2 -r | awk -F'|' '!seen[$1]++ {print $1}' | tail -n +$((keep + 1)))
  for id in $ids; do
    [[ -n "$id" ]] || continue
    if echo "$used" | grep -qx "$id"; then
      warn "镜像 $repo 的 $(echo "$id" | cut -c1-12) 正在被容器使用，跳过清理"
      continue
    fi
    docker rmi -f "$id" >/dev/null 2>&1 || true
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
  local to_load=()
  for tar in "$OFFLINE_DIR"/docker-images/*.tar; do
    [[ -f "$tar" ]] || continue
    local img
    img=$(tar xfO "$tar" manifest.json 2>/dev/null | python3 -c "
import json,sys
for m in json.load(sys.stdin):
    if 'RepoTags' in m:
        for t in m['RepoTags']:
            if t: print(t.split(':')[0])" 2>/dev/null | head -1)
    if [[ -n "$img" ]] && docker images -q "$img" &>/dev/null; then
      continue
    fi
    to_load+=("$tar")
  done
  [[ ${#to_load[@]} -gt 0 ]] || { return 0; }
  for tar in "${to_load[@]}"; do
    log "加载本地 Docker 镜像: $(basename "$tar")"
    docker load -i "$tar" 2>&1 | tail -2
  done
  log "本地 Docker 镜像加载完成"
  return 0
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
# 离线 deb 包本地安装（离线模式下 pkg_install 被跳过，依赖 offline/debs/）
install_offline_debs() {
  local deb_dir="$OFFLINE_DIR/debs"
  [[ -d "$deb_dir" ]] || return 0
  local marker="$DEPLOY_DIR/.debs-installed"
  [[ -f "$marker" ]] && return 0
  local to_install=()
  for deb in "$deb_dir"/*.deb; do
    [[ -f "$deb" ]] || continue
    local pkg
    pkg=$(dpkg-deb -f "$deb" Package 2>/dev/null || true)
    if [[ -n "$pkg" ]] && dpkg -s "$pkg" &>/dev/null; then
      continue
    fi
    to_install+=("$deb")
  done
  if [[ ${#to_install[@]} -gt 0 ]]; then
    log "安装离线 deb 包（${#to_install[@]} 个）..."
    dpkg -i "${to_install[@]}" 2>/dev/null || {
      apt-get install -y -f -qq 2>/dev/null || true
      dpkg -i "${to_install[@]}" 2>/dev/null || true
    }
    log "离线 deb 包安装完成"
  fi
  touch "$marker"
}

log "检查系统依赖..."
# 优先从本地 deb 安装，再校验关键命令，缺失则尝试 apt 安装
install_offline_debs
for bin in curl rsync git python3 openssl; do
  command -v "$bin" >/dev/null 2>&1 || { is_root && pkg_install "$bin"; }
done

# Docker
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker..."
  is_root || die "需要 root 安装 Docker"
  # 优先用本地 deb 包安装
  if ls "$OFFLINE_DIR"/debs/docker-ce_*_amd64.deb "$OFFLINE_DIR"/debs/containerd.io_*_amd64.deb >/dev/null 2>&1; then
    dpkg -i "$OFFLINE_DIR"/debs/containerd.io_*_amd64.deb \
             "$OFFLINE_DIR"/debs/docker-ce-cli_*_amd64.deb \
             "$OFFLINE_DIR"/debs/docker-ce_*_amd64.deb \
             "$OFFLINE_DIR"/debs/docker-buildx-plugin_*_amd64.deb \
             "$OFFLINE_DIR"/debs/docker-compose-plugin_*_amd64.deb 2>/dev/null
    apt-get install -y -f -qq 2>/dev/null || true
    systemctl enable --now docker 2>/dev/null || true
  elif local_docker_script=$(offline_file "get-docker.sh"); then
    log "  使用本地安装脚本: $local_docker_script"
    bash "$local_docker_script" 2>/dev/null || pkg_install docker.io
    systemctl enable --now docker 2>/dev/null || true
  else
    warn "无法使用本地离线安装脚本，将通过 curl | bash 安装 docker（未校验 checksum，建议部署前人工核验 get.docker.com 脚本）"
    curl -fsSL https://get.docker.com | bash 2>/dev/null || pkg_install docker.io
    systemctl enable --now docker 2>/dev/null || true
  fi
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

DOCKER_COMPOSE=$(detect_docker_compose)
if [[ -z "$DOCKER_COMPOSE" ]]; then
  pkg_install docker-compose-plugin || true
  DOCKER_COMPOSE=$(detect_docker_compose)
  [[ -z "$DOCKER_COMPOSE" ]] && die "未找到可用的 docker compose"
fi
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
    warn "无法使用本地 Node.js 安装包，将通过 curl | bash 安装 NodeSource 源（未校验 checksum，建议部署前人工核验 nodesource.com 脚本）"
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
if ! command -v psql >/dev/null 2>&1; then
  pkg_install postgresql-client
fi

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
  [[ -z "${REPO_URL:-}" ]] && die "当前不是 git 仓库且未设置 REPO_URL"
  PROJECT_ROOT="$DEPLOY_DIR/source"
  ORIGINAL_ROOT="$PROJECT_ROOT"
  if [[ -d "$PROJECT_ROOT/.git" ]]; then
    git -C "$PROJECT_ROOT" fetch origin --tags 2>/dev/null || true
    git -C "$PROJECT_ROOT" reset --hard origin/master 2>/dev/null || true
  else
    log "克隆代码: $REPO_URL"
    rm -rf "$PROJECT_ROOT"
    git clone "$REPO_URL" "$PROJECT_ROOT" 2>/dev/null || die "git clone 失败，请检查 REPO_URL 或网络"
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
      echo "NGINX_SSL_DOMAIN=${NGINX_SSL_DOMAIN:-}"
      echo "NGINX_SSL_CERT=${NGINX_SSL_CERT:-}"
      echo "NGINX_SSL_CERT_KEY=${NGINX_SSL_CERT_KEY:-}"
      echo "BACKEND_PORT=${BACKEND_PORT:-8080}"
      echo "EDU_PORT=${EDU_PORT:-3020}"
      echo "POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT:-5433}"
      echo "KKFILEVIEW_HOST_PORT=${KKFILEVIEW_HOST_PORT:-8012}"
      echo "ENABLE_KKFILEVIEW=${ENABLE_KKFILEVIEW:-true}"
      echo "KKFILEVIEW_IMAGE=${KKFILEVIEW_IMAGE:-fangzhengjin/kkfileview:4.4.0}"
      echo "KK_BASE_URL=${KK_BASE_URL:-}"  # deploy.sh 会根据 nginx 配置自动推导
      echo "DOCKER_REGISTRY_MIRRORS=${DOCKER_REGISTRY_MIRRORS:-}"
      echo "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-admin123}"
    } >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "已生成 .env（管理员: admin / admin123）"
  fi
fi
set -a; source "$ENV_FILE"; set +a

# 旧 .env 若未配置 ENABLE_KKFILEVIEW，默认启用（预览功能依赖 kkFileView）
if ! grep -q "^ENABLE_KKFILEVIEW=" "$ENV_FILE" 2>/dev/null; then
  update_env_var "$ENV_FILE" "ENABLE_KKFILEVIEW" "true"
  ENABLE_KKFILEVIEW=true
fi

# 根据 .env 启用 docker compose profile，兼容 docker compose 与 docker-compose
if [[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]]; then
  export COMPOSE_PROFILES="kkfileview"
else
  unset COMPOSE_PROFILES 2>/dev/null || true
fi

# ════════════════════════════════════════════
# 端口冲突检测与自动回退
# ════════════════════════════════════════════
NGINX_PORT=$(resolve_port "NGINX_PORT" "${NGINX_PORT:-80}" "2026" "true")
BACKEND_PORT=$(resolve_port "BACKEND_PORT" "${BACKEND_PORT:-8080}" "8081")
EDU_PORT=$(resolve_port "EDU_PORT" "${EDU_PORT:-3020}" "3021")
POSTGRES_HOST_PORT=$(resolve_port "POSTGRES_HOST_PORT" "${POSTGRES_HOST_PORT:-5433}" "5434")
KKFILEVIEW_HOST_PORT=$(resolve_port "KKFILEVIEW_HOST_PORT" "${KKFILEVIEW_HOST_PORT:-8012}" "8013")

update_env_var "$ENV_FILE" "NGINX_PORT" "$NGINX_PORT"
update_env_var "$ENV_FILE" "BACKEND_PORT" "$BACKEND_PORT"
update_env_var "$ENV_FILE" "EDU_PORT" "$EDU_PORT"
update_env_var "$ENV_FILE" "POSTGRES_HOST_PORT" "$POSTGRES_HOST_PORT"
update_env_var "$ENV_FILE" "KKFILEVIEW_HOST_PORT" "$KKFILEVIEW_HOST_PORT"

# kkFileView 对外地址：未手动设置时，根据当前 nginx 配置自动推导协议和域名
if [[ -z "${KK_BASE_URL:-}" ]]; then
  if [[ -n "${NGINX_SSL_DOMAIN:-}" ]] || [[ -f /etc/nginx/conf.d/zhiyu-saas-ssl.conf ]] || [[ -f /etc/nginx/conf.d/ai-zhiyu-https.conf ]] || [[ -n "${NGINX_SSL_CERT:-}" ]] || [[ "${NGINX_PORT:-80}" == "443" ]]; then
    kk_scheme="https"
  else
    kk_scheme="http"
  fi
  if [[ -n "${NGINX_SSL_DOMAIN:-}" ]]; then
    kk_host="$NGINX_SSL_DOMAIN"
  else
    kk_host="${NGINX_SERVER_NAME:-_}"
    [[ "$kk_host" == "_" ]] && kk_host="localhost"
  fi
  KK_BASE_URL="${kk_scheme}://${kk_host}/kkfileview"
fi
update_env_var "$ENV_FILE" "KK_BASE_URL" "$KK_BASE_URL"

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
set -a; source "$ENV_FILE"; set +a

# 数据库连接
DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")
DB_PASSWORD="${DB_PASSWORD:-}"
MIGRATE_URL="postgres://${DB_USER}:$(url_encode "$DB_PASSWORD")@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${DB_NAME}?sslmode=disable"
export IMAGE_TAG BACKEND_PORT EDU_PORT POSTGRES_HOST_PORT KKFILEVIEW_HOST_PORT NGINX_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET

# ── 分支校验 ──
if [[ -n "$BRANCH_NAME" ]]; then
  git -C "$ORIGINAL_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  lc=$(git -C "$ORIGINAL_ROOT" rev-parse "$BRANCH_NAME" 2>/dev/null || true)
  oc=$(git -C "$ORIGINAL_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && die "origin/$BRANCH_NAME 不存在，请先 git push"
  [[ "$lc" != "$oc" ]] && die "本地 $BRANCH_NAME 与 origin 不一致，请先 git push"
fi

# 镜像标签：分支部署时用分支提交（构建的正是这份代码），否则用当前 HEAD。
# 标签即构建源码的 commit hash，部署后一眼可确认镜像内容，无需再进容器核对。
if [[ -n "$BRANCH_NAME" ]]; then
  IMAGE_TAG="$(git -C "$ORIGINAL_ROOT" rev-parse --short "origin/$BRANCH_NAME" 2>/dev/null || echo "latest")"
else
  IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"
fi

# 将 IMAGE_TAG 写回 .env，确保 docker compose 能读取到实际镜像标签
if grep -q "^IMAGE_TAG=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "$ENV_FILE"
else
  echo "IMAGE_TAG=${IMAGE_TAG}" >> "$ENV_FILE"
fi

# ── 部署锁 ──
LOCK_FILE="/tmp/zhiyu-deploy.lock"
if command -v flock >/dev/null 2>&1; then
  exec {LOCK_FD}>"$LOCK_FILE"
  flock "$LOCK_FD" || { log "等待部署锁..."; flock "$LOCK_FD"; }
  cleanup() { exec {LOCK_FD}>&- 2>/dev/null || true; }
  trap cleanup EXIT
else
  warn "flock 不可用，跳过部署锁（建议安装 util-linux）"
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

# 优先使用 vendor/ 目录（如果存在），否则用 GOPROXY 下载
if [[ -d "$BACKEND_DIR/vendor" ]]; then
  export GOPROXY="${GOPROXY:-off}"
else
  export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
fi

mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" \
  "$DEPLOY_DIR/logs" "$DEPLOY_DIR/.rollback" "$BUILD_CACHE"

# 记录当前镜像（用于回滚）
PREV_BACKEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-backend 2>/dev/null || true)"
PREV_FRONTEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-edu 2>/dev/null || true)"

# 构建前先清理旧镜像，为本次构建腾出磁盘空间（在用镜像不受影响）
prune_old_images "zhiyu-backend" 1
prune_old_images "zhiyu-edu" 1

# ════════════════════════════════════════════
# 4. 构建后端（变更自动检测）
# ════════════════════════════════════════════
# 优先加载本地 Docker 镜像，避免无法联网时 pull 失败
load_offline_images

BACKEND_HASH=$(source_hash "$BACKEND_DIR")
BUILD_BACKEND=true
[[ "$CLEAN_BUILD" != "true" ]] && [[ -f "$BUILD_CACHE/backend-hash" ]] && \
  [[ "$BACKEND_HASH" == "$(cat "$BUILD_CACHE/backend-hash")" ]] && \
  [[ -n "$(docker images -q "zhiyu-backend:$BACKEND_HASH" 2>/dev/null)" ]] && BUILD_BACKEND=false

if $BUILD_BACKEND; then
  log "构建后端"
  if [[ "$GATES_FLAG" == "true" ]]; then
    log "  质量门禁: gofmt / go vet / go test"
    if gofmt -l "$BACKEND_DIR" | grep -q .; then
      warn "gofmt 检查失败，存在未格式化文件："
      gofmt -l "$BACKEND_DIR" | head -10
      die "gofmt 检查未通过，请先运行 gofmt -w ."
    fi
    # 与下方 go build 共用 GOCACHE，避免双份编译缓存拖慢部署
    (cd "$BACKEND_DIR" && GOCACHE="$BUILD_CACHE/go-cache" go vet ./...) || die "go vet ./... 失败"
    # go test 集成测试会向数据库执行 migration/DELETE，仅允许在 TEST_DATABASE_URL
    # 指定的专用测试库上运行，避免误伤生产数据。
    TEST_DB_URL="${TEST_DATABASE_URL:-}"
    if [[ -n "$TEST_DB_URL" ]] && command -v pg_isready >/dev/null 2>&1 && pg_isready "$TEST_DB_URL" >/dev/null 2>&1; then
      (cd "$BACKEND_DIR" && TEST_DATABASE_URL="$TEST_DB_URL" go test ./...) || die "go test ./... 失败"
    else
      warn "未设置 TEST_DATABASE_URL 或测试库不可用，跳过 go test（避免对生产库执行测试 SQL）"
    fi
  else
    log "  质量门禁已跳过（GitHub Actions 已覆盖，--gates 可手动开启）"
  fi
  mkdir -p "$BUILD_CACHE/go-cache"
  if [[ -d "$BACKEND_DIR/vendor" ]]; then
    (cd "$BACKEND_DIR" && CGO_ENABLED=0 GOCACHE="$BUILD_CACHE/go-cache" \
      go build -mod=vendor -ldflags="-s -w" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go)
  else
    (cd "$BACKEND_DIR" && CGO_ENABLED=0 GOCACHE="$BUILD_CACHE/go-cache" \
      go build -ldflags="-s -w" -o "$BACKEND_DIR/bin/server" ./cmd/server/main.go)
  fi

  TMPCTX=$(mktemp -d)
  cp "$BACKEND_DIR/bin/server" "$TMPCTX/server"
  mkdir -p "$TMPCTX/migrations"
  rsync -a --delete "$BACKEND_DIR/migrations/" "$TMPCTX/migrations/"
  cp "$BACKEND_DIR/Dockerfile" "$TMPCTX/Dockerfile"

  # 本地已加载 alpine 镜像时跳过 apk add，避免离线环境联网失败
  DOCKER_BUILD_ARGS=()
  if docker images alpine:3.21 --format ok 2>/dev/null | grep -q ok; then
    DOCKER_BUILD_ARGS+=(--build-arg SKIP_APK_ADD=true)
  fi

  BUILD_LOG="$DEPLOY_DIR/.build-backend.log"
  docker build "${DOCKER_BUILD_ARGS[@]}" -t "zhiyu-backend:$IMAGE_TAG" -f "$TMPCTX/Dockerfile" "$TMPCTX" >"$BUILD_LOG" 2>&1
  tail -n 5 "$BUILD_LOG"
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
    # 先试离线安装（需要 node_modules 或 pnpm store 已就绪）
    (cd "$BUILD_ROOT" && pnpm install --offline --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
    (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || die "pnpm install 失败"
    echo "$LOCK_HASH" > "$BUILD_CACHE/lock-hash"
  fi

  if [[ "$GATES_FLAG" == "true" ]]; then
    log "  质量门禁: pnpm typecheck / pnpm lint"
    (cd "$BUILD_ROOT" && pnpm typecheck) || die "pnpm typecheck 失败"
    (cd "$BUILD_ROOT" && pnpm lint) || die "pnpm lint 失败"
  else
    log "  质量门禁已跳过（GitHub Actions 已覆盖，--gates 可手动开启）"
  fi

  [[ "$CLEAN_BUILD" == "true" ]] && rm -rf "$EDU_DIR/.next"
  (cd "$BUILD_ROOT" && NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    pnpm --filter @zhiyu/edu build) || die "前端构建失败"

  SD="$EDU_DIR/.next/standalone/apps/edu"
  [[ -d "$EDU_DIR/.next/server" ]] && { mkdir -p "$SD/.next/server"; rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/server/" "$SD/.next/server/"; }
  [[ -d "$EDU_DIR/.next/static" ]] && { mkdir -p "$SD/.next/static"; rsync -a --delete --exclude="*.map" "$EDU_DIR/.next/static/" "$SD/.next/static/"; }
  [[ -d "$EDU_DIR/public" ]] && { mkdir -p "$SD/public"; rsync -a --delete "$EDU_DIR/public/" "$SD/public/"; }

  BUILD_LOG="$DEPLOY_DIR/.build-frontend.log"
  docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR/.next/standalone" >"$BUILD_LOG" 2>&1
  tail -n 5 "$BUILD_LOG"
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

# 若显式禁用 kkFileView，停止并移除 compose 管理的容器
if [[ "${ENABLE_KKFILEVIEW:-false}" != "true" ]]; then
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx '^zhiyu-kkfileview$'; then
    log "ENABLE_KKFILEVIEW 为 false，停止 kkfileview 容器..."
    docker stop zhiyu-kkfileview >/dev/null 2>&1 || true
    docker rm zhiyu-kkfileview >/dev/null 2>&1 || true
  fi
fi

COMPOSE_UP_LOG="$DEPLOY_DIR/.compose-up.log"
rm -f "$COMPOSE_UP_LOG"
if ! compose up -d --remove-orphans >"$COMPOSE_UP_LOG" 2>&1; then
  echo "docker compose up 失败日志：" >&2
  tail -n 50 "$COMPOSE_UP_LOG" >&2 || true
  compose logs --tail 30 >&2 || true
  die "docker compose up 失败，请检查上方容器日志"
fi
tail -n 5 "$COMPOSE_UP_LOG"

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
# 备份仅保留最近 7 份，避免每次部署累积旧备份占用磁盘
ls -t "$DEPLOY_DIR"/backups/zhiyu-saas-*.sql 2>/dev/null | tail -n +8 | xargs -r rm -f

if [[ ! -f "$DEPLOY_DIR/.migration-done" ]]; then
  psql "$MIGRATE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null || true
  psql "$MIGRATE_URL" -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3
  psql "$MIGRATE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null || true
  touch "$DEPLOY_DIR/.migration-done"

  # baseline 之后补齐后续增量迁移（migrate 自动跳过 schema_migrations 已记录版本）
  run_migrations "$BACKEND_DIR" "$MIGRATE_URL" || die "数据库迁移失败"

  log "初始化种子数据..."
  (cd "$BACKEND_DIR" && DATABASE_URL="$MIGRATE_URL" SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-admin123}" go run ./cmd/seed/main.go) || warn "种子初始化失败"
  log "  运营方租户: platform / 管理员: admin / ${SEED_ADMIN_PASSWORD:-admin123}"
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
if [[ "$CLEAN_BUILD" == "true" ]]; then
  if [[ "$FORCE_FLAG" == "true" ]]; then
    docker builder prune --all --force >/dev/null 2>&1 || true
  else
    warn "--clean 未加 --force，跳过 docker builder prune --all（该操作会清空宿主全局构建缓存）"
  fi
fi

# 每次部署后的磁盘清理：构建缓存超限自动裁剪（保留近期缓存，不拖慢下次构建）
if docker builder prune --help 2>/dev/null | grep -q -- '--keep-storage'; then
  docker builder prune -f --keep-storage 10GB >/dev/null 2>&1 || true
else
  docker builder prune -f --filter until=72h >/dev/null 2>&1 || true
fi
# 清理悬空镜像（<none>），不影响在用镜像
docker image prune -f >/dev/null 2>&1 || true

# 清理过旧的镜像标签，每侧仅保留最新 1 个（当前在用）
prune_old_images "zhiyu-backend" 1
prune_old_images "zhiyu-edu" 1
prune_old_images "fangzhengjin/kkfileview" 1

# Go 编译缓存超限（默认 2GB）时整体清理，避免无限增长（下次后端构建全量重编，可接受）
GO_CACHE_DIR="$BUILD_CACHE/go-cache"
GO_CACHE_LIMIT="${GO_CACHE_LIMIT_MB:-2048}"
if [[ -d "$GO_CACHE_DIR" ]] && \
   [[ "$(du -sm "$GO_CACHE_DIR" 2>/dev/null | awk '{print $1}')" -gt "$GO_CACHE_LIMIT" ]]; then
  rm -rf "$GO_CACHE_DIR"
  log "go-cache 超过 ${GO_CACHE_LIMIT}MB，已清理（下次后端构建将全量编译）"
fi

# pnpm store 清理未被任何项目引用的孤儿包（node_modules 硬链接不受影响，离线安装能力保留）
if command -v pnpm >/dev/null 2>&1; then
  pnpm store prune >/dev/null 2>&1 || true
fi

# ════════════════════════════════════════════
# 7. Nginx + 合并
# ════════════════════════════════════════════
NGINX_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  NGINX_SERVER_NAME="${NGINX_SERVER_NAME:-_}"
  NGINX_DEFAULT_SERVER="${NGINX_DEFAULT_SERVER:-}"
  NGINX_PORT="${NGINX_PORT:-80}"
  KKFILEVIEW_HOST_PORT="${KKFILEVIEW_HOST_PORT:-8012}"
  export NGINX_SERVER_NAME NGINX_DEFAULT_SERVER NGINX_PORT BACKEND_PORT EDU_PORT KKFILEVIEW_HOST_PORT

  # 将模板中的 ${VAR:-default} → ${VAR}，再用 envsubst 替换
  if [[ -f "$NGINX_DST" ]]; then
    cp -a "$NGINX_DST" "$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
    log "已备份原 nginx 配置: $NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
    # 配置备份仅保留最近 5 份，避免累积占用磁盘
    ls -t "$NGINX_DST".bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f
  fi
  sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_CONF" | envsubst '$NGINX_SERVER_NAME $NGINX_DEFAULT_SERVER $NGINX_PORT $BACKEND_PORT $EDU_PORT $KKFILEVIEW_HOST_PORT' > "$NGINX_DST"

  # 若配置了 SSL 域名和证书，生成 HTTPS 网关配置
  NGINX_SSL_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas-ssl.conf"
  NGINX_SSL_DST="/etc/nginx/conf.d/zhiyu-saas-ssl.conf"
  if [[ -f "$NGINX_SSL_CONF" && -n "${NGINX_SSL_DOMAIN:-}" && -n "${NGINX_SSL_CERT:-}" && -n "${NGINX_SSL_CERT_KEY:-}" ]]; then
    if [[ -f "$NGINX_SSL_CERT" && -f "$NGINX_SSL_CERT_KEY" ]]; then
      export NGINX_SSL_DOMAIN NGINX_SSL_CERT NGINX_SSL_CERT_KEY
      sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_SSL_CONF" | envsubst '$NGINX_SSL_DOMAIN $NGINX_SSL_CERT $NGINX_SSL_CERT_KEY $BACKEND_PORT $EDU_PORT $KKFILEVIEW_HOST_PORT' > "$NGINX_SSL_DST"
      log "已生成 HTTPS nginx 配置: $NGINX_SSL_DST"
    else
      warn "NGINX_SSL_DOMAIN 已设置但证书文件不存在，跳过 HTTPS 配置"
      warn "  cert: $NGINX_SSL_CERT"
      warn "  key:  $NGINX_SSL_CERT_KEY"
    fi
  fi

  if ! nginx -t 2>/dev/null; then
    warn "nginx 配置测试失败，常见原因："
    warn "  1. ${NGINX_PORT} 端口已被其他进程占用"
    warn "  2. 系统中存在其他 nginx 配置语法冲突"
    warn "可手动检查：nginx -t"
    die "Nginx 配置测试失败"
  fi

  # ── Nginx 重载/启动（分层降级，兼容无 systemd 的容器/沙箱环境）──
  # 1. systemctl 可用 → 正常 reload/start
  # 2. systemctl 不可用（无 systemd / system bus 受限，如沙箱）→ 直接走信号重载，
  #    不再输出"启动失败"式告警
  # 3. 仍失败但 nginx 已在目标端口提供服务 → 降级为 warn 跳过（配置已通过 nginx -t，
  #    新配置将在下次进程重启时生效），不中断部署、不阻塞后续自动合并
  nginx_is_serving() {
    # nginx 进程存在 且（ss 可用时）端口有监听
    { pidof nginx >/dev/null 2>&1 || pgrep -x nginx >/dev/null 2>&1; } || return 1
    if command -v ss >/dev/null 2>&1; then
      ss -tln 2>/dev/null | grep -qE "[:.]${NGINX_PORT}\b" || return 1
    fi
    return 0
  }

  # systemctl 是否可用：命令存在 且 system bus 可达
  # （Permission denied / Failed to connect 时输出为空，判定为不可用）
  systemctl_usable() {
    command -v systemctl >/dev/null 2>&1 || return 1
    [[ -n "$(systemctl is-system-running 2>/dev/null)" ]]
  }

  reload_or_start_nginx() {
    if systemctl_usable; then
      if systemctl is-active nginx >/dev/null 2>&1; then
        systemctl reload nginx 2>/dev/null && { log "Nginx 重载成功"; return 0; }
        warn "systemctl 重载失败，尝试信号重载"
      else
        systemctl start nginx 2>/dev/null && { log "Nginx 启动成功"; return 0; }
        warn "systemctl 启动失败，尝试信号重载"
      fi
    else
      log "systemctl 不可用，直接使用信号方式重载 Nginx"
    fi

    if { pidof nginx >/dev/null 2>&1 || pgrep -x nginx >/dev/null 2>&1; }; then
      if nginx -s reload >/dev/null 2>&1; then
        log "Nginx 重载成功（信号方式）"
        return 0
      fi
      warn "nginx 信号重载失败"
    fi

    if nginx_is_serving; then
      warn "nginx 已在 ${NGINX_PORT} 端口提供服务，跳过重载（新配置下次进程重启时生效）"
      return 0
    fi

    if nginx >/dev/null 2>&1; then
      log "Nginx 启动成功（直接启动）"
      return 0
    fi

    warn "nginx 启动失败，常见原因："
    warn "  - ${NGINX_PORT} 端口被占用（如其他 Docker 容器映射了该端口）"
    warn "  - 可执行 ss -tlnp | grep :${NGINX_PORT} 查看占用进程"
    warn "  - 或修改 .env 中的 NGINX_PORT 使用其他端口"
    return 1
  }

  reload_or_start_nginx || die "Nginx 启动失败"
fi

if [[ -n "$BRANCH_NAME" && "$SKIP_MERGE" != "true" ]]; then
    log "合并 $BRANCH_NAME → master"
  # ORIGINAL_ROOT 可能是特性 worktree（master 一般已被主工作树检出，直接 checkout 会失败），
  # 通过 worktree list 定位真正检出 master 的工作树执行合并
  MERGE_ROOT="$ORIGINAL_ROOT"
  main_wt=$(git -C "$ORIGINAL_ROOT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{wt=$2} /^branch refs\/heads\/master$/{print wt}')
  [[ -n "$main_wt" ]] && MERGE_ROOT="$main_wt"
  if git -C "$MERGE_ROOT" checkout master 2>&1 && \
     git -C "$MERGE_ROOT" pull origin master --ff-only 2>&1 && \
     git -C "$MERGE_ROOT" merge "origin/$BRANCH_NAME" --no-edit 2>&1 && \
     git -C "$MERGE_ROOT" push origin master 2>&1; then
    log "✅ 已合并"
  else
    warn "合并跳过（可手动执行：git checkout master && git merge origin/$BRANCH_NAME && git push origin master）"
  fi
fi

log "✨ 部署完成！"
echo "   外部入口: http://<服务器IP>:${NGINX_PORT}/portal/login"
echo "   nginx 端口: ${NGINX_PORT}"
echo "   后端容器: http://localhost:${BACKEND_PORT}"
echo "   前端容器: http://localhost:${EDU_PORT}"
echo "   管理: admin / ${SEED_ADMIN_PASSWORD:-admin123}  (SaaS 登录)"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"
