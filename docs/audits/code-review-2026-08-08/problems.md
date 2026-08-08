# 知与 SaaS 全量代码复查问题清单（2026-08-08）

> 审查范围：前后端全部源码 **约 990 个文件、约 20 万行**，逐文件、逐行完整通读（清单见 [`checklist.md`](./checklist.md)）。
> 审查性质：**复查**——2026-08-07 首轮全量审查后已修复 P0×4 / P1×73 / P2 精选 / 死代码，本轮重点为「修复引入的回归、上轮遗漏、遗留问题」。
> 审查原则（依 AGENTS.md）：简单优先；安全只排高危；性能与稳定性优先；容忍 hacker；锁只给核心业务。
> **回查验证**：本清单生成后已对全部 P0/P1 逐条回到代码复核（标注「已回查确认 / 回查降级 / 回查排除」）。

## 统计总览

| 严重级 | 数量 | 说明 |
|--------|-----|------|
| P0 高危 | **2** | 均为修复引入的回归（能力域 CRUD 404、题库带知识点绑定必 500），均回查确认 |
| P1 严重 | **33** | 修复回归 6、上轮遗漏/遗留 25、误报排除 1、降级 2 |
| P2 重要 | **328** | 边界/竞态/错误吞/租户纵深/契约（详见第三章） |
| P3 一般 | **607** | 死代码/风格/测试瑕疵（统计见第四章，明细在 raw/） |
| **合计** | **970** | 已对全部文件逐行通读 |

---

## 一、P0 高危（2 条，全部回查确认）

| # | 位置 | 问题 | 最佳实践方案 |
|---|------|------|--------------|
| 1 | `backend/internal/handler/ability_domain_handler.go:46-109` | **修复引入回归**：08-07 租户隔离修复给 GetByIDFn/UpdateFn/DeleteFn 加了租户限定，却漏配 `TenantFn: requireTenant` → crud 骨架 tenantID="" → store `WHERE tenant_id=''` 恒不命中，**能力域 Get/Update/Delete 一律 404**（Create/List 正常）。已在真实测试库复跑确认 | crud 配置补 `TenantFn: requireTenant`（对照 ability_handler.go:99），并补不依赖 DB 的 handler 单测 |
| 2 | `backend/internal/store/question_banks.go:102-106,141-146` | **上轮遗漏**：`INSERT INTO question_bank_knowledge_points (id, tenant_id, ...)` 引用**不存在的 tenant_id 列**（表仅 id/question_bank_id/knowledge_point_id/created_at，已 pgx 实测 SQLSTATE 42703）。**题库 Create/Update 携带知识点绑定即 500** | 列清单去掉 tenant_id（绑定表靠 question_bank_id 关联），保留 ON CONFLICT |

---

## 二、P1 严重（33 条，已逐条回查）

### A. 修复引入的回归（6 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `backend/internal/scheduler/scheduler.go:38-49` | `aggregateAll` 从共享连接池取连接 `SET statement_timeout=0` 后 Release，pgxpool 不重置会话设置 → 该物理连接永久失去 15s 超时保护，失控慢查询可挂死连接池 | 已确认 | Release 前 `RESET statement_timeout`（defer 内先 Reset 后 Release），或独立专用连接 |
| `backend/migrations/140_tenant_fk_cascade.up.sql:18` | 孤儿清理会把 108 为运营方租户（0000…0001，seed 尚未创建）预插的字典行当孤儿删除 → **全新部署平台租户字典为空**，上轮修的 108 种子时序被回归 | 已确认（108:49-54 依赖预插可用） | 清理语句统一加 `AND tenant_id <> '00000000-0000-0000-0000-000000000001'` 豁免平台租户 |
| `packages/ui/src/components/shared/import-confirm-dialog.tsx:51-59` | 上轮「导入防重」回归：`run()` 内 `fn()` 未 await，async 调用方未挂起 → finally 同步 setPending(null)，React 批处理使 busy 态不渲染 → **连点可并发两次 importExcel** | 已确认 | `await fn()`（try 内），finally 再 setPending(null) |
| `backend/internal/handler/job_ability_result_handler_test.go:91-94` | 上轮新增测试回归：`((85-70)/70*0.6+0)*100` 中 `(85-70)/70` 为 Go 整型除法=0，断言恒失败（实现为 float64 得 12.857） | 已确认（go run 实测） | 改 `((85.0-70)/70.0*0.6+0)*100` 或直接写期望值 |
| `backend/internal/handler/approval_handler.go` 相关（router/routes.go:255） | admin 路由内层 OperationLog 与外层叠加 → `/admin/*` 写操作双写审计日志 | 已回查排除：外层 oplog 仅在 `/api/v1` 组生效，admin 组内层为唯一写入路径，无双写 | — |
| `apps/edu/app/job/landing/[id]/page.tsx:91-169` | 两个 effect 共享 `loadSeqRef`：切换岗位 id 时 effect2 抢占序号 → effect1 finally 跳过 setLoading(false)、effect2 不复位 → **页面永久骨架屏** | 已确认 | effect1 用独立 seq 或 cancelled（learn 页 30-47 为正确范本） |

### B. 越权 / 租户隔离（8 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `handler/certification_handler.go:406-485` | `PutFullRule` 未校验新 careerPositionID 租户归属（UpdateRule 已修，此处遗漏）→ 可跨租户改绑认证规则 | 已确认 | 补 `PositionTenantID` + `verifyTenantOwnership` |
| `handler/course_node_handler.go:164-165,224-229` | Create/Update 的 kpIDs/resIDs/sourceId 不校验租户归属；enrich 查询（store/course_nodes.go:199-240,278-334）全无租户过滤 → 可跨租户回显知识点/资源（含 URL） | 已确认 | 绑定/回显查询补 tenant 条件 |
| `handler/favorites_handler.go:39-66` + store/favorites.go | 收藏体系全链路无租户维度（表无 tenant_id、List JOIN 无过滤），任意登录用户可读他租户对象元数据并污染全局收藏计数 | 已确认 | user_favorites/favorite_counters 增 tenant_id，Toggle/Get/Count/List 按租户过滤 |
| `handler/question_handler.go:110,161,229` | Create/Update/BatchCreate 的 bankId 未校验归属租户 → 跨租户写他人题库（孤儿数据） | 已确认 | 复用 `GetQuestionBankInTenant` 校验 |
| `handler/scheduling_handler.go:416-451` | CreateSchedule/UpdateSchedule 的 planEntryId 无租户校验；store `FallbackClassID/PlanEntryCourseID/DeleteScheduleWithRestore` 无租户条件 → 跨租户读班级名/写计划条目状态 | 已确认 | handler 校验 planEntryId 归属 + store 查询补 tenant |
| `store/position_certificates.go:23-66` | `List` 无 tenant 过滤（handler 已校验 careerPositionId 归属） | 回查降级 P2：handler List 已有归属校验，store 属纵深 | store.List 加 tenantID 参数 |
| `store/alliance_store.go:55-73` | `nilToEmpty` 仍是空操作，空 ID 新建学校信息 `''::uuid` 必 500 | 回查降级 P2：无前端调用方（学校页直接改 tenant） | SQL 改 `COALESCE(NULLIF($1,''), gen_random_uuid())` |
| `store/alliance_project_store.go:197-199` | DeleteMilestone 声称少传参数 | **回查排除（误报）**：SQL 与参数均正确（`id, tenantID`） | — |

### C. 数据丢失 / 部分更新兜底遗漏（8 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `handler/alliance_crud_handler.go:342-485` | achievement/expert/agreement/brand 四实体无 ValidateUpdateExisting，部分 PUT 清空整行（与已修联盟 bug 同类遗漏） | 已确认 | 按 enterprise/project 模式补回退 |
| `handler/exam_usage_handler.go:100-112` | Update 的 description/start_time/end_time/duration 无 COALESCE 兜底（仅 target_type/target_ids 有），只改 name 即清空考试时间窗口 | 已确认 | store 指针字段 COALESCE 兜底 |
| `handler/course_node_handler.go:231-249` | Update 无部分更新兜底，nil 字段写 NULL、sortOrder 写 0 | 已确认 | 回读现有节点做兜底（参照 course Update） |
| `apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx:164-180` | 移动排课载荷缺 classNodeIds → 后端回退仅主班级，**多班级条目移动后其余班级丢失** | 已确认 | 载荷补 `classNodeIds` |
| `apps/edu/app/portal/apps/system/org-user/fields/page.tsx:75-88` | 启用开关只发 `{isEnabled}` 缺 fieldName → 后端 400，**开关永远切换失败** | 已确认 | 回传完整字段 |
| `apps/edu/app/portal/apps/system/org-user/fields/page.tsx:90-96` | 编辑保存缺 isEnabled/isRequired → Go 零值 false 写入，**字段被静默禁用** | 已确认 | 提交完整对象或后端指针语义 |
| `apps/edu/app/lesson/admin/system/add/page.tsx:768,796-800` | `hasSavedRef` 在 saveNodes 前置位且 handleSave 无返回值 → 节点树保存失败仍跳转，**节点静默丢失** | 已确认 | saveNodes 成功后再置位，或 handleSave 返回 boolean（参照 hybrid） |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:184-337` | 首屏加载 effect 依赖含 `t`/ensureDatasets（随 locale 变化）→ 切语言整页重载重建 taskStates，**未保存编辑全部丢失** | 已确认 | effect 只依赖 scenarioId，数据集加载解耦 |

### D. 错误吞静默失败（4 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `handler/crud.go:100,187` | crudCreate/crudUpdate 回读错误被 `item, _` 吞 → 201/200 返回零值实体 | 已确认 | 回读失败 respondServerError |
| `handler/content_actions.go:183-184` | review 成功后 fetch 错误忽略 → 200 返回 null | 已确认 | 同上 |
| `handler/evaluation_result_handler.go:218` | Grade 后回读错误忽略 → 200 返回评分前旧数据 | 已确认 | 同上 |
| `service/node_evaluation_result.go:43-45` | FindNodeExamResult 真实 DB 错误与"无考试结果"混同静默吞掉，评分成功但分数回写永久失败无日志 | 已确认 | store 区分 ErrNoRows，service 对真实错误打日志 |

### E. 功能失效 / 契约 / 性能（7 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `handler/position_responsibility_handler.go:91-99` | UpdateFn 透传 careerPositionId 但 store 不写该列 →「职责移动」静默无效；未来补写将形成跨租户写 | 已确认 | store 补写列并在 handler 校验目标岗位租户，或移除该字段 |
| `domain/evaluation.go:12` + `store/question_banks.go:248,282,303` | `QuestionBank.Description` 直扫可空列；导入空描述单元格确定性落 NULL → **题库列表/详情 500** | 已确认（question_bank_import_handler.go:120 落 NULL 路径） | 改 `*string` + 判空（参照 Exam.Description 范式） |
| `apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx:389,2011-2040` | qbDrawMode/qbPassRate 仅本地 state 不持久化到 methodResourceConfigs → **答题方式/正确率配置从未生效** | 已确认 | 走 `updateResourceConfig('question_bank', ...)` |
| `apps/edu/components/evaluation/question-form-dialog.tsx:92,219` | 弹窗无分值控件，新建题目 score 恒 0 落库 | 已确认 | 补分值输入或提交 undefined 让后端兜底 |
| `apps/edu/hooks/use-approvals.ts:53` | `approvalApi.list({limit:1000})` 被后端钳 200，审批超 200 条静默截断（fetchAllPages 遗漏调用点） | 已确认 | 改用 fetchAllPages 分页合并 |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:625-637` | 删除临时 id（`task-*`）任务直接调 taskApi.delete 必 404，未保存的克隆任务无法删除 | 已确认 | 临时 id 本地移除，落库任务才调接口 |
| `packages/api-client/src/api-helpers.ts:122-139,250-261` | JWT 仍存 localStorage（上轮遗留暂缓项，XSS 可窃取会话） | 已确认（维持暂缓：架构级改造） | httpOnly+Secure cookie 或 refresh token |

---

## 三、P2 重要（328 条）

> 全部 P2 条目（按来源批次分组），每条含精确位置与最佳实践；原始逐行记录见 `raw/`。


### backend-domain.md（7 条 P2）

- [NULL 直扫·未修复] evaluation.go:92 + store/exams.go:221,283 — `Exam.Version string` 直扫可空列 `exams.version`（001_baseline:427 无 NOT NULL）。应用侧全部 INSERT 路径（exams.go:55、course_assessments.go:135、task_evaluation.go:469）均显式写 'v1.0'，当前风险仅限存量/外部 NULL 行；最佳实践：domain 改 `*string` 或 SQL `COALESCE(e.version, '')`（description 已按此处理，version 漏）。
- [NULL 直扫·未修复] evaluation.go:22 + store/question_banks.go:248,282,303 — `QuestionBank.Version string` 直扫可空列 `question_banks.version`（001_baseline:848 无 NOT NULL），与 Description 同源同修。
- [枚举/DB 默认值错位·未修复] lesson.go:107 + 001_baseline:601 — `LessonBatch.Status LessonBatchStatus`（=ContentStatus，open/closed）但 `lesson_batches.status` DB 默认值为 `'active'`；batch_configs.go:96 CreateWithStatus 保证 handler 路径显式写状态，绕过 handler 的插入（种子/脚本）会得到 'active' 与 open/closed 两态冲突；最佳实践：新增迁移把默认值改为 'open'。
- [枚举错位·未修复] models.go:85 + status.go:24 — `InstitutionStatus = ContentStatus`，但 DB `institution_status` 枚举只有 pending/approved/disabled（001_baseline:4-8）；ContentStatus 的 draft/rejected/published/open/closed 等值写入该列会被 DB 拒绝，且 'disabled' 无对应常量。本轮核实：Go 代码层无 INSERT/UPDATE institutions 路径（仅 auth.go:129 读取），风险为潜在类型隐患；最佳实践：独立定义 InstitutionStatus 枚举（含 StatusDisabled="disabled"）。
- [NULL 扫描风险·未修复] scene.go:16 + store/scenarios.go:205,220 — `Scenario.Difficulty int` 直扫可空列（001_baseline:1010 `difficulty smallint` 无 NOT NULL，CHECK(1-5) 放行 NULL）；存量 NULL 行导致列表/详情扫描报错；Create 路径 handler 直传 int 为 0 时触发 CHECK 拒绝→500；最佳实践：domain 改 `*int` 或 store COALESCE + handler 校验 1-5。
- [NULL 扫描风险·未修复] scene.go:43 + store/scenario_tasks.go:84,262,293 — `ScenarioTask.Difficulty int` 直扫可空列（001_baseline:980 同型）；Create 的 RETURNING 直扫（scenario_tasks.go:84）在 `Difficulty *int`（:245）为 nil 时 NULL 落库并**当场扫描失败**——行已插入但接口报 500，比 Scenario 更直接；最佳实践：同上。
- [枚举错位·未修复] status.go:24 — `InstitutionStatus = ContentStatus` 与 DB 枚举错位（详见 models.go 条目）；别名体系其余（CareerPositionStatus/CourseStatus/ScenarioStatus/BatchStatus/LessonBatchStatus/SceneBatchStatus）及保留旧常量与使用点一致，无悬挂引用。

