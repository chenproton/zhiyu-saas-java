# 评价/场景（evaluation / scene / snapshot）对比差距报告

> 对比基准：Go 侧为功能基准（Source of Truth），Java 侧为对齐对象。
> 范围：Go `backend/go/internal/{handler,service,store,router,domain}` 下 evaluation* / scene* / snapshot 相关文件；
> Java `backend/java/ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/{controller,service,service/impl,mapper,domain}` 下 evaluation / scene 相关文件。

## 1. 接口/路由差距

> 结论：接口面高度对齐。Go 侧 evaluation+scene 共约 90 个端点，Java 侧仅缺 1 个、多出 1 个。

### Java 缺失（Go 有、Java 无）

| 方法 | 路径 | Go 依据 |
|---|---|---|
| PUT | /api/v1/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/task-weights | `handler/certification_model_handler.go` → `PutPointTaskWeights`（胜任配置弹窗保存单个能力点下的关联任务权重） |

说明：Java 侧 `EvaluationCertificationController` 只实现到 `putPointLevels`，缺失 `PutPointTaskWeights`。任务权重目前只能通过 `PUT /evaluation/certifications/{id}/full`（`putFullRule`，含 taskWeights）整体写入，无法像 Go 那样按「单个能力点」粒度单独保存，且 Go 该端点有独立的「任务权重之和=100」校验。

### Java 多出（Java 有、Go 无）

| 方法 | 路径 | Java 依据 |
|---|---|---|
| DELETE | /api/v1/scene/grade-mappings/{id} | `controller/scene/SceneGradeMappingController.java` → `delete` |

说明：Go `routes_scene.go` 的 `/scene/grade-mappings` 仅 Get/Post/Put（`ListGradeMappings` / `UpsertGradeMapping`），无删除能力；`store/scenario_configs.go` 也无 DELETE grade_mappings。Java 多出一个删除端点（契约超集）。

### 其余端点逐组核对（已对齐，供留痕）

- 题库 `/evaluation/question-banks`：List/Get/Create/Update/Delete + submit/review/publish/archive/unpublish/withdraw/save-draft/invite + snapshot → Java `EvaluationQuestionBankController` 全量覆盖。
- 题目 `/evaluation/questions`（含 batch）→ `EvaluationQuestionBankController` 覆盖。
- 随机抽题 `/evaluation/random-draw-questions` → 覆盖。
- 试卷 `/evaluation/exams`（content 写路由 + 题目子路由 add/remove/score/bulk-score + snapshot）→ `EvaluationExamController` 覆盖。
- 考试安排 `/evaluation/exam-usages`（create/update/delete/publish/finish + list/get/exam-center）→ 覆盖。
- 考试结果 `/evaluation/exam-results`（list/get/create/grade）→ 覆盖。
- 场景测评结果 `/evaluation/results`（list/get/submit/grade/batch-grade）→ 覆盖。
- 岗位能力结果 `/evaluation/job-ability/results`（list/get/summary/course-scores + aggregate/status）→ `EvaluationJobAbilityController` 覆盖。
- 认证规则 `/evaluation/certifications`（规则/条目/能力点/关联任务/全量/岗位模型，除上述 task-weights 外）→ `EvaluationCertificationController` 覆盖。
- 画像/档案 `/evaluation/portraits`（generate/list/get/student-dashboard/archives）→ `EvaluationPortraitController` 覆盖。
- 申诉 `/evaluation/appeals`（list/get/create/process）→ `EvaluationAppealController` 覆盖。
- 评价批次 `/evaluation/batches`（batch CRUD + status）→ `EvaluationBatchController` 覆盖。
- 场景 `/scene/scenarios`（content 写路由 + clone + snapshot）→ `SceneScenarioController` 覆盖。
- 任务 `/scene/tasks`（CRUD + reorder + list/get）→ `SceneTaskController` 覆盖。
- 测评方式 `/scene/tasks/{taskId}/evaluation-methods`（GET/PUT）→ `SceneEvalMethodController` 覆盖。
- 评分模板 `/scene/rubric-templates` → 覆盖。
- 任务资源 `/scene/task-resources`（list/create/bind/unbind）→ `SceneTaskResourceController` 覆盖。
- 任务绑定 `/scene/task-bindings/{knowledge,ability}` → `SceneTaskBindingController` 覆盖。
- 权重 `/scene/weights`、等级映射 `/scene/grade-mappings` → `SceneWeightController` / `SceneGradeMappingController` 覆盖。
- 场景批次 `/scene/batches` → `SceneBatchController` 覆盖。

