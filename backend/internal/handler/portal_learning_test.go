package handler_test

import (
	"context"
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

// TestPortalWorkspace_LearningScheduleFilter 验证"我的学习"只返回学生班级已发布排课的课程/场景。
func TestPortalWorkspace_LearningScheduleFilter(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	tenantID := testhelper.TestTenantID

	// 1. 组织类型（班级）
	orgTypeID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO org_types (id, tenant_id, name, category, is_default)
		VALUES ($1, $2, '测试班级', 'internal', FALSE)
	`, orgTypeID, tenantID)

	// 2. 班级节点
	class1, class2 := uuid.NewString(), uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id) VALUES ($1, $2, '测试班1', $3)
	`, class1, tenantID, orgTypeID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id) VALUES ($1, $2, '测试班2', $3)
	`, class2, tenantID, orgTypeID)

	// 3. 学期
	termID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count)
		VALUES ($1, $2, '2025-2026-1', '2025-09-01', '2026-01-15', 16)
	`, termID, tenantID)

	// 4. 学生（属于测试班1）
	studentID := uuid.NewString()
	pw, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	execOrFail(t, env, ctx, `
		INSERT INTO users (id, tenant_id, org_node_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, $3, 'school', 'portal', $4, $4, $5, '测试学生', 'active', '{}')
	`, studentID, tenantID, class1, "stu-"+uuid.NewString()[:8], string(pw))

	// 5. 课程：course1 排给班1已发布；course2 排给班2；course3 未排课；course4 排给班1但草稿
	insertCourse := func(name string) string {
		id := uuid.NewString()
		execOrFail(t, env, ctx, `
			INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id)
			VALUES ($1, $2, $3, $4, 'traditional', 'course', 'published', $5)
		`, id, tenantID, name, name, testhelper.TestOperatorID)
		return id
	}
	course1 := insertCourse("c1-排给班1")
	course2 := insertCourse("c2-排给班2")
	course3 := insertCourse("c3-未排课")
	course4ID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id)
		VALUES ($1, $2, $3, $4, 'traditional', 'course', 'published', $5)
	`, course4ID, tenantID, "c4-草稿排课", "c4-草稿排课", testhelper.TestOperatorID)

	// 6. 场景：scene1 排给班1已发布；scene2 排给班2；scene3 未排课
	insertScene := func(name string) (string, string) {
		sceneID := uuid.NewString()
		execOrFail(t, env, ctx, `
			INSERT INTO scenarios (id, name, code, version, status, creator_id, difficulty)
			VALUES ($1, $2, $3, '1.0', 'published', $4, 2)
		`, sceneID, name, name, testhelper.TestOperatorID)
		taskID := uuid.NewString()
		execOrFail(t, env, ctx, `
			INSERT INTO scenario_tasks (id, scenario_id, name, code, task_type, difficulty)
			VALUES ($1, $2, $3, $4, 'practice', 2)
		`, taskID, sceneID, name+"-任务", name+"-task")
		return sceneID, taskID
	}
	scene1, task1 := insertScene("s1-排给班1")
	scene2, task2 := insertScene("s2-排给班2")
	_, task3 := insertScene("s3-未排课")

	// 7. 排课
	insertSchedule := func(courseName string, courseID, scenarioID *string, entryType string, classID string, status string) {
		var cid, sid any
		if courseID != nil {
			cid = *courseID
		}
		if scenarioID != nil {
			sid = *scenarioID
		}
		execOrFail(t, env, ctx, `
			INSERT INTO schedule_entries (tenant_id, term_id, course_name, type, class_node_id, class_node_ids,
				day_of_week, periods, start_week, end_week, week_pattern, status, course_id, scenario_id)
			VALUES ($1, $2, $3, $4, $5, ARRAY[$5]::uuid[], 1, '["上午1-2"]'::jsonb, 1, 16, 'all', $6, $7, $8)
		`, tenantID, termID, courseName, entryType, classID, status, cid, sid)
	}
	insertSchedule("c1-排给班1", &course1, nil, "traditional", class1, "published")
	insertSchedule("c2-排给班2", &course2, nil, "traditional", class2, "published")
	insertSchedule("c4-草稿排课", &course4ID, nil, "traditional", class1, "draft")
	insertSchedule("s1-排给班1", nil, &scene1, "scene", class1, "published")
	insertSchedule("s2-排给班2", nil, &scene2, "scene", class2, "published")

	// 8. 自定义路由挂载 workspace dashboard（绕过 Redis 缓存中间件）
	st2 := store.New(env.DB)
	svc2 := service.New(st2)
	portalHandler := &handler.PortalHandler{Service: service.NewPositionService(svc2)}
	rr := chi.NewRouter()
	rr.Use(middleware.JWT(testhelper.TestJWTSecret))
	rr.Get("/portal/workspace/dashboard", portalHandler.WorkspaceDashboard)

	token := env.NewTokenWithIdentity(studentID, tenantID, domain.RoleStudent, nil, "student")
	w := execWithRouter(t, rr, token)

	dash, err := testhelper.Unmarshal[domain.WorkspaceDashboard](w)
	if err != nil {
		t.Fatalf("unmarshal dashboard: %v", err)
	}

	if len(dash.Courses) != 1 || dash.Courses[0].ID != course1 {
		t.Fatalf("courses = %v, want only [%s]", courseIDs(dash.Courses), course1)
	}
	for _, c := range dash.Courses {
		if c.ID == course2 || c.ID == course3 || c.ID == course4ID {
			t.Fatalf("course %s 不应出现（非本班/未排课/草稿排课）", c.ID)
		}
	}
	if len(dash.SceneTasks) != 1 || dash.SceneTasks[0].ScenarioID != scene1 {
		t.Fatalf("sceneTasks = %v, want only scenario [%s]", sceneTaskScenarioIDs(dash.SceneTasks), scene1)
	}
	if len(dash.SceneTasks) != 1 || dash.SceneTasks[0].ID != task1 {
		t.Fatalf("sceneTasks ids = %v, want only [%s]", sceneTaskIDs(dash.SceneTasks), task1)
	}
	for _, s := range dash.SceneTasks {
		if s.ScenarioID == scene2 || s.ID == task2 || s.ID == task3 {
			t.Fatalf("sceneTask %s 不应出现（非本班/未排课）", s.ID)
		}
	}

	// 9. 清理
	for _, q := range []string{
		"DELETE FROM schedule_entries WHERE tenant_id = $1",
		"DELETE FROM scenario_tasks WHERE scenario_id IN (SELECT id FROM scenarios WHERE tenant_id = $1)",
		"DELETE FROM scenarios WHERE tenant_id = $1",
		"DELETE FROM courses WHERE tenant_id = $1",
		"DELETE FROM terms WHERE tenant_id = $1",
		"DELETE FROM organizations WHERE tenant_id = $1",
		"DELETE FROM org_types WHERE tenant_id = $1",
	} {
		env.DB.Exec(ctx, q, tenantID)
	}
	env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
}

func execOrFail(t *testing.T, env *testhelper.TestEnv, ctx context.Context, sql string, args ...any) {
	t.Helper()
	if _, err := env.DB.Exec(ctx, sql, args...); err != nil {
		t.Fatalf("exec: %v\nsql: %s", err, sql)
	}
}

func execWithRouter(t *testing.T, rr chi.Router, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("GET", "/portal/workspace/dashboard?role=student", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	rr.ServeHTTP(rec, req)
	return rec
}

func courseIDs(courses []domain.WorkspaceCourse) []string {
	ids := make([]string, 0, len(courses))
	for _, c := range courses {
		ids = append(ids, c.ID)
	}
	return ids
}

func sceneTaskIDs(tasks []domain.WorkspaceSceneTask) []string {
	ids := make([]string, 0, len(tasks))
	for _, t2 := range tasks {
		ids = append(ids, t2.ID)
	}
	return ids
}

func sceneTaskScenarioIDs(tasks []domain.WorkspaceSceneTask) []string {
	ids := make([]string, 0, len(tasks))
	for _, t2 := range tasks {
		ids = append(ids, t2.ScenarioID)
	}
	return ids
}
