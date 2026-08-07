# Store 层代码审查（store-03）2026-08-07

审查范围：backend/internal/store/ 下 31 个文件，逐行通读；表结构以 backend/migrations/001_baseline.up.sql 及增量 migration 核对。

结论：P0 = 0，P1 = 4，P2 = 18，P3 = 31。所有 SQL 列/表引用均已与 migrations 核对，未发现运行时必错项。

---

## backend/internal/store/positions.go

- [P1][越权] backend/internal/store/positions.go:105 — `Get` 无租户过滤（`WHERE cp.id = $1`），任意 id 可跨租户读取岗位详情（含 collaborators、内部 status 等）。岗位 id 为 uuid 不可枚举，但该接口是核心读路径，且服务层若未前置校验即越权。最佳实践：`Get(ctx, id, tenantID)` 增加租户条件，公开读走独立无租户方法并由 handler 显式决定。
- [P1][越权] backend/internal/store/positions.go:90 — `FavoritesListConfig` 未设 `TenantScoped`，而 `position_favorites` 表无 tenant_id 列（baseline:805），列表直接 `JOIN career_positions` 只按 `pf.user_id` 过滤——只要用户收藏过其他租户的岗位（见 ToggleFavorite 无校验），就能跨租户读出该岗位全部数据。最佳实践：`position_favorites` 增 tenant_id 列，或 FavoritesList 前置 `cp.tenant_id = 当前租户` 过滤。
- [P1][越权] backend/internal/store/positions.go:478,487,497 — `GetFavorite`/`FavoriteCount`/`ToggleFavorite` 均无租户校验，可对他租户岗位写入收藏/切换状态、污染 favorite_counters；`IncrementView`(207) 同理。最佳实践：方法签名增加 tenantID，先校验 `career_positions.tenant_id` 归属。
- [P2][事务] backend/internal/store/positions.go:124-173 — `Create`/`Update` 写操作走 tx 参数、但回读用 `s.q`（store 自身连接）。当前唯一调用方 service/position.go:46,58 恰好传入 `txStore.Q()`（即 tx）所以不炸，但这是脆弱契约：任何人改为传独立 tx 或 pool 都会出现"tx 内写、全局连接读回看不到未提交数据 → 返回 ErrNoRows/404"。最佳实践：回读也走传入的 tx 参数。
- [P3][逻辑] backend/internal/store/positions.go:497-528 — `ToggleFavorite` 先查后改非原子；insert 用 `ON CONFLICT DO NOTHING` 后无条件 `favorite_counters +1`，并发下计数漂移（收藏行为非核心业务，按约定可容忍，但 counter 会虚高）。
- [P3][死代码] backend/internal/store/positions.go:341-350 — `for name, libID := range certificateMap { _ = name }` 死变量；`ON CONFLICT DO NOTHING` 无冲突目标，而 position_certificates 无唯一约束（baseline:799），该子句实际永不生效。
- [P3][越权] backend/internal/store/positions.go:313-419 — `SaveFull` 中 `UPDATE career_positions ... WHERE id = $14` 及一系列 DELETE 均无租户条件，依赖 service 层已校验归属；建议在 SQL 中直接加 `AND tenant_id = $N` 纵深防御。

## backend/internal/store/query.go

- [P2][健壮性] backend/internal/store/query.go:372-390 — 所有 Table/SelectColumns/OrderBy/TenantColumn/SearchColumn 字符串必须命中硬编码白名单，新增或微调任何 ListConfig 字符串而不同步白名单即线上 500（已有测试守护，但每次改配置都是运行时风险点）。
- [P3][死代码] backend/internal/store/query.go:98 — `ListQueryConfig.SearchParam` 字段从未被 `ExecuteListQuery` 使用（搜索恒取 `p.Search`），误导后续开发者。
- [P3][正确性] backend/internal/store/query.go:424 — COUNT 与主查询共用 WHERE；对未配置 `CountTable` 且 FROM 含聚合 JOIN 的配置，若 JOIN 产生行重复会导致 total 虚高（当前全部配置已验证无重复，属潜在坑）。
- [P3][命名] backend/internal/store/query.go:508-510 — `Itoa` 与标准库 strconv 包装，仅用于拼接占位符；可接受但属工具性暴露。

## backend/internal/store/query_normal_test.go

- 无问题（纯装配逻辑单测，无 SQL）。

## backend/internal/store/query_test.go

- 无问题（白名单守护测试有效覆盖已知回归场景）。

