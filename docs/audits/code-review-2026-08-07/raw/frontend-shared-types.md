# shared-types 逐行审查报告（packages/shared-types/src，共 27 个 .ts 文件）

审查方式：逐文件完整通读，可疑契约均 grep 后端 `backend/internal/domain|handler|store` 核实。
未做任何代码修改。P0 无（无崩溃/安全问题）。

---

## packages/shared-types/src/affairs.ts
- [P2][契约] affairs.ts:109 — `TeachingPlan.rejectReason?` 后端不存在：`domain/affairs.go` TeachingPlan 无该字段，全后端 grep 无 `reject_reason`/`rejectReason` 写入路径（content_actions.go 驳回仅改 status）。死字段，注释"驳回原因"不实；最佳实践：删除或等后端实现审批驳回原因后再补。
- [P2][契约] affairs.ts:108 — `TeachingPlan.updatedAt?` 标可选，但后端 `domain/affairs.go:78` `UpdatedAt time.Time json:"updatedAt"` 无 omitempty 必返；最佳实践：改为必填 `updatedAt: string`。
- [P3][契约] affairs.ts:113-139 — `TeachingPlanEntry` 缺 `linkedCourseName`（后端 `domain/affairs.go:107` 返回该字段），消费后置名丢失；最佳实践：补 `linkedCourseName?: string`。
- [P3][契约] affairs.ts:275-281 — `AffairsBatch` 与后端 `domain/affairs_batch.go` 差异大：缺 orgNodeId/majorId/majorName/programCount/publishedCount/pendingCount/createdAt/updatedAt，多余 tenantId（后端 JSON 无）；最佳实践：按 domain/affairs_batch.go 对齐。
- 其余（Term/Venue/PeriodSlot/ScheduleEntry/ScheduleConflict/TimetableResponse/MyScheduleResponse）与 `domain/affairs.go`、`handler/scheduling_handler.go:863-962` 返回结构一致，无问题。

## packages/shared-types/src/ai.ts
- [P3][契约] ai.ts:1-27 — `AiSubjectivePreScore/AiInitialReview/AiGeneratedComment` 在 backend 全仓无对应实现/字段（grep suggestedScore/suggestedGrade/hitPoints/fullComment 均无命中），疑为外部 AI 服务或前端内部契约，无后端对照可核验；最佳实践：文件头注释说明来源，避免被误认为后端已有契约。

## packages/shared-types/src/alliance.ts
- [P3][契约] alliance.ts:79-80 — `AllianceProject` 缺 `agreementIds`（后端 `domain/alliance.go:91` `AgreementIDs json:"agreementIds"` 返回）；最佳实践：补 `agreementIds?: string[]`。
- [P3][风格] alliance.ts:14,45,214 — `scaleData/ratingRecord/data` 等用 `Record<string, any>`、`secondaryColleges`（14-15）用 `any[]`，本文件出现 8+ 处 any；最佳实践：有明确形状的字段（secondaryColleges 等）给具体类型。
- 字典核对：`ALLIANCE_DICTS` 全部枚举值与 `handler/import_common.go:253-351` 权威映射一致（enterpriseType 四值含兼容旧值 platform/school-based、enterpriseStatus/rating/projectPhase/publishStatus/achievementType/agreementStatus/accountType/expertRating/brandType 全部吻合），无问题。`brandTopicLayout`（317-321）后端无对照，仅前端展示用，可接受。

## packages/shared-types/src/approval.ts
- [P1][契约] approval.ts:21-30 — `ApprovalItem` 与后端实际返回 `domain.ApprovalRecord`（`domain/unified.go:260-272`，handler/approval_handler.go:67 直接返回）字段完全不符：`title/submitterName/submitTime/remark` 后端从不返回；后端实际是 targetType/targetId/submitterId/currentStepIdx/history；`submitTime: Date` 更是类型错误（后端 createdAt 为 ISO 字符串）。任何消费该类型渲染审批列表的页面都会显示 undefined；最佳实践：按 `domain.ApprovalRecord` 重写该类型，或标注为演示类型并从审批页移除。
- [P1][契约] approval.ts:2 — `ApprovalType` 枚举值 `'question'|'questionBank'|'onlineExam'` 与后端审批 targetType 合法值不符（`store/approvals.go:37-45`：career_position/scenario/course/question_bank/exam/training_program/teaching_plan）；'questionBank' 应为 'question_bank'，'onlineExam'/'question' 后端不存在；最佳实践：改为后端 7 个 targetType 字面量。
- [P1][契约] approval.ts:4-9 — `APPROVAL_TYPE_LABELS` 按错误枚举值映射，'题库/在线考试' 标签永远匹配不上真实数据；最佳实践：随 ApprovalType 修正一并重写。

