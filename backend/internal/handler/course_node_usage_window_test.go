package handler_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestCourseNodeUsageWindow 课程节点测评方式配置的时长/定时启用同步到考试安排（创建 + 更新）。
func TestCourseNodeUsageWindow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	courseID := uuid.NewString()
	nodeID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id)
		VALUES ($1, $2, '测试体系课', 'system', '专业基础课', 'published', $3, $4)
	`, courseID, "KC-"+uuid.NewString()[:8], testhelper.TestOperatorID, tenantID)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", courseID)

	paperID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO exams (id, tenant_id, name, status, duration, creator_id, code, is_temp)
		VALUES ($1, $2, '节点试卷', 'published', 60, $3, $4, false)
	`, paperID, tenantID, testhelper.TestOperatorID, "SJ-"+uuid.NewString()[:8])
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", paperID)

	evalData := map[string]interface{}{
		"evalRuleConfig": map[string]interface{}{
			"evaluationMethods": []interface{}{"paper"},
			"paperIds":          []interface{}{paperID},
			"methodResourceConfigs": map[string]interface{}{
				"paper": map[string]interface{}{
					"activationMode":   "scheduled",
					"scheduledTime":    "2026-09-01T08:00:00Z",
					"scheduledEndTime": "2026-09-30T18:00:00Z",
					"duration":         45.0,
				},
			},
		},
	}
	evalDataJSON, _ := json.Marshal(evalData)
	execOrFail(t, env, ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, sort_order, tenant_id, eval_data, status)
		VALUES ($1, $2, '节点一', 0, $3, $4::jsonb, 'published')
	`, nodeID, courseID, tenantID, string(evalDataJSON))
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", nodeID)

	st := store.New(env.DB)
	svc := service.New(st)
	lessonSvc := service.NewLessonContentService(svc)

	// 1. 首次生成：创建考试安排并落库时间窗与时长
	if err := lessonSvc.GenerateCourseAssessments(ctx, st, courseID); err != nil {
		t.Fatalf("生成课程测评失败: %v", err)
	}
	usage, err := st.CourseAssessments().FindNodeUsage(ctx, st.Q(), paperID, nodeID)
	if err != nil {
		t.Fatalf("查询节点安排失败: %v", err)
	}
	if usage == "" {
		t.Fatal("应生成节点考试安排")
	}
	checkUsageWindow(t, env, ctx, usage, "2026-09-01T08:00:00Z", "2026-09-30T18:00:00Z", 45)

	// 2. 配置变更后重新生成：同步更新已有安排
	evalData["evalRuleConfig"].(map[string]interface{})["methodResourceConfigs"].(map[string]interface{})["paper"] = map[string]interface{}{
		"activationMode":   "scheduled",
		"scheduledTime":    "2026-10-01T08:00:00Z",
		"scheduledEndTime": "2026-10-31T18:00:00Z",
		"duration":         90.0,
	}
	evalDataJSON, _ = json.Marshal(evalData)
	execOrFail(t, env, ctx, `
		UPDATE system_course_nodes SET eval_data = $1::jsonb WHERE id = $2
	`, string(evalDataJSON), nodeID)
	if err := lessonSvc.GenerateCourseAssessments(ctx, st, courseID); err != nil {
		t.Fatalf("重新生成课程测评失败: %v", err)
	}
	checkUsageWindow(t, env, ctx, usage, "2026-10-01T08:00:00Z", "2026-10-31T18:00:00Z", 90)

	// 3. 改为随时作答（无窗口）：清空时间窗，时长仍取配置的 45 分钟
	evalData["evalRuleConfig"].(map[string]interface{})["methodResourceConfigs"].(map[string]interface{})["paper"] = map[string]interface{}{
		"activationMode": "always",
		"duration":       45.0,
	}
	evalDataJSON, _ = json.Marshal(evalData)
	execOrFail(t, env, ctx, `
		UPDATE system_course_nodes SET eval_data = $1::jsonb WHERE id = $2
	`, string(evalDataJSON), nodeID)
	if err := lessonSvc.GenerateCourseAssessments(ctx, st, courseID); err != nil {
		t.Fatalf("再次重新生成课程测评失败: %v", err)
	}
	checkUsageWindow(t, env, ctx, usage, "", "", 45)

	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usage)
}

func checkUsageWindow(t *testing.T, env *testhelper.TestEnv, ctx context.Context, usageID, wantStart, wantEnd string, wantDuration int) {
	t.Helper()
	var start, end *string
	var duration *int
	err := env.DB.QueryRow(ctx, `
		SELECT
			CASE WHEN start_time IS NULL THEN NULL ELSE to_char(start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
			CASE WHEN end_time IS NULL THEN NULL ELSE to_char(end_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
			duration
		FROM exam_usages WHERE id = $1
	`, usageID).Scan(&start, &end, &duration)
	if err != nil {
		t.Fatalf("查询考试安排窗口失败: %v", err)
	}
	gotStart, gotEnd := "", ""
	if start != nil {
		gotStart = *start
	}
	if end != nil {
		gotEnd = *end
	}
	if gotStart != wantStart || gotEnd != wantEnd {
		t.Fatalf("时间窗不匹配：got start=%s end=%s, want start=%s end=%s", gotStart, gotEnd, wantStart, wantEnd)
	}
	gotDuration := 0
	if duration != nil {
		gotDuration = *duration
	}
	if gotDuration != wantDuration {
		t.Fatalf("时长不匹配：got %d, want %d", gotDuration, wantDuration)
	}
}
