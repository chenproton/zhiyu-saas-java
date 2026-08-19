#!/bin/bash
#
# install.sh - 知与 SaaS 离线实施部署（无源码交付包）
#
# 用法:
#   ./install.sh            # 全新安装（首次部署）
#   ./install.sh --update   # 升级（保留数据库与上传数据，仅应用增量迁移）
#
# 环境要求:
#   - Ubuntu 24.04 x86_64（root 权限）
#   - 本目录包含 debs/（系统依赖离线包）、images/（Docker 镜像）、bin/、migrations/
#   - 无需源代码、无需网络、无需 Go/Node 工具链
#
set -euo pipefail
# 与 deploy.sh 同源：1400 行脚本里管道/命令替换的静默失败必须能定位到行号
set -E
# shellcheck disable=SC2154  # rc/BASH_COMMAND 由 trap 运行时注入
trap 'rc=$?; [[ $rc -ne 0 ]] && echo "  错误：install.sh 第 ${LINENO} 行失败（命令: ${BASH_COMMAND}，退出码 ${rc}）" >&2' ERR

# ── 常量 ──
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="/opt/zhiyu-saas"
NGINX_DST="/etc/nginx/conf.d/zhiyu-saas.conf"
VERSION="$(cat "$PKG_DIR/VERSION" 2>/dev/null || echo latest)"
BACKEND_PORT=8080; EDU_PORT=3020; NGINX_PORT=80
POSTGRES_HOST_PORT=5433; KKFILEVIEW_HOST_PORT=8012

MODE="install"
[[ "${1:-}" == "--update" ]] && MODE="update"
[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && { grep -A8 '^#' "$0" | head -30; exit 0; }

export PATH="/usr/local/go/bin:/usr/local/bin:$PATH"

# ── 工具函数 ──
log()  { echo "==> $*"; }
warn() { echo "  警告：$*" >&2; }
die()  { echo "  错误：$*" >&2; exit 1; }
is_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]]; }

# 检查端口是否被占用（本项目自身容器发布的端口不算占用）。
# allow_nginx=true 时（仅 NGINX_PORT）自身 nginx 监听的端口也不算占用，
# 否则升级时会把 80 误判为冲突而切换到备用端口，导致入口地址漂移。
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
  die "${name} 端口 ${primary} 及备用端口 ${fallback}-$((fallback + 9)) 均已被占用，请手动释放或修改 $DEPLOY_DIR/.env"
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
  # head -c 提前关闭管道会使上游进程收到 SIGPIPE，pipefail 下会导致脚本退出，
  # 因此管道末尾加 || true（head 已取到所需字节数，上游被杀不影响结果）
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$((len * 2))" 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c "$len" || true
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$len" || true
  fi
}

detect_docker_compose() {
  docker compose version >/dev/null 2>&1 && { echo "docker compose"; return; }
  docker-compose version >/dev/null 2>&1 && { echo "docker-compose"; return; }
  echo ""
}

# ── 1. 系统依赖（离线 deb 安装）──
is_root || die "需要 root 权限（sudo ./install.sh）"

