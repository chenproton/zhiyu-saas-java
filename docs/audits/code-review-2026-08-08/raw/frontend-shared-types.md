# shared-types 复查报告（packages/shared-types/src，共 27 个 .ts 文件，2026-08-08）

复查方式：逐文件完整逐行通读，与后端 `backend/internal/domain|handler|store` 逐字段核对；
重点验证 2026-08-07 报告（docs/audits/code-review-2026-08-07/raw/frontend-shared-types.md）所列修复项是否有遗漏/回归。
禁止修改代码。P0 无。

## 上轮 P1 修复核验（全部通过）

- approval.ts：ApprovalType 七值（career_position/scenario/course/question_bank/exam/training_program/teaching_plan）与 `store/approvals.go:38-46` 一致；APPROVAL_TYPE_LABELS 重写正确；ApprovalItem 与 `domain/unified.go:260-272` ApprovalRecord 逐字段一致（含 tenantId?/workflowId?/history/currentStepIdx）；submitTime: Date 错误已消除。
- backend.ts：ApprovalHistoryItem（action/remark/stepIdx/reviewerId/reviewerName/createdAt）与 `handler/approval_handler.go:152-159` 写入键一致；ApprovalRecord（206-218）与 domain 一致。
- certificate-issuance.ts：CertIssuanceRecord（27-37）已按 `domain/evaluation.go:395-405`/`store/micro_cert.go:42` 重写（id/templateId/userId/certNumber/issueDate/expireDate?/status/revokedAt?/revokeReason?），issueDate/revokedAt 已改 string。
- evaluation-scene.ts：JobAbilityResult.positionCode 已删除（`handler/job_ability_result_handler.go:35-59` 无该字段）。
- graduation.ts：GraduationProjectTopic 已改 careerPositionId/advisorId/enterpriseMentorId（`domain/evaluation.go:325,331-332`）；evaluationTime→evaluatedAt（:362）；startDate/endDate 改 `string?`；ProcessEvaluation/RectificationDetail 已删除（文件现 108 行）。

---

## packages/shared-types/src/affairs.ts
- [P2][契约] affairs.ts:108 — `TeachingPlan.updatedAt?` 仍标可选，后端 `domain/affairs.go:78` `UpdatedAt time.Time json:"updatedAt"` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] affairs.ts:109 — `TeachingPlan.rejectReason?` 仍为死字段，后端全仓无 reject_reason 写入路径（content_actions.go 驳回仅改 status）（上轮未修）；最佳实践：删除或等后端实现后再补。
- [P3][契约] affairs.ts:113-139 — `TeachingPlanEntry` 仍缺 `linkedCourseName`（后端 `domain/affairs.go:107` `json:"linkedCourseName,omitempty"` 返回）（上轮未修）；最佳实践：补 `linkedCourseName?: string`。
- [P3][契约] affairs.ts:275-281 — `AffairsBatch` 仍与 `domain/affairs_batch.go` 差异大（缺 orgNodeId/majorId/majorName/programCount/publishedCount/pendingCount/createdAt/updatedAt，多 tenantId/workflowId）（上轮未修）；最佳实践：按 domain/affairs_batch.go 对齐。

## packages/shared-types/src/approval.ts
- 无问题：ApprovalType 七值与 `store/approvals.go:38-46` 一致；ApprovalStatus 三值与 `domain/unified.go:79-81` 一致；ApprovalItem 与 `domain/unified.go:260-272` 逐字段一致。

## packages/shared-types/src/backend.ts
- [P2][契约] backend.ts:22 — `Tenant.adminIds: string[]` 仍标必填，后端 `domain/unified.go:112` `json:"adminIds,omitempty"` 可空（上轮未修）；最佳实践：改 `adminIds?: string[]`。
- [P2][契约] backend.ts:47 — `OrgType.isDefault?` 仍标可选，后端 `domain/unified.go:124` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P3][契约] backend.ts:64-74 — `UserRelation` 仍与 `store/user_relations.go:10-20` 列表项不符（缺 initiatorName/initiatorDept/targetName/targetDept，多 tenantId/initiatorOrgNodeId/targetOrgNodeId/description）（上轮未修）；最佳实践：按 UserRelationItem 对齐。
- [P3][风格] backend.ts:18-19 — `scaleData: Record<string, any>`、`secondaryColleges: any[]` 仍用 any（上轮未修）；最佳实践：给具体形状或 Record<string, unknown>。
- 已修复：Organization.updatedAt（:38）已补齐（上轮 P3 通过）；ApprovalHistoryItem 键名已对齐。

