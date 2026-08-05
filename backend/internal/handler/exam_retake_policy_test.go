package handler_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// TestExamRetakePolicy 重复作答策略：测评方式配置 allowRetake=true 时教师评分前可重交（取最后一次），
// 评分后禁止；allowRetake=false 或手动考试（无配置）一次性提交后禁止重交。
func TestExamRetakePolicy(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	taskID := uuid.NewString()
	taskUsageID := uuid.NewString()
	examID := insertExamWithQuestions(t, env, ctx, "题库随堂测", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 50},
		{ID: uuid.NewString(), Type: "single", Answer: "B", Score: 50},
	})

	// 场景 + 任务（task_evaluation_methods 的 task_id 有 FK）
	scenarioID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, difficulty, creator_id)
		VALUES ($1, $2, '重交策略场景', 'CJ-1', 'v1', 'published', 3, $3)
	`, scenarioID, tenantID, testhelper.TestOperatorID)
	execOrFail(t, env, ctx, `
		INSERT INTO scenario_tasks (id, scenario_id, name, code, sort_order, task_type, difficulty, tenant_id)
		VALUES ($1, $2, '任务一', 'RW-1', 0, 'practice', 3, $3)
	`, taskID, scenarioID, tenantID)

	// task 测评方式：允许重复作答
	execOrFail(t, env, ctx, `
		INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, resource_config)
		VALUES ($1, $2, $3, 'question_bank', 100, $4::jsonb)
	`, uuid.NewString(), tenantID, taskID,
		`{"examId": "`+examID+`", "allowRetake": true, "timeLimit": 30, "questionIds": []}`)
	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id)
		VALUES ($1, $2, $3, '题库考试', 'published', 'task', ARRAY[$4]::uuid[], $5)
	`, taskUsageID, tenantID, examID, taskID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", taskUsageID)

	// 手动考试（class，无 allowRetake 配置 → 默认不允许重复作答）
	classID := insertTestClass(t, env, ctx, "重交策略一班")
	manualUsageID := uuid.NewString()
	manualExamID := insertExamWithQuestions(t, env, ctx, "手动试卷", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 100},
	})
	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id)
		VALUES ($1, $2, $3, '期末考', 'published', 'class', ARRAY[$4]::uuid[], $5)
	`, manualUsageID, tenantID, manualExamID, classID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", manualUsageID)

	// 学生
	studentID := uuid.NewString()
	pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	execOrFail(t, env, ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
		VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '重交策略学生', 'active', '{}', $5)
	`, studentID, tenantID, "stu-"+uuid.NewString()[:8], string(pw), classID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
	studentToken := env.NewTokenWithIdentity(studentID, tenantID, domain.UserRoleOperator, nil, "student")

	rr := buildExamFlowRouter(env)
	submit := func(usageID string) *int {
		w := execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", map[string]interface{}{
			"examUsageId": usageID,
			"answers":     map[string]interface{}{},
			"methodKey":   "paper",
		}, studentToken)
		return &w.Code
	}

	// 1. task 题库（allowRetake=true）：第一次提交 201，重交仍 201（覆盖取最后一次）
	if code := *submit(taskUsageID); code != http.StatusCreated {
		t.Fatalf("task 题库首次提交应 201，实际 %d", code)
	}
	if code := *submit(taskUsageID); code != http.StatusCreated {
		t.Fatalf("task 题库允许重交应 201，实际 %d", code)
	}

	// 2. 手动考试（class，默认不允许重复作答）：第一次 201，重交 409
	if code := *submit(manualUsageID); code != http.StatusCreated {
		t.Fatalf("手动考试首次提交应 201，实际 %d", code)
	}
	if code := *submit(manualUsageID); code != http.StatusConflict {
		t.Fatalf("手动考试重交应 409，实际 %d", code)
	}
}

