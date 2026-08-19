# Job + Lesson 对比差距报告

> Go（Source of Truth）: `backend/go/internal/{handler,service,store,router,domain}`
> Java（复制版）: `backend/java/ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/{controller,service,service/impl,mapper,domain}`
> 对齐口径：Go handler+router 暴露的端点 = Java controller 端点；Go store 文件 = Java mapper + domain 实体；Go service 方法 = Java service/impl 方法。

---

## 1. 接口/路由差距

**结论：端点面已基本对齐（Go 前缀 `/api/v1` 在 router 层统一挂载，Java 各 controller 直接写死 `/api/v1` 前缀，两者一致）。**

### Java 缺失（Go 有、Java 无）

无。逐条核对 job（positions/abilities/position-abilities/position-responsibilities/position-certificates/certificate-library/ability-domains/batches/recommendations/learn-roads/banners/public-positions/landing/favorite/snapshot/workflows/approvals）与 lesson（courses/knowledge-points/nodes/node-evaluation-results/quizzes/node-resources/course-resources/hybrid-modules/batches/behavior-collection）全部端点，Go 侧每个方法+路径在 Java controller 均有对应（含 `registerContentRoutes` 展开的 13 条 CRUD+状态端点、`registerBatchRoutes` 的 6 条、`registerContentWriteRoutes` 的写子集、routes.go 收藏/只读/跨模块引用组的 GET 端点）。

> ⚠ 唯一「路径存在但行为不同」的情况集中在**导入/导出**：Go 的 `POST /import/positions/excel`、`/import/courses/excel`、`/import/granular-courses/excel`、`/export/positions/excel` 等是**真实持久化/完整导出**；Java 同名路径（经 `ImportExportController` 泛化 `/{entity}/excel`）对 positions/courses/granular-courses/questions/schedules/program-courses 是**空实现（仅解析计数）**。见 §3/§4。

### Java 多出（Java 有、Go 无）

- `GET /api/v1/job/recommendations/{id}`（`JobRecommendController`，Go `routes_job.go` 的 recommendations 只有 List/Create/Update/Delete，无 Get 单条）。

---

## 2. 文件/实体覆盖差距

### Java 缺失的 store 对应物

Go store 文件 → 应有 Java mapper/domain 名（标注状态）：

| Go store 文件 | 对应表 | Java 现状 | 状态 |
|---|---|---|---|
| `store/course_assessments.go` | exam_usages/exams/exam_questions（发布生成测评） | 无独立 mapper；逻辑内联在 `LessonCourseServiceImpl`，复用 `EvaluationExamMapper`/`EvaluationExamUsageMapper`/`EvaluationExamQuestionMapper`/`EvaluationQuestionMapper` | ⚠ 部分缺失（`CleanupCourseLevelAssessments`、临时卷 `exam_version` stamp、`NextAutoUsageName` 未实现） |
| `store/position_import_export.go` | 岗位导入导出 SQL | 只有 `ImportExportMapper` 泛化；positions 导入=空实现 | ❌ 行为缺失 |
| `store/course_import_export.go` | 课程导入导出 SQL | 同上；courses/granular-courses 导入=空实现 | ❌ 行为缺失 |
| `store/courses.go` | `courses` 表 | 实体 `domain/portal/PortalCourse` + `mapper/portal/PortalCourseMapper`（**放错包**，非 `domain/lesson`/`mapper/lesson`） | ⚠ 包位置不一致，功能存在 |
| `store/batch_configs.go` | 5 类批次统一模板 | 无统一抽象；岗位批次 `JobBatch`（domain/job）+ 课程批次 `PortalLessonBatch`（domain/portal）拆分 | ⚠ 组织不一致，功能存在 |
| `store/job_ability_results.go` | `job_ability_results` | 实体 `domain/evaluation/EvaluationJobAbilityResult` + `mapper/evaluation/EvaluationJobAbilityMapper`（**跨到 evaluation 域**） | ⚠ 跨域放置，功能存在 |

其余 job/lesson 域 store 文件均有对应 Java mapper + 实体，覆盖完整：
`positions.go`→`JobCareerPosition(+Major/Favorite/ResourceSnapshot)`、`position_bindings.go`→`JobPositionAbilityBinding`、`position_certificates.go`→`JobPositionCertificate`、`certificate_library.go`→`JobCertificateLibraryItem`、`ability_domains.go`→`JobAbilityDomain`、能力点→`JobAbilityPoint`、`learn_roads.go`→`JobLearnRoad`、`banners.go`→`JobBannerConfig`、`recommends.go`→`JobRecommendation`、`batches.go`→`JobBatch`、`course_nodes.go`→`SystemCourseNode`、`node_quizzes.go`→`LessonNodeQuiz(+Question)`、`hybrid_modules.go`→`HybridNodeModule`、`lesson_behaviors.go`→`LessonBehaviorRecord`、`node_evaluation_results.go`→`NodeEvaluationResult`、`resource_bindings.go`→`LessonResourceMapper`、`course_clone.go`→`LessonCourseCloneMapper`。

---

## 3. 字段/方法级差距（抽查）

抽查关键实体（Go domain 结构 vs Java Entity/DTO）：

1. **CareerPosition / JobCareerPosition + `CareerPositionDto`**：DTO 已对齐 Go 全部字段（`majorIds`/`majorNames`/`favoriteCount`/`viewCount`/`abilityCount`/`createdByName`/`collaboratorNames`/`createdAt`/`updatedAt`）。实体 `JobCareerPosition` 本身不含 `majorIds`/`favoriteCount`/`abilityCount` 等**计算字段**（由 service 装配进 DTO），属正常分层差异，非缺失。

