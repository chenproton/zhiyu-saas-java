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
#   非分支模式 → 位于 master 分支时自动同步 origin/master 并在隔离 worktree 构建，
#                本地工作树脏（lockfile 被旧版 pnpm 改写、部署产物等）不影响构建；
#                回滚场景（git checkout <tag> 后 detached）仍基于本地 HEAD 构建
#
set -euo pipefail
# 失败可定位：管道/命令替换里的静默失败会带出行号与具体命令（历史上多次"无任何输出就退出"）
set -E
trap 'rc=$?; [[ $rc -ne 0 ]] && echo "  错误：deploy.sh 第 ${LINENO} 行失败（命令: ${BASH_COMMAND}，退出码 ${rc}）" >&2' ERR

# ── 参数 ──
BRANCH_NAME=""; CLEAN_BUILD=false; SKIP_MERGE=false; FORCE_FLAG=false; GATES_FLAG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      [[ -z "${2:-}" || "${2:-}" == -* ]] && { echo "  错误：--branch 需要分支名" >&2; exit 1; }
      BRANCH_NAME="$2"; shift 2 ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --force) FORCE_FLAG=true; shift ;;
    --gates) GATES_FLAG=true; shift ;;
    --skip-merge) SKIP_MERGE=true; shift ;;
    --help|-h)
      echo "用法: $0 --branch <分支名> [--clean] [--force] [--gates] [--skip-merge]"
      echo "  --force 仅配合 --clean 生效：允许 docker builder prune --all（清空宿主全局构建缓存）"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

# ── 常量 ──
BACKEND_PORT=8080; EDU_PORT=3020; GO_NGINX_PORT=8084
DEPLOY_DIR="/opt/zhiyu-saas"
# 全新服务器上 install_offline_debs 等前置步骤会先写 $DEPLOY_DIR 下的标记文件，
# 必须先建目录，否则 "touch ... No such file or directory" 中断部署
mkdir -p "$DEPLOY_DIR" 2>/dev/null || true
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
    # 用 python 精确替换：sed "s|...|...|" 在 value 含 | & \ 时会被破坏（人工填的口令常踩）
    KEY="$key" VALUE="$value" python3 - "$file" <<'PYEOF'
import os, sys
path, key, value = sys.argv[1], os.environ["KEY"], os.environ["VALUE"]
lines = open(path).read().splitlines()
out = [f"{key}={value}" if l.startswith(f"{key}=") else l for l in lines]
open(path, "w").write("\n".join(out) + "\n")
PYEOF
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
    # 临时锁定内核元包，避免 apt install 其他包时顺带升级内核导致需要重启；
    # 装完立即解锁——原来只 hold 不 unhold，等于永久冻结内核安全更新
    apt-mark hold linux-image-generic linux-headers-generic >/dev/null 2>&1 || true
    apt-get install -y -qq "$@" 2>/dev/null || true
    apt-mark unhold linux-image-generic linux-headers-generic >/dev/null 2>&1 || true
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
           while read -r img; do docker images -q "$img" 2>/dev/null; done | sort -u) || true
  # 注：set -euo pipefail 下，全新服务器没有 ${repo} 容器时 grep 无匹配退出码 1，
  # 会令整条管道非零并杀死部署——必须 || true 兜底（本机因有存量容器从未暴露）。
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

