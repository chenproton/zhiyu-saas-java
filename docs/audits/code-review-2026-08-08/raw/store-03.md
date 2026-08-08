# Store 层复查 2026-08-08（第三轮，文件清单 /tmp/opencode/st2-ac，31 个文件逐行通读）

本轮为复查：回归上轮已修项（positions/scenarios Get 租户、收藏租户校验、migration 139 索引、positions Create/Update 回读走 tx），并查上轮遗漏与新问题。表结构已对照 `backend/migrations/*.sql` 及线上库 `information_schema` 逐一核实；`uuid_col = ANY($1)`（参数为 []string）已用 pgx 实测确认可正常编码，不误报。

**回归确认（均未回归）**：positions Create/Update 回读走 tx（positions.go:147/174）✓；FavoritesListConfig 租户隔离（positions.go:90-104）✓；migration 139 八条反向索引齐全（139_perf_reference_indexes.up.sql，course_resource_bindings 已有 idx_course_resource_bindings_resource 不在此批）✓；positions/scenarios Get 未限定租户但返回 TenantID 供 handler `verifyTenantOwnership` 补偿（position_handler.go:194/295/380、scenario_handler.go:136/215/300）✓。

---

## backend/internal/store/positions.go
- [P0][列引用] 无（本文件无 P0）
- [P2][租户] positions.go:151-175、315-327、179-206 — Update/SaveFull/Delete 的 UPDATE/DELETE 仅 `WHERE id = $N`，无 tenant_id 过滤；由 handler 先 Get+verifyTenantOwnership 补偿（已核实 position_handler.go:194/295/380）。最佳实践：方法签名增加 tenantID 并在 WHERE 带 `AND tenant_id = $N`（参照 scenario_tasks.go:102 的 RowsAffected 防御写法），消除对 handler 时序的隐式依赖。
- [P2][租户] positions.go:480-530 — GetFavorite/ToggleFavorite 仅按 user_id+career_position_id 操作，无岗位租户校验；若他租户用户获知跨租户岗位 ID（如 ID 外泄）可写入收藏，影响其收藏列表。最佳实践：ToggleFavorite 增加 tenantID 参数并在 INSERT 前校验岗位归属（或由 handler 保证）。
- [P2][错误处理] positions.go:447-453、473-476 — PrepareAbilityPoint/PrepareCertificate 第二段 SELECT 的 Scan 错误被 `_ =` 静默丢弃；若 INSERT 真失败（非冲突）且重查也失败，返回的 newID 指向不存在的行，后续 position_ability_bindings 插入将触发 FK 错误（错误归因模糊）。最佳实践：INSERT 后直接 RETURNING id，消除第二次查询（参照 question_banks.go Create 的 RETURNING 模式）；GenerateUniqueEntityCode 失败时的 `GenerateEntityCode` 兜底码同样可能撞唯一键，属容忍范围可保留。
- [P3][风格] positions.go:351 — SaveFull 中 certificateMap 循环的 `_ = name` 冗余空语句，range 可改为只取值 `for _, libID := range certificateMap`。

## backend/internal/store/query.go
- [P2][安全] query.go:372-390 — ExecuteListQuery 对 Table/SelectColumns/OrderBy/TenantColumn/SearchColumns 做白名单校验，但 CountTable（query.go:420-424）不在白名单内（当前仅硬编码配置、无动态来源，安全但缺纵深）。最佳实践：将 CountTable 纳入 allowedListQueryTables 白名单校验，防未来动态化。
- [P3][风格] query.go:114-361 — allowedListQueryTables 含超长 JOIN 串且 SelectColumns 白名单与其重复维护，任一 handler 新增查询串漏登记即 500（已有 TestWhitelistCoversHandlerConfigs 守护）。最佳实践：考虑以 store 层 const 单点声明并生成白名单（本期不强制）。

## backend/internal/store/query_normal_test.go
- 无问题（ListQueryBuilder 参数编号、BatchTableConfig 完整性校验合理）。

