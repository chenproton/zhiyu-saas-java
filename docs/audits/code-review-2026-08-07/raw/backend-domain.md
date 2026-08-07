# 代码审查：backend/internal/domain/ 全量逐行审查

- 审查日期：2026-08-07
- 审查方式：16 个 .go 文件完整逐行通读 + 对照 backend/migrations/ 表结构（001_baseline 及 091~138 增量）+ 抽查 store/service/handler 使用点
- 严重级说明：P0（必 500/nil 解引用）| P1（逻辑/序列化/数据丢失）| P2（字段列不对齐/类型错误/枚举冲突）| P3（死代码/命名/注释）

---

## backend/internal/domain/affairs_batch.go

- [P3][类型一致性] affairs_batch.go:13 — `Status string` 未使用 `BatchStatus` 类型，而 JobBatch（job.go:125）、SceneBatch（scene.go:178）、LessonBatch（lesson.go:107）、EvaluationBatch（evaluation.go:425）均已使用语义化批次状态类型；最佳实践：改为 `Status BatchStatus` 与其他批次模型统一。
- 其余字段（id/name/code/org_node_id/major_id/workflow_id/status/program_count/published_count/pending_count/created_at/updated_at）与 106_affairs_batches.up.sql 完全对齐。

## backend/internal/domain/affairs.go

- [P3][命名一致性] affairs.go:124 — `PeriodSlot.Type` json tag 为 `"type"`，但 DB 列名为 `slot_type`（134_period_slot_type.up.sql 新增）。store 层扫描 `slot_type → Type`（scheduling.go:105/119/135 等）、json 输出 `"type"`，后端链路内部一致，前端也未见消费该字段（仅 name/sortOrder），故仅为命名不一致；最佳实践：字段改名为 `SlotType`（json 可保持 `type`）或 DB 别名对齐。
- [P3][过时注释] affairs.go:58 — `TeachingPlan` 状态注释 `draft/pending/approved/rejected/published/archived`，而 092_affairs.up.sql 中 `teaching_plans.status` 注释为 `draft/confirmed`、默认值 `'draft'`；实际代码按内容生命周期流转（teaching_plan_handler.go:381-404 使用 StatusPending/StatusPublished/StatusArchived），092 迁移注释已过时。
- Term/TrainingProgram/TrainingProgramCourse/TeachingPlan/TeachingPlanEntry/Venue/ScheduleEntry/ScheduleConflict 其余字段与 092、097（course_id）、101（entry_classes）、102（position_id）、107（class_node_ids）、116（FK）、138（batch_id/collaborators/created_by/updated_at）迁移对齐；computed 字段（majorName/batchName/entryCount/collaboratorNames 等）在 store 查询（query.go:266-267）均有 JOIN 兜底。

## backend/internal/domain/alliance.go

- 无问题。所有结构体字段（AllianceSchoolInfo/Enterprise/EnterpriseAgreement/Project/Milestone/Achievement/Expert/Agreement/Permission/Dictionary/Brand）与 101_alliance_brand、103_alliance_enrich（student_id/enterprise_id/position_id/major_id/teacher_id/expert_id/citation_reason/images/owner_persons/co_builders/cover_image/partner_source/position_direction）、107_alliance_relations（organization/created_by）、109_alliance_agreement_project_ids（project_ids）迁移逐列对齐；json.RawMessage 字段对应 JSONB 列，pgx JSON codec 可直扫。

## backend/internal/domain/certification_model.go

- [P3][类型弱化] certification_model.go:29 — `CertificationModelPoint.LevelMapping` 类型为 `JSONSlice`（元素可为任意类型），而本文件已有 `LevelMapping` 结构体（{level,min,max}），两者无类型联动；最佳实践：声明为 `[]LevelMapping` 以获编译期校验（service 层有 validateLevelMapping 校验，domain 层类型化可前置拦截）。
- Level 取值注释（understand/comprehend/master/proficient/expert）与 job_ability_aggregator.go:434-444 的 masteryLevels 及 needScoreByLevel 一致。

## backend/internal/domain/community.go

- [P3][字段缺失] community.go:6-20 — `CommunityTopic` 缺 `updated_at` 字段（127_community.up.sql 表中有 updated_at 列）；若前端需要按更新时间排序/展示无法直接获得（现仅 createdAt）。其余字段与 127 迁移对齐，ViewCount 由 view_counters（store/community.go:108）兜底。

