# 安全 / 多租户 / 可靠性问题核实与解决计划

> 本文针对外部评审提出的 5 类问题，基于当前 master 代码逐项核实（所有结论附 `文件:行号` 证据），并给出分级解决计划。
> 核实时间：2026-08；核实范围：`backend/`（handler → service → store → domain 分层）、`deploy/`、`scripts/`。
>
> **统计口径**：文中"全仓 N 处/个文件"均为本次核实时 `rg` 全仓扫描结果（2026-08 快照），代码演进后数字会漂移，结论以行号为锚点复核；行号在持续迭代中亦可能失效，复查时先按函数/路由名搜索。

## 一、总览

| # | 评审问题 | 核实结论 | 关键证据 |
|---|---------|---------|---------|
| 1 | 系统层面安全（密码明文、文件公开、越权、无默认拒绝） | **部分成立** | 密码防护到位；文件公开访问与无默认拒绝属实 |
| 2 | 缺乏 SaaS/多租户平台意识 | **部分成立** | 列表查询已强制租户；单条读写与文件存储是缺口 |
| 3 | 缺乏生产级可靠性设计 | **部分成立** | 定时任务多副本已防；执行记录/告警/限流覆盖/健康检查属实 |
| 4 | 缺乏平台化沉淀 | **部分成立** | 中间件骨架已具；租户校验/业务权限仍靠人肉纪律 |
| 5 | 前端/产品视角过强 | 定性评价 | 由 1-4 的证据侧面印证，见文末回应 |

## 二、逐项核实细节

### 1. 系统层面安全

**不成立的部分（先澄清事实）：**

- "密码可以通过接口明文返回" —— **不存在**。`backend/internal/domain/models.go:60` `PasswordHash` 标注 `json:"-"`，序列化层面排除；登录及用户相关接口另手动清空（`auth_handler.go:314-317`、`user_management_handler.go:124/186/262/334/396/499/661` 共 9 处）；store 层无 `SELECT *`，均为显式列清单。哈希算法统一 bcrypt cost 10（`store/users.go:75` 等），无 md5/sha256 混用。

**成立的部分：**

- **敏感信息无统一分级/脱敏（成立）**：仅用户详情一处对身份证做掩码（`user_management_handler.go:187-194`）；手机号、邮箱、学号/工号**完全无脱敏**，教师角色翻页即可拉全租户手机号（`user_management_handler.go:168-170` 只裁剪身份证/OAuth 字段）；无 mask 工具函数或数据分级框架。
- **文件可公开访问（成立，高危）**：`router/router.go:123` `/uploads/{filename}` 注册在 JWT 中间件**之外**；`file_handler.go:164` Serve 无登录/租户/签名校验，URL 永久有效，仅靠 UUID 不可猜测性。所有租户文件混存同一目录（`file_handler.go:88` 直接 `UploadDir/<uuid>.<ext>`），下载零租户校验。上传无文件类型白名单（`file_handler.go:82-84` 扩展名直接取自 `header.Filename`），仅 `MaxUploadSize` 100MB 限制（`file_handler.go:61`）。
- **权限无默认拒绝（成立）**：无 Default Deny 兜底中间件，漏挂权限 = 默认放行。`files/upload`、`files/preview` 虽在 JWT 组内（`router.go:125-130`），但无 `RequirePlatform`/角色门禁，学生/partner token 均可上传（`router.go:128-129`）。chi 对同 method+path **静默覆盖**，后注册弱权限组可顶替先注册强权限组（`routes.go:205-207`、`215-217` 注释自认）。`POST /auth/select-tenant` 公开接口未挂限流（`routes.go:45`）。

### 2. 多租户隔离

**已有基础：**

- 列表查询有统一强制机制：`ExecuteListQuery` 对 `TenantScoped: true` 的配置强制注入 `tenant_id = $n`，空租户直接返回 `ErrMissingTenant`（`store/query.go:397-406`）；全仓 66 处启用，并有 `whitelist_consistency_test.go` 回归测试。

**成立的部分：**

- **单条读写不统一（成立）**：`store/courses.go:316` SQL 级限定租户（`WHERE c.id = $1 AND c.tenant_id = $2`）；但 `store/users.go:460`（`fetchUser`，`WHERE id = $1`）、`store/exams.go:45/84/165/174`（Get/Delete/Update 均 `WHERE id = $1`）等无租户条件，安全完全依赖每个 handler 自觉调用 `verifyTenantOwnership`（`common.go:253-264`，全仓 73 处调用）——漏写即跨租户 IDOR，无机制兜底。
- **文件存储零租户隔离（成立）**：见上节，是当前最大盲区。

