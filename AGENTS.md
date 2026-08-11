# 知与 SaaS 开发契约

> **首要约束：禁止还原/覆盖他人代码。** 无论如何不得对工作区中非当次任务的文件执行 `git checkout`、`git restore`、`git reset` 等还原操作。部署时若遇到与本次任务无关的编译/类型错误，直接报错停止，告知用户即可，禁止擅自修复或还原他人未提交的修改。

## 一、分支隔离工作流

> 每个 Agent 基于 master 创建特性分支，开发提交后通过 `deploy.sh --branch` 部署验证，健康检查通过后自动合并回 master。

### 工作流程

1. **创建独立工作树**
   ```bash
   git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>
   ```

2. **开发并提交**
   ```bash
   git add -A && git commit -m "feat: 任务描述"
   git push -u origin feat/<agent>-<任务简述>
   ```

3. **隔离部署验证**
   ```bash
   ./deploy.sh --branch feat/<agent>-<任务简述>
   # 可选：--clean（强制全量重建）、--force（允许 docker builder prune 等破坏性操作）、--skip-merge（不自动合并）
   ```
   deploy.sh 自动判断：
   - 首次运行 → 安装系统依赖、生成 .env、初始化数据库+种子数据
   - 后续运行 → 源码 hash 比对，仅构建变更部分（后端/前端独立判断）
   - 构建前自动执行质量门禁：后端 `gofmt -l` + `go vet`（DB 可用时 `go test`），前端 `pnpm typecheck` + `pnpm lint`
   - 数据库 → 首次应用 baseline schema，后续只执行增量 migration，不触碰已有数据

4. **清理工作树**
   ```bash
   cd / && git worktree remove /tmp/<agent>
   ```

### 关键约束

- 禁止直接在 master 上修改代码
- 部署前确保分支已推送
- 若与 master 冲突，先 `git rebase master` 解决
- 多个 Agent 并行开发时，各自在不同 worktree 中互不干扰

## 二、交付要求

1. 所有**代码修改**后必须通过 `./deploy.sh --branch <分支名>` 部署验证
2. **纯文档修改**（`AGENTS.md`、`docs/` 下的文件）无需走 `deploy.sh`，直接 commit 合并即可
3. 提交前检查（本地验证通过后再提请部署）：
   ```bash
   cd backend && go vet ./... && go build ./... && gofmt -l .
   pnpm typecheck && pnpm lint && pnpm test
   ```
   migration 需配对 `.down.sql`
4. 单次 commit 只含当次变更
5. **后端分层重构**（详见 `docs/refactor-layering.md`）：
   - 目标架构：`handler`（HTTP 适配，不拼 SQL）→ `service`（业务编排+事务）→ `store`（唯一 SQL 所在）→ `domain`（模型）
   - **新增** handler 中出现 `SELECT/INSERT/UPDATE/DELETE` 字符串，或直接调用 `db.Query/QueryRow/Exec` → 禁止合并
   - 新增 handler 禁止持有 `*pgxpool.Pool` 字段
   - 分层红线全量适用：所有 handler（含 import/export/template）统一执行
   - `common.go` 新增函数必须说明为何不能放入 store 层；`service` 禁止拼接 SQL；`store` 禁止读取 HTTP/Claims
   - **复用范例**：内容通用动作复用 `store.ContentActionStore`（`store/content_actions.go`）；新增 handler 的 500 错误统一用 `respondServerError`（记录原始 error 后返回通用响应）
   - 新接口必须附带 handler/service/store 测试至少一种

## 三、开发原则

- 简单优先，不过度防御；小概率异常宁可容忍
- 核心业务加锁防重复，普通业务允许报错或重复插入
- 核心接口保证流畅，非核心允许等待
- **组件复用优先**：接到需求时，先判断能否复用现有组件/函数/模式。若能复用则直接使用。若不能复用但判断该模式可能在系统中反复出现，应评估是否需要抽象为公共组件，向用户提出方案并经确认后再实施，同时将系统中类似场景一并改造，最大化复用价值