## backend/internal/domain/evaluation.go

- [P2][NULL 扫描风险] evaluation.go:91 — `Exam.Version string` 直接扫描 DB 列 `exams.version`（001_baseline:427 定义，**无 NOT NULL**）；同一查询中 description 已用 `*string` + 判空处理（store/exams.go:208-212），version 却没有——任何 NULL version 行将导致 fetchExam/ScanExamRows 扫描报错（列表/详情 500）；最佳实践：domain 改 `*string` 或 SQL `COALESCE(e.version, '')`。
- [P2][NULL 扫描风险] evaluation.go:22 — `QuestionBank.Version string` 直扫可空列 `question_banks.version`（001_baseline:848 无 NOT NULL）；同文件 `Description string`（evaluation.go:12）也直扫可空列 `description`（store/question_banks.go:241 直接 &b.Description），NULL 行会导致 fetchBank/列表扫描报错；最佳实践：改为 `*string` + 判空（参照 Exam.Description 的处理方式）。
- [P3][租户 ID 暴露不一致] evaluation.go:322 — `GraduationProjectTopic.TenantID` 以 `json:"tenantId,omitempty"` 暴露，而 Exam/ExamUsage/ExamResult/SceneEvaluationResult/NodeEvaluationResult 均以 `json:"-"` 隐藏租户 ID；最佳实践：统一隐藏或统一暴露。
- [P3][类型不一致] evaluation.go:236 — `JobAbilityResult.EvaluatedAt string`，而 store 层 JobAbilityResultRow.EvaluatedAt 为 `time.Time`（store/job_ability_results.go:93），依赖 service 转换处格式化；string 类型丢失时间语义，建议统一 time.Time。
- 其余字段与 001_baseline、091（certification_weights 未用）、113（exam_questions 唯一）、114（cert_issuance 唯一）、121（exam→homework 归一，task_evaluation_methods 层面）、123（task_eval_score_rules → TaskScoreRule）、124（certification_point_levels 未映射 domain，可接受）、129（student_honors 未映射，可接受）、132（grading_status/grading_scores/grading_comment/grader_id/graded_at）、133（activation_mode）迁移对齐；computed 字段（MajorName）经 JOIN 兜底（store/exam_results.go:32）。

## backend/internal/domain/job.go

- [P3][租户 ID 暴露不一致] job.go:25 — `CareerPosition.TenantID` 以 `json:"tenantId,omitempty"` 暴露，与 Course/Exam 等模型 `json:"-"` 隐藏策略不一致（与 GraduationProjectTopic 同类问题）。
- 其余字段与 001_baseline（career_positions/ability_points/position_ability_bindings/position_certificates/position_responsibilities/position_recommendations/learn_roads/banner_configs/certificate_library）、120/125/126（ability_cognition_score/position_competency_v2 未映射 domain，属新增列未消费，可接受）、130（drop category，domain 无该字段）对齐；computed 字段（majorNames/createdByName/collaboratorNames/favoriteCount/viewCount/abilityCount）均有 JOIN 兜底（store/positions.go:30-32）。PositionType（enterprise/teaching）、AbilityPointSource（public/custom）常量与 store 使用一致。

## backend/internal/domain/lesson.go

- [P2][枚举/DB 默认值错位] lesson.go:107 — `LessonBatch.Status LessonBatchStatus`（= ContentStatus，取值 open/closed，status.go:29/40-41），但 001_baseline:601 `lesson_batches.status` **默认值为 `'active'`**；正常路径经 BatchHandler 显式写入 status（batch_configs.go:96 CreateWithStatus: true）不受影响，但任何绕过 handler 的插入（种子/脚本/兼容代码）会得到 `'active'`，与 open/closed 两态语义冲突；最佳实践：新增迁移把默认值改为 `'open'`（或确认 'active' 已无数据后回填）。
- [P3][类型不一致] lesson.go:108 — `LessonBatch.CourseCount *int`，而 JobBatch.PositionCount/SceneBatch.ScenarioCount/AffairsBatch.ProgramCount 均为 `int`；课程批次计数也是 `course_count INTEGER NOT NULL DEFAULT 0`，指针类型无必要且不一致；最佳实践：改为 `int`。
- [P3][死字段] lesson.go:129-138 — `NodeResource.Description` 为死字段：resource_bindings.go:267-281 的资源查询仅取 resource_library 列（无 description 列），而 node_resources 表（001_baseline:701-710）本身也无 description/uploaded_by/uploaded_at 列（UploadedAt/UploadedBy 由 resource_library.created_at/uploaded_by 回填，Description 永不赋值）；最佳实践：删除或按 node_resources 实际列建模。
- 其余字段与 001_baseline、093（courses.eval_data）、095（courses.ability_point_ids）、097（knowledge_points.source_type/source_id）、098（node_homeworks 补齐）对齐；Course.ViewCount 经 view_counters 兜底（store/courses.go:256）。

