# 知与 SaaS 开发契约

> **首要约束：禁止还原/覆盖他人代码。** 无论如何不得对工作区中非当次任务的文件执行 `git checkout`、`git restore`、`git reset` 等还原操作。部署时若遇到与本次任务无关的编译/类型错误，直接报错停止，告知用户即可，禁止擅自修复或还原他人未提交的修改。

## 一、分支隔离工作流

> 每个 Agent 基于 master 创建特性分支，开发提交后通过 `deploy.sh --branch` 部署验证，健康检查通过后自动合并回 master。

1. **创建独立工作树**：`git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>`
2. **开发并提交**：`git add -A && git commit -m "feat: 任务描述"`，然后 `git push -u origin <分支>`
3. **隔离部署验证**：`./deploy.sh --branch <分支名>`（可选 `--clean` 全量重建 / `--force` 破坏性操作 / `--skip-merge` 不自动合并）
4. **清理工作树**：`cd / && git worktree remove /tmp/<agent>`

deploy.sh 自动判断：首次运行 → 安装系统依赖、生成 .env、初始化数据库+种子数据；后续运行 → 源码 hash 比对，仅构建变更部分（前后端独立判断）；构建前自动质量门禁（后端 `gofmt -l` + `go vet`，DB 可用时 `go test`；前端 `pnpm typecheck` + `pnpm lint`）；数据库首次应用 baseline schema，后续仅增量 migration。

**并发安全**：deploy.sh 自带部署锁（`flock` `/tmp/zhiyu-deploy.lock`），多个 Agent 并发执行会自动排队串行（后到者打印"等待部署锁..."阻塞）；每次部署前先 fetch 并强制以最新 `origin/master` 构建，后部署者自动继承先部署者已合并的代码，不会互相覆盖。

关键约束：禁止直接在 master 上修改代码；部署前确保分支已推送；与 master 冲突先 `git rebase master`；多 Agent 并行各自 worktree 互不干扰。

## 二、交付要求

1. 所有**代码修改**后必须通过 `./deploy.sh --branch <分支名>` 部署验证，**无需等待用户确认，直接自动执行**
2. **纯文档修改**（`AGENTS.md`、`docs/` 下的文件）无需走 `deploy.sh`，直接 commit 合并即可
3. 提交前检查（本地验证通过后再提请部署）：
   ```bash
   cd backend && go vet ./... && go build ./... && gofmt -l .
   pnpm typecheck && pnpm lint && pnpm test
   ./scripts/spec-check.sh   # spec 硬约束（分层红线/AI 底座/migration 配对/spec 制品）
   ```
   migration 需配对 `.down.sql`
4. 单次 commit 只含当次变更
5. **后端分层红线**（完整规范见 [`docs/refactor-layering.md`](docs/refactor-layering.md)）：新增 handler 禁止出现 `SELECT/INSERT/UPDATE/DELETE`、禁止直接 `db.Query/QueryRow/Exec`、禁止持有 `*pgxpool.Pool` 字段（全量适用，含 import/export/template）；`service` 禁止拼接 SQL；`store` 禁止读取 HTTP/Claims；新接口必须附带 handler/service/store 测试至少一种

## 三、开发原则

- 简单优先，不过度防御；小概率异常宁可容忍
- 核心业务加锁防重复，普通业务允许报错或重复插入
- 核心接口保证流畅，非核心允许等待
- **组件复用优先**（规范见 [`docs/components.md`](docs/components.md)）：接到需求先判断能否复用现有组件/函数/模式，能复用直接使用；需抽象公共组件时先向用户提出方案、经确认后实施，并同场景一并改造
- **规格先行（spec-first）**：功能开发先读 `docs/spec/` 对齐意图，再写代码；新增/变更行为必须同步更新 spec，禁止「只改代码不改 spec」。完整规范见 [`docs/spec-standards.md`](docs/spec-standards.md)

## 四、运维速查

