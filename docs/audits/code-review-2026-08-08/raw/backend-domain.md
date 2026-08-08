# 代码复查：backend/internal/domain/ 全量逐行复查（2026-08-08）

- 复查方式：16 个 .go 文件完整逐行通读 + 对照 backend/migrations/（001_baseline 及 091~140 增量）逐列核实 + 抽查 store/service/handler 使用点
- 复查重点：上轮（2026-08-07）问题是否已修、修复引入的回归、新遗漏
- 上轮结论回查：**domain 目录自 2026-08-07 审查后仅有一次提交 `1f0d9f98`（新增 `Exam.QuestionCount` 字段，已正确对齐列表查询），其余文件零变更；上轮 5 条 P2 + 16 条 P3 全部未修复**。P0 修复（`6854c8ff`）均在 store/handler/migrate 层，已核实未引入 domain 层回归。
- 严重级说明：P0（必 500/nil 解引用）| P1（逻辑/序列化/数据丢失，用户可达）| P2（字段列不对齐/可空列直扫/枚举冲突，潜在风险）| P3（死代码/风格）

---

## backend/internal/domain/evaluation.go

- [P1][NULL 直扫·上轮P2升级] evaluation.go:12 + store/question_banks.go:248,282,303 — `QuestionBank.Description string` 直扫可空列 `question_banks.description`（001_baseline:841 无 NOT NULL）。上轮仅判潜在风险，本轮核实**存在确定性的 NULL 落库路径**：question_bank_import_handler.go:120 `nullableStr`（import_common.go:217）空单元格返回 nil → :192-197 INSERT 落 NULL；overwrite 更新路径 :163 同理。NULL 后 fetchBank/ScanQuestionBankRows 扫描 `&b.Description` 必报 "cannot scan NULL into *string" → 该租户题库列表/详情接口 500；最佳实践：改为 `*string` + 判空（同文件 Exam.Description 已有成熟范式 exams.go:206,226-228 可参照），或 SQL COALESCE。
- [P2][NULL 直扫·未修复] evaluation.go:92 + store/exams.go:221,283 — `Exam.Version string` 直扫可空列 `exams.version`（001_baseline:427 无 NOT NULL）。应用侧全部 INSERT 路径（exams.go:55、course_assessments.go:135、task_evaluation.go:469）均显式写 'v1.0'，当前风险仅限存量/外部 NULL 行；最佳实践：domain 改 `*string` 或 SQL `COALESCE(e.version, '')`（description 已按此处理，version 漏）。
- [P2][NULL 直扫·未修复] evaluation.go:22 + store/question_banks.go:248,282,303 — `QuestionBank.Version string` 直扫可空列 `question_banks.version`（001_baseline:848 无 NOT NULL），与 Description 同源同修。
- [P3][死字段·修复残留-新发现] evaluation.go:128 + store/exam_results.go:258 — `ExamResult.Grade string` 与 `UserProfile.Grade` 自 2026-08-08 P0 修复（6854c8ff）删除 `u.grade` 引用后**恒为空字符串**（exam_results.grade 列可空且永不被填充）；交卷结果年级字段名存实亡。最佳实践：确认年级数据源（exams 或 users.graduate_year 换算），否则删除 Grade 字段或从 users 真实列回填。
- [P3][NULL 直扫·未修复] evaluation.go:128 + store/exam_results.go:63 — `ExamResult.StudentName/ClassName/Grade string` 直扫可空列（001_baseline:388-390 均无 NOT NULL）。SaveResult 插入路径恒写 ''（COALESCE 兜底），风险低；最佳实践：与 exam_results 其余可空字段一致用 *string。
- [P3][类型不一致·未修复] evaluation.go:237 — `JobAbilityResult.EvaluatedAt string`，store 层 JobAbilityResultRow.EvaluatedAt 为 time.Time（store/job_ability_results.go:93），依赖 service 格式化；最佳实践：domain 统一 time.Time。
- [P3][租户 ID 暴露不一致·未修复] evaluation.go:323 — `GraduationProjectTopic.TenantID` 以 `json:"tenantId,omitempty"` 暴露，与 Exam/ExamUsage/ExamResult 等 `json:"-"` 隐藏策略不一致；最佳实践：统一隐藏。
- [P3][json tag 一致性·新发现] evaluation.go:86 — 新增 `QuestionCount int json:"questionCount,omitempty"` 与 QuestionBank.QuestionCount（evaluation.go:15 `json:"questionCount"` 无 omitempty）风格不一致；fetchExam 详情路径不填充该字段恒为 0（前端有 `?? questions.length` 兜底，无功能影响）；最佳实践：去掉 omitempty 或详情路径补填。

