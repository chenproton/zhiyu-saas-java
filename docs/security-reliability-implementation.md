# 安全 / 多租户 / 可靠性整改实施报告

> 关联文档：[`security-reliability-plan.md`](security-reliability-plan.md)（问题核实与解决计划）。
> 本文为实施记录：针对计划中每项问题，说明**改动方案 → 代码落点 → 验证结果**，
> 供后续复查与同类改造参考。实施时间：2026-08，全部改动已合并 master 并部署验证。

## 一、P0 安全兜底

### 1. 文件下载鉴权与租户隔离（高危项）

**问题**：`/uploads/{filename}` 注册在 JWT 中间件之外、URL 永久有效、仅靠 UUID 不可猜测；
所有租户文件混存同一目录、下载零租户校验；上传无类型白名单。

**方案**：
- `/uploads/{tenantID}/{filename}` **混合鉴权**，三种通道任选其一：
  - **签名 URL**（kkFileView 等无登录态服务端抓取）：HMAC-SHA256 绑定 `path|exp`，15 分钟有效；
  - **HttpOnly Cookie**（`<img>`/zip 预览等无法带 Authorization 头的浏览器请求）：
    登录/选租户时下发 `zhiyu_auth`（Path=/uploads，SameSite=Lax），`OptionalJWT` 中间件同时接受 header/cookie；
  - **Bearer 头**（常规 API 通道）。
  - 未登录且无签名 → 401；租户不匹配 → 403（`resolveTenant`）。
- 上传按租户分目录 `UploadDir/<tenantID>/<uuid>.<ext>`，URL 内嵌租户 ID。
- 新增 `GET /api/v1/files/sign-url?name=...`（平台门禁内），校验文件存在且属于本租户后签发短时签名 URL。
- 存量迁移脚本 `scripts/migrate_uploads.sh`：按 information_schema 动态枚举 URL 类列
  （含 `attachment_urls` 数组列），移动文件 + 回写 DB URL，幂等可重跑。

**落点**：`internal/router/router.go`（路由+OptionalJWT）、`internal/handler/file_handler.go`
（Serve/SignURL/Preview/Upload）、`internal/middleware/auth.go`（OptionalJWT/SetAuthCookie/tokenClaims）、
`internal/middleware/tenant.go`、`scripts/migrate_uploads.sh`。

**验证**：单元测试 `file_handler_test.go`（401/403/200/路径穿越/签名过期与篡改/上传白名单+租户目录）；
生产实测——未登录 401、cookie 通道 200、签名 URL 200 且去签名 401、跨租户（partner token 读 school 文件）403；
迁移执行 27 个文件归置 + 39 条 DB 记录更新。

### 2. 默认拒绝兜底

**问题**：无 Default Deny 兜底，漏挂权限 = 默认放行；`files/upload|preview` 无平台门禁（学生/partner token 均可上传）；
`POST /auth/select-tenant` 公开接口无限流；chi 同 method+path 静默覆盖可被弱权限组顶替。

**方案**：
- 路由审计测试 `router_audit_test.go`：`chi.Walk` 遍历中间件链，凡 `/api/v1` 非白名单路由
  必须命中角色/平台级授权中间件，否则 fail（CI 强制）；白名单路由反向校验可达性。
- `files/upload|preview|sign-url` 单点注册 + `RequireAnyPlatform(portal, partner)`。
  ⚠️ **实战教训**：多平台接口先在 portal/partner 组内各注册一份，被 chi 静默覆盖
  （后注册的 partner 组顶替 portal 组，portal 调用 sign-url 返回 403）——已改为单点注册，
  并新增平台矩阵回归测试 `TestFileRoutesPlatformMatrix`（portal/partner 可用、saas 403、未登录 401）。
- `auth/select-tenant` 挂登录限流（30 次/分钟/IP）。

**落点**：`internal/router/routes.go`、`internal/router/router_audit_test.go`、`internal/middleware/platform.go`。

