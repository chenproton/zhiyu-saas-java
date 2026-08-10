# 安全 / 多租户 / 可靠性问题核实与解决计划

> 本文针对外部评审提出的 5 类问题，基于当前 master 代码逐项核实（所有结论附 `文件:行号` 证据），并给出分级解决计划。
> 核实时间：2026-08；核实范围：`backend/`（handler → service → store → domain 分层）、`deploy/`、`scripts/`。

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

- "密码可以通过接口明文返回" —— **不存在**。`backend/internal/domain/models.go:60` `PasswordHash` 标注 `json:"-"`，序列化层面排除；登录及用户相关接口另手动清空（`auth_handler.go:314-317`、`user_management_handler.go:124/186/262/334/396/499/661` 等 10+ 处）；store 层无 `SELECT *`，均为显式列清单。哈希算法统一 bcrypt cost 10（`store/users.go:75` 等），无 md5/sha256 混用。

**成立的部分：**

- **敏感信息无统一分级/脱敏（成立）**：仅用户详情一处对身份证做掩码（`user_management_handler.go:189-199`）；手机号、邮箱、学号/工号**完全无脱敏**，教师角色翻页即可拉全租户手机号（`user_management_handler.go:168-173` 只裁剪身份证）；无 mask 工具函数或数据分级框架。
- **文件可公开访问（成立，高危）**：`router/router.go:123` `/uploads/{filename}` 注册在 JWT 中间件**之外**；`file_handler.go:164` Serve 无登录/租户/签名校验，URL 永久有效，仅靠 UUID 不可猜测性。所有租户文件混存同一目录（`file_handler.go:87-88`），下载零租户校验。上传无文件类型白名单（`file_handler.go:82-85`），仅 100MB 大小限制。
- **权限无默认拒绝（成立）**：无 Default Deny 兜底中间件，漏挂权限 = 默认放行。全量约 699 条路由中 18 条无角色校验，其中 `POST /files/upload`、`GET /files/preview`（`router.go:128-129`）连 `RequirePlatform` 都没有，学生/partner token 均可上传。chi 对同 method+path **静默覆盖**，后注册弱权限组可顶替先注册强权限组（`routes.go:198-199`、`212-213` 注释自认）。`POST /auth/select-tenant` 公开接口未挂限流（`routes.go:45`）。

### 2. 多租户隔离

**已有基础：**

- 列表查询有统一强制机制：`ExecuteListQuery` 对 `TenantScoped: true` 的配置强制注入 `tenant_id = $n`，空租户直接返回 `ErrMissingTenant`（`store/query.go:397-406`）；全仓 64 处启用，并有 `whitelist_consistency_test.go` 回归测试。

**成立的部分：**

- **单条读写不统一（成立）**：`store/courses.go:316` SQL 级限定租户（`WHERE c.id = $1 AND c.tenant_id = $2`）；但 `store/users.go:460`、`store/exams.go:218` 等为 `WHERE id = $1` 无租户条件，安全完全依赖每个 handler 自觉调用 `verifyTenantOwnership`（`common.go:253-264`，全仓 353 处手工调用）——漏写即跨租户 IDOR，无机制兜底。
- **文件存储零租户隔离（成立）**：见上节，是当前最大盲区。

### 3. 可靠性

**不成立/好于预期的部分：**

- "定时任务是单实例思维，进程内锁无法支撑多副本" —— **不成立**。岗位能力汇聚任务使用 PG advisory lock（`scheduler/scheduler.go:54` `pg_try_advisory_lock(737001)`），多副本不会重复执行；写入为 upsert 幂等（`store/job_ability_results.go:413` `ON CONFLICT DO UPDATE`）。

**成立的部分：**

- **无执行记录/重试/告警（成立）**：无任务执行记录表；失败仅 `slog.Error`（`scheduler.go:28`），等下一周期自然重试；无任何告警出口。
- **限流覆盖极少（成立）**：`cache.RateLimit` 仅挂在 5 个登录/注册接口（`routes.go:39-44`，30 次/分钟）；导入/导出（`routes.go:320-339`）、上传、查询接口全无资源保护（仅有 10 分钟/30 秒超时兜底）。
- **健康检查形同虚设（成立）**：`/health` 只返回 `{"status":"ok"}`（`router.go:134-136`），不检查 DB/Redis；无 metrics 端点、无异常上报，可观测性仅靠 chi Logger + slog 文本日志。

### 4. 平台化沉淀

**已沉淀的能力（不应重复建设）：**

- 中间件骨架：JWT 认证（`middleware/auth.go`）、RBAC（`middleware/rbac.go`）、平台隔离（`middleware/platform.go`）、操作日志（`middleware/oplog.go`，写入路径唯一、异步批量落库）。
- 统一错误出口：`respondError`（101 个文件 1085 处）、`respondServerError`（84 个文件 495 处）。
- 统一事务模板：`Store.WithTx`（service 层 115 处采用，handler 层无裸 `db.Begin`）。

