package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// buildExamFlowRouter 注册考试管理/考试结果/考试中心相关路由。
func buildExamFlowRouter(env *testhelper.TestEnv) chi.Router {
	st := store.New(env.DB)
	svc := service.New(st)
	evalSvc := service.NewEvaluationService(svc)
	portalSvc := service.NewPositionService(svc)
	rr := chi.NewRouter()
	rr.Use(middleware.JWT(testhelper.TestJWTSecret))
	usageH := &handler.ExamUsageHandler{Service: evalSvc}
	resultH := &handler.ExamResultHandler{Service: evalSvc}
	rr.Get("/evaluation/exam-usages/{id}", usageH.Get)
	rr.Post("/evaluation/exam-usages/{id}/publish", usageH.Publish)
	rr.Post("/evaluation/exam-usages/{id}/finish", usageH.Finish)
	rr.Get("/evaluation/exam-center", usageH.ExamCenter)
	rr.Get("/evaluation/exam-results/{id}", resultH.Get)
	rr.Post("/evaluation/exam-results", resultH.Create)
	rr.Post("/evaluation/exam-results/{id}/grade", resultH.Grade)
	rr.Get("/portal/workspace/dashboard", (&handler.PortalHandler{Service: portalSvc}).WorkspaceDashboard)
	return rr
}

func execJSONWithRouter(t *testing.T, rr chi.Router, method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	t.Helper()
	var reqBody *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(b)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	rr.ServeHTTP(rec, req)
	return rec
}

func insertExamWithQuestions(t *testing.T, env *testhelper.TestEnv, ctx context.Context, name string, questions []struct {
	ID     string
	Type   string
	Answer string
	Score  float64
}) string {
	t.Helper()
	examID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO exams (id, tenant_id, name, status, duration, creator_id, code, is_temp)
		VALUES ($1, $2, $3, 'published', 60, $4, $5, false)
	`, examID, testhelper.TestTenantID, name, testhelper.TestOperatorID, "SJ-"+uuid.NewString()[:8])
	bankID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO question_banks (id, name, status, question_count, creator_id, version, owner_type, is_draft_pool, code, tenant_id)
		VALUES ($1, $2, 'published', 0, $3, 'v1', 'system', false, $4, $5)
	`, bankID, "测试题库-"+uuid.NewString()[:8], testhelper.TestOperatorID, "BK-"+uuid.NewString()[:8], testhelper.TestTenantID)
	for _, q := range questions {
		execOrFail(t, env, ctx, `
			INSERT INTO questions (id, bank_id, type, content, answer, score, difficulty, status, code, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, 'medium', 'published', $7, $8)
		`, q.ID, bankID, q.Type, "题目-"+q.ID, `["`+q.Answer+`"]`, q.Score, "Q-"+uuid.NewString()[:8], testhelper.TestTenantID)
		execOrFail(t, env, ctx, `
			INSERT INTO exam_questions (id, exam_id, question_id, type, content, answer, score, sort_order, tenant_id)
			VALUES ($1, $2, $1, $3, $4, $5, $6, 0, $7)
		`, q.ID, examID, q.Type, "题目-"+q.ID, `["`+q.Answer+`"]`, q.Score, testhelper.TestTenantID)
	}
	return examID
}

// insertTestClass 创建班级组织节点并返回其 ID。
func insertTestClass(t *testing.T, env *testhelper.TestEnv, ctx context.Context, name string) string {
	t.Helper()
	id := uuid.NewString()
	typeID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO org_types (id, tenant_id, name, category)
		VALUES ($1, $2, '班级', 'class')
		ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
	`, typeID, testhelper.TestTenantID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order)
		VALUES ($1, $2, $3, (SELECT id FROM org_types WHERE tenant_id = $2 AND name = '班级'), NULL, 0)
	`, id, testhelper.TestTenantID, name)
	return id
}

