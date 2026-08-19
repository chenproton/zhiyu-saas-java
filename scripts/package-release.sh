#!/bin/bash
#
# package-release.sh - 生成无源码离线实施部署包
#
# 用法:
#   ./scripts/package-release.sh v1.0.0
#
# 产物:
#   release/zhiyu-saas-v1.0.0/           # 交付目录（直接复制到 U 盘）
#   release/zhiyu-saas-v1.0.0.tar.gz     # 压缩包
#
# 说明:
#   - 在可联网的开发机上执行（需要 docker / go / pnpm，镜像构建依赖本地已有
#     alpine:3.21 与 node:22-alpine，缺失时会从 offline/docker-images 加载）
#   - 客户服务器（全新 Ubuntu 24.04 x86_64）无需任何开发工具链，
#     复制交付目录后执行 ./install.sh 即可
#   - 包内不包含源代码，仅包含构建产物与 SQL 迁移文件
#   - offline/ 下的大文件（debs / docker-images / go / node）不随 git 提交，
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

export PATH="/usr/local/go/bin:$PATH"

log() { echo "==> $*"; }
die() { echo "  错误：$*" >&2; exit 1; }

for bin in docker go pnpm rsync python3; do
  command -v "$bin" >/dev/null 2>&1 || die "需要 $bin，请先安装"
done

# 离线资源完整性校验（客户机无网络，缺任何一项都无法完成部署）
[[ -n "$(ls "$OFFLINE_DIR"/debs/*.deb 2>/dev/null)" ]] || \
  die "缺少 offline/debs/ 离线系统依赖包，请先准备（见 offline/README.md）"
[[ -n "$(ls "$OFFLINE_DIR"/docker-images/*.tar 2>/dev/null)" ]] || \
  die "缺少 offline/docker-images/ 第三方镜像包（postgres/redis/kkfileview），请先准备（见 offline/README.md）"

# ── 0. 加载 offline 第三方镜像（构建后端需要 alpine，构建前端需要 node:22-alpine）──
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

# ── 1. 编译静态工具二进制（客户机无需 Go 工具链）──
log "编译迁移/种子工具（linux/amd64 静态二进制）..."
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"/{images,debs,bin,migrations,deploy}
# 注意：Go 后端已迁到 backend/go/（脚本此前仍写 $ROOT/backend，离线包必然构建失败）
(cd "$ROOT/backend/go" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -mod=vendor -ldflags="-s -w" -o "$PKG_DIR/bin/migrate" ./cmd/migrate/main.go)
(cd "$ROOT/backend/go" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -mod=vendor -ldflags="-s -w" -o "$PKG_DIR/bin/seed" ./cmd/seed/main.go)

# ── 2. 构建后端镜像 ──
log "构建后端镜像 zhiyu-backend:$VERSION ..."
TMPCTX=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR" "$TMPCTX"' EXIT
(cd "$ROOT/backend/go" && CGO_ENABLED=0 go build -mod=vendor -ldflags="-s -w" -o "$TMPCTX/server" ./cmd/server/main.go)
mkdir -p "$TMPCTX/migrations"
rsync -a --delete "$ROOT/backend/go/migrations/" "$TMPCTX/migrations/"
cp "$ROOT/backend/go/Dockerfile" "$TMPCTX/Dockerfile"
DOCKER_BUILD_ARGS=()
docker images alpine:3.21 --format ok 2>/dev/null | grep -q ok && DOCKER_BUILD_ARGS+=(--build-arg SKIP_APK_ADD=true)
docker build "${DOCKER_BUILD_ARGS[@]}" -t "zhiyu-backend:$VERSION" -f "$TMPCTX/Dockerfile" "$TMPCTX" 2>&1 | tail -3

# ── 3. 构建前端镜像（在临时副本中构建，不污染仓库工作树）──
log "构建前端镜像 zhiyu-edu:$VERSION ..."
rsync -a --exclude=.git --exclude=node_modules --exclude=.next \
  --exclude='*.tsbuildinfo' --exclude=backend/go/bin "$ROOT/" "$BUILD_DIR/"
