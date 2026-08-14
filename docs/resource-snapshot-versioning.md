# 资源快照与版本固化改造方案

> 状态：已实施（migration 158 落地，见 ADR-0006）；2026-08-13 二次评估修订（代码核查后，修订记录见第 13 节）。
> 本文档为"资源（岗位/场景/课程/题库/试卷）发布后编辑不影响历史学习/测评数据"需求的唯一改造方案出处。

## 1. 背景与问题

系统中的核心资源（岗位、场景、课程、题库、试卷）发布后，学生即可学习/测评，教师进行打分。现状存在以下问题：

- `version` 仅是展示字符串，发布时 +0.1（`backend/internal/store/content_actions.go` `NextVersion`），发布 = **原地覆盖同一行数据**，编辑后旧内容彻底丢失。
- 学习/成绩记录**裸引用资源 id**：`scene_evaluation_results.task_id`（软引用）、`node_evaluation_results.node_id`、`course_evaluation_results.course_id`、`exam_results → exam_usages → exam_id`。资源改版后，历史成绩的上下文随之漂移。
- 排课（`schedule_entries`）只过滤工作台列表，与内容读取完全解耦；学生直接访问 URL 可读**任何同租户内容（含 draft）**。
- 仅有的快照先例：
  - `exam_questions`：试卷题目内容副本（内容已复制），但 `question_id` FK CASCADE，**删题会级联毁掉已发布试卷的题目行**；
  - `scene_archives`：建表未启用（代码零引用）；
  - 三个 Clone store（`position_clone.go` / `scenario_clone.go` / `course_clone.go`）：整树深拷贝实现，可复用字段清单。

**需求**：管理员发布后对资源编辑修改，不得影响已产生学生学生学习/教师测评的数据。

## 2. 已确认决策

| # | 决策 | 说明 |
|---|------|------|
| 1 | **发布即快照** | 五类资源 publish 时事务内生成整树快照（简单、可预测） |
| 2 | **快照连带冻结被引用实体** | 知识点、能力点、资源库条目、颗粒课（一层）、关联岗位树一并写入快照 jsonb，彻底隔离漂移 |
| 3 | **未排课学生自由预览已发布资源** | 默认读最新已发布快照；**提交测评不新增排课门禁**（保持现状） |
| 4 | 成绩表加 `version` 列，提交时由**服务端**盖章固化 | 前端不可伪造 |
| 5 | 版本号沿用 V+0.1（`NextVersion`） | 与现有 `149_version_normalize` 迁移对齐 |
| 6 | **删除保护** | 存在成绩记录或活跃绑定的资源禁止物理删除 |
| 7 | 学生角色不得再读到 draft 内容 | 顺带修复现存越权漏洞 |

## 3. 总体架构

- **发布即快照**：`ContentActionStore.Transition` 流转到 published 时（CAS 状态更新 → 版本 bump → 用户 hook 后），把资源整树深拷贝为 jsonb 写入通用快照表 `resource_snapshots`，`UNIQUE(resource_type, resource_id, version)` 幂等去重。
- **绑定固化**：排课发布时给 `schedule_entries` 打 `resource_version`；考试安排创建/发布/复用时打 `exam_version`（含课程发布 hook `GenerateCourseAssessments` 自动生成的 node/task 级临时考试）。
- **提交固化**：四张成绩表加 `version` 列，服务端盖章（场景→场景版本、节点→课程版本、考试→安排 `exam_version`）。
- **读取快照化**：新增 bundle 接口 `GET /{base}/{id}/snapshot?version=`，单次返回整树（含连带引用）；学习页/打分详情页改走 bundle。版本解析顺序：**绑定版本 > URL `?v=` > 最新已发布快照**；快照缺档且 version==live 当前版本时回退 live（兼容历史数据），**但仅当 live `status='published'` 才回退，否则 404**——版本 bump 只发生在发布时，转草稿编辑期间 version 不变，不加此条件改造前的历史资源一旦转草稿，学生回退 live 会读到 draft（违反决策 7）。
- **题目保护**：`exam_questions.question_id` FK 改 `ON DELETE SET NULL`，删题不毁已发布试卷。

### 跨版本数据地图