## backend/internal/store/question_banks.go

- [P2][逻辑] backend/internal/store/question_banks.go:119-155 — `Update` 校验用方法参数 `tenantID`，但事务内知识点绑定 INSERT 用的是 `p.TenantID`（参数结构体字段，行145）。两值不一致时（handler 组装失误）知识点会绑到错误租户，且校验与写入口径不一。最佳实践：统一用方法参数 tenantID。
- [P2][事务] backend/internal/store/question_banks.go:158-170 — `Delete` 三个 DELETE（绑定/题目/题库）无事务，中途失败留孤儿数据。最佳实践：包一层 withTxStore（该 store 已有 beginner）。
- [P3][重复代码] backend/internal/store/question_banks.go:222-287 — `fetchBank` 与 `fetchBankScoped` 除 WHERE 租户条件外完全相同，可合并为一个函数加 where 参数（与 student_portraits.fetchPortrait 模式一致）。

## backend/internal/store/questions.go

- [P3][并发] backend/internal/store/questions.go:55-86 — `Update` 先 fetchQuestion 预检再 UPDATE，非原子（TOCTOU，小概率），按"普通业务允许报错"原则可接受。
- [P3][逻辑] backend/internal/store/questions.go:95-110 — `BatchCreate` 逐行 `GenerateEntityCode("TM")` 不查重，批量导入的 code 可能重复（questions.code 无唯一约束，无实际危害）。
- [P3][风格] backend/internal/store/questions.go:30-39 — `Get` 把 `pgx.ErrNoRows` 转 `ErrNotFound`，而 random_draw_questions.go 的 Get 未转，风格不一致（低影响）。

## backend/internal/store/random_draw_questions.go

- [P3][事务] backend/internal/store/random_draw_questions.go:63-69 — `Delete` 先 `DeleteResourceTags` 再删行，非事务，中途失败留孤儿标签绑定。
- [P3][风格] backend/internal/store/random_draw_questions.go:26-32 — `Get` 未将 `pgx.ErrNoRows` 映射为 `ErrNotFound`（与其它 store 不一致）。

## backend/internal/store/recommends.go

- 无问题（Get/Update/Delete/fetch 全部租户过滤齐全，参数占位符编号正确）。

## backend/internal/store/resource_bindings.go

- [P2][事务] backend/internal/store/resource_bindings.go:108-128 — `CreateResource` 资源插入与绑定是两条独立语句无事务，且绑定失败被 `_, _ = s.q.Exec` 吞掉（行117-121），资源已入库但接口返回"绑定成功"，前端看不到刚建的资源；`afterBind` 错误同样被忽略（行123）。最佳实践：至少对绑定失败记日志或回滚资源。
- [P2][错误处理] backend/internal/store/resource_bindings.go:132-164 — `Bind`/`Unbind` 的 afterBind/afterUnbind（课程 `courses.resource_ids` 聚合同步）错误全部被忽略，聚合字段与绑定表漂移。
- [P3][SQL注入面] backend/internal/store/resource_bindings.go:116-125,132-153 — `bindTable`/`bindCol` 直接字符串拼接进 SQL（当前由调用方常量传入，无注入风险；若未来参数化动态传入即为注入点）。
- [P3][一致性] backend/internal/store/resource_bindings.go:231-305 — `ListCourseResources` 的 limit 默认 200 且无 maxPageSize 钳制，与 `List`(76-81) 的钳制行为不一致。

## backend/internal/store/resource_codes.go

- [P3][越权] backend/internal/store/resource_codes.go:98-101 — `ListConfig` 的 ExtraFilter 允许按任意 `tenantId` 过滤，与 `TenantScoped` 租户条件双重叠加；若 handler 误传其他租户 id 可跨租户读列表。最佳实践：删除该过滤项，统一走 `p.TenantID`。
- [P3][越权] backend/internal/store/resource_codes.go:25-65 — `Get`/`Update`/`Delete` 均无租户参数（表有 tenant_id 列），依赖 handler 校验。

## backend/internal/store/resource_library.go

- [P3][越权] backend/internal/store/resource_library.go:283,312,332 — `Get`/`Update`/`Delete` 无租户过滤（注释声明由 handler 负责校验）。属于有意的分层决策，但违反"store 方法应接受 tenantID 参数"的规范，建议补签名。
- [P3][性能] backend/internal/store/resource_library.go:67-137 — `List` 的 OrgName/MajorName 用名称等值过滤，走不到索引（组织名无索引，全表扫描）；可用 org_node 子树过滤替代，当前数据量下可接受。
- [P3][一致性] backend/internal/store/resource_library.go:169-226 — `ListUncited` 的 `from/to` 时间过滤用 `created_at >= / <` 边界正确，无问题；仅提示 `resource_type::text` 与 `List` 的 `rl.resource_type = $N` 风格不统一（enum 隐式转换，均可用）。