### backend-infra.md（6 条 P2）

- [边界/正确性] cmd/migrate/main.go:230-254 — `splitSQLStatements` 为手写分割器，只识别 `;\n` 与无标签 `$$...$$`：单引号字符串字面量内出现 `;\n`（如 `INSERT ... VALUES ('a;\nb')`）、带标签美元引用 `$tag$...$tag$`、注释内出现 `;\n` 三种场景会被错误切碎，生成的 SQL 运行时必然报错。最佳实践：改用 pgx 简单协议多语句执行（`QueryExecModeSimpleProtocol`，天然支持多语句且不切分），或至少补 `$tag$` 与单引号状态识别。
- [事务/原子性] cmd/migrate/main.go:120-126,188-194 — 多语句迁移在事务外逐条执行：中途失败时前序语句已落库且 `schema_migrations` 未记录，重跑会因"语句已执行"再次报错（如无 IF NOT EXISTS 的 DDL），只能手工修复。最佳实践：为多语句迁移引入逐语句 `SAVEPOINT` 或要求迁移文件幂等；至少把该约束写进 migration 编写规范。
- [可用性/单点] cmd/server/main.go:38-42 — REDIS_URL 已配置但 Redis 不可达时 `cache.NewClient` 返回 error → `os.Exit(1)` 整个服务拒绝启动；而 cache 中间件对 `client == nil` 已有完整降级旁路（cache/middleware.go:20-21,36-39,105-107），说明 Redis 本是可降级组件。最佳实践：ping 失败改为 `slog.Warn` + 以 nil client 继续运行（限流/缓存失效但服务可用），或将 Redis 启动探测改为有限次重试。
- [安全/限流] cache/middleware.go:90-94 — `clientIP` 直接信任 `X-Forwarded-For` 首段，与 router.go:99-100 的明确立场（"XFF 客户端可控，拒绝用于限流/日志"）自相矛盾：攻击者可伪造任意 XFF 绕过登录限流（每请求换 IP 即无限尝试密码），或伪造受害 IP 每窗口刷 30 次将其登录锁定。最佳实践：在 nginx 层用 `real_ip_header`/`set_real_ip_from` 重写可信源，后端统一读 `RemoteAddr`（与 router 注释一致）；若必须保留 XFF，至少对无 XFF 与有 XFF 的请求用不同桶或加 nginx 签名头校验。
- [性能/阻塞] cache/middleware.go:55-57 — 缓存 miss 时同步等待 `client.Set`（最长 2s，且发生在响应已写回客户端之后）：冷缓存 + 并发高峰时 handler 协程滞留 2s，叠加 redis 池（10）与默认重试可放大排队。最佳实践：改异步 goroutine 写入（限并发），或 Set 改 1s 超时 + 丢弃。
- [并发/多实例] scheduler/scheduler.go:21-35 — 多副本部署时每实例每天 02:00 各自执行 `AggregateAllPublished`，重复计算并写入重复汇聚日志（CreateLog 每 target 一条）。最佳实践：用 `pg_try_advisory_lock` 做跨实例单飞，抢锁失败者直接跳过本次。

### backend-middleware-router.md（6 条 P2）

- [JWT 校验]（遗留）auth.go:53-57 — 中间件只校验"能解析 + 签名有效"，不强制 `claims.UserID != ""`。登录多租户流程签发的 `preAuthClaims`（auth_handler.go:159-169，含 `platform` 字段、无 `userId`）与正式令牌同密钥同 HS256，可被本中间件解析为 `Claims{Platform:"portal", UserID:""}` 并放行进入仅挂 `RequirePlatform` 的端点（`/auth/portal/me`、`/subscriptions`、`/stats/me` 等）：`PortalMe` 以空 UserID 查库、`SubscriptionHandler` 因 tenant 过滤拒绝，无数据泄露但属于令牌类型混淆缺口，且空 UserID 请求会打到 DB 查询（500 面）。最佳实践：解析成功后 `if claims.UserID == "" { 401 }`，天然排除 preAuthToken 及任何签名正确但结构不全的令牌。
- [oplog 缓冲]（遗留）oplog_buffer.go:63-69 — `flushLoop` 的 `defer recover()` 记录 panic 后让 goroutine 永久退出（done 关闭、循环终止），此后所有操作日志入队即丢弃且 `Shutdown()` 立即返回，整个审计管线不可自愈。最佳实践：recover 后不 return，继续外层 for 循环（或重启 goroutine）。
- [oplog 缓冲]（遗留）oplog_buffer.go:121-125 — 批量 `br.Exec()` 错误处理不符合 pgx 语义：单行失败后后续 `Exec()` 复读同一错误，剩余行实际消费与否由服务端决定但本地一律记失败，且每行一条 warn 造成错误风暴。最佳实践：首个错误即 break，统一记一条"N 行成功/第 K 行失败"。
- [未鉴权接口]（遗留）router.go:122 — `GET /uploads/{filename}` 完全公开（无 JWT、无租户隔离）：上传目录全局共享，获得 URL 即可读任意上传文件（作业附件、证件照、含个人信息的导入 Excel）。缓解：文件名 UUID v4 不可枚举、扩展名白名单 + `..` 拒绝 + 前缀校验（file_handler.go:164-189）防穿越与 XSS。最佳实践：至少要求 JWT；更进一步按租户子目录存储。
- [日志记录]（**修复引入回归，本次新发现**）routes.go:255 — 上轮修复在 platformAdmin 组内追加 `r.Use(authmw.OperationLog(db, oplogBuffer))`，但该组已在外层全量鉴权组（routes.go:60-62 的 `OperationLog`）之内：`/admin/*` 写操作（租户 CRUD、管理员重置密码、订阅/主题变更）会**连续通过两层 OperationLog，双写两条相同 operation_logs 行**。核实现有数据模型：平台管理员 `tenant_id = OperatorTenantID` 非空（cmd/seed/main.go:87-96），外层 oplog 的 `claims.TenantID == nil` 提前返回（oplog.go:109-112）不会拦它——即上轮"admin 不记日志"的判断不成立，本轮修复反而造成重复。最佳实践：删除 routes.go:255 的内层 OperationLog（外层已全覆盖）；若意图是确保审计，应改为在 oplog.go 按角色/路径去重而非叠加中间件。
- [路由注册]（遗留）routes.go:60-256 — 9+ 组同 method+path 双注册全部依赖 chi"后注册静默胜出"（已核实 chi tree.go `setEndpoint` 直接覆盖 handler 不报错），且全部为"后注册组 = 更宽门禁 + 同一 handler"的有意降权；任何分组顺序调整都会**静默**改变门禁。最佳实践：顶部集中注释表 + 新路由优先单次注册到最宽组。

### backend-migrations.md（2 条 P2）

- [数据] 113_exam_questions_unique.up.sql:1-2 — 直接 ADD UNIQUE(exam_id, question_id)，未先清理存量重复行（对比 114 先 DELETE 再建约束）；若存在重复（同一试卷重复添加同一题目）则 ALTER 失败阻断部署。最佳实践：参照 114_cert_issuance_unique.up.sql:4-9 先清重。
- [运行时] 133_exam_activation_mode.up.sql:18-21 — `COALESCE(NULLIF(paperId,''), NULLIF(examId,''))::uuid` 无条件 uuid 强转；若存量 task_evaluation_methods.resource_config 中 paperId/examId 是非 uuid 文本（历史脏数据），`::uuid` 抛错导致整个迁移失败、阻断部署。最佳实践：加 `~ '^[0-9a-f]{8}-[0-9a-f]{4}-...'` 格式过滤或 CASE WHEN 校验后再强转。空串场景已由 NULLIF 兜住（NULL::uuid 安全），风险限于非法格式文本。

### frontend-api-client.md（8 条 P2）

- [超时] api-helpers.ts:177 — `fetch` 无 `AbortSignal` 超时；后端有 30s/10min 超时中间件，但客户端网络挂起时 UI 无限等待、页面卸载后请求仍在跑。上轮遗留。最佳实践：读接口挂 `AbortSignal.timeout()` 并透传外部 signal。
- [错误处理] api-helpers.ts:178-179 — `hasBody` 用 `content-length !== '0'` 判断响应体；chunked 响应无 content-length 时非 JSON 成功响应会被 `res.json().catch` 兜底成 `{error:'请求失败'}` 作为业务数据返回。上轮遗留。最佳实践：按 Content-Type 判断或对空体接口显式处理。
- [契约] job.ts:72-75 — `saveFull` 响应类型声明 `{ position: CareerPosition }`，后端直接返回岗位对象（position_handler.go:490 `respondJSON(w, http.StatusOK, pos)`），无 position 包装；当前唯一调用方（edu `job/positions/[id]/edit/page.tsx:214`）忽略返回值故无运行时影响，但类型误导后续调用方。上轮遗留。最佳实践：类型改为 `Promise<CareerPosition>`。
- [契约] evaluation.ts:486-489 — `aggregateStatus` 的 `careerPositionId` 类型为可选，后端必填（job_ability_result_handler.go:438-442 缺失返回 400）；响应类型 `| null` 也不会出现——后端无记录返回 404 而非 null。上轮遗留。最佳实践：careerPositionId 必填、类型改 `Promise<JobAbilityAggregateStatus>`。
- [契约] portal.ts:120-124 — `portalUserExtensionFieldApi.list` 声明返回 `ListResponse<UserExtensionField>`，后端仅返回 `{items}` 无 `total`（user_extension_field_handler.go:17-18,41）；若调用方读 `.total` 恒 undefined。本轮新发现（当前唯一页面用 `fields.length` 故无运行时影响）。最佳实践：类型改 `{ items: UserExtensionField[] }`。
- [契约] system.ts:71-78 — `approvalApi.review` 请求体含 `nextStepIdx`，后端 `ReviewApprovalRequest` 仅 action/remark（approval_handler.go:46-49），按步骤审批参数被静默丢弃、流转实际由后端 CurrentStepIdx 推进，前端"指定步骤"无效且无报错。上轮遗留。最佳实践：后端补齐 stepIdx 或前端移除。
- [错误处理] affairs.ts:250-253 — `scheduleApi.exportExcel` 未检查 `res.ok` 即 `downloadBlob(await res.blob())`，非 2xx 的 JSON 错误体会被下载成「排课导出.xlsx」垃圾文件；同文件 :153-160 teachingPlanApi.exportExcel 有 ok 检查，行为不一致。上轮遗留。最佳实践：复用 :155-158 模式。
- [契约] honors.ts:5-6 — `list` 的 `userId` 声明为可选，后端对业务用户必填、缺失返回 400（student_honor_handler.go:62-66）；学生由后端强制本人。教师端不传必 400。上轮遗留。最佳实践：拆学生（无参）/业务用户（必传 userId）两种签名。

### frontend-app-01.md（13 条 P2）

- [竞态] 82-146 — loadCourses 无 cancelled/序号守卫；programId 变化（同路由客户端导航）时旧响应可能覆盖新方案课程列表。最佳实践：沿用 `let cancelled` 或 seq ref 模式（同仓库 job/landing 已有先例）。
- [错误被吞] 86-88 — preview 接口异常时静默降级为直接导入（跳过重复校验），若 preview 失败源于网络/服务错误将产生重复课程且无提示。最佳实践：预览失败应报错并中止，仅将「无重复」作为跳过预览的合法分支。
- [数据丢失] 52-79, 83-113 — loadProgram 失败（toast 后）仍渲染空表单，且保存按钮可用：用户误输入名称后点击保存会对已存在方案执行全量 update，可能覆盖真实字段。最佳实践：加载失败时禁用保存或回退只读。
- [状态] 45-46 — `setPlanId((prev) => prev || targetId)`：URL planIdParam 在页面挂载后变化（如从另一计划详情点「前往排课」）时被忽略，仍显示旧计划。最佳实践：prev 为空时用 targetId 即可满足首选，但要监听 planIdParam 变化强制同步。
- [一致性] 182-188 — `teachingPlanApi.submit` 成功后 `approvalApi.create` 失败：计划已变 pending 但无审批流，toast 提示提交失败，用户重试会重复 submit（后端幂等性未知）。最佳实践：先 create 审批记录再 submit，或提交失败时引导到审批列表核对。
- [状态] 78-90 — triedReload ref 使同路由内切换试卷 id（客户端导航复用组件）时不再触发加载，新 id 不在 store 时误显示「试卷不存在」。最佳实践：effect 中按 examId 重置 triedReload 或改为 key 驱动。
- [时区/契约] 173-179, 204-205 — `<input type="datetime-local">` 的本地无时区串（如 `2026-08-08T10:00`）直传后端：Postgres timestamptz 按服务器会话 TZ 解释，服务器为 UTC 时用户选的 10:00 实际 18:00（UTC+8）才开启；同时后端 evaluation_result.go:29 `time.Parse(RFC3339,...)` 对该格式解析失败导致开始时间守卫静默失效（仅靠 SyncScheduledExamUsageStatus 懒更新兜底）。toDatetimeLocal 注释「UTC」与提交行为自相矛盾。最佳实践：提交前按本地时区补偏移转 RFC3339，展示用同一时区还原。
- [状态] 47 — `useState(positionIdParam || '')` 仅初始化一次；挂载后 URL positionId 变化不再生效（与 scheduling/page 同类问题）。
- [错误处理] 199-204 — 倒计时归零自动交卷：提交失败时 submittedRef 已置位，不再自动重试且倒计时停留 0（手动提交按钮仍可用兜底，但「自动交卷」承诺失效）。
- [性能] 53-67 — 对每个考试安排（最多 500 个）并发发起结果列表请求（N+1）；量大时打满后端且首屏慢。最佳实践：后端提供按 usage 聚合统计接口，或前端只对可见项懒加载。
- [竞态] 106-116 — selectedCourseId 快速切换时无 cancelled 守卫，旧课程的结果/节点响应可能覆盖新课程数据。
- [错误被吞] 292-299, 332-357 — createQuestion/updateQuestion/deleteQuestion 及批量复制/删除全部 fire-and-forget：无 await、无 catch、无失败提示；单条失败静默丢失且批量操作无条件清空选择集。最佳实践：Promise.allSettled + 结果 toast（参照 job/archive/page.tsx:104-117 模式）。
- [状态] 291-437 — TaskMethodTabs 定义在 GradingPageContent 渲染函数内部：每次父组件重渲染（切换折叠、选择场景、搜索）产生新组件类型，activeMethod 状态被重置回第一个方法 tab。

### frontend-app-02.md（33 条 P2）

