#!/bin/bash
#
# deploy-docker.sh - Docker 容器化部署（PostgreSQL + Redis + 后端 + OpenResty）
#
# 用法:
#   默认（本地源码构建）:  ./deploy/docker-deploy.sh
#   分支模式:            ./deploy/docker-deploy.sh --branch feat/xxx
#   仅启动容器:          ./deploy/docker-deploy.sh --up
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/zhiyu-saas}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
BACKEND_PORT="${BACKEND_PORT:-8080}"
IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"

BRANCH_NAME=""
UP_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH_NAME="$2"; shift 2 ;;
    --up) UP_ONLY=true; shift ;;
    -h|--help)
      echo "用法: $0 [--branch <分支名>] [--up]"
      echo ""
      echo "  --branch <name>   使用指定分支构建（会创建隔离 worktree）"
      echo "  --up              仅启动容器，跳过构建"
      exit 0
      ;;
    *) echo "错误：未知参数 $1" >&2; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：Docker 未安装" >&2; exit 1
fi

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" "$@"
  fi
}

if [[ "$UP_ONLY" == "true" ]]; then
  echo "==> 启动/重启容器..."
  docker_compose up -d --remove-orphans
  docker_compose ps
  echo "✨ 完成"
  exit 0
fi

# ─── 分支构建 ───
BUILD_SRC=""
if [[ -n "$BRANCH_NAME" ]]; then
  echo "==> 分支构建模式: $BRANCH_NAME"
  BUILD_TREE="/tmp/zhiyu-docker-build"
  git -C "$PROJECT_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  git -C "$PROJECT_ROOT" worktree prune 2>/dev/null || true

  if [[ -d "$BUILD_TREE" ]]; then
    git -C "$PROJECT_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
    rm -rf "$BUILD_TREE"
  fi

  git -C "$PROJECT_ROOT" worktree add --detach "$BUILD_TREE" origin/master
  git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit
  IMAGE_TAG="$(git -C "$BUILD_TREE" rev-parse --short HEAD 2>/dev/null || echo "latest")"
  BUILD_SRC="$BUILD_TREE/backend"

  cleanup() {
    if [[ -n "${BUILD_TREE:-}" && -d "$BUILD_TREE" ]]; then
      git -C "$PROJECT_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true
      rm -rf "$BUILD_TREE"
    fi
  }
  trap cleanup EXIT
else
  BUILD_SRC="$PROJECT_ROOT/backend"
fi

# ─── 生成 .env ───
echo "==> 生成 Docker .env..."
mkdir -p "$DEPLOY_DIR"
chmod 700 "$DEPLOY_DIR"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  source "$PROJECT_ROOT/.env"
fi

DB_USER="${DB_USER:-zhiyu_saas}"
DB_PASSWORD="${DB_PASSWORD:-$(grep DATABASE_URL "$PROJECT_ROOT/.env" 2>/dev/null | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' | python3 -c 'import urllib.parse,sys; print(urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null || echo "")}"
DB_NAME="${DB_NAME:-zhiyu-saas}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "错误：无法解析 DB_PASSWORD，请检查 $PROJECT_ROOT/.env 中的 DATABASE_URL" >&2
  exit 1
fi

cat > "$DEPLOY_DIR/docker.env" <<EOF
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
JWT_SECRET=${JWT_SECRET:-zhiyu-saas-dev-secret-change-in-production}
IMAGE_TAG=$IMAGE_TAG
EOF
chmod 600 "$DEPLOY_DIR/docker.env"

# ─── 复制 compose 和 migrations ───
echo "==> 同步配置..."
mkdir -p "$DEPLOY_DIR/migrations"
if [[ -d "$BUILD_SRC/migrations" ]]; then
  rsync -a --delete "$BUILD_SRC/migrations/" "$DEPLOY_DIR/migrations/"
elif [[ -d "$PROJECT_ROOT/backend/migrations" ]]; then
  rsync -a --delete "$PROJECT_ROOT/backend/migrations/" "$DEPLOY_DIR/migrations/"
fi

# ─── 构建镜像 ───
echo "==> 构建 Docker 镜像 zhiyu-backend:$IMAGE_TAG..."
(
  cd "$BUILD_SRC"
  docker build -t "zhiyu-backend:$IMAGE_TAG" -f Dockerfile . 2>&1 | tail -10
) || {
  echo "错误：Docker 镜像构建失败" >&2; exit 1
}

# ─── 首次部署或重启 ───
EXISTING=$(docker_compose ps -q 2>/dev/null | wc -l || echo "0")

if [[ "$EXISTING" -eq 0 ]]; then
  echo "==> 首次部署，启动数据库和 Redis..."
  docker_compose up -d postgres redis 2>&1

  echo "  等待 PostgreSQL..."
  for i in $(seq 1 30); do
    if docker_compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      echo "  PostgreSQL 就绪"; break
    fi
    sleep 2
  done

  echo "  等待 Redis..."
  for i in $(seq 1 10); do
    if docker_compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
      echo "  Redis 就绪"; break
    fi
    sleep 1
  done
fi

# ─── 运行 DB 迁移 ───
echo "==> 数据库迁移..."
docker_compose up -d backend 2>/dev/null || true
sleep 3

docker_compose exec -T backend bash -c '
  cd /app
  for f in /app/migrations/*.up.sql; do
    version=$(basename "$f" .up.sql)
    exists=$(psql "$DATABASE_URL" -t -A -c "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='\''$version'\'')" 2>/dev/null || echo "f")
    if [[ "$exists" == "t" ]]; then
      echo "  skip: $(basename $f)"
    else
      echo "  apply: $(basename $f)"
      psql "$DATABASE_URL" -f "$f" -q && psql "$DATABASE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('\''$version'\'')" -q
    fi
  done
' 2>/dev/null || {
  echo "  提示：迁移可能在容器内自动完成，跳过手动迁移"
}

# ─── 启动后端 ───
echo "==> 启动后端容器..."
docker_compose up -d --remove-orphans 2>&1

echo ""
echo "==> 等待后端健康..."
for i in $(seq 1 30); do
  STATUS=$(docker_compose ps backend --format '{{.Health}}' 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    echo "  后端健康检查通过"
    break
  fi
  sleep 2
done

if [[ "$(docker_compose ps backend --format '{{.Health}}' 2>/dev/null)" != "healthy" ]]; then
  echo "错误：后端启动超时" >&2
  docker_compose logs backend --tail 20
  exit 1
fi

docker builder prune --all --force >/dev/null 2>&1 || true

echo ""
docker_compose ps
echo ""
echo "✨ Docker 部署完成！"
echo "   后端: http://localhost:$BACKEND_PORT"
echo "   镜像: zhiyu-backend:$IMAGE_TAG"

if [[ -n "$BRANCH_NAME" ]]; then
  echo ""
  echo "📌 已从分支 $BRANCH_NAME 构建，验证通过后建议合并到 master:"
  echo "   cd $PROJECT_ROOT && git checkout master && git merge $BRANCH_NAME && git push"
fi
