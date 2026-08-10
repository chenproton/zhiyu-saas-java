#!/usr/bin/env bash
# 存量上传文件迁移脚本（P0 文件鉴权配套）
#
# 背景：上传目录由 UploadDir/<uuid>.<ext> 改为按租户隔离的 UploadDir/<tenantID>/<uuid>.<ext>，
# 文件 URL 由 /uploads/<uuid>.<ext> 改为 /uploads/<tenantID>/<uuid>.<ext>。
# 本脚本将存量文件按数据库归属归置到租户子目录，并同步更新数据库中的 URL。
#
# 用法：
#   DATABASE_URL=postgres://... UPLOAD_DIR=/opt/zhiyu-saas/uploads ./scripts/migrate_uploads.sh
# 环境变量：DATABASE_URL（必填）、UPLOAD_DIR（默认 ../public/uploads）
# 幂等：已迁移（2 段路径/已在租户目录）的文件自动跳过，可重复执行。
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
UPLOAD_DIR="${UPLOAD_DIR:-../public/uploads}"
[[ -z "$DB_URL" ]] && { echo "错误：请设置 DATABASE_URL" >&2; exit 1; }
[[ -d "$UPLOAD_DIR" ]] || { echo "错误：UPLOAD_DIR 不存在：$UPLOAD_DIR" >&2; exit 1; }

PSQL=(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1)

moved=0
skipped=0
failed=0

move_file() {
  local tenant="$1" name="$2" src dst
  src="$UPLOAD_DIR/$name"
  dst="$UPLOAD_DIR/$tenant/$name"
  if [[ ! -f "$src" ]]; then
    echo "  [warn] 源文件缺失，仅更新 DB：$name" >&2
    return 0
  fi
  if [[ -f "$dst" ]]; then
    # 目标已存在（此前迁移过），删除孤儿源文件
    rm -f "$src"
    return 0
  fi
  mkdir -p "$UPLOAD_DIR/$tenant"
  if mv "$src" "$dst"; then
    echo "  [ok] $name -> $tenant/$name"
    moved=$((moved + 1))
  else
    echo "  [error] 移动失败：$src -> $dst" >&2
    failed=$((failed + 1))
  fi
}

# 1) 标量 URL 列（url/file/image/logo/avatar/qualification 等文本列）
#    按 information_schema 动态枚举，新表自动覆盖
while IFS='|' read -r tbl col; do
  [[ -z "$tbl" || -z "$col" ]] && continue
  has_tenant=$("${PSQL[@]}" -Atc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$tbl' AND column_name='tenant_id'")
  if [[ "$has_tenant" != "1" ]]; then
    echo "[skip] $tbl.$col：无 tenant_id 列，无法归置" >&2
    continue
  fi
  while IFS='|' read -r tenant name; do
    [[ -z "$tenant" || -z "$name" ]] && continue
    move_file "$tenant" "$name"
    "${PSQL[@]}" -c "UPDATE \"$tbl\" SET \"$col\" = '/uploads/$tenant/$name' WHERE \"$col\" = '/uploads/$name' AND tenant_id = '$tenant'"
    skipped=$((skipped + 1))
  done < <("${PSQL[@]}" -At -F'|' -c "
    SELECT tenant_id::text, regexp_replace(\"$col\", '^/uploads/', '')
    FROM \"$tbl\"
    WHERE \"$col\" LIKE '/uploads/%'
      AND \"$col\" NOT LIKE '/uploads/%/%'")
done < <("${PSQL[@]}" -At -F'|' -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type IN ('character varying', 'text')
    AND (column_name ILIKE '%url%' OR column_name ILIKE '%file%'
         OR column_name ILIKE '%image%' OR column_name ILIKE '%logo%'
         OR column_name ILIKE '%avatar%' OR column_name ILIKE '%attachment%'
         OR column_name ILIKE '%qualification%' OR column_name ILIKE '%photo%')")

# 2) 数组 URL 列（如 homework 附件 attachment_urls TEXT[]）
while IFS='|' read -r tbl col; do
  [[ -z "$tbl" || -z "$col" ]] && continue
  has_tenant=$("${PSQL[@]}" -Atc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$tbl' AND column_name='tenant_id'")
  [[ "$has_tenant" != "1" ]] && continue
  while IFS='|' read -r id tenant name; do
    [[ -z "$id" || -z "$tenant" || -z "$name" ]] && continue
    move_file "$tenant" "$name"
    "${PSQL[@]}" -c "UPDATE \"$tbl\" SET \"$col\" = array_replace(\"$col\", '/uploads/$name', '/uploads/$tenant/$name') WHERE id = '$id'"
  done < <("${PSQL[@]}" -At -F'|' -c "
    SELECT x.id::text, x.tenant_id::text, e
    FROM (SELECT id, tenant_id, unnest(\"$col\") AS e FROM \"$tbl\" WHERE \"$col\" IS NOT NULL) x
    WHERE x.e LIKE '/uploads/%' AND x.e NOT LIKE '/uploads/%/%'")
done < <("${PSQL[@]}" -At -F'|' -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type = 'ARRAY'
    AND (column_name ILIKE '%url%' OR column_name ILIKE '%file%'
         OR column_name ILIKE '%attachment%')")

echo "完成：移动 $moved 个文件，跳过/更新 $skipped 条记录，失败 $failed 个"
[[ "$failed" -gt 0 ]] && exit 1
exit 0