- [截断] 行 512-517 — `positionApi.list({ limit: 1000 })` 与 `batchApi.list({ limit: 1000 })` 仍为单次全量拉取，超过后端 maxPageSize（200）时列表被截断，超量岗位无法进入学习路径编辑（页面无截断提示）。最佳实践：改用 `fetchAllPages` 或服务端分页。
- [部分失败] 行 96-112 — `handleMove` 仍用 `Promise.all` 并发更新全部推荐顺序，中途某个 update 失败则其余已生效，无回滚补偿（上轮已标记未修）。最佳实践：串行逐个更新或失败时反向补偿。
- [状态陈旧] 行 100-111 — 上轮问题未修：effect 内先 `setCustomKnowledgePointIds(new Set())` 再逐条 functional update，随后同步读 `customKnowledgePointIds.has(k.id)`（行 111）用的是本次渲染的空集合快照，池内全部课程自定义知识点 `linked` 恒为 true，自定义标识在复选框中不生效。最佳实践：effect 内先构建完整 Set 局部变量一次 setState。
- [数据完整性] 行 274-289 — 上轮问题未修：新建课程（editId 为 null）时自定义知识点 `knowledgeApi.create({ sourceId: editId })` 写入 sourceId=null，保存后 `router.replace` 带真实 id 重新加载，`k.sourceId === editId` 匹配不到 → 这些知识点不再被识别为课程自定义，后续编辑改名/描述不再同步。最佳实践：创建课程拿到真实 id 后补一次 update 回填 sourceId。
- [部分失败] 行 374-387 — 上轮问题未修：新建课程 `courseApi.create` 成功后 `persistNewResources` 失败走 catch，课程已创建但 URL 未替换，用户重试保存会再创建一门重复课程。最佳实践：create 成功后先 replace URL 再持久化资源。
- [状态管理] 行 363 vs 374-387 — **新发现**：编辑分支第 363 行置 `hasSavedRef.current = true`，但新建分支（374-387）成功后**未置位**，`handleFinish`（行 395-399）首次点击"完成配置"保存成功后 `if (!hasSavedRef.current) return` 不跳转，用户需点两次才能离开（且 toast 重复提示）。最佳实践：新建分支成功路径同样置位 hasSavedRef。
- [陈旧闭包] 行 310-329 — 上轮问题未修：`AttachmentListEditor.handleFileChange` 上传完成回填时读取闭包 `items` 做 `findIndex`，若上传期间该附件被删除则 idx=-1 静默丢弃（文件已上传 CDN 成孤儿）；若被追加条目不受影响。最佳实践：上传开始记录 itemId，回填前校验仍存在，失败提示。
- [契约不一致] 行 219 — `const mode = data.moduleModes?.[moduleKey] ?? 'online'` 默认显示"线上"，而序列化端 module-serialize.ts:81 `mode: d.moduleModes?.[key] || 'offline'` 默认落库 offline：用户从未切换过开关的模块，编辑弹窗显示"线上"但保存后实际为线下，且刷新后开关翻转为"线下"。**新发现**。最佳实践：两处默认值统一（线上 or 线下），或序列化前归一化默认。
- [重复加载覆盖] 行 190-323 — 上轮问题未修：加载 effect 依赖 `abilityPool`（行 323），能力池拉取完成触发 effect 重跑，编辑模式重新拉取课程/节点/模块并整体覆盖 `nodeDataMap`/`moduleAssignments`/`selectedNodeId`（会重置用户已选节点），新建模式则重置 nodes（若用户在该窗口内已添加节点会丢失）；`setAbilityPoints` 在第二次运行才拿得到池内名称（首次显示裸 UUID 名称）。最佳实践：去掉 abilityPool 依赖，改为首次加载后单独 setAbilityPoints。
- [字段丢失] 行 691-692 — `buildCoursePayload` 使用 `existing?.semester`/`existing?.className`，`courseForm.semester` 的用户修改永不生效（表单无该输入项，属死字段，上轮已标记未修）。建议删除或打通 UI。
- [运算符优先级] 行 141-144 — 上轮问题未修：`draft?.estimatedHours || node.estimatedHours ? parseFloat(...) : undefined` 实为 `(a || b) ? c : d`：用户清空 estimatedHours（draft=''）而 node 原值存在时回退用旧值，**无法清空该字段**；parseFloat 无 NaN 兜底。最佳实践：显式 `const v = draft?.estimatedHours; const eh = v !== undefined && v !== '' ? parseFloat(v) : node.estimatedHours`。
- [状态丢失] 行 724-732 — **新发现**：保存后 `setNodes(refreshedNodes)` 替换为真实 ID 列表，但**未重映射 `selectedNodeId`**（hybrid 版行 802-805 已做映射），选中节点 id（temp）不再存在于 nodes → 选中态清空、表单重置为未选状态，用户每次保存后必须重新点选节点；nodeDrafts 中旧 temp id 条目残留。最佳实践：按 `idMapping` 同步重映射 selectedNodeId 并迁移 drafts key。
- [静默丢失] 行 657-672 — 上轮问题未修：自定义知识点 `knowledgeApi.create` 失败仅 `reportError` 继续，`resolveKnowledgePointIds`（lesson-save-utils.ts:72）随后把 `kp-custom-*` 过滤掉 → 该知识点从保存中静默消失。最佳实践：创建失败即中止保存并 toast。
- [截断] 行 388 — `knowledgeApi.list({ limit: 200 })` 被后端上限截断，超过 200 个知识点的租户其池内缺项；行 181 `nodeResourceApi.list({ courseId, limit: 200 })` 同样截断，resourcePool 不完整导致已绑定资源无法解析展示。最佳实践：fetchAllPages 分页合并。
- [竞态] 行 172-238 — 上轮问题未修：加载 effect 依赖 `abilityPool`（行 238），池加载完成触发重跑并整体重置 courseName/nodes/selectedNodeId 等状态，存在覆盖用户编辑窗口。
- [竞态] 行 529-591 — `handleGrainConfirm` 已加 `confirmNodeId !== selectedNodeIdRef.current` 守卫（行 556、586，修复正确），但行 591 `setNodeEvalRuleConfig(undefined)` 在 try/catch **之外**无条件执行：异步拉取期间用户切换节点 → 早期 return 后仍会清空**当前节点**的评价配置 UI 状态（数据层因 buildEvalDataForSave 回退不丢，仅 UI 显示为空）。**新发现**。最佳实践：切换守卫后同样跳过 591 行。
- [跨节点状态残留] 行 281/330、716-722 与 288/349、638 — 上轮问题未修：`submittedMethodKeys`/`hybridSubmittedKeys` 以 methodKey 为键、**切换节点不重置**；节点 B 与节点 A 配置相同 methodKey 时，切到 B 后卡片直接显示"已提交/pending"（`overriddenResult` 短路），用户误以为已提交。最佳实践：提交键带上 nodeId 或在 activeNodeId 变化时清空。
- [竞态] 行 116-132（course 加载）与 134-158（nodes/hybrid modules 加载）— 上轮问题未修：两 effect 无取消/序号守卫，快速切换课程 id 时旧响应可覆盖新数据。最佳实践：cancelled 标志或 AbortController。
- [崩溃风险] 行 649 — `course.creatorId.slice(0, 8)`：creatorId 为 null/undefined（老数据）时 TypeError 整页崩溃（上轮已标记未修）。最佳实践：`(course.creatorId || '').slice(0, 8)`。
- [截断] 行 140-143 — `courseResourceApi.list({ courseId: id, limit: 10000 })` 超过后端 maxPageSize 被截断，资源中心数据不完整且无提示（上轮已标记未修）。最佳实践：fetchAllPages 分页合并。
- [竞态] 行 132-153 — 三个并行拉取无取消守卫，切换课程 id 时旧数据可覆盖（上轮已标记未修）。
- [截断] 行 123 — `courseApi.list({ status:'published', limit:1000 })` 客户端全量拉取，课程超上限时列表/筛选/统计不完整（上轮已标记未修）。容忍（含 P3：CourseCard index prop 未使用）。
- [部分成功误导] 行 114-141 — 上轮问题未修：实体 create/update 成功后才 `saveTags`，标签保存失败整体 catch 并 toast"保存失败"，实体实际已保存 → 用户重试会重复创建。最佳实践：标签失败单独 toast 且不阻止关闭弹窗。
- [竞态] 行 54-59 — `loadItems` 无取消/序号守卫（见 use-library-crud 条目）。
- [部分成功误导] 行 124-150 — 与 ability 页相同（create/update 成功后 saveTags 失败误报"保存失败"，重试重复创建；上轮已标记未修）。
- [竞态] 行 55-82 — **新发现（重构引入）**：`loadItems` 无请求序号/取消守卫，连续输入搜索词（每次 keystroke 触发一次拉取）或快速翻页时，先发请求可能后返回覆盖后发结果，列表显示与当前关键字不匹配的陈旧数据。最佳实践：保存请求序号，响应返回时校验仍为最新（参照 learn-roads editSeqRef 模式）。
- [部分成功误导] 行 112-143 — 与 ability/certificates 相同：实体保存成功、saveTags 失败误报"保存失败"（重试重复创建）。
- [截断] 行 63 — `courseApi.list({ type: 'granular', limit: 1000 })` 超过后端上限被截断，颗粒课选择弹窗缺项。
- [截断] 行 232 — `resourceLibraryApi.list({ limit: 500 })` 客户端全量拉取被后端上限截断，统计卡片、类型/院系/专业筛选、列表均不完整且无提示（上轮已标记未修）。
- [截断] 行 47 — `limit: 9999` 超后端 maxPageSize 被截断为 200，`totalPages = ceil(total/9999) = 1` 无分页，只展示前 200 条无提示（上轮已标记未修）。最佳实践：limit 传 200 并用服务端分页（其余 library 页已改造）。
- [部分成功误导] 行 120-146 — saveTags 失败误报"保存失败"（同 ability/certificates 模式）。
- [部分成功误导] 行 186-213 — 上轮问题未修：实体保存成功、`tagApi.setBindings` 失败 → toast"保存失败"且弹窗不关闭，重试会重复创建（新建路径无幂等）；行 162-175 上传成功但 create 失败的 CDN 孤儿文件无清理。最佳实践：标签失败单独提示；上传完成即视为"已提交"语义或幂等重试。
- [竞态] 行 38-65 — `loadItems` 无请求序号守卫（同 use-library-crud）。

### frontend-app-03.md（13 条 P2）

- [i18n] 第 464 行：`<LandingEmpty title={`暂无${t(cat.title)}`} />` — 模板串拼接中文"暂无"，整串未作翻译 key，切语言后仍是中文；最佳实践：`t('暂无{t}', { t: t(cat.title) })`（上轮已报，未修）。
- [契约] 第 259 行 `/alliance/public/achievements?sort=latest`：后端 `ListPublicAchievements` 固定 `ORDER BY created_at DESC LIMIT 100`，sort 参数被静默忽略（默认即最新，无实际影响，参数无效）（上轮已报，未修）。
- [契约] 第 304 行 `data.brands.filter((b) => b.isFeatured || b.isPublic)`："推荐品牌"语义与后端"最近 12 条"不符（上轮已报，未修）。
- [契约] 第 40 行 `/alliance/public/brands?isFeatured=true`：后端 `ListPublicBrands` 仅读 `brandType`，`isFeatured` 被忽略，"品牌展示"实际是最近 6 条（上轮已报，未修）。
- [类型] 第 91、124、144 行：`relatedPositions/relatedScenes/relatedCourses` 运行时为 `[{id,name}]` 对象数组，shared-types `AllianceAchievement.relatedPositions?: string[]` 类型声明错误，全靠 `as any` 绕过；若历史数据为字符串数组，`removeItem` 的 `x.id` 过滤将失效；最佳实践：修正 shared-types 为 `RelatedRef[]`（上轮已报，未修）。
- [功能缺口] 第 48-57 行初始 item 未含 `relatedPositions` 等关联字段，创建后需二次编辑补充（上轮已报，未修）。
- [数据丢失] 第 55-79 行：加载失败时 `item` 保持初始空值且 `loading=false`，页面渲染空表单而非错误/空态（对比 achievements/[id]/edit 有 `if (!item)` 分支）；用户填写保存后 PUT 全列覆盖（协议更新**无** ValidateUpdateExisting 兜底，已核实 alliance_crud_handler.go:416-449）→ 原记录被替换；最佳实践：加载失败后禁用保存并提示（上轮已报，未修）。
- [截断] 第 72-87 行 `list({limit:200})` 三路截断：协议/项目/成果超 200 条时详情页各 Tab 过滤基于截断列表，已关联项缺失（上轮已报，未修）。
- [逻辑] 第 54 行 `p.accountName.toLowerCase()` 无空值防御 — 若后端返回 null accountName 会抛 TypeError 整行崩溃（后端 create 校验非空，风险低）；最佳实践：`(p.accountName || '')`（上轮已报，未修）。
- [类型] 第 106-108、123-125、142-144 行 `(project as any).agreementIds` — shared-types `AllianceProject` 未声明 agreementIds，全靠 as any（上轮已报，未修）。
- [i18n] 第 172-178 行阶段下拉直接渲染原始枚举值 `{v}`（archived/terminated 等显示英文），未走 `t()` 翻译，与第 121 行 `allianceLabel('projectPhase', ...)` 显示口径不一致（上轮已报，未修）。
- [数据覆盖] 第 155-156 行：租户省份/城市不在 CHINA_REGION 或为空时，编辑表单默认回填 `北京 / 东城区`，用户不修改直接保存会把原地区覆盖为"北京/东城区"（数据污染）；最佳实践：默认留空，未选择不提交（上轮已报，未修）。
- [分页缺失] 第 61-65 行：`usePortalUsers` 仅解构 `users/loading/error/refetch`，未取 `total/page/pageSize/setPage`，PortalCrudPage 也未传 `pagination` → 毕业学生超过默认 20 条时**只能看第一页、无法翻页**（对比 accounts 页第 168 行正确传了 pagination）（上轮已报，**未修**，回归确认）。

### frontend-app-04.md（5 条 P2）

- [契约] dashboard-tab.tsx:101 — `const Icon = typeIconMap[item.type]` 无兜底；WorkspaceTodo.type 为开放 string（shared-types portal.ts），后端出现未收录类型（如 task/assignment）时 `<Icon>` 为 undefined，React 直接抛「Element type is invalid」整页崩溃；最佳实践：`typeIconMap[item.type] || 默认图标`。
- [契约] teacher-dashboard-tab.tsx:150 — `const Icon = typeIconMap[item.type]` 无兜底（同 dashboard-tab.tsx:101，WorkspaceTodo.type 开放 string）；最佳实践：`|| 默认图标`。
- [错误恢复] use-task-datasets.ts:157-159 — loadDatasets 在任务执行前就把 key 写入 loadedDatasetsRef；数据集（knowledge/ability/resources 等）加载失败后同一会话内不再重试，必须整页刷新才能恢复，且页面继续用空数据保存任务；最佳实践：任务失败时从 ref 中回退标记。
- [数据残留] tasks/page.tsx:903-906 — replaceIds 仅过滤 `kp-custom-`/`ab-custom-` 前缀；自定义资源持久化失败（failedResourceIds）时其临时 id 仍残留在任务 resourceIds 中随保存写入后端，形成悬空引用，且 894-899 行 toast 声称「将从任务中移除」与实际不符；最佳实践：资源失败 id 同样过滤并从状态剔除。
- [数据覆盖] tasks/page.tsx:309-320 — scenarioWeightApi.list 失败时（catch 仅 reportError），所有任务权重回退均分且 locked=false；随后保存/完成配置时 persistWeights 会用均分值覆盖后端已存的真实权重；最佳实践：权重接口失败时保留原样并提示，不覆盖。

### frontend-comp-01.md（4 条 P2）