## packages/shared-types/src/ai.ts
- [P3][契约] ai.ts:1-27 — 全文件仍无后端对照（grep suggestedScore/hitPoints/fullComment 无命中），文件头仍无来源说明（上轮未修）；最佳实践：文件头注释说明为外部 AI 服务/前端内部契约。

## packages/shared-types/src/alliance.ts
- [P3][契约] alliance.ts:79-80 — `AllianceProject` 仍缺 `agreementIds`（后端 `domain/alliance.go:91` `json:"agreementIds,omitempty"` 返回）（上轮未修）；最佳实践：补 `agreementIds?: string[]`。
- [P3][风格] alliance.ts:14,45,214 — `scaleData/ratingRecord/data` 仍用 `Record<string, any>`（上轮未修；:15 secondaryColleges 已改进为具体形状）；最佳实践：剩余 3 处补具体类型。
- 字典核对：ALLIANCE_DICTS 与 `handler/import_common.go:253-351` 权威映射复核一致，无问题。

## packages/shared-types/src/approval.ts
- 无问题（见上方核验段）。

## packages/shared-types/src/certificate-issuance.ts
- [P2][类型] certificate-issuance.ts:15-16 — `MicroCertTemplate.createdAt/updatedAt: Date` 仍标 Date（上轮仅修了 CertIssuanceRecord 的 34-35 行，此处遗漏）；JSON 反序列化为 ISO 字符串；最佳实践：改 string。
- [P2][契约] certificate-issuance.ts:19 — `IssueStatus` 仍含 `'revoked'`，后端仍无撤销端点/写入路径（grep handler/store 无 revoke 操作，仅 'issued' 写入）；revokedAt/revokeReason 列虽在 schema 但状态永不出现（上轮未修）；最佳实践：删除或注明"预留"。

## packages/shared-types/src/certification.ts
- [P2][契约] certification.ts:51-52 — `CertificationRule.createdAt?/updatedAt?` 仍标可选，后端 `domain/evaluation.go:247-248` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P3][契约] certification.ts:123-129 — `CertificationModelTask` 仍缺 `taskType`（后端 `domain/certification_model.go:15` 返回 "scene"|"course"）（上轮未修）；最佳实践：补 `taskType: string`。
- [P3][契约] certification.ts:5-13 — `RuleStatus` 仍含前端自造值 reviewing/ready/none（后端 certification_rules.status 无校验约束且仅 draft/not_submitted/published 写入）；最佳实践：注释标明哪些值仅前端本地流转。
- 已核验：CertificationPositionModel/CertificationWeightsPayload 与 `handler/certification_model_handler.go:19-39` 一致，无问题。

## packages/shared-types/src/content-status.ts
- 无问题：Status 六值与 `domain/status.go` 一致；STATUS_TRANSITIONS 与 `store/content_actions.go:24-31` 逐条核对一致。