## backend/internal/domain/library.go

- 无问题。ResourceType 常量与 001_baseline:27-39 `resource_type` 枚举完全一致（document/spreadsheet/image/link/audio/video/archive/venue/facility/software/other）；ResourceLibraryItem/OnSiteQuestionLibraryItem 与 resource_library、on_site_question_library 表逐列对齐。

## backend/internal/domain/models.go

- [P2][枚举错位] models.go:85 — `InstitutionStatus = ContentStatus`（status.go:24），但 DB `institution_status` 枚举值只有 `pending/approved/disabled`（001_baseline:4-8）：ContentStatus 中的 draft/rejected/published/archived/open/closed 等值若写入该列会被 DB 拒绝，且 'disabled' 无对应 domain 常量；最佳实践：为 InstitutionStatus 定义独立枚举常量（含 disabled）或至少补充 `InstitutionStatusDisabled = "disabled"`。
- [P3][字段缺失] models.go:73-92 — `Institution` 无 tenant_id 映射字段（DB institutions 有 tenant_id 列）；若查询需要 SELECT tenant_id 只能靠 store 额外变量承接，模型不完整。
- User/Institution 其余字段与 001_baseline:525-544（institutions）、1289-1314（users）对齐；业务角色常量（RolePlatformAdmin 等）与 OperatorTenantID 与 seed/路由使用一致。

## backend/internal/domain/portal.go

- 无问题。全部为工作台 DTO（WorkspaceDashboard 及各子结构），无直接 DB 列映射，json tag 齐全。

## backend/internal/domain/scene.go

- [P2][NULL 扫描风险] scene.go:16 / scene.go:43 — `Scenario.Difficulty int`、`ScenarioTask.Difficulty int` 直扫 DB 可空列（001_baseline:1010/980 `difficulty smallint` 无 NOT NULL，且 CHECK(1-5) 对 NULL 放行）；存量 NULL 行会导致列表/详情扫描报错。另外 Create 路径 handler 绑定的 int 若前端不传为 0，会触发 CHECK 拒绝→500（scenario_handler.go:184 直传，update 路径有保留逻辑 :232-234）；最佳实践：domain 改 `*int`（表达"未设置"）并在 store 侧 COALESCE，或 handler 校验 1-5。
- [P3][租户 ID 暴露不一致] scene.go:24 — `Scenario.TenantID` 以 `json:"tenantId,omitempty"` 暴露，与 Course/Exam 等隐藏策略不一致。
- 其余字段与 001_baseline、100（scene_eval 唯一约束，store 层）、121（method_key 归一，store 层）对齐；industry_ids（varchar(64)[]）与 profession_ids（uuid[]）的 scan/join 均有 text[] cast 兜底（store/scenarios.go:30-31）。

## backend/internal/domain/status.go

- [P3][枚举语义污染] status.go:15-16 — `StatusOpen`/`StatusClosed`（批次状态）并入 `ContentStatus` 内容状态枚举，使单类型同时承载 draft/published 与 open/closed 两套语义；最佳实践：单独定义 `type BatchStatus string` 常量 open/closed。
- [P3][死常量] status.go:19 — `StatusNotSubmitted` 全库（handler/service/store）无任何引用，属死常量；最佳实践：删除或落实使用。
- 别名体系（InstitutionStatus/CareerPositionStatus/CourseStatus/ScenarioStatus/BatchStatus/LessonBatchStatus/SceneBatchStatus = ContentStatus）及保留旧常量（CareerPositionStatusDraft/BatchStatusOpen 等）与各模块使用点一致，无悬挂引用。