- [输入丢失] evaluation-rules-editor.tsx:507-511 — `handleCreateRdq` 失败路径（catch 分支 reportError + toast）后仍继续执行 `setRdqActionOpen(false)` 关闭弹窗，用户已填写的题目内容丢失；最佳实践：catch 内 `return` 保持弹窗打开。
- [竞态] step-ability-modeling.tsx:135-152 — 「关联岗位」过滤的 bindings 拉取无序号/取消守卫：快速切换岗位时，先发请求的旧响应可能后到并覆盖新响应，过滤结果与当前岗位不一致；最佳实践：引入 seq ref（同文件其他逻辑已有该模式，参照 evaluation-rules-editor.tsx:258 的 rubricKpSearchSeqRef）。
- [崩溃风险] ability-tree.tsx:42 — `abilityDomains.find((d) => d.bindingIds.includes(b.id))` 未防御 `bindingIds` 缺失：后端 `domain.AbilityDomain.BindingIDs` 为 `[]string`（job.go:113，JSON 可输出 null），同份数据的知识图谱组件在 knowledge-graph.tsx:87-88 用了 `(d.bindingIds || [])` 防御而此处没有，一旦接口返回 null 该 tab 直接抛 TypeError 崩溃；最佳实践：改为 `(d.bindingIds || []).includes(b.id)`。
- [逻辑] knowledge-graph.tsx:126-133 — 自定义能力点（岗位编辑器中新建、无 `abilityPointId` 的 binding）会得到 `unitId = undefined`，以 undefined 为 id 建图节点并生成 `domain -> undefined` 边，图谱渲染可能异常；最佳实践：`unitId` 为空的 binding 跳过或用 binding.id 兜底（如 `b.abilityPointId || b.id`）。

### frontend-comp-02.md（7 条 P2）

- [状态管理/竞态] knowledge-graph-d3-view.tsx:474-516 — 第二个样式 effect 会在主绘制 effect 之后无条件覆盖 circle 的 `fill/stroke/stroke-width`（回到 TYPE_META 普通配色），使主 effect 中针对 `highlightNodeIds` 的红色渐变/红描边/加宽高亮（:313-329）全部失效；若未来任何页面启用 highlightNodeIds（当前 KnowledgeGraphShell 未透传、无调用方，功能休眠），红色高亮将不可见，仅剩透明度区分；最佳实践：样式 effect 内同样处理 highlight 分支，或高亮样式集中到单一 effect 管理
- [交互失效/状态管理] yi-know-assistant.tsx:774-781 — 聊天气泡内点击「为你推荐」资源卡片仅 setActiveTab/setExpandedIds，而 `isChatMode = chatMessages.length > 0 || isTyping`（:540）不会因此退出，界面仍停留在 chatView，用户点击无任何可见反馈（预期切回资源列表并展开该卡片）；最佳实践：点击推荐时调用 handleCloseChat 或新增「返回导航面板」行为
- [竞态/卸载] data-provider.tsx:108-131 — `cancelled` 仅保护 reportError/setEvaluationLoading，`loadQuestionBanks/loadExams` 内部的 setQuestionBanks/setExams（:89,:103）不受保护：路由快速切换（isPortal 条件翻转）时旧请求响应会写入新页面状态，且卸载后 setState；最佳实践：loadXxx 返回后统一过 cancelled 检查
- [防重复] approval-list-page.tsx:230-234 + approval-dialogs.tsx:142-153 — 通过/驳回按钮在审批请求执行期间无 pending/loading 禁用，快速双击会重复调用 onApprove/onReject（后端可能二次审批报错或重复流转）；最佳实践：useApprovalDialogs 内部增加 submitting 状态禁用按钮
- [防重复] approval-dialogs.tsx:142-153 — `confirmApprove/confirmReject` 无 pending 状态，双击可重复提交（同 approval-list-page:231 一并修复）；最佳实践：按钮增加 loading 并 disable
- [竞态] content-list-page.tsx:400-413 — `setBatches/setExpandedBatches/setMajors/setWorkflows` 在 `loadSeq` 守卫（:453）之前无条件执行，快速连续 refresh 时旧请求的批次/专业列表可覆盖新请求结果（frontItems 已正确受守卫）；最佳实践：将全部 setState 移到 loadSeq 校验之后
- [错误被吞] eval-method-card.tsx:299-312 — `handleFileUpload` 中 `onFileUpload` 失败（reject）无任何捕获/提示，仅 finally 复位 uploading，产生 unhandled rejection 且用户无感知；最佳实践：catch 后 setError 展示

### frontend-comp-03.md（22 条 P2）

- [状态管理] question-grading-card.tsx:150 — localScore 仅以 useState(score.toString()) 初始化，父组件 score 变化（如切换考生/重新加载）不会回写，编辑框可能显示过期分数；最佳实践：localScore 派生自 props 时用 useEffect 同步或 key 重建
- [契约不符] knowledge-selector.tsx:165-167 — 搜索走后端接口但 limit 固定 200 无分页，注释声称"可命中全部知识点"与实际不符，超过 200 条命中静默截断；最佳实践：复用 fetchAllPages 分页拉全
- [useEffect] knowledge-selector.tsx:132-139 — 岗位/场景全量拉取无 cancelled/seq 守卫，组件卸载或 tenantId 切换后可能 setState；最佳实践：加 cancelled 标志（参照同文件 142-155 的写法）
- [状态管理] knowledge-selector.tsx:343-358 — 编辑知识点仅更新 selected 列表，searchResults/allKps 中同名条目保留旧值，关闭弹窗后列表表格显示过期名称/描述；最佳实践：编辑后同步更新 searchResults 或失效搜索缓存
- [竞态] major-select.tsx:39-63 — loadMajors 无请求序号/取消守卫，tenantId 快速切换时旧租户响应可能覆盖新租户数据；最佳实践：effect 内 cancelled 标志或 seqRef 比对（参照 knowledge-selector.tsx:84-86 模式）
- [错误被吞] portal-crud-page.tsx:207-223 — onSave 成功后 await onRetry() 置于 try 内，列表刷新失败会误报"保存失败"（实际已保存）；confirmDelete(239-256)、handleToggleEnabled(225-237) 同样模式；最佳实践：refetch 移出 try 或 catch 中区分错误来源
- [状态管理] portal-crud-page.tsx:268-270 — allSelected 以"已选数 === 当前筛选页条数"判定，跨页选择时表头全选态与实际不符（选中 20 条中 10 条会被判为全选）；最佳实践：以"当前页可见项是否全部选中"判定
- [数据一致性] portal-sidebar-crud-page.tsx:227-237/273-287 — selectedIds 在删除成功/refetch 后不清理，已删除 id 残留，批量导出/批量加入会把无效 id 发给后端；最佳实践：refetch 后按新 items 过滤 selectedIds
- [状态管理] portal-sidebar-crud-page.tsx:227-233 — toggleSelectAll 全选/取消以"已选数 === 当前筛选数"判定，跨页勾选后点表头会把跨页选择静默替换为当前页；最佳实践：以当前页可见项是否全选决定清空或全选
- [契约不符] portal-sidebar-crud-page.tsx:216-225/185 — 搜索/状态/组织筛选只过滤当前页 items，而 total 与分页基于服务端总数，筛选后"共 N 条"与表格内容不一致（筛选到空页时 totalPages 仍为服务端值）；最佳实践：筛选走服务端参数或提示仅限当前页
- [数据丢失] resource-selector.tsx:681-777/342-361 — venue/facility/software 类型的表单字段（场地地址/开放时间/容纳人数/联系人/位置/数量/版本/授权）全部收集但创建资源时未随 resourceLibraryApi.create 提交，保存后丢失；最佳实践：要么在 create 载荷中带上并请求后端支持，要么移除这些表单字段
- [数据丢失] resource-selector.tsx:342-379/576-578 — loadResources 失败（apiAvailable=false）时上传走本地 id（res-<ts>）路径，该资源不进入 mergedPool，选中后右侧"已选资源"与顶部徽章均不可见、无法取消选择，保存时向后端提交本地假 id 产生悬挂引用；最佳实践：本地资源也塞入 mergedPool，或失败时禁用上传
- [契约不符] resource-selector.tsx:171-196 — resourceLibraryApi.list 固定 limit 1000 无分页，资源库超过 1000 条静默截断；最佳实践：改用 fetchAllPages
- [状态管理] tag-filter-bar.tsx:24/47 — 依赖 useTags 的 loading（useTags.ts:37 仅初始化时取 cachedTags===null），标签管理页 reload 清缓存后 loading 不置 true，筛选栏闪现"暂无标签，请先在标签管理页创建"误导文案；最佳实践：useTags reload 时同步置 loading 或基于 cachedTags===null 派生
- [边界] uncited-resources-dialog.tsx:142-149 — 天数输入经 Math.max(0, Math.floor(Number(value))) 后 NaN 未被过滤（如输入 "-" 或非法数字），NaN 传入 addDays 生成 Invalid Date，format 抛 RangeError 被 catch 吞掉并误报"加载失败"；最佳实践：Number.isFinite 校验后再 setState
- [数据一致性] uncited-resources-dialog.tsx:176-197 — 批量删除用 Promise.all，任一失败则整体 catch，已删除项计入 total/selected 导致后续页码计算错误且无部分成功提示；最佳实践：allSettled 后按成功数刷新并提示部分失败
- [竞态] user-selector.tsx:216-253 — loadUsers 无请求序号/取消守卫，防抖后快速切换组织或连续输入时旧响应可能后到并覆盖新结果（显示过期用户列表）；最佳实践：seqRef 比对（参照 knowledge-selector.tsx:84-86）
- [useEffect] user-selector.tsx:194-208 — loadOrgTree 无 cancelled 守卫，组件卸载后可能 setState；最佳实践：effect 内 cancelled 标志
- [状态管理] user-selector.tsx:292-294 — 弹窗打开期间父组件 value 变化（引用变化即触发）会 queueMicrotask 重置 selectedIds，覆盖用户进行中的勾选；最佳实践：仅在打开瞬间同步一次
- [竞态] use-tag-bindings.ts:16-36 — loadBindings 无请求序号守卫，快速翻页时旧页响应可能覆盖新页标签映射，列表展示标签错位；最佳实践：seqRef 比对或 AbortController
- [性能] use-tags.ts:39-61 — reload() 置 cachedTags=null 并 emitChange 后，所有订阅方 effect 同时重新发起 tagApi.list()（N 份重复请求）；最佳实践：模块级 inflight 去重或缓存失效只触发一次拉取
- [死代码] zip-preview.tsx:116-121 — 已核实 fflate@0.8.3 源码：unzipSync 的错误码 13 仅产生 'invalid zip data'，错误消息从不包含 'encrypted'，加密包判断恒为 false，加密压缩包只显示通用"解压失败"而非"已加密"提示；最佳实践：改为解析本地 header 的加密标志位（general purpose bit 0）判定

### frontend-lib.md（4 条 P2）

- [契约不符] use-approvals.ts:65 — `workflowApi.list({ limit: 1000 })` 同样被钳制为 200；流程数超过 200 时，其后的 workflowId 查不到 map，getStepInfo 退化为"第 {n} 步"占位名且 steps 为空（功能降级不崩溃）；最佳实践：改用 fetchAllPages 合并，或对缺失 workflowId 逐个 get。
- [i18n 残留] use-submitter-names.ts:27 — 错误文案 `'获取用户列表失败'` 硬编码且未用 useT() 包裹，同时该 key 未收录 en.json（抽查 MISS），英文模式下报错信息保持中文；最佳实践：改用 useT() 并补齐 en.json 词条。
- [i18n 残留] use-org-tree.ts:66 — 错误文案 `'加载组织架构失败'` 未用 useT() 包裹（该 key 已存在于 en.json，属上轮"错误文案"遗漏项），英文模式下报错保持中文；最佳实践：hook 内 useT() 包裹后返回。
- [i18n 残留] use-portal-users.ts:74 — 错误文案 `'加载失败'` 未用 useT() 包裹（en.json 有该 key，属遗漏包裹）；英文模式下报错保持中文。

### frontend-shared-types.md（40 条 P2）

