# Store 层复查报告（store-01，2026-08-08）

> 本轮为 2026-08-07 全量审查后的**复查**：31 个文件逐一完整逐行通读，表结构对照
> `backend/migrations/*.sql`（baseline + 091~140 增量）逐一核实。重点：已修项回归、
> 上轮遗漏（store 层租户纵深）、新问题。
>
> 原则：简单优先；安全只排高危；容忍 hacker；锁只给核心业务。store 是唯一 SQL 所在层，
> 方法应接受 tenantID 参数。

## backend/internal/store/abilities.go
- [P2][索引] abilities.go:128-204 — CitationStats/ListUncited 的 4 个引用绑定表相关子查询
  （position_ability_bindings / node_ability_point_bindings / task_ability_bindings /
  certification_ability_points 按 ability_point_id 反查）已由 migration 139
  （139_perf_reference_indexes.up.sql）补齐反向索引，**上轮 P2 #1/#2 已修复**，无问题。
- [P3][一致性] abilities.go:134-139 — 子查询未按 tenant 过滤绑定表，但均按全局唯一
  ability_point_id 关联且外层已限 `ap.tenant_id`，实际无泄露，列为一致性说明。

## backend/internal/store/ability_domains.go
- **无问题**（上轮 P1 #1 已修复：Get/Update/Delete/fetchDomain 全部 `tenant_id` 过滤；
  Create 正常；ListConfig TenantScoped）。
- [P3][边界] ability_domains.go:52-64 — Update 允许改 career_position_id 为任意岗位 id，
  未校验目标岗位租户归属（岗位 id uuid 不可猜，风险低）。

## backend/internal/store/alliance_achievement_store.go
- [P3][数据字段] alliance_achievement_store.go:111-146 — GetAchievementByID 扫描了
  `createdBy`（:127）但未执行 `a.CreatedBy = createdBy` 赋值（ScanAchievementRows :44 有赋值），
  单查详情接口缺创建人字段；最佳实践：补齐赋值，与列表扫描保持一致。

## backend/internal/store/alliance_agreement_store.go
- **无问题**（Create/Update/Delete/Get 均 tenant 过滤；start_date/end_date DATE 扫描
  time.Time + formatDate 正确；project_ids 列由 109 迁移补齐）。

## backend/internal/store/alliance_brand_store.go
- **无问题**（全部 CRUD tenant 过滤；103 迁移补齐 student_id/enterprise_id 等 FK 列，
  插入列与表结构一致）。

## backend/internal/store/alliance_dictionary_store.go
- **无问题**（全部 tenant 过滤；Update 仅改 name/sort_order 属设计）。

## backend/internal/store/alliance_enterprise_store.go
- **无问题**（CRUD 全部 tenant 过滤；插入列与 101/103/107 迁移逐列核对一致）。
- [P3][错误处理] alliance_enterprise_store.go:377-385 — GetPublicStats 5 个 COUNT 均忽略
  Scan 错误（:379 等），DB 瞬时故障时静默返回部分统计；最佳实践：至少记录一条错误。

## backend/internal/store/alliance_expert_store.go
- **无问题**（全部 tenant 过滤；101/103/107 迁移列核对一致）。

## backend/internal/store/alliance_permission_store.go
- **无问题**（全部 tenant 过滤）。

## backend/internal/store/alliance_project_store.go
- [P1][SQL/参数] alliance_project_store.go:197-199 — **回归未修复 + 引入新缺陷**：
  DeleteMilestone 的 SQL 含 `$1 AND tenant_id = $2` 两个占位符，但 Exec 只传了 `id`
  一个参数，`tenantID` 形参完全未用。pgx v5 默认 CacheStatement 模式经 eqb.Build 校验
  参数个数，**每次删除里程碑必报参数不匹配错误 → 500**（handler alliance_handler.go:382
  传入 tenantID 也无济于事）；最佳实践：`Exec(ctx, ..., id, tenantID)`。上轮仅补了
  tenant 条件与形参，漏传参数，属"修复引入回归"。

