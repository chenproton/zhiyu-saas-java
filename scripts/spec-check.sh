#!/usr/bin/env bash
#
# spec-check.sh — Spec 模式的自动化硬约束校验
#
# 校验「能静态/可 grep 检测」的硬约束，补足 deploy.sh 质量门禁（gofmt/vet/build/test/typecheck/lint）
# 所不覆盖的「spec 一致性」硬红线。
#
# 注意：这**不是** spec↔代码的语义一致性校验（spec 说的有没有实现、代码做的有没有写进 spec），
# 那属于 AI 的 analyze 流程（见 docs/spec-standards.md 与 AGENTS.md 九）。本脚本只查可机械判定的硬约束。
#
# 用法：
#   ./scripts/spec-check.sh            # 全量校验，任一项失败即非零退出
#   退出码 0 = 全部通过；非 0 = 有违规（打印到 stderr）
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

# 统一报告
violation() { echo "  [违反] $*" >&2; FAILED=1; }
pass()      { echo "  [通过] $*"; }

echo "== spec 硬约束校验 =="

# ---------------------------------------------------------------
# 1. 后端分层红线（refactor-layering.md / AGENTS.md 二.5 / ADR-0001）
#    handler 禁止出现裸 SQL 关键字与直接 db.Query/QueryRow/Exec（排除 _test.go）
# ---------------------------------------------------------------
echo "-- 1. 后端分层红线（handler 无裸 SQL / 直调 db.*） --"
HANDLER_DIR="backend/internal/handler"
SQL_KEYWORDS=("SELECT" "INSERT" "UPDATE" "DELETE" "ALTER TABLE" "CREATE TABLE")

found_sql=0
for f in "$HANDLER_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$f" in */testhelper/*) continue ;; esac
  for kw in "${SQL_KEYWORDS[@]}"; do
    # 只在非注释行查裸 SQL 关键字
    if grep -vE '^\s*//' "$f" | grep -qE "\b${kw}\b"; then
      violation "handler 出现 SQL 关键字 ${kw}: $(basename "$f")"
      found_sql=1
    fi
  done
  # DB 直调：.QueryRow( 或显式 db/pool/conn/q 前缀（排除 r.URL.Query()）
  if grep -vE '^\s*//' "$f" | grep -qE '\.QueryRow\(|\b(db|pool|conn|q)\.(Query|QueryRow|Exec)\('; then
    violation "handler 直接调用 DB 方法: $(basename "$f")"
    found_sql=1
  fi
done
[ "$found_sql" -eq 0 ] && pass "handler 层无裸 SQL / 直调 db.*"

# service 禁止拼接 SQL（粗略：service 目录出现 SQL 关键字视为可疑，但允许常量字符串列名）
found_sql=0
SERVICE_DIR="backend/internal/service"
for f in "$SERVICE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  if grep -vE '^\s*//' "$f" | grep -qE '"(SELECT|INSERT|UPDATE|DELETE) ' 2>/dev/null; then
    violation "service 拼接 SQL: $(basename "$f")"
    found_sql=1
  fi
done
[ "$found_sql" -eq 0 ] && pass "service 层无拼接 SQL"

# store 禁止读取 HTTP/Claims（粗略：store 目录出现 http.Request 或 middleware.Claims）
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
# 2. AI 统一底座红线（ai-development.md / AGENTS.md 六 / ADR-0002）
#    禁止 handler/service 新建 LLM HTTP client 或直接查 tenant_ai_configs / 解密 api_key
# ---------------------------------------------------------------
echo "-- 2. AI 统一底座红线 --"
found=0
# handler 层不得直接查 tenant_ai_configs / 解密 api_key / 引用底层 LLM client
# （AIService 底座本身在 service/ai*.go，属白名单；handler 应只经 *service.AIService）
for f in "$HANDLER_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$f" in */testhelper/*) continue ;; esac
  if grep -qE 'tenant_ai_configs|Decrypt|api_key|ApiKey|llm|LLM|openai|anthropic' "$f" 2>/dev/null; then
    violation "handler 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done
# service 层：仅 ai*.go（底座本身）可触碰上述信号，其余业务 service 不得
for f in "$SERVICE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  case "$(basename "$f")" in ai.go|ai_*.go) continue ;; esac
  if grep -qE 'tenant_ai_configs|decrypt.*[Aa]pi[Kk]ey|api_key' "$f" 2>/dev/null; then
    violation "service 疑似绕过 AIService 直连 LLM/配置: $(basename "$f")"
    found=1
  fi
done
[ "$found" -eq 0 ] && pass "AI 功能未经 AIService 之外封装 LLM"

# ---------------------------------------------------------------
# 3. migration 配对（AGENTS.md 二.3）
#    每个 *.up.sql 必须有同名 *.down.sql
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
#    docs/spec/ 必备五层是否齐备（01~05）
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
# 5. 决策记录 ADR 索引一致性（docs/decisions/README.md）
#    README 索引表里登记的文件必须都存在
# ---------------------------------------------------------------
echo "-- 5. ADR 索引一致性 --"
found=0
if [ -f docs/decisions/README.md ]; then
  # README 索引表登记形如「| 0001 | 标题 | ...」；按序号检查 docs/decisions/NNNN-*.md 是否存在
  for num in $(grep -oE '^\| [0-9]{4} \|' docs/decisions/README.md 2>/dev/null | grep -oE '[0-9]{4}' | sort -u); do
    if ! ls "docs/decisions/${num}-"*.md >/dev/null 2>&1; then
      violation "ADR 索引登记（${num}）但文件缺失"
      found=1
    fi
  done
  [ "$found" -eq 0 ] && pass "ADR 索引登记的决策文件存在"
else
  pass "（无 docs/decisions/README.md，跳过）"
fi

# ---------------------------------------------------------------
echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ spec 硬约束校验失败：存在 $FAILED 处违规（详见上方 [违反] 行）" >&2
  exit 1
else
  echo "✓ spec 硬约束校验全部通过"
  exit 0
fi