- [契约] affairs.ts:108 — `TeachingPlan.updatedAt?` 仍标可选，后端 `domain/affairs.go:78` `UpdatedAt time.Time json:"updatedAt"` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] affairs.ts:109 — `TeachingPlan.rejectReason?` 仍为死字段，后端全仓无 reject_reason 写入路径（content_actions.go 驳回仅改 status）（上轮未修）；最佳实践：删除或等后端实现后再补。
- [契约] backend.ts:22 — `Tenant.adminIds: string[]` 仍标必填，后端 `domain/unified.go:112` `json:"adminIds,omitempty"` 可空（上轮未修）；最佳实践：改 `adminIds?: string[]`。
- [契约] backend.ts:47 — `OrgType.isDefault?` 仍标可选，后端 `domain/unified.go:124` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [类型] certificate-issuance.ts:15-16 — `MicroCertTemplate.createdAt/updatedAt: Date` 仍标 Date（上轮仅修了 CertIssuanceRecord 的 34-35 行，此处遗漏）；JSON 反序列化为 ISO 字符串；最佳实践：改 string。
- [契约] certificate-issuance.ts:19 — `IssueStatus` 仍含 `'revoked'`，后端仍无撤销端点/写入路径（grep handler/store 无 revoke 操作，仅 'issued' 写入）；revokedAt/revokeReason 列虽在 schema 但状态永不出现（上轮未修）；最佳实践：删除或注明"预留"。
- [契约] certification.ts:51-52 — `CertificationRule.createdAt?/updatedAt?` 仍标可选，后端 `domain/evaluation.go:247-248` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-exam.ts:104,138,182 — `QuestionBank.code?/Question.code?/Exam.code?` 仍标可选，后端 `domain/evaluation.go:10,45,78` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [类型] evaluation-exam.ts:121-122,151,198-199 — `QuestionBank.createdAt/updatedAt`、`Question.createdAt`、`Exam.createdAt/updatedAt` 仍标 `Date`，JSON 反序列化为 ISO 字符串（上轮未发现）；最佳实践：统一改 string。
- [契约] evaluation-exam.ts:118 — `QuestionBank.isDraftPool?` 仍标可选，后端 `:24` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-exam.ts:143,159,173 — `Question.answer: string | string[]` 仍含 string 分支，后端 `Answer JSONSlice json:"answer"`（:50,69）恒为数组（上轮未修）；最佳实践：统一 `answer: string[]`。
- [契约] evaluation-exam.ts:188 — `Exam.questions: ExamQuestion[]` 仍标必填，后端 `:85` `json:"questions,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [契约] evaluation-exam.ts:200 — `Exam.isTemp?` 仍标可选，后端 `:98` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-exam.ts:236 — `ExamUsage.status` 仍含 `'pending'|'scheduled'`，后端仅 draft/published/in_progress/finished（`store/exam_usages.go:69-77,181`）（上轮未修）；最佳实践：收缩为四值。
- [契约] evaluation-exam.ts:237 — `ExamUsage.activationMode?` 仍标可选，后端 `domain/evaluation.go:114` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-exam.ts:256 — `ExamResult.gradingStatus?` 仍标可选，后端 `:135` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-scene.ts:16 — `EvaluationMethod.relatedTaskIds: string[]` 仍为必填死字段，后端 `domain/evaluation.go:171-179` 无此字段（上轮未修）；最佳实践：删除或确认另有关联接口再补来源注释。
- [契约] evaluation-scene.ts:37-38 — `SceneEvaluationResult.evaluatorId?/evaluatorType?` 仍标可选，后端 `:189-190` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-scene.ts:74 — `JobAbilityResult.userId?` 仍标可选，后端 `handler/job_ability_result_handler.go:36` `UserID string json:"userId"` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] evaluation-scene.ts:76 — `JobAbilityResult.studentId` 仍标必填，后端 `:37` `*string json:"studentId,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [契约] evaluation-scene.ts:86,88,90 — `positionCompetency?/positionCompetencyV2?/abilityCognitionScore?` 仍标可选，后端 :50-58 全部 float64 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [类型] evaluation-scene.ts:91 — `evaluationTime: string | Date` 联合含 Date 分支，后端 `EvaluatedAt time.Time json:"evaluationTime"` 反序列化恒为字符串（上轮未修）；最佳实践：改 `string`。
- [契约] graduation.ts:26-40 — `GraduationProjectArchive` 的 topicName/studentName/studentId/advisorName/enterpriseMentorName?/positionName 仍为必填字段且后端不返回（后端仅 id/topicId/userId/phase/docStatus/docCount/hasRectification/lastUpdated，`domain/evaluation.go:340-349`）（上轮未修）；最佳实践：按后端字段重写或删除，当前 apps 无消费者。
- [类型] graduation.ts:38 — `lastUpdated: Date` 仍标 Date，后端 time.Time 反序列化为 ISO 字符串（上轮未修）；最佳实践：改 string。
- [契约] graduation.ts:61-62 — `GraduationQueryResult.className/majorName` 仍标必填，后端 `*string omitempty`（`domain/evaluation.go:369-370`）可空；且 studentName/studentId（59-60）后端不返回、缺 userId/updatedAt（后端 :368,379 返回）（上轮未修）；最佳实践：对齐字段并改可选。
- [契约] job.ts:3 — `CareerPosition.code?` 仍标可选，后端 `domain/job.go:27` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] job.ts:23-25 — `favoriteCount?/viewCount?/abilityCount?` 仍标可选，后端 `:45-47` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] lesson.ts:3 — `Course.code?` 仍标可选，后端 `domain/lesson.go:9` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] lesson.ts:30 — `coCreatorIds: string[]` 仍标必填，后端 `:35` `json:"coCreatorIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [契约] lesson.ts:37 — `Course.viewCount?` 仍标可选，后端 `:41` 必返（上轮未修）；最佳实践：改必填。
- [契约] lesson.ts:124,128 — `NodeResource.url: string` 仍标必填（后端 `:134` `*string omitempty` 可空）、`uploadedAt?: string` 仍标可选（后端 `:138` 必返）（上轮未修）；最佳实践：url 改可选、uploadedAt 改必填。
- [契约] portrait.ts:10-26 — `StudentAbilityArchive` 仍与后端 `domain/evaluation.go:303-317` 不符（studentName/studentId/className 后端不返回，obtainDate: Date 后端 `*string omitempty` 可空）（上轮未修，apps 无消费者）；最佳实践：标注演示来源，接后端时按 domain 重写。
- [契约] portrait.ts:44-75 — `StudentAbilityPortrait` 仍与后端 `:279-300` 不符（studentName/studentId/className/majorName/positionName/updatedAt 等 15+ 字段后端不返回）（上轮未修）；最佳实践：同上。
- [契约] scene.ts:4 — `Scenario.code?` 仍标可选，后端 `domain/scene.go:8` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] scene.ts:14,25 — `viewCount?/taskCount?` 仍标可选，后端 `:27-28` 必返（上轮未修）；最佳实践：改必填。
- [契约] scene.ts:20 — `coBuilderIds: string[]` 仍标必填，后端 `:20` `json:"coBuilderIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [契约] scene.ts:118 — `RubricTemplate.isDeleted?` 仍标可选，后端 `:64` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [契约] scene.ts:214 — `SceneBatch.scenarioCount?` 仍标可选，后端 `:179` 必返（上轮未修）；最佳实践：改必填。
- [契约] shared-models.ts:16 — `User.email: string` 仍标必填，后端 `domain/models.go:58` `*string json:"email,omitempty"` 可空（上轮未修）；最佳实践：改 `email?: string`。
- [类型] shared-models.ts:35 — `Collaborator.addedAt: Date` 仍标 Date（上轮未修）；最佳实践：改 string。

### frontend-ui.md（9 条 P2）

- [数据回弹/竞态] packages/ui/src/components/shared/mixed-tag-editor.tsx:237-245 — 聚焦态分支只追加不删除：当编辑器持有焦点且 props 的 knowledgePointIds/abilityPointIds 被外部移除（如父组件重置/联动）时，`newKpIds/newAbIds` 为空且 missing 为空 → 早退，prevTags 与 DOM 均保持旧值；随后 blur 时 handleBlur 的兜底合并（:287-292）把 prevTags 中已移除的 id 重新写入 onChange → 被删标签"复活"。正常删除路径（×按钮 mousedown 先 blur 再 click）不受影响，但聚焦期间的外部变更会被静默回滚。最佳实践：聚焦分支同样处理移除（同步 DOM 并更新 prevTags），或兜底合并时用「prevTags ∩ props」而不是直接并入 prevTags。
- [DOM 合法性/无障碍] packages/ui/src/components/shared/combobox-select.tsx:121-132 — 上轮改造把清除按钮做成 `<button>` 嵌套在触发器 `<Button>`（也是 `<button>`）内部，形成 button-in-button 非法嵌套；屏幕阅读器可访问名计算异常，键盘焦点语义混乱（两个 Tab 停靠点同属一个控件）。事件处理本身正确（stopPropagation 阻止冒泡到 Radix trigger 的 onClick）。最佳实践：清除按钮改为与触发器并列（外层 div 相对定位 + 清除按钮绝对定位于右上角），或触发器内用 `role="button"` 的 span + tabIndex + keydown 处理。
- [事件处理] packages/ui/src/components/shared/import-confirm-dialog.tsx:64 — `onOpenChange={onOpenChange}` 未加 pending 护栏，导入进行中按 Esc/点击遮罩仍可关闭弹窗；与 confirm-dialog.tsx:40 的 `pending ? () => {} : onOpenChange` 不一致。最佳实践：`onOpenChange={pending ? () => {} : onOpenChange}`。
- [无障碍] packages/ui/src/components/shared/import-wizard-dialog.tsx:169-176 — 文件移除按钮为纯图标按钮（X）无 aria-label，上轮全包 aria-label 补漏未覆盖此处。最佳实践：`aria-label={`移除${f.name}`}`。
- [无障碍] packages/ui/src/components/shared/import-wizard-dialog.tsx:181-197 — 上传点击区为 div + onClick，无 role/tabIndex/onKeyDown，键盘用户无法触发文件选择。最佳实践：改为 `<button type="button">`（内部保留 hidden input）或加 `role="button" tabIndex={0} onKeyDown={Enter/Space 触发}`。
- [无障碍] packages/ui/src/components/platform-shell/PlatformSideNav.tsx:238-242 — 移动端 SheetContent 未提供 SheetTitle，Radix Dialog 触发 a11y 警告（console warning）且读屏无标题。最佳实践：加 `<SheetTitle className="sr-only">{config.currentPlatformLabel}</SheetTitle>`（或 aria-labelledby 指向 :124 的 h2）。
- [DOM/ID 冲突] packages/ui/src/components/ui/multi-select-search.tsx:121 — 硬编码 `id="multi-select-all"`；实际已有同页双实例（apps/edu/components/evaluation/random-question-dialog.tsx:485,551 同一弹窗渲染两个），重复 id 导致 htmlFor 关联错乱（点第二个"全选"文本勾选第一个复选框）。最佳实践：`const uid = useId()`，`id={`${uid}-all`}`。
- [DOM 合法性/无障碍] packages/ui/src/components/ui/multi-select.tsx:73-108 — 移除按钮（上轮 span→button 改造）嵌套在外层触发 `<button>` 内，button-in-button 非法嵌套，与 combobox-select 同类问题。最佳实践：外层改为 div（可聚焦）+ 内层 button，或清除按钮移出触发器。
- [竞态] packages/ui/src/hooks/use-async.ts:51-70 — refresh 无请求序号守卫：deps 快速变化（筛选联动）时，先发出的慢请求可能后返回并覆盖新数据，与仓库近期「8 处前端竞态请求序号守卫」的标准不一致。最佳实践：useRef 请求序号 `seqRef.current++`，await 后 `if (seq !== seqRef.current) return`。

### handler-01.md（11 条 P2）

- [静默失败] affairs_config_import_handler.go:74-79、106-111、152-157 — 三个 Sheet 的重复检查 `QueryRow(...).Scan` 与 INSERT `Exec` 错误全部忽略，DB 故障或类型不合法（如日期格式错误）时导入返回 200 且计数虚高、部分行静默丢失；最佳实践：Scan/Exec 出错时记录日志并 500（或计入 skipped 并在响应带 error 字段）。
- [事务缺失] affairs_config_import_handler.go:53-166 — 三 Sheet 导入不在同一事务，中途失败留部分数据；最佳实践：整次导入包 BeginTx 整体回滚。
- [数据丢失] alliance_crud_handler.go:180-251、287-326 — enterprise/project 的部分更新兜底**漏掉 bool 字段 `IsPublic`**（请求体缺省 false 会覆盖已有 true）：仅改名称/阶段的局部 PUT 会静默取消前台公开，企业/项目从门户消失；最佳实践：将 IsPublic 改为 *bool 或维护显式 PATCH 语义，缺省时回退现有值。
- [错误处理] alliance_crud_handler.go:49 — `alliancePublicGet` 将 store 所有错误（含 DB 故障）统一响应 404（上轮已标，未修）；最佳实践：区分 ErrNotFound 返回 404，其余走 respondServerError。
- [数据丢失] alliance_handler.go:344-363 — UpdateMilestone 兜底漏掉 `IsCompleted`（bool）与 `SortOrder`（int）：仅改名称/日期的局部更新会把已勾选完成的里程碑重置为未完成、排序清零；最佳实践：IsCompleted/SortOrder 改指针或请求侧显式区分，缺省回退 existing。
- [数据丢失] alliance_handler.go:541-563 — UpdatePermission 兜底漏掉 `IsEnabled`（bool）：部分更新（如改账号名/资源权限）会静默把合作账号置为停用；最佳实践：IsEnabled 改 *bool 缺省回退。
- [数据丢失] alliance_handler.go:666-685 — UpdateDictionaryItem 已修 name 回退，但 `SortOrder`（int）缺省写 0，部分更新重排序字典项；最佳实践：SortOrder 缺省回退现有值。
- [错误处理] alliance_handler.go:488-493 — GetPermission 将 store 所有错误（含 DB 故障）响应 404（上轮已标，未修）；最佳实践：区分 pgx.ErrNoRows 与内部错误。
- [数据丢失] batch_handler.go:207-245 — BatchUpdate 无部分更新兜底：store/batches.go:208-209 恒写 `code/org_node_id/major_id/workflow_id`，请求未携带的 *string 字段以 NULL 覆盖已有值（如仅改批次名称即清空批次编码与组织/专业/工作流关联）；最佳实践：与联盟同类，Update 前先读回、nil 字段回退现有值。
- [租户边界] batch_handler.go:169-172 — claims.TenantID 为空时 tenantID=nil，TenantScoped 表（如课程批次）落库 NULL tenant_id 产生无主记录（上轮已标，未修）；最佳实践：TenantScoped=true 时无租户直接 403。
- [契约不一致] cert_grade_handler.go:87-123 — 无组件/无榜单数据时 `CompData`/`Leaderboard` 为 nil，JSON 输出 `null` 而非 `[]`（上轮已标，未修）；最佳实践：组装前初始化空切片。

### handler-02.md（20 条 P2）

- [错误误报] content_actions.go:134-138 — `transitionWithHook` 状态流转已提交成功后回读失败返回 404"不存在"，客户端误判失败并重试，第二次流转会得到 400 invalid transition，产生误导；最佳实践：写成功后回读失败返回 500 并提示"已生效，请刷新"。
- [参数校验] content_actions.go:205-208 — `invite` 直接用 `json.NewDecoder(r.Body)` 解析，未走 `decodeBody`（无 10MB 上限）；且 `UserID` 未校验 UUID 格式，非法值触发 PG 22P02 转 500；最佳实践：复用 `decodeBody`，前置 `uuid.Parse` 校验并 400。
- [数据完整性] content_actions.go:209 + store/content_actions.go:160-176 — `Invite` 未校验被邀请用户存在且属于当前租户，任意（含他租户）用户 ID 可写入 collaborator 数组；列表/详情回显姓名（exams.go:299 的 unnest+JOIN users 无租户过滤）会泄露他租户用户名；最佳实践：邀请前 `Users().Get` 校验租户归属（参照 evaluation_result_handler.go:150-156 的做法）。
- [健壮性] course_clone_handler.go:43 — 直接 `json.NewDecoder(r.Body)` 无 `MaxBytesReader` 限制；最佳实践：改用 `decodeBody`。
- [错误误报 404] course_handler.go:111-115（Get）、360-362（Delete 前置）、461-465（SubmitHomework）、579-583（SubmitNodeHomework）— 对"不存在"以外的任意错误（含 DB 故障）统一返回 404"不存在"，上轮"回读错误改 500"未覆盖；最佳实践：`errors.Is(err, store.ErrNotFound)` 分流 404 / respondServerError。
- [性能] course_handler.go:476-516、594-634 — `ListHomeworkSubmissions`/`ListNodeHomeworkSubmissions` 无分页，一次返回全部提交（含 content/attachmentUrls 大字段）；最佳实践：加分页或限制条数。
- [事务边界] course_import_handler.go:410,419 — `findOrCreateKnowledgePoints`/`findOrCreateResources` 走 `h.DB`（连接池，事务外自动提交），而绑定插入走事务 `q`；导入整体回滚时，本次新建的知识点/资源行残留为孤儿数据，破坏"覆盖导入整体回滚"的原子性承诺；最佳实践：将 findOrCreate 改为接收 `q` 在事务内执行。
- [错误误报 404] course_node_handler.go:127-131（Get）、210-213（Update 前置）、274-277（Delete 前置）、159-162（Create 课程校验）— 任意错误返回 404"不存在"；最佳实践：`errors.Is(err, store.ErrNotFound)` 分流。
- [边界] course_node_handler.go:307 — `ReorderNodes` 传入的 nodeIDs 不做归属校验：不属于该课程的节点被 store 的 `WHERE id AND course_id` 静默跳过（无提示），部分列表重排导致 sort_order 出现重复/悬空；最佳实践：校验 nodeIDs 均属于该课程并回读校验数量，失败返回 400。
- [数据完整性] course_node_handler.go:167-170 — Create 的 `ParentID` 未校验父节点属于同一课程/租户，可把节点挂到他课程父节点下造成树错乱；最佳实践：前置校验 parent 归属同课程。
- [错误误报 404] course_resource_handler.go:81-85,146-150,177-181 — `CourseTenantID` 对任意错误（含 DB 故障）返回 404"课程不存在"；最佳实践：ErrNotFound 分流 404，其余 respondServerError。
- [错误吞静默失败] course_resource_handler.go:172-176 — `UnbindResource` 中 `BindTargetID` 错误一律返回 200"成功"（意图为幂等，但无法区分"绑定不存在"与 DB 故障）：DB 异常时客户端误以为已解绑，绑定实际仍在；最佳实践：用 `errors.Is(err, store.ErrNotFound)` 区分，DB 错误返回 500。
- [错误误报 404] crud.go:121-125（crudGet）、155-159（crudUpdate 前置）、214-218（crudDelete 前置）— `GetByIDFn` 任意错误返回 404；最佳实践：ErrNotFound 分流，其余 500。
- [错误误报 404] evaluation_method_handler.go:70-74 — `TenantID` 查询任意错误返回 404"测评方式不存在"；最佳实践：ErrNotFound 分流。
- [数据完整性] evaluation_result_handler.go:158-171 — `Submit` 未校验 taskId/sceneId 属于当前租户，非学生角色也未校验 evaluateeId 属于当前租户；可写入引用他租户任务/用户的脏结果行（当前列表无 join 不泄露，但一旦列表 join 展示任务信息即构成跨租户信息暴露）；最佳实践：提交前校验 task/scene/evaluatee 归属（参照 evaluator 校验 150-156）。
- [参数校验] evaluation_result_handler.go:183-220,222-258 — `Grade`/`BatchGrade` 均未校验 score 上下界，可写入负数或 >100 的分数（course_handler.go:540 的 0~100 校验在此缺失）；最佳实践：与课程作业批改一致加 0~100 校验。
- [性能] evaluation_result_handler.go:234-250 — `BatchGrade` 对每个 item 逐条 `GetEvaluationResult`（N+1），批量大时放大查询；最佳实践：批量 IN 查询一次取回并校验。
- [错误误报 404] evaluation_result_handler.go:86-90 — `Get` 任意错误返回 404；最佳实践：ErrNotFound 分流。
- [错误吞静默失败] exam_handler.go:292（AddQuestion）、317（RemoveQuestion）、362（UpdateQuestionScore）、402（BulkUpdateScores）— 写操作成功后回读错误被 `exam, _` 吞掉，200 返回变更前旧实体；最佳实践：回读失败 respondServerError。
- [错误误报 404] exam_handler.go:67-71（Get）、153-157（Update）、230-234（Delete）— 任意错误返回 404"考试不存在"；最佳实践：ErrNotFound 分流。

