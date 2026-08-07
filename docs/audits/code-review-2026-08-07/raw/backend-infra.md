# 代码审查：backend-infra（2026-08-07）

审查方式：逐文件完整通读。关注点：P0 运行时必错 / P1 严重 / P2 重要 / P3 一般。

## backend/main（二进制文件）
- [P3][仓库卫生] backend/main:1 — 该路径是 25MB 的 ELF 编译产物（非源码，另见 backend/seed 13MB 同类产物），已过时（7月25日构建）且被 .gitignore 忽略、未追踪；留在工作区根目录易被误认为源码/误提交。最佳实践：从工作区删除或移入 git 管理的 dist/ 目录，构建产物统一由 deploy.sh 生成。

## backend/cmd/migrate/main.go
- [P2][配置继承] cmd/migrate/main.go:24-36 — migrate 通过 db.New 建立连接池后 Acquire，连接继承了 db.go:26-28 的 `statement_timeout=15000`；任何单条迁移 DDL 超过 15 秒即失败（大表建索引、数据回填类迁移在数据量上来后必然踩中），导致部署中断。最佳实践：Acquire 后先执行 `SET statement_timeout = 0`（迁移进程单飞，无需超时）。
- [P2][迁移执行逻辑] cmd/migrate/main.go:211-213 — `isMultiStatement` 以 `strings.Count(sql, ";\n") > 1` 判定，行为依赖尾随换行：两语句文件以 `;\n` 结尾 → 走 execMultiSQL（非事务）路径；以 `;` 结尾（无尾随换行）→ 走单语句事务路径。同一内容因换行差异执行方式不同，且文件中的 `-- 注释;` 行（注释以分号结尾）会被误计为多语句。最佳实践：按 `;` 结尾的语句分割并去掉纯注释/空块后再判定，或改用文件内显式指令标记。
- [P2][幂等缺失] cmd/migrate/main.go:215-241 — execMultiSQL 逐条非事务执行：中间语句失败时，之前的语句已生效但 schema_migrations 未记录版本，重跑会重放已成功的语句（如 `CREATE TABLE`/`INSERT` 报 already exists），需要手工回滚清理；另外按 `;\n` 分割不感知字符串字面量/PL/pgSQL 函数体内的 `;\n`，会被错误截断（该情况会报错暴露而非静默）。最佳实践：失败时对已执行语句回滚（依赖配套 .down.sql）或先备份整段 SQL 供人工处置；分割需识别函数体。
- [P3][错误被吞] cmd/migrate/main.go:153-161 — migrateDown 的 rows.Next 循环后缺 `rows.Err()` 检查，查询中途失败（如超时）会被静默当作正常结束，导致只回滚一部分迁移且不报错。最佳实践：循环后检查 rows.Err() 并在有错时返回。
- [P3][命名/解析] cmd/migrate/main.go:49-58 — 参数解析松散：`-dir` 必须是第一个参数才生效，up/down 从剩余参数扫描且无互斥校验（同时传时后者胜出）。最佳实践：用 flag 包解析。
- [P3][日志输出] cmd/migrate/main.go:20,27,34,44,62,68 等 — 错误全部 fmt.Println 到 stdout 而非 stderr。最佳实践：改用 log 包或写入 os.Stderr。
- 确认无问题：同号迁移排序 up 按文件名升序（85-93 行）、down 按 version 降序（145-148 行）恰好互逆，up/down 顺序一致正确；单语句路径（122-137 行）事务内执行 + 记录版本，原子性正确。

## backend/cmd/seed/main.go
- [P3][错误被吞] cmd/seed/main.go:49,64 — `_ = database.Pool.QueryRow(...).Scan(...)` 吞掉查询错误：若 users/tenants 表尚不存在（迁移未先执行），adminExists 误判为 false 后走重建分支，最终 INSERT 以误导性的 "insert user error" 报错退出。可接受（会响亮失败），但错误归因不清。最佳实践：捕获错误并提示"先执行迁移"。
- [P3][边界条件] cmd/seed/main.go:51-53 — 已存在 admin 时仅重置 password_hash，不更新 updated_at（审计时间线失真）。最佳实践：UPDATE 顺带 `updated_at = NOW()`。
- [P3][可运维性] cmd/seed/main.go:35-39 — SEED_ADMIN_PASSWORD 未设置时静默跳过种子数据并返回成功（exit 0），deploy 脚本可能误以为已初始化。可接受（deploy.sh 保证传参），但建议返回非零或显式警告。
- 确认无问题：uuid.MustParse 硬编码 UUID 均为已知常量；重建分支全部 ON CONFLICT DO NOTHING 幂等；user_count 统计正确。

