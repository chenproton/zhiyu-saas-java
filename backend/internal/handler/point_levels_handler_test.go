package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPutPointLevels 验证能力点五档分数线保存：合法配置落库并随模型回显，非法配置返回 400。
func TestPutPointLevels(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "11111111-2222-4333-8444-cccccccccccc"
	abilityPointID := "11111111-2222-4333-8444-dddddddddddd"
	responsibilityID := "11111111-2222-4333-8444-eeeeeeeeeeee"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM certification_point_levels WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM position_ability_bindings WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM position_responsibilities WHERE id = $1", responsibilityID)
		env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", abilityPointID)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
	}
	defer cleanup()

	env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, 'LVL-TEST', '分档测试岗位', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, category, code)
		VALUES ($1, $2, '测试能力点', 'core', 'LVL-AP')
	`, abilityPointID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO position_responsibilities (id, career_position_id, name, tenant_id)
		VALUES ($1, $2, '测试职责', $3)
	`, responsibilityID, positionID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO position_ability_bindings (career_position_id, responsibility_id, ability_point_id, required_level, tenant_id)
		VALUES ($1, $2, $3, 'proficient', $4)
	`, positionID, responsibilityID, abilityPointID, testhelper.TestTenantID)

	valid := []domain.LevelMapping{
		{Level: "understand", Min: 56, Max: 68},
		{Level: "comprehend", Min: 69, Max: 78},
		{Level: "master", Min: 79, Max: 88},
		{Level: "proficient", Min: 89, Max: 95},
		{Level: "expert", Min: 96, Max: 100},
	}

	// 非法配置：档数不足 → 400
	w := env.Do("PUT", "/api/v1/evaluation/certifications/positions/"+positionID+"/points/"+abilityPointID+"/levels", map[string]interface{}{
		"levelMapping": valid[:4],
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("非法分档: expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 合法配置 → 200 并落库
	w = env.Do("PUT", "/api/v1/evaluation/certifications/positions/"+positionID+"/points/"+abilityPointID+"/levels", map[string]interface{}{
		"levelMapping": valid,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("保存分档: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	var stored int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM certification_point_levels WHERE career_position_id=$1 AND ability_point_id=$2`, positionID, abilityPointID).Scan(&stored)
	if stored != 1 {
		t.Fatalf("分档未落库: count=%d", stored)
	}

	// 模型回显包含 levelMapping
	w = env.Do("GET", "/api/v1/evaluation/certifications/positions/"+positionID+"/model", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get model: expected 200, got %d", w.Code)
	}
	var model struct {
		Domains []struct {
			Points []struct {
				AbilityPointID string             `json:"abilityPointId"`
				LevelMapping   []domain.LevelMapping `json:"levelMapping"`
			} `json:"points"`
		} `json:"domains"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &model); err != nil {
		t.Fatalf("unmarshal model: %v", err)
	}
	var found bool
	for _, d := range model.Domains {
		for _, p := range d.Points {
			if p.AbilityPointID == abilityPointID {
				found = true
				if len(p.LevelMapping) != 5 || p.LevelMapping[0].Min != 56 {
					t.Errorf("模型回显分档错误: %+v", p.LevelMapping)
				}
			}
		}
	}
	if !found {
		t.Fatal("模型中未找到能力点")
	}
}
