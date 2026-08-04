package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"golang.org/x/crypto/bcrypt"
)

// TestJobAbilityResultSummary 左侧岗位汇总：以已发布认证规则岗位为基准，
// 未汇聚（0 学生）也要返回，便于手动触发汇聚。
func TestJobAbilityResultSummary(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "11111111-2222-4333-8444-555555555555"
	ruleID := "11111111-2222-4333-8444-666666666666"
	studentID := "11111111-2222-4333-8444-777777777777"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE id = $1", ruleID)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM job_ability_results WHERE user_id = $1", studentID)
		env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
	}
	defer cleanup()

	env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, '测试岗位', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO certification_rules (id, career_position_id, status, rule_source, level_mapping, tenant_id)
		VALUES ($1, $2, 'published', 'custom', '[]', $3)
	`, ruleID, positionID, testhelper.TestTenantID)

	// 已发布规则 + 无汇聚结果 → 岗位仍出现在汇总中，人数 0
	w := env.Do("GET", "/api/v1/evaluation/job-ability/results/summary", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("summary: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items := []handler.JobAbilitySummaryItem{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal summary: %v", err)
	}
	var emptyFound bool
	for _, it := range items {
		if it.PositionID == positionID {
			emptyFound = true
			if it.StudentCount != 0 {
				t.Errorf("无结果岗位人数应为 0，实际 %d", it.StudentCount)
			}
		}
	}
	if !emptyFound {
		t.Fatal("已发布规则岗位应出现在汇总中（即使无汇聚结果）")
	}

	// 写入 1 条汇聚结果后，人数/达标率应正确统计
	pw, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'summarytest', 'summarytest', $3, '测试学生', 'active', '{}')
	`, studentID, testhelper.TestTenantID, pw)
	env.DB.Exec(ctx, `
		INSERT INTO job_ability_results (career_position_id, user_id, total_ability_points, achieved_ability_points, achievement_rate, grade, tenant_id)
		VALUES ($1, $2, 3, 2, 80, '熟练', $3)
	`, positionID, studentID, testhelper.TestTenantID)

	w = env.Do("GET", "/api/v1/evaluation/job-ability/results/summary", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("summary after insert: expected 200, got %d", w.Code)
	}
	items = []handler.JobAbilitySummaryItem{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal summary: %v", err)
	}
	for _, it := range items {
		if it.PositionID == positionID {
			if it.StudentCount != 1 {
				t.Errorf("有结果岗位人数应为 1，实际 %d", it.StudentCount)
			}
			if it.AvgRate < 79 || it.AvgRate > 81 {
				t.Errorf("达标率应为 80，实际 %v", it.AvgRate)
			}
			return
		}
	}
	t.Fatal("写入结果后岗位应仍在汇总中")
}