| 环节 | 写入/读取 | 作用 |
|---|---|---|
| 资源发布 | `resource_snapshots` 每版一份 jsonb，永不删除、无 FK | 内容不可变 |
| 排课发布 | `schedule_entries.resource_version` | 决定班级学哪版 |
| 考试安排 | `exam_usages.exam_version` | 决定考试答哪版 |
| 学生提交 | 成绩表 `version` 服务端盖章 | 决定成绩属于哪版 |
| 学习读取 | bundle `?version=`：排课版本 > URL ?v= > 最新快照 | 学生所见固定 |
| 教师打分 | bundle `?version=result.version` | 打分上下文恒定 |

## 4. 数据层（migration `158_snapshot_versioning`）

```sql
CREATE TABLE resource_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  resource_type varchar(32) NOT NULL,  -- career_positions|scenarios|courses|exams|question_banks
  resource_id uuid NOT NULL,
  version varchar(32) NOT NULL,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_resource_snapshots UNIQUE (resource_type, resource_id, version)
);
CREATE INDEX idx_resource_snapshots_res ON resource_snapshots (resource_type, resource_id);

ALTER TABLE schedule_entries ADD COLUMN resource_version varchar(32);
ALTER TABLE exam_usages    ADD COLUMN exam_version varchar(32);
ALTER TABLE scene_evaluation_results  ADD COLUMN version varchar(32);
ALTER TABLE node_evaluation_results   ADD COLUMN version varchar(32);
ALTER TABLE course_evaluation_results ADD COLUMN version varchar(32);
ALTER TABLE exam_results              ADD COLUMN version varchar(32);

ALTER TABLE exam_questions ALTER COLUMN question_id DROP NOT NULL;
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;
```

回填（尽力而为，历史精度仅影响改造前产生的数据）：
- `schedule_entries.resource_version` ← 当前 course/scenario 的 version（按 course_id/scenario_id JOIN）
- `exam_usages.exam_version` ← `exams.version`
- 四张成绩表 `version` ← 各自资源链当前版本：
  - `scene_evaluation_results` 经 `scene_id`（可空，空则留空）
  - `node_evaluation_results` 经 `node_id → system_course_nodes.course_id → courses`
  - `course_evaluation_results` 经 `course_id`
  - `exam_results` 经 `exam_usage_id → exam_usages.exam_version`

`.down.sql` 镜像回滚（删列、删表、恢复 FK CASCADE + NOT NULL）。快照表**无 FK**，资源物理删除不影响快照。

## 5. 后端改造

### 5.1 快照写入

- 新 `backend/internal/store/snapshots.go`：`SaveSnapshot`（upsert）/ `GetSnapshot` / `LatestVersion`。
- 新 `backend/internal/store/snapshot_builders.go`：5 个 builder，字段清单复用 `position_clone.go` / `scenario_clone.go` / `course_clone.go`（**优先复用其列常量，降低 schema 字段漂移风险**；注意仅 `scenario_clone.go:165` 有 `TaskInsertColumns` 常量，`position_clone.go` / `course_clone.go` 为内联列字面量，实施前需先提取为常量）：
  - `BuildScenarioSnapshot`：scenarios + scenario_tasks + task_evaluation_methods / task_eval_points / task_eval_score_rules / task_review_steps / task_deliverables + scenario_weight_configs / scenario_grade_mappings + 三张绑定表 + 连带 SELECT 知识点/能力点/资源库条目 + 关联岗位树（职责、能力绑定、领域、证书）。
  - `BuildCourseSnapshot`：courses + system_course_nodes + node_quizzes / node_quiz_questions + hybrid_node_modules + 节点绑定 + 连带知识点/资源 + 节点引用的颗粒课（**主表+节点+节点测验+混合模块，一层**，防递归；**system_course_nodes 字段清单须显式含 `eval_data`**——lesson 系测评配置不发 API、内联在节点 JSON（`lesson/landing/[id]/page.tsx:197-236`），漏掉则测评标准仍漂移）。
  - `BuildExamSnapshot`：exams + exam_questions。
  - `BuildQuestionBankSnapshot`：bank + 已发布 questions。
  - `BuildPositionSnapshot`：岗位全树（**补上 clone 缺失的 certification_rules 链**）。