## 2. 文件/实体覆盖差距

> 结论：无实质「缺失的 store 对应物」。所有 Go store 表在 Java 侧均有 mapper+实体（或复用已有实体）对应。

### Go store → Java mapper/domain 映射（evaluation）

| Go store | 主要表 | Java mapper | Java domain 实体 |
|---|---|---|---|
| question_banks.go | question_banks / question_bank_knowledge_points | EvaluationQuestionBankMapper | EvaluationQuestionBank |
| questions.go | questions | EvaluationQuestionMapper | EvaluationQuestion |
| exams.go | exams | EvaluationExamMapper | **PortalExam（复用，无独立 EvaluationExam）** |
| exam_questions.go | exam_questions | EvaluationExamQuestionMapper | EvaluationExamQuestion |
| exam_usages.go | exam_usages | EvaluationExamUsageMapper | EvaluationExamUsage |
| exam_usage_config.go | （工具函数，非表） | —（service 内联） | — |
| exam_results.go | exam_results（+course/node/scene 同步写） | EvaluationExamResultMapper | EvaluationExamResult |
| evaluation_results.go | scene_evaluation_results | EvaluationSceneResultMapper | EvaluationSceneResult |
| certifications.go | certification_rules / ability_items / ability_points / related_tasks / weights | EvaluationCertificationMapper / ItemMapper / PointMapper / TaskMapper / WeightMapper | 对应 5 个实体 |
| student_portraits.go | student_ability_portraits / archives | EvaluationPortraitMapper | EvaluationStudentPortrait + EvaluationStudentArchive |
| job_ability_results.go | job_ability_results / job_ability_aggregate_logs | EvaluationJobAbilityMapper | EvaluationJobAbilityResult + EvaluationJobAbilityLog |
| appeal.go | appeal_records | EvaluationAppealMapper | EvaluationAppeal |
| random_draw_questions.go | random_draw_questions | EvaluationRandomDrawQuestionMapper | EvaluationRandomDrawQuestion |
| node_evaluation_results.go | node_evaluation_results | （mapper/lesson）NodeEvaluationResultMapper | （domain/lesson）NodeEvaluationResult |

### Go store → Java mapper/domain 映射（scene / snapshot）

| Go store | 主要表 | Java mapper | Java domain 实体 |
|---|---|---|---|
| scenarios.go | scenarios | SceneScenarioMapper | SceneScenario |
| scenario_tasks.go | scenario_tasks | SceneScenarioTaskMapper | SceneScenarioTask |
| scenario_configs.go | scenario_weight_configs / grade_mappings / task_knowledge_bindings / task_ability_bindings | SceneWeightConfigMapper / SceneGradeMappingMapper / SceneTaskKnowledgeBindingMapper / SceneTaskAbilityBindingMapper | 对应 4 个实体 |
| scenario_clone.go | 克隆逻辑（含 task_deliverables） | SceneCloneMapper | — |
| task_evaluation.go | task_evaluation_methods / eval_points / score_rules / review_steps / rubric_templates | SceneEvalMethodMapper / SceneEvalPointMapper / SceneScoreRuleMapper / SceneReviewStepMapper / SceneRubricTemplateMapper | 对应 5 个实体 |
| resource_bindings（任务资源） | task_resource_bindings | SceneTaskResourceBindingMapper | SceneTaskResourceBinding |
| snapshots.go + snapshot_builders.go | resource_snapshots | EvaluationSnapshotMapper + SceneResourceSnapshotMapper（+ job/JobResourceSnapshotMapper） | EvaluationResourceSnapshot + SceneResourceSnapshot |