## packages/shared-types/src/backend.ts
- [P1][契约] backend.ts:196-204 — `ApprovalHistoryItem`（stepId/stepName/status/comment）与后端审批 history 实际 JSON 结构不符：后端写入的是 `{action, remark, stepIdx, reviewerId, reviewerName, createdAt}`（`handler/approval_handler.go:152-159`，无 stepId/stepName/status/comment 键）；前端已自行用本地类型规避（apps/edu/components/shared/_components/approval-dialogs.tsx:20-29），此共享类型是错误副本；最佳实践：按后端键名（action/remark/stepIdx）修正或删除该导出。
- [P2][契约] backend.ts:22 — `Tenant.adminIds: string[]` 标必填，后端 `domain/unified.go:112` `AdminIDs []string json:"adminIds,omitempty"` 可空；最佳实践：改 `adminIds?: string[]`。
- [P2][契约] backend.ts:47 — `OrgType.isDefault?` 标可选，后端 `domain/unified.go:124` `IsDefault bool json:"isDefault"` 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] backend.ts:83 — `Role.status: string` 必填，后端 `domain/unified.go:217` 无 omitempty 必返，一致（无问题）；`StaffTitle.status`（83）同理一致。
- [P3][契约] backend.ts:64-74 — `UserRelation` 与后端列表项 `store/user_relations.go:10-20` 不符：缺 initiatorName/initiatorDept/targetName/targetDept，多余 tenantId/initiatorOrgNodeId/targetOrgNodeId/description；最佳实践：按 UserRelationItem 对齐。
- [P3][契约] backend.ts:28-39 — `Organization` 缺 `updatedAt`（后端 `domain/unified.go:137` 返回）；最佳实践：补 `updatedAt: string`。
- [P3][风格] backend.ts:19 — `secondaryColleges?: any[]` 用 any；最佳实践：给出具体形状或 Record<string, unknown>。

## packages/shared-types/src/certificate-issuance.ts
- [P1][契约] certificate-issuance.ts:26-40 — `CertIssuanceRecord` 必填字段 `templateTitle/certTypeName/studentName/studentId/className` 后端**从不返回**：`ListHistory` 只返回 `{id, templateId, userId, certNumber, issueDate, expireDate, status, revokedAt, revokeReason}`（`store/micro_cert.go:38-51,155-170`，handler/micro_cert_handler.go:51-63）；列表页若按此类型渲染名称/班级列全部 undefined；最佳实践：按后端列重写，或由后端 JOIN 补字段后再声明。
- [P2][契约] certificate-issuance.ts:19,38-39 — `IssueStatus` 含 `'revoked'` 且声明 `revokedAt/revokeReason`，但后端**无撤销端点/写入路径**（全后端 grep 无 revoke 操作，`store/micro_cert.go` 仅插入 `'issued'`），该状态永远不出现；最佳实践：删除或注明"预留"。
- [P2][类型] certificate-issuance.ts:15-16,34-35 — `createdAt/updatedAt/issueDate/expireDate/revokedAt` 标 `Date`，JSON 反序列化得到的是 ISO 字符串，运行期并非 Date 对象；最佳实践：统一改 `string`（需要日期运算时再 new Date()）。

