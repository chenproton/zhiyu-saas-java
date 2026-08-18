#!/usr/bin/env bash
# =============================================================================
# zhiyu-saas Java 版部署脚本（Go→Java 迁移，基于 saas-framework6-java-vue）
#
# 部署形态（Docker，与 Go 版对齐）：
#   - java-backend 容器：ruoyi-admin.jar（Spring Boot 4 prod，容器内 8080）
#   - java-edu 容器：Next.js standalone（容器内 3020，/api 反代 → java-backend）
#   - java-nginx 容器：统一入口（宿主端口 8083 → 容器 80）
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
ZHIYU_ENV_FILE=/root/projects/zhiyu-saas/.env
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

  cd "$REPO_DIR/frontend/edu"
  log "构建前端（production，standalone 模式，basePath=/java）..."
  NEXT_PUBLIC_BASE_PATH=/java pnpm build > "$LOG_DIR/edu-build.log" 2>&1
  # standalone 产物需手动补齐静态资源与 public 目录（Next.js standalone 约定）
  cp -r .next/static .next/standalone/frontend/edu/.next/static
  cp -r public .next/standalone/frontend/edu/public
  log "前端构建完成"

  log "构建 Docker 镜像（backend + edu）..."
  rm -rf "$DOCKER_DIR/build-context/backend" "$DOCKER_DIR/build-context/edu"
  mkdir -p "$DOCKER_DIR/build-context/backend" "$DOCKER_DIR/build-context/edu"
  cp "$REPO_DIR/backend/java/ruoyi-admin/target/ruoyi-admin.jar" "$DOCKER_DIR/build-context/backend/ruoyi-admin.jar"
  # JDK 21 从宿主机拷贝（离线构建；-L 跟随 conf 等符号链接）
  rsync -aL --exclude='lib/src.zip' --exclude='demo' --exclude='sample' \
    /usr/lib/jvm/java-21-openjdk-amd64/ "$DOCKER_DIR/build-context/backend/jdk/"
  # standalone 保持原始相对结构（符号链接依赖布局：根 node_modules/.pnpm + frontend/edu/node_modules 顶层链接）
  rsync -a "$REPO_DIR/frontend/edu/.next/standalone/node_modules/" "$DOCKER_DIR/build-context/edu/node_modules/"
  mkdir -p "$DOCKER_DIR/build-context/edu/frontend/edu"
  rsync -a "$REPO_DIR/frontend/edu/.next/standalone/frontend/edu/node_modules/" "$DOCKER_DIR/build-context/edu/frontend/edu/node_modules/"
  cp "$REPO_DIR/frontend/edu/.next/standalone/frontend/edu/server.js" \
     "$REPO_DIR/frontend/edu/.next/standalone/frontend/edu/package.json" "$DOCKER_DIR/build-context/edu/frontend/edu/"
  rsync -a "$REPO_DIR/frontend/edu/.next/standalone/frontend/edu/.next/" "$DOCKER_DIR/build-context/edu/frontend/edu/.next/"
  rsync -a "$REPO_DIR/frontend/edu/.next/standalone/frontend/edu/public/" "$DOCKER_DIR/build-context/edu/frontend/edu/public/"

  docker build -t zhiyu-java-backend:$IMAGE_TAG \
    -f "$DOCKER_DIR/java-backend.Dockerfile" "$DOCKER_DIR/build-context/backend"
  docker build -t zhiyu-java-edu:$IMAGE_TAG \
    -f "$DOCKER_DIR/java-edu.Dockerfile" "$DOCKER_DIR/build-context/edu"
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
  # 先移除旧容器（镜像更新时强制重建），再拉起
  docker compose -f docker-compose-java.yml up -d --remove-orphans \
    --force-recreate java-backend java-edu java-nginx
  log "容器已启动（java-backend / java-edu / java-nginx）"
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
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/portal" || true)
    [[ "$code" == "200" ]] && break
    sleep 3
  done
  log "前端 /portal HTTP $code"

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
  echo "   演示站（统一入口）: http://111.170.170.202:$WEB_PORT/portal"
  echo "   后端接口:           http://111.170.170.202:$WEB_PORT/api/v1/"
  echo "   容器:               zhiyu-java-backend / zhiyu-java-edu / zhiyu-java-nginx"
  echo "   运维:               docker compose -f deploy/docker/docker-compose-java.yml ps"
  echo "=============================================="
}

main "$@"