// TestExamUsage_Flow 发布/开始/结束状态流转 + 班级提交校验 + 考试中心 + 评分 + 重交保护。
func TestExamUsage_Flow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	classID := insertTestClass(t, env, ctx, "测试一班")
	otherClassID := insertTestClass(t, env, ctx, "测试二班")

	objQID := uuid.NewString()
	subjQID := uuid.NewString()
	examID := insertExamWithQuestions(t, env, ctx, "日常考试试卷", []struct {
		ID     string
		Type   string
		Answer string
		Score  float64
	}{
		{ID: objQID, Type: "single", Answer: "A", Score: 40},
		{ID: subjQID, Type: "essay", Answer: "参考", Score: 60},
	})

	usageID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, target_ids, creator_id)
		VALUES ($1, $2, $3, '期中考试', 'draft', 'class', ARRAY[$4]::uuid[], $5)
	`, usageID, testhelper.TestTenantID, examID, classID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usageID)

	rr := buildExamFlowRouter(env)
	teacherToken := env.NewTokenWithIdentity(uuid.NewString(), testhelper.TestTenantID, domain.UserRoleOperator, nil, "teacher")

	// 1. 发布：draft -> published
	w := execJSONWithRouter(t, rr, "POST", "/evaluation/exam-usages/"+usageID+"/publish", nil, teacherToken)
	if w.Code != http.StatusOK {
		t.Fatalf("发布应成功，实际 %d %s", w.Code, w.Body.String())
	}
	st := store.New(env.DB)
	evalSvc := service.NewEvaluationService(service.New(st))
	usage, err := evalSvc.GetExamUsage(ctx, usageID)
	if err != nil {
		t.Fatalf("get usage: %v", err)
	}
	if usage.Status != "published" {
		t.Fatalf("发布后状态应为 published，实际 %s", usage.Status)
	}

	// 2. 学生创建：本班学生 + 他班学生
	createStudent := func(orgNodeID string) string {
		id := uuid.NewString()
		pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
		execOrFail(t, env, ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
			VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '考试流程学生', 'active', '{}', $5)
		`, id, testhelper.TestTenantID, "stu-"+uuid.NewString()[:8], string(pw), orgNodeID)
		return id
	}
	inClassStudent := createStudent(classID)
	otherClassStudent := createStudent(otherClassID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = ANY($1::uuid[])", []string{inClassStudent, otherClassStudent})

	inClassToken := env.NewTokenWithIdentity(inClassStudent, testhelper.TestTenantID, domain.RoleStudent, nil, "student")
	otherToken := env.NewTokenWithIdentity(otherClassStudent, testhelper.TestTenantID, domain.RoleStudent, nil, "student")

	// 3. 考试中心：本班学生可参加，他班学生不可参加，教师不可参加
	centerItems := func(token string) []domain.ExamCenterItem {
		rec := execJSONWithRouter(t, rr, "GET", "/evaluation/exam-center", nil, token)
		items, err := testhelper.Unmarshal[[]domain.ExamCenterItem](rec)
		if err != nil {
			t.Fatalf("unmarshal exam center: %v", err)
		}
		return items
	}
	inClassItems := centerItems(inClassToken)
	otherItems := centerItems(otherToken)
	teacherCenterItems := centerItems(teacherToken)
	if len(inClassItems) != 1 || !inClassItems[0].Participatable || !inClassItems[0].StudentView {
		t.Fatalf("本班学生应看到 1 条可参加考试，实际 %+v", inClassItems)
	}
	if len(otherItems) != 1 || otherItems[0].Participatable {
		t.Fatalf("他班学生应看到考试但不可参加，实际 %+v", otherItems)
	}
	if len(teacherCenterItems) != 1 || teacherCenterItems[0].StudentView || teacherCenterItems[0].Participatable {
		t.Fatalf("教师应看到考试但不可参加，实际 %+v", teacherCenterItems)
	}

	// 4. 已发布考试可直接作答（状态保持 published）
	usage, _ = evalSvc.GetExamUsage(ctx, usageID)
	if usage.Status != "published" {
		t.Fatalf("发布后状态应为 published，实际 %s", usage.Status)
	}

	// 5. 提交：本班学生成功；他班学生 403
	submitBody := map[string]interface{}{
		"examUsageId": usageID,
		"answers":     map[string]interface{}{objQID: "A", subjQID: "我的答案"},
		"methodKey":   "paper",
	}
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", submitBody, inClassToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("本班学生提交应成功，实际 %d %s", w.Code, w.Body.String())
	}
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", submitBody, otherToken)
	if w.Code != http.StatusForbidden {
		t.Fatalf("他班学生提交应 403，实际 %d", w.Code)
	}

	// 6. 教师评分：客观 40（提交时自动计分）+ 主观 30 = 70，及格
	cfg := st.ExamResults().ListConfig()
	results, _, err := st.ExamResults().List(ctx, store.ListParams{TenantID: testhelper.TestTenantID, Values: map[string]string{"usageId": usageID}}, cfg)
	if err != nil || len(results) != 1 {
		t.Fatalf("应只有 1 条考试结果，实际 %d err=%v", len(results), err)
	}
	resultID := results[0].ID
	if results[0].GradingStatus != "pending" || results[0].Score != 40 {
		t.Fatalf("提交后有主观题应待评分且仅客观分，实际 status=%s score=%v", results[0].GradingStatus, results[0].Score)
	}
	gradeBody := map[string]interface{}{
		"scores":  map[string]interface{}{subjQID: map[string]interface{}{"score": 30, "comment": "不错"}},
		"comment": "总体良好",
	}
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results/"+resultID+"/grade", gradeBody, teacherToken)
	if w.Code != http.StatusOK {
		t.Fatalf("评分应成功，实际 %d %s", w.Code, w.Body.String())
	}
	graded, err := st.ExamResults().Get(ctx, resultID)
	if err != nil {
		t.Fatalf("get graded result: %v", err)
	}
	if graded.Score != 70 || !graded.IsPass {
		t.Fatalf("评分后分数应为 70 且及格，实际 score=%v isPass=%v", graded.Score, graded.IsPass)
	}
	if graded.GradingStatus != "evaluated" || graded.GraderID == nil || graded.GradedAt == nil {
		t.Fatalf("评分状态字段应已更新，实际 status=%s", graded.GradingStatus)
	}

	// 7. 重交保护：评分后本班学生再次提交 -> 409
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-results", submitBody, inClassToken)
	if w.Code != http.StatusConflict {
		t.Fatalf("评分后重交应 409，实际 %d", w.Code)
	}

	// 8. 结束考试：in_progress -> finished
	w = execJSONWithRouter(t, rr, "POST", "/evaluation/exam-usages/"+usageID+"/finish", nil, teacherToken)
	if w.Code != http.StatusOK {
		t.Fatalf("结束考试应成功，实际 %d %s", w.Code, w.Body.String())
	}
	usage, _ = evalSvc.GetExamUsage(ctx, usageID)
	if usage.Status != "finished" {
		t.Fatalf("结束后状态应为 finished，实际 %s", usage.Status)
	}
}