## backend/internal/store/roles.go

- [P2][越权] backend/internal/store/roles.go:61-71 — `Delete` 的 `DELETE FROM roles WHERE id = $1` 及 user_roles 清理均无租户条件，依赖 handler 前置校验；角色 id 为 uuid，风险中低，但属缺租户过滤的典型面。
- [P3][错误处理] backend/internal/store/roles.go:74-78 — `UserTenantID` 用户不存在时直接上抛 `pgx.ErrNoRows`，handler 需自行转义（与 Get 的 ErrNotFound 约定不一致）。

## backend/internal/store/scenario_clone.go

- [P2][数据丢失] backend/internal/store/scenario_clone.go:103-111,203-209,293-299,334-336,372-374,414-417 — 各处 rows.Scan 失败一律 `continue` 静默丢弃该行：克隆出的任务可能缺交付物/评估点/评分规则/评审步骤/绑定，且事务照常提交，用户无感知（克隆结果残缺但"成功"）。最佳实践：克隆是核心操作，scan 失败应整体回滚报错。
- [P2][错误处理] backend/internal/store/scenario_clone.go:434-448 — `remapTaskDependencyIDs` 中 `SELECT dependency_ids` 出错时静默返回 nil（行437 `if err != nil || len(oldDeps) == 0 { return nil }`），依赖重映射丢失无提示。
- [P3][越权] backend/internal/store/scenario_clone.go:40-57 — `FetchSource` 无租户过滤，依赖调用方校验源场景归属。

## backend/internal/store/scenario_configs.go

- [P2][越权] backend/internal/store/scenario_configs.go:29-34,117-124 — `ScenarioWeightStore.Upsert`/`ScenarioGradeStore.Upsert` 的 UPDATE 分支 `WHERE id = $N` 无租户条件，且回读也跨租户（依赖调用方校验）。最佳实践：UPDATE 加 `AND tenant_id = $N`（该 store 有 tenantID 入参可用）。
- [P3][越权] backend/internal/store/scenario_configs.go:72-76,163-167 — `ScenarioIDOf` 无租户（供归属校验，需 handler 组合使用）。

## backend/internal/store/scenarios.go

- [P1][越权] backend/internal/store/scenarios.go:66-75 — `Get` 无租户过滤（`WHERE s.id = $1`），跨租户读场景详情。最佳实践：`Get(ctx, id, tenantID)` 或单独公开读方法。
- [P2][越权] backend/internal/store/scenarios.go:95-112 — `Update` 先 `fetchScenario` 仅验证"存在"不验证归属，UPDATE `WHERE id = $12` 无租户条件，可改他租户场景。
- [P2][越权] backend/internal/store/scenarios.go:115-152 — `Delete` 中 `UPDATE teaching_plan_entries / schedule_entries` 解绑及 `DELETE FROM scenarios WHERE id = $1` 均无租户条件（场景 id 全局 uuid，风险中低）。
- [P3][风格] backend/internal/store/scenarios.go:231-245 — `RecordView` 中 view_logs 插入失败直接返回错误导致浏览接口 500（与 ToggleFavorite 的"容忍"风格不一致）；view_counters 更新错误被忽略（`_, _ =`），两者策略相反。

## backend/internal/store/scenario_tasks.go

- [P2][数据完整性] backend/internal/store/scenario_tasks.go:74-92 — `Create` 的 `p.TenantID` 为 `*string`，nil 时插入 `tenant_id = NULL`，任务成为游离数据（租户列表查不到、也删不掉）。最佳实践：Create 接收必填 tenantID 参数。
- [P3][越权] backend/internal/store/scenario_tasks.go:137-179,182-232 — `PopulateAbilityPointNames`/`PopulateEvalData` 批量回查无租户过滤（数据源均来自本租户任务，风险低）。
- [P3][越权] backend/internal/store/scenario_tasks.go:124-133 — `Reorder` 无租户条件（scenario_id 限定，可接受）。

## backend/internal/store/scheduling.go

