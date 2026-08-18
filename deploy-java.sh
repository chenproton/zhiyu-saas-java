#!/usr/bin/env bash
# =============================================================================
# zhiyu-saas Java 版部署脚本（Go→Java 迁移，基于 saas-framework6-java-vue）
#
# 部署形态（Docker，与 Go 版对齐）：
#   - java-backend 容器：ruoyi-admin.jar（Spring Boot 4 prod，容器内 8080）
#   - java-nginx 容器：统一入口（宿主端口 8083 → 容器 80），静态服务 Vue 门户（frontend/portal-vue）
#   - PG/Redis 复用宿主机现有实例（host.docker.internal，零干扰线上 Go 版）
#
# 用法：
#   ./deploy.sh                 # 全量构建 + 部署
#   ./deploy.sh --skip-build    # 跳过构建，直接镜像部署/重启
#   ./deploy.sh --down          # 停止并移除 Java 版容器
#
# 环境变量（可选）：ZHIYU_DB_PASSWORD（默认从 zhiyu-saas/.env 自动解析）、
#                  ZHIYU_JAVA_WEB_PORT（入口端口，默认 8083）
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="$REPO_DIR/deploy/docker"
LOG_DIR="$REPO_DIR/logs"
# .env 与代码同目录（不再硬编码 /root/projects/...，支持任意路径部署/全新服务器）
ZHIYU_ENV_FILE="${ZHIYU_ENV_FILE:-$REPO_DIR/.env}"
WEB_PORT="${ZHIYU_JAVA_WEB_PORT:-8083}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MODE="${1:-}"

mkdir -p "$LOG_DIR"
log() { echo "[deploy] $(date '+%H:%M:%S') $*"; }

# ---------- 0. 解析 PG 密码（从 zhiyu-saas/.env 的 DATABASE_URL 解码，不回显） ----------
resolve_db_password() {
  if [[ -n "${ZHIYU_DB_PASSWORD:-}" ]]; then
    return 0
  fi
  if [[ -f "$ZHIYU_ENV_FILE" ]]; then
    local url raw decoded
    url=$(grep -E '^DATABASE_URL=' "$ZHIYU_ENV_FILE" | head -1 | cut -d= -f2-)
    if [[ -n "$url" ]]; then
      raw=$(echo "$url" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
      decoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.unquote(sys.argv[1]))" "$raw")
      export ZHIYU_DB_PASSWORD="$decoded"
      log "PG 密码已从 zhiyu-saas/.env 解析（长度 ${#decoded}，不回显）"
      return 0
    fi
  fi
  log "警告：无法解析 PG 密码，容器可能启动失败"
  export ZHIYU_DB_PASSWORD="change-me"
}

# ---------- 1. 构建（宿主机构建 jar 与前端 standalone，再打进镜像） ----------
build() {
  if [[ "$MODE" == "--skip-build" ]]; then
    log "跳过构建（--skip-build）"
    return 0
  fi

  cd "$REPO_DIR/backend/java"
  log "构建后端 jar（prod profile）..."
  ./mvnw clean package -P prod -DskipTests -q
  log "后端 jar 构建完成"

  cd "$REPO_DIR/frontend/portal-vue"
  log "构建 Vue 业务门户（production，basePath=/java/portal/）..."
  # 局域网/离线部署：offline/node_modules.tar.gz 命中则解压 portal-vue 依赖，跳过联网 pnpm install
  local offline_tar="$REPO_DIR/offline/node_modules.tar.gz"
  if [[ -f "$offline_tar" ]] && [[ ! -d node_modules ]]; then
    log "  离线依赖包命中，解压 portal-vue node_modules..."
    tar -xzf "$offline_tar" -C "$REPO_DIR" frontend/portal-vue/node_modules 2>/dev/null \
      || tar -xzf "$offline_tar" -C "$REPO_DIR" 2>/dev/null || true
  fi
  pnpm install --offline --silent > "$LOG_DIR/portal-vue-install.log" 2>&1 || \
    pnpm install --silent > "$LOG_DIR/portal-vue-install.log" 2>&1 || true
  pnpm build > "$LOG_DIR/portal-vue-build.log" 2>&1
  log "Vue 门户构建完成"

  log "构建 Docker 镜像（backend）..."
  rm -rf "$DOCKER_DIR/build-context/backend"
  mkdir -p "$DOCKER_DIR/build-context/backend"
  cp "$REPO_DIR/backend/java/ruoyi-admin/target/ruoyi-admin.jar" "$DOCKER_DIR/build-context/backend/ruoyi-admin.jar"
  # JDK 21 从宿主机拷贝（离线构建；-L 跟随 conf 等符号链接）
  rsync -aL --exclude='lib/src.zip' --exclude='demo' --exclude='sample' \
    /usr/lib/jvm/java-21-openjdk-amd64/ "$DOCKER_DIR/build-context/backend/jdk/"

  docker build -t zhiyu-java-backend:$IMAGE_TAG \
    -f "$DOCKER_DIR/java-backend.Dockerfile" "$DOCKER_DIR/build-context/backend"
  log "镜像构建完成"
}