## backend/cmd/server/main.go
- [P2][配置矛盾] cmd/server/main.go:62 — `WriteTimeout: 120 * time.Second` 与 routes.go:19-31 中 import/export/templates 的 10 分钟超时豁免直接矛盾：大文件导出/导入写响应阶段超过 120 秒会被服务器强制断连，客户端拿到截断文件（无错误响应），豁免形同虚设（另部署 nginx 反代 proxy_read_timeout 默认 60s 进一步收窄）。最佳实践：统一三层超时口径，导出类接口 WriteTimeout 放宽或改用流式分块写入。
- [P2][启动顺序/优雅退出] cmd/server/main.go:56 + scheduler.go:40-43 — defer 逆序整体正确（sched→router→oplog→redis→db），但 sched.Stop() 会无限等待运行中任务（任务自身 ctx 上限 30 分钟），docker stop 默认 10 秒超时后 SIGKILL 强杀，正在执行的汇聚任务被中断、聚合表可能留下部分写入。最佳实践：Stop 增加带超时的等待（如等待最多 2 分钟），或任务端保证幂等可重跑。
- 确认无问题：信号处理、30s 优雅关闭、ListenAndServe 错误处理、defer 关闭顺序均正确。

## backend/internal/config/config.go
- [P3][死代码/健壮性] config.go:18-20 — 三行 godotenv.Load 相对路径硬编码（../.env / ../../.env / .env）且错误全部吞掉，行为依赖进程 CWD；容器内由环境变量注入无碍，但本地从任意目录运行可能静默拿到错误配置。最佳实践：仅加载一次并记录成功路径，或接受 CWD 约定并在文档注明。
- 确认无问题：DATABASE_URL / JWT_SECRET 必填校验、PORT 默认 8080 正确。

## backend/internal/db/db.go
- [P2][配置副作用] db.go:26-28 — `statement_timeout=15000` 全局默认应用在**所有**连接上：调度器 30 分钟汇聚任务（scheduler.go:26）、迁移 DDL、复杂报表的单条语句只要超过 15 秒即被取消；且该参数无法在调用方按需放开（除非改 URL 或单独 SET）。最佳实践：默认不设或仅对短事务连接设置；长任务/迁移连接显式 `SET statement_timeout = 0`。
- 确认无问题：MinConns/MaxConns 合理、NewWithConfig + Ping 启动校验正确。

## backend/internal/cache/cache.go
- [P3][健壮性] cache.go:17-27 — 靠 redis 库错误字符串包含 "invalid scheme"/"no scheme" 判断裸 host:port 并降级为 Options{Addr}，对错误文案强耦合，库升级改文案即失效（REDIS_URL 一旦写错会误把完整 URL 当 Addr 建连，后续报连接错误）。可接受（有 Ping 兜底），但建议直接检查前缀 `redis://`。
- [P3][设计取舍] cache.go:36-38 — REDIS_URL 已配置但 Redis 短暂不可用时服务启动即失败（fail-fast），而同一配置缺失时却降级运行；缓存/限流本非核心（nil 分支齐全）。属设计选择，可接受；如需高可用可改为 Ping 失败仅告警。
- 确认无问题：nil 返回 nil 的降级契约、超时与池参数合理。

## backend/internal/cache/key.go
- [P3][缓存膨胀] key.go:22-26,62-66 — 键含 search/limit/offset 等查询参数，键空间按参数组合膨胀（每个分页组合各存一份），且显式 `?limit=50` 与缺省（DefaultLimit=50）产生内容相同但键不同的冗余条目。属可接受取舍（2 分钟 TTL），不构成问题，仅记录。
- [P3][边界条件] key.go:51-52 — DashboardKey 的 role 直接取自 query 参数，前端漏传/改传时同一用户不同角色可能共享键（注释已声明该风险）。可接受，但建议以后端 claims 中的角色为准。
- 确认无问题（重要）：已将三个列表键的组成参数与 store 实际过滤参数逐一核对——PublicPositionsKey 覆盖 positions.go:69-87 全部过滤项（tenant/search/positionType/limit/offset）；PublicScenariosKey 覆盖 scenarios.go:34-63 全部过滤项（tenant/search/status/batchId/careerPositionId/limit/offset）；且所有缓存路由均挂在 auth 中间件之后（routes.go:60-62），Claims 必然存在，"global" 兜底分支实际不触发；tenantFromRequest 匿名兜底不会造成跨租户串数据。

