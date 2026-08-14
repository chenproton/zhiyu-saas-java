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
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

violation() { echo "  [违反] $*" >&2; FAILED=$((FAILED + 1)); }
pass()      { echo "  [通过] $*"; }

echo "== spec 硬约束校验 =="

# ---------------------------------------------------------------
# 1. 后端分层红线（refactor-layering.md / AGENTS.md「三、硬性架构约束」3.1 / ADR-0001）
# ---------------------------------------------------------------
echo "-- 1. 后端分层红线（handler 无裸 SQL / 直调 db.*） --"
HANDLER_DIR="backend/internal/handler"
SQL_KEYWORDS=("SELECT" "INSERT" "UPDATE" "DELETE" "ALTER TABLE" "CREATE TABLE")

found_sql=0
for f in "$HANDLER_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$f" in */testhelper/*) continue ;; esac
  for kw in "${SQL_KEYWORDS[@]}"; do
    if [ -n "$(grep -vE '^[[:space:]]*//' "$f" | grep -E "\b${kw}\b")" ]; then
      violation "handler 出现 SQL 关键字 ${kw}: $(basename "$f")"
      found_sql=1
    fi
  done
  if [ -n "$(grep -vE '^[[:space:]]*//|URL\.Query\(' "$f" | grep -E '\.(QueryRow|Query|Exec)(Context)?\(')" ]; then
    violation "handler 直接调用 DB 方法(.QueryRow/.Query/.Exec): $(basename "$f")"
    found_sql=1
  fi
  if grep -qE '\*pgxpool\.Pool|\*pgx\.Conn|\*sql\.DB|\*sql\.Tx' "$f" 2>/dev/null; then
    violation "handler 持有 DB 连接字段: $(basename "$f")"
    found_sql=1
  fi
done
[ "$found_sql" -eq 0 ] && pass "handler 层无裸 SQL / 直调 db.* / 持仓字段"

found_sql=0
SERVICE_DIR="backend/internal/service"
for f in "$SERVICE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  if [ -n "$(grep -vE '^[[:space:]]*//' "$f" | grep -E '\b(SELECT|INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE)\b')" ]; then
    violation "service 拼接 SQL: $(basename "$f")"
    found_sql=1
  fi
done
[ "$found_sql" -eq 0 ] && pass "service 层无拼接 SQL"

found=0
STORE_DIR="backend/internal/store"
for f in "$STORE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  if grep -qE '\*http\.Request|middleware\.CurrentUser|middleware\.Claims' "$f" 2>/dev/null; then
    violation "store 读取 HTTP/Claims: $(basename "$f")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "store 层不读 HTTP/Claims"

# ---------------------------------------------------------------
# 2. AI 统一底座红线（ai-development.md / AGENTS.md 3.2 / ADR-0002）
# ---------------------------------------------------------------
echo "-- 2. AI 统一底座红线 --"
found=0
for f in "$HANDLER_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$f" in */testhelper/*) continue ;; esac
  if [ -n "$(grep -vE '^[[:space:]]*//' "$f" | grep -E 'tenant_ai_configs|api_key|ApiKey|openai|anthropic|huggingface|deepseek|http\.(Post|Get|NewRequest|Client)')" ]; then
    violation "handler 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done
for f in "$SERVICE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$(basename "$f")" in ai.go|ai_*.go) continue ;; esac
  if [ -n "$(grep -vE '^[[:space:]]*//' "$f" | grep -E 'tenant_ai_configs|api_key|ApiKey|openai|anthropic|http\.(Post|Get|NewRequest|Client)')" ]; then
    violation "service 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "AI 功能未经 AIService 之外封装 LLM"

# ---------------------------------------------------------------
# 3. migration 配对（AGENTS.md 4.2）
# ---------------------------------------------------------------
echo "-- 3. migration 配对 --"
found=0
for up in backend/migrations/*.up.sql; do
  base="${up%.up.sql}"
  if [ ! -f "${base}.down.sql" ]; then
    violation "migration 缺 down: $(basename "$up")"
    found=1
  fi
done
for down in backend/migrations/*.down.sql; do
  base="${down%.down.sql}"
  if [ ! -f "${base}.up.sql" ]; then
    violation "migration 缺 up: $(basename "$down")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "migration up/down 全部配对"

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
  for adr in docs/decisions/[0-9][0-9][0-9][1-9]-*.md; do
    [ -f "$adr" ] || continue
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
  local fn
  for fn in "$@"; do
    local body
    body=$(awk -v fn="$fn" '
      index($0, "func (s *") && index($0, "Store) " fn "(") { infn=1; print; next }
      infn && /^func / { exit }
      infn { print }
    ' "$STORE_DIR/$file" 2>/dev/null)
    if [ -n "$body" ] && ! grep -q 'tenant_id' <<<"$body"; then
      violation "ADR-0003 关键写缺 SQL 租户条件: store/${file}::${fn}"
      found=1
    fi
  done
}
check_key_write_tenant users.go UpdateStatus ResetPassword
check_key_write_tenant tenant_admins.go ResetPassword
check_key_write_tenant exams.go AddQuestion FetchQuestion RemoveQuestion UpdateQuestionScore BulkUpdateScores RecalcExamTotal
[ "$found" -eq 0 ] && pass "ADR-0003 关键写 SQL 租户条件齐备"

_xss_hits=$(grep -rl 'dangerouslySetInnerHTML' apps/edu --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v node_modules | grep -v '.next')
if [ -n "$_xss_hits" ]; then
  echo "  [提示] 前端使用 dangerouslySetInnerHTML 的文件（请确认渲染的是否为用户/LLM 内容、是否已消毒）："
  for h in $_xss_hits; do
    echo "         ${h#apps/edu/}"
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
  mig_nums=$(ls backend/migrations/*.up.sql | sed -E 's#.*/([0-9]{3})_.*#\1#' | sort -u | tr '\n' ' ')
  for n in $mig_nums; do
    case " $doc_nums " in *" $n "*) ;; *) violation "migration ${n} 未登记进 04-database-schema.md §5 变更记录"; found=1 ;; esac
  done
  [ "$found" -eq 0 ] && pass "migrations 编号与 schema 变更记录一致"
else
  pass "（无 04-database-schema.md，跳过）"
fi

# ---------------------------------------------------------------
# 8. spec 随代码变更（提示级）
# ---------------------------------------------------------------
echo "-- 8. spec 随代码变更（代码↔spec 耦合）--"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse HEAD >/dev/null 2>&1; then
  code_changes=$(git diff --name-only HEAD -- backend/internal/router backend/internal/handler backend/migrations 2>/dev/null | grep -vE '_test\.go$' | head -50)
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

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ spec 硬约束校验失败：存在 $FAILED 处违规（详见上方 [违反] 行）" >&2
  exit 1
else
  echo "✓ spec 硬约束校验全部通过"
  exit 0
fi