## backend/internal/store/alliance_store.go
- [P1][功能] alliance_store.go:55-73 — **上轮 P1 #3 未修复**：`nilToEmpty`（:71-73）
  仍是空操作 `return s`。UpsertSchoolInfo 新建学校信息（info.ID 为空串）时
  `COALESCE('', gen_random_uuid())` 得到 `''` 而非 NULL，uuid 列必报
  "invalid input syntax for type uuid" 500（handler UpdateSchoolInfo 首次保存必走此路径，
  GetSchoolInfo 无记录时返回的域对象 ID 为空，:60 前端回填后再次提交即触发）；
  最佳实践：改为 `COALESCE(NULLIF($1,''), gen_random_uuid())` 或让 nilToEmpty
  返回 `*string`（空串 → nil）。
- [P2][租户纵深] alliance_store.go:105-118 — ListEnterpriseAgreements 仅按
  `enterprise_id` 过滤（无 tenant 参数），上轮 P2 #3 未改；enterprise_id uuid 全局唯一
  不可猜，实际泄露面小，但方法签名未约束租户，调用方漏校验即越权；最佳实践：补
  tenantID 参数。
- [P2][租户纵深] alliance_store.go:120-126 — ListMilestones 仅按 `project_id` 过滤，
  同上。
- [P2][错误处理] alliance_store.go:78-86 — queryList 吞掉扫描错误（`items, _ := scan(rows)`，
  注释明示"与公开列表原行为一致"），列表静默缺项，上轮 P2 #4 未改；公开列表接口可
  容忍，但已收编的接口复用同一 helper 时同样静默缺项。

## backend/internal/store/approvals.go
- [P2][租户纵深] approvals.go:76-85、129-166 — Get/UpdateHistory/RejectRecord/AdvanceRecord
  均无 tenant 过滤（上轮 P2 #5 未改），依赖调用方先校验 + id uuid 不可猜；UpdateHistory
  CAS 条件 `status = pending` 能防跨状态改写，但跨租户 id 可命中时仍可追加历史；
  最佳实践：方法签名补 tenantID（或至少在 service 层统一 Get 后校验租户）。
- [P2][租户纵深] approvals.go:116-125 — ExistsPending 仅按 target_type+target_id 全局查询，
  可探测他租户同 id 目标的待审状态（信息泄露面极小）。

## backend/internal/store/approvals_test.go
- **无问题**（白名单映射/注入拒绝/未知类型拒绝测试齐全，fakeApprovalTx 只记录不执行）。

## backend/internal/store/auth.go
- [P3][错误处理] auth.go:49-56 — FindUsersByUsername 扫描失败 `continue` 静默跳行，
  任一候选行扫描失败即该用户登录莫名失败且无日志；登录是核心链路，建议返回错误。
- [P3][错误处理] auth.go:163-184/187-216 — GetTenantByID/GetOrganizationByID/GetMajorByID
  吞错返回 nil，调用方无法区分"不存在"与"DB 故障"。
- [P3][错误处理] auth.go:235-243/259-266 — ListUserRoles/ListUserRoleCodes 扫描失败
  continue 静默丢角色，可能漏放权限。

## backend/internal/store/banners.go
- **无问题**（Get/Create/Update/Delete 全部 tenant 过滤；banner_configs 表列核对一致）。

## backend/internal/store/batch_configs.go
- **无问题**（5 类批次表/列与 baseline 106/144/335/595/1035 逐列核对一致；白名单
  allowedBatchSelectColumns 与各 config 的 SelectColumns 一一对应）。

## backend/internal/store/batches.go
- [P2][租户纵深] batches.go:177-238 — CreateFields/UpdateFields/Delete/UpdateStatus 均无
  tenant 过滤（上轮 P2 #7 未改），依赖 handler 先调 TenantOf（:147-154）校验；模板式公共
  入口一旦新调用方遗漏前置校验即跨租户写入/删除；最佳实践：为写方法补 tenantID 参数
  （Create 已收 tenantScoped/tenantID，Update/Delete/UpdateStatus 未收）。
- [P3][一致性] batches.go:40-53 — GetByTable 无 tenant 过滤，同上依赖前置校验。

## backend/internal/store/cert_grades.go
- **无问题**（ListGrades/ListCompRequirements/ListLeaderboard 均按全局主键 positionID/
  gradeIDs 查询，position 归属由 PositionTenantID :19-23 前置校验；last_updated 按
  timestamptz 扫描 time.Time 的注释正确）。

## backend/internal/store/certificate_library.go
- **无问题**（GetByID/Update/Delete 均重写覆盖基类并带 tenant 过滤，上轮 P1 #4 中
  证书库侧已修复；Delete 清理 resource_tags 正确；migration 099 的 updated_at 列在
  Update 中使用一致）。

