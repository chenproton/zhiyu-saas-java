# 代码复查：backend/internal/middleware + backend/internal/router（2026-08-08）

复查方式：16 个文件逐一完整逐行通读；对修复提交 `1c2510cd`（admin 审计、限流 XFF、JWT 键名等）与 `541cfe6d` 做了 diff 核对；佐证阅读：cache/middleware.go（XFF 限流）、auth_handler.go（预授权令牌）、file_handler.go（上传/直出）、tenant_admin.go / cmd/seed/main.go（平台管理员 tenant_id）、batch_handler.go（通用批次）、student_honor_portrait/user_management（本人自限校验）。只读审查，未改代码。

复查结论总览：**P0 0 条，P1 0 条，P2 6 条，P3 16 条，合计 22 条**。

与上轮（2026-08-07）对比：
- **已修复**：auth_test.go 过期令牌用例键名 `userID` → `userId`（auth_test.go:152）；限流键改取 XFF（cache/middleware.go:87-100）；admin 路由挂 OperationLog（routes.go:255）。
- **修复引入回归 1 条（新发现）**：routes.go:255 的 OperationLog 与外层 routes.go:62 的 OperationLog 叠加 → `/admin/*` 写操作**双写审计日志**（详见 routes.go P2 条）。核实现有代码：平台管理员 seed 时 `tenant_id = OperatorTenantID` 非空（cmd/seed/main.go:87-96），外层 oplog 对 admin 操作本就生效，上轮 oplog.go:109-112 的 P2 判断前提不成立；本次追加的内层 oplog 造成重复。
- **上轮 P2/P3 全部遗留未修复**（本轮复查确认代码未变，逐条重列）。

重点核查结论（无新增 P1）：
- 所有 `/api/v1/*` 业务路由均在 JWT 组内（routes.go:60-62），公开端点仅 login（限流）、select-tenant（1 分钟预授权令牌）、theme、health、/uploads。
- 9+ 组同 method+path 双注册仍为"后注册 = 更宽门禁 + 同一 handler"的有意降权，逐条复核无越权窗口（依赖注释约定的注册顺序，脆弱契约 P2）。
- portal/saas 平台隔离（RequirePlatform）顺序正确：JWT → OperationLog → RequirePlatform，claims 先于 oplog 写入 context，操作日志正常记录。

---

## backend/internal/middleware/auth.go

- [P2][JWT 校验]（遗留）auth.go:53-57 — 中间件只校验"能解析 + 签名有效"，不强制 `claims.UserID != ""`。登录多租户流程签发的 `preAuthClaims`（auth_handler.go:159-169，含 `platform` 字段、无 `userId`）与正式令牌同密钥同 HS256，可被本中间件解析为 `Claims{Platform:"portal", UserID:""}` 并放行进入仅挂 `RequirePlatform` 的端点（`/auth/portal/me`、`/subscriptions`、`/stats/me` 等）：`PortalMe` 以空 UserID 查库、`SubscriptionHandler` 因 tenant 过滤拒绝，无数据泄露但属于令牌类型混淆缺口，且空 UserID 请求会打到 DB 查询（500 面）。最佳实践：解析成功后 `if claims.UserID == "" { 401 }`，天然排除 preAuthToken 及任何签名正确但结构不全的令牌。
- [P3][防御性]（遗留）auth.go:45-47 — 未用 `jwt.WithExpirationRequired()`，也未校验 issuer/audience。当前 `GenerateToken` 恒设 exp（7 天），未来新增签发路径漏设 exp 则令牌永不过期。最佳实践：加 `jwt.WithExpirationRequired()` 兜底。
- [P3][防御性]（遗留）auth.go:76-77 — `GenerateToken` 直接解引用 `input.User`，传 nil 即 panic（当前调用方均传非 nil）。最佳实践：入口 `if user == nil { return "", errors.New(...) }`。

## backend/internal/middleware/auth_test.go

