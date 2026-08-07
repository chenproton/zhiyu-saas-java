# 代码审查：backend/internal/middleware + backend/internal/router（2026-08-07）

审查方式：16 个文件逐一完整逐行通读，并对关键交叉引用（domain 角色常量、cache 键生成、FileHandler 文件服务、AuthHandler 预授权令牌、SubscriptionHandler）做了佐证阅读。只读审查，未运行构建/测试。

审查结论总览：**P0 0 条，P1 0 条，P2 6 条，P3 16 条，合计 22 条。**

重点核查结论：
- 未发现未鉴权的高危业务端点：所有 `/api/v1/*` 业务路由均在 `JWT` 组内（routes.go:60-62）；公开端点仅登录（限流）、select-tenant（预授权令牌保护）、theme、health、/uploads（见 P2）。
- 未发现意外路由覆盖：全部 9+ 组同 method+path 双注册均为"后注册组 = 更宽门禁 + 同一 handler"的有意降权（注释 routes.go:208-209 已声明），逐一核对无越权窗口；但该隐式契约脆弱（P2）。
- JWT 解析：HS256 白名单 `WithValidMethods`（auth.go:47）、exp 校验（jwt/v5 默认）均正确；唯一缺口是 claims.UserID 非空未强制（P2）。
- 租户隔离：路由层无跨租户入口；所有业务数据查询由 handler 按 claims.TenantID 过滤，缓存键含租户（cache/key.go:9-15），未发现路由层面跨租户可能。

---

## backend/internal/middleware/auth.go

- [P2][JWT 校验] auth.go:53-57 — JWT 中间件只校验"能解析 + 签名有效"，不强制 `claims.UserID` 非空。登录预授权令牌（`preAuthClaims`，auth_handler.go:76-82）与正式令牌同密钥同 HS256，可被本中间件解析为 `Claims{Platform: "portal", Username: "xxx"}`（UserID 为空、RoleCodes 为空）。虽然所有角色/菜单门禁（RequireRole/RequireRoleOrMenu/RequireUserRead）都会因空角色/空权限拒绝它，但 `/auth/portal/me`、`/subscriptions` 等仅挂 `RequirePlatform` 的端点会放行进入 handler：`PortalMe` 以空 UserID 查库（返回 500 或空数据）、`SubscriptionHandler.Get` 因 `tenantFilter` 拒绝。无数据泄露，但属于令牌类型混淆的防御缺口。最佳实践：解析后强制 `claims.UserID != ""`，否则 401（同时天然排除 preAuthToken 与任何未来签名但结构不全的令牌）。
- [P3][防御性] auth.go:45-47 — 未使用 `jwt.WithExpirationRequired()`，也未校验 issuer/audience。当前 `GenerateToken` 恒设置 exp（7 天），若未来新增签发路径漏设 exp，令牌将被永久接受。最佳实践：加 `jwt.WithExpirationRequired()` 兜底。
- [P3][防御性] auth.go:77 — `GenerateToken` 直接解引用 `input.User`，传 nil 会 panic（当前全部调用方均传非 nil）。最佳实践：入口处 `if user == nil { return "", errors.New(...) }`。

## backend/internal/middleware/auth_test.go

- [P3][测试] auth_test.go:151-156 — `TestJWT_ExpiredToken` 构造的 `jwt.MapClaims` 使用键名 `"userID"`（驼峰），与真实 `Claims` 的 json tag `userId` 不一致。测试当前因 exp 校验先失败而通过，若未来 exp 校验被移除，该测试会在无提示下失效（角色/用户字段全部为空仍可能 401）。最佳实践：键名改为 `"userId"` 或直接用 `middleware.Claims{}` 构造。

## backend/internal/middleware/oplog_buffer.go