- 挂载点：`backend/internal/store/content_actions.go` `Transition`（L127-184）——CAS 状态更新 → 发布时版本 bump → 用户 hook（课程 `GenerateCourseAssessments`）→ **统一写快照**。五类资源 publish 零 handler 改动，同事务保证一致性；**快照构建失败 → 发布事务回滚，无半成品快照、无"已发布但无快照"状态**。
- **审批通过路径不走 Transition**：`ApprovalService.ReviewApproval`（`service/approval.go:27-64`）只做 `SyncEntityStatus(approved)` + `MergeSourceEditDraft`（approval.go:53），不 bump 版本、不触发 hook；须与 5.5 联盟 `Merge*DraftToSource` 一并盘点"内容覆盖但不走 Transition"的入口，统一在覆盖事务内补 bump + 快照。
- **临时考试兜底**：node/task 级 temp exam 不走 Transition（`CreateTempExam` 直接 published）；在 `task_evaluation.go` `EnsureExamUsageForMethod`、`lesson_content.go` / `course_assessments.go` 的 ensure* 与 `SyncExamQuestions` 调用点，每次触碰时补写 temp exam 快照并刷新 `exam_usages.exam_version`（防课程再版 SyncExamQuestions 覆盖旧安排题目内容）。

### 5.2 快照读取（bundle 接口）

- 新 `backend/internal/service/snapshot.go` + `backend/internal/handler/snapshot_handler.go`：
  - `GET /scene/scenarios/{id}/snapshot?version=`
  - `GET /lesson/courses/{id}/snapshot?version=`
  - `GET /evaluation/exams/{id}/snapshot?version=`
  - `GET /evaluation/question-banks/{id}/snapshot?version=`
  - `GET /job/positions/{id}/snapshot?version=`
  - 租户校验；`version` 缺省 = 最新已发布快照；缺档且 version==live 当前版本 → 回退 live，**但仅当 live `status='published'` 才回退，否则 404**（转草稿编辑期间 version 不变，不加此条件学生回退 live 会读到 draft，违反决策 7）。
- **安全要求（必须）**：bundle 内嵌客观题答案字段（`node_quiz_questions.answer`、`exam_questions.answer/analysis` 等）；学生角色请求时必须剥离答案/解析字段，与现有 `GET /evaluation/exams/{id}` 的学生剥离逻辑（`exam_handler.go` L86-91）保持一致。
- 存量接口加固（越权面比单纯 Get 大）：
  - Get：scenario / course / exam / question_bank 的 Get，学生角色且 status≠published → 404（现状 `scenario_handler.go:114-140`、`course_handler.go:99-120`、`exam_handler.go:60-93` 均不过滤 status）。
  - List：学生列表同样须过滤 status（现状 `scenarios.go:47-54`、`courses.go:45-62` 仅排除 archived，draft 对学生可见）。
  - exam Get 的 is_temp 处理：现状仅 List 过滤 is_temp（`exams.go:315`），Get 不过滤，加固时须显式隐藏临时试卷。
  - **temp exam 豁免/统一**：课程侧 `CreateTempExam` 建 published（`store/course_assessments.go:118`）、任务侧 `createTempExam` 建 **draft**（`store/task_evaluation.go:454`），学生作答任务测评走 `GET /evaluation/exams/{id}`，直接 404 会崩 → 加固规则须对 `is_temp` 豁免，或借本次改造统一 temp exam 为 published（推荐后者）。

### 5.3 绑定与提交固化

- `backend/internal/store/scheduling.go` `PublishScheduleEntries`（L689-717）：复制 draft 为 published 行时打 `resource_version`（以快照表最新版本为准；快照缺档回退 live version）。
- `backend/internal/store/exam_usages.go` Create / Publish / Update：打 `exam_version`；**examId 不可变**（`Update` SQL 不含 exam_id 列，handler 注释明示"更新流程忽略 examId"，`exam_usage_handler.go:18`），换绑试卷 = 删旧建新，受删除保护约束。
- `backend/internal/store/evaluation_results.go` Submit、`backend/internal/store/node_evaluation_results.go` Submit、`backend/internal/service/evaluation_result.go` SubmitExamResult + SyncCourse/Node/SceneEvaluation：服务端解析版本盖章；INSERT 带 version；`ON CONFLICT DO UPDATE SET version=excluded.version`（未评分重交时更新为新版本，与现有 `WHERE graded_at IS NULL` 子句兼容）。
  - 三个 Sync 函数（`SyncSceneEvaluation` / `SyncCourseEvaluation` / `SyncNodeEvaluation`，`store/exam_results.go:329-471`）的 UPSERT 用 CASE 保护已评分行、**无** `WHERE graded_at IS NULL` 子句，其 version 更新语义须明确：**已评分行 version 不动，未评分行随 EXCLUDED 更新**，与两个 Submit 对齐。
