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
#   - 本目录包含 debs/（系统依赖离线包）、images/（Docker 镜像）、deploy/migrations/、web/（前端 dist）
#   - 无需源代码、无需网络、无需 Go/Node/JDK 工具链
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
JAVA_NGINX_PORT=8083; NGINX_PORT=80
MYSQL_HOST_PORT=3306; KKFILEVIEW_HOST_PORT=8012

MODE="install"
[[ "${1:-}" == "--update" ]] && MODE="update"
[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && { grep -A8 '^#' "$0" | head -30; exit 0; }

export PATH="/usr/local/bin:$PATH"

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
  redis_pass=$(rand_str 24)
  {
    echo "DATABASE_URL=mysql://zhiyu_saas:${db_pass}@127.0.0.1:${MYSQL_HOST_PORT}/zhiyu-saas?useUnicode=true&characterEncoding=utf8"
    echo "JWT_SECRET=${jwt_secret}"
    echo "REDIS_PASSWORD=${redis_pass}"
    echo "DB_USER=zhiyu_saas"
    echo "DB_PASSWORD=${db_pass}"
    echo "DB_NAME=zhiyu-saas"
    echo "IMAGE_TAG=${VERSION}"
    echo "NGINX_SERVER_NAME=_"
    echo "NGINX_DEFAULT_SERVER=default_server"
    echo "NGINX_PORT=80"
    # 容器网关端口：nginx 模板里 /api、/uploads 等 location 都指向它
    echo "JAVA_NGINX_PORT=8083"
    echo "NGINX_SSL_DOMAIN="
    echo "NGINX_SSL_CERT="
    echo "NGINX_SSL_CERT_KEY="
    echo "MYSQL_HOST_PORT=3306"
    echo "KKFILEVIEW_HOST_PORT=8012"
    echo "ENABLE_KKFILEVIEW=true"
    echo "KKFILEVIEW_IMAGE=fangzhengjin/kkfileview:4.4.0"
    echo "KK_BASE_URL="
    # 与 deploy.sh 生成的 .env 对齐，避免客户现场缺键（多数有 compose 默认值，但缺了就无法通过 .env 调整）
    echo "KK_MEDIA_CONVERT_DISABLE=true"   # true 才允许远程 mov/avi/mkv 走 ffmpeg 转码预览
    echo "VITE_SITE_URL="                  # 移动端访问二维码站点地址（构建期注入，改后需重新打包）
    echo "DOCKER_REGISTRY_MIRRORS="
    echo "BUILD_CACHE_LIMIT_GB=10"
    echo "SEED_ADMIN_PASSWORD=admin123"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "已生成 .env（权限 600；管理员账号 admin，密码见其中 SEED_ADMIN_PASSWORD）"
else
  log "复用已有 .env"
  update_env_var "$ENV_FILE" "IMAGE_TAG" "$VERSION"
  if ! grep -q "^ENABLE_KKFILEVIEW=" "$ENV_FILE" 2>/dev/null; then
    update_env_var "$ENV_FILE" "ENABLE_KKFILEVIEW" "true"
  fi
  if ! grep -q "^REDIS_PASSWORD=" "$ENV_FILE" 2>/dev/null || [[ -z "$(grep '^REDIS_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)" ]]; then
    update_env_var "$ENV_FILE" "REDIS_PASSWORD" "$(rand_str 24)"
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
JAVA_NGINX_PORT=$(resolve_port "JAVA_NGINX_PORT" "${JAVA_NGINX_PORT:-8083}" "8084")
MYSQL_HOST_PORT=$(resolve_port "MYSQL_HOST_PORT" "${MYSQL_HOST_PORT:-3306}" "3307")
KKFILEVIEW_HOST_PORT=$(resolve_port "KKFILEVIEW_HOST_PORT" "${KKFILEVIEW_HOST_PORT:-8012}" "8013")
update_env_var "$ENV_FILE" "NGINX_PORT" "$NGINX_PORT"
update_env_var "$ENV_FILE" "JAVA_NGINX_PORT" "$JAVA_NGINX_PORT"
update_env_var "$ENV_FILE" "MYSQL_HOST_PORT" "$MYSQL_HOST_PORT"
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

# DATABASE_URL 中的 host 端口与 MYSQL_HOST_PORT 保持一致
if [[ "$DATABASE_URL" != *":${MYSQL_HOST_PORT}/zhiyu-saas"* ]]; then
  DATABASE_URL=$(echo "$DATABASE_URL" | sed -E "s|@127\.0\.0\.1:[0-9]+/|@127.0.0.1:${MYSQL_HOST_PORT}/|")
  update_env_var "$ENV_FILE" "DATABASE_URL" "$DATABASE_URL"
fi
set -a; source "$ENV_FILE"; set +a

DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")
DB_PASSWORD="${DB_PASSWORD:-}"
# MySQL 统一包装：口令走 MYSQL_PWD，不进 argv（同机任意用户 ps 可见）
mysql_db() { MYSQL_PWD="$DB_PASSWORD" mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P "${MYSQL_HOST_PORT}" -u "$DB_USER" "$DB_NAME" "$@"; }
psql_db() { mysql_db "$@"; }
export IMAGE_TAG JAVA_NGINX_PORT MYSQL_HOST_PORT KKFILEVIEW_HOST_PORT NGINX_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET REDIS_PASSWORD

# ── 4. Docker 部署 ──
log "部署服务（${MODE}）..."
cp "$PKG_DIR/deploy/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
# 前端 dist（nginx 容器 bind mount $DEPLOY_DIR/web/）：portal 业务门户 + plus-ui 管理端。
# 升级场景禁止 rm -rf 重建目录（会破坏运行中 nginx 的挂载，见 deploy.sh 同款注释），用 rsync 增量同步
if [[ -d "$PKG_DIR/web/portal" && -d "$PKG_DIR/web/plus-ui" ]]; then
  mkdir -p "$DEPLOY_DIR/web/portal" "$DEPLOY_DIR/web/plus-ui"
  rsync -a --delete "$PKG_DIR/web/portal/" "$DEPLOY_DIR/web/portal/"
  rsync -a --delete "$PKG_DIR/web/plus-ui/" "$DEPLOY_DIR/web/plus-ui/"
else
  die "交付包缺少 web/（前端 dist），无法部署：请用新版 package-release.sh 重新打包"
fi
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

# 分两段启动（与 deploy.sh 同源）：先起数据层 → 备份 + 迁移 → 再起业务容器。
# 单段全量 up（尤其 --update 升级场景）会让新版本 backend 先在旧 schema 上对外服务。
compose up -d mysql redis 2>&1 | tail -3 \
  || { compose logs --tail 30 >&2 || true; die "数据层容器启动失败，请查看上方日志"; }

# 等待 PG 就绪
for _ in $(seq 1 30); do
  compose exec -T mysql mysqladmin ping -h 127.0.0.1 -u"$DB_USER" -p"$DB_PASSWORD" --silent >/dev/null 2>&1 && break
  sleep 2
done
for _ in $(seq 1 15); do mysql_db -e "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

# 迁移前备份（仅数据库已存在时有效，失败仅警告）
BACKUP_FILE="$DEPLOY_DIR/backups/zhiyu-saas-$(date +%Y%m%d-%H%M%S).sql"
# 全库明文 dump：目录 700 + 文件 600（默认 755/644 不可接受）
chmod 700 "$DEPLOY_DIR/backups" 2>/dev/null || true
( umask 077; compose exec -T mysql mysqldump --default-character-set=utf8mb4 --single-transaction -u"$DB_USER" -p"$DB_PASSWORD" > "$BACKUP_FILE" 2>/dev/null ) \
  || { warn "数据库备份失败（首次安装可忽略），已跳过"; rm -f "$BACKUP_FILE"; }
# 不能用 `ls glob | tail`：无匹配时 ls 退出 2 + pipefail 会让安装静默中止（首次安装 backups 为空必现）
find "$DEPLOY_DIR/backups" -maxdepth 1 -name 'zhiyu-saas-*.sql' -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f || true

# ── 5. 数据库迁移 + 框架表初始化（纯 psql，无需 Go 工具）──
log "数据库迁移..."
mysql_db -e "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);" 2>/dev/null || true
MIG_DIR="$PKG_DIR/deploy/migrations"
if [[ -d "$MIG_DIR" && -f "$MIG_DIR/001_baseline.up.sql" ]]; then
  BASE_RECORDED=$(mysql_db -N -e "SELECT 1 FROM schema_migrations WHERE version='001_baseline'" 2>/dev/null | tr -d ' ')
  BASE_TABLE=$(mysql_db -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='tenants'" 2>/dev/null | tr -d ' ')
  if [[ "$BASE_RECORDED" != "1" && "$BASE_TABLE" != "t" ]]; then
    log "  空库，执行 001_baseline（单事务 + ON_ERROR_STOP）..."
    mysql_db < "$MIG_DIR/001_baseline.up.sql" 2>&1 | tail -3 \
      || die "baseline 迁移失败（事务已回滚，备份位于 $DEPLOY_DIR/backups/）"
    mysql_db -e "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON DUPLICATE KEY UPDATE version = version;" >/dev/null || true
  else
    log "  baseline 已存在，跳过"
  fi
fi
# 增量迁移（逐个执行未应用版本；MySQL DDL 隐式提交，mysql client 遇错即停）
APPLIED=$(mysql_db -N -e "SELECT version FROM schema_migrations;" 2>/dev/null || true)
FAILED_MIG=false
for f in "$MIG_DIR"/*.up.sql; do
  [[ -f "$f" ]] || continue
  v=$(basename "$f" .up.sql)
  echo "$APPLIED" | grep -qx "$v" && continue
  log "  执行迁移: $(basename "$f")"
  if ! mysql_db < "$f" 2>&1 | tail -5; then
    FAILED_MIG=true
    warn "迁移失败: $(basename "$f")（停止后续迁移）"
    break
  fi
  mysql_db -e "INSERT INTO schema_migrations (version) VALUES ('$v') ON DUPLICATE KEY UPDATE version = version;" >/dev/null || true
done
$FAILED_MIG && die "数据库迁移失败，备份位于 $DEPLOY_DIR/backups/"

# RuoYi 框架表初始化（幂等）：java-backend 启动依赖 sys_* 表
log "初始化 RuoYi 框架表..."
for pair in "mysql_ry_vue:sys_social" "mysql_ry_job:sj_namespace" \
            "mysql_ry_workflow:flow_definition" "mysql_ry_ai:sai_user"; do
  f="${pair%%:*}" probe="${pair##*:}"
  if mysql_db -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$probe'" 2>/dev/null | grep -q "$probe"; then
    continue
  fi
  [[ -f "$PKG_DIR/deploy/$f.sql" ]] || { warn "缺少 $f.sql，跳过"; continue; }
  mysql_db < "$PKG_DIR/deploy/$f.sql" 2>&1 | tail -3 \
    || warn "初始化 $f.sql 失败（事务已回滚）"
done
# 种子数据（platform 租户 + admin 用户）由 java-backend 启动时 SeedRunner 执行，
# SEED_ADMIN_PASSWORD 经 compose 环境注入容器，密码不回显
log "  运营方租户: platform / 管理员: admin（密码见 $ENV_FILE 的 SEED_ADMIN_PASSWORD）"

# 第二段：schema 就绪后再拉起业务容器
log "启动业务容器..."
compose up -d --remove-orphans 2>&1 | tail -5 \
  || { compose logs --tail 30 >&2 || true; die "业务容器启动失败，请查看上方日志"; }

# ── 6. Nginx 网关 ──
NGINX_CONF="$PKG_DIR/deploy/nginx/conf.d/zhiyu-saas.conf"
if [[ -f "$NGINX_CONF" ]]; then
  # 容器网关端口：模板中 /api、/uploads 等 location 均指向它，必须有值并进 envsubst 白名单
  JAVA_NGINX_PORT="${JAVA_NGINX_PORT:-8083}"; export JAVA_NGINX_PORT
  command -v envsubst >/dev/null 2>&1 || \
    { dpkg -i "$PKG_DIR"/debs/gettext-base_*_amd64.deb >/dev/null 2>&1 || true; }
  command -v envsubst >/dev/null 2>&1 || \
    die "缺少 envsubst（gettext-base 包），请安装 gettext-base 后重试"
  log "配置 Nginx..."
  NGINX_SERVER_NAME="${NGINX_SERVER_NAME:-_}"
  NGINX_DEFAULT_SERVER="${NGINX_DEFAULT_SERVER:-}"
  export NGINX_SERVER_NAME NGINX_DEFAULT_SERVER NGINX_PORT JAVA_NGINX_PORT KKFILEVIEW_HOST_PORT
  # 原子写 + cmp 去重 + 失败复位（与 deploy.sh 同源）：直接重定向到生产配置时，
  # 管道任一环失败会留下截断的配置，下次 reload 即整站 502
  NGINX_BAK=""
  NGINX_TMP="${NGINX_DST}.new.$$"
  sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_CONF" \
    | envsubst '$NGINX_SERVER_NAME $NGINX_DEFAULT_SERVER $NGINX_PORT $JAVA_NGINX_PORT $KKFILEVIEW_HOST_PORT' \
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
        envsubst '$NGINX_SSL_DOMAIN $NGINX_SSL_CERT $NGINX_SSL_CERT_KEY $JAVA_NGINX_PORT $KKFILEVIEW_HOST_PORT' > /etc/nginx/conf.d/zhiyu-saas-ssl.conf
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
# nginx 前端挂载自愈（与 deploy.sh 同款）：升级场景若 web 产物曾 rm -rf 重建导致挂载失效，
# 自动重启 nginx 刷新挂载，避免 try_files 循环 500
log "检查 nginx 前端挂载有效性..."
NGINX_MOUNT_OK=false
for _ in 1 2 3; do
  if docker exec zhiyu-nginx sh -c '[ -f /usr/share/nginx/html/portal/index.html ]' 2>/dev/null; then
    NGINX_MOUNT_OK=true
    break
  fi
  log "  nginx 挂载异常（portal/index.html 不可见），自动重启 zhiyu-nginx 刷新挂载..."
  docker restart zhiyu-nginx >/dev/null 2>&1 || true
  sleep 5
done
[[ "$NGINX_MOUNT_OK" == "true" ]] || warn "  nginx 挂载自愈未成功（web/portal 产物缺失？），继续按健康检查结果判定"

log "等待服务就绪..."
OK=true
for svc in java-backend nginx; do
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

# 业务容器重建后 IP 变化，网关需重启刷新上游解析，否则 502
docker restart zhiyu-nginx >/dev/null 2>&1 || warn "重启 zhiyu-nginx 失败（忽略）"
sleep 3

# 部署后业务冒烟（与 deploy.sh 同源 5 探针，均无需账号口令）
smoke_ok=true
smoke_check() {
  local path="$1" want="$2" desc="$3" code
  code=$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' "http://127.0.0.1:${NGINX_PORT:-80}$path" || echo 000)
  if [[ "$code" == "$want" ]]; then log "    ✓ $desc（$path → $code）"
  else warn "    ✗ $desc（$path 期望 $want，实际 $code）"; smoke_ok=false; fi
}
log "业务冒烟..."
smoke_check "/portal/login"          200 "前端 SPA 产物"
smoke_check "/plus-ui/"              200 "RuoYi 管理端产物"
smoke_check "/health"                200 "后端存活"
smoke_check "/api/v1/auth/captcha"   200 "API + Redis"
smoke_check "/api/v1/settings/theme" 200 "API + DB 读"
smoke_check "/api/v1/tenants"        401 "鉴权中间件生效"
$smoke_ok || warn "业务冒烟未全通过：容器 healthy 不等于站点可用，请按上方探针排查"

compose ps
if ! $OK; then
  compose logs java-backend --tail 30 || true
  die "服务未全部就绪，请查看上方日志"
fi

echo ""
log "✨ 部署完成！"
echo "   版本:        ${VERSION}"
echo "   外部入口:    http://<服务器IP>:${NGINX_PORT}/portal/login"
echo "   RuoYi 管理端: http://<服务器IP>:${NGINX_PORT}/plus-ui/"
echo "   管理:        admin / ${SEED_ADMIN_PASSWORD:-admin123}"
echo "   数据目录:    ${DEPLOY_DIR}（.env 中可修改端口与密码）"
echo "   日志查看:    docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs -f java-backend"