- [P2][oplog 缓冲] oplog_buffer.go:63-69 — `flushLoop` 的 `defer recover()` 只是记录 panic 后让 goroutine **永久退出**（`done` 被 close、循环终止）。此后所有操作日志入队即被丢弃（enqueue 打 "buffer full" warn 或静默滞留），且 `Shutdown()` 立即返回。即 DB 异常/池关闭引发一次 panic 后，整个操作日志管线永久性失效。最佳实践：recover 后不 return，而是继续外层 for 循环（或重建 goroutine）。
- [P2][oplog 缓冲] oplog_buffer.go:121-125 — 批量 `br.Exec()` 的错误处理不符合 pgx 语义：单行失败后，后续 `Exec()` 立即返回同一错误，剩余行实际不再消费（服务端是否已执行由服务端决定，但本地一律记失败），且每行各打一条 warn（错误风暴）。最佳实践：遇到第一个错误即 break，按"本批 N 行成功 / 第 K 行失败"统一记一条日志。
- [P3][oplog 缓冲] oplog_buffer.go:50-56 — 缓冲满时直接丢弃条目（有 warn，可接受）；`Shutdown()` 之后 `Enqueue` 的条目既不落库也不报错（drain 循环已经结束）。最佳实践：Shutdown 后 Enqueue 直接丢弃并返回布尔，或打一次 warn。

## backend/internal/middleware/oplog.go

- [P2][日志记录] oplog.go:109-112 — `claims.TenantID == nil` 时直接 return：SaaS 运营端（平台管理员）的全部操作（租户创建/停用、管理员重置密码、订阅修改等 `/admin/*` 高危动作）**完全不记录操作日志**，无审计轨迹。最佳实践：对平台管理员用固定占位（如 tenant_id = 'platform'）或至少单独记一条平台操作日志。
- [P3][日志记录] oplog.go:72,99-103 — 跳过名单用 `strings.Contains(r.URL.Path, "/view")` 子串匹配，任何未来路径中带 "/view" 的写操作都会静默跳过日志（当前路径中无意外命中，"/preview"、"/review" 均不匹配）。最佳实践：改为按段匹配或显式白名单。
- [P3][日志记录] oplog.go:74-82 — `statusRecorder` 未实现 `http.Flusher`/`http.Hijacker`/`http.Pusher`，若未来在 OperationLog 覆盖范围内挂流式/SSE/文件流响应，接口断言会 panic（当前 `/api/v1/files/upload|preview` 等均不使用 Flusher）。最佳实践：实现 `Flush()` 透传或对需要 Flusher 的路径排除 oplog。
- [P3][日志记录] oplog.go:137-143 — buffer 为 nil 的兜底路径使用 `r.Context()` 写库：客户端断开后该上下文已取消，落库必然失败（实际部署走 buffer 路径，无影响）。最佳实践：兜底路径也使用带超时的独立 context（如 oplog_buffer.go:106）。
- [P3][日志记录] oplog.go:166-178 — `describeOperation` 的 targetType 取原始英文 URL 段（如 "roles"），与 module 的中文名（"角色权限"）风格不一致；非 UUID 形式的 ID（如数字自增主键）完全识别不到 targetID/targetType，日志为空。最佳实践：统一映射或明确仅支持 UUID。

## backend/internal/middleware/platform.go

无问题。`RequirePlatform` 逻辑正确（claims 为空 401、平台不符 403），依赖 JWT 先挂载（routes.go:60-62 顺序正确）；测试覆盖匹配/不匹配/无令牌三种场景。

## backend/internal/middleware/platform_test.go

无问题。用例覆盖 portal/saas 双向隔离，令牌构造与断言正确。

## backend/internal/middleware/rbac.go

