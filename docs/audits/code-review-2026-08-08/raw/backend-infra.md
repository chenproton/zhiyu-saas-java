# 代码审查 2026-08-08（复查轮）— 后端基础设施

范围：backend/main（二进制产物）、cmd/migrate、cmd/seed、cmd/server、config、db、cache（cache/key/middleware）、scheduler。
本轮为 2026-08-07 全量修复后的复查，重点为修复引入的回归。

---

## backend/main

- [P3][死代码/产物] backend/main — 该路径为 2026-07-25 编译遗留的 24MB ELF 二进制（`file` 确认，未被 git 跟踪，已在 .gitignore 中），仓库根无 `main.go` 源码；后端入口实际是 cmd/server。最佳实践：删除该产物，避免审查/部署混淆（`go build ./cmd/server` 输出到 bin/）。

## backend/cmd/migrate/main.go

- [P2][边界/正确性] cmd/migrate/main.go:230-254 — `splitSQLStatements` 为手写分割器，只识别 `;\n` 与无标签 `$$...$$`：单引号字符串字面量内出现 `;\n`（如 `INSERT ... VALUES ('a;\nb')`）、带标签美元引用 `$tag$...$tag$`、注释内出现 `;\n` 三种场景会被错误切碎，生成的 SQL 运行时必然报错。最佳实践：改用 pgx 简单协议多语句执行（`QueryExecModeSimpleProtocol`，天然支持多语句且不切分），或至少补 `$tag$` 与单引号状态识别。
- [P2][事务/原子性] cmd/migrate/main.go:120-126,188-194 — 多语句迁移在事务外逐条执行：中途失败时前序语句已落库且 `schema_migrations` 未记录，重跑会因"语句已执行"再次报错（如无 IF NOT EXISTS 的 DDL），只能手工修复。最佳实践：为多语句迁移引入逐语句 `SAVEPOINT` 或要求迁移文件幂等；至少把该约束写进 migration 编写规范。
- [P3][边界] cmd/migrate/main.go:92-93 — `strconv.Atoi` 错误被忽略，非数字前缀的迁移文件按 0 参与排序；且 migrateDown 的排序 SQL（main.go:153）`regexp_replace(...)::bigint` 对非数字开头版本会整表回滚失败。最佳实践：启动时校验文件名格式（`^[0-9]+_.*\.(up|down)\.sql$`），非法直接报错。
- [P3][边界] cmd/migrate/main.go:221-226 — 阈值 `>= 1` 使"单条语句但文件以 `;\n` 结尾"的迁移也走非事务 multi 路径（行为等价——单语句在 PG 内天然原子，仅多语句文件的原子性受影响，见上条），但注释只解释了"两条语句"场景，建议补充说明，避免后人误改阈值。
- [P3][边界] cmd/migrate/main.go:286-296 — `stripSQLComments` 删除以 `--` 开头的整行：PL/pgSQL 函数体内行首 `--` 属注释语义等价、删除安全；但字符串字面量跨行且某行以 `--` 开头时会被截断（罕见）。可接受，建议注释说明。
- [P3][易用性] cmd/migrate/main.go:55-57 — `-dir` 仅在 `os.Args[1] == "-dir"` 时生效，`migrate up -dir x` 被静默忽略。最佳实践：用 `flag` 包解析。

## backend/cmd/seed/main.go

- [P3][错误吞] cmd/seed/main.go:49,64 — `QueryRow(...).Scan` 错误用 `_ =` 吞掉：数据库查询失败（如迁移未执行、表不存在）被当作"不存在"，随后 INSERT 报出难以定位的错误链。最佳实践：Scan 失败时打印错误后继续（保留"仅按库中是否存在判断"的容忍语义，但输出诊断）。
- [P3][幂等] cmd/seed/main.go:96-99 — 用户插入 `ON CONFLICT (id) DO NOTHING`：若该预留 ID 已被其他 login_name 占用，admin 账号静默不创建，后续登录全挂且无提示。最佳实践：冲突时按 `id` 查询校验 login_name，不符则打印明确警告。
- [P3][风格] cmd/seed/main.go:32-33 — 平台角色/管理员 UUID 硬编码 magic number，未像第 31 行那样收敛到 `domain` 常量。最佳实践：与 `OperatorTenantID` 一同放入 domain 常量区。

## backend/cmd/server/main.go

