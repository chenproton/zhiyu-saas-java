package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestStudentDashboard 画像页聚合数据：实践场景数（学生有评分场景）、
// 推荐岗位（已发布场景关联岗位去重）、课程成绩（租户课程+学生成绩合并，无成绩为空）。
func TestStudentDashboard(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionA := "11111111-2222-4333-8444-555555555551"
	positionB := "11111111-2222-4333-8444-555555555552"
	userID := "11111111-2222-4333-8444-777777777781"
	creatorID := "11111111-2222-4333-8444-777777777782"
	sceneA := "11111111-2222-4333-8444-888888888881"
	sceneB := "11111111-2222-4333-8444-888888888882"
	taskA := "11111111-2222-4333-8444-999999999991"
	taskB := "11111111-2222-4333-8444-999999999992"
	courseA := "11111111-2222-4333-8444-aaaaaaaaaaa1"
	courseB := "11111111-2222-4333-8444-aaaaaaaaaaa2"
	classNode := "11111111-2222-4333-8444-ccccccccccc1"
	termID := "11111111-2222-4333-8444-ddddddddddd1"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM schedule_entries WHERE class_node_id = $1", classNode)
		for _, t := range []string{taskA, taskB} {
			env.DB.Exec(ctx, "DELETE FROM scene_evaluation_results WHERE task_id = $1", t)
			env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", t)
		}
		for _, s := range []string{sceneA, sceneB} {
			env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", s)
		}
		for _, c := range []string{courseA, courseB} {
			env.DB.Exec(ctx, "DELETE FROM course_evaluation_results WHERE course_id = $1", c)
			env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", c)
		}
		for _, p := range []string{positionA, positionB} {
			env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", p)
		}
		for _, u := range []string{userID, creatorID} {
			env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", u)
		}
	}
	defer cleanup()

	for _, p := range []string{positionA, positionB} {
		env.DB.Exec(ctx, `
			INSERT INTO career_positions (id, name, position_type, requirements, version, status, created_by, tenant_id)
			VALUES ($1, '测试岗位', 'job', '{}', 'v1', 'published', $2, $3)
		`, p, testhelper.TestOperatorID, testhelper.TestTenantID)
	}
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
		VALUES ($1, $2, 'school', 'portal', 'dash-stu', 'dash-stu', 'x', '测试学生', 'active', '{}', $3)
	`, userID, testhelper.TestTenantID, classNode)
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'teacher', 'portal', 'dash-creator', 'dash-creator', 'x', '创建者', 'active', '{}')
	`, creatorID, testhelper.TestTenantID)

	// 已发布场景 A（关联岗位A）+ 场景 B（关联岗位B），各带一个任务
	env.DB.Exec(ctx, `
		INSERT INTO scenarios (id, name, code, version, status, creator_id, career_position_id, tenant_id)
		VALUES ($1, '场景A', 'sc-a', 'v1', 'published', $2, $3, $4)
	`, sceneA, creatorID, positionA, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO scenarios (id, name, code, version, status, creator_id, career_position_id, tenant_id)
		VALUES ($1, '场景B', 'sc-b', 'v1', 'published', $2, $3, $4)
	`, sceneB, creatorID, positionB, testhelper.TestTenantID)
	for _, tk := range [][2]string{{taskA, sceneA}, {taskB, sceneB}} {
		env.DB.Exec(ctx, `
			INSERT INTO scenario_tasks (id, scenario_id, name, code, task_type, tenant_id)
			VALUES ($1, $2, '任务', 'tk', 'scene', $3)
		`, tk[0], tk[1], testhelper.TestTenantID)
	}

	// 学生仅在场景A的任务有已评评分 → sceneCount=1
	env.DB.Exec(ctx, `
		INSERT INTO scene_evaluation_results (task_id, scene_id, method_key, evaluatee_id, status, total_score, max_score, tenant_id)
		VALUES ($1, $2, 'review', $3, 'evaluated', 80, 100, $4)
	`, taskA, sceneA, userID, testhelper.TestTenantID)

	// 两门已发布课程，仅课程A有学生成绩
	for _, c := range []string{courseA, courseB} {
		env.DB.Exec(ctx, `
			INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id)
			VALUES ($1, $2, '课程', 'system', '基础', 'published', $3, $4)
		`, c, "c-"+c[len(c)-4:], creatorID, testhelper.TestTenantID)
	}
	env.DB.Exec(ctx, `
		INSERT INTO course_evaluation_results (course_id, evaluatee_id, status, total_score, max_score, tenant_id, method_key)
		VALUES ($1, $2, 'evaluated', 88, 100, $3, 'course')
	`, courseA, userID, testhelper.TestTenantID)

	// 排课：课程A（traditional）+ 场景A（scene）排给学生班级并发布；课程B/场景B 不排
	env.DB.Exec(ctx, `
		INSERT INTO schedule_entries (tenant_id, term_id, course_name, type, class_node_id, course_id, day_of_week, periods, start_week, end_week, week_pattern, source, status)
		VALUES ($1, $2, '课程A', 'traditional', $3, $4, 1, '[1]'::jsonb, 1, 16, 'all', 'manual', 'published')
	`, testhelper.TestTenantID, termID, classNode, courseA)
	env.DB.Exec(ctx, `
		INSERT INTO schedule_entries (tenant_id, term_id, course_name, type, class_node_id, scenario_id, day_of_week, periods, start_week, end_week, week_pattern, source, status)
		VALUES ($1, $2, '场景A', 'scene', $3, $4, 2, '[1]'::jsonb, 1, 16, 'all', 'manual', 'published')
	`, testhelper.TestTenantID, termID, classNode, sceneA)

	w := env.Do("GET", "/api/v1/evaluation/portraits/student-dashboard?userId="+userID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("student-dashboard: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var resp handler.StudentDashboardResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.SceneCount != 1 {
		t.Errorf("sceneCount = %d, want 1", resp.SceneCount)
	}
	if len(resp.Positions) != 1 {
		t.Fatalf("positions len = %d, want 1（仅排课场景A关联岗位）", len(resp.Positions))
	}
	if len(resp.Courses) != 1 {
		t.Fatalf("courses len = %d, want 1（仅排课课程A）", len(resp.Courses))
	}
	byCourse := map[string]handler.PortraitCourseItem{}
	for _, c := range resp.Courses {
		byCourse[c.CourseID] = c
	}
	scored := byCourse[courseA]
	if scored.Score == nil || *scored.Score != 88 {
		t.Errorf("课程A应有成绩 88，实际 %v", scored.Score)
	}
}