### 3. 可靠性

**不成立/好于预期的部分：**

- "定时任务是单实例思维，进程内锁无法支撑多副本" —— **不成立**。岗位能力汇聚任务使用 PG advisory lock（`scheduler/scheduler.go:54` `pg_try_advisory_lock(737001)`），多副本不会重复执行；写入为 upsert 幂等（`store/job_ability_results.go:413` `ON CONFLICT DO UPDATE`）。

**成立的部分：**

- **无执行记录/重试/告警（成立）**：无任务执行记录表；失败仅 `slog.Error`（`scheduler.go:28`），等下一周期自然重试；无任何告警出口。
- **限流覆盖极少（成立）**：`cache.RateLimit` 仅挂在 5 个登录/注册接口（`routes.go:40-44`，30 次/分钟）；导入/导出（`routes.go:320-339`）、上传、查询接口全无资源保护（仅有 10 分钟/30 秒超时兜底）。
- **健康检查形同虚设（成立）**：`/health` 只返回 `{"status":"ok"}`（`router.go:134-136`），不检查 DB/Redis；无 metrics 端点、无异常上报，可观测性仅靠 chi Logger + slog 文本日志。

### 4. 平台化沉淀

**已沉淀的能力（不应重复建设）：**

- 中间件骨架：JWT 认证（`middleware/auth.go`）、RBAC（`middleware/rbac.go`）、平台隔离（`middleware/platform.go`）、操作日志（`middleware/oplog.go`，写入路径唯一、异步批量落库）。
- 统一错误出口：`respondError`（101 个文件 1091 处）、`respondServerError`（84 个文件 496 处）。
- 统一事务模板：`Store.WithTx`（service 层 66 处采用，handler 层无裸 `db.Begin`）。

**成立的部分：**

- 租户解析/归属校验、模块级业务权限（`canManagePortal` 等 17 处内联）、缓存失效、输入校验仍依赖每个 handler"自己记得"，遗漏即出漏洞。
- 残留不一致：20 处 500 绕过 `respondServerError`（原始 error 不落日志）；5 个 import handler 用裸 `WithTxRaw`（`store.go:676-678` 注释已标注"存量 import 过渡用"）；`handler/import_common.go:369-421` 的 `findOrCreateKnowledgePoints`/`findOrCreateResources` 等函数在 handler 层直接拼 SQL 字符串（违反分层红线，虽未持有 `*pgxpool.Pool` 字段、走 `store.Queryer` 接口）；无统一错误码体系。

### 5. 关于"前端/产品视角过强"

属定性评价。从证据看：权限、数据边界、幂等、审计的**骨架已存在**（说明并非完全没有系统视角），但**兜底机制和强制机制缺失**——能力停留在"约成型"而非"机制型"，评审指出的维护成本随规模指数增长的风险成立。解决方向不是推翻现有分层，而是把约定升级为强制。

## 三、分级解决计划

### P0 — 安全兜底（先行，建议 1-2 周内完成）

| 项 | 改动位置 | 方案要点 | 工作量 |
|---|---------|---------|--------|
| 文件下载鉴权与租户隔离 | `router/router.go:123`、`handler/file_handler.go` | `/uploads` 移入 JWT 组；上传按租户分目录（`UploadDir/<tenantID>/<uuid>.<ext>`）；Serve/Preview 校验 `claims.TenantID` 与文件归属；写存量文件迁移脚本（按 resources 表归属归置） | 2-3 天 |
| 默认拒绝兜底 | `router/routes.go`、新增路由审计测试 | 新增测试遍历 `chi.Routes()`，凡认证组内路由必须命中角色/平台中间件白名单，否则 fail（CI 强制）；修复 `files/upload\|preview` 补 `RequirePlatform`；`auth/select-tenant` 补限流 | 1-2 天 |
| 上传类型白名单 | `file_handler.go:82-84` | 扩展名白名单 + 服务端 sniff 校验，与下载侧 `allowedServeExts` 对齐 | 0.5 天 |

### P1 — 统一能力沉淀（1 个月内）