## packages/shared-types/src/evaluation-exam.ts
- [P2][契约] evaluation-exam.ts:104,138,182 — `QuestionBank.code?/Question.code?/Exam.code?` 仍标可选，后端 `domain/evaluation.go:10,45,78` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][类型] evaluation-exam.ts:121-122,151,198-199 — `QuestionBank.createdAt/updatedAt`、`Question.createdAt`、`Exam.createdAt/updatedAt` 仍标 `Date`，JSON 反序列化为 ISO 字符串（上轮未发现）；最佳实践：统一改 string。
- [P2][契约] evaluation-exam.ts:118 — `QuestionBank.isDraftPool?` 仍标可选，后端 `:24` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:143,159,173 — `Question.answer: string | string[]` 仍含 string 分支，后端 `Answer JSONSlice json:"answer"`（:50,69）恒为数组（上轮未修）；最佳实践：统一 `answer: string[]`。
- [P2][契约] evaluation-exam.ts:188 — `Exam.questions: ExamQuestion[]` 仍标必填，后端 `:85` `json:"questions,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [P2][契约] evaluation-exam.ts:200 — `Exam.isTemp?` 仍标可选，后端 `:98` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:236 — `ExamUsage.status` 仍含 `'pending'|'scheduled'`，后端仅 draft/published/in_progress/finished（`store/exam_usages.go:69-77,181`）（上轮未修）；最佳实践：收缩为四值。
- [P2][契约] evaluation-exam.ts:237 — `ExamUsage.activationMode?` 仍标可选，后端 `domain/evaluation.go:114` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:256 — `ExamResult.gradingStatus?` 仍标可选，后端 `:135` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P3][契约] evaluation-exam.ts:114 — `QuestionBank` 仍缺 `knowledgePointIds`（后端 `:25` 返回）（上轮未修）；最佳实践：补 `knowledgePointIds?: string[]`。
- [P3][契约] evaluation-exam.ts:167-177 — `ExamQuestion` 仍缺 `examId`（后端 `:64` 返回）（上轮未修）；最佳实践：补 `examId: string`。
- [P3][契约] evaluation-exam.ts:119-120,201-202 — `rejectReason?` 仍为死字段（后端全仓无 reject_reason 写入）（上轮未修）；最佳实践：删除或标注未实现。
- [P3][契约] evaluation-exam.ts:284-295 — `EvaluationBatch` 仍多 `tenantId?`（后端 JSON 无）且缺 `majorName`（`domain/evaluation.go:424` 返回）（上轮未修）；最佳实践：对齐。
- 其余（Difficulty/QuestionType/ExamCenterItem/RandomDrawQuestion）与后端一致，无问题。

## packages/shared-types/src/evaluation-rules.ts
- [P3][风格] evaluation-rules.ts:82 — `EvalRuleConfig.reviewSteps` 仍用 `EvalRuleReviewStepInput`（含 sortOrder 无 desc），与同结构 `EvalRuleReviewStep`（44-51，desc 无 sortOrder）并存易混用（上轮未修）；最佳实践：统一一个模型。
- [P3][风格] evaluation-rules.ts:243-249 — `uid/clone` 运行时工具仍留在类型包（文件内 NOTE 已声明待迁移）（上轮未修）；最佳实践：迁往 @zhiyu/ui。
- 契约核对：resourceConfig 键（paperId/questionIds/selectedQuestionIds/customQuestions/paperWeight）与 `store/task_evaluation.go:374,381` 一致；'exam'→'homework' 兼容别名一致。无 P1/P2。

## packages/shared-types/src/evaluation-scene.ts
- [P2][契约] evaluation-scene.ts:16 — `EvaluationMethod.relatedTaskIds: string[]` 仍为必填死字段，后端 `domain/evaluation.go:171-179` 无此字段（上轮未修）；最佳实践：删除或确认另有关联接口再补来源注释。
- [P2][契约] evaluation-scene.ts:37-38 — `SceneEvaluationResult.evaluatorId?/evaluatorType?` 仍标可选，后端 `:189-190` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] evaluation-scene.ts:74 — `JobAbilityResult.userId?` 仍标可选，后端 `handler/job_ability_result_handler.go:36` `UserID string json:"userId"` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] evaluation-scene.ts:76 — `JobAbilityResult.studentId` 仍标必填，后端 `:37` `*string json:"studentId,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [P2][契约] evaluation-scene.ts:86,88,90 — `positionCompetency?/positionCompetencyV2?/abilityCognitionScore?` 仍标可选，后端 :50-58 全部 float64 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][类型] evaluation-scene.ts:91 — `evaluationTime: string | Date` 联合含 Date 分支，后端 `EvaluatedAt time.Time json:"evaluationTime"` 反序列化恒为字符串（上轮未修）；最佳实践：改 `string`。
- [P3][契约] evaluation-scene.ts:41-51,49-50 — `SceneEvaluationResult.createdAt?/updatedAt?` 后端无此二键（仅 gradedAt/gradedBy），仍残留（上轮未修）；最佳实践：删除。
- [P3][契约] evaluation-scene.ts:92-94 — `JobAbilityResult` 仍缺 `gradeHistory`（后端 :44 `json:"gradeHistory"` 返回），且 `createdAt?/updatedAt?`（93-94）后端无此二键（新发现）；最佳实践：补 `gradeHistory?: unknown[]`，删除 createdAt/updatedAt。
- [P3][契约] evaluation-scene.ts:106-116 — `JobAbilityAggregateStatus` 多 `message?`（后端 `JobAbilityAggregateLog` handler:201-206 无此键），且 `id?/studentCount?/startedAt?` 标可选而后端无 omitempty 必返（新发现）；最佳实践：改 id/studentCount/startedAt 必填、删 message。
- 已修复：positionCode 删除 ✓；SceneGradingStudent/SceneGradingSubmission/SceneGradingScenario 已加"从 zhiyu-scene 迁移"注释 ✓。

