#!/usr/bin/env bash
#
# spec-check.sh — Spec 模式的自动化硬约束校验
#
# 校验「能静态/可 grep 检测」的硬约束，补足 deploy.sh 质量门禁（gofmt/vet/build/test/typecheck/lint）
# 所不覆盖的「spec 一致性」硬红线。
#
# 注意：这**不是** spec↔代码的语义一致性校验，那属于 AI 的 analyze 流程（见 docs/spec-standards.md）。
#
# 用法：
#   ./scripts/spec-check.sh            # 全量校验，任一项失败即非零退出
#   退出码 0 = 全部通过；非 0 = 有违规（打印到 stderr）
#
# 实现要点（2026-08-14 修订）：
#   - 本脚本开启 set -o pipefail，而「producer | grep -q」在 grep 提前退出时会让 producer 收到
#     SIGPIPE 退出 141，导致 if 恒为假（检测死代码）。因此所有「文件内容过滤后再判断」的检查
#     一律改为命令替换形态 [ -n "$(producer | grep -E pattern)" ]，不再使用管道尾端 grep -q。
#   - 检查项 8~11 为 2026-08-14 补强新增：8 表数机械校验、9 机器码词汇表校验、
#     10 路由↔契约双向覆盖（提示级，豁免清单 scripts/spec-check-data/contract-exemptions.txt）、
#     11 spec 随代码变更（提示级，原第 8 项顺延）、
#     12 验收流程一致性（提示级，06-acceptance-flows.md flow id 唯一 + story↔01-prd 双向）。
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

violation() { echo "  [违反] $*" >&2; FAILED=$((FAILED + 1)); }
pass()      { echo "  [通过] $*"; }

echo "== spec 硬约束校验 =="

# 行尾注释剥离：grep -vE '^[[:space:]]*//' 只能排除「整行注释」；行尾 `//...`（含
# `https://` 等 URL 字符串内的 `//`）需先剥掉再查关键字。URL 字符串影响可忽略——
# URL 路径段不携带裸 SQL 关键字/AI 直连特征，剥掉后真实代码（关键字在注释之前）仍被命中，不漏报。
strip_trailing_comments() { sed -E 's#//.*$##' "$1"; }

# ---------------------------------------------------------------
# 1. 后端分层红线（refactor-layering.md / AGENTS.md「三、硬性架构约束」3.1 / ADR-0001）
#    （2026-08-14 增强：handler/service/store 扫描改为递归 find，排除 *_test.go 与 testhelper）
# ---------------------------------------------------------------
echo "-- 1. 后端分层红线（handler 无裸 SQL / 直调 db.*） --"
HANDLER_DIR="backend/go/internal/handler"
SQL_KEYWORDS=("SELECT" "INSERT" "UPDATE" "DELETE" "ALTER TABLE" "CREATE TABLE")