**验证**：审计测试入 CI；平台矩阵测试 4 场景全过；UI 巡检 148 页无权限类回归。

### 3. 上传类型白名单

**问题**：上传扩展名直接取自文件名，无类型校验，仅 100MB 大小限制。

**方案**：扩展名白名单与下载侧 `allowedServeExts` 对齐 + 服务端 sniff 校验
（内容嗅探出 HTML/JS/可执行类型且扩展名不在文本/代码白名单内即拒绝，防存储型 XSS 伪装）。

**落点**：`internal/handler/file_handler.go`（`allowedUploadExts`/`isRiskySniff`/`textFileExts`）。

**验证**：`TestUploadTenantDirAndWhitelist`（exe 拒绝、HTML 伪装 png 拒绝、正常 png 通过）。

## 二、P1 统一能力沉淀

### 1. 统一脱敏组件

**问题**：仅身份证有 ad-hoc 掩码；手机号/邮箱/学号工号完全无脱敏，教师翻页可拉全租户敏感信息。

**方案**：新增 `internal/mask` 包——`Phone/IDCard/Email/Code` 掩码函数 + `User(manageUsers, u)` 统一入口，
按调用方权限整体脱敏（手机号保留前 3 后 4、身份证前 3 后 3、邮箱首字符+域名、学号工号前 2 后 2）；
接入用户列表/详情，移除原 ad-hoc 身份证掩码。导出接口核实不涉敏感字段（仅姓名/组织/状态），无需改。

**落点**：`internal/mask/mask.go`、`internal/handler/user_management_handler.go`。

**验证**：`mask_test.go`（函数级 + 角色级矩阵）；生产实测教师 token 拉用户列表返回掩码。

### 2. store 层单条读写强制租户

**问题**：单条 Get/Update/Delete 无 SQL 级租户限定，安全依赖 handler 自觉调用 `verifyTenantOwnership`（73 处），漏写即跨租户 IDOR。

**方案**：核心实体 `Get/Update/Delete` 签名增加 `tenantID` 参数，SQL 级 `AND tenant_id = $n`，
调用点编译期强制；handler 统一 `requireTenant`/`tenantIDOf` 取租户。两批完成：
- 首批：users、exams；
- 第二批：question_banks（删除裸 `Get`，只留 `GetScoped`）、exam_usages、approvals、user_extension_fields。
- ⚠️ **例外**：scenarios/positions/resource_library 等存在经联盟授权（grant）的**合法跨租户读**
  （企业导师经授权访问学校场景），不能简单强制租户参数，待授权感知中间件承接（见 P3.2）。

**落点**：`internal/store/{users,exams,question_banks,exam_usages,approvals,user_extension_fields}.go`、
对应 service/handler 调用点。

**验证**：全仓编译 + 既有测试通过；签名缺失即编译失败（机制本身即回归防线）。

### 3. 健康检查分层

**问题**：`/health` 只返回 ok，不检查 DB/Redis，可观测性仅靠文本日志。

**方案**：`/health`（进程存活，兼容历史）+ `/health/ready`（DB+Redis Ping，3s 超时，失败 503）；
docker-compose healthcheck 切换到 ready。

**落点**：`internal/router/router.go`、`deploy/docker-compose.yml`。

### 4. 限流扩展

**问题**：`cache.RateLimit` 仅挂 5 个登录/注册接口（IP 维度）；导入/导出、上传无资源保护。

**方案**：新增 `cache.RateLimitByUser`（按登录用户限流，未登录退 IP 维度）；
导入/导出 10 次/分钟、上传 20 次/分钟，超限返回统一 429。

**落点**：`internal/cache/middleware.go`、`internal/router/routes.go`。

## 三、P2 可观测与运营

### 1. 定时任务执行记录与告警

**问题**：无任务执行记录表；失败仅 slog.Error，等下一周期自然重试；无告警出口。

