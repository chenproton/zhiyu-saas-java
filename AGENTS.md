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
   - ~~豁免冻结区~~：import/export/template 22 个 handler 已迁移（2026-08-09 取消冻结：Pool 字段移除、统一 Store 注入、SQL 查重下沉 store），全量适用分层红线
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

## 六、全站点击巡检（UI Smoke Test）

> 自动登录并遍历每个页面（含弹窗），监控前端 console / JS 异常 / 后端接口报错，用于发现"点哪儿坏了"的回归问题。详细说明见 [`scripts/ui-smoke/README.md`](scripts/ui-smoke/README.md)。

| 场景 | 命令 |
|------|------|
| 全量巡检（三角色 × 全部页面） | `node scripts/ui-smoke/ui-smoke.mjs` |
| 单角色快速巡检 | `node scripts/ui-smoke/ui-smoke.mjs --roles teacher` |
| 抓取后端容器日志增量 | `node scripts/ui-smoke/ui-smoke.mjs --tail-backend` |
| 只查一个页面（调试） | `node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system` |

要点：

- **必须走 nginx 网关**（默认 `http://127.0.0.1`），直连 3020 会导致 `/api/` 代理失败
- 依赖系统 Chrome（`channel: 'chrome'`），首次使用在 `scripts/ui-smoke` 下 `pnpm install` 即可
- 巡检账号：`school/school123`、`teacher/teacher123`、`student/student123`（portal 平台测试账号）
- **每页点完所有唯一可点元素**（含弹窗/下拉/Tab 切换后新出现的元素；表格每行按钮逐个点），弹窗只打开后 Esc 关闭，不污染数据；`--max-clicks` 仅作安全阀（默认 100）
- 报告输出到 `/tmp/zhiyu-ui-smoke/report.json`，`errors[].type` 中 `api` 即后端服务端错误信号；`status: skip` 为无权限页，属预期

## 七、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件
2. 忽略工作区中他人的未提交修改，不得还原或覆盖
3. 未经确认不得执行 `./deploy.sh`
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署
5. **前端样式修改永远不要主动验证**：禁止无头浏览器自动视觉验证，也禁止任何形式的主动验证手段（DOM/布局测量、CDP 脚本驱动、创建临时测试账号等）；样式问题一律在部署后由用户人工确认，改完代码直接提请部署即可
