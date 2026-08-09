package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
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
	orgTypeID := "11111111-2222-4333-8444-eeeeeeeeeee1"

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
			env.DB.Exec(ctx, "DELETE FROM node_evaluation_results WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = $1)", c)
			env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE course_id = $1", c)
			env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", c)
		}
		for _, p := range []string{positionA, positionB} {
			env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", p)
		}
		for _, u := range []string{userID, creatorID} {
			env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", u)
		}
		env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", classNode)
		env.DB.Exec(ctx, "DELETE FROM org_types WHERE id = $1", orgTypeID)
		env.DB.Exec(ctx, "DELETE FROM terms WHERE id = $1", termID)
	}
	defer cleanup()

	// 岗位 code 为 NOT NULL
	for i, p := range []string{positionA, positionB} {
		env.DB.Exec(ctx, `
			INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
			VALUES ($1, $2, '测试岗位', 'job', '{}', 'v1', 'published', $3, $4)
		`, p, fmt.Sprintf("POS-DASH-%d", i), testhelper.TestOperatorID, testhelper.TestTenantID)
	}

	// 学生/排课的班级节点有 organizations FK，先造 org_type + 班级节点
	env.DB.Exec(ctx, `
		INSERT INTO org_types (id, tenant_id, name, category)
		VALUES ($1, $2, 'dashboard-test-type', 'class')
	`, orgTypeID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id)
		VALUES ($1, $2, 'dashboard-test-class', $3)
	`, classNode, testhelper.TestTenantID, orgTypeID)
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, org_node_id)
		VALUES ($1, $2, 'school', 'portal', 'dash-stu', 'dash-stu', 'x', '测试学生', 'active', '{}', $3)
	`, userID, testhelper.TestTenantID, classNode)
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'dash-creator', 'dash-creator', 'x', '创建者', 'active', '{}')
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
	// 课程成绩由节点测评结果归一化平均得出（ListStudentCourseScores 口径）：
	// 课程A 下一个节点 + 学生已评成绩 88/100
	nodeA := "11111111-2222-4333-8444-bbbbbbbbbbb1"
	env.DB.Exec(ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, sort_order, tenant_id, status)
		VALUES ($1, $2, '节点A', 0, $3, 'published')
	`, nodeA, courseA, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO node_evaluation_results (id, tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score)
		VALUES ($1, $2, $3, 'paper', $4, 'evaluated', 88, 100)
	`, "11111111-2222-4333-8444-bbbbbbbbbbb2", testhelper.TestTenantID, nodeA, userID)

	// 排课：课程A（traditional）+ 场景A（scene）排给学生班级并发布；课程B/场景B 不排
	// schedule_entries.term_id 有 FK，先造学期
	env.DB.Exec(ctx, `
		INSERT INTO terms (id, tenant_id, name, start_date, end_date)
		VALUES ($1, $2, 'dashboard-test-term', '2026-01-01', '2026-07-01')
	`, termID, testhelper.TestTenantID)
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
