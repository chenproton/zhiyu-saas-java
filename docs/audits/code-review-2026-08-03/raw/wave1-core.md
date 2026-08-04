# 后端核心层审查（22文件，2821行）

```
backend/cmd/migrate/main.go:211-213 | P1 | 逻辑bug | isMultiStatement 用 strings.Count(sql,";\n")>1 判断多语句，恰好两条语句（只出现一次 ";\n"）会被误判为单语句走 tx.Exec，而 pgx 一次 Exec 不支持多条语句会直接报错导致迁移失败；语句内出现 ";\n" 字面量也会误判 | 阈值改为 >=1 并用引号/分号状态机切分，或改成熟迁移库
backend/cmd/migrate/main.go:114-120,178-184 | P1 | 数据一致性 | 多语句迁移在无事务包裹下逐条 Exec，中途失败留下已执行语句且不写 schema_migrations 版本，重跑会重复执行报 already exists，造成半迁移状态 | 为多语句包一层事务（剥离文件内自带 BEGIN/COMMIT），失败整体回滚
backend/cmd/migrate/main.go:86-87 | P2 | 边界情况 | 版本号解析 strings.Split(name,"_")[0] 且忽略 Atoi 错误：非数字前缀迁移被当作 0 排序；同时 migrateDown:147 对无数字前缀的 version 执行 ::bigint 强转会抛错中断整个 down | 启动时校验文件名符合 ^[0-9]+_ 前缀，否则报错
backend/cmd/migrate/main.go:145-161 | P3 | 错误处理 | 遍历 rows 后未检查 rows.Err()，迭代中途出错会被吞掉 | 循环后补 rows.Err() 检查
backend/cmd/migrate/main.go:127,131,191,195 | P3 | 错误处理 | tx.Rollback 的错误全部忽略 | 记录错误日志
backend/cmd/migrate/main.go:49-58 | P3 | 可维护性 | -dir 仅在第一个参数时生效（如 migrate up -dir xxx 静默忽略），未知命令静默按 up 处理，无 help | 改用标准 flag 包解析
backend/cmd/migrate/main.go:95-140 | P3 | 性能 | 每个迁移单独一次 SELECT EXISTS（对目录文件逐条查库） | 一次查回全部已应用版本再比对
backend/cmd/seed/main.go:34-36 | P2 | 错误处理 | 判断是否已播种的 COUNT 查询错误被 _ = 吞掉，查询失败会被当作未播种继续插入，可能造成重复种子数据 | 检查 err 并退出
backend/cmd/seed/main.go:45-59 | P2 | 边界情况 | 已播种分支仅按 login_name='admin' 重置密码，若此前播种在创建用户前失败导致 admin 不存在，UPDATE 影响 0 行却返回成功，管理员永久无法登录 | 检查 RowsAffected==0 时告警
backend/cmd/seed/main.go:97 | P2 | 数据一致性 | 平台管理员 users.role 写死 'school'，而 models.go:21 定义了 UserRoleOperator='operator'；与 operator 租户/platform_admin 角色语义不符，凡按 role 字段鉴权的逻辑会把平台管理员当学校用户 | 改为 'operator'
backend/cmd/seed/main.go:115 | P3 | 边界情况 | UPDATE roles user_count 无条件 +1，未校验 user_roles 是否因 ON CONFLICT DO NOTHING 实际未插入 | 用 INSERT ... RETURNING 判断
backend/cmd/seed/main.go:62-67 | P3 | 稳定性 | 事务中途多处 os.Exit(1) 使 defer tx.Rollback 永不执行（进程退出由 PG 连接断开隐式回滚） | 改为 return+错误集中处理
backend/cmd/server/main.go:38-47 | P2 | 配置与启动 | REDIS_URL 已设置但 Redis 短暂不可用时 Ping 失败直接 os.Exit，整个服务启动失败，缓存/限流本可降级 | 启动 Ping 失败降级为 Warn 并返回 nil client
backend/cmd/server/main.go:66-72 | P3 | 稳定性 | ListenAndServe 非 ErrServerClosed 错误时直接 os.Exit，绕过优雅 Shutdown 路径 | 通过 error channel 通知 main 走 Shutdown
backend/internal/cache/cache.go:36-38 | P2 | 配置与启动 | Ping 硬依赖 Redis 可用才启动服务，且无 MaxRetries/重试配置 | 支持重试或降级为无缓存模式
backend/internal/cache/key.go:22-26,62-67 | P2 | 缓存一致性 | 缓存键只拼部分查询参数（search/positionType/limit/offset、status/batchId/...），若 handler 还读取其他影响结果的参数（sort/category/page 等）会命中错误缓存返回脏数据 | 与 handler 实际参数核对补齐，或做全参数规范化 key
backend/internal/cache/key.go:51-52 | P2 | 缓存一致性 | Dashboard 缓存键用前端 query 的 role，role 缺失/切换时未带参数会把同一用户不同角色视图串用（注释已自述） | 角色从 claims 取或加视图维度
backend/internal/cache/middleware.go:102,121-126 | P2 | 低危安全 | 限流仅按 RemoteAddr 的 IP：反代后所有用户共享同一 IP，单用户可耗尽全站配额造成 DoS；NAT 用户互相连累 | 取可信 X-Forwarded-For + 每用户维度
backend/internal/cache/middleware.go:118 | P3 | 命名/一致性 | X-RateLimit-Remaining 在 current==limit 时显示 0 但请求仍放行，语义矛盾 | 阈值对齐或头部改为 max(0,limit-current+1)
backend/internal/cache/middleware.go:54-57 | P3 | 性能 | 缓存写入同步阻塞（2s 超时）占用请求 goroutine，Redis 慢时拖慢响应 | 异步 goroutine 写缓存
backend/internal/cache/middleware.go:42-46 | P3 | 边界情况 | 缓存命中直接回写 body，丢失原 handler 的其它响应头（Set-Cookie/Cache-Control 等）；若命中路由有会话 cookie 会断登录；未设置 X-Cache: MISS | 透传必要头部
backend/internal/cache/middleware.go:18-26 | P3 | 错误处理 | InvalidatePrefix 忽略 Scan/Del 全部错误 | 至少记录错误日志
backend/internal/config/config.go:18-20 | P3 | 配置与启动 | godotenv 按 ../.env、../../.env、.env 相对路径加载，依赖运行 CWD，从不同目录启动行为不一致 | 支持环境变量指定 .env 路径
backend/internal/db/db.go:26-28 | P2 | 配置与启动 | statement_timeout 固定 15s 同样作用于 migrate/seed 命令：大表 DDL、批量写入超过 15s 会被强制中断 | migrate/seed 单独建池或放宽 statement_timeout
backend/internal/db/db.go:35-37 | P3 | 稳定性 | Ping 用 context.Background 无超时，DB 半死状态可能卡死启动 | 加 5s 超时上下文
backend/internal/scheduler/scheduler.go:25-34 | P3 | 稳定性 | AddFunc 注册失败仅记日志后 cron 仍启动（静默空任务）；聚合任务无并发防重（依赖 SkipIfStillRunning，跨实例部署无效）| 注册失败返回错误；多实例场景加 DB 锁/唯一约束
backend/internal/scheduler/scheduler.go:26-31 | P3 | 数据一致性 | 30 分钟超时取消 context，若聚合中断无事务兜底会留下半成品结果 | 确认聚合任务事务边界
backend/internal/domain/evaluation.go:69,84 | P2 | 低危安全 | Question.Answer 与 ExamQuestion.Answer 无 omitempty 恒序列化，若学生端答题/考试接口下发完整题目对象会直接泄露标准答案 | 答题下发用 DTO 排除 Answer/Analysis
backend/internal/domain/scene.go:23,job.go:50,models.go:53,alliance.go,unified.go | P3 | 命名/一致性 | tenantId 暴露策略混乱：Exam/ExamUsage/SceneEvaluationResult 用 json:"-" 隐藏，Scene.TenantID 等用 omitempty 暴露；CareerPosition.CreatedBy 为非指针与其他模型不一致 | 统一敏感字段序列化与指针风格
backend/internal/domain/unified.go:19-34 | P3 | 错误处理 | JSONMap.Scan 对非 []byte/string 类型静默返回 nil 不置值（吞错） | 返回明确错误
backend/internal/domain/unified.go:41 | P3 | 边界情况 | StringSlice.Value 对 nil 编码为 "null"，NOT NULL jsonb 列语义不符 | nil 时返回 "[]"
backend/internal/domain/evaluation.go,lesson.go,portal.go,job.go | P3 | 数据一致性 | 部分模型（AppealRecord、Course、ExamResult、GraduationProjectEvaluation、CertIssuanceRecord 等）无 TenantID 字段，租户隔离完全依赖 handler/store 查询条件，本批仅看 domain 无法确认越权风险 | 抽查对应 store 是否都有 tenant 过滤
```

## 无问题文件
- backend/internal/domain/affairs_batch.go
- backend/internal/domain/affairs.go
- backend/internal/domain/alliance.go
- backend/internal/domain/certification_model.go
- backend/internal/domain/lesson.go
- backend/internal/domain/library.go
- backend/internal/domain/portal.go
- backend/internal/domain/status.go

总行数 2821