无问题。`TestJWT_ExpiredToken` 的 MapClaims 键名已与真实 Claims 对齐（auth_test.go:152 `"userId"`，上轮 P3 已修复）；有效/无头/畸形/过期/错密钥/篡改六类用例覆盖完整，`TestJWT_TamperedToken` 篡改 payload 首字符后签名必然失配，断言正确。

## backend/internal/middleware/oplog_buffer.go

- [P2][oplog 缓冲]（遗留）oplog_buffer.go:63-69 — `flushLoop` 的 `defer recover()` 记录 panic 后让 goroutine 永久退出（done 关闭、循环终止），此后所有操作日志入队即丢弃且 `Shutdown()` 立即返回，整个审计管线不可自愈。最佳实践：recover 后不 return，继续外层 for 循环（或重启 goroutine）。
- [P2][oplog 缓冲]（遗留）oplog_buffer.go:121-125 — 批量 `br.Exec()` 错误处理不符合 pgx 语义：单行失败后后续 `Exec()` 复读同一错误，剩余行实际消费与否由服务端决定但本地一律记失败，且每行一条 warn 造成错误风暴。最佳实践：首个错误即 break，统一记一条"N 行成功/第 K 行失败"。
- [P3][oplog 缓冲]（遗留）oplog_buffer.go:50-56 — 缓冲满直接丢弃（有 warn，可接受）；`Shutdown()` 之后入队的条目既不落库也不告警。最佳实践：Shutdown 后 Enqueue 直接返回布尔或打一次 warn。

## backend/internal/middleware/oplog.go

- [P3][日志记录]（遗留）oplog.go:72,99-103 — 跳过名单 `strings.Contains(r.URL.Path, "/view")` 子串匹配，未来任何路径含 "/view" 的写操作会静默跳过日志（当前无意外命中）。最佳实践：按段匹配或显式白名单。
- [P3][日志记录]（遗留）oplog.go:74-82 — `statusRecorder` 未实现 `http.Flusher`/`Hijacker`/`Pusher`；当前 oplog 覆盖范围内无流式响应（file upload/preview 均不用 Flusher，已核实 file_handler.go:55-289），但未来新增流式端点时接口断言 panic。最佳实践：实现 `Flush()` 透传或对需要 Flusher 的路径排除 oplog。
- [P3][日志记录]（遗留）oplog.go:137-143 — buffer 为 nil 的兜底路径用 `r.Context()` 写库，客户端断开后落库必然失败（部署走 buffer 路径，无实际影响）。最佳实践：兜底路径用独立超时 context（同 oplog_buffer.go:106）。
- [P3][日志记录]（遗留）oplog.go:166-178 — `describeOperation`：targetType 取原始英文 URL 段（与 module 中文名风格不一致）；非 UUID 主键（数字 id）识别不到 targetID/targetType，日志为空。最佳实践：统一映射或明确仅支持 UUID。
- [P3][一致性]（本次确认）oplog.go:84-90 `ClientIP` 只用 RemoteAddr，而限流（cache/middleware.go:87-100）取 XFF 首段，两处口径不一致属有意设计（审计防伪造、限流需区分反代后端真实客户端），注释已声明，仅确认记录。

## backend/internal/middleware/platform.go

无问题。`RequirePlatform` 逻辑正确（claims 空 401、平台不符 403、匹配放行），依赖 JWT 先挂载（routes.go:60-66 顺序正确）。

## backend/internal/middleware/platform_test.go

无问题。portal/saas 双向隔离 + 无令牌共 5 个用例覆盖完整，断言正确。

## backend/internal/middleware/rbac.go