## packages/shared-types/src/certification.ts
- [P2][契约] certification.ts:5-13 — `RuleStatus` 含 `'reviewing'/'ready'/'none'`，后端 certification_rules.status 无校验约束（varchar(16)，migration 001:269-272），后端代码中仅出现 draft/not_submitted/published 写入（store/certifications.go:102,648、domain/status.go:19），reviewing/ready/none 是前端自造值；风险：与后端将来加约束或前端状态机不一致；最佳实践：注释标明哪些值仅前端本地流转。
- [P3][契约] certification.ts:51-52 — `CertificationRule.createdAt?/updatedAt?` 标可选，后端 `domain/evaluation.go:246-247` 无 omitempty 必返；最佳实践：改必填。
- [P3][契约] certification.ts:123-129 — `CertificationModelTask` 缺 `taskType`（后端 `domain/certification_model.go:15` 返回 'scene'|'course'）；最佳实践：补 `taskType: string`。
- `CertificationPositionModel`（rule/positionId/domains）与 `handler/certification_model_handler.go:19-23` 一致，`CertificationWeightsPayload` 与请求体（:25-39）一致，无问题。

## packages/shared-types/src/content-status.ts
- 无问题：`Status` 六值与 `domain/status.go:6-12` 完全一致；`STATUS_TRANSITIONS` 与 `store/content_actions.go:24-31` 流转矩阵逐条核对一致（save_draft/submit/withdraw/approve/reject/publish/unpublish/archive 全部吻合）。

## packages/shared-types/src/evaluation-exam.ts
- [P2][契约] evaluation-exam.ts:104,180 — `QuestionBank.code?/Exam.code?` 标可选，后端 `domain/evaluation.go:10,78` Code string 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:118 — `QuestionBank.isDraftPool?` 标可选，后端 `:24` 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:143,173 — `Question.answer: string | string[]`，后端 `Answer JSONSlice json:"answer"`（:50,69）恒序列化为数组；标 string 分支运行期不存在；最佳实践：统一 `answer: string[]`（表单输入可另用联合）。
- [P2][契约] evaluation-exam.ts:188 — `Exam.questions: ExamQuestion[]` 必填，后端 `:85` `json:"questions,omitempty"` 可空；最佳实践：改 `questions?: ExamQuestion[]`。
- [P2][契约] evaluation-exam.ts:200 — `Exam.isTemp?` 标可选，后端 `:97` 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:236 — `ExamUsage.status` 联合含 `'pending'|'scheduled'`，后端该实体的状态只有 draft/published/in_progress/finished（handler/exam_usage_handler.go:77-79,186-213、store/exam_usages.go:72-74）；pending/scheduled 是其他实体的状态；最佳实践：收缩为四值。
- [P2][契约] evaluation-exam.ts:237 — `activationMode?` 标可选，后端 `domain/evaluation.go:113` 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] evaluation-exam.ts:256 — `ExamResult.gradingStatus?` 标可选，后端 `:134` 无 omitempty 必返（'pending'|'evaluated' 值正确）；最佳实践：改必填。
- [P3][契约] evaluation-exam.ts:114 — `QuestionBank` 缺 `knowledgePointIds`（后端 `domain/evaluation.go:25` 返回）；最佳实践：补 `knowledgePointIds?: string[]`。
- [P3][契约] evaluation-exam.ts:167-177 — `ExamQuestion` 缺 `examId`（后端 `:64` 返回）；最佳实践：补 `examId: string`。
- [P3][契约] evaluation-exam.ts:284-295 — `EvaluationBatch` 缺 `majorName`（后端 `domain/evaluation.go:423`），多余 `tenantId`（后端 JSON 无）；最佳实践：对齐。
- [P3][契约] evaluation-exam.ts:119-120,201-202 — `rejectReason?` 注释"后端审批驳回时返回"，但后端全仓无 reject_reason 字段/列（grep 无命中）；最佳实践：删除或标注未实现。
- 其余（Difficulty/QuestionType 与 `domain/evaluation.go:33-40` 一致、ExamCenterItem 与 `:144-160` 一致、RandomDrawQuestion 与 `:431-440` 一致）无问题。

