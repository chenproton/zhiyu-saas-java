package store

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// 阶段 2a 绑定固化与提交盖章测试（文档 5.3 / 5.6）。

// ---------- fixture 辅助 ----------

func stampingTenant(t *testing.T, pool *pgxpool.Pool) (tenantID, userID string) {
	t.Helper()
	tenantID = grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID = grantTestUser(t, pool, tenantID)
	return tenantID, userID
}

func stampingScenario(t *testing.T, pool *pgxpool.Pool, tenantID, userID, version string) (scenarioID, taskID string) {
	t.Helper()
	scenarioID = uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, creator_id)
		VALUES ($1, $2, '场景-盖章', $3, $4, 'published', $5)
	`, scenarioID, tenantID, "SC-"+uuid.NewString()[:8], version, userID)
	taskID = uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenario_tasks (id, scenario_id, tenant_id, name, code, task_type)
		VALUES ($1, $2, $3, '任务-盖章', $4, 'practice')
	`, taskID, scenarioID, tenantID, "T-"+uuid.NewString()[:8])
	return scenarioID, taskID
}

func stampingCourse(t *testing.T, pool *pgxpool.Pool, tenantID, userID, version string) (courseID, nodeID string) {
	t.Helper()
	courseID = uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, version)
		VALUES ($1, $2, $3, '课程-盖章', 'system', '专业', 'published', $4, $5)
	`, courseID, tenantID, "C-"+uuid.NewString()[:8], userID, version)
	nodeID = uuid.NewString()
	snapExec(t, pool, `INSERT INTO system_course_nodes (id, tenant_id, course_id, name) VALUES ($1, $2, $3, '节点-盖章')`, nodeID, tenantID, courseID)
	return courseID, nodeID
}

func stampingExam(t *testing.T, pool *pgxpool.Pool, tenantID, version string) string {
	t.Helper()
	examID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO exams (id, tenant_id, code, name, status, duration, version)
		VALUES ($1, $2, $3, $4, 'published', 60, $5)
	`, examID, tenantID, "E-"+uuid.NewString()[:8], "试卷-"+uuid.NewString()[:8], version)
	return examID
}

func stampingSaveSnap(t *testing.T, pool *pgxpool.Pool, tenantID, resType, resID, version string) {
	t.Helper()
	if err := NewSnapshotStore(pool).SaveSnapshot(context.Background(), tenantID, resType, resID, version, json.RawMessage(`{"stub":true}`)); err != nil {
		t.Fatalf("SaveSnapshot(%s@%s): %v", resID, version, err)
	}
}

func stampingStr(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) string {
	t.Helper()
	var v *string
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&v); err != nil {
		t.Fatalf("查询失败: %v\nsql: %s", err, sql)
	}
	if v == nil {
		return ""
	}
	return *v
}

// ---------- 排课发布 stamp ----------