log "检查系统依赖..."
# shellcheck disable=SC2034  # 兼容旧流程保留的状态位
pkg_updated=false
install_deb() {
  local deb_dir="$PKG_DIR/debs"
  [[ -d "$deb_dir" ]] || return 0
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
  [[ ${#to_install[@]} -gt 0 ]] || return 0
  log "安装离线 deb 包（${#to_install[@]} 个）..."
  dpkg -i "${to_install[@]}" 2>/dev/null || {
    apt-get install -y -f -qq 2>/dev/null || true
    dpkg -i "${to_install[@]}" 2>/dev/null || true
  }
  log "离线 deb 包安装完成"
}
install_deb

for bin in curl rsync python3 openssl; do
  command -v "$bin" >/dev/null 2>&1 || { apt-get install -y -qq "$bin" 2>/dev/null || warn "$bin 不可用（不影响核心服务）"; }
done

# Docker
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker..."
  if ls "$PKG_DIR"/debs/docker-ce_*_amd64.deb "$PKG_DIR"/debs/containerd.io_*_amd64.deb >/dev/null 2>&1; then
    dpkg -i "$PKG_DIR"/debs/containerd.io_*_amd64.deb \
             "$PKG_DIR"/debs/docker-ce-cli_*_amd64.deb \
             "$PKG_DIR"/debs/docker-ce_*_amd64.deb \
             "$PKG_DIR"/debs/docker-buildx-plugin_*_amd64.deb \
             "$PKG_DIR"/debs/docker-compose-plugin_*_amd64.deb 2>/dev/null
    apt-get install -y -f -qq 2>/dev/null || true
  else
    die "缺少 Docker 离线 deb 包，无法离线安装 Docker"
  fi
  systemctl enable --now docker 2>/dev/null || true
fi
if ! docker info >/dev/null 2>&1; then
  systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
  sleep 2
  docker info >/dev/null 2>&1 || die "Docker 无法启动，请检查 docker 服务状态"
fi
DOCKER_COMPOSE=$(detect_docker_compose)
[[ -z "$DOCKER_COMPOSE" ]] && { apt-get install -y docker-compose-plugin 2>/dev/null || true; DOCKER_COMPOSE=$(detect_docker_compose); }
[[ -z "$DOCKER_COMPOSE" ]] && die "未找到可用的 docker compose"
compose() { $DOCKER_COMPOSE -f "$DEPLOY_DIR/docker-compose.yml" "$@"; }

# Nginx
if ! command -v nginx >/dev/null 2>&1; then
  log "安装 Nginx..."
  pkg=$(dpkg-deb -f "$PKG_DIR/debs"/nginx_*_amd64.deb Package 2>/dev/null || true)
  [[ -n "$pkg" ]] || die "缺少 Nginx 离线 deb 包"
  dpkg -i "$PKG_DIR"/debs/nginx_*_amd64.deb "$PKG_DIR"/debs/nginx-common_*_all.deb 2>/dev/null || \
    { apt-get install -y -f -qq 2>/dev/null || true; dpkg -i "$PKG_DIR"/debs/nginx_*_amd64.deb "$PKG_DIR"/debs/nginx-common_*_all.deb 2>/dev/null || die "Nginx 安装失败"; }
fi
systemctl unmask nginx 2>/dev/null || true
systemctl enable --now nginx 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/zhiyu-saas /etc/nginx/sites-available/zhiyu-saas

# ── 2. 加载 Docker 镜像 ──
log "加载 Docker 镜像..."
for tar in "$PKG_DIR"/images/*.tar; do
  [[ -f "$tar" ]] || continue
  log "  加载: $(basename "$tar")"
  docker load -i "$tar" 2>&1 | tail -1 || true
done

# ── 3. .env 配置（首次生成，后续复用）──
mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups"
ENV_FILE="$DEPLOY_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  db_pass=$(rand_str 24)
  jwt_secret=$(rand_str 64)
  ai_secret=$(rand_str 64)
  {
    echo "DATABASE_URL=postgresql://zhiyu_saas:${db_pass}@127.0.0.1:${POSTGRES_HOST_PORT}/zhiyu-saas?sslmode=disable"
    echo "JWT_SECRET=${jwt_secret}"
    # AI_CONFIG_SECRET 必须生成：后端用它解密租户 AI 配置，缺失会导致启动/AI 功能直接失败
    echo "AI_CONFIG_SECRET=${ai_secret}"
    echo "DB_USER=zhiyu_saas"
    echo "DB_PASSWORD=${db_pass}"
    echo "DB_NAME=zhiyu-saas"
    echo "IMAGE_TAG=${VERSION}"
    echo "NGINX_SERVER_NAME=_"
    echo "NGINX_DEFAULT_SERVER=default_server"
    echo "NGINX_PORT=80"
    # 容器网关端口：nginx 模板里 /api、/uploads 等 location 都指向它
    echo "GO_NGINX_PORT=8084"
    echo "NGINX_SSL_DOMAIN="
    echo "NGINX_SSL_CERT="
    echo "NGINX_SSL_CERT_KEY="
    echo "BACKEND_PORT=8080"
    echo "EDU_PORT=3020"
    echo "POSTGRES_HOST_PORT=5433"
    echo "KKFILEVIEW_HOST_PORT=8012"
    echo "ENABLE_KKFILEVIEW=true"
    echo "KKFILEVIEW_IMAGE=fangzhengjin/kkfileview:4.4.0"
    echo "KK_BASE_URL="
    echo "SEED_ADMIN_PASSWORD=admin123"
    echo "PORT=8080"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "已生成 .env（权限 600；管理员账号 admin，密码见其中 SEED_ADMIN_PASSWORD）"
else
  log "复用已有 .env"
  update_env_var "$ENV_FILE" "IMAGE_TAG" "$VERSION"
  if ! grep -q "^ENABLE_KKFILEVIEW=" "$ENV_FILE" 2>/dev/null; then
    update_env_var "$ENV_FILE" "ENABLE_KKFILEVIEW" "true"
  fi
fi
set -a; source "$ENV_FILE"; set +a

# 根据 .env 启用 docker compose profile
if [[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]]; then
  export COMPOSE_PROFILES="kkfileview"
else
  unset COMPOSE_PROFILES 2>/dev/null || true
fi

# 端口冲突检测与自动回退（每次安装执行，写入 .env）
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

# kkFileView 对外地址自动推导
if [[ -z "${KK_BASE_URL:-}" ]]; then
  kk_scheme="http"
  [[ -n "${NGINX_SSL_DOMAIN:-}" || "${NGINX_PORT:-80}" == "443" ]] && kk_scheme="https"
  kk_host="${NGINX_SERVER_NAME:-_}"
  [[ "$kk_host" == "_" ]] && kk_host="localhost"
  KK_BASE_URL="${kk_scheme}://${kk_host}/kkfileview"
fi
update_env_var "$ENV_FILE" "KK_BASE_URL" "$KK_BASE_URL"

# DATABASE_URL 中的 host 端口与 POSTGRES_HOST_PORT 保持一致
if [[ "$DATABASE_URL" != *":${POSTGRES_HOST_PORT}/zhiyu-saas"* ]]; then
  DATABASE_URL=$(echo "$DATABASE_URL" | sed -E "s|@127\.0\.0\.1:[0-9]+/|@127.0.0.1:${POSTGRES_HOST_PORT}/|")
  update_env_var "$ENV_FILE" "DATABASE_URL" "$DATABASE_URL"
fi
set -a; source "$ENV_FILE"; set +a

DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")
DB_PASSWORD="${DB_PASSWORD:-}"
MIGRATE_URL="postgres://${DB_USER}:$(url_encode "$DB_PASSWORD")@127.0.0.1:${POSTGRES_HOST_PORT}/${DB_NAME}?sslmode=disable"
# psql 统一包装：口令走 PGPASSWORD，不进 argv（同机任意用户 ps 可见）
psql_db() { PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${POSTGRES_HOST_PORT}" -U "$DB_USER" -d "$DB_NAME" "$@"; }
export IMAGE_TAG BACKEND_PORT EDU_PORT POSTGRES_HOST_PORT KKFILEVIEW_HOST_PORT NGINX_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET

# ── 4. Docker 部署 ──
log "部署服务（${MODE}）..."
cp "$PKG_DIR/deploy/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
# 容器网关配置必须落到 compose 同级目录：compose 的 nginx 服务挂载 ./nginx-container/conf.d，
# 缺失时容器启动即失败（表现为「安装成功但站点打不开」）
if [[ -d "$PKG_DIR/deploy/nginx-container" ]]; then
  rm -rf "$DEPLOY_DIR/nginx-container"
  cp -r "$PKG_DIR/deploy/nginx-container" "$DEPLOY_DIR/nginx-container"
else
  die "交付包缺少 deploy/nginx-container（服务网关配置），无法部署：请用新版 package-release.sh 重新打包"
fi
chmod 600 "$DEPLOY_DIR/.env"

# 若显式禁用 kkFileView，移除其容器
if [[ "${ENABLE_KKFILEVIEW:-false}" != "true" ]]; then
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx '^zhiyu-kkfileview$' && { docker stop zhiyu-kkfileview >/dev/null 2>&1 || true; docker rm zhiyu-kkfileview >/dev/null 2>&1 || true; }
fi

compose up -d --remove-orphans 2>&1 | tail -5 || { compose logs --tail 30 >&2 || true; die "docker compose up 失败，请查看上方日志"; }

# 等待 PG 就绪
for _ in $(seq 1 30); do
  compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done
for _ in $(seq 1 15); do psql_db -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

# 迁移前备份（仅数据库已存在时有效，失败仅警告）
BACKUP_FILE="$DEPLOY_DIR/backups/zhiyu-saas-$(date +%Y%m%d-%H%M%S).sql"
# 全库明文 dump：目录 700 + 文件 600（默认 755/644 不可接受）
chmod 700 "$DEPLOY_DIR/backups" 2>/dev/null || true
( umask 077; compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null ) \
  || { warn "数据库备份失败（首次安装可忽略），已跳过"; rm -f "$BACKUP_FILE"; }
# 不能用 `ls glob | tail`：无匹配时 ls 退出 2 + pipefail 会让安装静默中止（首次安装 backups 为空必现）
find "$DEPLOY_DIR/backups" -maxdepth 1 -name 'zhiyu-saas-*.sql' -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f || true

# ── 5. 数据库迁移 + 种子数据（包内静态二进制，无需 Go/源码）──
log "数据库迁移..."
(cd "$PKG_DIR" && DATABASE_URL="$MIGRATE_URL" JWT_SECRET="$JWT_SECRET" ./bin/migrate up) \
  || die "数据库迁移失败，备份位于 $DEPLOY_DIR/backups/"

log "初始化种子数据..."
(cd "$PKG_DIR" && DATABASE_URL="$MIGRATE_URL" JWT_SECRET="$JWT_SECRET" \
  SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-admin123}" ./bin/seed) || warn "种子初始化失败"
log "  运营方租户: platform / 管理员: admin（密码见 $ENV_FILE 的 SEED_ADMIN_PASSWORD）"

# ── 6. Nginx 网关 ──
NGINX_CONF="$PKG_DIR/deploy/nginx/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  # 容器网关端口：模板中 /api、/uploads 等 location 均指向它，必须有值并进 envsubst 白名单
  GO_NGINX_PORT="${GO_NGINX_PORT:-8084}"; export GO_NGINX_PORT
  command -v envsubst >/dev/null 2>&1 || \
    { dpkg -i "$PKG_DIR"/debs/gettext-base_*_amd64.deb >/dev/null 2>&1 || true; }
  command -v envsubst >/dev/null 2>&1 || \
    die "缺少 envsubst（gettext-base 包），请安装 gettext-base 后重试"
  log "配置 Nginx..."
  NGINX_SERVER_NAME="${NGINX_SERVER_NAME:-_}"
  NGINX_DEFAULT_SERVER="${NGINX_DEFAULT_SERVER:-}"
  export NGINX_SERVER_NAME NGINX_DEFAULT_SERVER NGINX_PORT BACKEND_PORT EDU_PORT KKFILEVIEW_HOST_PORT
  # 原子写 + cmp 去重 + 失败复位（与 deploy.sh 同源）：直接重定向到生产配置时，
  # 管道任一环失败会留下截断的配置，下次 reload 即整站 502
  NGINX_BAK=""
  NGINX_TMP="${NGINX_DST}.new.$$"
  sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_CONF" \
    | envsubst '$NGINX_SERVER_NAME $NGINX_DEFAULT_SERVER $NGINX_PORT $GO_NGINX_PORT $BACKEND_PORT $EDU_PORT $KKFILEVIEW_HOST_PORT' \
    > "$NGINX_TMP" || { rm -f "$NGINX_TMP"; die "生成 nginx 配置失败（原配置未改动）"; }
  [[ -s "$NGINX_TMP" ]] || { rm -f "$NGINX_TMP"; die "生成的 nginx 配置为空（原配置未改动）"; }
  if [[ -f "$NGINX_DST" ]] && cmp -s "$NGINX_TMP" "$NGINX_DST"; then
    rm -f "$NGINX_TMP"; log "  nginx 配置无变化，跳过写入"
  else
    if [[ -f "$NGINX_DST" ]]; then
      NGINX_BAK="$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)"
      cp -a "$NGINX_DST" "$NGINX_BAK"
      find "$(dirname "$NGINX_DST")" -maxdepth 1 -name "$(basename "$NGINX_DST").bak.*" -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | tail -n +6 | cut -d' ' -f2- | xargs -r rm -f || true
    fi
    mv -f "$NGINX_TMP" "$NGINX_DST"
  fi

  if [[ -f "$PKG_DIR/deploy/nginx/conf.d/zhiyu-saas-ssl.conf" && -n "${NGINX_SSL_DOMAIN:-}" && -n "${NGINX_SSL_CERT:-}" && -n "${NGINX_SSL_CERT_KEY:-}" ]]; then
    if [[ -f "$NGINX_SSL_CERT" && -f "$NGINX_SSL_CERT_KEY" ]]; then
      export NGINX_SSL_DOMAIN NGINX_SSL_CERT NGINX_SSL_CERT_KEY
      sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$PKG_DIR/deploy/nginx/conf.d/zhiyu-saas-ssl.conf" | \
        envsubst '$NGINX_SSL_DOMAIN $NGINX_SSL_CERT $NGINX_SSL_CERT_KEY $GO_NGINX_PORT $BACKEND_PORT $EDU_PORT $KKFILEVIEW_HOST_PORT' > /etc/nginx/conf.d/zhiyu-saas-ssl.conf
    else
      warn "NGINX_SSL_DOMAIN 已设置但证书文件不存在，跳过 HTTPS 配置"
    fi
  fi

  nginx -t 2>/dev/null || die "Nginx 配置测试失败，请检查 $NGINX_DST"

  if { pidof nginx >/dev/null 2>&1 || pgrep -x nginx >/dev/null 2>&1; }; then
    systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
  else
    systemctl start nginx 2>/dev/null || nginx 2>/dev/null || warn "Nginx 启动失败，请检查端口占用（ss -tlnp | grep :${NGINX_PORT}）"
  fi
fi

# ── 7. 健康检查 ──
log "等待服务就绪..."
OK=true
for svc in backend frontend nginx; do
  found=false
  for _ in $(seq 1 45); do
    S=$(compose ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "")
    [[ "$S" == "healthy" ]] && { log "  $svc healthy"; found=true; break; }
    STATUS=$(compose ps "$svc" --format '{{.Status}}' 2>/dev/null || echo "")
    # 兜底仅适用于确实没有 healthcheck 的服务（与 deploy.sh 同源判断）
    if [[ -z "$S" && "$STATUS" == Up* && "$STATUS" != *health* ]]; then
      log "  $svc running（无 healthcheck，视为就绪）"; found=true; break
    fi
    sleep 2
  done
  $found || { warn "$svc 未就绪（$(compose ps "$svc" --format '{{.Status}}' 2>/dev/null)）"; OK=false; }
done
if [[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]]; then
  for _ in $(seq 1 60); do
    wget -qO- "http://127.0.0.1:${KKFILEVIEW_HOST_PORT}/kkfileview/onlinePreview" >/dev/null 2>&1 && { log "  kkfileview ready"; break; }
    sleep 2
  done
fi

compose ps
if ! $OK; then
  compose logs backend --tail 30 || true
  die "服务未全部就绪，请查看上方日志"
fi

echo ""
log "✨ 部署完成！"
echo "   版本:        ${VERSION}"
echo "   外部入口:    http://<服务器IP>:${NGINX_PORT}/portal/login"
echo "   后端:        http://localhost:${BACKEND_PORT}"
echo "   前端:        http://localhost:${EDU_PORT}"
echo "   管理:        admin / ${SEED_ADMIN_PASSWORD:-admin123}"
echo "   数据目录:    ${DEPLOY_DIR}（.env 中可修改端口与密码）"
echo "   日志查看:    docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs -f backend"