## backend/internal/domain/affairs.go

- [P3][命名不一致·未修复] affairs.go:124 — `PeriodSlot.Type` json tag `"type"` 与 DB 列 `slot_type`（134_period_slot_type.up.sql）命名不一致；store 扫描 slot_type→Type、输出 "type"，链路内部一致，前端未消费该字段；最佳实践：字段改名 `SlotType`（json 可保持 `type`）。
- [P3][过时注释·未修复] affairs.go:58 — `TeachingPlan` 状态注释 `draft/pending/approved/rejected/published/archived`，092 迁移实际为 `draft/confirmed`；最佳实践：按代码实际流转（pending/published/archived）更正注释。
- 其余字段（Term/TrainingProgram/TrainingProgramCourse/TeachingPlan/TeachingPlanEntry/Venue/ScheduleEntry/ScheduleConflict）与 092、097、101、102、107、116、138 迁移逐列对齐；computed 字段均有 JOIN 兜底（store/query.go:266-267）；ScheduleEntry.ClassNodeID 直扫 NOT NULL 列（092:123）无 NULL 风险。

## backend/internal/domain/affairs_batch.go

- [P3][类型不一致·未修复] affairs_batch.go:13 — `Status string` 未使用 `BatchStatus` 类型，与 JobBatch/SceneBatch/LessonBatch/EvaluationBatch（均 status.go:22-31 语义化类型）不一致；最佳实践：改为 `Status BatchStatus`。
- 其余字段与 106_affairs_batches.up.sql 逐列对齐。

## backend/internal/domain/alliance.go

- 无问题。AllianceSchoolInfo/Enterprise/EnterpriseAgreement/Project/Milestone/Achievement/Expert/Agreement/Permission/Dictionary/Brand 与 101、103（student_id/enterprise_id/position_id/major_id/teacher_id/expert_id/citation_reason/images/owner_persons/co_builders/cover_image/partner_source/position_direction）、107（organization/created_by）、109（project_ids）迁移逐列对齐；json.RawMessage 对应 JSONB 列 pgx 可直扫。

## backend/internal/domain/certification_model.go

- [P3][类型弱化·未修复] certification_model.go:29 — `CertificationModelPoint.LevelMapping` 为 `JSONSlice`，本文件已有 `LevelMapping` 结构体（{level,min,max}），类型无联动；最佳实践：声明为 `[]LevelMapping` 获得编译期校验。
- Level 注释（understand/comprehend/master/proficient/expert）与 job_ability_aggregator.go masteryLevels 一致。

## backend/internal/domain/community.go

- [P3][字段缺失·未修复] community.go:6-20 — `CommunityTopic` 缺 `updated_at` 字段（127_community.up.sql:11 表中有 updated_at 列）；需按更新时间排序/展示时无法直接获得；最佳实践：补充 `UpdatedAt time.Time`。
- 其余字段与 127 迁移对齐。

## backend/internal/domain/job.go

- [P3][租户 ID 暴露不一致·未修复] job.go:25 — `CareerPosition.TenantID` 以 `json:"tenantId,omitempty"` 暴露，与 Course/Exam 等 `json:"-"` 隐藏策略不一致；最佳实践：统一隐藏。
- 其余字段与 001_baseline、120/125/126、130 迁移对齐；PositionType/AbilityPointSource 常量与 store 使用一致；computed 字段 JOIN 兜底（store/positions.go:30-32）。

## backend/internal/domain/lesson.go