# 清理同一镜像 ID 上残留的历史标签：只保留 content-hash 与当前 IMAGE_TAG 两个标签。
# 历史 commit 标签（每次部署都会打一个）不占额外磁盘（指向同一 ID），
# 但会随部署无限累积，导致 docker images 列表膨胀、误以为镜像堆积。
# 仅删标签不动镜像（镜像还有其他标签时 docker rmi 只移除该标签），被容器引用的标签删除会失败并安全跳过。
prune_extra_tags() {
  local repo="$1" hash_tag="$2"
  local img
  for img in $(docker images --format '{{.Repository}}:{{.Tag}}' "$repo" 2>/dev/null); do
    [[ "$img" == "$repo:$hash_tag" || "$img" == "$repo:$IMAGE_TAG" ]] && continue
    if ! docker rmi "$img" >/dev/null 2>&1; then
      warn "移除历史标签 $img 失败（可能仍被容器引用，下次部署会自动重试）"
    fi
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
    # 取 manifest 中第一个完整 RepoTag（保留 :tag），用于精确判断该镜像是否已存在。
    # 不能用 docker images -q <repo>（剥 tag 后 1panel 等自带的同名异 tag 镜像会误判已存在，
    # 导致离线加载被跳过、compose 去拉被墙的 docker hub）；也不能只看退出码
    # （docker images -q 无匹配时仍返回 0），须用 docker image inspect 判存在。
    img=$(tar xfO "$tar" manifest.json 2>/dev/null | python3 -c "
import json,sys
try:
    ms = json.load(sys.stdin)
except Exception:
    sys.exit(1)
for m in ms:
    for t in (m.get('RepoTags') or []):
        if t:
            print(t)
            break
" 2>/dev/null | head -1)
    if [[ -n "$img" ]] && docker image inspect "$img" >/dev/null 2>&1; then
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

# 迁移版本表规范化：migrate 工具以全名（如 "157_resource_creator_retain"）记录版本，
# 历史 psql 兜底曾以裸数字（如 "157"）记录，导致已应用迁移被重复执行而失败回滚。
# 规则（幂等，每次部署均可安全运行）：
#   1. 裸数字行对应的全部全名均已存在 → 删除裸数字行（冗余记录）
#   2. 裸数字行唯一对应一个迁移文件且全名缺失 → 改名为全名
#   3. 裸数字对应多个迁移文件且全名记录不完整 → 无法判定归属，保留并警告人工确认
normalize_migration_versions() {
  local backend_dir="$1" migrate_url="$2"
  local sql="" bare full all_full files=()
  for bare in $(psql_db -Atc "SELECT version FROM schema_migrations WHERE version ~ '^[0-9]+\$';" 2>/dev/null || true); do
    files=()
    for f in "$backend_dir"/migrations/${bare}_*.up.sql; do
      [[ -f "$f" ]] || continue
      files+=("$(basename "$f" .up.sql)")
    done
    [[ ${#files[@]} -gt 0 ]] || continue
    all_full=true
    for full in "${files[@]}"; do
      if [[ -z "$(psql_db -Atc "SELECT 1 FROM schema_migrations WHERE version='$full'" 2>/dev/null || true)" ]]; then
        all_full=false
      fi
    done
    if [[ "$all_full" == "true" ]]; then
      sql+="DELETE FROM schema_migrations WHERE version='$bare';"
    elif [[ ${#files[@]} -eq 1 ]]; then
      sql+="UPDATE schema_migrations SET version='${files[0]}' WHERE version='$bare';"
    else
      warn "迁移版本 $bare 对应多个迁移文件且全名记录不完整，跳过自动规范化，请人工确认"
    fi
  done
  [[ -n "$sql" ]] || return 0
  if psql_db -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
    log "  迁移版本表已规范化（裸数字版本对齐全名）"
  else
    warn "迁移版本表规范化失败，继续尝试 migrate 工具"
  fi
}

# 执行数据库迁移；若 migrate 工具失败，使用 psql 兜底逐个执行未应用迁移文件
run_migrations() {
  local backend_dir="$1" migrate_url="$2"
  normalize_migration_versions "$backend_dir" "$migrate_url"
  # 复用与后端构建同一份 GOCACHE：原来用默认缓存目录，每次部署多两轮全量编译（与前端 3.4G 峰值同机竞争）
  if (cd "$backend_dir" && GOCACHE="${BUILD_CACHE:-/tmp}/go-cache" \
      DATABASE_URL="$migrate_url" go run ./cmd/migrate/main.go up); then
    return 0
  fi

  warn "migrate 工具执行失败，尝试使用 psql 兜底执行未应用迁移..."
  local applied_versions
  applied_versions=$(psql_db -Atc "SELECT version FROM schema_migrations;" 2>/dev/null || true)

  local failed=false
  for f in "$backend_dir"/migrations/*.up.sql; do
    [[ -f "$f" ]] || continue
    local version
    version=$(basename "$f" .up.sql)
    if echo "$applied_versions" | grep -qx "$version"; then
      continue
    fi
    log "  兜底执行: $(basename "$f")"
    if psql_db -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -5; then
      psql_db -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING;" >/dev/null || true
    else
      failed=true
      # 立即停止：继续应用后续 migration 会在半应用的 schema 上叠加 DDL，之后必然卡住
      warn "兜底迁移失败: $(basename "$f")（停止后续迁移，避免半应用 DDL 叠加）"
      break
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
  # 排除构建期生成物（public/image-editor 687 文件、wasm/vendor 由 prebuild 生成）：
  # 它们一变就白烧一次「3.4GB 峰值 + 1 分钟」的前端构建。
  # 纳入根级配置：根 package.json / pnpm-workspace.yaml / tsconfig.base.json / .npmrc 变更
  # 会影响产物，原来不在指纹内 → 会被误判「无变更跳过」而部署陈旧 dist。
  {
    find "$1/frontend/edu" "$1/frontend/packages" -type f \
      -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/dist/*' \
      -not -path '*/public/image-editor/*' -not -path '*/public/wasm/*' -not -path '*/public/vendor/*' \
      -not -name '*.tsbuildinfo' -not -name '*.map' -print0 2>/dev/null
    # 只喂存在的文件：不存在的路径（如本仓库当前没有 .npmrc）会让 md5sum 失败，
    # xargs 返回 123 + pipefail 直接中止部署
    for root_cfg in "$1/package.json" "$1/pnpm-workspace.yaml" "$1/tsconfig.base.json" "$1/.npmrc"; do
      [[ -f "$root_cfg" ]] && printf '%s\0' "$root_cfg"
    done
    # 收尾 true：最后一个文件不存在时循环退出码为 1，会让 { } 组失败并被 pipefail 传播成中止
    true
  } | sort -z | xargs -0 -r md5sum 2>/dev/null | \
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

# ── 部署锁（必须在任何系统级动作之前）──
# 历史问题：锁在脚本后半段才获取，而此前已经做了 apt 安装、解压 Go/Node 到 /usr/local、
# 装并启用 nginx、重启 docker 等全局动作 —— 两个并发部署会互相踩（例如一边 rm -rf /usr/local/go
# 重装，另一边正在 go build）。故把锁提前到系统依赖检查之前。
# 锁文件放 /run（root 专属、非世界可写）：/tmp 路径可预测，非 root 用户可预置同名符号链接，
# root 的 exec {LOCK_FD}>"$LOCK_FILE" 会跟随并截断目标文件。/run 不可写时回退 /tmp。
if [[ -d /run && -w /run ]]; then LOCK_FILE="/run/zhiyu-deploy.lock"; else LOCK_FILE="/tmp/zhiyu-deploy.lock"; fi
if command -v flock >/dev/null 2>&1; then
  exec {LOCK_FD}>"$LOCK_FILE"
  # 先非阻塞探测一次：锁空闲立即持有；被占用则打印提示后阻塞排队（串行部署）
  flock -n "$LOCK_FD" || { log "等待部署锁（其他 Agent 部署进行中，自动排队）..."; flock "$LOCK_FD"; log "已获得部署锁"; }
  cleanup() {
    # 清理构建残留（docker build 中途失败时 TMPCTX 会残留）
    [[ -n "${TMPCTX:-}" ]] && rm -rf "$TMPCTX"
    # 构建树里的 .env 是密钥副本（位于 /tmp），部署结束即删，不长期留存
    [[ -n "${BUILD_TREE:-}" && -f "${BUILD_TREE:-}/.env" ]] && rm -f "$BUILD_TREE/.env"
    # 回滚用的临时标签用完即清，避免下次部署把 :rollback 当成「上一版镜像」（等于没回滚）
    docker rmi "zhiyu-backend:rollback" "zhiyu-edu:rollback" >/dev/null 2>&1 || true
    exec {LOCK_FD}>&- 2>/dev/null || true
  }
  trap cleanup EXIT
else
  # 多 Agent 并行开发的仓库里没有锁 = 并发部署互相踩构建树/容器/迁移，必须硬失败
  die "flock 不可用，拒绝无锁部署（请安装 util-linux）"
fi

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
    # 探测失败但现有配置已有 mirror → 保留原配置直接返回。
    # 否则网络抖一次就把 daemon.json 写成 {} 并 restart docker，
    # 重启会中断宿主上所有容器（含 Java 栈与其他 Agent 正在构建的容器），
    # 下次探测成功又写回去，形成 64B/2B 交替的备份churn（本机已累积 30+ 份）。
    if [[ -z "$mirrors" ]] && [[ -s "$daemon_file" ]] && \
       python3 -c "import json,sys; sys.exit(0 if json.load(open('$daemon_file')).get('registry-mirrors') else 1)" 2>/dev/null; then
      log "镜像加速探测失败，保留现有 daemon.json（不重启 docker）"
      return 0
    fi
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
  # 备份仅保留最近 3 份（历史上无清理，本机曾累积 34 份）
  find /etc/docker -maxdepth 1 -name 'daemon.json.bak.*' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | tail -n +4 | cut -d' ' -f2- | xargs -r rm -f || true
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
# 校验存在且版本匹配（GO_VERSION）：已装旧版本（如 offline 曾提供 1.23.7）而 go.mod 要求
# 1.25.0 时，只查 command -v 会跳过安装，导致 go build 自动下载 toolchain 在无网环境失败
GO_VERSION="${GO_VERSION:-1.25.0}"
if ! { command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qF "go${GO_VERSION}"; }; then
  is_root || die "需要 root 安装 Go"
  log "安装 Go..."
  ARCH=$(uname -m); [[ "$ARCH" == "x86_64" ]] && ARCH="amd64"; [[ "$ARCH" == "aarch64" ]] && ARCH="arm64"
  GO_VERSION="${GO_VERSION:-1.25.0}"
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
# pnpm 版本与仓库 packageManager（pnpm-lock.yaml lockfileVersion 9.0）对齐，
# 避免新版 pnpm 报 ERR_PNPM_LOCKFILE_BREAKING_CHANGE 并降级 --no-frozen-lockfile 重写 lockfile
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"
ensure_pnpm() {
  local current
  current=$(command -v pnpm >/dev/null 2>&1 && pnpm --version 2>/dev/null || true)
  if [[ "$current" == "$PNPM_VERSION" ]]; then
    return 0
  fi
  if [[ -n "$current" ]]; then
    warn "pnpm 版本不匹配（当前 ${current}，需要 ${PNPM_VERSION}），安装指定版本..."
  fi
  local local_pnpm_tgz=""
  for f in "$OFFLINE_DIR"/pnpm-${PNPM_VERSION}.tgz; do
    [[ -f "$f" ]] && { local_pnpm_tgz="$f"; break; }
  done
  if [[ -n "$local_pnpm_tgz" ]]; then
    log "  使用本地 pnpm 安装包: $local_pnpm_tgz"
    npm install -g "$local_pnpm_tgz" 2>/dev/null || die "本地 pnpm 安装失败"
  else
    if ls "$OFFLINE_DIR"/pnpm-*.tgz >/dev/null 2>&1; then
      warn "offline 中存在 pnpm 离线包但与所需版本 ${PNPM_VERSION} 不匹配，尝试联网安装"
    fi
    npm install -g "pnpm@${PNPM_VERSION}" 2>/dev/null || corepack enable pnpm 2>/dev/null || true
  fi
  current=$(pnpm --version 2>/dev/null || true)
  [[ "$current" == "$PNPM_VERSION" ]] || warn "pnpm 版本校验未通过（当前 ${current}），请人工确认 pnpm --version"
}
ensure_pnpm

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
    ai_secret=$(rand_str 64)
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://zhiyu_saas:${db_pass}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/zhiyu-saas?sslmode=disable|" "$ENV_FILE"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$ENV_FILE"
    sed -i "s|^AI_CONFIG_SECRET=.*|AI_CONFIG_SECRET=${ai_secret}|" "$ENV_FILE"
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${db_pass}|" "$ENV_FILE"
    # 写入部署相关默认值，便于用户后续修改
    {
      echo ""
      echo "# 部署配置（由 deploy.sh 首次生成）"
      echo "GO_VERSION=${GO_VERSION:-1.25.0}"
      echo "PNPM_VERSION=${PNPM_VERSION:-9.15.9}"
      echo "NGINX_SERVER_NAME=${NGINX_SERVER_NAME:-_}"
      echo "NGINX_DEFAULT_SERVER=${NGINX_DEFAULT_SERVER:-default_server}"
      echo "NGINX_PORT=${NGINX_PORT:-80}"
      echo "NGINX_SSL_DOMAIN=${NGINX_SSL_DOMAIN:-}"
      echo "NGINX_SSL_CERT=${NGINX_SSL_CERT:-}"
      echo "NGINX_SSL_CERT_KEY=${NGINX_SSL_CERT_KEY:-}"
      echo "BACKEND_PORT=${BACKEND_PORT:-8080}"
      echo "EDU_PORT=${EDU_PORT:-3020}"
      echo "GO_NGINX_PORT=${GO_NGINX_PORT:-8084}"
      echo "POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT:-5433}"
      echo "KKFILEVIEW_HOST_PORT=${KKFILEVIEW_HOST_PORT:-8012}"
      echo "ENABLE_KKFILEVIEW=${ENABLE_KKFILEVIEW:-true}"
      echo "KKFILEVIEW_IMAGE=${KKFILEVIEW_IMAGE:-fangzhengjin/kkfileview:4.4.0}"
      echo "KK_MEDIA_CONVERT_DISABLE=${KK_MEDIA_CONVERT_DISABLE:-true}"  # true：允许远程视频(mov/avi/mkv 等)转码预览，false 会拒绝
      echo "KK_BASE_URL=${KK_BASE_URL:-}"  # deploy.sh 会根据 nginx 配置自动推导
      echo "VITE_SITE_URL=${VITE_SITE_URL:-}"  # 移动端访问二维码站点地址，deploy.sh 会根据 nginx 配置自动推导
      echo "DOCKER_REGISTRY_MIRRORS=${DOCKER_REGISTRY_MIRRORS:-}"
      echo "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-admin123}"
      echo "GO_CACHE_LIMIT_MB=${GO_CACHE_LIMIT_MB:-8192}"
      echo "BUILD_CACHE_LIMIT_GB=${BUILD_CACHE_LIMIT_GB:-10}"
    } >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "已生成 .env（权限 600；管理员账号 admin，密码见其中 SEED_ADMIN_PASSWORD）"
  fi
fi
# 无条件收紧 .env 权限：含 DATABASE_URL 口令 / JWT_SECRET / AI_CONFIG_SECRET，
# 历史遗留或人工编辑过的 .env 可能是 0644（全局可读），仅在首次生成分支里 chmod 600 不够。
chmod 600 "$ENV_FILE" 2>/dev/null || true
set -a; source "$ENV_FILE"; set +a

# 旧 .env 若未配置 ENABLE_KKFILEVIEW，默认启用（预览功能依赖 kkFileView）
if ! grep -q "^ENABLE_KKFILEVIEW=" "$ENV_FILE" 2>/dev/null; then
  update_env_var "$ENV_FILE" "ENABLE_KKFILEVIEW" "true"
  ENABLE_KKFILEVIEW=true
fi

# 旧 .env 若未配置 KK_MEDIA_CONVERT_DISABLE，补写默认 true：
# fangzhengjin/kkfileview 镜像在 media.convert.disable=false（镜像默认值）时，
# 会直接拒绝远程 http(s) 的 mov/avi/mkv 等 MEDIACONVERT 类型文件，
# 预览返回"系统还不支持该格式文件的在线预览"；true 才允许 ffmpeg 转码预览。
if ! grep -q "^KK_MEDIA_CONVERT_DISABLE=" "$ENV_FILE" 2>/dev/null; then
  update_env_var "$ENV_FILE" "KK_MEDIA_CONVERT_DISABLE" "true"
  KK_MEDIA_CONVERT_DISABLE=true
fi

# 旧 .env 若未配置 AI_CONFIG_SECRET（租户 AI API Key 独立加密密钥），补写随机值。
# 后端 config.Load 强制校验该变量（禁止回落 JWT_SECRET），旧 .env 缺失或留空都会导致
# migrate/seed/server 启动失败并触发部署回滚；存量密文仍由后端用 JWT_SECRET 兜底解密。
if ! grep -q "^AI_CONFIG_SECRET=..*" "$ENV_FILE" 2>/dev/null; then
  AI_CONFIG_SECRET=$(rand_str 64)
  update_env_var "$ENV_FILE" "AI_CONFIG_SECRET" "$AI_CONFIG_SECRET"
  log "旧 .env 已补写 AI_CONFIG_SECRET"
fi
export AI_CONFIG_SECRET

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
# BACKEND_PORT / EDU_PORT 不再做宿主端口探测：backend/frontend 容器已不发布宿主端口
# （deploy/docker-compose.yml 明说），网关容器里是容器名直连 zhiyu-backend:8080 / zhiyu-edu:3020。
# 继续探测只会在宿主 8080 被占用时把 .env 改成 8081，制造「配置说 8081、实际跑 8080」的假象。
BACKEND_PORT="${BACKEND_PORT:-8080}"
EDU_PORT="${EDU_PORT:-3020}"
GO_NGINX_PORT=$(resolve_port "GO_NGINX_PORT" "${GO_NGINX_PORT:-8084}" "8085")
POSTGRES_HOST_PORT=$(resolve_port "POSTGRES_HOST_PORT" "${POSTGRES_HOST_PORT:-5433}" "5434")
KKFILEVIEW_HOST_PORT=$(resolve_port "KKFILEVIEW_HOST_PORT" "${KKFILEVIEW_HOST_PORT:-8012}" "8013")

update_env_var "$ENV_FILE" "NGINX_PORT" "$NGINX_PORT"
update_env_var "$ENV_FILE" "BACKEND_PORT" "$BACKEND_PORT"
update_env_var "$ENV_FILE" "EDU_PORT" "$EDU_PORT"
update_env_var "$ENV_FILE" "GO_NGINX_PORT" "$GO_NGINX_PORT"
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

# 移动端访问二维码站点地址：未手动设置时，根据 nginx 配置自动推导协议、域名和端口
if [[ -z "${VITE_SITE_URL:-}" ]]; then
  site_scheme="http"
  site_host=""
  if [[ -n "${NGINX_SSL_DOMAIN:-}" ]]; then
    site_scheme="https"
    site_host="$NGINX_SSL_DOMAIN"
  else
    # 从现有 https 配置（含手动维护的 ssl conf）中提取域名
    # 部分服务器可能只有其中一份 conf，grep 遇到缺失文件退出码为 2，
    # 在 set -euo pipefail 下会导致整个部署中断，这里用 || true 容错
    site_host=$(grep -h "server_name" /etc/nginx/conf.d/zhiyu-saas-ssl.conf /etc/nginx/conf.d/ai-zhiyu-https.conf 2>/dev/null | sed 's/.*server_name[[:space:]]*//; s/[[:space:]]*;.*//' | grep -v "^_" | awk '{print $1}' | head -1) || true
    if [[ -n "$site_host" ]]; then
      site_scheme="https"
    elif [[ -n "${NGINX_SERVER_NAME:-}" && "${NGINX_SERVER_NAME:-_}" != "_" ]]; then
      site_host="$NGINX_SERVER_NAME"
    fi
  fi
  site_port=""
  if [[ "$site_scheme" == "http" && "${NGINX_PORT:-80}" != "80" ]]; then
    site_port=":${NGINX_PORT}"
  fi
  # 未推导出域名时留空，前端回退使用当前访问地址（window.location.origin）
  [[ -n "$site_host" ]] && VITE_SITE_URL="${site_scheme}://${site_host}${site_port}"
fi
update_env_var "$ENV_FILE" "VITE_SITE_URL" "$VITE_SITE_URL"

# 生产 https 部署下，外部平台链接若未显式配置会回退到 http 演示地址，
# 浏览器会因混合内容拦截导致跨平台跳转/评分 iframe 静默失效，这里仅告警不阻断。
if [[ "${VITE_SITE_URL:-}" == https://* ]]; then
  for _var in VITE_CAREER_PLATFORM_URL VITE_SCENE_PLATFORM_URL \
             VITE_ALLIANCE_PLATFORM_URL VITE_ABILITY_PLATFORM_URL \
             VITE_COURSE_LEARN_URL VITE_MALL_URL VITE_AI_ASSISTANT_URL; do
    _val=""
    # shellcheck disable=SC2154
    if [[ -n "${!_var:-}" ]]; then
      _val="${!_var}"
    fi
    if [[ -z "$_val" || "$_val" == http://* ]]; then
      warn "生产 https 部署未配置 ${_var}（或其值为 http），跨平台链接将回退到演示地址并可能被浏览器拦截，请在 .env 中显式填 https 地址。"
    fi
  done
fi

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
# 本栈 compose 项目名（取自 compose 文件 name:）：供按 label 精准清理本栈资源，避免误伤其他栈。
# 必须放在 DEPLOY_COMPOSE 赋值之后——放在 compose() 定义处会因 set -u 报 unbound variable。
COMPOSE_PROJECT="$(awk '/^name:[[:space:]]*/{print $2; exit}' "$DEPLOY_COMPOSE" 2>/dev/null || true)"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-zhiyu-saas}"
BUILD_CACHE="$DEPLOY_DIR/.build-cache"
set -a; source "$ENV_FILE"; set +a

# 数据库连接
DB_USER="${DB_USER:-zhiyu_saas}"; DB_NAME="${DB_NAME:-zhiyu-saas}"
DB_PASSWORD=$(url_decode "$(echo "${DATABASE_URL:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')")
DB_PASSWORD="${DB_PASSWORD:-}"
MIGRATE_URL="postgres://${DB_USER}:$(url_encode "$DB_PASSWORD")@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${DB_NAME}?sslmode=disable"
# psql 统一包装：口令走 PGPASSWORD 环境变量，不进 argv（argv 在 ps 里对同机任意用户可见）。
# MIGRATE_URL 仍保留给 go run ./cmd/migrate（经环境变量传递，不落 argv）。
psql_db() { PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${POSTGRES_HOST_PORT:-5433}" -U "$DB_USER" -d "$DB_NAME" "$@"; }
export IMAGE_TAG BACKEND_PORT EDU_PORT GO_NGINX_PORT POSTGRES_HOST_PORT KKFILEVIEW_HOST_PORT NGINX_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET KK_MEDIA_CONVERT_DISABLE

# ── 分支校验 ──
if [[ -n "$BRANCH_NAME" ]]; then
  git -C "$ORIGINAL_ROOT" fetch origin master "$BRANCH_NAME" 2>/dev/null || true
  oc=$(git -C "$ORIGINAL_ROOT" rev-parse "origin/$BRANCH_NAME" 2>/dev/null || true)
  [[ -z "$oc" ]] && die "origin/$BRANCH_NAME 不存在，请先 git push"
  # 仅当本地确实有同名分支时才比对：分支由其他 clone/worktree 推送时本地无该 ref，
  # 原写法会把「本地无引用」当成「与 origin 不一致」而拒绝部署（多 Agent 并行常态）
  if lc=$(git -C "$ORIGINAL_ROOT" rev-parse --verify -q "refs/heads/$BRANCH_NAME"); then
    [[ "$lc" != "$oc" ]] && die "本地 $BRANCH_NAME 与 origin 不一致，请先 git push"
  fi
else
  # 非分支模式：先同步 origin/master 引用，供下方自动同步判定与构建使用
  git -C "$ORIGINAL_ROOT" fetch origin master 2>/dev/null || true
fi

# 非分支自动同步判定：仅在"位于 master 分支且无本地未推送提交"时自动以 origin/master 最新代码
# 在隔离 worktree 中构建。这样本地工作树即使脏（如 pnpm-lock.yaml 被旧版 pnpm 改写、
# public/image-editor 部署产物等）也不影响构建，无需手动清理/拉取。
# 回滚部署（git checkout <tag> 后处于 detached HEAD）或处于其他分支时，
# 保持原有"基于本地当前 HEAD 构建"的行为，保证回滚语义不变。
SYNC_MASTER=false
if [[ -z "$BRANCH_NAME" ]] && [[ "$ORIGINAL_ROOT" == "$PROJECT_ROOT" ]] && \
   git -C "$ORIGINAL_ROOT" rev-parse --verify -q origin/master >/dev/null 2>&1 && \
   [[ "$(git -C "$ORIGINAL_ROOT" symbolic-ref -q HEAD 2>/dev/null)" == "refs/heads/master" ]] && \
   [[ -z "$(git -C "$ORIGINAL_ROOT" rev-list origin/master..HEAD 2>/dev/null)" ]]; then
  SYNC_MASTER=true
  log "处于 master 分支且无未推送提交，自动同步并部署 origin/master 最新代码"
fi

# 部署锁已在「检查系统依赖」之前获取（见脚本上方），此处不再重复加锁。

# 持锁后重新拉取 origin/master：锁等待期间可能有其他 Agent 已完成部署并合并推送，
# 必须基于全量最新 master 构建（后部署者自动继承先部署者已合并的代码），
# 否则基于旧 master 构建会覆盖先部署者已上线的代码。
# 分支自身的 origin/$BRANCH_NAME 在加锁前已校验同步（自有分支，他人不会改动），无需重复拉取。
git -C "$ORIGINAL_ROOT" fetch origin master 2>/dev/null || warn "重新拉取 origin/master 失败，将基于先前拉取的引用构建"

# 镜像标签：分支部署时用分支提交（构建的正是这份代码），否则用当前 HEAD。
# 标签即构建源码的 commit hash，部署后一眼可确认镜像内容，无需再进容器核对。
# 必须在持锁并重新拉取之后计算，确保标签与本次实际构建基座一致。
if [[ -n "$BRANCH_NAME" ]]; then
  IMAGE_TAG="$(git -C "$ORIGINAL_ROOT" rev-parse --short "origin/$BRANCH_NAME" 2>/dev/null || echo "latest")"
elif [[ "$SYNC_MASTER" == "true" ]]; then
  IMAGE_TAG="$(git -C "$ORIGINAL_ROOT" rev-parse --short origin/master 2>/dev/null || echo "latest")"
else
  IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "latest")"
fi

# 将 IMAGE_TAG 写回 .env，确保 docker compose 能读取到实际镜像标签
if grep -q "^IMAGE_TAG=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "$ENV_FILE"
else
  echo "IMAGE_TAG=${IMAGE_TAG}" >> "$ENV_FILE"
fi

# ════════════════════════════════════════════
# 3. 分支 worktree
# ════════════════════════════════════════════
BUILD_ROOT="$PROJECT_ROOT"
if [[ -n "$BRANCH_NAME" || "$SYNC_MASTER" == "true" ]]; then
  BUILD_TREE="/tmp/zhiyu-build-cache"
  if [[ -n "$BRANCH_NAME" ]]; then
    log "构建分支: $BRANCH_NAME"
  else
    log "构建 origin/master 最新代码（隔离 worktree，不触碰本地工作区）"
  fi

  [[ "$CLEAN_BUILD" == "true" ]] && { git -C "$ORIGINAL_ROOT" worktree remove --force "$BUILD_TREE" 2>/dev/null || true; rm -rf "$BUILD_TREE"; }

  if [[ -e "$BUILD_TREE/.git" ]]; then
    # 失败不能吞：否则会在残留的旧 HEAD 上继续构建，却宣称部署了目标分支/最新 master
    git -C "$BUILD_TREE" checkout --detach --force origin/master 2>/dev/null \
      || die "构建 worktree 切换到 origin/master 失败（可用 --clean 重建 $BUILD_TREE）"
  else
    [[ -d "$BUILD_TREE" ]] && rm -rf "$BUILD_TREE"
    # 清理失效的 worktree 注册（目录被手动删除但 .git/worktrees 仍登记时 add 会报
    # "missing but already registered worktree"），保证全新/被清理服务器可重建
    git -C "$ORIGINAL_ROOT" worktree prune 2>/dev/null || true
    git -C "$ORIGINAL_ROOT" worktree add --detach "$BUILD_TREE" origin/master || die "无法创建 worktree"
  fi

  # 保留 frontend/edu/dist 以复用 Vite 增量产物；仅清理后端编译产物
  rm -rf "$BUILD_TREE/backend/go/bin" 2>/dev/null || true
  if [[ -n "$BRANCH_NAME" ]]; then
    # merge --abort 必须带 || true：merge 因本地改动被拒（尚未开始合并）时它会失败，
    # 在 { } 里失败会让 errexit 抢先退出，die 的提示根本打不出来
    git -C "$BUILD_TREE" merge "origin/$BRANCH_NAME" --no-edit \
      || { git -C "$BUILD_TREE" merge --abort 2>/dev/null || true; die "合并冲突，请先把 $BRANCH_NAME rebase 到最新 master"; }
  fi
  # 构建树在 /tmp（世界可读目录），密钥文件必须 600，故用 install -m 而非裸 cp
  [[ -f "$ORIGINAL_ROOT/.env" ]] && install -m 600 "$ORIGINAL_ROOT/.env" "$BUILD_TREE/.env"
  BUILD_ROOT="$BUILD_TREE"
fi

BACKEND_DIR="$BUILD_ROOT/backend/go"
EDU_DIR="$BUILD_ROOT/frontend/edu"

# 优先使用 vendor/ 目录（如果存在），否则用 GOPROXY 下载
if [[ -d "$BACKEND_DIR/vendor" ]]; then
  export GOPROXY="${GOPROXY:-off}"
else
  export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
fi

# 注意：不再创建 $DEPLOY_DIR/{logs,.rollback}——全脚本从无写入，空目录只会误导排障
mkdir -p "$DEPLOY_DIR" "$DEPLOY_DIR/backups" "$DEPLOY_DIR/data/uploads" "$BUILD_CACHE"

# 记录当前镜像（用于回滚）
PREV_BACKEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-backend 2>/dev/null || true)"
PREV_FRONTEND="$(docker inspect --format='{{.Config.Image}}' zhiyu-edu 2>/dev/null || true)"

# 部署失败统一回滚：compose up / 迁移 / 健康检查任一环节失败均回到旧镜像。
# 与旧版"tag 失败被 || true 吞掉、回滚结果不校验"不同，这里逐步校验：
#   1. 旧镜像 tag 失败（已被清理/不存在）→ 报错退出，不假装回滚成功
#   2. compose up 回滚失败 → 报错退出
#   3. 回滚后重新做健康检查，未就绪也报错退出（不静默通过）
# 首次部署（无旧镜像）→ 直接失败退出，提示人工排查。
rollback_deploy() {
  local reason="$1"
  log "部署失败（${reason}），回滚旧镜像..."
  if [[ -z "$PREV_BACKEND" || -z "$PREV_FRONTEND" ]]; then
    compose logs backend --tail 30 2>/dev/null || true
    die "部署失败，且没有旧镜像可回滚（首次部署），请排查后重试"
  fi
  docker tag "$PREV_BACKEND" "zhiyu-backend:rollback" 2>/dev/null || {
    warn "旧后端镜像 $PREV_BACKEND 已不存在，无法回滚"
    die "回滚失败，请人工排查（旧镜像: $PREV_BACKEND / $PREV_FRONTEND）"
  }
  docker tag "$PREV_FRONTEND" "zhiyu-edu:rollback" 2>/dev/null || {
    warn "旧前端镜像 $PREV_FRONTEND 已不存在，无法回滚"
    die "回滚失败，请人工排查（旧镜像: $PREV_BACKEND / $PREV_FRONTEND）"
  }
  if ! IMAGE_TAG=rollback compose up -d --no-deps backend frontend 2>&1 | tail -5; then
    die "回滚容器启动失败，请人工排查（旧镜像: $PREV_BACKEND / $PREV_FRONTEND）"
  fi
  for svc in backend frontend; do
    found=false
    for _ in $(seq 1 45); do
      S=$(compose ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
      [[ "$S" == "healthy" ]] && { log "  $svc 回滚后 healthy"; found=true; break; }
      sleep 2
    done
    $found || warn "$svc 回滚后未就绪"
  done
  compose logs backend --tail 30 2>/dev/null || true
  # 迁移环节失败时数据库可能处于中间状态（仅 psql 兜底部分应用场景），提示人工恢复路径
  if [[ -s "${BACKUP_FILE:-}" ]]; then
    # 不打印 MIGRATE_URL：内含 DB 口令，会落到部署日志/CI/会话记录
    warn "如需恢复数据库: PGPASSWORD=<见 $ENV_FILE 的 DATABASE_URL> psql -h 127.0.0.1 -p ${POSTGRES_HOST_PORT:-5433} -U ${DB_USER} -d ${DB_NAME} -f \"$BACKUP_FILE\"（请先人工确认库状态）"
  fi
  die "部署失败，已回滚到旧镜像"
}

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
    # spec 硬约束（分层红线/AI 底座/migration 配对/spec 制品/ADR 索引/安全）
    (cd "$BUILD_ROOT" && ./scripts/spec-check.sh) || die "spec-check.sh 硬约束校验失败"
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
  # ip2region 离线数据文件（IP 归属地查询，登录日志地点）
  if [[ -f "$OFFLINE_DIR/ip2region_v4.xdb" ]]; then
    cp "$OFFLINE_DIR/ip2region_v4.xdb" "$TMPCTX/ip2region_v4.xdb"
  else
    die "offline/ip2region_v4.xdb 缺失：请先下载 ip2region v2.2 IPv4 数据文件到 offline/ 目录"
  fi

  # 本地已加载 alpine 镜像时跳过 apk add，避免离线环境联网失败
  DOCKER_BUILD_ARGS=()
  if docker images alpine:3.21 --format ok 2>/dev/null | grep -q ok; then
    DOCKER_BUILD_ARGS+=(--build-arg SKIP_APK_ADD=true)
  fi

  BUILD_LOG="$DEPLOY_DIR/.build-backend.log"
  if ! docker build "${DOCKER_BUILD_ARGS[@]}" -t "zhiyu-backend:$IMAGE_TAG" -f "$TMPCTX/Dockerfile" "$TMPCTX" >"$BUILD_LOG" 2>&1; then
    tail -n 40 "$BUILD_LOG" >&2 || true
    die "后端镜像构建失败（完整日志: $BUILD_LOG）"
  fi
  tail -n 5 "$BUILD_LOG"
  docker tag "zhiyu-backend:$IMAGE_TAG" "zhiyu-backend:$BACKEND_HASH"
  rm -rf "$TMPCTX"
  # 指纹延后落盘（见部署末尾）：提前写会让被中断的部署在下次运行时误判「无变更跳过构建」
  PENDING_BACKEND_HASH="$BACKEND_HASH"
else
  log "后端: 无变更，跳过"
  # 当前 commit 标签也要指向同一镜像，compose 才能正常拉起
  # 失败不能吞：hash 镜像被并发清理后 compose 会去 registry 拉不存在的 tag，最终走回滚
  docker tag "zhiyu-backend:$BACKEND_HASH" "zhiyu-backend:$IMAGE_TAG" 2>/dev/null \
    || die "标记后端镜像失败：zhiyu-backend:$BACKEND_HASH 不存在（可用 --clean 强制重建）"
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
    # 离线依赖包：offline/node_modules.tar.gz（联网机按 offline/README.md 预生成，~370MB）。
    # 命中则直接解压到构建树，跳过 pnpm install——完全离线、无需 npm registry / pnpm store。
    OFFLINE_NODE_MODULES="$OFFLINE_DIR/node_modules.tar.gz"
    if [[ -f "$OFFLINE_NODE_MODULES" ]]; then
      log "  离线依赖包命中，解压 node_modules（跳过 pnpm install）..."
      rm -rf "$BUILD_ROOT/node_modules"
      tar -xzf "$OFFLINE_NODE_MODULES" -C "$BUILD_ROOT" || die "解压 offline/node_modules.tar.gz 失败"
    else
      log "  安装依赖..."
      # 先试离线安装（需要 node_modules 或 pnpm store 已就绪）
      # 第三档 --no-frozen-lockfile 会改写 lockfile → 构建出与 CI 不同的依赖树，必须显式告警
      (cd "$BUILD_ROOT" && pnpm install --offline --frozen-lockfile 2>/dev/null) || \
      (cd "$BUILD_ROOT" && pnpm install --frozen-lockfile 2>/dev/null) || \
      { warn "frozen-lockfile 安装失败，降级 --no-frozen-lockfile（会改写 lockfile）"
        (cd "$BUILD_ROOT" && pnpm install --no-frozen-lockfile) || die "pnpm install 失败"
        if ! git -C "$BUILD_ROOT" diff --quiet -- pnpm-lock.yaml 2>/dev/null; then
          warn "  lockfile 已被改写，与仓库不一致（CI 依赖树可能不同）："
          git -C "$BUILD_ROOT" diff --stat -- pnpm-lock.yaml 2>/dev/null | tail -3 || true
        fi
      }
    fi
    echo "$LOCK_HASH" > "$BUILD_CACHE/lock-hash"
  fi

  if [[ "$GATES_FLAG" == "true" ]]; then
    log "  质量门禁: pnpm typecheck / pnpm lint / pnpm test"
    (cd "$BUILD_ROOT" && pnpm typecheck) || die "pnpm typecheck 失败"
    (cd "$BUILD_ROOT" && pnpm lint) || die "pnpm lint 失败"
    # vitest 单测与 AGENTS.md「二、交付要求」本地检查清单对齐（此前缺跑，仅 CI 覆盖）
    (cd "$BUILD_ROOT" && pnpm test) || die "pnpm test 失败"
  else
    log "  质量门禁已跳过（GitHub Actions 已覆盖，--gates 可手动开启）"
  fi

  [[ "$CLEAN_BUILD" == "true" ]] && rm -rf "$EDU_DIR/dist"

  # 离线图片编辑器资产：从 offline/image-editor 同步到前端 public（完全离线，不依赖 CDN）
  # public/image-editor 在仓库中是符号链接（指向仓库 offline/image-editor），
  # 但拷贝部署的服务器上可能被解引用成真实目录，rm -rf 两种情况都能删，这里统一替换为真实文件，
  # 保证 vite build 时是实际文件而非断链。
  if [[ -d "$BUILD_ROOT/offline/image-editor" ]]; then
    log "  同步离线图片编辑器资产..."
    # 只在它是符号链接时删除（仓库里是链接，vite build 需要实体文件）；
    # 已是实体目录则交给 rsync --delete 增量同步（17MB/687 文件，避免每次全量重拷）
    [[ -L "$EDU_DIR/public/image-editor" ]] && rm -f "$EDU_DIR/public/image-editor"
    mkdir -p "$EDU_DIR/public/image-editor"
    rsync -a --delete "$BUILD_ROOT/offline/image-editor/" "$EDU_DIR/public/image-editor/"
  fi

  # Vite 纯静态 SPA：build 产出 dist/（index.html + 构建资产 + public 静态资源），
  # 由 nginx 容器托管；API 走边缘 nginx 反代，容器内无需代理（原 Next rewrites 已废弃）。
  # 内存说明：该应用 Vite build 未限堆时峰值 anon-rss 达 3.1~3.4GB。两层保护：
  # ① systemd-run 瞬态单元绕开父 cgroup（dsh-web.service 4GB）钳制，
  #    必须加 --slice=system.slice 才能逃出父 cgroup，且必须 --wait（否则立即返回、dist 未就绪就进 docker build）；
  # ② cgroup 上限压到整机（7.9GB）以下：原 MemoryMax=8G 大于物理内存，限额永不触发，
  #    只能由内核 global OOM 随机挑受害者（实测杀过 dsh-web.service）。设 6G 后超限只杀构建本身。
  #    切勿设 MemoryHigh≈峰值（曾设 3500M）：V8 老生代由 frontend/edu/package.json 的
  #    --max-old-space-size=3072 决定，峰值 RSS 约 3.5G，MemoryHigh 一压就疯狂回收，
  #    加上 vm.swappiness=0 无处可换，实测从 65 秒退化成 23 分钟后 oom-kill。
  #    要调堆请改 frontend/edu/package.json 的 --max-old-space-size（脚本里的 NODE_OPTIONS 会被它覆盖）。
  # ③ systemd-run 起的是 transient service（PID1 拉起），**不继承本脚本环境**，
  #    因此 .env 里的 VITE_* 必须显式 --setenv 传入，否则 Vite 读不到（Vite 的 envDir 是
  #    frontend/edu，也读不到仓库根 .env）→ 产物静默退化：移动端二维码回落 window.location.origin、
  #    跨平台链接回落演示地址，且脚本还在警告"请在 .env 填 https 地址"（配了也不生效）。
  # 注意：此处在顶层 if 块内（非函数），不能用 local
  FE_LOG="$DEPLOY_DIR/.build-frontend-pnpm.log"
  if command -v systemd-run >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    # 把 .env 中所有 VITE_* 透传进构建单元（值可能含空格，用数组避免二次分词）
    VITE_SETENV=()
    while IFS= read -r kv; do
      [[ -n "$kv" ]] && VITE_SETENV+=(--setenv="$kv")
    done < <(grep -E '^VITE_[A-Za-z0-9_]+=' "$ENV_FILE" 2>/dev/null || true)
    log "  透传 ${#VITE_SETENV[@]} 个 VITE_* 变量到构建单元"
    # --pipe：不加则构建输出只进 journal，日志文件里只有 systemd 状态行（历史上 die 提示指向空日志）
    if ! systemd-run --collect --wait --pipe --slice=system.slice \
         --property=MemoryAccounting=yes \
         --property=MemoryMax=6G --property=MemorySwapMax=2G \
         --setenv=NODE_ENV=production \
         "${VITE_SETENV[@]}" -- bash -c "cd '$BUILD_ROOT' && pnpm --filter @zhiyu/edu build" \
         >"$FE_LOG" 2>&1; then
      rc=$?
      tail -n 40 "$FE_LOG" >&2 || true
      [[ $rc -eq 137 || $rc -eq 143 ]] && \
        warn "疑似内存超限（退出码 $rc）：错峰构建，或调小 frontend/edu/package.json 的 --max-old-space-size"
      die "前端构建失败（完整日志: $FE_LOG）"
    fi
  else
    # 直连回退路径：本脚本已 set -a source .env，VITE_* 已在环境中，无需额外透传
    (cd "$BUILD_ROOT" && NODE_ENV=production \
      pnpm --filter @zhiyu/edu build) || die "前端构建失败"
  fi

  BUILD_LOG="$DEPLOY_DIR/.build-frontend.log"
  # docker build 失败时先把日志尾巴打出来，否则 set -e 直接退出、终端上看不到任何原因
  docker build -t "zhiyu-edu:$IMAGE_TAG" -f "$EDU_DIR/Dockerfile" "$EDU_DIR" >"$BUILD_LOG" 2>&1 || {
    tail -n 30 "$BUILD_LOG" >&2 || true
    die "前端镜像构建失败（日志: $BUILD_LOG）"
  }
  tail -n 5 "$BUILD_LOG"
  docker tag "zhiyu-edu:$IMAGE_TAG" "zhiyu-edu:$FRONTEND_HASH"
  PENDING_FRONTEND_HASH="$FRONTEND_HASH"
else
  log "前端: 无变更，跳过"
  docker tag "zhiyu-edu:$FRONTEND_HASH" "zhiyu-edu:$IMAGE_TAG" 2>/dev/null \
    || die "标记前端镜像失败：zhiyu-edu:$FRONTEND_HASH 不存在（可用 --clean 强制重建）"
fi

# ════════════════════════════════════════════
# 6. Docker 部署
# ════════════════════════════════════════════
log "部署到 Docker"

cp "$BUILD_ROOT/deploy/docker-compose.yml" "$DEPLOY_COMPOSE"
# 复制服务网关 nginx 容器配置（compose 中以相对路径 ./nginx-container/conf.d 挂载）
mkdir -p "$DEPLOY_DIR/nginx-container"
rsync -a --delete "$BUILD_ROOT/deploy/nginx-container/" "$DEPLOY_DIR/nginx-container/"
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
# 分两段启动（顺序即契约，见 docs/spec/03-development-plan.md「部署与回滚」）：
#   第一段只起数据层 postgres/redis → 备份 + 迁移 → 第二段才起业务容器。
# 原来一次性 up 全部：新版本 backend 会在「旧 schema」上对外服务数十秒（500 或写坏数据），
# 而且备份是在新代码已经写过库之后取的，回滚时参考点不干净。
if ! compose up -d postgres redis >"$COMPOSE_UP_LOG" 2>&1; then
  echo "docker compose up（数据层）失败日志：" >&2
  tail -n 50 "$COMPOSE_UP_LOG" >&2 || true
  rollback_deploy "docker compose up 数据层失败"
fi
tail -n 3 "$COMPOSE_UP_LOG"

# 等待 PG
for _ in $(seq 1 30); do
  compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done

# 数据库迁移
log "数据库迁移..."
for _ in $(seq 1 15); do psql_db -c "SELECT 1" >/dev/null 2>&1 && break; sleep 1; done

# 迁移前备份（失败仅警告，不阻断部署）
BACKUP_FILE="$DEPLOY_DIR/backups/zhiyu-saas-$(date +%Y%m%d-%H%M%S).sql"
# 全库明文 dump（含用户表/密码 hash/租户数据）：目录 700 + 文件 600，默认 755/644 不可接受
chmod 700 "$DEPLOY_DIR/backups" 2>/dev/null || true
( umask 077; compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null ) \
  || { warn "数据库备份失败，已跳过"; rm -f "$BACKUP_FILE"; }
# 备份仅保留最近 7 份，避免每次部署累积旧备份占用磁盘。
# 不能用 `ls glob | tail`：无匹配时 ls 退出码 2，配合 pipefail + set -e 会让部署静默中止
# （全新服务器首次部署、备份失败后 backups 为空时必现）。
find "$DEPLOY_DIR/backups" -maxdepth 1 -name 'zhiyu-saas-*.sql' -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f || true

if [[ ! -f "$DEPLOY_DIR/.migration-done" ]]; then
  psql_db -c "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" 2>/dev/null || true
  # 必须 ON_ERROR_STOP + 单事务：psql 默认遇错继续且退出码为 0，
  # 否则 baseline 半途失败也会被判成功并写入 schema_migrations/.migration-done，
  # 此后所有部署都跳过 baseline，只能人工修库。
  psql_db -v ON_ERROR_STOP=1 --single-transaction \
    -f "$BACKEND_DIR/migrations/001_baseline.up.sql" 2>&1 | tail -3 \
    || rollback_deploy "baseline 迁移失败（已整体回滚事务）"
  psql_db -c "INSERT INTO schema_migrations (version) VALUES ('001_baseline') ON CONFLICT DO NOTHING;" 2>/dev/null || true

  # baseline 之后补齐后续增量迁移（migrate 自动跳过 schema_migrations 已记录版本）
  run_migrations "$BACKEND_DIR" "$MIGRATE_URL" || rollback_deploy "数据库迁移失败"
  # marker 落在「baseline + 增量迁移都成功」之后：提前 touch 会让被 OOM/SIGKILL 打断的部署
  # 在下次运行时跳过 baseline
  touch "$DEPLOY_DIR/.migration-done"

  log "初始化种子数据..."
  (cd "$BACKEND_DIR" && GOCACHE="${BUILD_CACHE:-/tmp}/go-cache" \
    DATABASE_URL="$MIGRATE_URL" SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-admin123}" \
    go run ./cmd/seed/main.go) || warn "种子初始化失败"
  # 不回显密码（AGENTS.md 3.2：密钥禁止落日志）
  log "  运营方租户: platform / 管理员: admin（密码见 .env 的 SEED_ADMIN_PASSWORD）"
else
  run_migrations "$BACKEND_DIR" "$MIGRATE_URL" || rollback_deploy "数据库迁移失败"
fi

# 第二段：schema 已就绪，再拉起业务容器（backend/frontend/nginx/kkfileview）
log "数据层与迁移完成，启动业务容器..."
if ! compose up -d --remove-orphans >>"$COMPOSE_UP_LOG" 2>&1; then
  echo "docker compose up（业务容器）失败日志：" >&2
  tail -n 50 "$COMPOSE_UP_LOG" >&2 || true
  rollback_deploy "docker compose up 业务容器失败"
fi
tail -n 5 "$COMPOSE_UP_LOG"

# 健康检查
log "等待服务就绪..."
OK=true
for svc in backend frontend nginx; do
  found=false
  for _ in $(seq 1 45); do
    S=$(compose ps "$svc" --format '{{.Health}}' 2>/dev/null || echo "starting")
    [[ "$S" == "healthy" ]] && { log "  $svc healthy"; found=true; break; }
    STATUS=$(compose ps "$svc" --format '{{.Status}}' 2>/dev/null || echo "")
    # 兜底仅适用于「确实没有 healthcheck」的服务（Health 为空且状态不含 health 字样）：
    # 否则 "Up 3s (health: starting)" 与 "Up 30s (unhealthy)" 都匹配 Up*，
    # 带 healthcheck 的 backend/frontend 未健康就被判就绪 → 坏版本会被当成功并合入 master。
    if [[ -z "$S" && "$STATUS" == Up* && "$STATUS" != *health* ]]; then
      log "  $svc running（无 healthcheck，视为就绪）"; found=true; break
    fi
    sleep 2
  done
  $found || { warn "$svc 未就绪（$(compose ps "$svc" --format '{{.Status}}' 2>/dev/null)）"; OK=false; }
done

if ! $OK; then
  rollback_deploy "健康检查未通过"
fi

# backend/frontend 容器重建后 IP 可能变化，而 zhiyu-nginx 网关在启动时缓存了其旧 IP，
# 会导致转发到旧 IP 产生 502（Nginx hostname 解析缓存问题）。必须在服务「已就绪」之后
# 再重启网关容器，让它重新解析到最新 IP（过早重启会拿到旧 IP / DNS 尚未传播，仍 502）。
# 注意：即使「无变更跳过构建」，只要 IMAGE_TAG 变化（分支部署每次 commit 都不同），
# compose up 仍会重建容器导致 IP 变化，故网关重启必须无条件执行，不能以「是否构建」为条件。
log "服务就绪后重启服务网关容器以刷新上游 IP 解析..."
for attempt in 1 2; do
  # 留出 Docker 内置 DNS 传播时间，避免重启瞬间仍解析到旧 IP
  sleep 3
  docker restart zhiyu-nginx >/dev/null 2>&1 || warn "重启 zhiyu-nginx 失败（可能尚未创建，忽略）"
  sleep 2
  if curl -sf --max-time 5 "http://127.0.0.1:${GO_NGINX_PORT:-8084}/" >/dev/null 2>&1; then
    log "  网关上游 IP 解析已刷新（前端 200）"
    break
  fi
  warn "  网关自检未通过（第 ${attempt} 次），重试重启 zhiyu-nginx..."
  # 两次都失败即认定部署未成功：否则站点 502 仍会被判成功并自动合并 master
  [[ "$attempt" == "2" ]] && rollback_deploy "服务网关自检未通过（前端经 zhiyu-nginx 不可访问）"
done

# ── 部署后业务冒烟 ──
# 只验「容器 healthy + 首页 200」不足以证明系统可用（历史上没有任何业务链路校验）。
# 这里用四个不需要账号口令、也不受登录验证码影响的探针，覆盖：
#   静态产物 → 后端存活 → API+Redis（验证码生成）→ DB 读（主题配置）→ 鉴权中间件（未带 token 必须 401）
# 全部通过才算部署成功；任一失败即回滚，避免把 502/白屏/鉴权失效的版本合并进 master。
smoke_test() {
  local base rc=0
  # 优先走生产入口（宿主 nginx，覆盖完整链路），不可用时退到网关容器端口
  if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:${NGINX_PORT:-80}/portal/login"; then
    base="http://127.0.0.1:${NGINX_PORT:-80}"
  else
    base="http://127.0.0.1:${GO_NGINX_PORT:-8084}"
  fi
  log "  冒烟基址: $base"

  check() {
    local path="$1" want="$2" desc="$3" code
    code=$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' "$base$path" || echo 000)
    if [[ "$code" == "$want" ]]; then
      log "    ✓ $desc（$path → $code）"
    else
      warn "    ✗ $desc（$path 期望 $want，实际 $code）"
      rc=1
    fi
  }

  check "/portal/login"          200 "前端 SPA 产物"
  check "/health"                200 "后端存活"
  check "/api/v1/auth/captcha"   200 "API + Redis（验证码生成）"
  check "/api/v1/settings/theme" 200 "API + DB 读（主题配置）"
  check "/api/v1/tenants"        401 "鉴权中间件生效（未带 token 必须 401）"
  return $rc
}

log "部署后业务冒烟..."
smoke_test || rollback_deploy "业务冒烟未通过（详见上方探针结果）"
log "  业务冒烟通过"

# 等待 kkfileview 就绪（非核心服务，仅避免 nginx 重载到未就绪端口）。
# 首次启动需初始化 LibreOffice 与加载 javacv 转码库，低配机器可能超过 2 分钟，等待上限放宽到 3 分钟。
# 探测用 curl 而非 wget：宿主机 wget 可能被安全策略禁用（Permission denied），curl 为 deploy.sh 必装依赖
if [[ "${ENABLE_KKFILEVIEW:-false}" == "true" ]]; then
  KK_READY=false
  for _ in $(seq 1 90); do
    curl -sf --max-time 10 "http://127.0.0.1:${KKFILEVIEW_HOST_PORT}/kkfileview/onlinePreview" >/dev/null 2>&1 && { log "  kkfileview ready"; KK_READY=true; break; }
    sleep 2
  done
  if ! $KK_READY; then
    warn "kkfileview 180 秒未就绪，文档/视频预览功能可能不可用（可稍后 docker compose logs kkfileview 排查）"
    compose logs kkfileview --tail 30 2>/dev/null | tail -15 || true
  fi
fi

# 健康检查 + 网关自检 + kkfileview 都过了，才把本次构建指纹落盘（提前写会在中断后产生假状态）
{ [[ -n "${PENDING_BACKEND_HASH:-}" ]] && echo "$PENDING_BACKEND_HASH" > "$BUILD_CACHE/backend-hash"; } || true
{ [[ -n "${PENDING_FRONTEND_HASH:-}" ]] && echo "$PENDING_FRONTEND_HASH" > "$BUILD_CACHE/frontend-hash"; } || true

compose ps
if [[ "$CLEAN_BUILD" == "true" ]]; then
  if [[ "$FORCE_FLAG" == "true" ]]; then
    docker builder prune --all --force >/dev/null 2>&1 || true
  else
    warn "--clean 未加 --force，跳过 docker builder prune --all（该操作会清空宿主全局构建缓存）"
  fi
fi

# 每次部署后的磁盘清理：构建缓存超限自动裁剪（保留近期缓存，不拖慢下次构建）。
# buildx 新版参数为 --max-used-space（旧版 --keep-storage 已废弃移除），
# 探测失败再退化为按时间的 --filter until=72h 兜底。
# 阈值可用 BUILD_CACHE_LIMIT_GB 配置（默认 10GB）；缓存未超限时 prune 快速返回，不影响部署速度。
# 先移除已停止容器（compose 重建后旧容器若未及时删除，会拖住其引用的旧镜像/标签清理）。
# 必须限定在本 compose 项目内：裸 `docker ps -aq --filter status=exited` 是全宿主范围，
# 会连带删除 Java 栈与其他项目/其他 Agent 已停止的容器（跨栈误伤）。
EXITED_OWN=$(docker ps -aq --filter status=exited \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT:-zhiyu-saas}" 2>/dev/null || true)
[[ -n "$EXITED_OWN" ]] && docker rm -f $EXITED_OWN >/dev/null 2>&1 || true
BUILD_CACHE_LIMIT="${BUILD_CACHE_LIMIT_GB:-10}GB"
CACHE_BEFORE=$(docker buildx du 2>/dev/null | tail -1 | awk '{print $2}' || true)
if docker builder prune --help 2>/dev/null | grep -q -- '--max-used-space'; then
  docker builder prune -f --max-used-space "$BUILD_CACHE_LIMIT" >/dev/null 2>&1 || warn "构建缓存裁剪失败（--max-used-space）"
elif docker builder prune --help 2>/dev/null | grep -q -- '--keep-storage'; then
  docker builder prune -f --keep-storage "$BUILD_CACHE_LIMIT" >/dev/null 2>&1 || warn "构建缓存裁剪失败（--keep-storage）"
else
  docker builder prune -f --filter until=72h >/dev/null 2>&1 || warn "构建缓存裁剪失败（until=72h）"
fi
# 打印前后用量：原来结果被完全吞掉，本机实测长期停在 12.77GB（阈值 10GB）也无人知晓
CACHE_AFTER=$(docker buildx du 2>/dev/null | tail -1 | awk '{print $2}' || true)
[[ -n "${CACHE_BEFORE:-}" || -n "${CACHE_AFTER:-}" ]] && \
  log "构建缓存: ${CACHE_BEFORE:-?} → ${CACHE_AFTER:-?}（阈值 $BUILD_CACHE_LIMIT）" || true
# 清理悬空镜像（<none>），不影响在用镜像。加 until 过滤：裸 prune 是全宿主范围，
# 会把其他栈（如 Java 栈 zhiyu-java-backend:latest 重建后变悬空的上一版）立刻清掉，
# 导致那些栈失去回滚镜像；只清 24h 前的悬空层，既释放磁盘又保住刚构建的版本。
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true

# 清理过旧的镜像标签，每侧仅保留最新 1 个（当前在用）
prune_old_images "zhiyu-backend" 1
prune_old_images "zhiyu-edu" 1
prune_old_images "fangzhengjin/kkfileview" 1
# 再清理保留镜像上的历史 commit 标签（只留 content-hash 与当前 IMAGE_TAG）
prune_extra_tags "zhiyu-backend" "$BACKEND_HASH"
prune_extra_tags "zhiyu-edu" "$FRONTEND_HASH"

# Go 编译缓存超限（默认 8GB）时整体清理，避免无限增长（下次后端构建全量重编，可接受）。
# 阈值不宜过小：全局 GOCACHE 若与 deploy 共用同一目录（go env -w GOCACHE=...），
# 过小的阈值会在每次部署时连带清空日常开发编译缓存。
GO_CACHE_DIR="$BUILD_CACHE/go-cache"
GO_CACHE_LIMIT="${GO_CACHE_LIMIT_MB:-8192}"
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
  GO_NGINX_PORT="${GO_NGINX_PORT:-8084}"
  KKFILEVIEW_HOST_PORT="${KKFILEVIEW_HOST_PORT:-8012}"
  export NGINX_SERVER_NAME NGINX_DEFAULT_SERVER NGINX_PORT GO_NGINX_PORT KKFILEVIEW_HOST_PORT

  # 生成生产入口配置：先写临时文件，内容一致则跳过（避免每次部署产生完全相同的 .bak），
  # 不一致才备份 + 原子 mv。原写法直接重定向到生产配置：管道任一环失败（envsubst 缺失/磁盘满）
  # 会留下被截断的生产配置，nginx 下次 reload/重启即整站 502。
  NGINX_BAK=""
  NGINX_TS="$(date +%Y%m%d%H%M%S)"
  NGINX_TMP="${NGINX_DST}.new.$$"
  sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_CONF" \
    | envsubst '$NGINX_SERVER_NAME $NGINX_DEFAULT_SERVER $NGINX_PORT $GO_NGINX_PORT $KKFILEVIEW_HOST_PORT' \
    > "$NGINX_TMP" || { rm -f "$NGINX_TMP"; die "生成 nginx 配置失败（原配置未改动）"; }
  [[ -s "$NGINX_TMP" ]] || { rm -f "$NGINX_TMP"; die "生成的 nginx 配置为空（原配置未改动）"; }
  if [[ -f "$NGINX_DST" ]] && cmp -s "$NGINX_TMP" "$NGINX_DST"; then
    rm -f "$NGINX_TMP"
    log "nginx 配置无变化，跳过备份与写入"
  else
    if [[ -f "$NGINX_DST" ]]; then
      NGINX_BAK="$NGINX_DST.bak.$NGINX_TS"
      cp -a "$NGINX_DST" "$NGINX_BAK"
      log "已备份原 nginx 配置: $NGINX_BAK"
      # 备份仅保留最近 5 份（用 find 而非 ls|tail：无匹配时 ls 退出 2 + pipefail 会中止部署）
      find "$(dirname "$NGINX_DST")" -maxdepth 1 -name "$(basename "$NGINX_DST").bak.*" -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | tail -n +6 | cut -d' ' -f2- | xargs -r rm -f || true
    fi
    mv -f "$NGINX_TMP" "$NGINX_DST"
  fi

  # 若配置了 SSL 域名和证书，生成 HTTPS 网关配置
  NGINX_SSL_CONF="$BUILD_ROOT/deploy/nginx/conf.d/zhiyu-saas-ssl.conf"
  NGINX_SSL_DST="/etc/nginx/conf.d/zhiyu-saas-ssl.conf"
  if [[ -f "$NGINX_SSL_CONF" && -n "${NGINX_SSL_DOMAIN:-}" && -n "${NGINX_SSL_CERT:-}" && -n "${NGINX_SSL_CERT_KEY:-}" ]]; then
    if [[ -f "$NGINX_SSL_CERT" && -f "$NGINX_SSL_CERT_KEY" ]]; then
      export NGINX_SSL_DOMAIN NGINX_SSL_CERT NGINX_SSL_CERT_KEY
      sed 's/\${\([A-Z_]*\):-[^}]*}/${\1}/g' "$NGINX_SSL_CONF" | envsubst '$NGINX_SSL_DOMAIN $NGINX_SSL_CERT $NGINX_SSL_CERT_KEY $GO_NGINX_PORT $KKFILEVIEW_HOST_PORT' > "$NGINX_SSL_DST"
      log "已生成 HTTPS nginx 配置: $NGINX_SSL_DST"
    else
      warn "NGINX_SSL_DOMAIN 已设置但证书文件不存在，跳过 HTTPS 配置"
      warn "  cert: $NGINX_SSL_CERT"
      warn "  key:  $NGINX_SSL_CERT_KEY"
    fi
  fi

  if ! nginx -t 2>&1 | tail -20; then
    # 复位到本次备份，避免把坏配置留在生产入口目录（下次 reload/重启会整站 502）
    if [[ -n "$NGINX_BAK" && -f "$NGINX_BAK" ]]; then
      mv -f "$NGINX_BAK" "$NGINX_DST"
      warn "已把 nginx 配置复位到部署前版本"
    fi
    warn "常见原因：${NGINX_PORT} 端口被占用 / 其他 conf 语法冲突（上方为 nginx -t 原始输出）"
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
  # 复用构建 worktree 的合并结果（HEAD = origin/master + BRANCH_NAME）直接推回 origin/master，
  # 不再 checkout/pull 本地 master。本地 master 可能被其他 worktree 检出、或含他人未推送提交，
  # checkout/pull 会失败甚至误带他人工作（多 Agent 并行开发时必现，故合并必须与本地 master 解耦）。
  MERGE_TREE="${BUILD_TREE:-$PROJECT_ROOT}"
  # 推送前重新拉取 origin/master：构建期间可能有其他 Agent 已推进 master，
  # 需以最新 master 为基座，否则 push 会 non-fast-forward。
  git -C "$ORIGINAL_ROOT" fetch origin master 2>/dev/null || true
  if git -C "$MERGE_TREE" push origin "HEAD:refs/heads/master" 2>&1; then
    log "✅ 已合并"
  elif git -C "$MERGE_TREE" merge origin/master --no-edit 2>&1 && \
       git -C "$MERGE_TREE" push origin "HEAD:refs/heads/master" 2>&1; then
    # origin/master 在构建期间被其他 Agent 推进 → 并入最新 master 后重推。
    # 注意：这个合并结果**未经本次构建与健康检查**（线上跑的是合并前的镜像），
    # 因此必须显式提示再跑一次部署，避免 master 与线上长期不一致。
    log "✅ 已合并（并入构建期间他人推进的 master）"
    warn "master 现含未经本次构建验证的合并提交（线上镜像为合并前版本）"
    warn "  建议立即再执行一次 ./deploy.sh 以让线上与 master 对齐"
  else
    git -C "$MERGE_TREE" merge --abort 2>/dev/null || true
    warn "自动合并失败，分支代码已部署但未合并。请人工处理："
    warn "  git fetch origin && git checkout master && git pull origin master --ff-only && git merge origin/$BRANCH_NAME && git push origin master"
  fi
fi

log "✨ 部署完成！"
echo "   外部入口: http://<服务器IP>:${NGINX_PORT}/portal/login"
echo "   nginx 端口: ${NGINX_PORT}"
echo "   服务网关容器: http://localhost:${GO_NGINX_PORT}（zhiyu-nginx，业务容器不暴露宿主端口）"
echo "   管理: admin（密码见部署机 .env 的 SEED_ADMIN_PASSWORD）  (SaaS 登录)"
echo "   镜像: zhiyu-backend:$IMAGE_TAG  zhiyu-edu:$IMAGE_TAG"

# 旧布局上传文件检测：新版 /uploads/{tenantID}/{filename} 要求文件位于租户子目录。
# 若 uploads 卷根目录存在单段文件名（旧布局），提醒执行迁移脚本，否则旧图片全部 404。
# 固定卷名：原 `docker volume ls -q | grep -i upload | head -1` 会在其他栈也有 uploads 卷时指错，
# 从而给出针对别的项目数据的迁移命令
UPLOAD_VOLUME=$(docker volume inspect "${COMPOSE_PROJECT}_uploads_data" --format '{{.Mountpoint}}' 2>/dev/null || true)
if [[ -n "$UPLOAD_VOLUME" ]] && [[ -d "$UPLOAD_VOLUME" ]]; then
  LEGACY_COUNT=$( { find "$UPLOAD_VOLUME" -maxdepth 1 -type f 2>/dev/null | wc -l; } || echo 0 )
  if [[ "$LEGACY_COUNT" -gt 0 ]]; then
    warn "检测到 uploads 卷根目录有 $LEGACY_COUNT 个旧布局文件（未按租户分目录），部署后旧图片将 404！"
    warn "请立即执行文件迁移（宿主环境，脚本会移动文件+回写 DB URL+修正属主）："
    warn "  cd $PROJECT_ROOT"
    warn "  DATABASE_URL=\"\$(grep ^DATABASE_URL $ENV_FILE | cut -d= -f2-)\" UPLOAD_DIR=$UPLOAD_VOLUME ./scripts/migrate_uploads.sh"
  fi
fi