## packages/shared-types/src/evaluation-rules.ts
- [P3][风格] evaluation-rules.ts:82 — `EvalRuleConfig.reviewSteps` 用的是 `EvalRuleReviewStepInput`（含 sortOrder、无 desc），而同结构输出模型 `EvalRuleReviewStep`（44-51）与输入模型字段命名（desc vs description）不统一，两类型并存易混用；最佳实践：统一为一个模型或明确 input/output 命名。
- [P3][风格] evaluation-rules.ts:243-249 — `uid/clone` 运行时工具函数放在类型包中（文件内 NOTE 已声明待迁移）；最佳实践：按注释迁移到 @zhiyu/ui，types 包只留类型。
- 契约核对：resourceConfig 键（paperId/questionIds/selectedQuestionIds/customQuestions/paperWeight）与后端 `store/task_evaluation.go:374,381` 一致；'exam'→'homework' 兼容别名注释与后端旧数据口径一致。无 P1/P2。

## packages/shared-types/src/evaluation-scene.ts
- [P1][契约] evaluation-scene.ts:74 — `JobAbilityResult.positionCode` 标必填，后端 `JobAbilityResultItem`（handler/job_ability_result_handler.go:35-59）**无 positionCode 字段**（grep 后端全仓无），消费处会渲染 undefined；最佳实践：删除该字段或后端补返。
- [P2][契约] evaluation-scene.ts:77 — `JobAbilityResult.studentId` 必填，后端 `StudentNo *string json:"studentId,omitempty"`（:41）可空；最佳实践：改可选。
- [P2][契约] evaluation-scene.ts:75,87-91 — `userId?/positionCompetency?/positionCompetencyV2?/abilityCognitionScore?` 标可选，后端 handler 全部无 omitempty 必返（:39,54-58）；最佳实践：改必填。
- [P2][契约] evaluation-scene.ts:16 — `EvaluationMethod.relatedTaskIds: string[]` 必填，后端 `domain/evaluation.go:170-178` EvaluationMethod **无此字段**（grep 全后端无 relatedTaskIds），永远 undefined；最佳实践：删除，或确认前端另有关联接口再补来源注释。
- [P2][契约] evaluation-scene.ts:37-38 — `SceneEvaluationResult.evaluatorId?/evaluatorType?` 标可选，后端 `:188-189` 无 omitempty 必返；最佳实践：改必填。
- [P3][契约] evaluation-scene.ts:41-51,121-155 — `SceneEvaluationResult.createdAt?/updatedAt?`（后端无此二键，仅 gradedAt）、`SceneGradingStudent/SceneGradingSubmission/SceneGradingScenario` 无后端对照（zhiyu-scene 迁移遗留演示类型）；最佳实践：标注演示来源。
- `JobAbilityPointDetail` 与 `service/job_ability_aggregator.go:229-240` 字段核对一致（仅 maxScore? 后端无此键，P3 无害）；`JobAbilitySummaryItem` 与 handler:187-192 一致。

## packages/shared-types/src/evaluation.ts
- 无问题（纯 barrel 再导出，拆分子领域后保留兼容入口）。

## packages/shared-types/src/graduation.ts
- [P1][契约] graduation.ts:9 — `GraduationProjectTopic.positionId` 后端字段名为 `careerPositionId`（`domain/evaluation.go:324`）；字段名不符。
- [P1][契约] graduation.ts:10 — `positionName` 后端从不返回（GraduationProjectTopic 无该字段/无 JOIN），必填字段恒 undefined。
- [P1][契约] graduation.ts:16 — `advisorName` 后端为 `advisorId`（`:330`），字段名不符；`enterpriseMentorName?`（17）同理应为 `enterpriseMentorId`。
- [P1][契约] graduation.ts:56 — `GraduationProjectEvaluation.evaluationTime` 后端字段名为 `evaluatedAt`（`:361`）。
- [P2][契约] graduation.ts:18-21 — `startDate/endDate: Date` 且必填，后端 `*string json:"startDate,omitempty"`（:332-333）可空字符串；`createdAt: Date`（21）同文件多处 Date 类型为 ISO 字符串。
- [P2][契约] graduation.ts:34-40 — `GraduationProjectArchive` 的 `topicName/studentName/advisorName/enterpriseMentorName?/positionName` 后端均不返回（后端仅 id/topicId/userId/phase/docStatus/docCount/hasRectification/lastUpdated，:339-348）。
- [P2][契约] graduation.ts:50-54 — `GraduationProjectEvaluation.topicName/studentName/studentId/comprehensiveGrade: EvaluationGrade` 必填，后端不返回或 `ComprehensiveGrade *string omitempty`（:358）可空。
- [P2][契约] graduation.ts:64-65 — `GraduationQueryResult.className/majorName` 必填，后端 `*string omitempty`（:368-369）可空。
- [P3][契约] graduation.ts:76-88 — `TopicApplication`（topicName/studentName/applyReason/allocatedAdvisorId...）后端无对应返回结构，疑似演示类型。
- [P3][死代码] graduation.ts:115-137 — `ProcessEvaluation/RectificationDetail` 演示类型，apps 无引用；且本文件整体（grep apps 无 GraduationProjectTopic 等消费者）为演示/死代码，字段不符短期内无运行影响；最佳实践：标注演示来源或删除，未来接后端时按 `domain/evaluation.go:319-379` 重写。