- **并发窗口消除**：前端提交时携带"页面加载时的版本"提示；服务端校验该版本快照存在则采纳，否则回退最新。注意这是"版本无效回退最新"的**降级语义**，与 `TaskEvaluationMethod.version` 乐观锁模式（advisory 锁 + 单调版本 + **冲突即拒绝 409**，`service/task_evaluation.go:34-50`）语义相反，**勿照乐观锁实现成拒绝式**。
- `backend/internal/store/portal.go` StudentScheduleRow / StudentCourseRow / SceneTaskRow + dashboard 事件：下发 `resource_version`。

### 5.4 判分快照化

- `backend/internal/service/evaluation_result.go` SubmitExamResult（L79-86 读题判分）与 GradeExamResult：改从 `exam_usages.exam_version` 对应快照读题，不再读活 `exam_questions`。
- **总分/及格线同须快照化**：`UsageExamInfo`（`store/exam_results.go:126-138`）现从 live `exams.total_score`（缺省回退 `SUM(exam_questions.score)`）取总分、`is_pass` 按 60% 判定；试卷再版改题目分值后，历史卷总分与及格判定仍会漂移 → total_score 及及格线口径改从快照 jsonb 取。
- **反向回写链**：教师场景评分 `GradeEvaluationResult` / `BatchGradeEvaluationResults` → `syncExamResultScoreTx` → `FindLatestExamResult`（`store/evaluation_results.go:151-177`，live JOIN `task_evaluation_methods.resource_config`）回写 exam_results；资源改版后该 JOIN 可能找不到/找错对应考试记录 → 改按 `exam_usages.exam_version` / `result.version` 定位，纳入本方案改造范围。

### 5.5 修复既有债

- 联盟共建 `backend/internal/store/alliance_source_edit_store.go` `MergePositionDraftToSource` / `MergeScenarioDraftToSource`：合并覆盖后未走 Transition（无版本 bump、无快照）→ 合并事务内补 bump + 快照。
- **删除保护**（存在成绩记录或活跃绑定时拒绝物理删除，返回明确错误码）：
  - exams：存在 exam_results → 拒删
  - exam_usages：存在 exam_results → 拒删
  - scenarios：scene_evaluation_results 经 task_id / scene_id 存在 → 拒删
  - tasks / nodes：对应结果表存在 → 拒删
  - courses：node/course_evaluation_results、作业提交存在 → 拒删
  - positions：存在 job_ability_results / student_ability_portraits / 被已发布场景引用 → 拒删
- 提交时确保 `scene_evaluation_results.scene_id` 落库（打分页回溯入口，现可空）：**以 `task_id → scenario_tasks.scenario_id` 服务端反查为准并纠正客户端传值**——handler 现状不校验 sceneId↔task 一致性（`evaluation_result_handler.go:144-148` 空串转 NULL 了事），客户端 body 的 sceneId 不可信，落客户端值等于没修；现成反查先例：`store/task_evaluation.go:226-235` TaskScenarioName。

### 5.6 测试

- store 单测：snapshot builder 往返、版本解析、NextVersion 回归、**builder 字段清单与 clone 列常量一致性**。
- handler 集成（TEST_DATABASE_URL）：发布落快照幂等、`?version=` 读快照、学生读 draft 404、bundle 学生答案剥离、提交盖章 version、打分按旧版本读、删题保留 exam_questions、删除保护。
- 遵循 AGENTS.md：新接口至少 handler/service/store 测试一种。

## 6. 前端改造

