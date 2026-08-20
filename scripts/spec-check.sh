#!/usr/bin/env bash
#
# spec-check.sh — Spec 模式的自动化硬约束校验
#
# 校验「能静态/可 grep 检测」的硬约束，补足 deploy.sh 质量门禁（Maven 编译/测试）
# 所不覆盖的「spec 一致性」硬红线。
#
# 注意：这**不是** spec↔代码的语义一致性校验，那属于 AI 的 analyze 流程（见 docs/spec-standards.md）。
#
# 用法：
#   ./scripts/spec-check.sh            # 全量校验，任一项失败即非零退出
#   退出码 0 = 全部通过；非 0 = 有违规（打印到 stderr）
#
# 实现要点（2026-08 随 Go→Java 迁移重写）：
#   - 本脚本开启 set -o pipefail，而「producer | grep -q」在 grep 提前退出时会让 producer 收到
#     SIGPIPE 退出 141，导致 if 恒为假（检测死代码）。因此所有「文件内容过滤后再判断」的检查
#     一律改为命令替换形态 [ -n "$(producer | grep -E pattern)" ]，不再使用管道尾端 grep -q。
#   - 代码结构基线（Java 单栈，Go 版本已于 2026-08 迁移删除）：
#        CONTROLLER_DIR = backend/java/ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/controller
#        SERVICE_DIR    = .../service（含 impl 子目录，递归扫描）
#        MAPPER_DIR     = .../mapper
#        MIGRATIONS_DIR = db/migrations
#   - 检查项 8~12 为 2026-08-14 起补强；13/14 随 Java 化调整语义（13 降为提示级——Java 侧
#     租户隔离以 SQL 层 tenant_id 纵深防御为准，controller 级无 verifyTenantOwnership 硬要求；
#     14 的测试覆盖判定放宽为同包/同名 XxxTest）。
#   - 基线：本脚本在干净树（deploy 构建 worktree / CI checkout）运行，`git diff HEAD` 恒为空 →
#     diff 类检查会全部失效。故统一用 BASELINE（合并提交取 HEAD^1 = 整 PR 净变更），
#     并叠加「未提交工作区 + 已暂存 + 未跟踪」以兼容本地手跑。
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAILED=0

violation() { echo "  [违反] $*" >&2; FAILED=$((FAILED + 1)); }
pass()      { echo "  [通过] $*"; }

echo "== spec 硬约束校验 =="

# ---- Java 代码结构基线（迁移自 Go：handler/service/store → controller/service/mapper） ----
MODULE_JAVA="backend/java/ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu"
CONTROLLER_DIR="$MODULE_JAVA/controller"
SERVICE_DIR="$MODULE_JAVA/service"
MAPPER_DIR="$MODULE_JAVA/mapper"
MIGRATIONS_DIR="db/migrations"

# 统一 diff 基线：合并提交取 HEAD^1（整 PR 净变更），普通提交取 HEAD^
BASELINE=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  if git rev-parse -q --verify HEAD^1 >/dev/null 2>&1; then
    if git rev-parse -q --verify HEAD^2 >/dev/null 2>&1; then
      BASELINE="$(git rev-parse HEAD^1)"
    else
      BASELINE="$(git rev-parse HEAD^)"
    fi
  fi
fi

# 行尾注释剥离（Java：// 行注释；`//...` 含 URL 字符串内的 // 一并剥掉再查关键字，
# 剥掉后真实代码（关键字在注释之前）仍被命中，不漏报；/* */ 块注释内的关键字
# 命中时按逐行 grep 兜底评估，误报可接受）
strip_trailing_comments() { sed -E 's#//.*$##' "$1"; }

# ---------------------------------------------------------------
# 1. 后端分层红线（refactor-layering.md / ADR-0001，Java 语义）
#    controller：无裸 SQL 关键字、无 DB 句柄字段（JdbcTemplate/DataSource/SqlSessionFactory 等）、
#                无 MyBatis 注解（@Select/@Insert/@Update/@Delete，注意 @Delete\b 不会误伤 @DeleteMapping）
#    service(+impl)：不得拼接 SQL（裸 SELECT/INSERT/UPDATE/DELETE/ALTER TABLE/CREATE TABLE 关键字视为违规；
#                合法常量 SQL 片段走豁免名单 scripts/spec-check-data/service-sql-exemptions.txt）
#    mapper：不得读取 HTTP 请求（HttpServletRequest）、Sa-Token（StpUtil）、租户上下文（TenantContext）
# ---------------------------------------------------------------
echo "-- 1. 后端分层红线（controller 无裸 SQL/DB 句柄/MyBatis 注解；service 无拼接 SQL；mapper 不读请求/租户） --"
SQL_KEYWORDS=("SELECT" "INSERT" "UPDATE" "DELETE" "ALTER TABLE" "CREATE TABLE")