## backend/internal/store/certifications.go
- [P3][一致性] certifications.go:815-822 — LoadModel 2a 查询无 tenant/状态过滤
  （`WHERE s.career_position_id = $1`），岗位 uuid 全局唯一且场景归属岗位维度，实际无
  泄露，列为一致性（上轮 P2 #12 保留）。
- [P3][错误处理] certifications.go:431 — ListTasksByPointIDs 扫描错误 `err == nil` 才
  append，静默丢行。
- [P3][错误处理] certifications.go:529-539 — ScanCertificationRuleRows 返回 `nil` 而非
  `rows.Err()`，迭代中断时上层误以为正常。
- 说明：PutFullRule/PutWeights/DeleteItem 等子表孤儿问题已由 baseline FK CASCADE
  （certification_ability_items.rule_id / points.item_id / related_tasks.cert_point_id）
  兜底，无问题。

## backend/internal/store/citation_stats.go
- **无问题**（纯扫描/分桶组装，桶序固定）。

## backend/internal/store/community.go
- **无问题**（ListTopics/GetTopic/ListReplies/CreateReply 全部 tenant 过滤；CreateReply
  用 INSERT...SELECT 内联校验主题归属与 parent 同贴，设计良好）。
- [P3][一致性] community.go:176-181 — IncrementTopicReplyCount 无 tenant 过滤
  （topicID uuid 不可猜且 CreateReply 已前置校验主题归属，风险低）。

## backend/internal/store/content_actions.go
- [P2][租户纵深] content_actions.go:94-176 — Transition/Review/Invite 均无 tenantID 参数
  （上轮 P2 #6 未改），公共入口完全依赖调用方前置校验（GetTenantID :65-76 是校验钩子，
  但方法本身不强制）；Invite（:169-172）若调用方漏校验可向任意 id 内容追加协作者；
  最佳实践：给三个方法补 tenantID 参数或要求调用方先 GetTenantID 比对。
- 说明：Transition CAS（:113）防并发双发、撤回审批记录删除（:122-129）带
  target_type+target_id 全局过滤，正确。

## backend/internal/store/content_actions_test.go
- [P3][死代码] content_actions_test.go:10-17 — transitionMatrix 与 content_actions.go:24-31
  的 allowedStatusTransitions 完全重复定义，两处漂移风险；最佳实践：测试直接引用
  生产常量，删除重复矩阵。

## backend/internal/store/course_assessments.go
- [P3][错误处理] course_assessments.go:201-213 — CleanupCourseLevelAssessments 两个
  DELETE 均 `_, _ =` 吞错返回 nil，清理失败时旧测评残留且无感知。
- 说明：CreateTempExam 幂等复用（:119-125）、exam_usages 插入列（activation_mode 由
  133 迁移）与 096/097 表结构核对一致，无问题。

## backend/internal/store/course_clone.go
- [P3][错误处理] course_clone.go:135、162 — cloneCourseBindings 两处扫描失败 `continue`
  静默丢行，克隆结果静默缺失绑定（rows.Err 只覆盖迭代错误）。
- 说明：上轮 P2 #8（跨租户克隆）已在 service 层 lesson_content.go:158-160 校验
  `src.TenantID != tenantID` 拒绝，纵深补齐；node 子表克隆与 baseline FK 核对一致。

## backend/internal/store/course_homeworks.go
- [P2][错误处理] course_homeworks.go:177-188 — scanHomeworkSubmissions 扫描失败
  `continue` 静默丢行（上轮 P2 #9 未改），教师批改列表可能缺项、漏批改；最佳实践：
  返回错误或至少留日志。
- 说明：Submit 幂等 upsert（ON CONFLICT (homework_id, student_id) 与 096/098 唯一索引
  一致）、graded 状态守卫（重交不丢已批改状态）、Grade* 事务 + tenant 过滤 + 唯一索引
  ON CONFLICT 目标（095/097）核对全部正确。

## backend/internal/store/course_nodes.go
- [P3][错误处理] course_nodes.go:383-397 — scanCourseNodeBaseRows 返回 `nil` 而非
  `rows.Err()`。
- 说明：上轮 P2 #10（Delete 不清理节点子表）已由 baseline FK CASCADE（node_quizzes/
  node_homeworks/hybrid_node_modules/两绑定表 → system_course_nodes ON DELETE CASCADE）
  兜底，DB 层自动清理，**不再列为问题**；Get/Create/Update 全部 tenant 过滤。