- [P3][授权模型]（遗留）rbac.go:56 — `RequireRoleOrMenu` 的"任意菜单权限 → 本组全部 GET 放行"豁免（上轮修复已限只读方法）仍是该组 GET 的唯一门禁：无业务角色的菜单用户可读 businessUser 组全部 GET（含 `/evaluation/exam-results`、`/evaluation/portraits`、组织架构、课表等租户级业务数据），边界完全依赖 handler 内按 userID/tenant 过滤。本轮抽查了 student_portrait / student_honor / user_management(UpdateMe/ChangeMyPassword) 的自限校验，均正确（本人限定 + 租户过滤）。最佳实践：维持现状（菜单桥接是产品需求），但新增 GET 路由时默认评估是否应挂更严格组。
- [P3][授权模型]（遗留）rbac.go:75-109 — 角色/菜单变更最长 7 天（令牌有效期）后才生效，期间被降权用户仍按旧 claims 访问，属会话式设计取舍。最佳实践：如可接受则忽略；否则缩短令牌有效期或关键接口按需查库。

## backend/internal/router/handlers.go

无问题。纯依赖装配；`courseBatchHandler`/`affairsBatchHandler` 传 `PositionService` 经核实（batch_handler.go:17-24 通用 `batchService` 接口 + store/batch_configs.go 表配置）是 5 类批次共用模板的有意设计，非装配错误；所有 handler 字段赋值完整。

## backend/internal/router/router.go

- [P2][未鉴权接口]（遗留）router.go:122 — `GET /uploads/{filename}` 完全公开（无 JWT、无租户隔离）：上传目录全局共享，获得 URL 即可读任意上传文件（作业附件、证件照、含个人信息的导入 Excel）。缓解：文件名 UUID v4 不可枚举、扩展名白名单 + `..` 拒绝 + 前缀校验（file_handler.go:164-189）防穿越与 XSS。最佳实践：至少要求 JWT；更进一步按租户子目录存储。
- [P3][配置]（遗留）router.go:116-119 — `UPLOAD_DIR` 默认 `../public/uploads` 依赖进程 CWD。最佳实践：改为基于可执行文件的绝对路径或 env 必填。
- [P3][配置]（遗留）router.go:105-107 — CORS 全放开，鉴权走 Authorization 头无 CSRF 面，风险可控；`Allow-Methods` 缺 PATCH/HEAD。最佳实践：维持现状。
- [P3][日志记录]（遗留）router.go:98-101 — `middleware.Logger` 记录完整请求 URL（含 query），未来敏感参数进查询串会入日志。最佳实践：保持 body 不入日志即可。
- [P3][资源控制]（本次确认）router.go:124-129 — `POST /api/v1/files/upload` 仅挂 JWT（无角色/平台/租户门禁），任何已登录用户（含学生）可反复上传 ≤100MB 文件（file_handler.go:19）到共享目录，无配额 → 跨租户磁盘耗尽面。最佳实践：加业务角色门禁 + 每用户/租户配额（可接受性由产品权衡）。

## backend/internal/router/routes.go