found_sql=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  for kw in "${SQL_KEYWORDS[@]}"; do
    if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E "\b${kw}\b")" ]; then
      violation "controller 出现 SQL 关键字 ${kw}: ${f#"$CONTROLLER_DIR"/}"
      found_sql=1
    fi
  done
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E 'JdbcTemplate|DataSource|SqlSessionFactory|SqlSessionTemplate|org\.apache\.ibatis')" ]; then
    violation "controller 持有 DB 句柄/MyBatis 依赖: ${f#"$CONTROLLER_DIR"/}"
    found_sql=1
  fi
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E '@(Select|Insert|Update|Delete)\b')" ]; then
    violation "controller 出现 MyBatis SQL 注解: ${f#"$CONTROLLER_DIR"/}"
    found_sql=1
  fi
done < <(find "$CONTROLLER_DIR" -name '*.java' -not -name '*Test.java' | sort)
[ "$found_sql" -eq 0 ] && pass "controller 层无裸 SQL / DB 句柄 / MyBatis 注解"

found_sql=0
SERVICE_SQL_EXEMPT="scripts/spec-check-data/service-sql-exemptions.txt"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  rel="${f#"$SERVICE_DIR"/}"
  # 豁免名单：合法常量 SQL 片段（MyBatis-Plus wrapper.apply/last 的 EXISTS 子查询等，非用户输入拼接）
  if [ -f "$SERVICE_SQL_EXEMPT" ] && grep -qxF "$rel" "$SERVICE_SQL_EXEMPT" 2>/dev/null; then continue; fi
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -E '\b(SELECT|INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE)\b')" ]; then
    violation "service 拼接 SQL: $rel"
    found_sql=1
  fi
done < <(find "$SERVICE_DIR" -name '*.java' -not -name '*Test.java' | sort)
[ "$found_sql" -eq 0 ] && pass "service 层无拼接 SQL"

found=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if grep -qE 'HttpServletRequest|StpUtil|TenantContext' "$f" 2>/dev/null; then
    violation "mapper 读取 HTTP 请求/Sa-Token/租户上下文: ${f#"$MAPPER_DIR"/}"
    found=1
  fi
done < <(find "$MAPPER_DIR" -name '*.java' -not -name '*Test.java' | sort)
[ "$found" -eq 0 ] && pass "mapper 层不读 HTTP 请求 / Sa-Token / 租户上下文"

# ---------------------------------------------------------------
# 2. LLM 直连红线（ai-development.md / ADR-0002，Java 语义）
#    AI 功能已整体删除（controller/ai 等 6 个包随 Go→Java 迁移移除），controller+service
#    出现 openai/anthropic/deepseek/huggingface/api_key 等 LLM 直连特征即视为新引入违规。
# ---------------------------------------------------------------
echo "-- 2. LLM 直连红线（controller/service 禁止直连 LLM 特征） --"
found=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [ -n "$(strip_trailing_comments "$f" | grep -vE '^[[:space:]]*$' | grep -iE 'tenant_ai_configs|api_key|apikey|openai|anthropic|huggingface|deepseek')" ]; then
    violation "疑似绕过 AIService 直连 LLM/配置: ${f#"$MODULE_JAVA"/}"
    found=1
  fi
done < <(find "$CONTROLLER_DIR" "$SERVICE_DIR" -name '*.java' -not -name '*Test.java' | sort)
[ "$found" -eq 0 ] && pass "controller/service 无 LLM 直连特征"