2. **Course / PortalCourse + `CourseDto`**：DTO 对齐 Go `Course` 全部字段（含 `evalData`/`knowledgePointNames`/`industryName`/`batchName`/`studyCount`/`viewCount`）。实体 `PortalCourse` 缺 `industryName`/`majorName`/`batchName`/`creatorName` 等**联表/计算字段**，同样装配进 DTO，非缺失。

3. **`generateCourseAssessments`（课程发布生成测评）——确认缺失子步骤**（Java 源码 javadoc 自述）：
   - `CleanupCourseLevelAssessments`：删除历史课程级测评（`target_type='course'` 的 exam_usages + course_homeworks）。Go `store/course_assessments.go:228`。
   - 临时卷 `exam_version` stamping / 快照固化（`SyncTempExamSnapshot`）。Go `CreateTempExam`/`CreateNodeUsage` 创建即 `ResolveResourceVersion` 打版本。
   - `NextAutoUsageName` 同日序号命名（同名安排自动编号）。

4. **导入/导出（抽查）——确认空实现**：
   - `ImportExportServiceImpl.importExcel` 对 `positions`/`scenarios`/`courses`/`granular-courses`/`questions`/`schedules`/`program-courses` 分支全部调 `parseCount()`：只读 Excel 行、计数、返回「成功 N 条」，**不写库**。Go 对应 `position_import.go`（`ImportPositions`→`importResponsibilities`→`findOrCreateCert`→`findOrCreateAbilityPoint`→`ensureAbilityDomain`）与 `course_import.go`（`Import`→`importCourses`→`importNodes`→`createSystemCourseNode`）为完整持久化。
   - 导出：`fillPositions` 仅填 6 列（name/shortName/positionType/salaryMin/salaryMax/description），缺失「工作职责与能力点」第二 Sheet（职责/能力点/证书/领域）；`fillSystemCourses` 仅 2 列、`fillGranularCourses` 仅 4 列。Go `position_export.go.FillPositionsData` 双 Sheet 完整导出。

5. **审批引擎**：`JobApprovalServiceImpl` 非空实现，已覆盖工作流步骤（any/all 模式）、history 追加去重、CAS 推进、终态同步实体状态，javadoc 中「演示环境按 Go 语义简化」仅是措辞，逻辑与 Go `approval.go` 对齐，无实质缺失。

---

## 4. 建议迁移项（按优先级）

### P0（阻断：接口存在但空实现/静默丢数据）

1. **岗位 Excel 导入落库**：Go 依据 `backend/go/internal/service/position_import.go`。Java 需在 `ImportExportServiceImpl.importExcel` 的 `positions` 分支把 `parseCount` 换成真实导入：岗位基本信息落库 + 工作职责（`importResponsibilities`）+ 证书 find-or-create（`findOrCreateCert`）+ 能力点 find-or-create（`findOrCreateAbilityPoint`）+ 能力域 `ensureAbilityDomain`，并支持 overwrite/rename/错误逐行报告。
2. **课程 Excel 导入落库**：Go 依据 `backend/go/internal/service/course_import.go`。Java 需把 `courses`/`granular-courses` 分支 `parseCount` 换成真实导入：课程主表 + 节点（`importNodes`/`createSystemCourseNode`）+ 知识点/能力点关联 + `clearCourseNodes`。
3. **岗位/课程 Excel 导出补全**：Go 依据 `position_export.go`、`course_export.go`。Java `fillPositions`/`fillSystemCourses`/`fillGranularCourses` 需补全「工作职责与能力点」「节点配置」第二 Sheet 及全部列，而非只填 2~6 列。

### P1（重要：业务逻辑缺失）

4. **课程发布测评生成补全**：Go 依据 `store/course_assessments.go`。Java `LessonCourseServiceImpl.generateCourseAssessments` 需补 `CleanupCourseLevelAssessments`（发布前清理历史课程级测评）、临时卷 `exam_version` stamping、`NextAutoUsageName` 同名序号命名。
5. **课程实体归位**：将 `PortalCourse`（domain/portal）+ `PortalCourseMapper` 迁为 `domain/lesson/LessonCourse` + `mapper/lesson/LessonCourseMapper`，使 lesson 模块课程 CRUD 落在 lesson 域，符合框架「Controller→Service→Mapper 按模块分域」约定。

### P2（次要：组织/命名一致性）

6. **job_ability_results 跨域归位**：Go `store/job_ability_results.go` 属 job 域，Java 现放 evaluation 域（`EvaluationJobAbilityResult`）。评估是否在 job 域建 `JobAbilityResult` mapper/实体，或明确记录为「岗位能力结果归 evaluation 域」的设计决策。
7. **批次统一抽象**：Go `store/batch_configs.go` 统一 5 类批次模板；Java 拆为 `JobBatch` + `PortalLessonBatch`（跨 domain/job、domain/portal）。评估是否抽取统一 Batch 基类/服务。
8. **多出端点确认**：`GET /api/v1/job/recommendations/{id}` 为 Java 多出（Go 无）。确认是刻意保留（前端已用）还是删除对齐。

---

*本报告由代码对比审计子代理生成；端点/字段覆盖为静态对比结论，导入导出行为差异已读源码确认。*