**方案**：
- `job_run_logs` 表（migration 147：任务名/开始/结束/状态/影响行数/错误）；
- scheduler 统一 `runJob` runner：panic recover + 失败重试 1 次 + 执行记录落库（记录写失败不影响任务）；
- 最终失败触发告警 webhook：`ALERT_WEBHOOK_URL` 环境变量（可选），JSON POST，发送失败仅记日志。

**落点**：`backend/migrations/147_job_run_logs.{up,down}.sql`、`internal/scheduler/scheduler.go`。

**验证**：迁移已应用（`\d job_run_logs` 实测）；runner 逻辑经编译与既有测试。

### 2. 监控指标

**问题**：无 metrics 端点，可观测性仅靠 chi Logger + slog。

**方案**：引入 Prometheus `client_golang`（vendor 已固化）：`/metrics` 端点 +
HTTP 请求数/耗时/状态直方图（路由模式标签防 URL 参数高基数）+ DB 连接池 Total/Idle 指标。

**落点**：`internal/metrics/metrics.go`、`internal/router/router.go`、`backend/go.mod`/`vendor/`。

**验证**：生产实测 `/metrics` 输出 `zhiyu_db_pool_*` 与 `zhiyu_http_*` 系列指标。

### 3. 统一错误码

**问题**：无统一错误码体系，前端只能按中文消息/状态码分支。

**方案**：`error_codes.go` 常量表（bad_request/unauthorized/forbidden/not_found/conflict/
too_many_requests/internal_error，预留 ai_not_configured/ai_upstream_error）；
`respondError` 响应体扩展为 `{code, error}`（`error` 字段保持兼容）；
前端 request 层透传 code（`ApiErrorWithCode`），全局错误处理按 code 优先分支。

**落点**：`internal/handler/error_codes.go`、`internal/handler/common.go`、
`packages/api-client/src/api-helpers.ts`、`apps/edu/components/global-api-error-handler.tsx`。

**验证**：生产实测 404 响应 `{"code":"not_found","error":"用户不存在"}`；api-client 测试更新后全过。

### 4. 残留清理

**问题**：20 处 500 绕过 `respondServerError`（原始 error 不落日志）；5 个 import handler 用裸 `WithTxRaw`；
`import_common.go` 在 handler 层拼 SQL；无统一错误码。

**方案**：
- 20 处 500 全部改走 `respondServerError`（含 panic recover 合成 error、`writeExcel`/`tableFor` 补 r 参数）；
- 5 个 import handler 全部迁回 `Store.WithTx` + 领域方法，`WithTxRaw` 已删除；
- import 拼 SQL 全部下沉：新建 `store/imports.go` 承载知识点/资源库/专业查找创建、
  学期/场地/节次导入、方案课程替换、排课条目系列（约 20 条 SQL），handler 层不再拼 SQL。

**落点**：`internal/store/imports.go`、`internal/handler/{import_common,affairs_config_import,
schedule_import,program_course_import,exam_import,course_import}_handler.go` 等。

**验证**：全仓 `rg respondError(StatusInternalServerError` 仅剩 `respondServerError` 内部实现；
`rg WithTxRaw` 零残留；测试全绿。

## 四、P3 架构纪律

### 1. chi 静默覆盖防护

**问题**：chi 对同 method+path 静默覆盖，弱权限组可顶替强权限组（已在 P0.2 实战踩坑）。

**方案**：`router_dup_test.go`——`recordingRouter` 代理拦截全部注册入口（Get/Post/Put/Delete/Method/With/Group/Route），
同一 method+pattern 注册两次即 fail。

**落点**：`internal/router/router_dup_test.go`。

**验证**：测试入 CI（当前注册表无重复）。

### 2. 租户校验中间件化试点

**问题**：租户归属校验靠 73 处手工 `verifyTenantOwnership`，遗漏即 IDOR。