## backend/internal/domain/tag.go

- 无问题。TagItem/ResourceTagRelation 与 137_resource_tags.up.sql 对齐（ResourceCount 为 computed 字段）；TagResourceType* 常量与 tag_handler.go 的资源类型映射及 store 的 AddTagFilter/DeleteResourceTags 使用一致。

## backend/internal/domain/unified.go

- [P3][Scan 行为不一致] unified.go:31 — `JSONMap.Scan` 对未知 src 类型（非 []byte/string）静默 `return nil`（既不置值也不报错），而 StringSlice.Scan（unified.go:55）在同样分支置 `*s = nil`；两处对异常输入行为不一致，排障时易被静默掩盖；最佳实践：统一返回 `fmt.Errorf("unsupported type %T", v)`。
- [P3][类型约定风险] unified.go:36 — `JSONSlice` 无 Value()/Scan() 实现，写 jsonb 列靠 pgx JSON codec 兜底、读 text 列需调用方手动 json.Unmarshal（如 store/questions.go:155-161），对调用方依赖隐式约定；最佳实践：补齐 Scan/Value 或在注释中明确"仅用于 jsonb 列"。
- Tenant/OrgType/Organization/Major/Industry/ResourceCode/SubscriptionPackage/UserExtensionField/StaffTitle/Role/LoginLog/OperationLog/Workflow/ApprovalRecord 与 001_baseline、104（tenants short_name 等）、105（education_level/education_nature）对齐；Workflow.MajorIds 为 jsonb 列（001_baseline:1350），StringSlice 匹配。

---

## 汇总

- 审查文件数：16
- 问题总数：21（P0: 0，P1: 0，P2: 5，P3: 16）

### P2 摘要（重要问题）

1. evaluation.go:91 — `Exam.Version string` 直扫可空列 exams.version，NULL 行导致列表/详情 500；建议 *string 或 COALESCE。
2. evaluation.go:22 — `QuestionBank.Version/Description string` 直扫可空列，NULL 行导致 500；建议 *string + 判空（参照 Exam.Description 处理）。
3. lesson.go:107 — lesson_batches.status DB 默认值 'active'（001_baseline:601）与 open/closed 两态语义错位；建议迁移改默认值。
4. models.go:85 — InstitutionStatus 别名 ContentStatus，与 DB 枚举（pending/approved/disabled）错位，'disabled' 无常量；建议独立枚举。
5. scene.go:16,43 — Scenario/ScenarioTask.Difficulty int 直扫可空列（NULL 行扫描报错）+ Create 时 0 值触发 CHECK(1-5) 拒绝；建议 *int。

### P3 摘要（一般问题）

- affairs_batch.go:13 — Status 未用 BatchStatus 类型（与其余 4 类批次不一致）。
- affairs.go:124 — PeriodSlot.Type 与 DB 列 slot_type 命名不一致；affairs.go:58 — TeachingPlan 状态注释与 092 迁移注释过时。
- certification_model.go:29 — LevelMapping 用 JSONSlice 而非 []LevelMapping 强类型。
- community.go:6 — CommunityTopic 缺 updated_at 字段。
- evaluation.go:322 — GraduationProjectTopic.TenantID 暴露租户 ID（与 json:"-" 策略不一致）；evaluation.go:236 — JobAbilityResult.EvaluatedAt string 与 store time.Time 不一致。
- job.go:25 — CareerPosition.TenantID 暴露租户 ID。
- lesson.go:108 — CourseCount *int 与其余批次 int 计数不一致；lesson.go:129 — NodeResource.Description 死字段。
- models.go:73 — Institution 缺 tenant_id 映射。
- scene.go:24 — Scenario.TenantID 暴露租户 ID。
- status.go:15-16 — open/closed 混入 ContentStatus 枚举；status.go:19 — StatusNotSubmitted 死常量。
- unified.go:31 — JSONMap.Scan 未知类型静默返回与 StringSlice 行为不一致；unified.go:36 — JSONSlice 无 Scan/Value 依赖隐式约定。

### 无问题文件

- alliance.go（字段与 101/103/107/109 迁移全对齐）
- library.go（ResourceType 与 DB 枚举一致）
- portal.go（纯 DTO）
- tag.go（与 137 迁移及使用点一致）