## 四、运维速查

| 操作 | 命令 |
|------|------|
| 服务状态 | `docker compose ps` |
| 后端日志 | `docker compose logs zhiyu-backend --tail 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个tag>` 后 `./deploy.sh`，禁止手动登服务器改代码 |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`PORT`）在 `.env` 配置，禁止提交仓库。

## 五、前端公共组件

> 新增页面时先查阅组件速查表：[`docs/components.md`](docs/components.md)

## 六、AI 基建（统一调用底座）

> 所有 AI 功能（AI 助手对话、AI 辅助表单填写、AI 数据分析等）**必须基于本底座开发，禁止重新封装底层 LLM 调用**。

### 架构

```
租户在 /portal/apps/system/tenant 配置 base_url / api_key / model（OpenAI 兼容协议）
  → tenant_ai_configs 表（api_key AES-256-GCM 加密存储；密钥取 AI_CONFIG_SECRET，缺省回落 JWT_SECRET）
  → service.AIService（Redis 读穿缓存 ai:cfg:{tenantID}，TTL 10min，Redis 故障降级直查 DB）
  → ai.Client（OpenAI 兼容 chat completions 网关；共享连接池，60s 超时）
```

关键文件：

- 网关客户端：`backend/internal/ai/client.go`（`ChatCompletion`，支持 `temperature`/`max_tokens`/`response_format` 透传，返回 `Usage`）
- 业务编排：`backend/internal/service/ai.go`（`AIService`：配置管理 + `Chat`，缓存与加解密都在这层）
- 存储：`backend/internal/store/ai_config.go`、`backend/internal/store/ai_usage.go`（用量记录）；加密：`backend/internal/crypto/aes.go`
- 现有端点：`GET/PUT/DELETE /ai/config`、`POST /ai/chat`、`GET /ai/usage`（用量统计：`backend/internal/handler/ai_handler.go`）
- 前端 API：`packages/api-client/src/api/ai.ts`；对话页：`apps/edu/app/portal/apps/ai/chat/page.tsx`

### 新增 AI 功能的开发约定

1. **LLM 调用一律经 `AIService`**：新功能 = 新 handler 端点 + 新 service 方法，内部调 `AIService.Chat` / `ai.Client.ChatCompletion` 拿结果。禁止：
   - 新建 LLM HTTP client、重新封装 OpenAI 协议调用
   - 直接查 `tenant_ai_configs` 表或自行解密 api_key（读取配置必须经 `AIService`，缓存/解密已内置）
2. **错误约定**：未配置 → `service.ErrAINotConfigured`（handler 映射 412 `ai_not_configured`，前端引导去租户信息页配置）；上游错误 → `*ai.UpstreamError`（映射 502 + 上游 message，不透传上游原始 body）；其余 500 → `respondServerError`
3. **密钥红线**：api_key 永不回传前端（domain 字段 `json:"-"`，对外视图只给 `maskAPIKey` 脱敏值）；禁止在日志中打印 api_key
4. **请求护栏**：新端点沿用 `POST /ai/chat` 的思路（messages ≤ 50 条、单条 ≤ 8000 字符），按场景自定上限，防止单请求打爆租户额度
5. **不自动重试**：chat completions 非幂等且按 token 计费，失败返回前端由用户重发
6. **流式扩展**：需要流式对话时，在 `ai.Client` 增加 `ChatCompletionStream`（解析 SSE + `http.Flusher` 透传）并新增端点，不得绕过 client 直接手写 SSE 调用上游
7. **用量落库**：LLM 调用产生的 token 用量已由 `AIService.Chat` 自动写入 `ai_usage_logs`（上游成功后 best-effort，失败不影响响应），复用 Chat 的新 AI 功能无需额外处理；若有绕过 Chat 的新调用路径，也必须自行记录用量
8. 前端调用经 `packages/api-client` 新增方法（`portalRequest` 等）；收到 412 统一引导到 `/portal/apps/system/tenant` 完成配置

## 七、全站点击巡检（UI Smoke Test）