// published 行打 resource_version：快照最新版本为准（场景 V2.0 快照 vs live V2.1 → 取 V2.0），
// 快照缺档回退 live version（课程无快照 → live V1.3），无资源引用落 NULL。
func TestPublishScheduleEntries_StampsResourceVersion(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)

	orgTypeID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO org_types (id, tenant_id, name, category) VALUES ($1, $2, '班级', 'class')`, orgTypeID, tenantID)
	classID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO organizations (id, tenant_id, name, type_id) VALUES ($1, $2, '电商2301班', $3)`, classID, tenantID, orgTypeID)
	termID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO terms (id, tenant_id, name, start_date, end_date) VALUES ($1, $2, '2026-1', '2026-03-01', '2026-07-01')`, termID, tenantID)

	scenarioID, _ := stampingScenario(t, pool, tenantID, userID, "V2.1")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceScenario, scenarioID, "V2.0")
	courseID, _ := stampingCourse(t, pool, tenantID, userID, "V1.3")

	snapExec(t, pool, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, course_name, type, class_node_id, day_of_week, periods, start_week, end_week, scenario_id, status)
		VALUES ($1, $2, $3, '场景课', 'scene', $4, 1, '["上午1-2"]'::jsonb, 1, 16, $5, 'draft')
	`, uuid.NewString(), tenantID, termID, classID, scenarioID)
	snapExec(t, pool, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, course_name, type, class_node_id, day_of_week, periods, start_week, end_week, course_id, status)
		VALUES ($1, $2, $3, '理论课', 'traditional', $4, 2, '["上午3-4"]'::jsonb, 1, 16, $5, 'draft')
	`, uuid.NewString(), tenantID, termID, classID, courseID)
	snapExec(t, pool, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, course_name, type, class_node_id, day_of_week, periods, start_week, end_week, status)
		VALUES ($1, $2, $3, '自习课', 'traditional', $4, 3, '["下午1-2"]'::jsonb, 1, 16, 'draft')
	`, uuid.NewString(), tenantID, termID, classID)

	n, _, err := NewSchedulingStore(pool).PublishScheduleEntries(ctx, pool, tenantID, termID)
	if err != nil {
		t.Fatalf("PublishScheduleEntries: %v", err)
	}
	if n != 3 {
		t.Fatalf("发布行数 = %d, want 3", n)
	}

	if v := stampingStr(t, pool, `SELECT resource_version FROM schedule_entries WHERE tenant_id = $1 AND course_name = '场景课' AND status = 'published'`, tenantID); v != "V2.0" {
		t.Fatalf("场景课 resource_version = %q, want V2.0（快照最新为准）", v)
	}
	if v := stampingStr(t, pool, `SELECT resource_version FROM schedule_entries WHERE tenant_id = $1 AND course_name = '理论课' AND status = 'published'`, tenantID); v != "V1.3" {
		t.Fatalf("理论课 resource_version = %q, want V1.3（缺档回退 live）", v)
	}
	if v := stampingStr(t, pool, `SELECT resource_version FROM schedule_entries WHERE tenant_id = $1 AND course_name = '自习课' AND status = 'published'`, tenantID); v != "" {
		t.Fatalf("自习课 resource_version = %q, want NULL", v)
	}
}

// ---------- 考试安排 stamp ----------

