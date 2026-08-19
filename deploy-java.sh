#!/usr/bin/env bash
# =============================================================================
# zhiyu-saas Java 版部署脚本（Go→Java 迁移，基于 saas-framework6-java-vue）
#
# 部署形态（Docker，与 Go 版对齐）：
#   - java-backend 容器：ruoyi-admin.jar（Spring Boot 4 prod，容器内 8080）
#   - java-nginx 容器：统一入口（宿主端口 8083 → 容器 80），静态服务 Vue 门户（frontend/portal-vue）
#   - java-redis 容器：自带 Redis（无状态缓存，密码 ruoyi123）
#   - 数据库：共用 Go 栈的 zhiyu-postgres（同一网络 zhiyu-saas_zhiyu、同一库 zhiyu-saas），
#     Go/Java 表名零冲突（Go 55 表 + Java 81 表不相交）；框架表由 init_db_schema 幂等初始化
#
# 客户现场部署顺序（双栈）：先 ./deploy.sh（建库 + Go 栈），再 ./deploy-java.sh（Java 栈）。
# Java+Vue 独立运行的前提是共享 postgres 已就绪（deploy.sh 提供或单独提供同名库/账号）。
#
# 用法：
#   ./deploy-java.sh                 # 全量构建 + 部署
#   ./deploy-java.sh --skip-build    # 跳过构建，直接镜像部署/重启
#   ./deploy-java.sh --down          # 停止并移除 Java 版容器（不动共享 postgres）
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
warn() { echo "[deploy] 警告：$*" >&2; }
die() { echo "[deploy] 错误：$*" >&2; exit 1; }

# 参数白名单：拼错（如 --dwon）不得被当成「无参数=全量构建部署」静默执行
case "$MODE" in
  ""|--skip-build|--down) ;;
  --help|-h)
    echo "用法: $0 [--skip-build|--down]"; exit 0 ;;
  *) die "未知参数：$MODE（可用：--skip-build | --down | --help）" ;;
esac

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
      # 口令经环境变量传给 python，不放进 argv：argv 在 ps/审计日志里对同机任意用户可见
      decoded=$(RAW_PW="$raw" python3 -c 'import os,urllib.parse; print(urllib.parse.unquote(os.environ["RAW_PW"]))')
      export ZHIYU_DB_PASSWORD="$decoded"
      log "PG 密码已从 zhiyu-saas/.env 解析（长度 ${#decoded}，不回显）"
      return 0
    fi
  fi
  log "警告：无法解析 PG 密码，容器可能启动失败"
  export ZHIYU_DB_PASSWORD="change-me"
}

# ---------- 1. 构建（宿主机构建 jar 与 Vue 门户静态产物，再打进镜像） ----------
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
    pnpm install --silent > "$LOG_DIR/portal-vue-install.log" 2>&1 || \
    die "portal-vue 依赖安装失败（日志: logs/portal-vue-install.log）"
  pnpm build > "$LOG_DIR/portal-vue-build.log" 2>&1 \
    || die "portal-vue 构建失败（日志: logs/portal-vue-build.log）"
  log "Vue 门户构建完成"

  log "构建 Docker 镜像（backend）..."
  rm -rf "$DOCKER_DIR/build-context/backend"
  mkdir -p "$DOCKER_DIR/build-context/backend"
  cp "$REPO_DIR/backend/java/ruoyi-admin/target/ruoyi-admin.jar" "$DOCKER_DIR/build-context/backend/ruoyi-admin.jar"
  # JDK 21 从宿主机拷贝（离线构建；-L 跟随 conf 等符号链接）
  rsync -aL --exclude='lib/src.zip' --exclude='demo' --exclude='sample' \
    /usr/lib/jvm/java-21-openjdk-amd64/ "$DOCKER_DIR/build-context/backend/jdk/"

  # 除 latest 外再打一个 git 短 sha tag：latest 被重建后旧镜像会变悬空并被清理，
  # 导致 Java 栈完全没有可回滚的历史版本（Go 栈是按 hash 打 tag 的）
  local git_sha
  git_sha=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit")
  docker build -t "zhiyu-java-backend:$IMAGE_TAG" -t "zhiyu-java-backend:$git_sha" \
    -f "$DOCKER_DIR/java-backend.Dockerfile" "$DOCKER_DIR/build-context/backend"
  log "镜像构建完成（tag: $IMAGE_TAG + $git_sha，回滚可用 IMAGE_TAG=<sha> ./deploy-java.sh --skip-build）"
}

