package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPositionDeleteCleansAbilityData 验证删除岗位时同步清理无外键约束的
// 岗位能力结果/学生画像/汇聚日志，防止孤儿数据残留在评价中心与工作台学生画像中。
func TestPositionDeleteCleansAbilityData(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "11111111-2222-4333-8444-888888888888"
	studentID := "11111111-2222-4333-8444-999999999999"
	ruleID := "11111111-2222-4333-8444-aaaaaaaaaaaa"
	abilityPointID := "11111111-2222-4333-8444-bbbbbbbbbbbb"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM job_ability_results WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM student_ability_portraits WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM job_ability_aggregate_logs WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE id = $1", ruleID)
		env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", abilityPointID)
		env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
	}
	defer cleanup()

	// 认证权重引用能力点，先建能力点
	env.DB.Exec(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, code, category)
		VALUES ($1, $2, '测试能力点', 'CLN-AP', 'core')
	`, abilityPointID, testhelper.TestTenantID)

	env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, 'CLN-TEST', '待删除岗位', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)

	// 学生画像 user_id 有 CASCADE 外键，先建用户
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'portraitclean', 'portraitclean', 'x', '测试学生', 'active', '{}')
	`, studentID, testhelper.TestTenantID)

	env.DB.Exec(ctx, `
		INSERT INTO job_ability_results (career_position_id, user_id, total_ability_points, achieved_ability_points, achievement_rate, grade, tenant_id)
		VALUES ($1, $2, 3, 2, 80, '熟练', $3)
	`, positionID, studentID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO student_ability_portraits (user_id, career_position_id, overall_grade)
		VALUES ($1, $2, '精通')
	`, studentID, positionID)
	env.DB.Exec(ctx, `
		INSERT INTO job_ability_aggregate_logs (tenant_id, career_position_id, status)
		VALUES ($1, $2, 'finished')
	`, testhelper.TestTenantID, positionID)
	env.DB.Exec(ctx, `
		INSERT INTO certification_rules (id, career_position_id, status, rule_source, level_mapping, tenant_id)
		VALUES ($1, $2, 'published', 'custom', '[]', $3)
	`, ruleID, positionID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO certification_weights (rule_id, ability_point_id, weight, tenant_id)
		VALUES ($1, $2, 100, $3)
	`, ruleID, abilityPointID, testhelper.TestTenantID)

	w := env.Do("DELETE", "/api/v1/job/positions/"+positionID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete position: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	var remain int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM job_ability_results WHERE career_position_id = $1`, positionID).Scan(&remain)
	if remain != 0 {
		t.Errorf("job_ability_results 残留 %d 行", remain)
	}
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM student_ability_portraits WHERE career_position_id = $1`, positionID).Scan(&remain)
	if remain != 0 {
		t.Errorf("student_ability_portraits 残留 %d 行", remain)
	}
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM job_ability_aggregate_logs WHERE career_position_id = $1`, positionID).Scan(&remain)
	if remain != 0 {
		t.Errorf("job_ability_aggregate_logs 残留 %d 行", remain)
	}
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM certification_rules WHERE career_position_id = $1`, positionID).Scan(&remain)
	if remain != 0 {
		t.Errorf("certification_rules 残留 %d 行", remain)
	}
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM certification_weights WHERE rule_id = $1`, ruleID).Scan(&remain)
	if remain != 0 {
		t.Errorf("certification_weights 残留 %d 行", remain)
	}
}
