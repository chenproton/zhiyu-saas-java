# 知与 SaaS 开发契约

> 本仓库由 AI 完全主导开发：用户给需求，AI 按本契约走完「spec → 代码 → 校验 → 部署」全流程。**安全与架构合理是硬前提，任何功能都不得为了快速而牺牲这两条。**

## 零、三条铁律（任何改动前先读，违反即失败）

1. **禁止覆盖/还原他人代码**：不得对非当次任务的文件执行 `git checkout` / `git restore` / `git reset`。遇到与本次任务无关的编译/类型错误，报错停止并告知用户，禁止擅自修复他人未提交的修改。
2. **禁止破坏安全边界**：不新增越权路径（跨租户读数据）、不泄露密钥（api_key 不回传、不落日志）、不做 SQL 注入前端。
3. **禁止破坏架构分层**：遵守「三、硬性架构约束」的 handler/service/store 分层与 AI 统一底座，禁止绕过约束抄近路。

## 一、开发流程（接任务后先判类型，再走对应闭环）

> 判断任务类型 → 走对应流程。流程细节依据见 [`docs/spec-standards.md`](docs/spec-standards.md)「Spec 工作流」。

| 任务类型 | 判断标准 | 流程 |
|---|---|---|
| **新功能** | 增加能力 / 新模块 / 新接口 | 七节点闭环（见下） |
| **修复 bug** | 现有行为与 spec/预期不符 | 修复流程（见下） |
| **重构** | 行为不变，仅改结构/可读性 | 重构流程（见下） |

### （一）新功能：七节点闭环

1. **对齐意图**：读本契约 + 相关 `docs/*.md` + `docs/decisions/`（ADR），确认红线与既有决策。**不写代码**。
2. **明确需求**：把需求澄清为「做什么/为什么」，聚焦 **WHAT/WHY，不碰 HOW**（不写技术栈/表结构/代码组织）。不清楚就问用户。
3. **制定方案**：需求 → 数据模型 / API 契约 / 测试场景。**每个技术选择记录理由并回链需求**。选型需拍板时问用户。
4. **拆解任务**：生成可执行任务清单，标依赖与可并行项（`[P]`）。
5. **实现**：写代码 + 测试 + migration，**同时回写 spec**（spec-first 硬约束）。走「四、分支隔离工作流」。
6. **校验**：`./scripts/spec-check.sh`（硬约束）+ 语义自查（spec 说的有没有实现、代码做的有没有写进 spec）。
7. **收敛**：对照 spec 评估，把「没做完/偏航/新增件」记回任务或 spec，形成下轮输入。

### （二）修复 bug 流程

1. **定位意图**：先读 spec 与 ADR，确认「正确行为」（bug = 实现偏离了 spec/合理预期）。
2. **补测试**：先写/改能复现 bug 的测试（红）。
3. **修复**：改代码让测试通过（绿）。**若修复改变行为 → 同步 spec**；纯修复不改 spec，但 commit 说明。
4. **校验**：`spec-check.sh` + 本地门禁 + `deploy.sh --branch` 部署。

### （三）重构流程

1. **确认行为不变**：重构必须等价变换；若改可观察行为 → 走「新功能/修复」，不是重构。
2. **评估收益**：按 [`docs/simplification-notes.md`](docs/simplification-notes.md) 给证据（调用点），区分「真简化」vs「有意为之」（查 ADR）。
3. **执行**：改结构，**不同步 spec**（行为没变）。
4. **校验**：`spec-check.sh` + 全量门禁确认无回归 + 部署。

## 二、开发原则（写代码时的心法）

- **规格先行（spec-first）**：功能开发先读 `docs/spec/` 对齐意图再写代码；新增/变更行为必须同步 spec。见 [`docs/spec-standards.md`](docs/spec-standards.md)。
- **简单优先**：不过度防御；小概率异常宁可容忍；核心业务加锁防重复，普通业务允许报错或重复插入；核心接口保流畅，非核心允许等待。
- **组件复用优先**：接到需求先判断能否复用现有组件/函数/模式，能复用直接使用；需抽公共组件先向用户提方案、经确认后实施。前端速查见 [`docs/components.md`](docs/components.md)、[`docs/forms-tables.md`](docs/forms-tables.md)；后端速查见 [`docs/backend-reuse.md`](docs/backend-reuse.md)。
- **性能自检（温和，写代码时自问，不硬拦）**：涉及列表/批量/聚合的代码，写完自问——① 有没有循环内逐条 SQL（N+1）？应改 JOIN / `IN($N)` / 批量；② 列表/聚合查询有没有显式 LIMIT 或「数据量有界」的论证？③ 新增后台任务/goroutine 有没有超时 + panic 兜底 + 去重？④ 新增外部 HTTP 调用有没有设 timeout？「简单优先」指代码形状简单（一行 JOIN 与十行循环一样简单），不代表可以先写 N+1 再说。详见 [`docs/code-review-checklist.md`](docs/code-review-checklist.md)。

## 三、硬性架构约束（安全 + 架构合理的落地红线）

> 详细规范与理由见对应文档；这里只列「必须遵守」的硬条款，其余放文档。

### 3.1 后端分层红线（完整见 [`docs/refactor-layering.md`](docs/refactor-layering.md)，理由见 ADR-0001）

- **handler**：禁止出现 `SELECT/INSERT/UPDATE/DELETE`、禁止直接 `db.Query/QueryRow/Exec`、禁止持有 `*pgxpool.Pool`（全量适用，含 import/export/template）。
- **service**：禁止拼接 SQL。
- **store**：禁止读取 HTTP 请求/Claims。
- 新接口必须附带 handler/service/store 测试至少一种。

### 3.2 AI 统一底座红线（完整见 [`docs/ai-development.md`](docs/ai-development.md)，理由见 ADR-0002）