## backend/internal/cache/middleware.go
- [P1][敏感/可用性] middleware.go:102,86-92 — RateLimit 键仅取 `clientIP(r)`（RemoteAddr），不读 X-Forwarded-For；生产部署经宿主 nginx 反代（deploy/nginx/conf.d/zhiyu-saas-ssl.conf:26 proxy_pass 127.0.0.1:8080，后端仅监听 127.0.0.1），所有用户 RemoteAddr 均为 nginx 地址，登录限流桶（30 次/分钟，routes.go:39-42 三入口共享）退化为全站共享 —— 任一客户端 1 分钟内可打满 30 次，锁死全站登录（3 个登录入口共用同一 key，一处耗尽处处 429）。最佳实践：优先取 `X-Forwarded-For` 首段（nginx 已透传）并在信任代理场景配置，或限流键按"IP+用户名"组合。
- [P2][边界条件] middleware.go:118-119 — 限流语义为 `current > limit` 才拒绝（limit+1 触发），且 X-RateLimit-Reset 用 `time.Now().Add(window)` 而非实际过期时刻，与 Redis TTL 过期点不一致；429 响应无 Retry-After 头。功能可用，仅语义偏差，建议补充 Retry-After。
- [P3][响应头丢失] middleware.go:43-44 — 缓存命中路径只恢复 Content-Type，丢弃其他响应头；当前 4 个缓存路由的 handler 仅用 respondJSON（common.go:80-81 只设 Content-Type），无实际影响，但后续新增带自定义头的 handler 复用 Cached 时会静默丢头。最佳实践：命中时恢复 `X-Cache: HIT` 之外的关键头（或记录首写头集合）。
- [P3][可观测性] middleware.go:40-58 — 未命中时未设置 `X-Cache: MISS`，也无 Cache-Control；排查缓存行为不便。最佳实践：两路径均打 X-Cache。
- [P3][错误被吞] middleware.go:24 — InvalidatePrefix 中 Del 错误被吞（SCAN 游标循环本身正确，不会残留陈旧键，Del 失败概率低）。可接受。
- 确认无问题：cachedResponseWriter 的 WriteHeader/Write 双写保护正确；2xx-3xx 且 body 非空才写缓存（4xx/5xx/204 不会缓存）；写缓存用独立 2s 超时 ctx 避免客户端断开阻塞；非 GET 请求直接放行。

## backend/internal/scheduler/scheduler.go
- [P2][资源泄漏/优雅退出] scheduler.go:40-43 — Stop() 无限等待运行中任务（任务 ctx 上限 30 分钟），与容器优雅退出超时（默认 10s 后 SIGKILL）不匹配，强杀时汇聚任务可能中断留下部分聚合数据。最佳实践：Stop 加超时上限，并保证 AggregateAllPublished 幂等可重跑（下次运行自动补偿）。
- [P2][超时冲突] scheduler.go:21-34 — 汇聚任务通过共享连接池执行，语句受 db.go:26-28 `statement_timeout=15000` 约束，任何单条汇聚语句超过 15 秒即失败，任务整体失败仅记日志、无重试（次日才补偿）。最佳实践：任务会话内 `SET statement_timeout = 0`，并在失败时立即告警。
- [P3][错误处理] scheduler.go:32-34 — AddFunc 注册失败仅记日志不退出，调度静默失效（cron 表达式为常量不会发生）。可接受。
- 确认无问题：SkipIfStillRunning 防重入、ctx 30 分钟超时、任务与 DB 关闭顺序（server main defer 逆序）正确。

## 汇总
- 审查文件数：10（含二进制产物 backend/main）
- 总问题数：22（P0: 0，P1: 1，P2: 9，P3: 12）
- P0：无
- P1：cache/middleware.go:102 — 限流键仅取 RemoteAddr，nginx 反代下全站登录共享 30 次/分钟桶，任意客户端可锁死全站登录