- `packages/api-client` + `packages/shared-types`：新增 `getSnapshot(id, {version})` ×5 与 bundle 类型；结果类型加 `version?`、ScheduleEntry 加 `resourceVersion`。
- 学习页走 bundle：`apps/edu/app/scene/landing/[id]/page.tsx`、`scene/landing/[id]/learn/page.tsx`、`lesson/landing/[id]/page.tsx`、`lesson/landing/[id]/learn/page.tsx`（URL `?v=` 或默认最新；替换 5-6 次多接口组装，知识点/能力点/资源映射从 bundle 取）。
- 题库浏览 `apps/edu/app/evaluation/landing/banks/[id]/page.tsx`：走 bank bundle。
- 考试作答 `apps/edu/app/evaluation/landing/exams/[id]/page.tsx`：按 `currentUsage.examVersion` 取 exam bundle；**绕开 data-provider 缓存是必修前置而非风险项**——命中缓存即不请求（`page.tsx:74-76`），不绕开则版本切换不生效。
- 打分详情按 `result.version` 取 bundle：`apps/edu/app/evaluation/scene-results/[id]/page.tsx`、`lesson-results/[id]/page.tsx`、`lesson-results/daily-exams/[resultId]/page.tsx`，替换 `taskApi.get` / `listMethods` / `examApi.get` 活读；random_draw 题目**优先用 `scene_evaluation_results.drawn_questions` 内快照**（jsonb 已存抽题结果，`evaluation_results.go:86-104`），bundle 兜底（见 8.2）。
- **顺带收益**：scene 学习页现拉**全站** resourceLibrary / knowledge / ability 全表再按 id 过滤（`scene/landing/[id]/page.tsx:381-454`），bundle 按场景裁剪后天然修复该性能隐患。
- 提交 payload 携带页面加载时的版本提示。
- 工作台/入口链接带 `?v=resourceVersion`：`?v=` 链接共 **9 处**——除 `my-schedule-tab.tsx`、`learning-tab.tsx`、`workspace-schedule-grid.tsx`、`teacher-*-tab.tsx` 外，还有 `assessment-tab.tsx:277-282`、`exam-center-card.tsx:42`、`scene/landing/[id]/learn/page.tsx:221-228`、`lesson/landing/[id]/learn/page.tsx:224-231`、`hybrid-modules-view.tsx:265`；现状 9 处均为模板字符串内联拼接，建议新增 `lib/learn-links.ts` 统一拼链接。
- **版本字段需后端配套下发**：上游数据（课表 entry、工作台 event、exam-center item、method resourceConfig）目前均不含版本字段，仅改 5.3 所列 portal 三处 Row 不够，否则前端空转。
- 结果列表加版本徽章（可选）。

## 7. 业务流程时序（改造后模拟）

### 7.1 场景实践课（最完整链路）

1. 教师建场景草稿（3 任务+测评标准）→ 审批 → **发布 V1.0** → 事务内生成快照 S1（任务、测评方法、评分点、评分规则、知识点、能力点、资源条目、关联岗位）。
2. 教务排课给"电商2301班" → **发布课表** → 排课行 stamp `resource_version=V1.0`。
3. 学生A（该班）工作台点开 → `/scene/landing/{id}?v=V1.0` → `GET .../snapshot?version=V1.0` → 全部内容来自 S1。
4. 学生B（未排课）直接访问 → 无 v → **默认最新快照 S1**，自由预览；提交测评不受限（保持现状）。
5. 学生A 提交任务测评 → 服务端盖章 `version=V1.0` → `scene_evaluation_results`（答案快照+版本）。
6. 教师打分详情 → 读 `result.version=V1.0` → 取 S1 中该任务测评方法/评分点 → 打分界面与学生当时所见一致。
7. 管理员转草稿改任务名/权重 → 期间学生仍读 S1，**draft 对学生不可见**。
8. 再发布 **V1.1** → 生成 S2，S1 永久保留。
9. 新班级排课 → 绑定 V1.1 读 S2；学生B 预览自动切到 S2。
10. 教师翻学生A 历史成绩 → 仍按 V1.0 读 S1：旧任务名、旧权重、旧标准完整还原。
11. 管理员想删场景 → 存在成绩 → 删除保护拒绝。

### 7.2 课程再版与节点考试（最易漂移的路径）

1. 课程**发布 V1.0** → 事务内顺序：版本 bump → `GenerateCourseAssessments` 生成节点考试安排（temp exam E + usage U，`exam_version=V1.0`）→ 写课程快照 C1（节点、quiz 题目、混合模块、连带颗粒课）。
2. 排课绑定 V1.0；学生做题 → 作答页按 `U.exam_version=V1.0` 取考试快照答题 → 交卷按快照判分，`exam_results`/`node_evaluation_results` 盖章 V1.0。
3. 管理员改节点测评配置再发布 **V1.1** → hook 复用同一 temp exam E 重新同步题目（E 活内容被覆盖），**同步点自动补写 E 新快照、刷新 `U.exam_version=V1.1`** → 生成 C2。
4. 旧学生已交卷成绩按 V1.0 旧题快照回看打分；新学生按 V1.1 新题作答。同一安排下两批人互不干扰（各按 result.version 回溯）。
5. 老学生课表未重新发布 → 仍带 V1.0 → 打开课程仍见 C1（按排课版本学习，符合预期）。