# ---------- 2. 停止旧裸进程与旧容器 ----------
stop_old() {
  # 停旧的裸进程部署（历史版本：java -jar 8081 / next 3021）；无可停进程时也应返回 0，避免 set -e 误中断
  # 只杀确认属于本项目的历史裸进程（按 cmdline 匹配），否则可能误杀他人占用同端口的服务
  kill_legacy_listener() {
    local port="$1" pattern="$2" label="$3" pid cmd
    pid=$(ss -tlnp 2>/dev/null | grep ":$port" | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    [[ -z "$pid" ]] && return 0
    cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
    if [[ "$cmd" == *"$pattern"* ]]; then
      kill "$pid" 2>/dev/null && log "已停旧${label}进程 $pid" || true
    else
      warn "端口 $port 被非本项目进程占用（pid $pid），跳过 kill：$cmd"
    fi
    return 0
  }
  kill_legacy_listener 8081 ruoyi-admin.jar 后端
  kill_legacy_listener 3021 portal-vue 前端
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
  # compose 即使只做 down 也会对整个文件做变量插值，缺 ZHIYU_DB_PASSWORD 会直接报错退出，
  # 故 down 前同样要解析密码（down 本身不使用该值）。
  resolve_db_password
  docker compose -f docker-compose-java.yml down
  log "Java 版容器已停止移除"
}

# ---------- 4. 健康检查与冒烟 ----------
health_check() {
  log "等待后端就绪..."
  local code=000
  for _ in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/api/v1/auth/me" || true)
    [[ "$code" == "401" || "$code" == "200" ]] && break
    sleep 3
  done
  [[ "$code" == "401" || "$code" == "200" ]] \
    || die "后端未就绪（经入口 HTTP $code）：docker logs zhiyu-java-backend --tail 100"
  log "后端（经入口）HTTP $code（401=已鉴权拦截，服务正常）"

  log "等待前端就绪..."
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/java/portal/" || true)
    [[ "$code" == "200" ]] && break
    sleep 3
  done
  [[ "$code" == "200" ]] || die "前端未就绪（/java/portal/ HTTP $code）：docker logs zhiyu-java-nginx --tail 50"
  log "前端 /java/portal/ HTTP $code"

  # 统一入口自检：门户前端 VITE_API_BASE=/java/api/v1，必须经宿主 nginx :80 可达，
  # 否则「直连 8083 能用、正式入口打不开」的问题只有用户会先发现
  local entry_code api_code
  entry_code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/java/portal/" || echo 000)
  api_code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/java/api/v1/auth/me" || echo 000)
  if [[ "$entry_code" == "200" && ( "$api_code" == "401" || "$api_code" == "200" ) ]]; then
    log "统一入口自检通过（:80/java/portal/ $entry_code，:80/java/api/v1 $api_code）"
  else
    warn "统一入口自检未通过（:80/java/portal/ $entry_code，:80/java/api/v1 $api_code）——"
    warn "  请检查宿主 nginx 的 location /java/ 是否代理到 127.0.0.1:$WEB_PORT"
  fi

  # 登录冒烟（zhiyu admin 账号，密码从 zhiyu-saas/.env 解析）
  local seed_pw login
  seed_pw=$(grep -E '^SEED_ADMIN_PASSWORD=' "$ZHIYU_ENV_FILE" | head -1 | cut -d= -f2- || true)
  if [[ -n "$seed_pw" ]]; then
    # 密码经 stdin 传给 curl（-d @-），禁止出现在命令行参数里：ps/审计日志可见即等于泄露
    login=$(printf '{"username":"admin","password":"%s"}' "$seed_pw" \
      | curl -s -m 10 -X POST "http://127.0.0.1:$WEB_PORT/api/v1/auth/login" \
        -H 'Content-Type: application/json' --data-binary @- | head -c 120)
    if echo "$login" | grep -q '"token"'; then
      log "登录冒烟通过（返回 token）"
    else
      log "登录冒烟异常：$login"
    fi
  fi
}

# ---------- 1.5 数据库框架表初始化（全新服务器共享库无 RuoYi sys_* 表，后端启动即报 relation 不存在）----------
init_db_schema() {
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'zhiyu-postgres'; then
    warn "未检测到 zhiyu-postgres（Go 栈未部署？），跳过框架表初始化——java-backend 启动将依赖该库"
    return 0
  fi
  log "检查 RuoYi 框架表（逐文件幂等初始化）..."
  local sql_dir="$REPO_DIR/backend/java/script/sql/postgres"
  # 逐文件门闩 + 单事务：这些 SQL 里有裸 CREATE TABLE 与数百条无 ON CONFLICT 的 INSERT，
  # 重复执行会重复插入字典/菜单数据；用「代表表是否存在」判断该文件是否已应用，
  # --single-transaction 保证半途失败整体回滚，不会在共享库里留半套表。
  local applied=0 skipped=0
  local pair
  for pair in "postgres_ry_vue:sys_social" "postgres_ry_job:sj_namespace" \
              "postgres_ry_workflow:flow_definition" "postgres_ry_ai:sai_user"; do
    local f="${pair%%:*}" probe="${pair##*:}"
    if docker exec zhiyu-postgres psql -U zhiyu_saas -d zhiyu-saas -tAc \
        "SELECT to_regclass('public.$probe')" 2>/dev/null | grep -q "$probe"; then
      skipped=$((skipped + 1))
      continue
    fi
    [[ -f "$sql_dir/$f.sql" ]] || { warn "缺少 $f.sql，跳过"; continue; }
    log "  应用 $f.sql（代表表 $probe 不存在）..."
    if docker exec -i zhiyu-postgres psql -U zhiyu_saas -d zhiyu-saas \
         -v ON_ERROR_STOP=1 --single-transaction \
         < "$sql_dir/$f.sql" > "$LOG_DIR/java-init-$f.log" 2>&1; then
      applied=$((applied + 1))
    else
      warn "初始化 $f.sql 失败（事务已回滚，详见 logs/java-init-$f.log）"
      tail -5 "$LOG_DIR/java-init-$f.log" >&2 || true
    fi
  done
  log "框架表初始化完成（新应用 $applied 个文件，已存在跳过 $skipped 个）"
}

# ---------- 主流程 ----------
main() {
  if [[ "$MODE" == "--down" ]]; then
    compose_down
    return 0
  fi

  log "开始部署 zhiyu-saas Java 版（Docker）"
  resolve_db_password
  init_db_schema
  build
  stop_old
  compose_up
  health_check
  echo
  echo "=============================================="
  echo " 部署完成（Docker 容器），访问地址："
  local host_ip
  host_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "   演示站（统一入口）: http://${host_ip:-<服务器IP>}:$WEB_PORT/java/portal"
  echo "   后端接口:           http://${host_ip:-<服务器IP>}:$WEB_PORT/api/v1/"
  echo "   容器:               zhiyu-java-backend / zhiyu-java-nginx"
  echo "   运维:               docker compose -f deploy/docker/docker-compose-java.yml ps"
  echo "=============================================="
}

main "$@"