### 需留意（非阻断）

- **exams 表无独立 Java 实体**：`EvaluationExamMapper` 复用 `domain/portal/PortalExam`（`BaseMapperPlus<PortalExam, PortalExam>`），字段已通过 Mapper 内手写 SQL 覆盖（code/name/description/status/total_score/duration/cover_image/collaborator_ids/batch_id/version/owner_type/is_temp 等），功能对齐，仅命名不一致，后续可考虑补独立 `EvaluationExam` 实体提升可维护性。
- **snapshot 表被拆成多 Mapper**：Go 是单一 `snapshots.go`，Java 按资源类型拆为 evaluation/scene/job 三处 Mapper + 三个 ResourceSnapshot 实体，属设计差异，功能覆盖。
- **certification_weights 表有实体但缺写入端点**：见第 1 节缺失端点（P1）。

## 3. 字段/方法级差距（抽查）

抽查实体：Scenario / ScenarioTask / SceneEvalMethod / SceneEvaluationResult / ExamResult / Question / CertificationRule。

- 总体：字段对齐良好。jsonb 列在 Java 侧用 String 承载（Service 层 Map 互转），uuid[] 用 `PgArrayTypeHandler`，与 Go `JSONMap/JSONSlice/[]string` 语义等价。
- **方法缺口**：Go `EvaluationService` 存在 `PutCertificationPointTaskWeights`（被缺失端点调用），Java `IEvaluationCertificationService` 无独立对应方法，任务权重只在 `putFullRule` 内联处理（`coalesceTaskWeights`）。
- **字段名一致性风险**：Go `Question.KnowledgePoints` 的 JSON tag 为 `knowledgePoints`（DB 列 `knowledge_point_ids`），Java `EvaluationQuestion` 字段为 `knowledgePointIds`。若 Java 侧 DTO 直接透出 `knowledgePointIds`，前端契约可能与 Go 的 `knowledgePoints` 不一致，需核对 DTO 输出映射。
- **Exam 嵌套 questions**：Go `Exam.Questions []ExamQuestion`（详情返回题目列表），Java 试卷实体复用 `PortalExam`，需确认 list/get 语义是否同样附带 questions（对齐 `GET /evaluation/exams/{id}` 返回形状）。

## 4. 建议迁移项

### P0（阻断）
无。端点面与实体面基本对齐，不存在 Java 无法启动/核心链路缺失的阻断项。

### P1（重要）
1. **补认证「任务权重单点保存」端点**：Go 依据 `handler/certification_model_handler.go`（PutPointTaskWeights）+ `service/evaluation_cert.go`（PutCertificationPointTaskWeights）+ `store/certifications.go`（certification_weights 表）。Java 需补：`EvaluationCertificationController` 增加 `@PutMapping("/positions/{positionId}/points/{abilityPointId}/task-weights")`，`IEvaluationCertificationService`/impl 增加对应方法（只 upsert 当前能力点的 certification_weights、校验任务权重之和=100、不影响其它能力点）。

### P2（次要）
2. **对齐 grade-mappings 删除能力**：Java 多出的 `DELETE /scene/grade-mappings/{id}` 要么删除以保持契约一致，要么反向在 Go `routes_scene.go` + `store/scenario_configs.go` 补同款删除端点，二选一，避免两端契约漂移。
3. **核对 Question 的 `knowledgePoints` 输出 key**：确认 Java DTO 输出字段名与 Go JSON tag（`knowledgePoints`）一致，避免前端适配差异。
4. **核对 Exam 详情返回 questions 数组**：确认 Java `GET /evaluation/exams/{id}` 与 Go `Exam.Questions` 返回形状一致。
5. **可选重构**：为 exams 表补独立 `EvaluationExam` 实体，替换 `PortalExam` 复用，降低跨域耦合。