- [P2][可用性/单点] cmd/server/main.go:38-42 — REDIS_URL 已配置但 Redis 不可达时 `cache.NewClient` 返回 error → `os.Exit(1)` 整个服务拒绝启动；而 cache 中间件对 `client == nil` 已有完整降级旁路（cache/middleware.go:20-21,36-39,105-107），说明 Redis 本是可降级组件。最佳实践：ping 失败改为 `slog.Warn` + 以 nil client 继续运行（限流/缓存失效但服务可用），或将 Redis 启动探测改为有限次重试。
- [P3][资源] cmd/server/main.go:66-72 — `ListenAndServe` 失败（如端口被占）时在 goroutine 内 `os.Exit(1)`，defer 的 Close/Shutdown 均不执行（进程直接退出，实际影响可忽略）。最佳实践：改用 error channel 在主流程退出，保证清理顺序。
- [P3][安全/边界] cmd/server/main.go:58-64 — 未设置 `ReadHeaderTimeout`（仅有 ReadTimeout=15s 兜底慢连接头读取）。最佳实践：补 `ReadHeaderTimeout: 5 * time.Second`。

## backend/internal/config/config.go

- [P3][校验] config/config.go:36 — PORT 未校验数值，`PORT=abc` 时错误延迟到 ListenAndServe 才暴露（且报错在 goroutine 内）。最佳实践：`Load()` 内 `strconv.Atoi` 校验并报错。
- [P3][风格] config/config.go:18-20 — 三个路径的 godotenv 错误全部忽略，且相对路径依赖进程 cwd（部署脚本 cwd 变化时 .env 静默不加载，靠真实环境变量兜底）。可接受，建议注释说明。

## backend/internal/db/db.go

- 无问题（statement_timeout=15000 默认注入、用户 URL 显式配置优先、MinConns/MaxConns 合理）。

## backend/internal/cache/cache.go

- [P3][风格/健壮性] cache/cache.go:19-23 — 用错误消息字符串匹配（"invalid scheme"/"no scheme"）判定"裸地址"回退，依赖 go-redis 错误文案，升级可能失效。最佳实践：先判断 `strings.Contains(redisURL, "://")` 再决定走 ParseURL 还是裸 Addr。

## backend/internal/cache/key.go

- [P3][边界] key.go:20-27,60-67 — 查询参数原样拼入缓存键且无转义：`search=a:b` 与 `search=a` + 其他参数虽因带参数名标签基本不会碰撞，但值内冒号/空格仍可能构造出歧义键；且键长度随参数无上限（URL 已限长，风险可控）。最佳实践：对值做 URL 编码或对参数组合取 hash。
- [P3][风格] key.go:41-46 — `DashboardKey` 重复实现了 `tenantFromRequest`（key.go:9-15）的 tenant 提取逻辑（global 兜底分支逐字重复）。最佳实践：直接复用 `tenantFromRequest`。
- [P3][一致性] key.go:17-69 — 除 DashboardKey 外均不含 userID/版本号：公开列表缓存跨用户共享（数据为租户级公开数据，当前安全），但接口响应结构变更后旧结构会服务至 TTL 到期。最佳实践：key 前缀加内容版本号（如 `zhiyu:v2:...`）。

## backend/internal/cache/middleware.go

- [P2][安全/限流] cache/middleware.go:90-94 — `clientIP` 直接信任 `X-Forwarded-For` 首段，与 router.go:99-100 的明确立场（"XFF 客户端可控，拒绝用于限流/日志"）自相矛盾：攻击者可伪造任意 XFF 绕过登录限流（每请求换 IP 即无限尝试密码），或伪造受害 IP 每窗口刷 30 次将其登录锁定。最佳实践：在 nginx 层用 `real_ip_header`/`set_real_ip_from` 重写可信源，后端统一读 `RemoteAddr`（与 router 注释一致）；若必须保留 XFF，至少对无 XFF 与有 XFF 的请求用不同桶或加 nginx 签名头校验。
- [P2][性能/阻塞] cache/middleware.go:55-57 — 缓存 miss 时同步等待 `client.Set`（最长 2s，且发生在响应已写回客户端之后）：冷缓存 + 并发高峰时 handler 协程滞留 2s，叠加 redis 池（10）与默认重试可放大排队。最佳实践：改异步 goroutine 写入（限并发），或 Set 改 1s 超时 + 丢弃。
- [P3][资源] cache/middleware.go:78-84 — `cachedResponseWriter` 将完整响应体缓冲于内存，仅挂 4 个列表接口（routes.go:55-58）当前可控；若未来挂到大响应/导出接口会造成翻倍内存。最佳实践：加 body 上限（如 1MB 内才缓存）。
- [P3][一致性] cache/middleware.go:127 — `X-RateLimit-Reset` 每请求取 `now+window`，随请求时间漂移、与 key 实际过期时刻不一致。最佳实践：由 `PTTL` 推算或存固定窗口结束时间戳。
- [P3][错误吞] cache/middleware.go:23-27 — `InvalidatePrefix` 忽略 Del 错误、SCAN match 未转义 redis glob 元字符（当前 prefix 均为 UUID，无实际风险）。最佳实践：至少 log Del 失败。
- [P3][语义] cache/middleware.go:129 — `current > limit` 时第 limit+1 个请求才 429，而第 limit 个请求时 X-RateLimit-Remaining 已为 0 仍放行，语义轻微不一致。可接受，建议注释说明"第 N 次放行、第 N+1 次拒绝"。