> 自动登录并遍历每个页面（含弹窗/下拉/Tab/动态详情页），监控前端 console / JS 异常 / 后端接口报错，用于发现"点哪儿坏了"的回归问题（重点场景：代码重构后检查每个页面是否报错）。详细说明见 [`scripts/ui-smoke/README.md`](scripts/ui-smoke/README.md)。

| 场景 | 命令 |
|------|------|
| 全量巡检（四角色 × 全部页面，含动态详情页） | `node scripts/ui-smoke/ui-smoke.mjs` |
| 重构后定向巡检（只跑 git 改动涉及的路由） | `node scripts/ui-smoke/ui-smoke.mjs --git-diff` |
| 回归对比（新增/已修复/持续错误） | `node scripts/ui-smoke/ui-smoke.mjs --baseline <上次报告>` |
| 单角色快速巡检 | `node scripts/ui-smoke/ui-smoke.mjs --roles teacher` |
| 抓取后端容器日志增量 | `node scripts/ui-smoke/ui-smoke.mjs --tail-backend` |
| 只查一个页面（调试） | `node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system` |

要点：

- **必须走 nginx 网关**（默认 `http://127.0.0.1`），直连 3020 会导致 `/api/` 代理失败
- 依赖系统 Chrome（`channel: 'chrome'`），首次使用在 `scripts/ui-smoke` 下 `npm install` 即可
- 巡检账号：`school/school123`、`teacher/teacher123`、`student/student123`（portal 平台测试账号，`--account` 可覆盖）；`partner`（企业端独立门户）默认 `smokepartner/smoke123`，账号不存在时自动注册巡检企业「巡检测试企业」
- **每页点完所有唯一可点元素**（含弹窗/下拉/Tab 切换后新出现的元素；表格每行按钮逐个点），弹窗只打开后 Esc 关闭，不污染数据；`--max-clicks` 仅作安全阀（默认 100）
- 动态路由（`[id]` 详情/编辑页）自动从后端拉真实实体 id 巡检；无权限页自动识别记为 `skip`
- 危险词表中英双语（保存/删除/禁用/创建等）默认跳过写数据按钮，语言切换按钮不点，防止污染数据
- `--test-forms` 开启表单自动填充+提交测试（测试租户专用），提交数据统一 `SMOKE_` 前缀，结束后自动清理；复杂字段可在 `smoke.config.json` 的 `routeOverrides` 中按路由配置 `skipFormFields` 与 `maxFormSubmits`
- 报告输出到 `/tmp/zhiyu-ui-smoke/report.json`，含错误聚合（去重）与基线 diff；`errors[].type` 中 `api` / `form` 为后端/表单错误信号，`auth`（401/403）与 `rate-limit`（429）不计错误；`status: skip` 为无权限页，属预期

## 八、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件
2. 忽略工作区中他人的未提交修改，不得还原或覆盖
3. 未经确认不得执行 `./deploy.sh`
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署
5. **前端样式修改永远不要主动验证**：禁止无头浏览器自动视觉验证，也禁止任何形式的主动验证手段（DOM/布局测量、CDP 脚本驱动、创建临时测试账号等）；样式问题一律在部署后由用户人工确认，改完代码直接提请部署即可
6. **代码扫描/统计只覆盖自有代码**：统计代码量、死代码/重复代码扫描、重构巡检时，以下第三方/工具代码与产物路径一律排除（不统计、不扫描、非任务要求不改动）：
   - `offline/`：离线部署资产与第三方图片编辑器（unlayer）资产的**唯一来源**（更新方式见 `offline/README.md`）
   - `apps/edu/public/image-editor`：指向 `offline/image-editor` 的符号链接；`deploy.sh` 构建时替换为实体文件（已 gitignore，禁止提交实体文件）
   - `backend/vendor/`：`go mod vendor` 产物；`deploy.sh` 以 `-mod=vendor` 构建，**不可移动位置**
   - `node_modules/`、`.next/`、`dist/`、`*.tsbuildinfo`、`logs/`：依赖目录与构建/运行产物