| 操作 | 命令 |
|------|------|
| 服务状态 | `docker compose ps` |
| 后端日志 | `docker compose logs zhiyu-backend --tail 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个tag>` 后 `./deploy.sh`，禁止手动登服务器改代码 |

**打包/迁移工具**（deploy.sh 之外的独立脚本）：

| 工具 | 命令 | 用途 |
|------|------|------|
| 离线实施包打包 | `./scripts/package-release.sh v1.0.0` | 生成 `release/zhiyu-saas-v1.0.0/` 交付目录与 tar.gz（无源码，客户机复制后执行 install.sh；需在可联网开发机执行，依赖本地 docker/go/pnpm 与 offline/ 资源） |
| 上传文件迁移 | `DATABASE_URL=… UPLOAD_DIR=… ./scripts/migrate_uploads.sh` | 把旧布局 `/uploads/<uuid>` 文件归置到租户子目录并回写 DB URL（幂等可重跑；deploy.sh 检测到旧布局文件时会提示执行） |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`PORT`）在 `.env` 配置，禁止提交仓库。

## 五、前端组件复用

> 新增页面先查阅速查表 [`docs/components.md`](docs/components.md) 与架构盘点 [`docs/forms-tables.md`](docs/forms-tables.md)；复用优先原则见「三、开发原则」。

## 六、AI 功能开发

> 所有 AI 功能（AI 助手对话、AI 辅助表单填写、AI 数据分析等）**必须基于 AIService 统一底座开发，禁止重新封装底层 LLM 调用**。完整架构与开发约定见 [`docs/ai-development.md`](docs/ai-development.md)。核心红线：

1. **LLM 调用一律经 `AIService`**（新 handler + 新 service 方法调 `AIService.Chat` / `ai.Client.ChatCompletion`）：禁止新建 LLM HTTP client、禁止直接查 `tenant_ai_configs` 或自行解密 api_key
2. **错误映射**：未配置 → 412 `ai_not_configured`（前端引导到 `/portal/apps/system/tenant`）；上游错误 → 502 + 上游 message；其余 500 → `respondServerError`
3. **密钥红线**：api_key 永不回传前端、禁止打印日志
4. **护栏**：新端点按场景设请求上限（参考 `POST /ai/chat`：messages ≤ 50、单条 ≤ 8000）；不自动重试；流式必须经 `ai.Client.ChatCompletionStream`

## 七、全站点击巡检（UI Smoke Test）

> 自动登录遍历每个页面（含弹窗/下拉/Tab/动态详情页），监控前端 console/JS 异常与后端接口报错，用于发现"点哪儿坏了"的回归问题。完整说明（安装、选项、账号、报告格式）见 [`scripts/ui-smoke/README.md`](scripts/ui-smoke/README.md)。

| 场景 | 命令 |
|------|------|
| 全量巡检（四角色 × 全部页面） | `node scripts/ui-smoke/ui-smoke.mjs` |
| 重构后定向巡检（只跑 git 改动涉及的路由） | `node scripts/ui-smoke/ui-smoke.mjs --git-diff` |
| 回归对比 / 单角色 / 单页调试 | `--baseline <上次报告>` / `--roles teacher` / `--route <路径>` |

要点：必须走 nginx 网关（默认 `http://127.0.0.1`）；依赖系统 Chrome，首次 `scripts/ui-smoke` 下 `npm install`；默认只操作 `SMOKE_` 前缀测试数据并自动清理。**默认不做端到端验证，除非用户主动要求**（见「八」第 7 条）。