### 7.3 试卷

1. 选题发布试卷 P **V1.0** → `exam_questions` 复制题目内容 + 试卷快照 P1。
2. 建考试安排 U（班级定向）→ `exam_version=V1.0`；发布 U。
3. 学生作答（P1 题目）→ 交卷盖章 V1.0 + answers。
4. 管理员**改题库题目** Q1 → 不影响 P（副本）也不影响 P1。
5. 管理员**改试卷再发布 V1.1** → exam_questions 覆盖为新内容 + 快照 P2。
6. 旧安排 U 仍绑 V1.0 → 该班学生继续答旧题；教师打分按 `result.version` 读 P1。
7. **删除题目 Q1** → question_id 置 NULL，exam_questions 内容行保留，试卷/成绩无恙。
8. 删除试卷 P → 有成绩 → 删除保护拒绝。

### 7.4 岗位

1. 岗位发布 V1.0 → 快照 J1（职责/能力绑定/证书/认定规则）。
2. 场景引用该岗位 → 场景快照连带嵌入 J1 内容。
3. 管理员改岗位能力点再发布 V1.1 → J2；已发布场景内嵌岗位不变，学生看到不变。
4. 学生完成岗位能力测评（`job_ability_results`）→ 岗位删除被拒绝。

### 7.5 题库浏览

- 题库发布 → 快照 B1（含题目内容）；学生访问 `evaluation/landing/banks/{id}` → bundle 读 B1；再版 → B2，新访问自动最新。题库本身无成绩记录，纯展示，快照保证"浏览到的是发布时内容"。

### 7.6 排课重发布

- 每学期重新发布课表 = 覆盖 published 行 + 重新 stamp 各条目 `resource_version`（当时最新快照）；学生课表跳转带新版本；老成绩按各自 result.version 回溯，完全不受影响。

## 8. 边界与已知取舍

1. 打分列表聚合页用 live 名称聚合，详情按版本读——名称级微漂移，版本徽章提示。
2. 历史成绩回填尽力而为；改造前数据的快照缺档回退 live。
3. 快照随发布次数增长（单行 jsonb，成本低）；后续可加 GC（无绑定/成绩引用的旧快照）。
4. 同一考试安排被课程两版共用：作答页按 usage.exam_version，已交卷成绩按 result.version 各自回溯，互不干扰。
5. 教师角色读 landing 仍为 live（教师即编辑者，可预览 draft），有意保留。
6. 归档资源 bundle 仍可读（"最后发布快照"语义），可选后续加 404。
7. `lesson_behavior_records` 只存考勤/互动数字，无内容语义，不受影响；homework 相关表无代码路径（休眠），不在范围。
8. **random_draw 漂移缺口（已纳入方案）**：打分页 `scene-results/[id]` 原从 live `random_draw_questions` 读抽题内容，管理员编辑抽题会使历史打分上下文漂移 → 场景快照连带嵌入 `resource_config.selectedQuestionIds` 对应的 random_draw_questions 内容，打分页从 bundle 读取。
9. **bundle 答案泄漏（已纳入方案）**：见 5.2 安全要求。
10. **正式试卷独立再发布不回溯刷新既有 `usage.exam_version`**：paper 测评方式直接引用正式试卷（`task_evaluation.go:376-381`），试卷自身再发布不经 SaveMethods 触碰既有 usage → 既有 usage 保持 stamp 旧版，即固化语义（明示取舍，不跟随最新）。
11. **"绑定版本"解析主体 = 前端工作台链接拼 `?v=`**：bundle 接口只有 version 参数；学生直访无 v 时看的是最新快照而非其班级排课版本（已排课学生直访也会看到新版），属已知取舍；如不接受需服务端按学生班级反查 schedule_entries（本方案不做）。
12. **temp exam 两路径状态不一致**（课程侧 published / 任务侧 draft，见 5.2）：借本次改造统一为 published。
13. **快照表无 FK 是刻意设计**（资源物理删除不影响快照），migration 注释中说明设计意图；项目 115/116 惯例为全库补 FK，但 `scene_evaluation_results.task_id` 无 FK 已有先例。
14. **bundle 契约 = "教学内容 + 测评配置"**：myResults、examUsage 时间窗/时长、学生姓名等动态数据不进快照 jsonb，仍走现有接口。
15. **`versionedContentTables` 白名单仅 5 表**（`content_actions.go:25-31`）：training_programs / teaching_plans 发布不 bump 版本（本方案范围恰为这 5 类；后续扩展需注意），且 teaching_plan 也挂 Transition hook（MarkConfirmed），快照挂点实现须按资源类型过滤。