## packages/shared-types/src/index.ts
- [P3][导出] index.ts:1-22 — 未导出 job-source.ts/scene-mock.ts/lesson-source.ts（经 `@/lib/types/*` 子路径可达，属刻意），但批量使用 `@zhiyu/shared-types` 顶层导入时容易漏掉这三个子路径入口；最佳实践：文件头注释说明三个子路径入口的用途。无其他问题。

## packages/shared-types/src/job-source.ts
- [P3][重复] job-source.ts:34-48,211-238,61-68,90-109,112-117,302-314 — `WorkflowStep/Workflow/ApprovalStatus/ApprovalRecord/ApprovalHistoryItem/PositionCertificate/PositionResponsibility/PositionAbilityBinding/AbilityDomain/Batch/PositionRecommendation` 与 job.ts/backend.ts 同名同义实体重复定义（形状不同），同文件同时 import 两视图时同名冲突；文件头已声明为"本地工作模型"视图，属刻意隔离；最佳实践：保留声明即可，但建议在 index 注释中说明，避免新代码误引。
- 无 P1/P2（该文件为构建器本地视图，不承诺后端契约）。

## packages/shared-types/src/job.ts
- [P2][契约] job.ts:3 — `CareerPosition.code?` 标可选，后端 `domain/job.go:27` Code string 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] job.ts:23-25 — `favoriteCount?/viewCount?/abilityCount?` 标可选，后端 `:46-48` 无 omitempty 必返；最佳实践：改必填。
- [P3][契约] job.ts:93-108 — `JobBatch.tenantId?` 后端 JobBatch JSON 无该键（domain/job.go:117-131）；`majorName` 注释 Deprecated 与后端保留字段一致。
- 其余（PositionCertificate/CertificateLibraryItem/PositionResponsibility/AbilityPoint/PositionAbilityBinding/AbilityDomain/PositionRecommendation/BannerConfig/LearnRoad）与 `domain/job.go` 逐字段核对一致，无问题。

## packages/shared-types/src/lesson-source.ts
- [P3][死代码] lesson-source.ts 全文 — 文件头已 @deprecated，`Course/KnowledgePoint/SystemCourseNode/NodeQuiz/NodeResource/QuizQuestion/StudentAbilityPortrait` 等与 lesson.ts/portrait.ts 权威版本重复（形状不同，如 Course.major/teacher/industry 字符串 vs 权威版 majorId/teacherId/industryId）；最佳实践：按注释停止新增引用并逐步迁移。
- 无 P1/P2（已标记废弃）。