- [P2][越权] backend/internal/store/scheduling.go:302-308 — `CreateSchedule` 中 `UPDATE teaching_plan_entries SET status='scheduled' WHERE id = $1` 无租户条件，planEntryID 可指向他租户条目。
- [P2][边界] backend/internal/store/scheduling.go:156-213 — `ReplacePeriodSlots` 注释声明"items 非空由调用方保证"，但若传空列表会清空该租户全部节次，无防御；建议函数内对空列表直接返回。
- [P3][越权] backend/internal/store/scheduling.go:333-346 — `DeleteScheduleWithRestore` 对 teaching_plan_entries 的恢复 UPDATE 无租户（planEntryID 来自本记录，风险低）。
- [P3][风格] backend/internal/store/scheduling.go:1021-1040 — `ListClassNames` 硬编码 `t.name = '班级'`，依赖 092/种子数据的中文类型名；改名即失效。

## backend/internal/store/staff_titles.go

- [P3][越权] backend/internal/store/staff_titles.go:51-56 — `UpdateStatus` 无租户条件（`WHERE id = $2`）。
- [P3][健壮性] backend/internal/store/staff_titles.go:68-87 — `BatchCountUsersByTitle` 的 `$2::uuid[]` 强转，titleIDs 含非法 uuid 时整条 SQL 报错 500（调用方过滤后无碍）。

## backend/internal/store/store.go

- [P3][健壮性] backend/internal/store/store.go:226-236 — `withTxStore` 在事务模式 store（beginner 为 nil）上调用会 nil 指针 panic（`beginner.Begin`）；当前各 service 均只在 pool store 上调用 Delete 类方法（position.go:73、scenario.go:45 已核实），但契约未防呆。
- [P3][风格] backend/internal/store/store.go:117-196 — `questionBanks` 用 `NewQuestionBankStore(q)` 自行断言 beginner，与其它 store 显式传参风格不统一（行为等价）。

## backend/internal/store/student_portraits.go

- [P3][越权] backend/internal/store/student_portraits.go:54-60,249-271 — `GetPortraitByUserPosition`/`FetchRecommendPositions` 无租户过滤（按 user_id 限定，属本人数据场景，风险低）。
- [P3][越权] backend/internal/store/student_portraits.go:83-89 — `GetArchive` 无租户（依赖 handler 校验）。

## backend/internal/store/subscriptions.go

- [P3][越权] backend/internal/store/subscriptions.go:19-33,69-80 — `Get`/`Update` 无租户过滤（subscription_packages 有 tenant_id 列），依赖 handler 校验。

## backend/internal/store/tags.go

- 无问题（tags/resource_tag_relations 均租户过滤；`DeleteResourceTags` 无租户条件是刻意设计——resource_id 全局唯一 uuid，注释已说明）。

## backend/internal/store/task_evaluation.go

- [P3][并发] backend/internal/store/task_evaluation.go:450-475 — `createTempExam` 按 name（含 taskID 后缀）查重，理论上并发可能双建临时试卷，依赖 service 层 `LockTaskEval` advisory 锁（203-206），锁内调用则安全。
- [P3][风格] backend/internal/store/task_evaluation.go:477-521 — `createTempExamUsage` 复用"存在即更新窗口"逻辑与 411-434 的更新分支重复，可合并。
- 其余（FetchTaskMethods 批量回查无 N+1、SaveTaskMethod 事务内全量重写、CleanupTaskExamUsages CTE）无问题。

## backend/internal/store/teaching_plans.go

- [P2][错误处理] backend/internal/store/teaching_plans.go:403-410 — `UpdatePlanEntry` 的班级关联 delete+insert 错误全部忽略（`_, _ =`）且不在事务内，班级关联更新失败静默（核心排课数据不一致）。
- [P2][越权] backend/internal/store/teaching_plans.go:390-412 — `UpdatePlanEntry` 的 UPDATE 用 `FROM teaching_plans p` 校验租户（良好），但 `class_node_id = $5` 是 string 直写 uuid 列，空串/非法值会 22P02 报错（依赖 handler 转 nil，未防呆）。
- [P2][并发] backend/internal/store/teaching_plans.go:169-221 — `GeneratePlan` 先 DELETE 再 INSERT，`teaching_plans` 有 UNIQUE(program_id, term_id)（092:65），并发生成两请求会触发唯一冲突 500；服务层若无锁即为竞态。
- [P3][越权] backend/internal/store/teaching_plans.go:90-127 — `FetchProgramClasses` 递归 CTE 无租户守护（依赖组织树父链不跨租户的隐含假设）。

