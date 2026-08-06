#!/usr/bin/env bash
# 从 unlayer CDN 镜像图片编辑器资产到 offline/image-editor（离线包）
# 用法: bash download.sh [版本]  默认 2.2.0
# 说明: 资产清单直接从 editor.js 中提取，保证与编辑器版本严格一致
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VER="${1:-2.2.0}"
BASE="https://cdn.unlayer.com/image-editor"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> 下载 embed.js / editor.js (v$VER)"
curl -sf "$BASE/embed.js" -o "$STAGE/embed.js"
mkdir -p "$STAGE/$VER"
curl -sf "$BASE/$VER/editor.js" -o "$STAGE/$VER/editor.js"

echo "==> 从 editor.js 提取资产清单"
python3 - "$STAGE/$VER/editor.js" > "$STAGE/assets.txt" <<'PY'
import re, sys
s = open(sys.argv[1]).read()
for a in sorted(set(re.findall(r'"((?:images|fonts)/[A-Za-z0-9_./\-]+)"', s))):
    if a.endswith('/'):
        continue  # 路径前缀常量（如 "images/stickers/"），非文件
    print(a)
PY

TOTAL=$(wc -l < "$STAGE/assets.txt")
echo "==> 共 $TOTAL 个资产，开始下载"
OK=0; FAIL=0
while IFS= read -r asset; do
  out="$STAGE/$VER/assets/$asset"
  mkdir -p "$(dirname "$out")"
  if curl -sf "$BASE/$VER/assets/$asset" -o "$out" && [[ -s "$out" ]]; then
    OK=$((OK+1))
  else
    FAIL=$((FAIL+1)); echo "  失败: $asset"
  fi
done < "$STAGE/assets.txt"
echo "==> 成功 $OK / 失败 $FAIL / 共 $TOTAL"
[[ "$FAIL" -gt 0 ]] && exit 1

echo "==> 改写 embed.js 的 base 为同源路径（离线自托管）"
sed -i "s|var base = 'https://cdn.unlayer.com/image-editor';|var base = '/image-editor'; // vendored, base rewritten to same-origin for offline self-hosting|" "$STAGE/embed.js"

echo "==> 覆盖到 offline/image-editor/"
rm -rf "$HERE/2.2.0"
cp "$STAGE/embed.js" "$HERE/embed.js"
mkdir -p "$HERE/$VER"
cp -r "$STAGE/$VER/editor.js" "$STAGE/$VER/assets" "$HERE/$VER/"
echo "==> 完成: $(du -sh "$HERE" | cut -f1)"