- [P3][授权模型] rbac.go:56 — `RequireRoleOrMenu` 的"有任意菜单权限即可读该组全部 GET"豁免是既定设计（注释已声明），但意味着一个仅被授予"学生工作台"菜单的用户可读该组所有 GET（含 `/evaluation/exam-results`、`/users` 等业务数据），数据边界完全依赖各 handler 内按 userID/tenant 过滤。当前审查范围内未发现 handler 遗漏，但该豁免面偏大。最佳实践：保持现状（符合项目"菜单桥接"需求），但新增 GET 路由时应默认评估是否需挂在更严格组。
- [P3][授权模型] rbac.go:75-109 — `HasRole`/`HasAnyMenuPermission`/`HasSystemPermission` 全部只读令牌内 claims：角色绑定、菜单授权的变更最长 7 天（令牌有效期）后才生效，期间被降权的用户仍可按旧权限访问。属会话式设计取舍，与 auth.go 令牌 7 天有效期同因。最佳实践：如可接受则忽略；否则缩短令牌有效期或按需查库校验角色。

## backend/internal/router/handlers.go

无问题。纯依赖装配（store→service→handler），无鉴权/路由逻辑；所有 handler 字段赋值完整（含 DB/Redis 注入），未发现遗漏字段导致的 nil 解引用。

## backend/internal/router/router.go

- [P2][未鉴权接口] router.go:122 — `GET /uploads/{filename}` 完全公开（无 JWT、无租户隔离）：上传目录是全局共享的，任何获得 URL 的人（包括跨租户用户）都可读取任意上传文件（作业附件、证件照、导入的含个人信息的 Excel 等）。缓解因素：文件名是 UUID v4（不可枚举，file_handler.go:64）、扩展名白名单 + `..` 拒绝 + 前缀校验（file_handler.go:142-155）已防路径穿越和 XSS。最佳实践：至少要求登录（JWT），更进一步按租户子目录分目录存储。
- [P3][配置] router.go:116-119 — `UPLOAD_DIR` 默认值为相对路径 `../public/uploads`，依赖进程 CWD，容器内 CWD 变化会导致上传/预览指向意外目录。最佳实践：改为基于可执行文件位置的绝对路径或 env 必填。
- [P3][配置] router.go:105-107 — CORS 全放开（`Access-Control-Allow-Origin: *`），因鉴权走 Authorization 头（非 cookie 凭证），无 CSRF 面，风险可控；`Allow-Methods` 未含 PATCH/HEAD，前端如需新增方法需同步。最佳实践：可维持现状，仅提示。
- [P3][日志记录] router.go:98-101 — `middleware.Logger` 记录完整请求 URL（含 query string），若未来有端点将敏感参数放查询串会进日志。最佳实践：保持 body 不入日志即可，查询参数敏感时考虑脱敏。

## backend/internal/router/routes.go

- [P2][路由注册] routes.go:60-256 — 存在至少 9 组同 method+path 双注册，全部依赖 chi"后注册胜出"静默覆盖，且全部为"后注册组 = 更宽角色门禁 + 同一 handler"的有意降权（已逐条核对无越权窗口）：
  1. `GET /favorites*`（L238-240 覆盖 L13-15，jobViewer 胜出）
  2. `GET /lesson/courses`、`/lesson/courses/{id}`（L214 覆盖 routes_lesson.go:6，jobViewer 胜出）
  3. `GET /library/resources*`、`/library/on-site-questions*`（L217-221 覆盖 routes_library.go:6-17，jobViewer 胜出）
  4. `GET /job/position-responsibilities*`、`/job/position-abilities`、`/job/ability-domains*`、`/job/position-certificates*`（L224-230 覆盖 routes_job.go:22-37，jobViewer 胜出）
  5. `GET/POST /job/positions/{id}/favorite`、`GET /job/positions/favorites`（L233-235 覆盖 routes_job.go:9-11，jobViewer 胜出）
  6. `GET /organizations*`、`GET /org-types*`（L196-200 覆盖 registerPortalRoutes L472-480，businessUser 胜出）
  7. `POST /lesson/courses/{id}/homeworks/{homeworkId}/submit`（L109 覆盖 routes_lesson.go:9，jobViewer 胜出）
  - 该模式正确性完全依赖注释约定的注册顺序（L208-209 已自述），任何组顺序调整都会**静默**改变门禁（如把 jobViewer 组移到 businessUser 组前，学生读接口被顶替为业务用户门禁）。最佳实践：在 routes.go 顶部加集中注释表 + 未来改动路由分组时优先选择单次注册（同 handler 合并到最宽组）。