## backend/internal/store/query_test.go
- 无问题（白名单注入拦截、ErrMissingTenant、关键串全覆盖测试有效）。

## backend/internal/store/question_banks.go
- [P0][列引用] question_banks.go:102-106 与 141-146 — `INSERT INTO question_bank_knowledge_points (id, tenant_id, question_bank_id, knowledge_point_id)` 引用**不存在的 tenant_id 列**。表结构（001_baseline.up.sql:832 及线上库实测）仅有 id/question_bank_id/knowledge_point_id/created_at 四列，全量迁移均未添加 tenant_id；已用 pgx 实测 INSERT 报 SQLSTATE 42703。**题库 Create/Update 只要携带知识点绑定即 500**，属全量审查遗漏。最佳实践：列清单去掉 tenant_id（绑定表靠 question_bank_id 关联、uuid 全局唯一无需租户列），保留 `ON CONFLICT (question_bank_id, knowledge_point_id) DO NOTHING`；参照 scenario_clone.go cloneSimpleBindings 的模式。
- [P2][租户] question_banks.go:54-63、78-82 — Get/IsDraftPool 未限定租户（GetScoped/fetchBankScoped 已有但 Get 未用）；Create 后回读走无租户 Get（刚创建属本租户，安全）；handler 层需自行校验。最佳实践：Get 改为走 GetScoped 或要求调用方显式传租户。
- [P3][并发] question_banks.go:180-202 — EnsureDraftPool 无 (tenant_id, creator_id, is_draft_pool) 唯一约束，并发首次进入可能创建双草稿池；`GenerateUniqueEntityCode` 失败时兜底码可能与现有 code 冲突。属容忍范围。

## backend/internal/store/questions.go
- [P2][租户] questions.go:42-52、95-110 — Create/BatchCreate 不校验 bank_id 所属租户，可把本租户题目挂到他租户题库名下（数据不泄露但归属错乱）；Update 预查 fetchQuestion 带租户、动态 SET 拼接受控。最佳实践：Create 前用 `SELECT tenant_id FROM question_banks WHERE id=$1` 校验（或 handler 先取题库）。

## backend/internal/store/random_draw_questions.go
- [P2][事务] random_draw_questions.go:63-69 — Delete 中 DeleteResourceTags 与主体 DELETE 分属两次独立语句且无事务，标签清理失败时主体已删/标签残留孤儿。最佳实践：两语句包进 withTxStore（同 resource_library.go:332-338）。
- [P3][错误处理] random_draw_questions.go:26-31 — Get 未把 pgx.ErrNoRows 归一为 ErrNotFound（其余 Get 均有归一），handler 层需区分错误文案。最佳实践：errors.Is(err, pgx.ErrNoRows) → ErrNotFound。

## backend/internal/store/recommends.go
- 无问题（Create/Update/Delete/Get 全部带 tenantID，ListConfig 租户隔离完整）。

## backend/internal/store/resource_bindings.go
- [P2][事务] resource_bindings.go:108-128 — CreateResource 无事务：资源 INSERT 成功后绑定 INSERT 失败即留孤儿资源；且绑定 INSERT 与 afterBind 错误被 `_ =`/`_` 静默丢弃（courses.resource_ids 同步失败不可见）。最佳实践：三动作包进事务并透传错误；afterBind 失败至少 slog 记录。
- [P3][错误处理] resource_bindings.go:167-171 — BindTargetID 直接返回 pgx.ErrNoRows，未归一 ErrNotFound；fetchResource 无租户（resource_id 全局唯一，可接受）。

## backend/internal/store/resource_codes.go
- [P2][租户] resource_codes.go:25-31、48-65、76-88 — Get/Update/Delete 全部无 tenantID 参数（UPDATE/DELETE 仅 WHERE id）；已核实 resource_code_handler.go:54-56 经 crud 框架 GetOwnership/CheckOwnership（crud.go:126/160/219）在调用前校验实体租户，暂不构成越权，但 store 层未表达租户纵深。最佳实践：Update/Delete 增加 tenantID 并 `WHERE id=$N AND tenant_id=$M`。