# ---------------------------------------------------------------
# 3. migration 配对（AGENTS.md 4.2；db/migrations）
# ---------------------------------------------------------------
echo "-- 3. migration 配对（db/migrations） --"
found=0
for up in "$MIGRATIONS_DIR"/*.up.sql; do
  [ -f "$up" ] || continue
  base="${up%.up.sql}"
  if [ ! -f "${base}.down.sql" ]; then
    violation "migration 缺 down: $(basename "$up")"
    found=1
  fi
done
for down in "$MIGRATIONS_DIR"/*.down.sql; do
  [ -f "$down" ] || continue
  base="${down%.down.sql}"
  if [ ! -f "${base}.up.sql" ]; then
    violation "migration 缺 up: $(basename "$down")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "migration up/down 全部配对"

# down 不可逆标注（spec-standards.md 六.2）：up 若物理不可逆（TRUNCATE/DROP TABLE/DELETE FROM 清数据），
# 其 down（或 up）须声明「不可逆/不可恢复」；仅提示，不阻断。
_dn_hits=$(for u in "$MIGRATIONS_DIR"/*.up.sql; do
  [ -f "$u" ] || continue
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
# 6. 安全红线（AGENTS.md 三.3 / ADR-0003，Java 语义）
#    关键写操作名单（scripts/spec-check-data/adr0003-key-writes.txt）为「mapper 文件级」检查：
#    名单中每个 mapper 文件的 SQL（@Select/@Update/@Insert/@Delete 注解字符串与 String 常量）
#    必须包含 tenant_id；不包含 → 违规。原 Go store 函数体解析逻辑已删除。
# ---------------------------------------------------------------
echo "-- 6. 安全红线（ADR-0003 关键写 mapper 的 SQL 必须含 tenant_id） --"

found=0
check_key_write_mapper() {
  local file="$1"
  local path="$MODULE_JAVA/$file"
  if [ ! -f "$path" ]; then
    # 名单漂移防护：名单列出的 mapper 文件不存在 → 提示（不阻断）
    echo "  [提示] ADR-0003 名单 mapper 文件未找到（疑似名单漂移，请核对名单）: $file"
    return
  fi
  if ! grep -q 'tenant_id' "$path"; then
    violation "ADR-0003 关键写 mapper 的 SQL 缺 tenant_id 租户条件: $file"
    found=1
  fi
}
# 关键写名单外置为机器可读文件（scripts/spec-check-data/adr0003-key-writes.txt），
# 新增关键写操作（考试题目增删改分、密码/状态写、申诉处理等）时在该文件追加一行即可纳入校验。
ADR3_LIST="scripts/spec-check-data/adr0003-key-writes.txt"
if [ -f "$ADR3_LIST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    check_key_write_mapper "$line"
  done < "$ADR3_LIST"
else
  echo "  [提示] 缺 ADR-0003 关键写名单文件 $ADR3_LIST，跳过名单校验"
fi
[ "$found" -eq 0 ] && pass "ADR-0003 关键写 mapper 的 SQL 租户条件齐备"

# XSS 扫描（提示级，Vue 用 v-html 渲染用户/LLM 内容时需确认已消毒）
_xss_hits=$(grep -rln 'v-html' frontend/portal-vue/src --include='*.vue' 2>/dev/null | grep -vE 'node_modules|/dist/')
if [ -n "$_xss_hits" ]; then
  echo "  [提示] 前端使用 v-html 的文件（请确认渲染的是否为用户/LLM 内容、是否已消毒）："
  for h in $_xss_hits; do
    echo "         ${h#frontend/portal-vue/}"
  done
fi

# ---------------------------------------------------------------
# 7. migrations 编号 ↔ 04-database-schema.md 变更记录一致性（db/migrations）
# ---------------------------------------------------------------
echo "-- 7. schema 文档与 migrations 编号一致（db/migrations） --"
found=0
if [ -f docs/spec/04-database-schema.md ]; then
  doc_nums=$(sed -n "/^## 5\. 变更记录/,/^## /p" docs/spec/04-database-schema.md \
    | grep -oE '^\| [0-9]{3}(/[0-9]{3})?[[:alnum:]_]* \|' \
    | grep -oE '[0-9]{3}' | sort -u | tr '\n' ' ')
  mig_nums=$(ls "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | sed -E 's#.*/([0-9]{3})_.*#\1#' | sort -u | tr '\n' ' ')
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
# 8. 表数机械校验（db/migrations）
#    migrations *.up.sql 中 CREATE TABLE 次数 − DROP TABLE 次数（grep -c 计数），
#    与 04-database-schema.md 头部「当前共 **N 张表**」比对。
# ---------------------------------------------------------------
echo "-- 8. 表数机械校验（migrations CREATE−DROP ↔ 04-database-schema.md 头部） --"
found=0
_create=$(grep -o 'CREATE TABLE' "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | wc -l)
_drop=$(grep -o 'DROP TABLE' "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | wc -l)
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
# 9. 机器码词汇表校验（Java 语义）
#    02-api-contract.md §4.2 机器码词汇表第一列（形如 | `ai_not_configured` |）
#    ↔ org.dromara.zhiyu 代码中 new ApiException(<数字>, "<机器码>", ...) 的机器码集合双向比对。
#    - 文档有、代码无 → violation（阻断）：词汇表登记了不存在的码。
#    - 代码有、文档无 → 提示（不阻断）：429 为数字 code 特例——限流实际响应 code 直接
#      返回数字 "429"，词汇表仅作映射兜底，不逐码登记；其余未登记码需确认是否补文档。
# ---------------------------------------------------------------
echo "-- 9. 机器码词汇表校验（02-api-contract.md §4.2 ↔ ApiException 机器码） --"
found=0
MC_DOC="docs/spec/02-api-contract.md"
MC_CODE_DIR="$MODULE_JAVA"
mc_doc_codes=$(sed -n '/^### 4\.2 /,/^### 4\.3 /p' "$MC_DOC" 2>/dev/null \
  | grep -E '^\| *`[a-z_0-9]+` *\|' | sed -E 's#^\| *`([a-z_0-9]+)`.*#\1#' | sort -u)
mc_code_codes=$(grep -rhoE 'new ApiException\(\s*[0-9]+,\s*"[a-z_0-9]+"' "$MC_CODE_DIR" --include='*.java' 2>/dev/null \
  | sed -E 's#.*"([a-z_0-9]+)"#\1#' | sort -u)
if [ -n "$mc_doc_codes" ] && [ -n "$mc_code_codes" ]; then
  mc_doc_only=$(comm -23 <(printf '%s\n' "$mc_doc_codes") <(printf '%s\n' "$mc_code_codes"))
  mc_code_only=$(comm -13 <(printf '%s\n' "$mc_doc_codes") <(printf '%s\n' "$mc_code_codes"))
  if [ -n "$mc_doc_only" ]; then
    violation "机器码词汇表登记了代码（new ApiException）不存在的码: $(echo "$mc_doc_only" | tr '\n' ' ')"
    found=1
  fi
  if [ -n "$mc_code_only" ]; then
    echo "  [提示] 代码（new ApiException）存在但 §4.2 词汇表未登记的码（请确认是否需补登记）: $(echo "$mc_code_only" | tr '\n' ' ')"
  fi
  [ "$found" -eq 0 ] && pass "机器码词汇表与 ApiException 机器码双向一致"
else
  pass "（未找到 §4.2 机器码词汇表或 ApiException 机器码，跳过）"
fi

# ---------------------------------------------------------------
# 10. 路由↔契约双向覆盖检查（提示级不阻断）
#     目标：拦「新增路由不写文档」（代码有、文档无）与「文档僵尸条目」（文档有、代码无）。
#     实现：
#       - 代码侧：扫描 org.dromara.zhiyu/controller 下所有 *.java（排除 *Test.java），
#         类级 @RequestMapping("/api/v1/xxx") 前缀 + 方法级 @GetMapping/@PostMapping/
#         @PutMapping/@DeleteMapping/@PatchMapping("path")（或 value="path"/数组首项；
#         无方法路径时用前缀本身）拼接成完整路径。
#       - 文档侧：解析 02-api-contract.md 与 partner-enterprise-platform.md 表格行
#         `| 方法 | /路径 | ... |`；方法列仅取 GET/POST/PUT/DELETE/PATCH 方法 token；
#         路径列支持 `、` 逗号分隔多路径、`/(POST)` 后缀、`{base}` 占位（含 {base} 的行跳过）；
#         相对路径条目按行内首路径的各级目录前缀尝试解析到代码路径。
#       - 规范化：去 /api/v1 前缀、{xxx}→{id}、去尾部 /、去重。
#       - 代码侧 /import/* /export/* /templates/* 由 02-api-contract.md §1.10「Excel 三件套」
#         模式化登记，提取时按模式剔除。
#       - 祖先覆盖：代码路径自身或任一级目录前缀命中文档路径即视为已登记。
#       - 豁免清单：scripts/spec-check-data/contract-exemptions.txt（每行一个规范化路径，# 注释）。
# ---------------------------------------------------------------
echo "-- 10. 路由↔契约双向覆盖（提示级） --"
EXEMPT_FILE="scripts/spec-check-data/contract-exemptions.txt"

extract_route_paths() {
  local f
  for f in $(find "$CONTROLLER_DIR" -name '*.java' -not -name '*Test.java' | sort); do
    awk '
      {
        line = $0
        # 类级前缀：@RequestMapping("/api/v1/xxx")（支持 value = "..." 写法，取首个引号串）
        if (prefix == "" && match(line, /@RequestMapping\([^)]*"[^"]+"/)) {
          seg = substr(line, RSTART, RLENGTH)
          if (match(seg, /"[^"]+"/)) {
            p = substr(seg, RSTART + 1, RLENGTH - 2)
            if (p ~ /^\//) prefix = p
          }
          next
        }
        # 方法级映射：@GetMapping / @GetMapping("/path") 等
        while (match(line, /@(Get|Post|Put|Delete|Patch)Mapping/)) {
          rest = substr(line, RSTART + RLENGTH)
          sub(/^[ \t]*/, "", rest)
          path = ""
          if (substr(rest, 1, 1) == "(") {
            end = index(rest, ")")
            if (end > 0) {
              args = substr(rest, 2, end - 2)
              # 取首个引号串（数组 {"a","b"} 取首项；value=/path= 写法同）
              if (match(args, /"[^"]+"/)) path = substr(args, RSTART + 1, RLENGTH - 2)
            }
          }
          if (path == "") print prefix
          else print prefix path
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
# 11. spec 随代码变更（阻断级）：Java controller/mapper + db/migrations 结构变更
#     未回写 docs/spec/ 即失败
# ---------------------------------------------------------------
echo "-- 11. spec 随代码变更（代码↔spec 耦合，阻断级） --"
if [[ -n "$BASELINE" ]]; then
  code_changes=$(git diff --name-only "$BASELINE" HEAD -- "$CONTROLLER_DIR" "$MAPPER_DIR" "$MIGRATIONS_DIR" 2>/dev/null | grep -vE 'Test\.java$')
  code_changes+=$'\n'"$(git diff --name-only HEAD -- "$CONTROLLER_DIR" "$MAPPER_DIR" "$MIGRATIONS_DIR" 2>/dev/null | grep -vE 'Test\.java$')"
  spec_changes=$(git diff --name-only "$BASELINE" HEAD -- docs/spec docs/系统功能清单.md 2>/dev/null)
  spec_changes+=$'\n'"$(git diff --name-only HEAD -- docs/spec docs/系统功能清单.md 2>/dev/null)"
  code_changes=$(printf '%s' "$code_changes" | grep -vE '^[[:space:]]*$' | sort -u | head -50)
  spec_changes=$(printf '%s' "$spec_changes" | grep -vE '^[[:space:]]*$' | sort -u)
  if [[ -n "$code_changes" ]]; then
    if [[ -z "$spec_changes" ]]; then
      if ! git log -1 --pretty=%B 2>/dev/null | grep -qE 'spec:nochange|spec\.skip'; then
        violation "代码结构变更但 docs/spec/ 未同步回写（spec-first 硬约束）："
        echo "$code_changes" | sed 's/^/         /'
        echo "         （纯重构/纯修复在 commit message 写 spec:nochange 声明豁免）"
      else
        pass "代码结构变更已声明 spec:nochange 豁免"
      fi
    else
      pass "代码结构变更已同步回写 spec"
    fi
  else
    pass "无代码结构变更，无需回写 spec"
  fi
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
# ---------------------------------------------------------------
# 13. 新端点租户归属校验（提示级，不阻断）：Java 侧租户隔离以 SQL 层 tenant_id 纵深防御为准
#     （AGENTS.md Java 契约无 controller 级 verifyTenantOwnership 硬要求）。
#     判据（文件级、保守）：本次变更集里的 controller 文件，若读取 @PathVariable
#     且整文件无 SystemGuard 引用 → 提示。
# ---------------------------------------------------------------
echo "-- 13. 新端点租户归属校验（提示级：@PathVariable 且无 SystemGuard） --"
OWNERSHIP_HINTED=0
if [[ -n "$BASELINE" ]]; then
  changed_ctl=$(git diff --name-only "$BASELINE" HEAD -- "$CONTROLLER_DIR" 2>/dev/null | grep '\.java$' | grep -v 'Test\.java$')
  changed_ctl+=$'\n'"$(git diff --name-only HEAD -- "$CONTROLLER_DIR" 2>/dev/null | grep '\.java$' | grep -v 'Test\.java$')"
  changed_ctl+=$'\n'"$(git diff --cached --name-only -- "$CONTROLLER_DIR" 2>/dev/null | grep '\.java$' | grep -v 'Test\.java$')"
  changed_ctl+=$'\n'"$(git ls-files --others --exclude-standard -- "$CONTROLLER_DIR" 2>/dev/null | grep '\.java$' | grep -v 'Test\.java$')"
  changed_ctl=$(printf '%s' "$changed_ctl" | grep -vE '^[[:space:]]*$' | sort -u)
  for f in $changed_ctl; do
    [[ -f "$f" ]] || continue
    grep -q '@PathVariable' "$f" || continue
    grep -q 'SystemGuard' "$f" && continue
    echo "  [提示] 本次变更的 controller 读取路径参数(@PathVariable)但无 SystemGuard 引用（Java 侧租户隔离以 SQL 层 tenant_id 纵深防御为准，请人工确认归属校验）：${f#"$MODULE_JAVA"/}"
    OWNERSHIP_HINTED=1
  done
  [ "$OWNERSHIP_HINTED" -eq 0 ] && pass "本次变更的 controller 均无 @PathVariable 归属校验隐患（或无变更）"
else
  pass "（非 git 仓库或无可比基线，跳过）"
fi

# ---------------------------------------------------------------
# 14. 新端点必须带测试（阻断级，DoD 3）
#     新增 controller/service/mapper 的 .java 文件必须有对应 src/test 测试：
#       测试路径规则（宽松判定）：
#         1) 测试树（src/test/java 下）存在同名 XxxTest.java（任意包）；
#         2) 或同包（main 包路径镜像到 src/test/java）下存在含类名子串的测试文件；
#         3) 无法精确匹配时按「同包存在任意测试文件」判定。
# ---------------------------------------------------------------
echo "-- 14. 新端点/新实现必须带测试（阻断级） --"
TEST_OK=1
TEST_ROOT="backend/java/ruoyi-modules/ruoyi-zhiyu/src/test/java"
if [[ -n "$BASELINE" ]]; then
  new_impl=$(git diff --name-status "$BASELINE" HEAD -- "$MODULE_JAVA" 2>/dev/null | grep -E '^A\s' | grep '\.java$' | grep -v 'Test\.java$' | awk '{print $2}')
  new_impl+=$'\n'"$(git diff --cached --name-status -- "$MODULE_JAVA" 2>/dev/null | grep -E '^A\s' | grep '\.java$' | grep -v 'Test\.java$' | awk '{print $2}')"
  new_impl+=$'\n'"$(git ls-files --others --exclude-standard -- "$MODULE_JAVA" 2>/dev/null | grep '\.java$' | grep -v 'Test\.java$')"
  new_impl=$(printf '%s' "$new_impl" | grep -vE '^[[:space:]]*$' | sort -u)
  for f in $new_impl; do
    case "$f" in
      */controller/*|*/service/*|*/mapper/*) ;;
      *) continue ;;
    esac
    cls=$(basename "$f" .java)
    # main 包路径镜像为 test 包路径（org/dromara/zhiyu/... 保持）
    pkgrel=$(dirname "$f" | sed -E 's#.*/org/dromara/zhiyu/#org/dromara/zhiyu/#')
    covered=""
    # 1) 同名 XxxTest.java（测试树任意位置）
    if find "$TEST_ROOT" -name "${cls}Test.java" 2>/dev/null | grep -q .; then covered=1
    # 2) 同包下含类名子串的测试（如 XxxServiceImplTest）
    elif [ -d "$TEST_ROOT/$pkgrel" ] && ls "$TEST_ROOT/$pkgrel" 2>/dev/null | grep -qE "${cls}[A-Za-z0-9_]*Test\.java"; then covered=1
    # 3) 同包存在任意测试文件
    elif [ -d "$TEST_ROOT/$pkgrel" ] && ls "$TEST_ROOT/$pkgrel"/*Test.java >/dev/null 2>&1; then covered=1
    fi
    if [[ -z "$covered" ]]; then
      violation "新增实现文件但无测试覆盖: $f（DoD 3：新接口必须附测试；测试放 src/test/java 同包或同名 XxxTest）"
      TEST_OK=0
    fi
  done
  [[ "$TEST_OK" == "1" ]] && pass "本次新增的 controller/service/mapper 文件均带测试（或非新增）"
else
  pass "（非 git 仓库或无可比基线，跳过）"
fi


echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ spec 硬约束校验失败：存在 $FAILED 处违规（详见上方 [违反] 行）" >&2
  exit 1
else
  echo "✓ spec 硬约束校验全部通过"
  exit 0
fi