## packages/shared-types/src/evaluation.ts
- 无问题（纯 barrel 再导出）。

## packages/shared-types/src/graduation.ts
- [P2][契约] graduation.ts:26-40 — `GraduationProjectArchive` 的 topicName/studentName/studentId/advisorName/enterpriseMentorName?/positionName 仍为必填字段且后端不返回（后端仅 id/topicId/userId/phase/docStatus/docCount/hasRectification/lastUpdated，`domain/evaluation.go:340-349`）（上轮未修）；最佳实践：按后端字段重写或删除，当前 apps 无消费者。
- [P2][类型] graduation.ts:38 — `lastUpdated: Date` 仍标 Date，后端 time.Time 反序列化为 ISO 字符串（上轮未修）；最佳实践：改 string。
- [P2][契约] graduation.ts:61-62 — `GraduationQueryResult.className/majorName` 仍标必填，后端 `*string omitempty`（`domain/evaluation.go:369-370`）可空；且 studentName/studentId（59-60）后端不返回、缺 userId/updatedAt（后端 :368,379 返回）（上轮未修）；最佳实践：对齐字段并改可选。
- [P3][死代码] graduation.ts:73-85 — `TopicApplication` 仍为演示类型（后端无对应返回结构，apps 无引用）（上轮未修）；最佳实践：标注演示来源或删除。
- 已修复：GraduationProjectTopic/Evaluation 字段名、ProcessEvaluation/RectificationDetail 删除均 ✓。

## packages/shared-types/src/index.ts
- [P3][导出] index.ts:1-22 — 仍未导出 job-source.ts/scene-mock.ts/lesson-source.ts 且文件头无说明（上轮未修）；最佳实践：文件头注释说明三个子路径入口用途。

## packages/shared-types/src/job-source.ts
- [P3][重复] job-source.ts:34-48,41-48,61-68,90-109,211-238,302-314 — 与 job.ts/backend.ts 同名同义实体重复定义（工作模型视图，文件头已声明隔离，上轮未修）；最佳实践：保留声明即可，无 P1/P2。

## packages/shared-types/src/job.ts
- [P2][契约] job.ts:3 — `CareerPosition.code?` 仍标可选，后端 `domain/job.go:27` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] job.ts:23-25 — `favoriteCount?/viewCount?/abilityCount?` 仍标可选，后端 `:45-47` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P3][契约] job.ts:95 — `JobBatch.tenantId?` 后端 JSON 无该键（domain/job.go:117-131）（上轮未修）；最佳实践：删除。
- 其余与 `domain/job.go` 逐字段一致，无问题。

## packages/shared-types/src/lesson-source.ts
- [P3][死代码] lesson-source.ts 全文 — 仍 @deprecated 且与 lesson.ts 权威版本重复（上轮未修）；最佳实践：按注释停止新增引用并逐步迁移。无 P1/P2。