- [P2][日志记录]（**修复引入回归，本次新发现**）routes.go:255 — 上轮修复在 platformAdmin 组内追加 `r.Use(authmw.OperationLog(db, oplogBuffer))`，但该组已在外层全量鉴权组（routes.go:60-62 的 `OperationLog`）之内：`/admin/*` 写操作（租户 CRUD、管理员重置密码、订阅/主题变更）会**连续通过两层 OperationLog，双写两条相同 operation_logs 行**。核实现有数据模型：平台管理员 `tenant_id = OperatorTenantID` 非空（cmd/seed/main.go:87-96），外层 oplog 的 `claims.TenantID == nil` 提前返回（oplog.go:109-112）不会拦它——即上轮"admin 不记日志"的判断不成立，本轮修复反而造成重复。最佳实践：删除 routes.go:255 的内层 OperationLog（外层已全覆盖）；若意图是确保审计，应改为在 oplog.go 按角色/路径去重而非叠加中间件。
- [P2][路由注册]（遗留）routes.go:60-256 — 9+ 组同 method+path 双注册全部依赖 chi"后注册静默胜出"（已核实 chi tree.go `setEndpoint` 直接覆盖 handler 不报错），且全部为"后注册组 = 更宽门禁 + 同一 handler"的有意降权；任何分组顺序调整都会**静默**改变门禁。最佳实践：顶部集中注释表 + 新路由优先单次注册到最宽组。
- [P3][未鉴权接口]（遗留）routes.go:43 — `POST /auth/select-tenant` 公开且未挂限流（3 个登录接口均有 30/min IP 限流）；当前受 1 分钟预授权令牌 + JTI 一次性 nonce 保护（auth_handler.go:205-214），且 JTI 防重放依赖内存 map（进程重启后失效，P3 级可接受）。最佳实践：叠加 `loginLimiter`。
- [P3][性能]（遗留）routes.go:21-31 — `middleware.Timeout(d)(next)` 每请求新建中间件链且每条匹配路由重复构造。最佳实践：预构造两个包装 handler 复用。
- [P3][限流]（本次确认）routes.go:39-42 — 限流键取 XFF 首段（cache/middleware.go:87-100）：攻击者伪造 XFF 即绕开自身 IP 限流桶，可从单连接无限重放登录尝试（nginx 反代下 RemoteAddr 恒为代理地址，属权衡后的必然选择，注释已声明）。最佳实践：维持现状；若要加固，代理层剥离/覆写 XFF 后直连限流。

## backend/internal/router/routes_affairs.go

- [P3][路由注册]（遗留）routes_affairs.go:30-31 — `PUT/DELETE /affairs/teaching-plans/entries/{id}` 与 registerContentRoutes 的 `/{id}` 段数不同无冲突；`PUT /affairs/teaching-plans/entries`（少一段）会被 `{id}` 捕获进 Update 返回 400/404，无害边界。最佳实践：可不处理。
- （确认记录）routes_affairs.go:42-46 `PUT /affairs/period-slots/replace` 先于 `/{id}` 注册且 chi 静态段优先，无冲突；`/import/schedules/*`、`/templates/schedules` 等受 routes.go:24-27 的 10 分钟超时豁免，行为正确。

## backend/internal/router/routes_evaluation.go

无问题。静态/参数段注册顺序全部正确（`/job-ability/results/summary`、`/certifications/positions/...`、`/portraits/archives` 等静态段由 chi 静态优先保证）；学生可写端点（`POST /evaluation/exam-results`、`POST /evaluation/results`）与写门禁（grade/batch-grade 在 businessUser）划分清晰；`/evaluation/certifications/{id}/items` 与 `/evaluation/certifications/items/{id}/points` 静态段无捕获冲突。

## backend/internal/router/routes_job.go

无问题。`GET /job/positions/favorites`（L11）与 `GET /job/positions/{id}`（L6）静态优先无冲突；`/favorites` 系列与 jobViewer 组（routes.go:233-240）的双注册是有意降权；能力/证书/责任只读降权均指向同一 handler。

## backend/internal/router/routes_lesson.go

无问题。作业提交双注册（routes.go:108-109 与 L9）同为"jobViewer 后注册胜出、学生可提交"的有意设计（已复核：`POST /lesson/nodes/{nodeId}/homeworks/...` 与 `POST /lesson/courses/{id}/homeworks/...` 路径前缀不同，无互相覆盖）；`/lesson/quizzes/questions/{questionId}` 静态段先于 `/{id}` 匹配正确；behavior-collection 高频接口在 oplog 跳过名单内（oplog.go:72），符合设计。

## backend/internal/router/routes_library.go

无问题。静态段（stats/citation-stats/uncited）先于 `/{id}` 注册；student/jobViewer 降权覆盖（routes.go:217-221）指向同一 handler；无重复注册。

## backend/internal/router/routes_scene.go

无问题。`registerContentWriteRoutes` 仅注册写操作（GET 由 routes.go:90-94 jobViewer 承担）；`POST /scene/tasks/reorder` 静态段不冲突；rubric-templates/task-resources/task-bindings/weights/grade-mappings 无同 method+path 冲突。