## backend/internal/store/resource_library.go
- [P2][租户] resource_library.go:283-338 — Get/Update/Delete 无租户过滤（UPDATE/DELETE 仅 WHERE id）；已核实 resource_library_handler.go:167/220/281 在调用前 verifyTenantOwnership 补偿。最佳实践：Update/Delete 增加 tenantID 入 WHERE（列表/统计类方法租户隔离已完整）。
- [P2][事务] resource_library.go:332-338 — Delete 先 DeleteResourceTags 再删主体，无事务；标签清理失败主体仍被删。最佳实践：包进 withTxStore。

## backend/internal/store/roles.go
- [P2][租户] roles.go:22-24 — DictStore UpdateSQL/DeleteSQL（`WHERE id=$4`/`WHERE id=$1`）无租户过滤；已核实 role_handler.go:53-54/92 经 crud CheckOwnership 补偿。最佳实践：UpdateSQL/DeleteSQL 带 tenant_id 条件（DictStore 泛型支持追加列，需同步调整 Args 契约）。
- [P2][校验] roles.go:81-99 — Assign 未校验 userID 是否同租户（handler 可经 UserTenantID 校验，方法已提供）；user_count 计数与 INSERT 同事务，正确。最佳实践：Assign 内直接带 `user 同租户` 校验或保持 handler 校验并注明契约。

## backend/internal/store/scenario_clone.go
- [P2][错误处理] scenario_clone.go:108、205、415 — 批量 clone 循环内 Scan 失败一律 `continue` 静默丢行（源数据局部损坏时克隆产物缺失且无日志），与 466/506 的"跳过未知任务"（业务预期）不同，属真错误被吞。最佳实践：返回错误或至少 slog.Error 记录行号。
- [P2][租户] scenario_clone.go:40-57 — FetchSource 无租户过滤；已核实 service/scenario.go:59 用 src.TenantID 与调用方租户比对（ErrScenarioNotInTenant），补偿成立。最佳实践：FetchSource 增加 tenantID 参数直接 `WHERE id=$1 AND tenant_id=$2`。

## backend/internal/store/scenario_configs.go
- [P2][租户] scenario_configs.go:29-31、117-121 — ScenarioWeightStore.Upsert / ScenarioGradeStore.Upsert 的 UPDATE 分支仅 `WHERE id=$N` 无租户；已核实 scenario_weight_handler.go:66-88 在 upsert 前同时校验 scenario 与新/旧配置归属，补偿成立。最佳实践：UPDATE 分支加 tenant_id 条件。
- [P3][风格] scenario_configs.go:161-162 — 注释"// Delete 删除等级映射"悬挂在无 Delete 方法体上方（ScenarioGradeStore 无 Delete），疑似残留注释。最佳实践：删除该行。

## backend/internal/store/scenarios.go
- [P2][租户] scenarios.go:95-112、115-152 — Update/Delete 仅 WHERE id 无租户；已核实 scenario_handler.go:215/300 先 Get+verifyTenantOwnership 补偿。最佳实践：Update/Delete 增加 tenantID 参数（fetchScenario 已返回 TenantID 可先比对）。
- [P3][性能] scenarios.go:195-196 — fetchScenario 用相关子查询聚合 industry/profession 名称（单行查询无碍），列表已走 LATERAL 批量，无 N+1。无问题。

## backend/internal/store/scenario_tasks.go
- 无问题（Update/Delete 带租户且 RowsAffected 防跨租户回读，scenario_tasks.go:95-121；PopulateAbilityPointNames/PopulateEvalData 用 ANY 批量无 N+1；Reorder 事务内由调用方控制）。