## 八、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件
2. 忽略工作区中他人的未提交修改，不得还原或覆盖
4. 修改后先本地验证（编译、类型检查、lint），再**自动执行** `./deploy.sh --branch <分支名>` 分支部署验证；**全程实时监控 deploy.sh 输出**，禁止 `2>&1 | tail -20` 等截断方式只留尾部，必须让用户看到部署进展到哪一步
5. **前端样式修改永远不要主动验证**：禁止无头浏览器自动视觉验证，也禁止任何形式的主动验证手段（DOM/布局测量、CDP 脚本驱动、创建临时测试账号等）；样式问题一律在部署后由用户人工确认，改完代码直接提请部署即可
6. **代码扫描/统计只覆盖自有代码**：统计代码量、死代码/重复代码扫描、重构巡检时，以下第三方/工具代码与产物路径一律排除（不统计、不扫描、非任务要求不改动）：
   - `offline/`：离线部署资产与第三方图片编辑器（unlayer）资产的**唯一来源**（更新方式见 `offline/README.md`）
   - `apps/edu/public/image-editor`：指向 `offline/image-editor` 的符号链接；`deploy.sh` 构建时替换为实体文件（已 gitignore，禁止提交实体文件）
   - `backend/vendor/`：`go mod vendor` 产物；`deploy.sh` 以 `-mod=vendor` 构建，**不可移动位置**
   - `node_modules/`、`.next/`、`dist/`、`*.tsbuildinfo`、`logs/`：依赖目录与构建/运行产物
7. **默认不做端到端验证**：除非用户**主动要求**，不执行 UI Smoke 全站巡检、`--route` 单页巡检、浏览器自动化等端到端验证（包括新功能/修复完成后的验证环节）；本地验证以编译、类型检查、lint、单测为准，部署后的功能表现由用户人工确认

## 九、规格、文档与决策规范（spec-first 制度框架）

> 本仓库由 AI 主导开发，以下规范是把「AI 协作者如何正确地写规格、文档、文字、做决策」固化为制度，防止意图漂移、过度设计、误改。

### 9.1 规格（spec）规范

- 功能开发**先读 `docs/spec/` 对齐意图，再写代码**；新增/变更行为必须同步更新 spec（spec-first 硬约束）。
- spec 的分级、模板、DoD 验收标准、代码↔spec 一致性红线，以及「需求→规格→方案→任务→实现→校验→收敛」的 7 节点闭环：见 [`docs/spec-standards.md`](docs/spec-standards.md)。
- **硬约束自动校验**：每次提交前跑 `./scripts/spec-check.sh`（分层红线 / AI 底座 / migration 配对 / spec 五层齐备 / ADR 索引），拦截机器可判定的违规；语义一致性由 AI 在 analyze 节点补查。

### 9.2 文档规范（分层 · 砍废话）

- 文档分「教程 vs 参考」两类；每个事实只有一个「权威家」，其余用链接。
- 放置决策、教程/参考判定、砍「文档废话」清单：见 [`docs/documentation-standards.md`](docs/documentation-standards.md)。

### 9.3 文字品控（Prose 规范）

- 覆盖 Markdown / JSDoc / 代码注释 / 测试注释 / 提示词 / CLI·UI 文案：写够「保住契约」的文字，删掉「推理过程、重复、装饰」。
- 判定与各类型「保什么、砍什么」：见 [`docs/prose-standards.md`](docs/prose-standards.md)。

### 9.4 决策记录（ADR）

- 重要的、有取舍的架构决策写进 [`docs/decisions/`](docs/decisions/README.md)，记录「为什么这么做」；已接受决策不改写，改变则写新 ADR 并标注「取代」。
- 改动若与某 ADR 冲突 → 视为设计讨论，需明确报告，不得擅自推翻。

### 9.5 代码审查（审 PR / 审改动）

- 自动化门禁（gofmt/vet/typecheck/lint/test）只保证「编译/类型/格式正确」；「语义/契约/意图正确」需按 [`docs/code-review-checklist.md`](docs/code-review-checklist.md) 手动补查（分层红线、越权、生命周期、竞态、过度设计、AI 底座绕过）。

### 9.6 简化审计（找可简化处）

- 「找可简化之处」按 [`docs/simplification-notes.md`](docs/simplification-notes.md) 执行：给证据（调用点/consumer）、区分「简化 vs 改行为」、想法记成 Agent Note（提议态），**未确认前不改代码**。
