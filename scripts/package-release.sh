#!/bin/bash
#
# package-release.sh - 生成无源码离线实施部署包（单栈：Java + Vue）
#
# 用法:
#   ./scripts/package-release.sh v1.0.0
#
# 产物:
#   release/zhiyu-saas-v1.0.0/           # 交付目录（直接复制到 U 盘）
#   release/zhiyu-saas-v1.0.0.tar.gz     # 压缩包
#
# 说明:
#   - 在可联网的开发机上执行（需要 docker / JDK 21 / pnpm，构建 java-backend 镜像与
#     portal-vue/plus-ui 产物；镜像构建依赖本地已有 ubuntu:24.04 与 nginx:1.27-alpine，
#     缺失时会从 offline/docker-images 加载）
#   - 客户服务器（全新 Ubuntu 24.04 x86_64）无需任何开发工具链，
#     复制交付目录后执行 ./install.sh 即可
#   - 包内不包含源代码，仅包含构建产物、SQL 迁移文件与前端 dist
#   - offline/ 下的大文件（debs / docker-images / node）不随 git 提交，
#     需手动准备；也可通过环境变量 OFFLINE_DIR 指向其他位置的资源目录
#
set -euo pipefail

VERSION="${1:?用法: $0 <版本号，如 v1.0.0>}"
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "版本号格式应为 vX.Y.Z，例如 v1.0.0" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OFFLINE_DIR="${OFFLINE_DIR:-$ROOT/offline}"
RELEASE_DIR="$ROOT/release"
PKG_DIR="$RELEASE_DIR/zhiyu-saas-$VERSION"
BUILD_DIR="$(mktemp -d /tmp/zhiyu-pkg-build.XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT

JAVA_HOME_DIR="${JAVA_HOME_DIR:-/usr/lib/jvm/java-21-openjdk-amd64}"

log() { echo "==> $*"; }
warn() { echo "  警告：$*" >&2; }
die() { echo "  错误：$*" >&2; exit 1; }

for bin in docker pnpm rsync python3; do
  command -v "$bin" >/dev/null 2>&1 || die "需要 $bin，请先安装"
done
[[ -x "$JAVA_HOME_DIR/bin/java" ]] || die "需要 JDK 21（$JAVA_HOME_DIR），请先安装 openjdk-21-jdk-headless"

# 离线资源完整性校验（客户机无网络，缺任何一项都无法完成部署）
[[ -n "$(ls "$OFFLINE_DIR"/debs/*.deb 2>/dev/null)" ]] || \
  die "缺少 offline/debs/ 离线系统依赖包，请先准备（见 offline/README.md）"
[[ -n "$(ls "$OFFLINE_DIR"/docker-images/*.tar 2>/dev/null)" ]] || \
  die "缺少 offline/docker-images/ 第三方镜像包（postgres/redis/nginx/kkfileview），请先准备（见 offline/README.md）"