**成立的部分：**

- 租户解析/归属校验、模块级业务权限（`canManagePortal` 等 52 处内联）、缓存失效、输入校验仍依赖每个 handler"自己记得"，遗漏即出漏洞。
- 残留不一致：19 处 500 绕过 `respondServerError`（原始 error 不落日志）；5 个 import handler 用裸 `WithTxRaw`（`store.go:625-628` 注释已标注"新代码不要用"）；无统一错误码体系。

### 5. 关于"前端/产品视角过强"

属定性评价。从证据看：权限、数据边界、幂等、审计的**骨架已存在**（说明并非完全没有系统视角），但**兜底机制和强制机制缺失**——能力停留在"约成型"而非"机制型"，评审指出的维护成本随规模指数增长的风险成立。解决方向不是推翻现有分层，而是把约定升级为强制。

## 三、分级解决计划

### P0 — 安全兜底（先行，建议 1-2 周内完成）

| 项 | 改动位置 | 方案要点 | 工作量 |
|---|---------|---------|--------|
| 文件下载鉴权与租户隔离 | `router/router.go:123`、`handler/file_handler.go` | `/uploads` 移入 JWT 组；上传按租户分目录（`UploadDir/<tenantID>/<uuid>.<ext>`）；Serve/Preview 校验 `claims.TenantID` 与文件归属；写存量文件迁移脚本（按 resources 表归属归置） | 2-3 天 |
| 默认拒绝兜底 | `router/routes.go`、新增路由审计测试 | 新增测试遍历 `chi.Routes()`，凡认证组内路由必须命中角色/平台中间件白名单，否则 fail（CI 强制）；修复 `files/upload\|preview` 补 `RequirePlatform`；`auth/select-tenant` 补限流 | 1-2 天 |
| 上传类型白名单 | `file_handler.go:82` | 扩展名白名单 + 服务端 sniff 校验，与下载侧 `allowedServeExts` 对齐 | 0.5 天 |

### P1 — 统一能力沉淀（1 个月内）

| 项 | 改动位置 | 方案要点 | 工作量 |
|---|---------|---------|--------|
| 统一脱敏组件 | 新增 `internal/mask`（或 `domain/mask.go`），接入 `user_management_handler.go` | 按角色的字段级策略：手机号/身份证/邮箱掩码函数 + `MaskUser(claims, user)` 统一入口；先覆盖用户列表/详情/导出，替换现有 ad-hoc 实现 | 2-3 天 |
| store 层单条读写强制租户 | `store/users.go`、`store/exams.go` 等核心实体 | `Get/Update/Delete(id)` 签名增加 `tenantID` 参数，SQL 级限定（对齐 `courses.go:316` 模式）；调用点编译期强制，消除"靠 handler 记得" | 3-5 天（分批） |
| 健康检查分层 | `router/router.go:134` | `/health/live`（进程存活）与 `/health/ready`（DB+Redis Ping，带超时）分离；deploy 健康检查切换到 ready | 0.5 天 |
| 限流扩展 | `router/routes.go:320-339`、`router.go:125` | 复用 `cache.RateLimit`：导入/导出按用户 10 次/分钟、上传 20 次/分钟；超限返回统一 429 响应 | 1 天 |

### P2 — 可观测与运营（按需排期）

| 项 | 方案要点 |
|---|---------|
| 定时任务执行记录 | 新增 `job_run_logs` 表（任务名/开始/结束/状态/影响行数/错误）；`scheduler.go` 包统一 runner（记录 + panic recover + 失败重试 1 次）；告警先标准化错误日志格式，预留 webhook 出口 |
| 监控指标 | 引入 Prometheus client：`/metrics` 端点 + HTTP 请求数/耗时/5xx 率 + DB 连接池指标；nginx 侧暂不改动 |
| 统一错误码 | `respondError` 扩展为 `{code, message}`，建立错误码常量表；前端按 code 而非中文消息分支 |
| 残留清理 | 19 处 500 改走 `respondServerError`；5 个 import handler 从 `WithTxRaw` 迁回 `WithTx` |

### P3 — 架构纪律（随重构推进）

- **租户校验中间件化评估**：以 1-2 个模块试点"路由声明资源类型 → 中间件自动归属校验"模式，验证后推广，逐步收敛 353 处手工调用。
- **chi 静默覆盖防护**：路由注册测试增加同 method+path 冲突检测，注册即 fail。
- **业务权限声明化**：将 `canManagePortal` 等内联判断（52 处）收敛为路由组级声明。

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