## packages/shared-types/src/lesson.ts
- [P2][契约] lesson.ts:3 — `Course.code?` 标可选，后端 `domain/lesson.go:9` Code string 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] lesson.ts:37 — `Course.viewCount?` 标可选，后端 `:42` 必返；最佳实践：改必填。
- [P2][契约] lesson.ts:30 — `coCreatorIds: string[]` 必填，后端 `:36` `json:"coCreatorIds,omitempty"` 可空；最佳实践：改可选。
- [P2][契约] lesson.ts:125 — `NodeResource.url: string` 必填，后端 `domain/lesson.go:134` `*string omitempty` 可空；`uploadedAt?: string`（128）标可选，后端 `:138` 必返；最佳实践：url 改可选、uploadedAt 改必填。
- [P3][契约] lesson.ts:42-54 — `KnowledgePoint` 缺 `category`（后端 `domain/lesson.go:53` 返回）；最佳实践：补 `category?: string`。
- [P3][契约] lesson.ts:139-152 — `LessonBatch.tenantId?` 后端 JSON 无该键（domain/lesson.go:99-111）。
- 其余（SystemCourseNode/NodeQuiz/NodeQuizQuestion/NodeHomework/HybridNodeModule/GradeMapping 等）与后端一致，无问题。

## packages/shared-types/src/library.ts
- 无问题：`ResourceKind` 与后端 `domain/library.go:7-19` ResourceType 常量一一对应；`TAG_RESOURCE_TYPES` 与 `domain/tag.go:23-28` 一致；ResourceLibraryItem/OnSiteQuestionLibraryItem/CitationStats/UncitedItem 与 store 返回核对一致。

## packages/shared-types/src/online-classroom.ts
- [P3][契约] online-classroom.ts 全文 — `OnlineClassroomStudent/OnlineClassroom/SmartCourseChapter/SmartCourseStudent/SmartCourse` 后端无对应实现（grep 无），zhiyu 迁移遗留演示类型；最佳实践：文件头标注演示来源。

## packages/shared-types/src/portal.ts
- [P3][契约] portal.ts:1-7 — `WorkspaceAnnouncement` 缺 `createdAt`（后端 `domain/portal.go:33` 返回）；最佳实践：补 `createdAt: string`。
- [P3][契约] portal.ts:18-32 — `WorkspaceScheduleEvent` 多 `tag?/description?`（后端 `domain/portal.go:45-57` 无）；多余字段无害。
- 其余（WorkspaceDashboard 及全部子结构）与 `domain/portal.go` 逐字段一致，无问题。

## packages/shared-types/src/portrait.ts
- [P2][契约] portrait.ts:10-26 — `StudentAbilityArchive` 与后端 `domain/evaluation.go:303-317` 不符：studentName/studentId/className 后端不返回（后端为 UserID），`obtainDate: Date`（18）后端为 `*string omitempty`（:309）且可空，`isEnabled/auditStatus` 等一致。
- [P2][契约] portrait.ts:44-75 — `StudentAbilityPortrait` 与后端 `:279-300` 不符：studentName/studentId/className/majorName/positionName/gender/gradeYear/yearRank/yearTotal/attendanceRate 等 15+ 字段后端不返回（后端为 userId/careerPositionId），`updatedAt: Date`（58）类型错误；字段名能对的仅 domainScores/classRank 等少数。
- [P3][重复] portrait.ts:131-136 vs lesson-source.ts:273-277 — 同名 `PortraitUpdateConfig` 两种形状（updateCycle/queryLimit vs autoUpdate/updateTime/lastUpdateTime），同名异义；最佳实践：合并为一份。
- [P3][死代码] portrait.ts 整体 apps 无消费者（grep 无 StudentAbilityPortrait/StudentAbilityArchive 引用），演示类型；最佳实践：标注演示来源，接后端时按 `domain/evaluation.go:279-317` 重写。

## packages/shared-types/src/scene-mock.ts
- [P3][死代码] scene-mock.ts 全文 — 文件头已 @deprecated，`Scenario/Task/Position/GradeMapping` 等与 scene.ts 权威版本冲突（如 Scenario.status 缺 'archived'、difficulty 1|2|3|4|5 字面量 vs number、coBuilders 内联对象 vs coBuilderIds）；最佳实践：按注释停止新增引用并逐步迁移。
- 无 P1/P2（已标记废弃）。