- LLM 调用一律经 `AIService`（`AIService.Chat` / `ai.Client.ChatCompletion`）：禁止新建 LLM HTTP client、禁止直接查 `tenant_ai_configs` 或自行解密 api_key。
- 错误映射：未配置 → 412 `ai_not_configured`；上游错误 → 502 + message；其余 → `respondServerError`。
- 密钥：api_key 永不回传前端、禁止打日志。
- 护栏：新端点设请求上限、不自动重试、流式经 `ai.Client.ChatCompletionStream`。

### 3.3 安全红线（越权 / 租户隔离，理由见 ADR-0003）

- 每个新端点必须做归属校验（`verifyTenantOwnership` / crud `CheckOwnership`）。
- 关键写操作（考试题目增删改分、密码/状态写）SQL 层补租户条件作纵深防御。
- 新端点写前自检五问：① 有没有跨租户读/写他租户数据？② 密钥/密码是否可能回传或落日志？③ 有没有 SQL 注入面？④ 上传文件是否会执行？⑤ 有没有未鉴权/越权匿名访问路径？

## 四、交付与部署（工具性流程）

### 4.1 分支隔离工作流

1. `git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>`
2. `git add -A && git commit -m "feat: 任务描述" && git push -u origin <分支>`
3. `./deploy.sh --branch <分支名>`（可选 `--clean` / `--force` / `--skip-merge`）
4. `cd / && git worktree remove /tmp/<agent>`

deploy.sh 自动：源码 hash 比对只构建变更部分；构建前质量门禁（后端 gofmt/vet + 前端 typecheck/lint）；DB 首次 baseline、后续增量 migration；部署锁保证并发串行。

### 4.2 提交前必跑（代码改动）

```bash
cd backend && go vet ./... && go build ./... && gofmt -l .
pnpm typecheck && pnpm lint && pnpm test
./scripts/spec-check.sh   # spec 校验：阻断级（分层/AI 底座/migration 配对+down 不可逆/spec 制品/ADR 索引/安全红线/schema↔migration 双向）+ 提示级（spec 耦合/XSS/路由契约），详见 spec-standards.md §九
```

migration 需配对 `.down.sql`；单次 commit 只含当次变更。

### 4.3 交付规则

- 代码修改后必须 `deploy.sh --branch` 部署验证（无需等确认，自动执行）；**全程实时看输出**，禁止只留尾部。
- 纯文档修改（`AGENTS.md`、`docs/`）无需 deploy，直接 commit。
- 做完在响应里报告：改了哪些文件、走了哪条流程、spec 是否同步、校验结果。

## 五、AI 协作者约定（协作纪律）

1. **只改当次任务相关文件**，不碰无关文件；忽略他人未提交修改，不得还原/覆盖。
2. **前端样式修改不主动验证**：禁止无头浏览器视觉验证、DOM/布局测量、CDP 脚本、创建临时测试账号等；样式问题部署后由用户人工确认。
3. **不做端到端验证（默认）**：不跑 UI Smoke / `--route` 单页 / 浏览器自动化，除非用户主动要求；本地验证以编译 + 类型检查 + lint + 单测为准。
4. **扫描/统计只覆盖自有代码**：排除 `offline/`、`apps/edu/public/image-editor`（符号链接）、`backend/vendor/`、`node_modules/`、`.next/`、`dist/`、`*.tsbuildinfo`、`logs/`。

## 六、规范索引（细则去哪找）

> 完整导航见 [`docs/README.md`](docs/README.md)。按需查，不要求通读。

| 我要 | 读 |
|---|---|
| spec 分级/模板/DoD/闭环 | [`spec-standards.md`](docs/spec-standards.md) |
| spec-first 执行手册（AI 技能，任务开始时加载） | [`.dsh/skills/spec-workflow/SKILL.md`](.dsh/skills/spec-workflow/SKILL.md) |
| 后端分层红线细节 | [`refactor-layering.md`](docs/refactor-layering.md) |
| AI 底座架构 | [`ai-development.md`](docs/ai-development.md) |
| 组件复用速查 | [`components.md`](docs/components.md) + [`forms-tables.md`](docs/forms-tables.md) |
| 后端复用速查 | [`backend-reuse.md`](docs/backend-reuse.md) |
| 安全非功能规范（密码/会话/密钥/限流/上传） | [`security-standards.md`](docs/security-standards.md) |
| 非功能规范（性能/可观测/国际化/测试） | [`non-functional-standards.md`](docs/non-functional-standards.md) |
| 架构决策为什么 | [`decisions/`](docs/decisions/README.md)（ADR） |
| 审 PR 语义检查 | [`code-review-checklist.md`](docs/code-review-checklist.md) |
| 写/审文档 | [`documentation-standards.md`](docs/documentation-standards.md) + [`prose-standards.md`](docs/prose-standards.md) |
| 找简化点 | [`simplification-notes.md`](docs/simplification-notes.md) |
| 快照版本机制 | [`resource-snapshot-versioning.md`](docs/resource-snapshot-versioning.md) |

## 七、运维速查（低频，用时查）

| 操作 | 命令 |
|------|------|
| 服务状态 | `docker compose ps` |
| 后端日志 | `docker compose logs backend --tail 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一tag>` 后 `./deploy.sh`（禁止手动登服务器改代码） |
| 离线实施包 | `./scripts/package-release.sh v1.0.0` |
| 上传文件迁移 | `DATABASE_URL=… UPLOAD_DIR=… ./scripts/migrate_uploads.sh` |
| UI 全站巡检 | `node scripts/ui-smoke/ui-smoke.mjs`（默认不做，见「五.3」） |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`AI_CONFIG_SECRET`、`PORT`）在 `.env` 配置，禁止提交仓库。