found_sql=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  for kw in "${SQL_KEYWORDS[@]}"; do
    if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E "\b${kw}\b")" ]; then
      violation "handler 出现 SQL 关键字 ${kw}: $(basename "$f")"
      found_sql=1
    fi
  done
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$|URL\.Query\(' | grep -E '\.(QueryRow|Query|Exec)(Context)?\(')" ]; then
    violation "handler 直接调用 DB 方法(.QueryRow/.Query/.Exec): $(basename "$f")"
    found_sql=1
  fi
  if grep -qE '\*pgxpool\.Pool|\*pgx\.Conn|\*sql\.DB|\*sql\.Tx' "$f" 2>/dev/null; then
    violation "handler 持有 DB 连接字段: $(basename "$f")"
    found_sql=1
  fi
done < <(find "$HANDLER_DIR" -name '*.go' -not -name '*_test.go' -not -path '*/testhelper/*' | sort)
[ "$found_sql" -eq 0 ] && pass "handler 层无裸 SQL / 直调 db.* / 持仓字段"

found_sql=0
SERVICE_DIR="backend/go/internal/service"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E '\b(SELECT|INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE)\b')" ]; then
    violation "service 拼接 SQL: $(basename "$f")"
    found_sql=1
  fi
done < <(find "$SERVICE_DIR" -name '*.go' -not -name '*_test.go' -not -path '*/testhelper/*' | sort)
[ "$found_sql" -eq 0 ] && pass "service 层无拼接 SQL"

found=0
STORE_DIR="backend/go/internal/store"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if grep -qE '\*http\.Request|middleware\.CurrentUser|middleware\.Claims' "$f" 2>/dev/null; then
    violation "store 读取 HTTP/Claims: $(basename "$f")"
    found=1
  fi
done < <(find "$STORE_DIR" -name '*.go' -not -name '*_test.go' -not -path '*/testhelper/*' | sort)
[ "$found" -eq 0 ] && pass "store 层不读 HTTP/Claims"

# ---------------------------------------------------------------
# 2. AI 统一底座红线（ai-development.md / AGENTS.md 3.2 / ADR-0002）
# ---------------------------------------------------------------
echo "-- 2. AI 统一底座红线 --"
found=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E 'tenant_ai_configs|api_key|ApiKey|openai|anthropic|huggingface|deepseek|http\.(Post|Get|NewRequest|Client)')" ]; then
    violation "handler 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done < <(find "$HANDLER_DIR" -name '*.go' -not -name '*_test.go' -not -path '*/testhelper/*' | sort)
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  # AI 例外（ai.go / ai_*.go）按 basename 排除，递归扫描不影响该例外
  case "$(basename "$f")" in ai.go|ai_*.go) continue ;; esac
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E 'tenant_ai_configs|api_key|ApiKey|openai|anthropic|http\.(Post|Get|NewRequest|Client)')" ]; then
    violation "service 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done < <(find "$SERVICE_DIR" -name '*.go' -not -name '*_test.go' -not -path '*/testhelper/*' | sort)
[ "$found" -eq 0 ] && pass "AI 功能未经 AIService 之外封装 LLM"