## backend/internal/scheduler/scheduler.go

- [P1][回归/数据安全] scheduler/scheduler.go:38-49 + cmd/migrate/main.go:39 — `aggregateAll` 从**共享连接池** Acquire 连接后 `SET statement_timeout = 0`，Release 回池后该会话级设置保留在物理连接上（已核实 pgxpool v5 无 release 会话重置，vendor/github.com/jackc/pgx/v5/pgxpool/pool.go 仅提供 BeforeAcquire/AfterRelease 钩子）。每日 02:00 任务之后，任意普通请求借到这条连接即失去 15s 语句超时保护：一条失控查询可无限占用连接，逐步耗尽 40 连接池造成级联故障——恰是上一轮引入 statement_timeout 防护想防的场景。最佳实践：Release 前执行 `RESET statement_timeout`（defer 中先 Reset 后 Release），或给定时任务建立独立专用连接池（同 migrate 的单飞语义）。
- [P2][并发/多实例] scheduler/scheduler.go:21-35 — 多副本部署时每实例每天 02:00 各自执行 `AggregateAllPublished`，重复计算并写入重复汇聚日志（CreateLog 每 target 一条）。最佳实践：用 `pg_try_advisory_lock` 做跨实例单飞，抢锁失败者直接跳过本次。
- [P3][时区] scheduler/scheduler.go:23 — `0 2 * * *` 依进程本地时区解释，容器未显式设置 TZ 时按 UTC 执行（即北京 08:00 才跑）。最佳实践：`cron.New(cron.WithLocation(time.FixedZone(...)))` 或依赖部署明确设置 TZ。
- [P3][容错] scheduler/scheduler.go:30-32 — `AddFunc` 失败仅打日志，任务静默缺失（当前表达式字面量不会失败，纯防御）。可接受。
- [P3][中断] scheduler/scheduler.go:52-58 — Stop 最多等待 2 分钟即强返，而任务上下文是 30 分钟：进程退出时正在运行的汇聚被中断，汇聚日志停留在 running 态（下次运行会重复建日志）。最佳实践：若中断频繁，考虑把 Stop 等待时间对齐任务上限或启动时清理 stale running 日志。

---

## 统计

- 审查文件数：10（backend/main 为二进制产物，仅 1 条 P3 说明；源码实际 9 个）
- 问题总数：27（P1 × 1，P2 × 6，P3 × 20）

### P1 摘要

1. scheduler/scheduler.go:44（配合 cmd/migrate/main.go:39）— 共享池连接 `SET statement_timeout=0` 后回池，会话级状态泄漏：一条池中物理连接从此失去 15s 语句超时，慢查询可无限挂住连接直至耗尽连接池；属上轮超时修复引入的回归，需在 Release 前 `RESET statement_timeout` 或改用专用连接池。

### P2 摘要

1. scheduler — 多实例部署重复执行每日汇聚（无跨实例单飞锁）。
2. cache/middleware.go:90 — clientIP 信任 XFF 与 router.go:99-100 反 XFF 立场矛盾，攻击者伪造 XFF 可绕过登录限流或锁死他人 IP。
3. cache/middleware.go:55 — 缓存 miss 同步等 Set 最长 2s，冷缓存并发下 handler 协程滞留。
4. cmd/server/main.go:38 — Redis 配置但不可达时整个服务拒绝启动（本可降级）。
5. cmd/migrate/main.go:120 — 多语句迁移事务外执行，中途失败部分落库且无法重跑。
6. cmd/migrate/main.go:230 — 手写 SQL 分割器对字符串字面量/带标签美元引用内的 `;\n` 切错导致运行时错误。