## backend/internal/store/scheduling.go
- [P2][租户] scheduling.go:302-308 — CreateSchedule 内 `UPDATE teaching_plan_entries SET status='scheduled' WHERE id=$1` 无租户/计划归属校验，plan_entry_id 由请求携带时依赖调用方先校验；同理 DeleteScheduleWithRestore:337-343。最佳实践：经 teaching_plans 联表加 `p.tenant_id` 条件（参照 teaching_plans.go:391-397 的 UPDATE...FROM 写法）。
- [P3][错误处理] scheduling.go:31-41、247-266、788-802 — ScanVenueRows/ScanPeriodSlotRows/ScanScheduleEntryListRows 返回 nil 而非 rows.Err()（其余 scan 均返回 rows.Err()），迭代中断错误被吞。最佳实践：统一 `return items, rows.Err()`。

## backend/internal/store/staff_titles.go
- [P2][租户] staff_titles.go:18-20、51-56 — DictStore UpdateSQL/DeleteSQL 与 UpdateStatus 均无租户过滤（UpdateStatus 仅 WHERE id）；handler 层需自行校验（staff_titles 走 crud 框架，同 roles 补偿）。最佳实践：UpdateStatus 增加 tenantID 参数。

## backend/internal/store/store.go
- 无问题（Queryer 抽象、withTxStore 模板、NewWithTx/WithTx 嵌套防护完整）。

## backend/internal/store/student_portraits.go
- [P2][租户] student_portraits.go:83-89 — GetArchive 无租户过滤（CreateArchive 后回读与 handler 查询依赖 handler 校验）；GetPortraitByUserPosition/FetchRecommendPositions 以 userID 为键无租户（userID 来自 Claims，跨租户不可枚举，低危）。最佳实践：GetArchive 增加 tenantID。

## backend/internal/store/subscriptions.go
- [P2][租户] subscriptions.go:19-33、69-80 — Get/Update 仅 WHERE id 无租户；已核实 subscription_handler.go:42 更新仅 canManagePlatform（平台管理员）可调，补偿成立。最佳实践：Update 增加 tenantID 入 WHERE。

## backend/internal/store/tags.go
- 无问题（List/Create/Update/Delete 全带租户，SetResourceTags 事务完整，QueryBindings 批量 ANY 无 N+1，DeleteResourceTags 以全局唯一 resource_id 为键合理）。

## backend/internal/store/task_evaluation.go
- [P2][租户] task_evaluation.go:46-59、77-98 — GetRubricTemplate/UpdateRubricTemplate/DeleteRubricTemplate 均无租户过滤（列表租户隔离完整）；handler 需自行校验。最佳实践：Update/Delete 增加 tenantID 入 WHERE。
- [P3][死代码] task_evaluation.go:361-436 — EnsureExamUsageForMethod 中 `usageID` 分支 UPDATE exam_usages 的 `status = CASE WHEN $4::varchar='always'...` 在 activation_mode 变更时状态不回退（如 always→manual 后仍 published），属既有业务语义（可接受）。无问题。

## backend/internal/store/teaching_plans.go
- [P2][错误处理/事务] teaching_plans.go:403-410 — UpdatePlanEntry 的 teaching_plan_entry_classes 删除与插入错误被 `_ =`/`_` 忽略且不在事务内，中途失败留下旧班级关联或空关联，且与主体 UPDATE 非原子。最佳实践：纳入事务并透传错误。
- [P2][租户] teaching_plans.go:432-437 — MarkConfirmed 仅 WHERE id 无租户（workflow 流转回调，调用方已校验 plan 归属）；GeneratePlan 中 `SELECT name FROM career_positions WHERE id=$1`（training_programs.go:152 同）未带租户（名称回填，低危）。最佳实践：MarkConfirmed 增加 tenantID。