(cd "$BUILD_DIR" && pnpm install --offline --frozen-lockfile 2>/dev/null) || \
(cd "$BUILD_DIR" && pnpm install --frozen-lockfile 2>/dev/null) || \
(cd "$BUILD_DIR" && pnpm install --no-frozen-lockfile) || die "pnpm install 失败"

# 离线图片编辑器资产同步到 public（构建镜像时打包进去，客户机无需单独携带）
rm -rf "$BUILD_DIR/frontend/edu/public/image-editor"
mkdir -p "$BUILD_DIR/frontend/edu/public/image-editor"
rsync -a --delete "$OFFLINE_DIR/image-editor/" "$BUILD_DIR/frontend/edu/public/image-editor/"

# 前端已是 Vite 纯静态 SPA（Next.js 已下线）：产物在 frontend/edu/dist，
# 由 nginx 镜像托管；不再有 .next/standalone。.env 里的 VITE_* 必须在构建期注入。
if [[ -f "$ROOT/.env" ]]; then
  set -a; . "$ROOT/.env"; set +a
  log "  已加载 .env 供 VITE_* 注入（离线包产物内固化站点地址/跨平台链接）"
else
  warn "未找到 $ROOT/.env：VITE_* 将取默认值（移动端二维码与跨平台链接会回落）"
fi
(cd "$BUILD_DIR" && NODE_ENV=production pnpm --filter @zhiyu/edu build) || die "前端构建失败"

EDU_DIR="$BUILD_DIR/frontend/edu"
[[ -d "$EDU_DIR/dist" ]] || die "前端产物缺失：$EDU_DIR/dist（Vite build 未生成）"
docker build -t "zhiyu-edu:$VERSION" -f "$EDU_DIR/Dockerfile" "$EDU_DIR" 2>&1 | tail -3
rm -rf "$TMPCTX"

# ── 4. 导出镜像 ──
log "导出 Docker 镜像..."
docker save -o "$PKG_DIR/images/zhiyu-backend-$VERSION.tar" "zhiyu-backend:$VERSION"
docker save -o "$PKG_DIR/images/zhiyu-edu-$VERSION.tar" "zhiyu-edu:$VERSION"
cp "$OFFLINE_DIR"/docker-images/*.tar "$PKG_DIR/images/" 2>/dev/null || true

# ── 5. 组装交付目录 ──
log "组装交付目录..."
cp "$OFFLINE_DIR"/debs/*.deb "$PKG_DIR/debs/" 2>/dev/null || true
rsync -a "$ROOT/backend/go/migrations/" "$PKG_DIR/migrations/"
cp "$ROOT/deploy/docker-compose.yml" "$PKG_DIR/deploy/"
cp -r "$ROOT/deploy/nginx" "$PKG_DIR/deploy/nginx"
# 容器网关配置必须一起带：compose 的 nginx 服务挂载 ./nginx-container/conf.d，缺失则容器起不来
cp -r "$ROOT/deploy/nginx-container" "$PKG_DIR/deploy/nginx-container"
cp "$ROOT/deploy/release/install.sh" "$ROOT/deploy/release/start.sh" \
   "$ROOT/deploy/release/stop.sh" "$ROOT/deploy/release/README.md" "$PKG_DIR/"
echo "$VERSION" > "$PKG_DIR/VERSION"
chmod +x "$PKG_DIR"/*.sh "$PKG_DIR"/bin/*

# ── 6. 压缩 ──
log "压缩发布包..."
tar -C "$RELEASE_DIR" -czf "$RELEASE_DIR/zhiyu-saas-$VERSION.tar.gz" "zhiyu-saas-$VERSION"

log "打包完成："
du -sh "$PKG_DIR" "$RELEASE_DIR/zhiyu-saas-$VERSION.tar.gz"
echo "  U 盘复制目录: release/zhiyu-saas-$VERSION/"
echo "  客户机执行:   ./install.sh"