## packages/shared-types/src/scene.ts
- [P2][契约] scene.ts:4 — `Scenario.code?` 标可选，后端 `domain/scene.go:8` Code string 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] scene.ts:14,25 — `viewCount?/taskCount?` 标可选，后端 `:28-29` 必返；最佳实践：改必填。
- [P2][契约] scene.ts:20 — `coBuilderIds: string[]` 必填，后端 `:23` `json:"coBuilderIds,omitempty"` 可空；最佳实践：改可选。
- [P2][契约] scene.ts:118 — `RubricTemplate.isDeleted?` 标可选，后端 `:64` `IsDeleted bool` 无 omitempty 必返；最佳实践：改必填。
- [P2][契约] scene.ts:214 — `SceneBatch.scenarioCount?` 标可选，后端 `:179` 必返；最佳实践：改必填。
- [P3][契约] scene.ts:92-96 — `TaskResourceBinding` 后端 `domain/scene.go` 无对应实体（只有 TaskKnowledgeBinding/TaskAbilityBinding，:138-148）；grep 后端无 task_resource_bindings 返回结构；最佳实践：删除或标注未实现。
- [P3][契约] scene.ts:196-202 — `SceneArchive` 后端无实现（grep 无 scene_archives）；疑似死代码。
- 其余（ScenarioTask/TaskEvaluationMethod/TaskScoreRule/TaskEvalPoint/TaskReviewStep/TaskResource/ScenarioWeightConfig/ScenarioGradeMapping/RubricTemplate）与 `domain/scene.go` 逐字段一致；SCENE_DIFFICULTY 前端展示配置无问题。

## packages/shared-types/src/shared-models.ts
- [P2][契约] shared-models.ts:16 — `User.email: string` 必填，后端 `domain/models.go:58` `Email *string json:"email,omitempty"` 可空；最佳实践：改 `email?: string`。
- [P2][类型] shared-models.ts:35 — `Collaborator.addedAt: Date`，JSON 反序列化为 ISO 字符串；最佳实践：改 string。
- [P3][重复] shared-models.ts:45-49 — `Batch {id,name,description?}` 与 job-source.ts Batch、job.ts JobBatch 同名异义；最佳实践：改名或注释用途。
- 其余 User 字段与 `domain/models.go:43-71` 逐字段核对一致。

## packages/shared-types/src/status.test.ts
- 无问题（getStatusConfig 行为测试，与实现一致）。

## packages/shared-types/src/status.ts
- [P3][契约] status.ts:1-2 — `ContentStatus` 含 `'reviewing'`，后端内容实体状态枚举（domain/status.go:6-12）无此值；仅前端认证规则本地流转使用；最佳实践：注释标明来源，避免与 content-status.ts 六值混淆。
- [P3][风格] status.ts:33-54 — 中文字符串键（'未开始'/'已评分' 等）作 map 键，与后端英文状态体系不统一，仅展示用；可接受，注释已声明。
- 无 P1/P2。

---

## 汇总

- 审查文件数：27（含 1 个测试文件、1 个 barrel 文件）
- 总问题数：约 60 条（P1 7 条、P2 31 条、P3 22 条）
- P0：0

P1 摘要（位置 + 一句话）：
1. approval.ts:21-30 — ApprovalItem 与后端 ApprovalRecord 结构完全不符（title/submitterName/submitTime/remark 均不存在）
2. approval.ts:2 — ApprovalType 枚举值 question/questionBank/onlineExam 与后端 targetType 七值不符
3. backend.ts:196-204 — ApprovalHistoryItem 字段名（stepId/stepName/status/comment）与后端 history 实际键（action/remark/stepIdx）不符
4. certificate-issuance.ts:26-40 — CertIssuanceRecord 五个必填字段（templateTitle/certTypeName/studentName/studentId/className）后端 ListHistory 从不返回
5. evaluation-scene.ts:74 — JobAbilityResult.positionCode 必填但后端 JobAbilityResultItem 无此字段
6. graduation.ts:9-10,16 — GraduationProjectTopic positionId/positionName/advisorName 字段名与后端 careerPositionId/advisorId 不符
7. graduation.ts:56 — GraduationProjectEvaluation.evaluationTime 后端字段名为 evaluatedAt