- [P2][枚举/DB 默认值错位·未修复] lesson.go:107 + 001_baseline:601 — `LessonBatch.Status LessonBatchStatus`（=ContentStatus，open/closed）但 `lesson_batches.status` DB 默认值为 `'active'`；batch_configs.go:96 CreateWithStatus 保证 handler 路径显式写状态，绕过 handler 的插入（种子/脚本）会得到 'active' 与 open/closed 两态冲突；最佳实践：新增迁移把默认值改为 'open'。
- [P3][类型不一致·未修复] lesson.go:108 — `LessonBatch.CourseCount *int` 与 JobBatch.PositionCount/SceneBatch.ScenarioCount/AffairsBatch.ProgramCount 均 `int` 不一致（列 course_count NOT NULL DEFAULT 0）；最佳实践：改为 `int`。
- [P3][死字段·未修复] lesson.go:129-138 — `NodeResource.Description` 永不赋值（resource_bindings.go:267-281 只取 resource_library 列，node_resources 表无 description 列）；最佳实践：删除或按实际列建模。
- 其余字段与 001_baseline、093、095、097、098 对齐；Course.Difficulty 用 *int 处理可空列（对照场景 Difficulty 的正确示范）。

## backend/internal/domain/library.go

- 无问题。ResourceType 常量与 001_baseline resource_type 枚举完全一致；ResourceLibraryItem/OnSiteQuestionLibraryItem 与表逐列对齐。

## backend/internal/domain/models.go

- [P2][枚举错位·未修复] models.go:85 + status.go:24 — `InstitutionStatus = ContentStatus`，但 DB `institution_status` 枚举只有 pending/approved/disabled（001_baseline:4-8）；ContentStatus 的 draft/rejected/published/open/closed 等值写入该列会被 DB 拒绝，且 'disabled' 无对应常量。本轮核实：Go 代码层无 INSERT/UPDATE institutions 路径（仅 auth.go:129 读取），风险为潜在类型隐患；最佳实践：独立定义 InstitutionStatus 枚举（含 StatusDisabled="disabled"）。
- [P3][字段缺失·未修复] models.go:73-92 — `Institution` 无 tenant_id 映射字段（institutions 表有 tenant_id 列）；最佳实践：补充 `TenantID *string json:"-"`。
- User/Institution 其余字段与 001_baseline（users:1289、institutions:525）对齐；User.Status 直扫 varchar(20) 无枚举冲突。

## backend/internal/domain/portal.go

- 无问题。全部为工作台 DTO，无直接 DB 列映射，json tag 齐全。

## backend/internal/domain/scene.go

- [P2][NULL 扫描风险·未修复] scene.go:16 + store/scenarios.go:205,220 — `Scenario.Difficulty int` 直扫可空列（001_baseline:1010 `difficulty smallint` 无 NOT NULL，CHECK(1-5) 放行 NULL）；存量 NULL 行导致列表/详情扫描报错；Create 路径 handler 直传 int 为 0 时触发 CHECK 拒绝→500；最佳实践：domain 改 `*int` 或 store COALESCE + handler 校验 1-5。
- [P2][NULL 扫描风险·未修复] scene.go:43 + store/scenario_tasks.go:84,262,293 — `ScenarioTask.Difficulty int` 直扫可空列（001_baseline:980 同型）；Create 的 RETURNING 直扫（scenario_tasks.go:84）在 `Difficulty *int`（:245）为 nil 时 NULL 落库并**当场扫描失败**——行已插入但接口报 500，比 Scenario 更直接；最佳实践：同上。
- [P3][租户 ID 暴露不一致·未修复] scene.go:24 — `Scenario.TenantID` 以 `json:"tenantId,omitempty"` 暴露；最佳实践：与 Course/Exam 统一隐藏。
- [P3][租户 ID 暴露不一致·新发现] scene.go:53 — `ScenarioTask.TenantID` 同样以 `json:"tenantId,omitempty"` 暴露，上轮漏记；最佳实践：统一隐藏。
- 其余字段与 001_baseline、100、121 对齐；industry_ids/profession_ids 扫描有 cast 兜底（store/scenarios.go:30-31）。

## backend/internal/domain/status.go