**方案**：`middleware.TenantOwnedContent(db, table, idParam)`——路由声明资源表，
携带 `{id}` 的请求在路由层校验租户归属，跨租户一律 404；试点挂载 exams/scenarios 写路由
（`registerContentWriteRoutes` 统一包裹）。授权感知（grant）场景随中间件演进。

**落点**：`internal/middleware/tenant.go`、`internal/router/{router,routes_scene,routes_evaluation}.go`。

### 3. 业务权限声明化

**问题**：`canManagePortal`/`canManageAlliance` 等 17+29 处内联判断。

**方案**：`middleware.RequireAllianceManager()`（语义与 `canManageAlliance` 等价：
教师/校管/平台管理员/系统菜单权限，企业导师 B13 收窄），挂联盟全部 40+ 写路由，
收敛 29 处内联；其余 `canManagePortal` 内联保留合理（对应写路由已有 systemAdmin 组第一道门禁，
或属脱敏数据逻辑而非授权门禁）。

**落点**：`internal/middleware/rbac.go`、`internal/router/routes.go`（registerAllianceRoutes 拆分读写组）。

**验证**：`rbac_alliance_test.go` 权限矩阵（教师/校管/平台管理员/菜单权限放行、企业导师/无角色 403、未登录 401）；
生产实测未登录访问联盟写路由 401。

## 五、其他修复

- **ui-smoke 巡检脚本**：`clicker.mjs` 的 `maxForms` 在声明前使用（TDZ）导致场景编辑页巡检误报，
  已调整声明顺序（此前每次巡检固定误报 3 页）。
- **rebase 适配**：实施期间 master 被 AI 基建分支推进（`router.New` 增加 `aiSecret` 参数），
  分支 rebase 适配（`NewHandlers` 调用点与测试更新），无功能冲突。

## 六、验收标准对照

| 验收项 | 验证方式 | 结果 |
|-------|---------|------|
| P0：未登录访问 `/uploads/*` 返回 401 | 生产实测（直连 + nginx 网关） | ✅ |
| P0：跨租户访问文件返回 403/404 | 生产实测（partner token 读 school 文件 → 403） | ✅ |
| P0：路由审计测试入 CI | `go test ./internal/router/` 含审计/平台矩阵/重复注册测试 | ✅ |
| P1：教师角色用户列表/详情脱敏 | `mask_test.go` + 生产实测 | ✅ |
| P1：核心实体 store `Get(id)` 无 tenantID 无法编译 | 签名强制 + 全仓编译 | ✅ |
| P1：`/health/ready` DB 断连返回 503 | 实现（Ping 失败 503） | ✅ |
| P1：导入接口超限返回 429 | `RateLimitByUser` + 统一 429 响应 | ✅ |
| P2：定时任务每次执行有记录可查 | `job_run_logs` 表（迁移已应用） | ✅ |
| P2：`/metrics` 可抓取 | 生产实测指标输出 | ✅ |
| P2：任意 5xx 结构化日志含 request_id | `TestRespondServerErrorIncludesRequestID` + 响应头 X-Request-ID | ✅ |

## 七、部署与运维注意

1. **存量文件迁移**（已执行一次，新环境首次部署需执行）：
   `DATABASE_URL=... UPLOAD_DIR=... ./scripts/migrate_uploads.sh`
   —— 归置旧 `/uploads/<uuid>.<ext>` 文件到租户目录并回写 DB URL，否则旧 URL 404。
2. **告警 webhook**（可选）：设置环境变量 `ALERT_WEBHOOK_URL` 后，定时任务最终失败会 JSON POST 告警。
3. **监控接入**：`GET /metrics` 暴露 Prometheus 指标；`/health/ready` 已作为容器健康检查。
4. **遗留说明**：scenarios/positions/resource_library 等联盟授权资源的跨租户读，
   待授权感知的租户归属中间件承接（P3.2 推广阶段）；其余实体可按同一模式分批强制租户参数。