### handler-03.md（12 条 P2）

- [数据完整性] exam_import_handler.go:278 — 题目按 `content` 精确匹配 `LIMIT 1`，同租户存在多条同 content 的题时取任意一条，可能关联到答案/类型不同的题；最佳实践：对导入源做强约束（content 唯一或带类型筛选）。
- [租户隔离缺口] exam_usage_handler.go:75-99 + store/exam_usages.go:85-99 — Create 未校验 `ExamID` 归属租户（service CreateExamUsage 直通 store），可创建指向他租户试卷的安排；学生拉卷时因 Exam Get 的租户校验（exam_handler.go:72）404，无内容泄露但产生跨租户脏数据；最佳实践：Create 时 `SELECT tenant_id FROM exams WHERE id=$1` 校验一致。
- [敏感泄露] file_handler.go:164-189 + router.go:122 — `Serve` 无任何鉴权且挂在 JWT 组之外，`/uploads/` 为全租户共享目录，任何拿到 URL 的人可读任意用户上传的文件（学生资料/试卷附件等）；UUID 文件名使其难以枚举，风险可控；最佳实践：如无强需求，为 Serve 增加登录校验或签名 URL；保持现状需明确接受该风险。
- [性能/DoS] file_handler.go:233,266 — libreoffice 转换使用 `exec.Command` 无 context 超时、无并发限制，配合 100MB 上传（file_handler.go:19）可被反复触发重 CPU 转换拖垮进程；最佳实践：加超时（context.WithTimeout）与全局并发信号量。
- [竞态] graduation_handler.go:231 — `AppliedCount >= Capacity` 为事务外预检，并发申请可超容量（service ApplyGraduationTopic 若未对课题行加锁重检即越界）；最佳实践：service 事务内 `SELECT ... FOR UPDATE` 后重检容量再插入。
- [事务/一致性] granular_course_import_handler.go:88-90 — 导入整体无事务（对比 exam_import_handler.go:89-108 有事务包裹），中途失败部分写入、无回滚；最佳实践：与试卷导入一致在 ImportExcel 外层包事务。
- [副作用顺序] granular_course_import_handler.go:162-169 — `findOrCreateKnowledgePoints/Resources` 在覆盖权限校验（canOverwriteContent）之前执行，权限不足被跳过时知识点/资源已被创建（孤儿数据）；最佳实践：先做权限判定再创建知识/资源。
- [吞错] granular_course_import_handler.go:218-237 — `replaceCourseBindings` 全部 `_, _ =` 忽略错误（DELETE/INSERT 失败静默），DB 中 resource_count 与真实绑定可能不一致；最佳实践：返回 error 由调用方计入 failed。
- [租户完整性] hybrid_module_handler.go:61-63 — Upsert 未校验 `node_id` 归属租户（store Create 仅约束本行 tenant_id，hybrid_modules.go:77-87），可将模块写入他租户节点（孤儿行，不可见但脏数据）；最佳实践：Create/ReplaceByNode 前校验 `system_course_nodes.tenant_id = $tenant`。
- [越权弱] import_export_handler.go:339-354 — 覆盖导入对他人对象仅走 updateSQL 改名/改码，无 `canOverwriteContent` 校验，任意业务用户可改名他人试卷/课程/场景/题库（与 exam/granular 导入的权限判定不一致）；最佳实践：覆盖前校验 creator/co-creator。
- [事务] import_export_handler.go:291-401 — Import 无事务，中途失败部分写入（冻结豁免区，标注即可）。
- [并发边界] job_ability_result_handler.go:399-407 — 单机 `aggInFlight` 按 positionId 去重，多实例部署时失效（可重复触发重汇聚）；最佳实践：改为 DB 层状态机（aggregate log 加唯一约束/互斥状态）。

### handler-04.md（9 条 P2）

- [部分更新/数据丢失] job_banner_handler.go:64-92 — Update 为全字段覆盖：`ValidateUpdate` 仅要求 title/imageUrl，`SortOrder int`/`IsEnabled bool` 为非指针类型，PUT 省略时静默重置为 0/false；`LinkURL` 省略时清空。与 learn_roads/on_site 已建立"未传回填现有值"的约定不一致。最佳实践：改为指针字段并在 UpdateFn 内回填（同 learn_road_handler.go:83-99）。
- [部分更新/数据丢失] knowledge_point_handler.go:87-96 — UpdateFn 直接透传 `Code/Description/Linked/GranularLessonIds`；store Update（lesson_content.go:158-174）对 nil 的 granular_lesson_ids 写 `'{}'`、nil code/description 写 NULL、linked 写 false，并同步清空颗粒课引用（SyncCourseKnowledgePoints）。PUT 仅带 name（lesson_handler_test.go:221 即如此调用）会静默清空知识点关联数据，且现有测试未断言保护。最佳实践：与 learn_roads 一致，UpdateFn 内先 GetByID 回填未传指针字段。
- [错误吞静默失败] landing_handler.go:44-48 — ListExams 的数据源 store/landing.go:69 `rows.Scan` 出错时 `continue`，扫描失败的行被静默丢弃，接口返回不完整数据且无任何错误信号。最佳实践：scan 失败直接返回 error（走 respondServerError）。
- [契约/一致性] lesson_behavior_handler.go:257-259、309-315、317-333 — `buildAggregate` 的 SignInDaily/AttendanceRateData/StudentDetails 均从 Go map 迭代生成，输出顺序随机：同一天签到曲线/出勤率图表/学生明细刷新即抖动。最佳实践：按日期/学生名排序后再输出（或按记录顺序维护有序 slice）。
- [契约] micro_cert_handler.go:118-121、170-173 — 创建/更新模板只校验 `Title`/`CertTypeName`；`cert_type_id` 列为 `uuid NOT NULL`（001_baseline.up.sql:647），`certTypeId` 为空时 `normalizeCertTypeID("")` 返回 ""（micro_cert_handler.go:66-67），INSERT '' 直接 PG 报错 → 500。最佳实践：certTypeId 必填校验（400）或按 cert_type_name 生成确定性 UUID。
- [部分更新/数据丢失] node_homework_handler.go:83-90 — UpdateFn 直接透传 `Requirement/Deadline/NeedAttachment`；store Update（lesson_content.go:338-341）全列覆盖，ValidateUpdate 仅要求 title，故 PUT 省略 requirement/deadline 即被置 NULL、省略 needAttachment 即被置 false。最佳实践：与 learn_roads 一致回填现有值（crud 骨架已有 ValidateUpdateExisting 钩子可用）。
- [部分更新] node_quiz_handler.go:118-122 — UpdateQuiz 直接透传 `TimeLimit *int`，PUT 省略 timeLimit 即清空（node_quizzes.go:72-75 全列覆盖）。最佳实践：UpdateFn 内回填现有 timeLimit 或改用指针三态语义。
- [错误吞静默失败] node_resource_handler.go:167-170 — UnbindResource 中 `BindTargetID` 返回**任何**错误（含 DB 错误）都响应 200 `{"id":...}`，解绑失败被静默吞掉。最佳实践：仅 `pgx.ErrNoRows`（绑定不存在）幂等返回 200，其余错误走 respondServerError。
- [错误吞静默失败] crud.go:100、crud.go:187 — `item, _ := cfg.GetByIDFn(...)` 创建/更新后的**回读错误被吞掉**，DB 写成功但回读失败时返回 201/200 + 零值空实体，客户端拿到空对象且无错误提示。上轮"回读错误改 500"只覆盖了手写回读的 handler，crud 骨架（本批 banner/knowledge_point/learn_road/major/on_site/node_homework 均走此路径）是遗漏点。最佳实践：回读失败时 respondServerError（保持写已成功但响应 500 的语义，与其余 handler 一致）。

### handler-05.md（10 条 P2）

- [回读错误] org_handler.go:177 — `updated, _ := h.Service.Get(...)` 回读错误被忽略：Update 成功但回读失败时返回 200 + null 响应，与 2026-08-07"回读错误改 500"的修复目标不一致；最佳实践：回读失败时 respondServerError。
- [回读错误] org_type_handler.go:100 — 经 crudCreate/crudUpdate 骨架（crud.go:100/187）回读错误被 `item, _ :=` 忽略，失败时返回 200 + 零值实体（`{}`）；2026-08-07"回读错误改 500"未覆盖 crud 框架；最佳实践：骨架层检查 GetByIDFn 错误并 respondServerError。
- [错误吞静默失败] portal_handler.go:205 — `examEvents, _ := h.Service.ListExamEvents(...)` 错误被忽略且无日志，考试事件静默缺失（同文件其他查询均 slog.Error）；最佳实践：记录错误日志。
- [租户隔离/数据完整性] position_ability_handler.go:74-81,130-139 — CreateBinding/UpdateBinding 校验了岗位租户，但 ResponsibilityID 完全未校验（不校验该职责是否属于本租户/本岗位；AbilityPointID 因 is_public 共享能力点可放行）。绑定写入后可引用他租户职责 id，本租户岗位模型/导出会渲染出他租户职责内容（跨租户引用，轻微信息泄露）；对比 position_certificate_handler.go:136-143 同时校验证书岗位与目标岗位租户，此处为遗漏；最佳实践：校验 responsibility 属于同一 position（tenant 一致），或由 store 层 JOIN 校验归属。
- [错误掩盖] position_certificate_handler.go:61-74 — checkCertTenant/GetByIDFn 将任意错误（含 DB 故障）一并返回，经 crudGet/crudUpdate/crudDelete 骨架（crud.go:122-124/155-158）统一映射为 404"证书不存在"；DB 故障被掩盖为"资源不存在"，排障困难；最佳实践：仅对 store.ErrNotFound 返回 404，其他错误上抛走 respondServerError。
- [回读错误] position_handler.go:488 — SaveFull 成功后 `pos, _ := h.Service.Get(...)` 回读错误被忽略，可能返回 200 + null；最佳实践：回读失败 respondServerError。
- [静默失败/无事务] position_import_handler.go:147-150,196-210 — 覆盖模式清理（4 条 DELETE）与后续 majors/certs 重建、新建模式的 batch/majors/certs 关联写入大量 `h.DB.Exec` 错误被忽略且整体无事务；中途任一写入失败（如唯一约束、连接断开）会留下"岗位行已更新但关联数据缺失/残留"的不一致状态；最佳实践：至少对关联写入检查错误并计入 result.Errors，覆盖流程建议包事务。
- [错误掩盖] position_responsibility_handler.go:103-113 — GetByIDFn 将 PositionTenantID 的任意错误（含 DB 故障）映射为 store.ErrNotFound，经 crudGet（crud.go:122-124）统一 404；最佳实践：区分 ErrNotFound 与其他错误。
- [静默失败] program_course_import_handler.go:174-175 — `strconv.ParseFloat/strconv.Atoi` 错误被忽略，非法学分/学时以 0 静默落库；最佳实践：解析失败行计入 errors 并跳过。
- [数据质量] program_course_import_handler.go:182-200 — 岗位名/课程名均未命中现有记录时仍 append 并插入 Name=""、position_id/course_id 均为空的行（空壳课程行），preview 的 Created 也计入这些无效行；最佳实践：解析失败（无法解析岗位或课程）的行计入 errors 并跳过，不落空行。

### handler-06.md（3 条 P2）

- [错误处理] question_bank_handler.go:284-295 — `isDraftPool` 在 `IsDraftPool` 返回错误时 fail-open（`return false` 放行），DB 瞬时错误时草稿池的 Submit/Publish 守卫失效，可对草稿池发起状态流转；最佳实践：错误时按安全侧处理（respondServerError 或直接返回 true 阻止）。
- [部分更新] question_bank_handler.go:158-164 — `Description`/`CoverImage` 无法显式清空：空串/nil 均回退为原值（与 scenario_handler 的 NullableString 可置空设计不一致）；最佳实践：用 `NullableString` 方案区分"未提供"与"置空"。
- [租户隔离] scenario_export_handler.go:106-110 — Sheet2「任务配置」按请求 `scenarioIDs` 直接 `SELECT name FROM scenarios WHERE id=$1` 无 `tenant_id` 过滤（同文件 Sheet1 已带租户过滤 :61，此处遗漏）；Sheet1 会跳过非本租户行，但 Sheet2 仍会把任意租户的场景名写入导出文件（需知道对方 UUID）；最佳实践：与 Sheet1 一致补 `AND tenant_id=$2`。

### handler-07.md（9 条 P2）