## 9. 实施阶段

每阶段经 `./deploy.sh --branch` 部署验证；bundle 接口纯增量，阶段 3 前端切换前旧页面不受影响：

1. **阶段 1**：migration 158 + 快照表/写入/读取 + Transition hook + bundle 接口 + 学生 draft 404（后端独立可验收）
2. **阶段 2**：绑定/提交盖章 + 判分快照化 + 联盟合并修复 + 删除保护
3. **阶段 3**：前端 bundle 化 + 链接带版本 + 提交版本提示
4. **阶段 4**：测试补全 + 全量回归

### 验收标准

- 发布场景 → 编辑 → 再发布：老成绩打分页按旧版本内容显示，新成绩按新版本
- 未排课学生可预览已发布内容，draft 不可见；工作台入口带版本跳转
- 删题库题目不影响已发布试卷；删除有成绩的资源被拒绝
- 课程再版后，旧考试安排的题目内容不变

## 10. 风险评估与回滚

| 风险 | 等级 | 缓解 |
|---|---|---|
| 快照构建失败导致发布失败 | 低 | 事务内构建，失败即回滚；builder 逐类型独立测试 |
| bundle 答案泄漏 | 高 | 5.2 安全要求必做，handler 集成测试覆盖 |
| temp exam 兜底漏调用点 | 中 | 全量盘点 SyncExamQuestions / EnsureExamUsageForMethod / ensureNodePaperUsage / ensureNodeQuestionExam / createTempExamUsage 调用方（见 11.2） |
| schema 字段漂移（builder 与 live 表不同步） | 中 | 复用 clone 列常量 + 一致性测试 |
| 前端 data-provider 缓存旧数据 | 中 | 作答页绕开缓存直读 bundle 为必修前置（命中缓存即不请求，`evaluation/landing/exams/[id]/page.tsx:74-76`） |
| 改造前历史数据回填不精确 | 低 | 仅影响旧数据；快照缺档回退 live |

回滚：migration 有 `.down.sql`；bundle/快照为增量能力，回滚 = 前端改回 live 调用 + 移除 Transition hook（旧数据无损）。

## 11. 待评估 Agent 重点审查项

1. 快照写入时序：Transition 内 CAS → bump → hook → 快照的顺序是否与课程 `GenerateCourseAssessments` 兼容（快照需包含 hook 写回的 usageId）。
2. temp exam 兜底快照是否会遗漏调用点（全量盘点 10 节所列函数）。
3. `ON CONFLICT DO UPDATE SET version=excluded.version` 与现有 `WHERE graded_at IS NULL` 子句的交互。
4. 删除保护对现有删除接口（含 alliance 侧、任务/节点级删除）的影响面。
5. 快照 jsonb 与 live 表字段漂移风险（未来加字段需同步 builder）。
6. 前端 bundle 化对 `data-provider` 缓存与既有页面（landing/learn/打分/题库浏览）的兼容。
7. bundle 学生角色字段剥离是否覆盖全部内嵌答案字段（exam_questions、node_quiz_questions、hybrid_module.data、random_draw_questions）。

## 12. 最终审查修订记录（2026-08-13）

写入前的最后一轮审查，新增以下缺陷与优化（已并入正文）：

1. **【缺陷-安全】bundle 答案泄漏**：场景/课程/题库快照内嵌客观题答案字段，学生角色必须剥离 → 5.2 安全要求 + 测试。
2. **【缺陷】random_draw 抽题漂移**：打分页原从 live random_draw_questions 读题目 → 场景快照连带嵌入，打分页改读 bundle → 8.8。
3. **【明确化】颗粒课嵌入范围**：主表+节点+节点测验+混合模块，一层防递归 → 5.1。
4. **【优化】字段漂移缓解**：builder 复用 clone store 列常量 + 一致性测试 → 5.1/5.6。
5. ~~**【缺陷】exam_usage Update 改 examId 需重新 stamp** → 5.3~~（经二次评估修正：Update 不支持改 examId，examId 不可变，见 13.B1）。
6. **【一致性】快照构建失败 → 发布事务回滚**，无"已发布无快照"状态 → 5.1。
7. **【优化】并发窗口**：前端提交带加载版本，服务端校验采纳 → 5.3。
8. **【兼容性】bundle 纯增量**，前端切换前旧页面不受影响，回滚路径明确 → 9/10。