## backend/internal/store/tenant_admins.go
- [P2][租户] tenant_admins.go:128-138 — ResetPassword 仅 WHERE id 无租户；若未来放开非平台管理员调用即越权改密。最佳实践：增加 tenantID 参数。
- [P3][健壮性] tenant_admins.go:79-84、396-401 — user_roles INSERT 经 `SELECT ... WHERE code='school_admin' LIMIT 1`，若租户缺该角色则静默插入 0 行（管理员无角色、user_count 不增），CreateWithDefaults 中角色先建故正常，但 TenantAdminStore.Create 无此保证。最佳实践：校验 RowsAffected，0 行时报错。

## backend/internal/store/tenants.go
- [P2][租户] tenants.go:181-201 — Update/UpdateStatus 仅 WHERE id（平台级接口，超管持有权限，无越权面）；ListConfig TenantColumn="id" 属租户自指查询，正确用法。
- [P3][数据一致性] tenants.go:538-546 — DeleteTenant 仅删 users+tenants，其余表依赖 migration 140 的租户 FK 级联（已核实 140 覆盖 20 张表），未覆盖表若存在将留孤儿。已核实 140 迁移覆盖主流表，无问题。

## backend/internal/store/terms.go
- 无问题（Create/Update 事务内清 is_current、Delete/Get/List 全带租户）。

## backend/internal/store/training_programs.go
- [P2][错误处理] training_programs.go:152-156 — PutCourses 名称回填的两次 `_ = tx.QueryRow(...).Scan(&name)` 忽略查询错误，回填失败时课程名留空静默入库。最佳实践：记录日志或返回错误。
- [P3][风格] training_programs.go:244-261 — CloneProgram 直接复制 src.Code 到新租户（code 唯一约束为 (tenant_id, code)，安全）；无问题。

## backend/internal/store/user_extension_fields.go
- [P2][租户] user_extension_fields.go:40-68 — Get/Update 仅 WHERE id 无租户（返回记录含 TenantID 供 handler 校验，补偿成立）。最佳实践：Update 增加 tenantID。

## backend/internal/store/user_relations.go
- 无问题（List 无租户时 1=0 纵深防御，UsersExist/Create/Delete 全带租户）。

## backend/internal/store/users.go
- [P2][租户] users.go:132-142、151-154、157-164、167-174 — Update/UpdateStatus/ResetPassword/Delete 仅 WHERE id 无租户（login_name 全局唯一约束、handler 预校验构成间接防线）；其中 Update 可跨租户改 login_name（handler 传入 GlobalLoginName 拼租户前缀，篡改他租户用户 login_name 需已知目标 ID）。最佳实践：Update/Delete/ResetPassword 增加 tenantID 入 WHERE。
- [P2][事务] users.go:187-203 — BatchDelete 两条 DELETE 无事务，第二条失败时 user_roles 已删、users 残留（用户仍在但角色消失）；Delete（167-174）角色计数递减错误被忽略且与主删分离。最佳实践：包进 withTxStore。
- [P3][安全] users.go:436-448 — fetchUser 返回 password_hash（auth 登录所需），调用方不得回传前端；建议在方法名/注释中显式警示。
- [P3][错误处理] users.go:450-460 — scanUserRows 返回 nil 而非 rows.Err()。

## backend/internal/store/workflows.go
- 无问题（Get/Update/Delete 用 `tenant_id IS NOT DISTINCT FROM $N` 同时支持平台级 NULL 租户与租户隔离，处理恰当）。

---

## 汇总

- 审查文件数：31（全部逐行通读）
- 问题总数：34（P0=1、P1=0、P2=23、P3=10）
- P0：`question_banks.go:102-106/141-146` — question_bank_knowledge_points 无 tenant_id 列，题库 Create/Update 带知识点绑定必 500（SQLSTATE 42703，迁移与线上库双重实测确认）
- P1：无（本轮未发现确认的 P1；UPDATE/DELETE 缺租户过滤均为 handler 层 `verifyTenantOwnership`/crud `CheckOwnership` 补偿成立，计为 P2 纵深加固项）
- 上轮已修项全部通过回归，无回退。