## packages/shared-types/src/lesson.ts
- [P2][契约] lesson.ts:3 — `Course.code?` 仍标可选，后端 `domain/lesson.go:9` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] lesson.ts:30 — `coCreatorIds: string[]` 仍标必填，后端 `:35` `json:"coCreatorIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [P2][契约] lesson.ts:37 — `Course.viewCount?` 仍标可选，后端 `:41` 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] lesson.ts:124,128 — `NodeResource.url: string` 仍标必填（后端 `:134` `*string omitempty` 可空）、`uploadedAt?: string` 仍标可选（后端 `:138` 必返）（上轮未修）；最佳实践：url 改可选、uploadedAt 改必填。
- [P3][契约] lesson.ts:42-54 — `KnowledgePoint` 仍缺 `category`（后端 `:53` 返回 `category,omitempty`）（上轮未修）；最佳实践：补 `category?: string`。
- [P3][契约] lesson.ts:141 — `LessonBatch.tenantId?` 后端 JSON 无该键（上轮未修）；最佳实践：删除。
- 其余与后端一致，无问题。

## packages/shared-types/src/library.ts
- 无问题：ResourceKind 与 `domain/library.go:7-19` 常量一一对应；TAG_RESOURCE_TYPES 与 `domain/tag.go` 一致。

## packages/shared-types/src/online-classroom.ts
- [P3][契约] online-classroom.ts 全文 — 仍为 zhiyu 迁移遗留演示类型（后端 grep 无实现，文件头仍无演示来源标注）（上轮未修）；最佳实践：文件头标注演示来源。

## packages/shared-types/src/portal.ts
- [P3][契约] portal.ts:1-7 — `WorkspaceAnnouncement` 仍缺 `createdAt`（后端 `domain/portal.go:33` 返回）（上轮未修）；最佳实践：补 `createdAt: string`。
- [P3][契约] portal.ts:28-29 — `WorkspaceScheduleEvent` 仍多 `tag?/description?`（后端 `domain/portal.go:45-57` 无）（上轮未修）；多余字段无害，可删除。

## packages/shared-types/src/portrait.ts
- [P2][契约] portrait.ts:10-26 — `StudentAbilityArchive` 仍与后端 `domain/evaluation.go:303-317` 不符（studentName/studentId/className 后端不返回，obtainDate: Date 后端 `*string omitempty` 可空）（上轮未修，apps 无消费者）；最佳实践：标注演示来源，接后端时按 domain 重写。
- [P2][契约] portrait.ts:44-75 — `StudentAbilityPortrait` 仍与后端 `:279-300` 不符（studentName/studentId/className/majorName/positionName/updatedAt 等 15+ 字段后端不返回）（上轮未修）；最佳实践：同上。
- [P3][重复] portrait.ts:131-136 vs lesson-source.ts:273-277 — `PortraitUpdateConfig` 同名异义两种形状仍并存（上轮未修）；最佳实践：合并为一份。

## packages/shared-types/src/scene-mock.ts
- [P3][死代码] scene-mock.ts 全文 — 仍 @deprecated 且与 scene.ts 冲突（上轮未修）；最佳实践：停止新增引用并迁移。无 P1/P2。

## packages/shared-types/src/scene.ts
- [P2][契约] scene.ts:4 — `Scenario.code?` 仍标可选，后端 `domain/scene.go:8` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] scene.ts:14,25 — `viewCount?/taskCount?` 仍标可选，后端 `:27-28` 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] scene.ts:20 — `coBuilderIds: string[]` 仍标必填，后端 `:20` `json:"coBuilderIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [P2][契约] scene.ts:118 — `RubricTemplate.isDeleted?` 仍标可选，后端 `:64` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [P2][契约] scene.ts:214 — `SceneBatch.scenarioCount?` 仍标可选，后端 `:179` 必返（上轮未修）；最佳实践：改必填。
- [P3][契约] scene.ts:92-96 — `TaskResourceBinding` 后端无对应实体（上轮未修）；最佳实践：删除或标注未实现。
- [P3][契约] scene.ts:196-202 — `SceneArchive` 后端无实现（上轮未修）；最佳实践：删除或标注未实现。