# ---------- 2. 停止旧裸进程与旧容器 ----------
stop_old() {
  # 停旧的裸进程部署（历史版本：java -jar 8081 / next 3021）；无可停进程时也应返回 0，避免 set -e 误中断
  local pid
  pid=$(ss -tlnp 2>/dev/null | grep ':8081' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && log "已停旧后端进程 $pid" || true
  pid=$(ss -tlnp 2>/dev/null | grep ':3021' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && log "已停旧前端进程 $pid" || true
  return 0
}

# ---------- 3. Docker Compose 部署 ----------
compose_up() {
  cd "$DOCKER_DIR"
  # 先移除旧容器（镜像更新时强制重建），再拉起。
  # 注意必须包含 java-redis：全新服务器上若不显式拉起，java-backend 启动时
  # DNS 解析 java-redis 失败 → UnknownHostException 崩溃循环（本机因历史遗留已运行未暴露）。
  docker compose -f docker-compose-java.yml up -d --remove-orphans \
    --force-recreate java-redis java-backend java-nginx
  log "容器已启动（java-redis / java-backend / java-nginx）"
}

compose_down() {
  cd "$DOCKER_DIR"
  docker compose -f docker-compose-java.yml down
  log "Java 版容器已停止移除"
}

# ---------- 4. 健康检查与冒烟 ----------
health_check() {
  log "等待后端就绪..."
  local code=000
  for i in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/api/v1/auth/me" || true)
    [[ "$code" == "401" || "$code" == "200" ]] && break
    sleep 3
  done
  log "后端（经入口）HTTP $code（401=已鉴权拦截，服务正常）"

  log "等待前端就绪..."
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/java/portal/" || true)
    [[ "$code" == "200" ]] && break
    sleep 3
  done
  log "前端 /java/portal/ HTTP $code"

  # 登录冒烟（zhiyu admin 账号，密码从 zhiyu-saas/.env 解析）
  local seed_pw login
  seed_pw=$(grep -E '^SEED_ADMIN_PASSWORD=' "$ZHIYU_ENV_FILE" | head -1 | cut -d= -f2- || true)
  if [[ -n "$seed_pw" ]]; then
    login=$(curl -s -m 10 -X POST "http://127.0.0.1:$WEB_PORT/api/v1/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"admin\",\"password\":\"$seed_pw\"}" | head -c 120)
    if echo "$login" | grep -q '"token"'; then
      log "登录冒烟通过（返回 token）"
    else
      log "登录冒烟异常：$login"
    fi
  fi
}

# ---------- 主流程 ----------
main() {
  if [[ "$MODE" == "--down" ]]; then
    compose_down
    return 0
  fi

  log "开始部署 zhiyu-saas Java 版（Docker）"
  resolve_db_password
  build
  stop_old
  compose_up
  health_check
  echo
  echo "=============================================="
  echo " 部署完成（Docker 容器），访问地址："
  echo "   演示站（统一入口）: http://111.170.170.202:$WEB_PORT/java/portal"
  echo "   后端接口:           http://111.170.170.202:$WEB_PORT/api/v1/"
  echo "   容器:               zhiyu-java-backend / zhiyu-java-nginx"
  echo "   运维:               docker compose -f deploy/docker/docker-compose-java.yml ps"
  echo "=============================================="
}

main "$@"