| 项 | 改动位置 | 方案要点 | 工作量 |
|---|---------|---------|--------|
| 统一脱敏组件 | 新增 `internal/mask`（或 `domain/mask.go`），接入 `user_management_handler.go` | 按角色的字段级策略：手机号/身份证/邮箱掩码函数 + `MaskUser(claims, user)` 统一入口；先覆盖用户列表/详情/导出，替换现有 ad-hoc 实现 | 2-3 天 |
| store 层单条读写强制租户 | `store/users.go:460`、`store/exams.go:45/84/165/174` 等核心实体 | `Get/Update/Delete(id)` 签名增加 `tenantID` 参数，SQL 级限定（对齐 `courses.go:316` 模式）；调用点编译期强制，消除"靠 handler 记得" | 3-5 天（分批） |
| 健康检查分层 | `router/router.go:134` | `/health/live`（进程存活）与 `/health/ready`（DB+Redis Ping，带超时）分离；deploy 健康检查切换到 ready | 0.5 天 |
| 限流扩展 | `router/routes.go:320-339`、`router.go:128-129` | 复用 `cache.RateLimit`：导入/导出按用户 10 次/分钟、上传 20 次/分钟；超限返回统一 429 响应 | 1 天 |

### P2 — 可观测与运营（按需排期）

| 项 | 方案要点 |
|---|---------|
| 定时任务执行记录 | 新增 `job_run_logs` 表（任务名/开始/结束/状态/影响行数/错误）；`scheduler.go` 包统一 runner（记录 + panic recover + 失败重试 1 次）；告警先标准化错误日志格式，预留 webhook 出口 |
| 监控指标 | 引入 Prometheus client：`/metrics` 端点 + HTTP 请求数/耗时/5xx 率 + DB 连接池指标；nginx 侧暂不改动 |
| 统一错误码 | `respondError` 扩展为 `{code, message}`，建立错误码常量表；前端按 code 而非中文消息分支 |
| 残留清理 | 20 处 500 改走 `respondServerError`；5 个 import handler 从 `WithTxRaw` 迁回 `WithTx`；`handler/import_common.go` 拼 SQL 下沉到 store 层 |

### P3 — 架构纪律（随重构推进）

- **租户校验中间件化评估**：以 1-2 个模块试点"路由声明资源类型 → 中间件自动归属校验"模式，验证后推广，逐步收敛 73 处手工调用。
- **chi 静默覆盖防护**：路由注册测试增加同 method+path 冲突检测，注册即 fail。
- **业务权限声明化**：将 `canManagePortal` 等内联判断（17 处）收敛为路由组级声明。

## 四、不实施项（避免过度工程）

| 项 | 理由 |
|---|------|
| 密码存储/传输加固 | 已达 bcrypt cost 10 + `json:"-"` 双保险，无弱算法 |
| 定时任务分布式锁 | 已有 PG advisory lock，多副本安全 |
| 引入独立对象存储（MinIO/OSS） | P0 的目录隔离+鉴权已覆盖当前风险；待文件规模上来再评估 |
| 数据库行级安全（RLS） | store 层强制租户参数（P1）性价比更高，RLS 改造面过大 |
| 全链路 tracing / APM | 当前单体能级下 slog + Prometheus 足够，随多副本部署再引入 |

## 五、验收标准

- P0 完成后：未登录访问 `/uploads/*` 返回 401；跨租户访问文件返回 403/404；路由审计测试入 CI。
- P1 完成后：教师角色调用用户列表/详情，手机号/身份证为掩码；核心实体 store 层 `Get(id)` 无 tenantID 参数无法编译；`/health/ready` 在 DB 断连时返回 503；导入接口超限返回 429。
- P2 完成后：定时任务每次执行有记录可查；`/metrics` 可抓取；任意 5xx 均有结构化日志且含 request_id。

## 六、实施状态（2026-08）

