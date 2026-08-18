package handler_test

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"golang.org/x/crypto/bcrypt"
)

// TestJobAbilityResultIndicators 岗位胜任度/认知得分：落库值优先返回，存量 NULL 行回退实时计算。
func TestJobAbilityResultIndicators(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "11111111-2222-4333-8444-555555555555"
	ruleID := "11111111-2222-4333-8444-666666666666"
	userA := "11111111-2222-4333-8444-777777777771"
	userB := "11111111-2222-4333-8444-777777777772"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE id = $1", ruleID)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM job_ability_results WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM users WHERE id IN ($1, $2)", userA, userB)
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

	pw, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	for _, uid := range []string{userA, userB} {
		env.DB.Exec(ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
			VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '测试学生', 'active', '{}') ON CONFLICT (id) DO NOTHING
		`, uid, testhelper.TestTenantID, "indicator"+uid[len(uid)-3:], pw)
	}

	details := `[{"abilityPointName":"点A","score":85,"weight":0.6,"requiredLevel":"master","achieved":true},{"abilityPointName":"点B","score":55,"weight":0.4,"requiredLevel":"expert","achieved":false}]`
	// 落库行：两指标已存储，读取直接返回
	env.DB.Exec(ctx, `
		INSERT INTO job_ability_results (career_position_id, user_id, total_ability_points, achieved_ability_points, achievement_rate, grade, tenant_id, ability_point_details, ability_cognition_score, position_competency, position_competency_v2)
		VALUES ($1, $2, 2, 1, 73, '熟练', $3, $4::jsonb, 73.00, 12.86, 105.00)
	`, positionID, userA, testhelper.TestTenantID, details)
	// 存量行：指标列均为 NULL，读取时回退实时计算
	env.DB.Exec(ctx, `
		INSERT INTO job_ability_results (career_position_id, user_id, total_ability_points, achieved_ability_points, achievement_rate, grade, tenant_id, ability_point_details)
		VALUES ($1, $2, 2, 1, 73, '熟练', $3, $4::jsonb)
	`, positionID, userB, testhelper.TestTenantID, details)

	w := env.Do("GET", "/api/v1/evaluation/job-ability/results?careerPositionId="+positionID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var resp struct {
		Items []handler.JobAbilityResultItem `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	byUser := map[string]handler.JobAbilityResultItem{}
	for _, it := range resp.Items {
		byUser[it.UserID] = it
	}
	stored, ok := byUser[userA]
	if !ok {
		t.Fatal("缺少落库行结果")
	}
	if stored.PositionCompetency != 12.86 || stored.AbilityCognitionScore != 73.0 {
		t.Errorf("落库行应直接返回存储值，实际 competency=%v cognition=%v", stored.PositionCompetency, stored.AbilityCognitionScore)
	}
	if stored.PositionCompetencyV2 != 105.0 {
		t.Errorf("落库行胜任度（新）应直接返回存储值 105，实际 %v", stored.PositionCompetencyV2)
	}
	fallback, ok := byUser[userB]
	if !ok {
		t.Fatal("缺少存量行结果")
	}
	wantComp := ((85.0-70)/70.0*0.6 + 0) * 100
	if math.Abs(fallback.PositionCompetency-wantComp) > 1e-6 {
		t.Errorf("存量行胜任度应回退计算为 %v，实际 %v", wantComp, fallback.PositionCompetency)
	}
	if math.Abs(fallback.AbilityCognitionScore-73.0) > 1e-6 {
		t.Errorf("存量行认知得分应回退计算为 73，实际 %v", fallback.AbilityCognitionScore)
	}
	// 胜任度（新）回退：点A 85分→熟练带4.5、要求掌握3.0→(100+1.5×50)×0.6=105；点B 55分低于基准→0
	wantV2 := (100+(4.5-3)*50)*0.6 + 0
	if math.Abs(fallback.PositionCompetencyV2-wantV2) > 1e-6 {
		t.Errorf("存量行胜任度（新）应回退计算为 %v，实际 %v", wantV2, fallback.PositionCompetencyV2)
	}
}

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
		VALUES ($1, $2, 'school', 'portal', 'summarytest', 'summarytest', $3, '测试学生', 'active', '{}') ON CONFLICT (id) DO NOTHING
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