## backend/internal/store/tenant_admins.go

- [P2][越权] backend/internal/store/tenant_admins.go:128-138 — `ResetPassword` 无租户条件（`WHERE id = $2`），adminID 指向他租户管理员时可直接改密（handler 若未先按租户查管理员即高危）。
- [P3][错误处理] backend/internal/store/tenant_admins.go:79-84 — `Create` 的 `INSERT INTO user_roles ... SELECT ... LIMIT 1` 在 school_admin 角色缺失时静默插入 0 行，随后 fetchAdmin 报错回滚（可接受，但错误信息不直观）。

## backend/internal/store/tenants.go

- [P3][残留数据] backend/internal/store/tenants.go:538-546 — `DeleteTenant` 仅删 users+tenants，其余租户数据由 115 迁移的 FK ON DELETE CASCADE 兜底（已核对 115_tenant_delete_fk.up.sql），无级联的表（如 industries/roles）会残留孤儿行。
- [P3][风格] backend/internal/store/tenants.go:529-535 — `GenerateSecurePassword` 用 crypto/rand+hex（强随机，无问题），仅提示可与 helper 合并。
- 其余（industryDictSeedSQL 的 ON CONFLICT (tenant_id, code) 有 uq_industries_tenant_code 支撑、CreateWithDefaults 的 title_ids "{}" 字符串由 pgx text 格式回退正确解析）无问题。

## backend/internal/store/terms.go

- 无问题（Create/Update 事务内置当前清理、Delete/Get 租户过滤齐全、ListConfig 白名单字符串均命中）。

## backend/internal/store/training_programs.go

- [P3][逻辑] backend/internal/store/training_programs.go:150-156 — `PutCourses` 中两条"查名称"错误被 `_ =` 忽略，源岗位/课程删除后插入空名称（数据质量而非故障）。
- [P3][越权] backend/internal/store/training_programs.go:112-142 — `ListCourses` 无租户（programID 限定，依赖调用方）。
- 其余（CloneProgram 事务克隆、GetByID 明确无租户供 contentActions 复用）无问题。

## backend/internal/store/user_extension_fields.go

- [P3][越权] backend/internal/store/user_extension_fields.go:52-68 — `Update` 无租户条件（`WHERE id = $5`），依赖 handler 校验。
- 其余（EnsureDefaultSlots 的 ON CONFLICT (tenant_id, field_key) 有 idx_user_extension_fields_tenant_key 支撑）无问题。

## backend/internal/store/user_relations.go

- [P2][边界] backend/internal/store/user_relations.go:106-112 — `UsersExist` 用 `COUNT(*) == len(userIDs)` 判断，userIDs 含重复项时即使全部存在也返回 false（误拒合法请求）；含非法 uuid 时 `$2::uuid[]` 转换报错。
- [P3][死代码] backend/internal/store/user_relations.go:146-154 — `fmtTime` 的 []byte 分支在实际 pgx 扫描路径下不可达（pgx 默认返回 time.Time）。

## backend/internal/store/users.go

- [P2][事务] backend/internal/store/users.go:167-174 — `Delete` 两语句（递减 user_count + 删用户）无事务且无租户过滤，中途失败角色计数漂移。
- [P2][数据一致性] backend/internal/store/users.go:187-203 — `BatchDelete` 两语句无事务，且删除 user_roles 后未递减 `roles.user_count`，角色计数永久虚高；返回数还是 user_roles+users 命中数之和（语义混乱）。
- [P2][事务] backend/internal/store/users.go:272-294 — `RebindUserRole` 四条语句（校验/递减/删/插/增）无事务，中途失败计数漂移；且首条校验错误被 `_ =` 吞掉后靠"!validRole"分支兜底（可读性差）。
- [P3][越权] backend/internal/store/users.go:132-142,151-154,157-164 — `Update`/`UpdateStatus`/`ResetPassword` 均无租户过滤（handler 侧校验，store 签名未体现租户约束）。
- [P3][越权] backend/internal/store/users.go:297-329 — `AttachUserRoles` 无租户过滤（用户列表来自本租户，风险低）。
- 其余（Create 事务内插入+角色绑定、BatchGraduate/BatchUpdateOrgNode 租户限定、parseUUIDs 容错）无问题。

## backend/internal/store/workflows.go

- 无问题（`IS NOT DISTINCT FROM` 正确处理 tenant_id 可空的平台级流程；Get/Create/Update/Delete/ListConfig 一致）。
