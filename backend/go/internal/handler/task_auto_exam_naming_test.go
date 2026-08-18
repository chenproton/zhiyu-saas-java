package handler_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestTaskAutoExamNaming 场景任务自动生成的考试安排名称格式与同天序号递增。
// 名称格式：{场景名}-{任务名}-{测评类型}-{YYYYMMDD}-{序号}。
func TestTaskAutoExamNaming(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	scenarioID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, difficulty, creator_id)
		VALUES ($1, $2, '软件项目经理场景2', 'CJ-NAMING', 'v1', 'published', 3, $3)
	`, scenarioID, tenantID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scenarioID)

	taskID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO scenario_tasks (id, scenario_id, name, code, sort_order, task_type, difficulty, tenant_id)
		VALUES ($1, $2, '任务 1', 'RW-NAMING', 0, 'practice', 3, $3)
	`, taskID, scenarioID, tenantID)
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	examID := insertExamWithQuestions(t, env, ctx, "命名试卷", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 100},
	})
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", examID)

	st := store.New(env.DB)
	svc := service.New(st)
	taskSvc := service.NewTaskEvaluationService(svc)

	// 1. 保存 paper 测评方式（手动启停）→ 生成考试安排
	cfg := map[string]interface{}{
		"paperId":        examID,
		"activationMode": "manual",
		"duration":       60.0,
	}
	cfgJSON, _ := json.Marshal(cfg)

	if _, err := taskSvc.SaveMethods(ctx, tenantID, taskID, testhelper.TestOperatorID, 0, []*service.MethodSaveInput{
		{MethodKey: "paper", IsEnabled: true, ResourceConfig: cfgJSON},
	}); err != nil {
		t.Fatalf("保存测评方式失败: %v", err)
	}

	usageName := fetchTaskUsageName(t, env, ctx, examID, taskID)
	wantPrefix := "软件项目经理场景2-任务 1-试卷-"
	if !strings.HasPrefix(usageName, wantPrefix) {
		t.Fatalf("场景任务考试名称格式不匹配：got %q, want prefix %q", usageName, wantPrefix)
	}

	// 2. 同天再次生成（模拟 quiz 方式）→ 序号递增
	quizExamID := insertExamWithQuestions(t, env, ctx, "命名随堂测", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: uuid.NewString(), Type: "single", Answer: "A", Score: 100},
	})
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", quizExamID)
	var quizQuestionID string
	if err := env.DB.QueryRow(ctx, `
		SELECT id FROM exam_questions WHERE exam_id = $1 LIMIT 1
	`, quizExamID).Scan(&quizQuestionID); err != nil {
		t.Fatalf("查询随堂测题目失败: %v", err)
	}
	quizCfg := map[string]interface{}{
		"examId":         quizExamID,
		"activationMode": "manual",
		"timeLimit":      30.0,
		"questionIds":    []interface{}{quizQuestionID},
	}
	quizCfgJSON, _ := json.Marshal(quizCfg)
	if _, err := taskSvc.SaveMethods(ctx, tenantID, taskID, testhelper.TestOperatorID, 1, []*service.MethodSaveInput{
		{MethodKey: "paper", IsEnabled: true, ResourceConfig: cfgJSON},
		{MethodKey: "quiz", IsEnabled: true, ResourceConfig: quizCfgJSON},
	}); err != nil {
		t.Fatalf("保存 quiz 测评方式失败: %v", err)
	}

	quizUsageName := fetchTaskUsageName(t, env, ctx, quizExamID, taskID)
	wantQuizPrefix := "软件项目经理场景2-任务 1-随堂测-"
	if !strings.HasPrefix(quizUsageName, wantQuizPrefix) {
		t.Fatalf("随堂测考试名称格式不匹配：got %q, want prefix %q", quizUsageName, wantQuizPrefix)
	}
	// 序号：quiz 是当天第二个测评，序号应为 2
	seqOf := func(name, prefix string) string {
		date := usageDate(t, env, ctx)
		return strings.TrimPrefix(name, prefix+date+"-")
	}
	if s1, s2 := seqOf(usageName, wantPrefix), seqOf(quizUsageName, wantQuizPrefix); s1 != "1" || s2 != "2" {
		t.Fatalf("序号应递增：试卷=%s 随堂测=%s", s1, s2)
	}
}

func fetchTaskUsageName(t *testing.T, env *testhelper.TestEnv, ctx context.Context, examID, taskID string) string {
	t.Helper()
	var name string
	if err := env.DB.QueryRow(ctx, `
		SELECT name FROM exam_usages
		WHERE tenant_id = $1 AND exam_id = $2 AND target_type = 'task' AND $3::uuid = ANY(target_ids)
		ORDER BY created_at DESC LIMIT 1
	`, testhelper.TestTenantID, examID, taskID).Scan(&name); err != nil {
		t.Fatalf("查询任务考试名称失败: %v", err)
	}
	return name
}

func usageDate(t *testing.T, env *testhelper.TestEnv, ctx context.Context) string {
	t.Helper()
	var d string
	if err := env.DB.QueryRow(ctx, `SELECT to_char(NOW(), 'YYYYMMDD')`).Scan(&d); err != nil {
		t.Fatalf("查询日期失败: %v", err)
	}
	return d
}