// TestExamSubmitWindow 提交窗口校验：未到开始时间 / 已过结束时间禁止提交。
func TestExamSubmitWindow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	classID := insertTestClass(t, env, ctx, "窗口校验一班")
	examID := insertExamWithQuestions(t, env, ctx, "窗口试卷", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 100},
	})

	studentID := uuid.NewString()
	pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	execOrFail(t, env, ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
		VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '窗口校验学生', 'active', '{}', $5)
	`, studentID, tenantID, "stu-"+uuid.NewString()[:8], string(pw), classID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
	studentToken := env.NewTokenWithIdentity(studentID, tenantID, domain.UserRoleOperator, nil, "student")

	rr := buildExamFlowRouter(env)
	submit := func(usageID string) int {
		w := execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", map[string]interface{}{
			"examUsageId": usageID,
			"answers":     map[string]interface{}{},
			"methodKey":   "paper",
		}, studentToken)
		return w.Code
	}

	// 1. 已过结束时间：409
	endedUsage := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id, start_time, end_time)
		VALUES ($1, $2, $3, '已结束考试', 'published', 'class', ARRAY[$4]::uuid[], $5, $6, $7)
	`, endedUsage, tenantID, examID, classID, testhelper.TestOperatorID,
		time.Now().Add(-48*time.Hour).Format(time.RFC3339), time.Now().Add(-24*time.Hour).Format(time.RFC3339))
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", endedUsage)
	if code := submit(endedUsage); code != http.StatusConflict {
		t.Fatalf("已结束考试提交应 409，实际 %d", code)
	}

	// 2. 未到开始时间：409
	notStartedUsage := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id, start_time, end_time)
		VALUES ($1, $2, $3, '未开始考试', 'published', 'class', ARRAY[$4]::uuid[], $5, $6, $7)
	`, notStartedUsage, tenantID, examID, classID, testhelper.TestOperatorID,
		time.Now().Add(24*time.Hour).Format(time.RFC3339), time.Now().Add(72*time.Hour).Format(time.RFC3339))
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", notStartedUsage)
	if code := submit(notStartedUsage); code != http.StatusConflict {
		t.Fatalf("未开始考试提交应 409，实际 %d", code)
	}
}

// TestNodeGradeSyncsExamResult 节点测评教师评分后回写考试结果分数并禁止重交。
func TestNodeGradeSyncsExamResult(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	courseID := uuid.NewString()
	nodeID := uuid.NewString()
	examID := insertExamWithQuestions(t, env, ctx, "节点试卷", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 40},
		{ID: uuid.NewString(), Type: "essay", Answer: "参考", Score: 60},
	})
	usageID := uuid.NewString()

	execOrFail(t, env, ctx, `
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id)
		VALUES ($1, $2, '节点评分体系课', 'system', '专业基础课', 'published', $3, $4)
	`, courseID, "KC-"+uuid.NewString()[:8], testhelper.TestOperatorID, tenantID)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", courseID)

	// 节点 eval_data 中记录 usageId（与真实生成逻辑一致）
	evalData := `{"evalRuleConfig":{"evaluationMethods":["paper"],"paperIds":["` + examID + `"],"methodResourceConfigs":{"paper":{"examId":"` + examID + `","usageId":"` + usageID + `","allowRetake":false}}}}`
	execOrFail(t, env, ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, sort_order, tenant_id, eval_data, status)
		VALUES ($1, $2, '节点一', 0, $3, $4::jsonb, 'published')
	`, nodeID, courseID, tenantID, evalData)
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", nodeID)

	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id)
		VALUES ($1, $2, $3, '节点考试', 'published', 'node', ARRAY[$4]::uuid[], $5)
	`, usageID, tenantID, examID, nodeID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usageID)

	studentID := uuid.NewString()
	pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	execOrFail(t, env, ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '节点评分学生', 'active', '{}')
	`, studentID, tenantID, "stu-"+uuid.NewString()[:8], string(pw))
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
	studentToken := env.NewTokenWithIdentity(studentID, tenantID, domain.UserRoleOperator, nil, "student")

	rr := buildExamFlowRouter(env)
	// 学生提交：客观 40 分 + 主观待评分
	w := execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", map[string]interface{}{
		"examUsageId": usageID,
		"answers":     map[string]interface{}{},
		"methodKey":   "paper",
	}, studentToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("节点考试提交应 201，实际 %d %s", w.Code, w.Body.String())
	}

	// 教师节点评分 90 分
	st := store.New(env.DB)
	nodeSvc := service.NewNodeEvaluationResultService(service.New(st))
	var nodeResultID string
	if err := env.DB.QueryRow(ctx, `
		SELECT id FROM node_evaluation_results WHERE node_id = $1 AND evaluatee_id = $2
	`, nodeID, studentID).Scan(&nodeResultID); err != nil {
		t.Fatalf("查询节点测评结果失败: %v", err)
	}
	if err := nodeSvc.Grade(ctx, tenantID, nodeResultID, testhelper.TestOperatorID, &store.NodeEvaluationResultGradeParams{Score: 90, EvalPointScores: domain.JSONMap{}}); err != nil {
		t.Fatalf("节点评分失败: %v", err)
	}

	// 断言：考试结果分数已回写为 90、及格、graded_at 非空
	cfg := st.ExamResults().ListConfig()
	results, _, err := st.ExamResults().List(ctx, store.ListParams{TenantID: tenantID, Values: map[string]string{"usageId": usageID}}, cfg)
	if err != nil || len(results) != 1 {
		t.Fatalf("应只有 1 条考试结果，实际 %d err=%v", len(results), err)
	}
	r := results[0]
	if r.Score != 90 || !r.IsPass {
		t.Fatalf("节点评分后考试结果应为 90 且及格，实际 score=%v isPass=%v", r.Score, r.IsPass)
	}
	if r.GradedAt == nil {
		t.Fatal("节点评分后考试结果 graded_at 应非空")
	}

	// 评分后重交 409
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", map[string]interface{}{
		"examUsageId": usageID,
		"answers":     map[string]interface{}{},
		"methodKey":   "paper",
	}, studentToken)
	if w.Code != http.StatusConflict {
		t.Fatalf("节点评分后重交应 409，实际 %d", w.Code)
	}
}