- [P3][未鉴权接口] routes.go:43 — `POST /auth/select-tenant` 是公开端点且未挂限流（三个登录接口均有 30/min IP 限流）。当前受 1 分钟预授权令牌 + JTI 一次性 nonce 保护（auth_handler.go:205-214），风险低。最佳实践：叠加同一个 `loginLimiter` 更稳妥。
- [P3][性能] routes.go:21-31 — `middleware.Timeout(d)(next)` 在**每次请求**内新建中间件链，且每条匹配上的路由都重复构造。对高 QPS 端点有微小分配开销。最佳实践：预构造两个包装 handler（30s/10min）复用。

## backend/internal/router/routes_affairs.go

- [P3][路由注册] routes_affairs.go:30-31 — `PUT/DELETE /affairs/teaching-plans/entries/{id}` 段数（3 段）与 registerContentRoutes 的 `PUT /affairs/teaching-plans/{id}`（2 段）无冲突；但 `PUT /affairs/teaching-plans/entries`（少一段）会被 `{id}` 路由捕获进 Update handler（返回 404/400），属无害边界。最佳实践：可不处理。
- [P3][路由注册] routes_affairs.go:42-46 — `PUT /affairs/period-slots/replace` 在 `PUT /affairs/period-slots/{id}` 之前注册，顺序正确（注释已说明）；核对 `GET /affairs/schedules/timetable|export`（L55-56）与 schedules 路由无同 method+path 冲突。无实质问题，仅确认记录。
- [P2][oplog 日志] routes_affairs.go:59-66 — 提示性交叉引用：`/import/schedules/*`、`/templates/schedules` 等注册在 businessUser 组（门禁与 registerImportExportRoutes 组一致，无越权）；其中 `/templates/*` 与 `/import/*` 已在 routes.go:24-27 的 10 分钟超时豁免前缀内，行为正确。无实质问题（该条不计入总数时请以 oplog.go:109-112 为准 —— 本条为冗余确认，不单计）。

（注：上条为确认性说明，不计入问题数。）

## backend/internal/router/routes_evaluation.go

无问题。静态/参数路由注册顺序全部正确（`/job-ability/results/summary` 先于 `/{id}`、`/certifications/positions/...` 静态段先于 `/{id}`、`/portraits/archives` 静态与 jobViewer 组 `/{id}` 并存由 chi 静态优先保证）；学生可写端点（`POST /evaluation/exam-results`、`POST /evaluation/results`、作业提交）与写门禁（grade/batch-grade 在 businessUser 组）划分清晰，未发现越权写路径。

## backend/internal/router/routes_job.go

无问题。`GET /job/positions/favorites`（L11）与 `GET /job/positions/{id}`（L6）静态优先无冲突；`/favorites` 系列双注册属于 routes.go:238-240 的有意覆盖（见 routes.go P2 条）；岗位/能力/证书只读接口的降权覆盖均指向同一 handler，无越权。

## backend/internal/router/routes_lesson.go

无问题（关联确认已归入 routes.go P2 条）：课程作业提交路由双注册（routes.go:109 与 L9）同为"jobViewer 后注册胜出、学生可提交"的有意设计；quizzes/homeworks/node-resources/hybrid-modules 各资源路由无同 method+path 冲突。

## backend/internal/router/routes_library.go

无问题。静态段（stats/citation-stats/uncited）全部先于 `/{id}` 注册，POST/PUT/DELETE 与 GET 分组清晰，无重复注册。

## backend/internal/router/routes_scene.go

无问题。`registerContentWriteRoutes` 仅注册写操作（GET 由 routes.go:90-94 jobViewer 组承担），rubric-templates/task-resources/task-bindings/weights/grade-mappings 无同 method+path 冲突，静态段顺序正确。