// Create 即 stamp（快照最新优先 live）；SetStatus('published') 重新 stamp；其余状态流转不动版本。
func TestExamUsageStore_CreateAndPublishStamp(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	st := NewExamUsageStore(pool)

	// 有快照：live V2.1 + 快照 V2.0 → 盖 V2.0（快照最新为准）
	examID := stampingExam(t, pool, tenantID, "V2.1")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceExam, examID, "V2.0")
	u, err := st.Create(ctx, &ExamUsageCreateParams{
		TenantID: tenantID, ExamID: examID, Name: "安排-快照", Status: "draft", ActivationMode: "manual", CreatorID: userID, TargetIDs: []string{},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if u.ExamVersion == nil || *u.ExamVersion != "V2.0" {
		t.Fatalf("Create exam_version = %v, want V2.0", u.ExamVersion)
	}

	// 无快照：回退 live version
	exam2ID := stampingExam(t, pool, tenantID, "V1.0")
	u2, err := st.Create(ctx, &ExamUsageCreateParams{
		TenantID: tenantID, ExamID: exam2ID, Name: "安排-无快照", Status: "draft", ActivationMode: "manual", CreatorID: userID, TargetIDs: []string{},
	})
	if err != nil {
		t.Fatalf("Create exam2: %v", err)
	}
	if u2.ExamVersion == nil || *u2.ExamVersion != "V1.0" {
		t.Fatalf("无快照 Create exam_version = %v, want V1.0", u2.ExamVersion)
	}

	// 发布时重新 stamp：补齐 V1.1 快照后发布 → V1.1
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceExam, exam2ID, "V1.1")
	if err := st.SetStatus(ctx, tenantID, u2.ID, "published"); err != nil {
		t.Fatalf("SetStatus published: %v", err)
	}
	u2, err = st.Get(ctx, tenantID, u2.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if u2.ExamVersion == nil || *u2.ExamVersion != "V1.1" {
		t.Fatalf("发布后 exam_version = %v, want V1.1", u2.ExamVersion)
	}

	// 非发布流转不动版本
	if err := st.SetStatus(ctx, tenantID, u2.ID, "finished"); err != nil {
		t.Fatalf("SetStatus finished: %v", err)
	}
	u2, _ = st.Get(ctx, tenantID, u2.ID)
	if u2.ExamVersion == nil || *u2.ExamVersion != "V1.1" {
		t.Fatalf("finished 后 exam_version = %v, want V1.1 不变", u2.ExamVersion)
	}
}

// ---------- 场景提交盖章 + scene_id 反查 + expectedVersion ----------

// 提交盖章：expectedVersion 快照存在则采纳、无效回退最新；scene_id 服务端反查纠正；
// 未评分重交 version 随 EXCLUDED 更新；已评分行重交拒绝且 version 不动。
func TestEvaluationResultSubmit_VersionStamp(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	scenarioID, taskID := stampingScenario(t, pool, tenantID, userID, "V1.1")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceScenario, scenarioID, "V1.0")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceScenario, scenarioID, "V1.1")
	st := NewEvaluationResultStore(pool)

	newParams := func(expected string, wrongScene *string) *EvaluationResultSubmitParams {
		return &EvaluationResultSubmitParams{
			TenantID: tenantID, TaskID: taskID, SceneID: wrongScene, ExpectedVersion: expected,
			MethodKey: "paper", EvaluateeID: userID, EvaluatorType: "self", MaxScore: 100,
			EvalPointScores: domain.JSONMap{}, ObjectiveAnswers: domain.JSONMap{},
			SubjectiveContent: domain.JSONMap{}, DrawnQuestions: domain.JSONMap{},
		}
	}

	// expectedVersion=V1.0 快照存在 → 采纳；客户端传错误 sceneId → 服务端反查纠正
	wrongScene := uuid.NewString()
	res, err := st.Submit(ctx, newParams("V1.0", &wrongScene))
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.0" {
		t.Fatalf("version = %v, want V1.0（expectedVersion 采纳）", res.Version)
	}
	if res.SceneID == nil || *res.SceneID != scenarioID {
		t.Fatalf("scene_id = %v, want %s（服务端反查纠正）", res.SceneID, scenarioID)
	}

	// expectedVersion=V9.9 无此快照 → 回退最新 V1.1（降级语义，不拒绝）
	res, err = st.Submit(ctx, newParams("V9.9", nil))
	if err != nil {
		t.Fatalf("Submit V9.9: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.1" {
		t.Fatalf("version = %v, want V1.1（无效 expectedVersion 回退最新）", res.Version)
	}

	// 未评分重交：version 随 EXCLUDED 更新（此处 latest 仍为 V1.1）
	res, err = st.Submit(ctx, newParams("", nil))
	if err != nil {
		t.Fatalf("Submit 重交: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.1" {
		t.Fatalf("重交 version = %v, want V1.1", res.Version)
	}

	// 教师评分后重交：拒绝，version 不动
	if err := st.Grade(ctx, pool, res.ID, userID, &EvaluationResultGradeParams{Score: 90}); err != nil {
		t.Fatalf("Grade: %v", err)
	}
	if _, err := st.Submit(ctx, newParams("", nil)); err != ErrAlreadyGraded {
		t.Fatalf("已评分重交 err = %v, want ErrAlreadyGraded", err)
	}
	res, err = st.Get(ctx, res.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.1" {
		t.Fatalf("已评分行 version = %v, want V1.1 不动", res.Version)
	}
}

// 节点提交盖章：node_id → course 最新快照版本；expectedVersion 采纳。
func TestNodeEvaluationResultSubmit_VersionStamp(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	courseID, nodeID := stampingCourse(t, pool, tenantID, userID, "V1.1")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceCourse, courseID, "V1.0")
	stampingSaveSnap(t, pool, tenantID, SnapshotResourceCourse, courseID, "V1.1")
	st := NewNodeEvaluationResultStore(pool)

	res, err := st.Submit(ctx, &NodeEvaluationResultSubmitParams{
		TenantID: tenantID, NodeID: nodeID, ExpectedVersion: "V1.0",
		MethodKey: "paper", EvaluateeID: userID, EvaluatorType: "self", MaxScore: 100,
		EvalPointScores: domain.JSONMap{}, ObjectiveAnswers: domain.JSONMap{},
		SubjectiveContent: domain.JSONMap{}, DrawnQuestions: domain.JSONMap{},
	})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.0" {
		t.Fatalf("version = %v, want V1.0（expectedVersion 采纳）", res.Version)
	}

	// 未评分重交回退最新
	res, err = st.Submit(ctx, &NodeEvaluationResultSubmitParams{
		TenantID: tenantID, NodeID: nodeID,
		MethodKey: "paper", EvaluateeID: userID, EvaluatorType: "self", MaxScore: 100,
		EvalPointScores: domain.JSONMap{}, ObjectiveAnswers: domain.JSONMap{},
		SubjectiveContent: domain.JSONMap{}, DrawnQuestions: domain.JSONMap{},
	})
	if err != nil {
		t.Fatalf("Submit 重交: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.1" {
		t.Fatalf("重交 version = %v, want V1.1（回退最新快照）", res.Version)
	}
}

// ---------- Sync 三函数版本语义（13.A7）+ exam_results 盖章 ----------

func stampingUsage(t *testing.T, pool *pgxpool.Pool, tenantID, examID, targetType string, targetIDs []string, examVersion string) string {
	t.Helper()
	usageID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, activation_mode, target_type, target_ids, exam_version)
		VALUES ($1, $2, $3, '安排-sync', 'published', 'always', $4, $5, $6)
	`, usageID, tenantID, examID, targetType, targetIDs, examVersion)
	return usageID
}

// SyncNode/Scene/CourseEvaluation：INSERT 取 usage.exam_version；已评分行 version 不动，未评分行随 EXCLUDED 更新。
func TestSyncEvaluations_VersionSemantics(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	courseID, nodeID := stampingCourse(t, pool, tenantID, userID, "V1.0")
	scenarioID, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")
	_ = scenarioID
	examID := stampingExam(t, pool, tenantID, "V1.0")
	snapExec(t, pool, `
		INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, resource_config)
		VALUES ($1, $2, $3, 'paper', 100, '{}')
	`, uuid.NewString(), tenantID, taskID)
	st := NewExamResultStore(pool)

	// 节点 sync：hasSubjective → pending（未评分）
	nodeUsage := stampingUsage(t, pool, tenantID, examID, "node", []string{nodeID}, "V1.0")
	if err := st.SyncNodeEvaluation(ctx, tenantID, nodeUsage, userID, 80, 100, domain.JSONMap{}, true, "paper"); err != nil {
		t.Fatalf("SyncNodeEvaluation: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM node_evaluation_results WHERE tenant_id = $1 AND node_id = $2`, tenantID, nodeID); v != "V1.0" {
		t.Fatalf("node sync version = %q, want V1.0", v)
	}

	// 未评分行随 EXCLUDED 更新
	snapExec(t, pool, `UPDATE exam_usages SET exam_version = 'V1.1' WHERE id = $1`, nodeUsage)
	if err := st.SyncNodeEvaluation(ctx, tenantID, nodeUsage, userID, 85, 100, domain.JSONMap{}, true, "paper"); err != nil {
		t.Fatalf("SyncNodeEvaluation 2: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM node_evaluation_results WHERE tenant_id = $1 AND node_id = $2`, tenantID, nodeID); v != "V1.1" {
		t.Fatalf("未评分行 version = %q, want V1.1（随 EXCLUDED 更新）", v)
	}

	// 已评分行 version 不动
	snapExec(t, pool, `UPDATE node_evaluation_results SET status = 'evaluated', graded_at = NOW() WHERE tenant_id = $1 AND node_id = $2`, tenantID, nodeID)
	snapExec(t, pool, `UPDATE exam_usages SET exam_version = 'V1.2' WHERE id = $1`, nodeUsage)
	if err := st.SyncNodeEvaluation(ctx, tenantID, nodeUsage, userID, 90, 100, domain.JSONMap{}, false, "paper"); err != nil {
		t.Fatalf("SyncNodeEvaluation 3: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM node_evaluation_results WHERE tenant_id = $1 AND node_id = $2`, tenantID, nodeID); v != "V1.1" {
		t.Fatalf("已评分行 version = %q, want V1.1 不动", v)
	}

	// 场景 sync
	sceneUsage := stampingUsage(t, pool, tenantID, examID, "task", []string{taskID}, "V1.0")
	if err := st.SyncSceneEvaluation(ctx, tenantID, sceneUsage, userID, 70, 100, domain.JSONMap{}, false, "paper"); err != nil {
		t.Fatalf("SyncSceneEvaluation: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM scene_evaluation_results WHERE tenant_id = $1 AND task_id = $2 AND method_key = 'paper'`, tenantID, taskID); v != "V1.0" {
		t.Fatalf("scene sync version = %q, want V1.0", v)
	}

	// 课程 sync
	courseUsage := stampingUsage(t, pool, tenantID, examID, "course", []string{courseID}, "V1.0")
	if err := st.SyncCourseEvaluation(ctx, tenantID, courseUsage, userID, 60, 100, domain.JSONMap{}, false, "paper"); err != nil {
		t.Fatalf("SyncCourseEvaluation: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM course_evaluation_results WHERE tenant_id = $1 AND course_id = $2`, tenantID, courseID); v != "V1.0" {
		t.Fatalf("course sync version = %q, want V1.0", v)
	}
}

// exam_results 盖章 = exam_usages.exam_version；未评分重交随 EXCLUDED 更新；已评分拒绝且 version 不动。
func TestExamResultSaveResult_VersionStamp(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	examID := stampingExam(t, pool, tenantID, "V1.0")
	usageID := stampingUsage(t, pool, tenantID, examID, "class", []string{uuid.NewString()}, "V1.0")
	st := NewExamResultStore(pool)

	params := &SaveExamResultParams{
		StudentName: "学生甲", Score: 80, TotalScore: 100, IsPass: true,
		Answers: domain.JSONMap{}, GradingStatus: "evaluated",
	}
	res, err := st.SaveResult(ctx, tenantID, usageID, userID, params)
	if err != nil {
		t.Fatalf("SaveResult: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.0" {
		t.Fatalf("version = %v, want V1.0（usage.exam_version）", res.Version)
	}

	// 未评分重交随 usage 版本更新
	snapExec(t, pool, `UPDATE exam_usages SET exam_version = 'V1.1' WHERE id = $1`, usageID)
	res, err = st.SaveResult(ctx, tenantID, usageID, userID, params)
	if err != nil {
		t.Fatalf("SaveResult 重交: %v", err)
	}
	if res.Version == nil || *res.Version != "V1.1" {
		t.Fatalf("重交 version = %v, want V1.1", res.Version)
	}

	// 教师评分（graded_at 非空）后重交拒绝，version 不动
	snapExec(t, pool, `UPDATE exam_results SET graded_at = NOW() WHERE exam_usage_id = $1 AND user_id = $2`, usageID, userID)
	if _, err := st.SaveResult(ctx, tenantID, usageID, userID, params); err != ErrAlreadyGraded {
		t.Fatalf("已评分重交 err = %v, want ErrAlreadyGraded", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM exam_results WHERE exam_usage_id = $1 AND user_id = $2`, usageID, userID); v != "V1.1" {
		t.Fatalf("已评分行 version = %q, want V1.1 不动", v)
	}
}

// ---------- temp exam 兜底（文档 5.1 末条）----------

// EnsureExamUsageForMethod：首建 temp exam 写 V1.0 快照并 stamp 安排；
// 题目集合变化 → bump V1.1 写新快照、旧快照可回溯、安排刷新；
// 题目集合未变 → 版本与快照不动（幂等）。
func TestEnsureExamUsageForMethod_TempExamSnapshot(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	_, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")

	bankID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO question_banks (id, tenant_id, name, code, status, creator_id, owner_type)
		VALUES ($1, $2, '题库-盖章', $3, 'published', $4, 'mine')
	`, bankID, tenantID, "B-"+uuid.NewString()[:8], userID)
	q1 := uuid.NewString()
	q2 := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO questions (id, tenant_id, bank_id, type, content, answer, code, score, status)
		VALUES ($1, $2, $3, 'single', '题1', '["A"]', $4, 5, 'published')
	`, q1, tenantID, bankID, "Q-"+uuid.NewString()[:8])
	snapExec(t, pool, `
		INSERT INTO questions (id, tenant_id, bank_id, type, content, answer, code, score, status)
		VALUES ($1, $2, $3, 'single', '题2', '["B"]', $4, 5, 'published')
	`, q2, tenantID, bankID, "Q-"+uuid.NewString()[:8])

	st := NewTaskEvaluationStore(pool)
	snap := NewSnapshotStore(pool)

	// 首次：建 temp exam + 快照 V1.0 + 安排 stamp
	rc, err := st.EnsureExamUsageForMethod(ctx, pool, tenantID, taskID, "任务-盖章", userID, "question_bank", domain.JSONMap{
		"questionIds": []string{q1},
	})
	if err != nil {
		t.Fatalf("EnsureExamUsageForMethod: %v", err)
	}
	examID, _ := rc["examId"].(string)
	usageID, _ := rc["usageId"].(string)
	if examID == "" || usageID == "" {
		t.Fatalf("resourceConfig 缺 examId/usageId: %v", rc)
	}
	if v := stampingStr(t, pool, `SELECT version FROM exams WHERE id = $1`, examID); v != "V1.0" {
		t.Fatalf("temp exam version = %q, want V1.0（首建不跳版）", v)
	}
	if _, err := snap.GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.0"); err != nil {
		t.Fatalf("V1.0 快照缺失: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT exam_version FROM exam_usages WHERE id = $1`, usageID); v != "V1.0" {
		t.Fatalf("exam_version = %q, want V1.0", v)
	}

	// 题目集合变化：bump V1.1 + 新快照 + 旧快照保留 + 安排刷新
	rc["questionIds"] = []string{q1, q2}
	rc, err = st.EnsureExamUsageForMethod(ctx, pool, tenantID, taskID, "任务-盖章", userID, "question_bank", rc)
	if err != nil {
		t.Fatalf("EnsureExamUsageForMethod 2: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM exams WHERE id = $1`, examID); v != "V1.1" {
		t.Fatalf("再同步 version = %q, want V1.1（题目变化 bump）", v)
	}
	if _, err := snap.GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.1"); err != nil {
		t.Fatalf("V1.1 快照缺失: %v", err)
	}
	if _, err := snap.GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.0"); err != nil {
		t.Fatalf("V1.0 旧快照应可回溯: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT exam_version FROM exam_usages WHERE id = $1`, usageID); v != "V1.1" {
		t.Fatalf("再同步 exam_version = %q, want V1.1（安排刷新）", v)
	}

	// 题目集合未变：版本不动，幂等
	if _, err = st.EnsureExamUsageForMethod(ctx, pool, tenantID, taskID, "任务-盖章", userID, "question_bank", rc); err != nil {
		t.Fatalf("EnsureExamUsageForMethod 3: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT version FROM exams WHERE id = $1`, examID); v != "V1.1" {
		t.Fatalf("题目未变 version = %q, want V1.1 不动", v)
	}
	var snapCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM resource_snapshots WHERE resource_type = 'exams' AND resource_id = $1`, examID).Scan(&snapCount); err != nil {
		t.Fatalf("count snapshots: %v", err)
	}
	if snapCount != 2 {
		t.Fatalf("快照数 = %d, want 2（未变不新增）", snapCount)
	}
}
