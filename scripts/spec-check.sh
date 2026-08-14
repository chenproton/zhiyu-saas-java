#!/usr/bin/env bash
#
# spec-check.sh — Spec 模式的自动化硬约束校验
#
# 校验「能静态/可 grep 检测」的硬约束，补足 deploy.sh 质量门禁（gofmt/vet/build/test/typecheck/lint）
# 所不覆盖的「spec 一致性」硬红线。
#
# 注意：这**不是** spec↔代码的语义一致性校验（spec 说的有没有实现、代码做的有没有写进 spec），
# 那属于 AI 的 analyze 流程（见 docs/spec-standards.md 与 AGENTS.md「一、开发流程」）。本脚本只查可机械判定的硬约束。
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
# 1. 后端分层红线（refactor-layering.md / AGENTS.md「三、硬性架构约束」3.1 / ADR-0001）
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
  # DB 直调：.QueryRow( 或 .Query(/Exec(（含 *Context 变体），但排除 r.URL.Query()
  if grep -vE '^\s*//' "$f" | grep -qE '\.QueryRow(Context)?\('; then
    violation "handler 直接调用 DB 方法(.QueryRow): $(basename "$f")"
    found_sql=1
  fi
  if grep -vE '^\s*//' "$f" | grep -qE '\.(Query|Exec)(Context)?\(' | grep -qvE 'URL\.Query\('; then
    # 过滤出非 URL.Query 的 .Query/.Exec
    if grep -vE '^\s*//|URL\.Query\(' "$f" | grep -qE '\.(Query|Exec)(Context)?\('; then
      violation "handler 直接调用 DB 方法(.Query/.Exec): $(basename "$f")"
      found_sql=1
    fi
  fi
  # 持有 *pgxpool.Pool / *pgx.Conn 等 DB 连接字段（红线：handler 禁止持有连接池）
  if grep -qE '\*pgxpool\.Pool|\*pgx\.Conn|\*sql\.DB|\*sql\.Tx' "$f" 2>/dev/null; then
    violation "handler 持有 DB 连接字段: $(basename "$f")"
    found_sql=1
  fi
done
[ "$found_sql" -eq 0 ] && pass "handler 层无裸 SQL / 直调 db.* / 持仓字段"

# service 禁止拼接 SQL（含双引号/反引号 raw string 里含 SQL 关键字）
found_sql=0
SERVICE_DIR="backend/internal/service"
for f in "$SERVICE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  if grep -vE '^\s*//' "$f" | grep -qE '["`]([[:space:]]|\\n)*(SELECT|INSERT|UPDATE|DELETE|ALTER TABLE|CREATE TABLE)[[:space:]]' 2>/dev/null; then
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
# 2. AI 统一底座红线（ai-development.md / AGENTS.md「三、硬性架构约束」3.2 / ADR-0002）
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
# 3. migration 配对（AGENTS.md「四、交付与部署」4.2）
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
# 6. 安全红线（AGENTS.md 三.3 / ADR-0003）
#    ① store 层 UPDATE/DELETE 无 tenant_id 且无豁免注释
#    ② 前端 XSS：dangerouslySetInnerHTML 渲染未消毒内容
#    ③ 上传文件白名单（若存在上传路径）
#    （越权归属校验属语义，无法可靠 grep，靠 code-review-checklist 补查）
# ---------------------------------------------------------------
echo "-- 6. 安全红线 --"

# 6.1 store 层关键写操作缺租户条件（提示级别：ADR-0003 明确「哪些写需 SQL 纵深」属经验判断，
#     全文件级 grep 只能提示，不能硬拦；真正的越权靠 code-review-checklist 语义审查）
for f in "$STORE_DIR"/*.go; do
  [[ "$f" == *_test.go ]] && continue
  if grep -qE '\bUPDATE\b|\bDELETE\b' "$f" 2>/dev/null; then
    if ! grep -qE 'tenant_id|//nolint:tenant' "$f" 2>/dev/null; then
      echo "  [提示] store 写语句未发现租户条件（请确认属「handler 校验即可」的普通写，还是需补 SQL 纵深）: $(basename "$f")"
    fi
  fi
done

# 6.2 前端 XSS：dangerouslySetInnerHTML 渲染非字面量内容时提示（温和，不硬拦）
# 仅提示，因为 inline script 注入（读 localStorage 的启动脚本）是合法用法；真正 XSS 靠语义审查
_xss_hits=$(grep -rl 'dangerouslySetInnerHTML' apps/edu --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v node_modules | grep -v '.next')
if [ -n "$_xss_hits" ]; then
  echo "  [提示] 前端使用 dangerouslySetInnerHTML 的文件（请确认渲染的是否为用户/LLM 内容、是否已消毒）："
  for h in $_xss_hits; do
    echo "         ${h#apps/edu/}"
  done
fi

# ---------------------------------------------------------------
# 7. spec 随代码变更（spec-first 一致性：代码结构变更必须伴随 spec 变更）
#    检测「工作区/暂存相对 HEAD 的结构性代码变更」是否漏了 docs/spec/ 变更。
#    温和模式：只告警不 fail（纯重构/纯 bug 修复可声明豁免），AI 输出 [提示]。
#    commit message 带 spec:nochange 或 spec.skip 即豁免。
# ---------------------------------------------------------------
echo "-- 7. spec 随代码变更（代码↔spec 耦合）--"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse HEAD >/dev/null 2>&1; then
  # 结构性代码变更 = 路由 / handler / migration / store 表 / 前端页面
  code_changes=$(git diff --name-only HEAD -- backend/internal/router backend/internal/handler backend/migrations 2>/dev/null | grep -vE '_test\.go$' | head -50)
  spec_changes=$(git diff --name-only HEAD -- docs/spec docs/系统功能清单.md 2>/dev/null)
  # 豁免信号：commit message 或未提交改动里含 spec:nochange / spec.skip
  if [[ -n "$code_changes" ]]; then
    if [[ -z "$spec_changes" ]]; then
      # 查是否有豁免标记（未提交的 commit message 里，用最近的 commit msg 近似）
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
echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "✗ spec 硬约束校验失败：存在 $FAILED 处违规（详见上方 [违反] 行）" >&2
  exit 1
else
  echo "✓ spec 硬约束校验全部通过"
  exit 0
fi
