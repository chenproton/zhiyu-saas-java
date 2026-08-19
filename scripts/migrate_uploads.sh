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

# 口令不进 argv：原来把含口令的完整 DB_URL 放进 psql 参数，同机任意用户 ps 可见。
# 从 URL 解析出各字段，口令经 PGPASSWORD 环境变量传递。
PG_USER=$(printf '%s' "$DB_URL" | sed -nE 's|^[a-z]+://([^:@/]+).*|\1|p')
PG_PASS=$(printf '%s' "$DB_URL" | sed -nE 's|^[a-z]+://[^:@/]+:([^@]*)@.*|\1|p' \
  | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
PG_HOST=$(printf '%s' "$DB_URL" | sed -nE 's|^[a-z]+://[^@]*@([^:/]+).*|\1|p')
PG_PORT=$(printf '%s' "$DB_URL" | sed -nE 's|^[a-z]+://[^@]*@[^:/]+:([0-9]+).*|\1|p')
PG_DB=$(printf '%s' "$DB_URL" | sed -nE 's|^[a-z]+://[^@]*@[^/]+/([^?]+).*|\1|p')
[[ -n "$PG_USER" && -n "$PG_HOST" && -n "$PG_DB" ]] \
  || { echo "错误：无法从 DATABASE_URL 解析连接信息" >&2; exit 1; }
export PGPASSWORD="$PG_PASS"
PSQL=(psql -h "$PG_HOST" -p "${PG_PORT:-5432}" -U "$PG_USER" -d "$PG_DB" -X -q -v ON_ERROR_STOP=1)

# jsonb/数组等结构化字段中的平铺引用模式：/uploads/<36位uuid>.<ext>
FLAT_PATTERN='/uploads/([0-9a-f-]{36}\.[A-Za-z0-9]+)'

# dry-run：只统计将要移动/改写的量，不动文件也不改库（DRY_RUN=1 或 --dry-run）
DRY_RUN=false
[[ "${DRY_RUN:-0}" == "1" || "${1:-}" == "--dry-run" ]] && DRY_RUN=true
$DRY_RUN && echo "== DRY RUN：只统计，不移动文件、不改数据库 =="

# 强烈建议先备份：本脚本会移动文件并改写 DB 引用，无事务保护（跨文件系统与库两侧）
if ! $DRY_RUN; then
  echo "提示：本脚本会移动文件并改写 DB 引用，建议先执行全库备份："
  echo "  docker exec -T zhiyu-postgres pg_dump -U $PG_USER $PG_DB > /opt/zhiyu-saas/backups/pre-uploads-migrate.sql"
fi

# 所有被 DB 引用的文件名（含已按租户前缀引用的），供最后孤儿隔离过滤
REF_NAMES=$(mktemp)
trap 'rm -f "$REF_NAMES"' EXIT

record_ref() {
  echo "$2" >> "$REF_NAMES"
}

moved=0
conflicts=0
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
    # 目标已存在：必须先比对内容再决定。原实现无条件 rm 源文件，
    # 同名不同内容（UUID 极小概率碰撞、或人工放入的同名文件）会永久丢数据。
    if cmp -s "$src" "$dst"; then
      rm -f "$src"   # 内容一致 = 上次已迁移成功，删孤儿源文件
    else
      mkdir -p "$UPLOAD_DIR/.conflict"
      mv "$src" "$UPLOAD_DIR/.conflict/$name" 2>/dev/null || true
      echo "  [warn] 目标已存在且内容不同，源文件移入 .conflict/ 待人工处理：$name" >&2
      conflicts=$((conflicts + 1))
    fi
    return 0
  fi
  if $DRY_RUN; then
    echo "  [dry-run] 将移动 $name -> $tenant/$name"
    moved=$((moved + 1))
    return 1   # 返回非 0 → 调用方跳过 DB 更新（dry-run 不改库）
  fi
  mkdir -p "$UPLOAD_DIR/$tenant"
  if mv "$src" "$dst"; then
    echo "  [ok] $name -> $tenant/$name"
    moved=$((moved + 1))
  else
    echo "  [error] 移动失败：$src -> $dst" >&2
    failed=$((failed + 1))
    # 返回非 0：调用方据此跳过该条的 DB 更新。
    # 原实现移动失败仍继续改库，DB 会指向不存在的新路径（前端 404、且源文件路径也已从库里消失）
    return 1
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
    record_ref "$tenant" "$name"
    # 移动失败就不改库：否则 DB 指向不存在的新路径（前端 404，且旧路径也从库里消失）
    if ! move_file "$tenant" "$name"; then
      $DRY_RUN || echo "  [skip-db] 因文件移动失败，跳过 DB 更新：$tbl.$col $name" >&2
      continue
    fi
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
    record_ref "$tenant" "$name"
    if ! move_file "$tenant" "$name"; then
      $DRY_RUN || echo "  [skip-db] 因文件移动失败，跳过 DB 更新：${tbl}.${col} id=${id} ${name}" >&2
      continue
    fi
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

# 3) jsonb 列（如 courses.eval_data、hybrid_node_modules.data、partner_enterprises 审核照片等）：
#    按行 tenant_id 归置文件，并用正则将列内 /uploads/<uuid>.<ext> 统一改写为租户前缀路径
while IFS='|' read -r tbl col; do
  [[ -z "$tbl" || -z "$col" ]] && continue
  has_tenant=$("${PSQL[@]}" -Atc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$tbl' AND column_name='tenant_id'")
  [[ "$has_tenant" != "1" ]] && continue
  while IFS='|' read -r tenant name; do
    [[ -z "$tenant" || -z "$name" ]] && continue
    record_ref "$tenant" "$name"
    move_file "$tenant" "$name"
  done < <("${PSQL[@]}" -At -F'|' -c "
    SELECT DISTINCT x.tenant_id::text, m[1]
    FROM (SELECT tenant_id, regexp_matches(\"$col\"::text, '$FLAT_PATTERN', 'g') AS m
          FROM \"$tbl\" WHERE \"$col\"::text ~ '/uploads/[0-9a-f-]{36}\.[A-Za-z0-9]+') x")
  # 必须排除 tenant_id IS NULL：'/uploads/' || NULL::text = NULL → regexp_replace 返回 NULL
  # → 整个 jsonb 列被写成 NULL（原实现会直接清空这些行的业务数据）
  if $DRY_RUN; then
    cnt=$("${PSQL[@]}" -Atc "SELECT count(*) FROM \"$tbl\" WHERE tenant_id IS NOT NULL AND \"$col\"::text ~ '/uploads/[0-9a-f-]{36}\.[A-Za-z0-9]+'" 2>/dev/null || echo 0)
    [[ "$cnt" =~ ^[0-9]+$ && "$cnt" -gt 0 ]] && echo "  [dry-run] $tbl.$col 将改写 $cnt 行"
    continue
  fi
  updated=$("${PSQL[@]}" -Atc "WITH upd AS (UPDATE \"$tbl\" SET \"$col\" = regexp_replace(\"$col\"::text, '$FLAT_PATTERN', '/uploads/' || tenant_id::text || '/\1', 'g')::jsonb WHERE tenant_id IS NOT NULL AND \"$col\" IS NOT NULL AND \"$col\"::text ~ '/uploads/[0-9a-f-]{36}\.[A-Za-z0-9]+' RETURNING 1) SELECT count(*) FROM upd")
  # tenant_id 为空的残留行单独提示，交人工处理，不擅自改写
  orphan=$("${PSQL[@]}" -Atc "SELECT count(*) FROM \"$tbl\" WHERE tenant_id IS NULL AND \"$col\"::text ~ '/uploads/[0-9a-f-]{36}\.[A-Za-z0-9]+'" 2>/dev/null || echo 0)
  [[ "$orphan" =~ ^[0-9]+$ && "$orphan" -gt 0 ]] && \
    echo "  [warn] $tbl.$col 有 $orphan 行 tenant_id 为空、含平铺上传引用，已跳过（需人工确认租户归属）" >&2
  [[ "$updated" =~ ^[0-9]+$ ]] && skipped=$((skipped + updated))
done < <("${PSQL[@]}" -At -F'|' -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND data_type = 'jsonb'")

# 4) 根目录残余平铺文件隔离：无任何 DB 引用的旧文件（孤儿）移入 _legacy_unreferenced/ 保留，
#    避免部署告警与误删；有引用的文件此时应已被移入租户目录，若仍在根目录则提示
QUARANTINE="$UPLOAD_DIR/_legacy_unreferenced"
mkdir -p "$QUARANTINE"
leftover=0
for f in "$UPLOAD_DIR"/*; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  leftover=$((leftover + 1))
  if grep -qxF "$name" "$REF_NAMES"; then
    echo "  [warn] 仍被 DB 引用但滞留根目录：$name（请检查归属）" >&2
    continue
  fi
  if $DRY_RUN; then echo "  [dry-run] 将隔离孤儿文件 $name"; continue; fi
  mv "$f" "$QUARANTINE/$name"
  echo "  [quarantine] $name -> _legacy_unreferenced/"
done

echo "完成：移动 $moved 个文件，更新/跳过 $skipped 条记录，失败 $failed 个，冲突隔离 $conflicts 个，隔离孤儿 $((leftover)) 个"
[[ "$conflicts" -gt 0 ]] && echo "  注意：$conflicts 个同名不同内容的源文件已移入 $UPLOAD_DIR/.conflict/，需人工确认后处理" >&2
[[ "$failed" -gt 0 ]] && echo "  注意：$failed 个文件移动失败，其 DB 记录未改动（可修复权限/磁盘后重跑本脚本，脚本幂等）" >&2
[[ "$failed" -gt 0 ]] && exit 1

# 容器内应用以 appuser(uid=1000) 运行：宿主以 root 执行迁移创建的租户目录属主为 root，
# 不修正则容器内新建文件失败（只读目录）。幂等：已属主正确的目录 chown 无副作用。
if command -v chown >/dev/null 2>&1; then
  chown -R 1000:1000 "$UPLOAD_DIR" 2>/dev/null && echo "已修正上传目录属主为 1000:1000（容器 appuser）" \
    || echo "警告：chown 1000:1000 失败，请手动执行：chown -R 1000:1000 $UPLOAD_DIR" >&2
fi
exit 0
