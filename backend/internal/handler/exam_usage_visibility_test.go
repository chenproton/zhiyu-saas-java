package handler_test

import (
	"context"
	"net/http"
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

// TestExamUsage_Visibility 验证场景任务测评(task)/课程节点测评(node)/历史课程级(course)
// 自动生成的临时考试，不出现在考试管理列表与学生工作台（工作台首页、测评认证）中；
// 只有"创建考试使用"按钮创建的手动考试安排（class/major/department/public）才展示。
func TestExamUsage_Visibility(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	// 1. 试卷：手动试卷 + 临时试卷
	insertExam := func(name string, isTemp bool) string {
		id := uuid.NewString()
		execOrFail(t, env, ctx, `
			INSERT INTO exams (id, tenant_id, name, status, duration, creator_id, code, is_temp)
			VALUES ($1, $2, $3, 'published', 60, $4, $5, $6)
		`, id, tenantID, name, testhelper.TestOperatorID, "SJ-"+uuid.NewString()[:8], isTemp)
		return id
	}
	manualExamID := insertExam("手动考试试卷", false)
	tempExamID := insertExam("临时考试试卷", true)
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = ANY($1::uuid[])", []string{manualExamID, tempExamID})

	// 2. 考试安排：手动(class) + 临时(task/node/course，随时作答 always 不展示，手动启停 manual 展示)
	classID := insertTestClass(t, env, ctx, "可见性一班")
	otherClassID := insertTestClass(t, env, ctx, "可见性二班")
	insertUsage := func(examID, name, status, targetType, activationMode string, targetID string) string {
		id := uuid.NewString()
		execOrFail(t, env, ctx, `
			INSERT INTO exam_usages (id, tenant_id, exam_id, name, status, target_type, activation_mode, target_ids, creator_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, ARRAY[$8]::uuid[], $9)
		`, id, tenantID, examID, name, status, targetType, activationMode, targetID, testhelper.TestOperatorID)
		return id
	}
	manualUsageID := insertUsage(manualExamID, "手动-班级考试", "published", "class", "manual", classID)
	otherClassUsageID := insertUsage(manualExamID, "手动-他班考试", "published", "class", "manual", otherClassID)
	taskUsageID := insertUsage(tempExamID, "场景任务-临时考试", "published", "task", "always", uuid.NewString())
	taskManualUsageID := insertUsage(tempExamID, "场景任务-手动启停", "published", "task", "manual", uuid.NewString())
	nodeUsageID := insertUsage(tempExamID, "课程节点-临时考试", "published", "node", "always", uuid.NewString())
	courseUsageID := insertUsage(tempExamID, "课程级-历史考试", "finished", "course", "manual", uuid.NewString())
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = ANY($1::uuid[])", []string{manualUsageID, otherClassUsageID, taskUsageID, taskManualUsageID, nodeUsageID, courseUsageID})

	// 3. 考试管理列表：手动创建的 + 自动创建且手动/定时启停的展示；随时作答/历史课程级不展示
	w := env.Do("GET", "/api/v1/evaluation/exam-usages", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list exam usages: expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal exam usages: %v", err)
	}
	gotIDs := map[string]bool{}
	for _, u := range items {
		gotIDs[u.ID] = true
	}
	if !gotIDs[manualUsageID] {
		t.Fatalf("考试管理列表应包含手动考试安排 %s，实际 %v", manualUsageID, gotIDs)
	}
	if !gotIDs[taskManualUsageID] {
		t.Fatalf("考试管理列表应包含手动启停的自动考试 %s，实际 %v", taskManualUsageID, gotIDs)
	}
	for _, id := range []string{taskUsageID, nodeUsageID, courseUsageID} {
		if gotIDs[id] {
			t.Fatalf("考试管理列表不应包含随时作答/历史课程级安排 %s", id)
		}
	}

	// 4. 学生（班级命中 manualUsage 的目标班级，验证考试相关展示与班级过滤）
	studentID := uuid.NewString()
	pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	execOrFail(t, env, ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
		VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '考试可见性测试学生', 'active', '{}', $5)
	`, studentID, tenantID, "stu-"+uuid.NewString()[:8], string(pw), classID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)

	st2 := store.New(env.DB)
	svc2 := service.New(st2)
	portalHandler := &handler.PortalHandler{Service: service.NewPositionService(svc2)}
	rr := chi.NewRouter()
	rr.Use(middleware.JWT(testhelper.TestJWTSecret))
	rr.Get("/portal/workspace/dashboard", portalHandler.WorkspaceDashboard)

	token := env.NewTokenWithIdentity(studentID, tenantID, domain.RoleStudent, nil, "student")
	w = execWithRouter(t, rr, token)

	dash, err := testhelper.Unmarshal[domain.WorkspaceDashboard](w)
	if err != nil {
		t.Fatalf("unmarshal dashboard: %v", err)
	}

	// 测评认证 tab：exams 只含手动考试安排，且班级类考试仅含本人班级命中的
	examIDs := map[string]bool{}
	for _, e := range dash.Exams {
		examIDs[e.ID] = true
	}
	if !examIDs[manualUsageID] {
		t.Fatalf("学生考试列表应包含本人班级手动考试安排 %s，实际 %v", manualUsageID, examIDs)
	}
	if examIDs[otherClassUsageID] {
		t.Fatalf("学生考试列表不应包含其他班级考试安排 %s", otherClassUsageID)
	}
	for _, id := range []string{taskUsageID, taskManualUsageID, nodeUsageID, courseUsageID} {
		if examIDs[id] {
			t.Fatalf("学生考试列表不应包含临时考试安排 %s", id)
		}
	}

	// 工作台首页-课程表：考试事件只含手动考试安排（本人班级）
	eventIDs := map[string]bool{}
	for _, ev := range dash.Schedule {
		if ev.Type == "exam" {
			eventIDs[ev.ID] = true
		}
	}
	for _, id := range []string{otherClassUsageID, taskUsageID, taskManualUsageID, nodeUsageID, courseUsageID} {
		if eventIDs[id] {
			t.Fatalf("工作台首页课程表不应包含考试安排 %s", id)
		}
	}
	if len(eventIDs) != 1 || !eventIDs[manualUsageID] {
		t.Fatalf("工作台首页课程表应只含本人班级手动考试安排 %s，实际 %v", manualUsageID, eventIDs)
	}

	// 工作台首页-今日待办：待参加考试数只统计手动考试安排（本人班级）
	upcomingCount := 0
	for _, todo := range dash.Todos {
		if todo.ID == "upcoming-exams" {
			upcomingCount = todo.Count
		}
	}
	if upcomingCount != 1 {
		t.Fatalf("待参加考试数应为 1（仅本人班级手动考试安排），实际 %d", upcomingCount)
	}
}