# ── 0. 加载 offline 第三方镜像（构建 java-backend 需要 ubuntu:24.04）──
for tar in "$OFFLINE_DIR"/docker-images/*.tar; do
  [[ -f "$tar" ]] || continue
  img=$(tar xfO "$tar" manifest.json 2>/dev/null | python3 -c "
import json,sys
for m in json.load(sys.stdin):
    if m.get('RepoTags'):
        for t in m['RepoTags']:
            if t: print(t); break
        break" 2>/dev/null || true)
  [[ -n "$img" ]] || continue
  if ! docker images -q "$img" >/dev/null 2>&1; then
    log "加载基础镜像: $img"
    docker load -i "$tar" >/dev/null 2>&1 || die "基础镜像加载失败: $tar"
  fi
done

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"/{images,debs,deploy,web}

# ── 1. 构建后端 jar（Maven，prod profile）──
log "构建后端 jar（Maven）..."
(cd "$ROOT/backend/java" && JAVA_HOME="$JAVA_HOME_DIR" PATH="$JAVA_HOME_DIR/bin:$PATH" \
  ./mvnw clean package -P prod -DskipTests -q) || die "Maven 构建失败"
JAR="$ROOT/backend/java/ruoyi-admin/target/ruoyi-admin.jar"
[[ -f "$JAR" ]] || die "ruoyi-admin.jar 未生成"

# ── 2. 构建后端镜像 zhiyu-java-backend:$VERSION ──
log "构建后端镜像 zhiyu-java-backend:$VERSION ..."
TMPCTX=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR" "$TMPCTX"' EXIT
cp "$JAR" "$TMPCTX/ruoyi-admin.jar"
rsync -aL --exclude='lib/src.zip' --exclude='demo' --exclude='sample' \
  "$JAVA_HOME_DIR/" "$TMPCTX/jdk/"
cp "$ROOT/deploy/docker/java-backend.Dockerfile" "$TMPCTX/Dockerfile"
docker build -t "zhiyu-java-backend:$VERSION" -f "$TMPCTX/Dockerfile" "$TMPCTX" 2>&1 | tail -3

# ── 3. 构建前端产物（portal-vue 业务门户 + plus-ui 管理端，dist 直接进交付目录）──
log "构建前端产物（portal-vue + plus-ui）..."
rsync -a --exclude=.git --exclude=node_modules --exclude=dist \
  --exclude='*.tsbuildinfo' --exclude=backend/java --exclude=offline \
  "$ROOT/" "$BUILD_DIR/"

# portal-vue（build 内含 vue-tsc 类型检查）
(cd "$BUILD_DIR/frontend/portal-vue" && pnpm install --offline --silent 2>/dev/null) || \
  (cd "$BUILD_DIR/frontend/portal-vue" && pnpm install --silent 2>/dev/null) || \
  die "portal-vue 依赖安装失败"
(cd "$BUILD_DIR/frontend/portal-vue" && NODE_ENV=production pnpm build >/dev/null) || die "portal-vue 构建失败"
[[ -d "$BUILD_DIR/frontend/portal-vue/dist" ]] || die "portal-vue 产物缺失：dist"

# plus-ui 管理端
(cd "$BUILD_DIR/frontend/plus-ui" && pnpm install --offline --silent 2>/dev/null) || \
# plus-ui 声明 packageManager pnpm@10.34.5（engines.pnpm >=10），全局 pnpm 9 不兼容 → npx 拉取 pnpm@10
PLUS_PNPM="pnpm"
grep -q '"packageManager": "pnpm@10' "$BUILD_DIR/frontend/plus-ui/package.json" 2>/dev/null && PLUS_PNPM="npx --yes pnpm@10.34.5"
(cd "$BUILD_DIR/frontend/plus-ui" && $PLUS_PNPM install --silent 2>/dev/null) || \
  die "plus-ui 依赖安装失败"
(cd "$BUILD_DIR/frontend/plus-ui" && NODE_ENV=production $PLUS_PNPM build >/dev/null) || die "plus-ui 构建失败"
[[ -d "$BUILD_DIR/frontend/plus-ui/dist" ]] || die "plus-ui 产物缺失：dist"

# ── 4. 导出镜像 ──
log "导出 Docker 镜像..."
docker save -o "$PKG_DIR/images/zhiyu-java-backend-$VERSION.tar" "zhiyu-java-backend:$VERSION"
cp "$OFFLINE_DIR"/docker-images/*.tar "$PKG_DIR/images/" 2>/dev/null || true

# ── 5. 组装交付目录 ──
log "组装交付目录..."
cp "$OFFLINE_DIR"/debs/*.deb "$PKG_DIR/debs/" 2>/dev/null || true
mkdir -p "$PKG_DIR/deploy/migrations"
rsync -a "$ROOT/db/migrations/" "$PKG_DIR/deploy/migrations/"
# RuoYi 框架表初始化 SQL（install.sh 幂等导入）
cp "$ROOT/backend/java/script/sql/postgres/"*.sql "$PKG_DIR/deploy/" 2>/dev/null || true
cp "$ROOT/deploy/docker-compose.yml" "$PKG_DIR/deploy/"
cp -r "$ROOT/deploy/nginx" "$PKG_DIR/deploy/nginx"
# 容器网关配置必须一起带：compose 的 nginx 服务挂载 ./nginx-container/conf.d，缺失则容器起不来
cp -r "$ROOT/deploy/nginx-container" "$PKG_DIR/deploy/nginx-container"
# 前端 dist（nginx 容器挂载 $DEPLOY_DIR/web/）
cp -r "$BUILD_DIR/frontend/portal-vue/dist" "$PKG_DIR/web/portal"
cp -r "$BUILD_DIR/frontend/plus-ui/dist" "$PKG_DIR/web/plus-ui"
cp "$ROOT/deploy/release/install.sh" "$ROOT/deploy/release/start.sh" \
   "$ROOT/deploy/release/stop.sh" "$ROOT/deploy/release/README.md" "$PKG_DIR/"
echo "$VERSION" > "$PKG_DIR/VERSION"
chmod +x "$PKG_DIR"/*.sh 2>/dev/null || true

# ── 6. 压缩 ──
log "压缩发布包..."
tar -C "$RELEASE_DIR" -czf "$RELEASE_DIR/zhiyu-saas-$VERSION.tar.gz" "zhiyu-saas-$VERSION"

log "打包完成："
du -sh "$PKG_DIR" "$RELEASE_DIR/zhiyu-saas-$VERSION.tar.gz"
echo "  U 盘复制目录: release/zhiyu-saas-$VERSION/"
echo "  客户机执行:   ./install.sh"