# ---------------------------------------------------------------
# 3. migration 配对（AGENTS.md 4.2）
# ---------------------------------------------------------------
echo "-- 3. migration 配对 --"
found=0
for up in backend/go/migrations/*.up.sql; do
  base="${up%.up.sql}"
  if [ ! -f "${base}.down.sql" ]; then
    violation "migration 缺 down: $(basename "$up")"
    found=1
  fi
done
for down in backend/go/migrations/*.down.sql; do
  base="${down%.down.sql}"
  if [ ! -f "${base}.up.sql" ]; then
    violation "migration 缺 up: $(basename "$down")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "migration up/down 全部配对"

# down 不可逆标注（spec-standards.md 六.2）：up 若物理不可逆（TRUNCATE/DROP TABLE/DELETE FROM 清数据），
# 其 down（或 up）须声明「不可逆/不可恢复」；仅提示，不阻断（DROP TABLE 回滚建表可部分恢复结构，数据仍需人工评估）。
_dn_hits=$(for u in backend/go/migrations/*.up.sql; do
  if grep -qE '\b(TRUNCATE|DROP TABLE|DELETE FROM)\b' "$u"; then
    d="${u%.up.sql}.down.sql"
    if ! { grep -qE '不可逆|不可恢复' "$u" 2>/dev/null || grep -qE '不可逆|不可恢复' "$d" 2>/dev/null; }; then basename "$u"; fi
  fi
done)
if [ -n "$_dn_hits" ]; then
  echo "  [提示] 以下 up 迁移含 TRUNCATE/DROP TABLE/DELETE FROM 清数据但未声明「不可逆/不可恢复」，请确认回滚预案："
  for h in $_dn_hits; do echo "         $h"; done
fi

# ---------------------------------------------------------------
# 4. spec 制品完整性（spec-standards.md 二）
# ---------------------------------------------------------------
echo "-- 4. spec 制品完整性 --"
found=0
for n in 01-prd 02-api-contract 03-development-plan 04-database-schema 05-prototype-interaction; do
  if [ ! -f "docs/spec/${n}.md" ]; then
    violation "spec 缺必备层: docs/spec/${n}.md"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "docs/spec/ 五层必备制品齐备"

# ---------------------------------------------------------------
# 5. ADR 索引一致性（双向）
#    （2026-08-14 修复：编号通配改 [0-9][0-9][0-9][0-9]-*.md，避免漏检 0010/0020 等
#      0 结尾编号；显式跳过 0000-template.md 模板文件）
# ---------------------------------------------------------------
echo "-- 5. ADR 索引一致性 --"
found=0
if [ -f docs/decisions/README.md ]; then
  for num in $(grep -oE '^\| [0-9]{4} \|' docs/decisions/README.md 2>/dev/null | grep -oE '[0-9]{4}' | sort -u); do
    if ! ls "docs/decisions/${num}-"*.md >/dev/null 2>&1; then
      violation "ADR 索引登记（${num}）但文件缺失"
      found=1
    fi
  done
  for adr in docs/decisions/[0-9][0-9][0-9][0-9]-*.md; do
    [ -f "$adr" ] || continue
    [[ "$(basename "$adr")" == "0000-template.md" ]] && continue
    num=$(basename "$adr" | grep -oE '^[0-9]{4}')
    if ! grep -qE "^\| ${num} \|" docs/decisions/README.md; then
      violation "ADR 文件存在但未登记索引: $(basename "$adr")"
      found=1
    fi
  done
  [ "$found" -eq 0 ] && pass "ADR 索引双向一致"
else
  pass "（无 docs/decisions/README.md，跳过）"
fi

# ---------------------------------------------------------------
# 6. 安全红线（AGENTS.md 三.3 / ADR-0003）
# ---------------------------------------------------------------
echo "-- 6. 安全红线 --"

found=0
check_key_write_tenant() {
  local file="$1"; shift
  local fn body
  for fn in "$@"; do
    # 函数体收集（2026-08-14 增强）：
    #   - 从「包含 fn( 且形如函数定义」的行开始：单行签名 `func (r *XStore) fn(` / `func fn(`，
    #     接收者名不限 s；多行签名由定义行本身命中（`func ... fn(` 起始行）。
    #   - 收集到下一个 `^func ` 行结束。
    #   - 包级函数（如 `func UpdateImportUser(ctx, q Queryer, ...)`）同样命中。
    body=$(awk -v fn="$fn" '
      function isDef(l,   pos, c) {
        if (l !~ /^[[:space:]]*func /) return 0
        pos = index(l, fn "(")
        if (pos <= 0) return 0
        if (pos > 1) {
          c = substr(l, pos - 1, 1)
          if (c ~ /[A-Za-z0-9_]/) return 0
        }
        return 1
      }
      {
        line = $0
        if (isDef(line)) {
          print line
          infn = 1
        } else if (!infn && index(line, fn "(") > 0 && prev_is_def) {
          # 多行签名（防御分支）：本行含 fn( 且上一行是 func ... fn(
          print prev_line
          print line
          infn = 1
        } else if (infn && line ~ /^[[:space:]]*func /) {
          exit
        } else if (infn) {
          print line
        }
        prev_line = line
        prev_is_def = isDef(line)
      }
    ' "$STORE_DIR/$file" 2>/dev/null)
    if [ -z "$body" ]; then
      # 名单漂移防护：名单列出的函数在 store 文件中找不到定义 → 提示（不阻断）
      echo "  [提示] ADR-0003 名单函数未在 store 文件中找到定义（疑似名单漂移，请核对名单）: store/${file}::${fn}"
      continue
    fi
    if ! grep -q 'tenant_id' <<<"$body"; then
      violation "ADR-0003 关键写缺 SQL 租户条件: store/${file}::${fn}"
      found=1
    fi
  done
}
# 关键写名单外置为机器可读文件（scripts/spec-check-data/adr0003-key-writes.txt），
# 新增关键写操作（考试题目增删改分、密码/状态写）时在该文件追加一行即可纳入校验。
ADR3_LIST="scripts/spec-check-data/adr0003-key-writes.txt"
if [ -f "$ADR3_LIST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    # shellcheck disable=SC2086
    check_key_write_tenant $line
  done < "$ADR3_LIST"
else
  echo "  [提示] 缺 ADR-0003 关键写名单文件 $ADR3_LIST，跳过名单校验"
fi
[ "$found" -eq 0 ] && pass "ADR-0003 关键写 SQL 租户条件齐备"

# XSS 扫描（2026-08-14 增强：同时覆盖 packages/，排除 node_modules/.next/dist；提示级）
_xss_hits=$(grep -rl 'dangerouslySetInnerHTML' frontend/edu frontend/packages --include='*.tsx' --include='*.ts' 2>/dev/null | grep -vE 'node_modules|\.next|/dist/')
if [ -n "$_xss_hits" ]; then
  echo "  [提示] 前端使用 dangerouslySetInnerHTML 的文件（请确认渲染的是否为用户/LLM 内容、是否已消毒）："
  for h in $_xss_hits; do
    echo "         ${h#frontend/edu/}"
  done
fi

# ---------------------------------------------------------------
# 7. migrations 编号 ↔ 04-database-schema.md 变更记录一致性
# ---------------------------------------------------------------
echo "-- 7. schema 文档与 migrations 编号一致 --"
found=0
if [ -f docs/spec/04-database-schema.md ]; then
  doc_nums=$(sed -n "/^## 5\. 变更记录/,/^## /p" docs/spec/04-database-schema.md \
    | grep -oE '^\| [0-9]{3}(/[0-9]{3})?[[:alnum:]_]* \|' \
    | grep -oE '[0-9]{3}' | sort -u | tr '\n' ' ')
  mig_nums=$(ls backend/go/migrations/*.up.sql | sed -E 's#.*/([0-9]{3})_.*#\1#' | sort -u | tr '\n' ' ')
  for n in $mig_nums; do
    case " $doc_nums " in *" $n "*) ;; *) violation "migration ${n} 未登记进 04-database-schema.md §5 变更记录"; found=1 ;; esac
  done
  for n in $doc_nums; do
    case " $mig_nums " in *" $n "*) ;; *) violation "04-database-schema.md §5 登记 ${n} 但无对应 migration 文件"; found=1 ;; esac
  done
  [ "$found" -eq 0 ] && pass "migrations 编号与 schema 变更记录双向一致"