| 项 | 状态 | 落点 |
|---|------|------|
| P0 文件下载鉴权与租户隔离 | ✅ 已实施 | `/uploads/{tenantID}/{filename}` 混合鉴权（签名 URL / cookie / Bearer）；上传按租户分目录；`/api/v1/files/sign-url` 签发短时签名 URL（15 分钟，HMAC-SHA256 绑定路径+过期时间）；存量迁移脚本 `scripts/migrate_uploads.sh`（按 information_schema 动态枚举 URL 类列，含数组列） |
| P0 默认拒绝兜底 | ✅ 已实施 | 路由审计测试 `router_audit_test.go`（chi.Walk 遍历中间件链，凡 `/api/v1` 非白名单路由必须命中角色/平台级授权中间件；白名单路由反向校验可达性）；`files/upload\|preview\|sign-url` 单点注册 + `RequireAnyPlatform(portal, partner)`（多平台接口重复注册会被 chi 静默覆盖，配平台矩阵回归测试）；`auth/select-tenant` 挂登录限流 |
| P0 上传类型白名单 | ✅ 已实施 | 上传扩展名白名单与下载侧 `allowedServeExts` 对齐 + 服务端 sniff（HTML/JS/可执行内容与扩展名不符即拒绝） |
| P1 统一脱敏组件 | ✅ 已实施 | `internal/mask` 包（手机号/身份证/邮箱/学号工号 + `User(manageUsers, u)` 入口），接入用户列表/详情（原 ad-hoc 身份证掩码移除） |
| P1 store 层单条读写强制租户 | ✅ 两批完成 | 首批：users/exams `Get/Update/Delete`；第二批：question_banks（删裸 `Get` 只留 `GetScoped`）、exam_usages、approvals、user_extension_fields 签名增加 tenantID，SQL 级 `AND tenant_id = $n`。**注意**：scenarios/positions/resource_library 等存在经联盟授权（grant）的合法跨租户读，不能简单强制租户，待 P3 授权感知中间件承接 |
| P1 健康检查分层 | ✅ 已实施 | `/health`（存活，兼容历史）+ `/health/ready`（DB+Redis Ping，3s 超时，失败 503）；docker-compose healthcheck 切到 ready |
| P1 限流扩展 | ✅ 已实施 | `cache.RateLimitByUser`（按用户限流，未登录退 IP）；导入/导出 10 次/分钟、上传 20 次/分钟 |
| P0 前端配套 | ✅ 已实施 | 登录/选租户下发 `zhiyu_auth` HttpOnly cookie（Path=/uploads，`<img>`/zip 预览零改动通过认证）；资源预览弹窗对 kkFileView 先换取签名 URL |
| P2 定时任务执行记录 | ✅ 已实施 | `job_run_logs` 表（migration 147）+ scheduler 统一 `runJob` runner（panic recover + 失败重试 1 次 + 执行记录落库，记录写失败不影响任务） |
| P2 监控指标 | ✅ 已实施 | Prometheus client_golang（vendor 已固化）：`/metrics` 端点 + HTTP 请求数/耗时/状态（路由模式标签防高基数）+ DB 连接池 Total/Idle 指标；middleware 挂 router 根部 |
| P2 统一错误码 | ✅ 已实施 | `error_codes.go` 常量表（bad_request/unauthorized/forbidden/not_found/conflict/too_many_requests/internal_error，预留 ai_not_configured/ai_upstream_error）；`respondError` 响应体扩展为 `{code, error}`（error 字段保持兼容）；前端 request 层透传 code，全局错误处理按 code 优先分支 |
| P2 残留清理 | ✅ 已实施 | 20 处 500 绕过全部改走 `respondServerError`（原始 error 落日志）；5 个 import handler 全部从 `WithTxRaw` 迁回 `WithTx`（`WithTxRaw` 已删除）；`import_common.go` 拼 SQL（knowledge_points/resource_library/majors 查找创建）下沉 `store/imports.go`；affairs-config/schedule 导入 SQL 一并下沉 store（`ImportTerm/ImportVenue/ImportPeriodSlot/ReplaceProgramCourses/SchedulePlanEntry` 系列），handler 层不再拼 SQL |
| P3 chi 静默覆盖防护 | ✅ 已实施 | `router_dup_test.go`：recordingRouter 代理拦截全部注册入口，同 method+pattern 重复注册即 fail（曾导致 `/files/sign-url` 被 partner 组顶替的同类问题不再复发） |
| P3 租户校验中间件化试点 | ✅ 试点完成 | `middleware.TenantOwnedContent(db, table, idParam)`：路由声明资源表，携带 `{id}` 的请求在路由层校验租户归属，跨租户一律 404；试点挂载 exams/scenarios 写路由（`registerContentWriteRoutes` 统一包裹），验证后推广；授权感知（grant）场景随中间件演进 |
| P3 业务权限声明化 | ⏳ 评估中 | 路由组（systemAdmin/businessUser/portalWorkspace/jobViewer）已构成声明层，17 处内联 `canManagePortal` 属更细粒度操作（联盟管理等），收敛方案待试点评估后随重构推进 |
| ui-smoke 巡检脚本 | ✅ 已修复 | `clicker.mjs` maxForms 在声明前使用（TDZ）导致场景编辑页巡检误报，已调整声明顺序 |

**部署注意（人工执行）**：`deploy.sh` 部署后需在服务停止写入窗口执行一次
`DATABASE_URL=... UPLOAD_DIR=... ./scripts/migrate_uploads.sh` 归置存量文件，否则旧 `/uploads/<uuid>.<ext>` URL 将 404。