## backend/internal/store/courses.go
- [P2][数据残留] courses.go:133-161 — Delete 未清理课程级 exam_usages（target_type=
  'course' 且 target_ids 含该课程，exam_usages 无课程 FK，116 迁移仅级联 exam 删除）
  与 knowledge_points.granular_lesson_ids 反向引用，删除课程后残留"幽灵考试安排"与
  失效颗粒课引用（上轮 P2 #11 部分修复——submissions/homeworks/eval_results/排课/方案
  已清理，此两项遗漏）；最佳实践：事务内补 `DELETE FROM exam_usages WHERE
  target_type='course' AND courseID = ANY(target_ids)`（可复用 CleanupCourseLevelAssessments
  语义）与 granular_lesson_ids array_remove。
- [P3][事务] courses.go:164-190 — ReplaceCourseBindings 删除+批量插入无事务，中途失败
  残留半状态（普通编辑路径可容忍，列为一致性）。

## backend/internal/store/dict_store.go
- [P2][租户纵深] dict_store.go:56-85 — 基类 GetByID/Update/Delete 无租户过滤参数
  （上轮 P1 #4 核心缺陷）：证书库嵌入方已全量覆盖（certificate_library.go:59-91 正确），
  但基类契约不强制 tenant，其余嵌入方（majors/staff_titles/industries 等，见 store-02）
  仅依赖各自配置 SQL 自带过滤，新增嵌入方时极易漏过滤；最佳实践：基类方法签名增加
  tenantID 并注入 SQL（或要求配置 SQL 必带 tenant 条件并加单测断言）。

## backend/internal/store/entity_code.go
- **无问题**（表名白名单 + tenant 过滤唯一性检查 + 10 次重试；白名单含本批次全部
  GenerateUniqueEntityCode 调用表）。

## P0
无。全部 SQL 引用的列/表经 baseline + 091~140 迁移逐条核实存在，插入列与表结构一致。

## P1 摘要
1. alliance_project_store.go:197-199 — DeleteMilestone SQL 占位 $2 但只传 1 参数，
  每次删除里程碑必 500（修复引入回归，形参 tenantID 未使用）。
2. alliance_store.go:55-73 — nilToEmpty 仍为空操作，UpsertSchoolInfo 新建（空 ID）必
  500，上轮 P1 未修复。

## P2 摘要
1. alliance_store.go:105-126 — ListEnterpriseAgreements/ListMilestones 无租户参数（父 id 维度）。
2. alliance_store.go:78-86 — queryList 吞扫描错误，列表静默缺项。
3. approvals.go:76-166 — Get/UpdateHistory/RejectRecord/AdvanceRecord/ExistsPending 无租户过滤。
4. content_actions.go:94-176 — Transition/Review/Invite 无 tenantID 参数，依赖调用方校验。
5. batches.go:177-238 — CreateFields/UpdateFields/Delete/UpdateStatus 无租户过滤（依赖 TenantOf 前置）。
6. dict_store.go:56-85 — 基类 GetByID/Update/Delete 无租户契约，嵌入方遗漏风险。
7. course_homeworks.go:177-188 — 提交列表扫描失败静默丢行。
8. courses.go:133-161 — Delete 遗留课程级 exam_usages 与 granular_lesson_ids 反向引用。

## P3 摘要（14 条，详见各文件）
字段缺失（achievement CreatedBy）、吞错（GetPublicStats/auth 系列/cleanup/scan 系列）、
死代码（transitionMatrix 重复）、一致性说明（LoadModel 2a、IncrementTopicReplyCount、
Update 改岗位归属、ReplaceCourseBindings 无事务、批量扫描 rows.Err 缺失）。

## 统计
审查文件 31 个，问题 25 条：P0 0 条、P1 2 条、P2 8 条、P3 15 条。
无问题文件 14 个（ability_domains / alliance_agreement / alliance_brand /
alliance_dictionary / alliance_enterprise（1 条 P3 除外）/ alliance_expert /
alliance_permission / approvals_test / banners / batch_configs / cert_grades /
certificate_library / citation_stats / entity_code）。
已修复确认：ability_domains 租户过滤、abilities 引用索引（139）、证书库覆盖基类、
course_clone 服务层租户校验、课程删除子表清理（FK CASCADE + 显式清理）。