## packages/shared-types/src/shared-models.ts
- [P2][契约] shared-models.ts:16 — `User.email: string` 仍标必填，后端 `domain/models.go:58` `*string json:"email,omitempty"` 可空（上轮未修）；最佳实践：改 `email?: string`。
- [P2][类型] shared-models.ts:35 — `Collaborator.addedAt: Date` 仍标 Date（上轮未修）；最佳实践：改 string。
- [P3][重复] shared-models.ts:45-49 — `Batch` 与 job-source.ts Batch 同名异义仍并存（上轮未修）；最佳实践：改名或注释用途。

## packages/shared-types/src/status.test.ts
- 无问题（getStatusConfig 行为测试与实现一致）。

## packages/shared-types/src/status.ts
- [P3][契约] status.ts:1-2 — `ContentStatus` 仍含 `'reviewing'`（后端内容实体状态枚举无此值，仅前端认证规则本地流转）（上轮未修）；最佳实践：注释标明来源。

---

## 汇总

- 审查文件数：27（含 1 个测试文件、1 个 barrel 文件）
- 问题总数：74（P0 0、P1 0、P2 40、P3 34）
- 无问题文件：approval.ts、content-status.ts、evaluation.ts、library.ts、status.test.ts（5 个）

### 上轮修复核验结论
- 7 条 P1 全部修复，无回归：approval.ts 枚举/ApprovalItem、backend.ts ApprovalHistoryItem、certificate-issuance.ts CertIssuanceRecord、evaluation-scene.ts positionCode、graduation.ts 字段名、ProcessEvaluation/RectificationDetail 删除均通过。
- 附带修复确认：backend.ts Organization.updatedAt 补齐、certificate-issuance.ts 记录日期改 string、graduation.ts startDate/endDate 改 string?、evaluation-scene.ts 演示类型已标注来源。

### P2 摘要（40 条：上轮未修残留 39 + 新发现 1）
1. 可选/必填错标（28 条）：`evaluation-exam.ts:104,138,182` code?、`:118` isDraftPool?、`:188` questions、`:200` isTemp?、`:237` activationMode?、`:256` gradingStatus?；`evaluation-scene.ts:37-38` evaluatorId?/evaluatorType?、`:74` userId?、`:76` studentId、`:86,88,90` 三指标；`affairs.ts:108` updatedAt?；`backend.ts:22` adminIds、`:47` isDefault?；`certification.ts:51-52` createdAt?/updatedAt?；`job.ts:3,23-25`；`lesson.ts:3,30,37,124,128`；`scene.ts:4,14,25,20,118,214`；`shared-models.ts:16`；`graduation.ts:61-62`。
2. 后端无此字段/枚举超集/联合错（8 条）：`evaluation-scene.ts:16` relatedTaskIds、`affairs.ts:109` rejectReason、`certificate-issuance.ts:19` 'revoked' 无写入端点、`evaluation-exam.ts:143,159,173` answer union、`:236` ExamUsage.status 超集、`graduation.ts:26-40` Archive、`portrait.ts:10-26,44-75`、`evaluation-scene.ts:91` evaluationTime union。
3. Date 类型错误（4 条）：`evaluation-exam.ts:121-122,151,198-199`（新发现，上轮漏报）、`graduation.ts:38`、`shared-models.ts:35`、`certificate-issuance.ts:15-16`。

### P3 摘要（34 条：上轮未修残留 32 + 新发现 2）
主要为上轮未修的残留：缺字段（linkedCourseName/knowledgePointIds/examId/taskType/category/agreementIds/createdAt）、多余字段（tenantId/rejectReason/tag/description/createdAt/updatedAt）、演示/废弃类型（ai.ts/online-classroom.ts/lesson-source.ts/scene-mock.ts/job-source.ts/TopicApplication）、any 风格、运行时工具函数、状态自造值（reviewing）等。新发现 2 条：`evaluation-scene.ts:92-94` 缺 gradeHistory 且 createdAt?/updatedAt? 为死字段、`:106-116` JobAbilityAggregateStatus 多 message? 且必返字段（id/studentCount/startedAt）误标可选。