## 13. 二次评估修订记录（2026-08-13）

代码核查（写入时序/temp exam、提交/判分、排课/删除/联盟、前端学习/打分/缓存四路）后的修订，已并入正文：

1. **【缺陷-安全】A1**：快照缺档回退 live 未校验 status，转草稿编辑期间学生可读到 draft → 回退附加 `status='published'` 条件，否则 404 → 3、5.2。
2. **【缺陷】A2**：学生 GET 加固 404 会误伤任务侧 draft temp exam（`task_evaluation.go:454`）→ 加固规则对 is_temp 豁免，或借改造统一 temp exam 为 published → 5.2。
3. **【缺陷-安全】A3**：越权面比方案大，加固范围扩到 List 状态过滤（`scenarios.go:47-54`、`courses.go:45-62`）+ exam Get 的 is_temp 处理（现状仅 List 过滤）→ 5.2。
4. **【缺陷】A4**：审批路径 `ApprovalService.ReviewApproval`（`service/approval.go:27-64`）不走 Transition、不 bump 版本、不触发 hook → 与联盟 Merge*DraftToSource 一并盘点，覆盖事务内补 bump+快照 → 5.1。
5. **【缺陷】A5**：总分/及格线（`UsageExamInfo` total_score 及 is_pass 口径，`store/exam_results.go:126-138`）也是 live 读 → 判分快照化须从快照取 → 5.4。
6. **【缺陷-安全】A6**：sceneId 来自客户端 body 且 handler 不校验 → 盖章与 scene_id 回填以 `task_id → scenario_tasks.scenario_id` 服务端反查为准 → 5.5。
7. **【缺陷】A7**：三个 Sync 函数（`store/exam_results.go:329-471`）是 CASE 保护而非 WHERE 子句 → 明确版本语义：已评分行 version 不动，未评分行随 EXCLUDED 更新 → 5.3。
8. **【缺陷】A8**：`GradeEvaluationResult` → `syncExamResultScoreTx` → `FindLatestExamResult`（`store/evaluation_results.go:151-177`，live JOIN resource_config）反向回写链遗漏 → 纳入改造范围 → 5.4。
9. **【修正】B1**：删去"Update 变更 examId 时重新 stamp"空转条款（Update 不支持改 examId，`exam_usage_handler.go:18`）→ 改为 examId 不可变、换绑=删旧建新、受删除保护约束 → 5.3（12.5 已标注修正）。
10. **【修正】B2**：提交盖章是"版本无效回退最新"的降级语义，与 `TaskEvaluationMethod.version` 乐观锁（冲突即拒绝 409）相反 → 勿照乐观锁实现 → 5.3。
11. **【修正】B3**：列常量仅 `scenario_clone.go:165` 有 `TaskInsertColumns`，position_clone/course_clone 为内联字面量 → 实施前需先提取常量 → 5.1。
12. **【修正】B4**：FK 约束名改为与 baseline 一致的 `exam_questions_question_id_fkey` → 4。
13. **【明确化】C 组**：正式试卷再发布不回溯刷新既有 usage.exam_version、"绑定版本"解析主体=前端工作台拼 `?v=`、temp exam 两路径状态统一、快照表无 FK 系刻意设计、bundle 契约=教学内容+测评配置、versionedContentTables 白名单仅 5 表 → 8.10-8.15。
14. **【优化】D 组**：`?v=` 链接共 9 处且版本字段需后端配套下发（建议 `lib/learn-links.ts` 统一拼链接）、data-provider 缓存升级为必修前置、BuildCourseSnapshot 显式含 eval_data、scene 学习页全表拉取由 bundle 顺带修复、random_draw 优先 result 内快照 bundle 兜底 → 6、10。

顺带发现的两个既有 bug（已在阶段 2b 顺带修复）：

- ~~`store/exam_usages.go:156-159` Delete SQL 缺 tenant_id 条件~~（已补 tenant_id 条件）。
- ~~`store/alliance_source_edit_store.go:153/169` scenario merge 中 draft 临时改名执行两次（冗余）~~（已去重；同函数「（编辑稿）」后缀字节比较永假导致的未剥离问题一并修复为 `strings.TrimSuffix`）。