- [数据一致性] scenario_import_handler.go:163-164 — overwrite 模式下清空旧任务/测评方式的两个 `h.DB.Exec` 错误被完全忽略且未纳入事务；删除失败时旧任务与按新文件重建的任务并存、测评方式残留（导入接口无事务包裹，部分失败容忍，但此处错误吞掉后场景状态与文件内容不一致）。最佳实践：UPDATE+DELETE+INSERT 包进一个事务，DELETE 错误计入 result.Failed/Errors。
- [边界] scenario_import_handler.go:272 — `weight := 100.0 / float64(len(validMethods))`：当列出的测评方式全部无法映射（如错别字）时 validMethods 为空 → Go 浮点除法得 +Inf，Postgres float8 可存储 Infinity，权重静默写入 +Inf 导致后续均分/综合分计算破坏。最佳实践：`len(validMethods) == 0` 时跳过写入（或记 Failed）。
- [契约] scenario_task_handler.go:157-165 — Update 为全量替换语义：请求缺 `scenarioId`（前端局部保存常见）时 `ScenarioTenantID("")` 查询失败 → 404「场景不存在」；即便传了，store `ScenarioTaskStore.Update`（store/scenario_tasks.go）全列覆盖。部分更新丢字段/直接 404，属隐式契约。最佳实践：与前端确认契约（必填校验返回 400，或 store 对空字段 COALESCE 保留）。
- [校验缺失] scenario_weight_handler.go:90-95 — `req.TaskID` 未校验归属及与 `req.ScenarioID` 一致性：可用本租户场景 + 他租户/任意 taskId 创建权重行（行存自己租户、外键悬空），Upsert（store/scenario_configs.go）无 task 存在性检查。最佳实践：按 task 所在场景校验 `task.scenario_id == req.ScenarioID` 且租户一致。
- [数据丢失] schedule_import_handler.go:263-276 — 课程列表路径无视 `overwrite` 参数始终 `DELETE` 该学期全部排课（含已发布 published）后重建为 draft；且 242-252 学期仅由**第一行**课程推断，文件混学期/首行课程错误时会把 DELETE 作用到错误学期（误删整学期已发布排课）。模板说明虽注明"清空重排"，但 overwrite=false 时也应跳过或提示。最佳实践：逐行校验 term 归属；对含已发布排课的学期要求显式 overwrite。
- [静默] scheduling_handler.go:748-751、790-793、811-813、833-835、855-857 — ExportSchedules 各辅助查询（已排映射/教师/场地/班级/节次）失败仅 `slog.Warn` 后继续，导出文件静默缺数据仍返回 200；最佳实践：参考表失败可警告，主表（课程列表）失败应 500。
- [静默] staff_title_handler.go:190-192 — ToggleStatus 更新后回读 `title, _ = h.Store.GetByID(...)`、`count, _ := h.Store.CountUserRefs(...)` 错误全部忽略：回读失败时 200 响应携带零值/旧数据（与上轮"回读错误改 500"修复不一致）。最佳实践：回读失败统一 `respondServerError`。
- [静默] staff_title_handler.go:147（经 handler/crud.go:100）— crudCreate 创建后回读错误被 `item, _ :=` 忽略，失败时返回 201 + 零值实体；crudUpdate/crudGet 已改为 500，Create 路径未同步。最佳实践：创建回读失败返回 500。
- [校验缺失] student_portrait_handler.go:253-290 — CreateArchive 未像 Generate（200-209 行）那样校验 `userId` 属于当前租户/存在性，业务用户可为本租户创建指向他租户用户的档案行（本租户内数据污染、列表渲染异常）；最佳实践：复用 Generate 的用户归属校验。

### handler-08.md（14 条 P2）

- [静默失败] task_knowledge_ability_handler.go:59-63、109-112 — `UnbindKnowledge`/`UnbindAbility` 中 `TaskBindingTaskID` 出错一律返回 200 成功。仅 `pgx.ErrNoRows`（绑定不存在）应视为幂等成功，DB 故障/任务表异常等真实错误被吞，前端显示成功实际未删除；最佳实践：区分 `errors.Is(err, pgx.ErrNoRows)` 走幂等成功，其余走 `respondServerError`。
- [租户隔离] task_knowledge_ability_handler.go:44、93 — `BindKnowledge`/`BindAbility` 未像 Unbind 路径一样校验 task 的租户归属；store 层仅按调用方 tenant_id 插入绑定行（store/scenario_configs.go:204-219），可对他人租户任务/知识点/能力点建立跨租户绑定行（需猜测 UUID，泄漏面有限但产生脏数据）；最佳实践：Bind 前复用 `verifyTaskTenant` 链路校验。
- [租户隔离] task_resource_handler.go:165-169 — `BindResource` 未校验 task 归属（Unbind 路径做了 task→scenario→tenant 链路校验），store `ResourceBindingStore.Bind`（store/resource_bindings.go:132-147）仅按调用方 tenant_id 插入且不校验 bindID/resource 归属，可对他人任务/资源建立跨租户绑定行；最佳实践：Bind 前校验 `TaskScenarioID`+`ScenarioTenantID`。
- [静默失败] task_resource_handler.go:180-184 — `UnbindResource` 中 `BindTargetID` 出错一律 200 成功（同 task_knowledge_ability_handler 模式），DB 错误被吞；最佳实践：仅 `pgx.ErrNoRows` 幂等成功，其余 500。
- [静默失败] teaching_plan_handler.go:173 — `Get` 中 `entries, _ :=` 忽略回读错误：计划存在但条目查询失败时返回 200 + 空条目，前端误判无条目；最佳实践：走 `respondServerError`。
- [静默失败] teaching_plan_handler.go:108 — `Generate` 中 `scheduledCount, _ :=` 忽略错误：计数查询失败视为 0，已排课计划可能被"重新生成"删除重建（GeneratePlan 事务内先 DELETE 旧计划，store/teaching_plans.go:169-175）；虽有 FK 兜底（被引用时 500 回滚），但错误被静默化；最佳实践：错误走 500。
- [静默失败] teaching_plan_handler.go:293 — `Confirm` 后 `plan, _ :=` 回读失败返回 200 + null；最佳实践：`respondServerError`。
- [静默失败] tenant_handler.go:209、240、353、378、625 — `Update`/`UpdateStatus`/`AdminUpdate`/`AdminUpdateStatus`/`UpdateSchoolAdmin` 回读一律 `tenant, _ :=`，回读失败返回 200 + null；最佳实践：`respondServerError`（UpdateSchoolAdmin 的 Admin 版本已正确 500，本组应统一）。
- [静默失败] training_program_handler.go:393 — `Clone` 成功后 `program, _ :=` 回读失败返回 201 + null；最佳实践：`respondServerError`。
- [数据丢失] user_management_handler.go:301-317 + store/users.go:132-141 — `Update` 是"读后全列覆盖"：store 对 email/phone/avatar_url/student_no/work_id/id_card/org_node_id/major_id/title_ids 等列直接写请求值，body 未携带的字段（nil）会被置 NULL。handler 仅保证 username/name 必填，部分更新（如只改名）会清空其余字段；当前前端若全量表单提交则无感，但契约脆弱且测试（TestUser_Update 只发 username+name）未覆盖字段保持；最佳实践：按 `*string` nil 语义做 COALESCE 部分更新（参照 teaching_plan UpdateEntry 模式）。
- [认证设计] user_management_handler.go:129-154 — `ChangeMyPassword` 不校验旧密码（注释声明设计如此）：持有会话即可改密，被盗会话可直接接管账号；作为自助改密接口建议至少校验旧密码或走验证码，风险由产品决策兜底，仅记录提醒。
- [错误吞静默] user_relation_handler.go:92-95 — `Create` 任何错误一律 400"发起者或目标不在租户中"：DB 故障/唯一冲突等真实错误被误标为客户错误，前端无法区分；最佳实践：区分 `pgx.ErrNoRows`/业务错误走 400，其余 `respondServerError`。
- [数据丢失] workflow_handler.go:101-115 — `UpdateFn` 中 `steps`/`majorIds` 为 nil 时置空切片后整体覆盖：部分更新（只改 name/status）会清空已有步骤与适用专业，仅 status 有兜底（ValidateUpdateExisting）；最佳实践：nil 时沿用 existing 值（与 status 兜底一致）或走 read-modify-write。
- [静默失败] crud.go:100、187（workflow 经 crudCreate/crudUpdate 复用）— 创建/更新后回读 `item, _ :=` 忽略错误：回读失败返回 201/200 + 零值对象；最佳实践：回读失败 `respondServerError`。

### service-01.md（5 条 P2）

- [并发竞态] evaluation_result.go:255-261 — GradeEvaluationResult 在事务外先后执行 Grade 与 syncExamResultScore；两者之间学生可重交（exam_results.graded_at 尚未写入）：SaveResult 覆盖新作答（含客观分），随后教师分覆盖 score，最终「教师分数+学生新答案」不一致；最佳实践：将 Grade 与 UpdateExamResultScore 包进同一事务（或先写 graded_at 再评分）。
- [并发竞态] evaluation_result.go:264-287 — BatchGradeEvaluationResults 批内 BatchGrade 无行数命中校验（store/evaluation_results.go:130-140 忽略 RowsAffected），对已评分结果静默成功，随后无条件 syncExamResultScore 用新分覆盖考试结果分，造成场景分与考试分分叉；与单条 Grade（store/evaluation_results.go:123-125 返回 ErrNotFound）行为不一致；最佳实践：BatchGrade 返回命中数，未命中条目跳过同步并统计/报错。
- [数据一致性] evaluation_result.go:290-301 — syncExamResultScore 仅更新 score/is_pass/graded_at，不更新 grading_status；学生含主观题交卷后 grading_status='pending'，教师经场景评分后考试结果仍显示「待评分」但已有分且 graded_at 非空，考试中心展示自相矛盾；最佳实践：同步时一并置 grading_status='evaluated'（与 GradeExamResult 口径一致）。
- [逻辑 bug] evaluation_result.go:140（联动 store/exam_results.go:455-461）— SyncSceneEvaluation 的 graded_at CASE 第二分支「EXCLUDED.status='evaluated' → NOW()」：学生先经 SubmitEvaluationResult 直交产生 pending 场景结果，随后参加该方式的全客观题考试交卷，同步将该场景结果自动置 evaluated+graded_at=NOW()（无教师评分）；后果：UsageGradedByUser 判定为教师已评 → 后续重交一律 ErrAlreadyGraded，且教师 Grade（守 status='pending'）返回 ErrNotFound 无法再评；最佳实践：仅当 EXCLUDED 由「人工评分路径」产生时写 graded_at，自动判分路径只写 status 不写 graded_at（与 INSERT 路径行为一致）。
- [数据丢失] job_ability_aggregator.go:373（联动 store/users.go:474-496）— profiles 以 users 表行回填，若候选学生已删号（scene_evaluation_results 的 evaluatee_id 仍存在），ListProfiles 无该 key，零值 struct 传入 UpsertResult 会把已存的 class_name/major_name 覆写为空串（旧数据被抹白）；最佳实践：profile 缺失的学生跳过 Upsert（或仅更新得分列不动身份列）。

### service-02.md（7 条 P2）

- [逻辑 bug] lesson_content.go:590-611 — `ensureNodeQuestionExam` 的 usage 复用分支（`FindNodeUsage` 命中）只更新窗口，不把 `rc["usageId"] = found` 写回；`usageID == ""` 的创建分支才写回。若历史数据中 eval_data 的 usageId 丢失（编辑测评规则丢配置场景正是注释想修复的路径），usage 已存在但 usageId 永远无法补回，persisted eval_data 持续缺 usageId → `FindNodeExamResult`（store/evaluation_results.go:177）按 usageId 关联失败 → 教师评分后考试结果分数回写永久失效。最佳实践：复用分支同样执行 `rc["usageId"] = found` 写回并标记 updated；`ensureNodePaperUsage`（526-548 行）同型问题一并处理。
- [数据丢失/错误吞] position.go:96-106、108-119 — `SaveFull` 中 `PrepareAbilityPoint`/`PrepareCertificate` 出错直接 `continue` 静默跳过，自定义能力点/证书绑定被悄悄丢弃，接口返回成功、用户无感知。小概率 DB 错误路径但后果是数据丢失且无日志。最佳实践：至少 `slog.Warn` 记录，或把错误返回由 handler 提示"部分绑定保存失败"。
- [事务边界] position.go:99-119 — `Prepare*` 在事务外（pool 连接）执行，仅映射表在 `WithTx` 内写；若事务后续失败回滚，已创建的能力点/证书库条目成为孤儿数据（无关联岗位）。最佳实践：把 Prepare 移入事务内（或接受孤儿并补清理）。
- [错误吞] scenario.go:89-91、100-104 — `PopulateEvalData`/`PopulateAbilityPointNames` 无返回值（store/scenario_tasks.go:137、182 内部 Query 出错直接 `return`），DB 错误时任务列表静默缺评估摘要/能力点名称。设计为容错，但错误路径无任何日志。最佳实践：store 返回 error 或内部 slog.Warn。
- [契约] scenario.go:170-172 — `BatchGetByTable` 把惰性 `pgx.Row` 泄漏出 service 层，调用方必须自行 Scan；若异常路径不 Scan，连接延迟归还（handler/batch_handler.go:120-126 正常路径均会 Scan，风险仅在异常路径）。service 层暴露原始 DB 句柄违背分层契约。最佳实践：service 改为返回 `(any, error)` 或由 store 提供 Scan 闭包。
- [数据丢失] user_extension_field.go:36 — `FilterTenantRoleCodes`（store/user_extension_fields.go:107-127）查询出错时返回空列表，`Update` 随即用空数组覆盖 `applicable_role_codes`，DB 故障时已有角色配置被静默清空。最佳实践：store 返回 ([]string, error)，出错时中止更新而非清空。
- [边界] user.go:53-75 — `BatchCreate` 去重仅限批内（`seen` map），与库中已存在用户重名/同登录名时 store `Create` 唯一约束报错 → 整批回滚，与注释"跳过缺字段与重复项"不符（库内重复不跳过）。最佳实践：捕获唯一约束错误（isUniqueViolation）跳过该条继续。

### store-01.md（11 条 P2）

- [索引] abilities.go:128-204 — CitationStats/ListUncited 的 4 个引用绑定表相关子查询
- [租户纵深] alliance_store.go:105-118 — ListEnterpriseAgreements 仅按
- [租户纵深] alliance_store.go:120-126 — ListMilestones 仅按 `project_id` 过滤，
- [错误处理] alliance_store.go:78-86 — queryList 吞掉扫描错误（`items, _ := scan(rows)`，
- [租户纵深] approvals.go:76-85、129-166 — Get/UpdateHistory/RejectRecord/AdvanceRecord
- [租户纵深] approvals.go:116-125 — ExistsPending 仅按 target_type+target_id 全局查询，
- [租户纵深] batches.go:177-238 — CreateFields/UpdateFields/Delete/UpdateStatus 均无
- [租户纵深] content_actions.go:94-176 — Transition/Review/Invite 均无 tenantID 参数
- [错误处理] course_homeworks.go:177-188 — scanHomeworkSubmissions 扫描失败
- [数据残留] courses.go:133-161 — Delete 未清理课程级 exam_usages（target_type=
- [租户纵深] dict_store.go:56-85 — 基类 GetByID/Update/Delete 无租户过滤参数

### store-02.md（8 条 P2）

