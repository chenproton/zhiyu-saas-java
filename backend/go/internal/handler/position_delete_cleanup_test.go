package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPositionDeleteCleansAbilityData 删除保护（文档 5.5 决策 6）+ 清理逻辑：
// 存在岗位能力结果/学生画像时删除被拒绝（409，数据保留）；
// 清除成绩类数据后删除岗位，仍同步清理无外键约束的汇聚日志/认证规则链，防止孤儿数据残留。
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
		INSERT INTO ability_points (id, tenant_id, name, code)
		VALUES ($1, $2, '测试能力点', 'CLN-AP')
	`, abilityPointID, testhelper.TestTenantID)

	env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, 'CLN-TEST', '待删除岗位', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)

	// 学生画像 user_id 有 CASCADE 外键，先建用户
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'portraitclean', 'portraitclean', 'x', '测试学生', 'active', '{}') ON CONFLICT (id) DO NOTHING
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

	// 阶段 1：存在能力结果/学生画像 → 删除保护 409，岗位与成绩数据保留
	w := env.Do("DELETE", "/api/v1/job/positions/"+positionID, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("删除保护: expected 409, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var remain int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM career_positions WHERE id = $1`, positionID).Scan(&remain)
	if remain != 1 {
		t.Fatalf("删除保护后岗位应保留, 剩 %d 行", remain)
	}
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM job_ability_results WHERE career_position_id = $1`, positionID).Scan(&remain)
	if remain != 1 {
		t.Fatalf("删除保护后能力结果应保留, 剩 %d 行", remain)
	}

	// 阶段 2：清除成绩类数据（结果/画像）→ 允许删除，汇聚日志/认证链仍被同步清理
	env.DB.Exec(ctx, "DELETE FROM job_ability_results WHERE career_position_id = $1", positionID)
	env.DB.Exec(ctx, "DELETE FROM student_ability_portraits WHERE career_position_id = $1", positionID)

	w = env.Do("DELETE", "/api/v1/job/positions/"+positionID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete position: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
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