else
  pass "（无 04-database-schema.md，跳过）"
fi

# ---------------------------------------------------------------
# 8. 表数机械校验（新增 2026-08-14）
#    migrations *.up.sql 中 CREATE TABLE 次数 − DROP TABLE 次数（grep -c 计数，
#    CREATE TABLE 关键字每表出现一次；IF NOT EXISTS/跨行不影响计数），
#    与 04-database-schema.md 头部「当前共 **N 张表**」比对。
# ---------------------------------------------------------------
echo "-- 8. 表数机械校验（migrations CREATE−DROP ↔ 04-database-schema.md 头部） --"
found=0
_create=$(grep -o 'CREATE TABLE' backend/go/migrations/*.up.sql 2>/dev/null | wc -l)
_drop=$(grep -o 'DROP TABLE' backend/go/migrations/*.up.sql 2>/dev/null | wc -l)
_actual=$((_create - _drop))
_doc=$(grep -oE '当前共 \*\*[0-9]+ 张表\*\*' docs/spec/04-database-schema.md 2>/dev/null | head -1 | grep -oE '[0-9]+')
if [ -n "$_doc" ]; then
  if [ "$_actual" -ne "$_doc" ]; then
    violation "表数不一致：migrations 实为 ${_create}−${_drop}=${_actual} 张，04-database-schema.md 记为 ${_doc}"
    found=1
  else
    pass "表数一致（migrations ${_create}−${_drop}=${_actual} = 文档 ${_doc}）"
  fi
else
  pass "（未在 04-database-schema.md 头部找到「当前共 **N 张表**」，跳过）"
fi

# ---------------------------------------------------------------
# 9. 机器码词汇表校验（新增 2026-08-14）
#    02-api-contract.md §4.2 机器码词汇表第一列（形如 | `ai_not_configured` |）
#    ↔ error_codes.go 中 CodeXxx = "..." 常量值集合双向比对。
#    - 文档有、代码无 → violation（阻断）：词汇表登记了不存在的码。
#    - 代码有、文档无 → 提示（不阻断）：429 为数字 code 特例——限流实际响应 code 直接
#      返回数字 "429"，词汇表仅作映射兜底，不逐码登记；其余未登记码需确认是否补文档。
# ---------------------------------------------------------------
echo "-- 9. 机器码词汇表校验（02-api-contract.md §4.2 ↔ error_codes.go） --"
found=0
MC_DOC="docs/spec/02-api-contract.md"
MC_CODE="backend/go/internal/handler/error_codes.go"
mc_doc_codes=$(sed -n '/^### 4\.2 /,/^### 4\.3 /p' "$MC_DOC" 2>/dev/null \
  | grep -E '^\| *`[a-z_0-9]+` *\|' | sed -E 's#^\| *`([a-z_0-9]+)`.*#\1#' | sort -u)
mc_code_codes=$(grep -oE 'Code[A-Za-z0-9_]+[[:space:]]*=[[:space:]]*"[^"]+"' "$MC_CODE" 2>/dev/null | sed -E 's#.*"([^"]+)"#\1#' | sort -u)
if [ -n "$mc_doc_codes" ] && [ -n "$mc_code_codes" ]; then
  mc_doc_only=$(comm -23 <(printf '%s\n' "$mc_doc_codes") <(printf '%s\n' "$mc_code_codes"))
  mc_code_only=$(comm -13 <(printf '%s\n' "$mc_doc_codes") <(printf '%s\n' "$mc_code_codes"))
  if [ -n "$mc_doc_only" ]; then
    violation "机器码词汇表登记了 error_codes.go 不存在的码: $(echo "$mc_doc_only" | tr '\n' ' ')"
    found=1
  fi
  if [ -n "$mc_code_only" ]; then
    echo "  [提示] error_codes.go 存在但 §4.2 词汇表未登记的码（请确认是否需补登记）: $(echo "$mc_code_only" | tr '\n' ' ')"
  fi
  [ "$found" -eq 0 ] && pass "机器码词汇表与 error_codes.go 双向一致"
else
  pass "（未找到 §4.2 机器码词汇表或 error_codes.go，跳过）"
fi

# ---------------------------------------------------------------
# 10. 路由↔契约双向覆盖检查（新增 2026-08-14，提示级不阻断）
#     目标：拦「新增路由不写文档」（代码有、文档无）与「文档僵尸条目」（文档有、代码无）。
#     实现：
#       - 代码侧：从 backend/go/internal/router/*.go 提取 .Get/.Post/.Put/.Delete/.Patch("...")
#         注册路径，并展开 chi 子路由挂载前缀（r.Route("/alliance", ...) 内相对路径补前缀）；
#         registerContent/Batch/Write/ReadRoutes(r, "/base", ...) 的 base 也计入。
#       - 文档侧：解析 02-api-contract.md 与 partner-enterprise-platform.md 表格行
#         `| 方法 | /路径 | ... |`；方法列仅取 GET/POST/PUT/DELETE/PATCH 方法 token
#         （`POST /{id}/status` 这类方法列内路径忽略）；路径列支持 `、` 逗号分隔多路径、
#         `/(POST)` 后缀、`{base}` 占位（含 {base} 的行跳过——通用模式模板，非具体端点）；
#         相对路径条目（如联盟行 `/enterprises` 省略 `/alliance` 前缀）按行内首路径的
#         各级目录前缀尝试解析到代码路径。
#       - 规范化：去 /api/v1 前缀、{xxx}→{id}、去重排序。
#       - 代码侧 /import/* /export/* /templates/* 由 02-api-contract.md §1.10「Excel 三件套」
#         模式化登记（每实体 /import/{entity}/excel + preview + /templates/{entity}，
#         基础数据另含 /export/{entity}/excel），非逐路径列示，提取时按模式剔除。
#       - 祖先覆盖：代码路径自身或任一级目录前缀命中文档路径即视为已登记
#         （文档以「GET/POST/PUT/DELETE」方法列 + 描述列覆盖 {id}/动作子路径）。
#       - 豁免清单：scripts/spec-check-data/contract-exemptions.txt（每行一个规范化路径，# 注释）。
# ---------------------------------------------------------------
echo "-- 10. 路由↔契约双向覆盖（提示级） --"
EXEMPT_FILE="scripts/spec-check-data/contract-exemptions.txt"

extract_route_paths() {
  local f
  for f in backend/go/internal/router/*.go; do
    [[ "$f" == *_test.go ]] && continue
    awk '
      function join(stack, n, rel,   i, out) {
        out = ""
        for (i = 1; i <= n; i++) out = out stack[i]
        return out rel
      }
      {
        line = $0
        lead = line; gsub(/^[ \t]*/, "", lead); indent = length(line) - length(lead)
        # chi 子路由挂载：r.Route("/prefix", ...) 入栈（记录行缩进）
        if (match(line, /r\.Route\("[^"]+"/)) {
          p = substr(line, RSTART + 8, RLENGTH - 9)
          gsub(/"/, "", p)
          stack[++top] = p
          sind[top] = indent
          next
        }
        # 块结束（缩进 ≤ 挂载行缩进的 } 或 })，出栈
        if (top > 0 && (line ~ /^[ \t]*\}[ \t]*$/ || line ~ /^[ \t]*\}\)[ \t]*$/) && indent <= sind[top]) {
          delete stack[top]; top--
          next
        }
        # 内容/批次资源助手注册：registerXxxRoutes(r, "/base", ...) 的 base
        if (match(line, /register(Content|Batch|ContentWrite|ContentRead)Routes\([^,]+,\s*"[^"]+"/)) {
          seg = substr(line, RSTART, RLENGTH)
          if (match(seg, /"[^"]+"/)) print join(stack, top, "") substr(seg, RSTART, RLENGTH)
          next
        }
        # 方法注册：.Get("/path" 等（含 r.With(...).Get(...) 链式）
        while (match(line, /\.(Get|Post|Put|Delete|Patch)\("[^"]+"/)) {
          seg = substr(line, RSTART, RLENGTH)
          if (match(seg, /"[^"]+"/)) {
            rel = substr(seg, RSTART, RLENGTH)
            gsub(/"/, "", rel)
            print join(stack, top, rel)
          }
          line = substr(line, RSTART + RLENGTH)
        }
      }
    ' "$f"
  done
}

# 代码侧路径（规范化 + §1.10 模式剔除 + 去重）
code_paths=$(extract_route_paths \
  | sed -E 's#"##g; s#^/api/v1##; s#\{[^}]+\}#{id}#g; s#(.)/$#\1#' \
  | grep -vE '^/(import|export|templates)/' \
  | sort -u)

# 文档侧路径（规范化 + 相对路径解析 + 去重）；code_paths 先加载（NR==FNR）用于解析
doc_paths=$(awk -F'|' '
  function norm(pp) {
    gsub(/`/, "", pp)
    gsub(/\((GET|POST|PUT|DELETE|PATCH)\)/, "", pp)
    gsub(/（[^）]*）/, "", pp)
    gsub(/\?.*$/, "", pp)
    gsub(/^[ \t]+|[ \t]+$/, "", pp)
    if (pp ~ /\{base\}/) return ""
    if (pp == "/" || pp == "") return ""
    if (pp !~ /^\//) return ""
    sub(/^\/api\/v1/, "", pp)
    gsub(/\{[^}]+\}/, "{id}", pp)
    return pp
  }
  function prefixes(p,   n, i, j, out, cnt, seg) {
    # p 的所有目录前缀，最长在前（不含 p 本身与空串）
    n = split(p, a, "/")
    out = ""
    cnt = 0
    for (i = n - 1; i >= 1; i--) {
      seg = ""
      for (j = 1; j <= i; j++) seg = seg a[j] "/"
      sub(/\/$/, "", seg)
      if (seg == "") continue
      out = out "\n" seg
      cnt++
    }
    return out
  }
  NR == FNR {
    if ($0 ~ /^[ \t]*\//) code[$0] = 1
    next
  }
  {
    line = $0
    if (line ~ /^\| *(GET|POST|PUT|DELETE|PATCH|HEAD)/) {
      n = split(line, cells, "|")
      n2 = split(cells[3], entries, /[、,]/)
      e1 = ""
      for (i = 1; i <= n2; i++) {
        e = norm(entries[i])
        if (e == "") continue
        # 裸 {id} 相对路径离开行首全路径无法独立解析（其行已登记 e1），忽略
        if (e == "/{id}") continue
        if (i == 1) { e1 = e; print e; continue }
        # 先按行内 e1 的目录前缀解析相对路径，再退回 as-is
        # （避免 /majors 这类全局同名路径被相对条目误配到错误前缀）
        np = split(prefixes(e1), plist, "\n")
        resolved = 0
        for (k = 1; k <= np; k++) {
          if (plist[k] == "") continue
          if ((plist[k] e) in code) { print plist[k] e; resolved = 1; break }
        }
        if (resolved) continue
        if (e in code) { print e; continue }
        if ((e1 e) in code) { print e1 e; continue }
        print e
      }
    }
  }
' <(printf '%s\n' "$code_paths") docs/spec/02-api-contract.md docs/spec/partner-enterprise-platform.md \
  | sort -u)

# 差集（祖先覆盖）：代码路径自身或任一级目录前缀命中文档 → 视为已登记
code_only=""
while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  cur="$p"
  covered=0
  while :; do
    if grep -qxF "$cur" <<<"$doc_paths"; then covered=1; break; fi
    cur="${cur%/*}"
    [[ "$cur" == "" ]] && break
  done
  [ "$covered" -eq 0 ] && code_only+="$p"$'\n'
done <<<"$code_paths"
doc_only=$(comm -13 <(printf '%s\n' "$code_paths" | sort -u) <(printf '%s\n' "$doc_paths" | sort -u))

# 剔除豁免清单
if [ -f "$EXEMPT_FILE" ]; then
  exempts=$(grep -vE '^[[:space:]]*#|^[[:space:]]*$' "$EXEMPT_FILE" | sed -E 's#[[:space:]]*$##' | sort -u)
  code_only=$(comm -23 <(printf '%s\n' "$code_only" | grep -v '^$' | sort -u) <(printf '%s\n' "$exempts"))
  doc_only=$(comm -23 <(printf '%s\n' "$doc_only" | grep -v '^$' | sort -u) <(printf '%s\n' "$exempts"))
fi

if [ -n "$code_only" ]; then
  n=$(printf '%s\n' "$code_only" | grep -c .)
  echo "  [提示] 以下代码路由疑似未登记契约（02-api-contract.md / partner-enterprise-platform.md 表格无对应路径）："
  printf '%s\n' "$code_only" | head -30 | sed 's/^/         /'
  [ "$n" -gt 30 ] && echo "         …（共 ${n} 条，仅列前 30）"
fi
if [ -n "$doc_only" ]; then
  n=$(printf '%s\n' "$doc_only" | grep -c .)
  echo "  [提示] 以下文档路径疑似僵尸条目（代码路由中不存在）："
  printf '%s\n' "$doc_only" | head -30 | sed 's/^/         /'
  [ "$n" -gt 30 ] && echo "         …（共 ${n} 条，仅列前 30）"
fi
[ -z "$code_only$doc_only" ] && pass "路由↔契约双向覆盖一致（提示级）" || pass "路由↔契约覆盖检查完成（提示级，见上方提示）"

# ---------------------------------------------------------------
# 11. spec 随代码变更（提示级）
# ---------------------------------------------------------------
echo "-- 11. spec 随代码变更（代码↔spec 耦合） --"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse HEAD >/dev/null 2>&1; then
  code_changes=$(git diff --name-only HEAD -- backend/go/internal/router backend/go/internal/handler backend/go/migrations 2>/dev/null | grep -vE '_test\.go$' | head -50)
  spec_changes=$(git diff --name-only HEAD -- docs/spec docs/系统功能清单.md 2>/dev/null)
  if [[ -n "$code_changes" ]]; then
    if [[ -z "$spec_changes" ]]; then
      if ! git log -1 --pretty=%B 2>/dev/null | grep -qE 'spec:nochange|spec\.skip'; then
        echo "  [提示] 检测到代码结构变更但 docs/spec/ 未同步，请确认是否需回写 spec："
        echo "$code_changes" | sed 's/^/         /' | head -10
        echo "         （纯重构/纯修复可在 commit message 加 spec:nochange 声明豁免）"
      fi
    fi
  fi
  pass "spec↔代码耦合检查完成（仅提示，不阻断）"
else
  pass "（非 git 仓库或无可比基线，跳过）"
fi

# ---------------------------------------------------------------
# 12. 验收流程一致性（提示级）：06-acceptance-flows.md 的 flow 定义 ↔ PRD 用户故事
# ---------------------------------------------------------------
echo "-- 12. 验收流程一致性（提示级） --"
FLOWS_FILE="docs/spec/06-acceptance-flows.md"
if [ -f "$FLOWS_FILE" ]; then
  # flow id 唯一性
  dup_flows=$(grep -E '^flow: ' "$FLOWS_FILE" | awk '{print $2}' | sort | uniq -d)
  if [ -n "$dup_flows" ]; then
    echo "  [提示] 验收流程 id 重复（需全文件唯一）："
    echo "$dup_flows" | sed 's/^/         /'
  fi
  # story 引用必须存在于 01-prd.md（形如 | L-4 |）
  missing_stories=""
  for story in $(grep -E '^story: ' "$FLOWS_FILE" | awk '{print $2}' | grep -v '^<' | sort -u); do
    grep -qE "\| *${story} *\|" docs/spec/01-prd.md || missing_stories="$missing_stories $story"
  done
  if [ -n "$missing_stories" ]; then
    echo "  [提示] 验收流程引用的用户故事在 01-prd.md 中不存在：$missing_stories"
  fi
  # YAML 块可解析性（node 可用时用 js-yaml 粗检；不可用则跳过）
  if command -v node >/dev/null 2>&1 && [ -d scripts/ui-smoke/node_modules/js-yaml ]; then
    node -e "
      const fs=require('fs'),yaml=require('./scripts/ui-smoke/node_modules/js-yaml');
      const md=fs.readFileSync('docs/spec/06-acceptance-flows.md','utf8');
      const re=/\`\`\`flow\s*\n([\s\S]*?)\`\`\`/g; let m,bad=0;
      while((m=re.exec(md))){ try{ const d=yaml.load(m[1]); if(!d.flow||!Array.isArray(d.steps)) { bad=1; console.log('  [提示] flow 块缺 flow id 或 steps'); } }catch(e){ bad=1; console.log('  [提示] flow YAML 解析失败: '+e.message.split('\n')[0]); } }
      process.exit(bad)
    " || true
  fi
  pass "验收流程一致性检查完成（仅提示，不阻断）"
else
  pass "（无 06-acceptance-flows.md，跳过）"
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ spec 硬约束校验失败：存在 $FAILED 处违规（详见上方 [违反] 行）" >&2
  exit 1
else
  echo "✓ spec 硬约束校验全部通过"
  exit 0
fi