- [nil 解引用] portal.go:679 — `ListClassPlans` 直接 `q.Query(ctx, query, userID, *tenantID)` 解引用指针，而本文件其余方法均以 `tenantID != nil` 守卫；一旦调用方传入 nil 即 panic；最佳实践：与其他方法一致先判 nil（nil 时按无租户或返回空处理）。
- [数据丢失] lesson_content.go:158-174, 242-264 — `Update` 在 `GranularLessonIds` 缺省（PATCH 未带该字段）时置空，随后 `SyncCourseKnowledgePoints` 第二条 UPDATE 条件 `($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))` 恒真，会把该知识点从**租户内所有课程**的 `courses.knowledge_point_ids` 中删除；而该列同时被课程编辑（courses.go:119）、课程克隆/导入等链路直接写，属通用引用列，非颗粒课专属；只改知识点名称即可能静默剥离课程-KP 关联；最佳实践：Update 仅当请求显式携带 granular_lesson_ids 才调用 SyncCourseKnowledgePoints（或改为全量对比差异后再同步）。
- [事务穿透] lesson_content.go:177-183 — `Delete` 先 `DeleteResourceTags` 再删知识点，两条语句未包事务（用 s.q 而非 tx），删除标签成功后删行失败会残留孤儿标签；最佳实践：签名改为接收 tx，由 service 统一开启事务。
- [数据一致性] lesson_content.go:177-183 — 删除知识点后未从 `courses.knowledge_point_ids` 反向清理，形成悬空引用（CitationStats/ListUncited 口径与存量数据不一致）；最佳实践：Delete 内执行 `UPDATE courses SET knowledge_point_ids = array_remove(...) WHERE tenant_id=$1 AND $2 = ANY(knowledge_point_ids)`。
- [N+1] exam_questions.go:63-85 — 每道题先 `SELECT id` 判存在再 UPDATE/INSERT（2 次往返/题），题目多时 N+1 放大；最佳实践：改 `INSERT ... ON CONFLICT (exam_id, question_id) DO UPDATE`（与 exams.go:124 的 AddQuestion 同款写法）单语句完成。
- [原子性/计数器漂移] favorites.go:68-92 — 取消收藏的 DELETE 与 `favorite_counters` 减一、添加收藏的 INSERT 与计数器加一均非事务，且计数器 UPDATE/INSERT 错误被 `_, _ =` 吞掉（favorites.go:74-77, 87-91）；失败后计数与真实收藏数长期漂移（列表/详情展示错数）；最佳实践：两个语句包在一个短事务内，计数器语句错误返回 err 而非忽略。
- [事务穿透] exams.go:80-86 — `Delete` 先删 `exam_questions` 再删 `exams`，两条语句未包事务，第二条失败时题目已删而试卷残留（半删状态，与上轮修复的 question_banks Delete 同型）；最佳实践：Delete 接收 tx 或内部开启事务。
- [事务穿透] micro_cert.go:111-117 — `DeleteTemplate` 先删 `cert_issuance_records` 再删模板，未包事务，失败即半删（发放记录丢失、模板残留）；最佳实践：包事务。

### store-03.md（30 条 P2）

- [租户] positions.go:151-175、315-327、179-206 — Update/SaveFull/Delete 的 UPDATE/DELETE 仅 `WHERE id = $N`，无 tenant_id 过滤；由 handler 先 Get+verifyTenantOwnership 补偿（已核实 position_handler.go:194/295/380）。最佳实践：方法签名增加 tenantID 并在 WHERE 带 `AND tenant_id = $N`（参照 scenario_tasks.go:102 的 RowsAffected 防御写法），消除对 handler 时序的隐式依赖。
- [租户] positions.go:480-530 — GetFavorite/ToggleFavorite 仅按 user_id+career_position_id 操作，无岗位租户校验；若他租户用户获知跨租户岗位 ID（如 ID 外泄）可写入收藏，影响其收藏列表。最佳实践：ToggleFavorite 增加 tenantID 参数并在 INSERT 前校验岗位归属（或由 handler 保证）。
- [错误处理] positions.go:447-453、473-476 — PrepareAbilityPoint/PrepareCertificate 第二段 SELECT 的 Scan 错误被 `_ =` 静默丢弃；若 INSERT 真失败（非冲突）且重查也失败，返回的 newID 指向不存在的行，后续 position_ability_bindings 插入将触发 FK 错误（错误归因模糊）。最佳实践：INSERT 后直接 RETURNING id，消除第二次查询（参照 question_banks.go Create 的 RETURNING 模式）；GenerateUniqueEntityCode 失败时的 `GenerateEntityCode` 兜底码同样可能撞唯一键，属容忍范围可保留。
- [安全] query.go:372-390 — ExecuteListQuery 对 Table/SelectColumns/OrderBy/TenantColumn/SearchColumns 做白名单校验，但 CountTable（query.go:420-424）不在白名单内（当前仅硬编码配置、无动态来源，安全但缺纵深）。最佳实践：将 CountTable 纳入 allowedListQueryTables 白名单校验，防未来动态化。
- [租户] question_banks.go:54-63、78-82 — Get/IsDraftPool 未限定租户（GetScoped/fetchBankScoped 已有但 Get 未用）；Create 后回读走无租户 Get（刚创建属本租户，安全）；handler 层需自行校验。最佳实践：Get 改为走 GetScoped 或要求调用方显式传租户。
- [租户] questions.go:42-52、95-110 — Create/BatchCreate 不校验 bank_id 所属租户，可把本租户题目挂到他租户题库名下（数据不泄露但归属错乱）；Update 预查 fetchQuestion 带租户、动态 SET 拼接受控。最佳实践：Create 前用 `SELECT tenant_id FROM question_banks WHERE id=$1` 校验（或 handler 先取题库）。
- [事务] random_draw_questions.go:63-69 — Delete 中 DeleteResourceTags 与主体 DELETE 分属两次独立语句且无事务，标签清理失败时主体已删/标签残留孤儿。最佳实践：两语句包进 withTxStore（同 resource_library.go:332-338）。
- [事务] resource_bindings.go:108-128 — CreateResource 无事务：资源 INSERT 成功后绑定 INSERT 失败即留孤儿资源；且绑定 INSERT 与 afterBind 错误被 `_ =`/`_` 静默丢弃（courses.resource_ids 同步失败不可见）。最佳实践：三动作包进事务并透传错误；afterBind 失败至少 slog 记录。
- [租户] resource_codes.go:25-31、48-65、76-88 — Get/Update/Delete 全部无 tenantID 参数（UPDATE/DELETE 仅 WHERE id）；已核实 resource_code_handler.go:54-56 经 crud 框架 GetOwnership/CheckOwnership（crud.go:126/160/219）在调用前校验实体租户，暂不构成越权，但 store 层未表达租户纵深。最佳实践：Update/Delete 增加 tenantID 并 `WHERE id=$N AND tenant_id=$M`。
- [租户] resource_library.go:283-338 — Get/Update/Delete 无租户过滤（UPDATE/DELETE 仅 WHERE id）；已核实 resource_library_handler.go:167/220/281 在调用前 verifyTenantOwnership 补偿。最佳实践：Update/Delete 增加 tenantID 入 WHERE（列表/统计类方法租户隔离已完整）。
- [事务] resource_library.go:332-338 — Delete 先 DeleteResourceTags 再删主体，无事务；标签清理失败主体仍被删。最佳实践：包进 withTxStore。
- [租户] roles.go:22-24 — DictStore UpdateSQL/DeleteSQL（`WHERE id=$4`/`WHERE id=$1`）无租户过滤；已核实 role_handler.go:53-54/92 经 crud CheckOwnership 补偿。最佳实践：UpdateSQL/DeleteSQL 带 tenant_id 条件（DictStore 泛型支持追加列，需同步调整 Args 契约）。
- [校验] roles.go:81-99 — Assign 未校验 userID 是否同租户（handler 可经 UserTenantID 校验，方法已提供）；user_count 计数与 INSERT 同事务，正确。最佳实践：Assign 内直接带 `user 同租户` 校验或保持 handler 校验并注明契约。
- [错误处理] scenario_clone.go:108、205、415 — 批量 clone 循环内 Scan 失败一律 `continue` 静默丢行（源数据局部损坏时克隆产物缺失且无日志），与 466/506 的"跳过未知任务"（业务预期）不同，属真错误被吞。最佳实践：返回错误或至少 slog.Error 记录行号。
- [租户] scenario_clone.go:40-57 — FetchSource 无租户过滤；已核实 service/scenario.go:59 用 src.TenantID 与调用方租户比对（ErrScenarioNotInTenant），补偿成立。最佳实践：FetchSource 增加 tenantID 参数直接 `WHERE id=$1 AND tenant_id=$2`。
- [租户] scenario_configs.go:29-31、117-121 — ScenarioWeightStore.Upsert / ScenarioGradeStore.Upsert 的 UPDATE 分支仅 `WHERE id=$N` 无租户；已核实 scenario_weight_handler.go:66-88 在 upsert 前同时校验 scenario 与新/旧配置归属，补偿成立。最佳实践：UPDATE 分支加 tenant_id 条件。
- [租户] scenarios.go:95-112、115-152 — Update/Delete 仅 WHERE id 无租户；已核实 scenario_handler.go:215/300 先 Get+verifyTenantOwnership 补偿。最佳实践：Update/Delete 增加 tenantID 参数（fetchScenario 已返回 TenantID 可先比对）。
- [租户] scheduling.go:302-308 — CreateSchedule 内 `UPDATE teaching_plan_entries SET status='scheduled' WHERE id=$1` 无租户/计划归属校验，plan_entry_id 由请求携带时依赖调用方先校验；同理 DeleteScheduleWithRestore:337-343。最佳实践：经 teaching_plans 联表加 `p.tenant_id` 条件（参照 teaching_plans.go:391-397 的 UPDATE...FROM 写法）。
- [租户] staff_titles.go:18-20、51-56 — DictStore UpdateSQL/DeleteSQL 与 UpdateStatus 均无租户过滤（UpdateStatus 仅 WHERE id）；handler 层需自行校验（staff_titles 走 crud 框架，同 roles 补偿）。最佳实践：UpdateStatus 增加 tenantID 参数。
- [租户] student_portraits.go:83-89 — GetArchive 无租户过滤（CreateArchive 后回读与 handler 查询依赖 handler 校验）；GetPortraitByUserPosition/FetchRecommendPositions 以 userID 为键无租户（userID 来自 Claims，跨租户不可枚举，低危）。最佳实践：GetArchive 增加 tenantID。
- [租户] subscriptions.go:19-33、69-80 — Get/Update 仅 WHERE id 无租户；已核实 subscription_handler.go:42 更新仅 canManagePlatform（平台管理员）可调，补偿成立。最佳实践：Update 增加 tenantID 入 WHERE。
- [租户] task_evaluation.go:46-59、77-98 — GetRubricTemplate/UpdateRubricTemplate/DeleteRubricTemplate 均无租户过滤（列表租户隔离完整）；handler 需自行校验。最佳实践：Update/Delete 增加 tenantID 入 WHERE。
- [错误处理/事务] teaching_plans.go:403-410 — UpdatePlanEntry 的 teaching_plan_entry_classes 删除与插入错误被 `_ =`/`_` 忽略且不在事务内，中途失败留下旧班级关联或空关联，且与主体 UPDATE 非原子。最佳实践：纳入事务并透传错误。
- [租户] teaching_plans.go:432-437 — MarkConfirmed 仅 WHERE id 无租户（workflow 流转回调，调用方已校验 plan 归属）；GeneratePlan 中 `SELECT name FROM career_positions WHERE id=$1`（training_programs.go:152 同）未带租户（名称回填，低危）。最佳实践：MarkConfirmed 增加 tenantID。
- [租户] tenant_admins.go:128-138 — ResetPassword 仅 WHERE id 无租户；若未来放开非平台管理员调用即越权改密。最佳实践：增加 tenantID 参数。
- [租户] tenants.go:181-201 — Update/UpdateStatus 仅 WHERE id（平台级接口，超管持有权限，无越权面）；ListConfig TenantColumn="id" 属租户自指查询，正确用法。
- [错误处理] training_programs.go:152-156 — PutCourses 名称回填的两次 `_ = tx.QueryRow(...).Scan(&name)` 忽略查询错误，回填失败时课程名留空静默入库。最佳实践：记录日志或返回错误。
- [租户] user_extension_fields.go:40-68 — Get/Update 仅 WHERE id 无租户（返回记录含 TenantID 供 handler 校验，补偿成立）。最佳实践：Update 增加 tenantID。
- [租户] users.go:132-142、151-154、157-164、167-174 — Update/UpdateStatus/ResetPassword/Delete 仅 WHERE id 无租户（login_name 全局唯一约束、handler 预校验构成间接防线）；其中 Update 可跨租户改 login_name（handler 传入 GlobalLoginName 拼租户前缀，篡改他租户用户 login_name 需已知目标 ID）。最佳实践：Update/Delete/ResetPassword 增加 tenantID 入 WHERE。
- [事务] users.go:187-203 — BatchDelete 两条 DELETE 无事务，第二条失败时 user_roles 已删、users 残留（用户仍在但角色消失）；Delete（167-174）角色计数递减错误被忽略且与主删分离。最佳实践：包进 withTxStore。


---

## 四、P3 一般（607 条）

主要类别（明细见 `raw/`）：死代码/未使用、重复代码、命名/风格、类型 any、测试卫生（清理错误忽略）、i18n 细节、过时注释。

---

## 五、回查验证记录

对 **35 条 P0/P1 记录**全部逐条回到代码复核：

| 结论 | 数量 | 明细 |
|------|------|------|
| 已回查确认 | 32 | 见上文各条目「回查」列 |
| 回查排除（误报） | 1 | `alliance_project_store.go:197` DeleteMilestone（SQL 与参数均正确） |
| 回查降级 P1→P2 | 2 | `position_certificates.go:23` List（handler 已有归属校验，store 纵深）；`alliance_store.go:55` UpsertSchoolInfo（无调用方） |

**关键结论**：本轮最重要的发现是 **2 个修复引入的 P0 回归**（能力域 404、题库绑定 500）与 **6 个 P1 回归**（scheduler 超时污染、140 种子时序、导入防重失效、测试断言、骨架屏卡死）——说明修复后必须补充回归验证。上轮绝大部分修复（越权/租户隔离/部分更新/回读 500/并发锁/竞态守卫/缓存收敛/导入事务化）经复核**无回归**。

---

## 六、修复优先级建议

1. **立即修（P0×2）**：能力域 TenantFn 补配、question_banks 绑定 INSERT 去 tenant_id
2. **本周修（P1 回归×4）**：scheduler RESET statement_timeout、140 豁免平台租户、import-confirm await、job_ability 测试
3. **两周内修（P1 越权/数据丢失）**：PutFullRule/course_node/favorites/question/scheduling 租户校验、四实体部分更新兜底、exam_usage/course_node 兜底、fields 开关、tasks 两处、landing 骨架屏
4. **持续修（P2）**：按批次逐项修复
5. **跟踪（P3）**：随重构清理

## 附录

- 逐文件勾选清单：[`checklist.md`](./checklist.md)
- 各批次原始逐行记录：[`raw/`](./raw/)（28 个文件）