- [P3][枚举语义污染·未修复] status.go:15-16 — `StatusOpen/StatusClosed` 并入 `ContentStatus` 内容状态枚举，单类型承载 draft/published 与 open/closed 两套语义；最佳实践：单独定义 `type BatchStatus string`（现 BatchStatus 仅是别名，语义未分离）。
- [P3][死常量·未修复] status.go:19 — `StatusNotSubmitted` 全库（handler/service/store）无任何引用（已 grep 确认）；最佳实践：删除。
- [P2][枚举错位·未修复] status.go:24 — `InstitutionStatus = ContentStatus` 与 DB 枚举错位（详见 models.go 条目）；别名体系其余（CareerPositionStatus/CourseStatus/ScenarioStatus/BatchStatus/LessonBatchStatus/SceneBatchStatus）及保留旧常量与使用点一致，无悬挂引用。

## backend/internal/domain/tag.go

- 无问题。TagItem/ResourceTagRelation 与 137_resource_tags.up.sql 对齐（resource_type 为 varchar(32)，TagResourceType* 常量与 tag_handler.go 及 5 个 store 使用一致）。

## backend/internal/domain/unified.go

- [P3][Scan 行为不一致·未修复] unified.go:31 — `JSONMap.Scan` 对未知 src 类型静默 `return nil`（既不置值也不报错），而 StringSlice.Scan（unified.go:55）置 `*s = nil`；异常输入行为不一致易掩盖问题；最佳实践：统一返回 `fmt.Errorf("unsupported type %T", v)`。
- [P3][类型约定风险·未修复] unified.go:36 — `JSONSlice` 无 Value()/Scan() 实现，写 jsonb 列靠 pgx codec 兜底、读需调用方手动 json.Unmarshal（store/questions.go:155-161）；最佳实践：补齐 Scan/Value 或注释明确"仅用于 jsonb 列"。
- Tenant/OrgType/Organization/Major/Industry/ResourceCode/SubscriptionPackage/UserExtensionField/StaffTitle/Role/LoginLog/OperationLog/Workflow/ApprovalRecord 与 001_baseline、104、105 迁移对齐；Workflow.MajorIds 为 jsonb 列（001_baseline:1350）StringSlice 匹配。

---

## 汇总

- 审查文件数：16
- 问题总数：23（P0: 0，P1: 1，P2: 6，P3: 16）
- 上轮 21 条问题全部未修复（domain 层零变更），本轮新增 3 条（P1 升级 1 条、P3 新发现 2 条）

### P1 摘要（用户可达）

- evaluation.go:12 + store/question_banks.go:248,282,303 — `QuestionBank.Description` 直扫可空列，且**题库 Excel 导入（question_bank_import_handler.go:120,163,192）空描述单元格确定性落 NULL**，导入后该租户题库列表/详情接口 500（上轮 P2 升级，同文件 Exam.Description 已有 *string+判空范式可参照）。

### P2 摘要（未修复）

1. evaluation.go:92 — Exam.Version 直扫可空列（应用路径恒写 'v1.0'，存量行风险）。
2. evaluation.go:22 — QuestionBank.Version 直扫可空列（同 1）。
3. lesson.go:107 — lesson_batches.status DB 默认 'active' 与 open/closed 两态语义错位（001_baseline:601）。
4. models.go:85 + status.go:24 — InstitutionStatus 别名 ContentStatus 与 DB 枚举 pending/approved/disabled 错位，'disabled' 无常量（无 Go 写入路径，潜在）。
5. scene.go:16 — Scenario.Difficulty int 直扫可空列 + Create 0 值触发 CHECK(1-5) 拒绝。
6. scene.go:43 — ScenarioTask.Difficulty int 同型；Create RETURNING 直扫（scenario_tasks.go:84），Difficulty 为 nil 时行已插入但接口 500。

### P3 摘要（未修复 14 + 新增 2）

- 未修复：affairs_batch.go:13、affairs.go:58/124、certification_model.go:29、community.go:6、evaluation.go:237/323、job.go:25、lesson.go:108/129、models.go:73、scene.go:24、status.go:15-16/19、unified.go:31/36。
- 新增：evaluation.go:128（P0 修复残留：ExamResult.Grade/UserProfile.Grade 恒为空串）、evaluation.go:86（QuestionCount omitempty 风格不一致）、scene.go:53（ScenarioTask.TenantID 暴露，上轮漏记）。

### 无问题文件

- alliance.go（与 101/103/107/109 迁移全对齐）
- library.go（ResourceType 与 DB 枚举一致）
- portal.go（纯 DTO）
- tag.go（与 137 迁移及使用点一致）
