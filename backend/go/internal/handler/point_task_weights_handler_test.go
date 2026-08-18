package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPutPointTaskWeights 验证胜任配置单点任务权重保存：只校验并保存当前能力点，
// 且不覆盖其它能力点的任务权重；合计不为 100 时返回 400。
func TestPutPointTaskWeights(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "11111111-2222-4333-8444-cccccccccccc"
	abilityPointA := "11111111-2222-4333-8444-dddddddddddd"
	abilityPointB := "11111111-2222-4333-8444-ffffffffffff"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM certification_weights WHERE ability_point_id IN ($1, $2)", abilityPointA, abilityPointB)
		env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id IN ($1, $2)", abilityPointA, abilityPointB)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
	}
	defer cleanup()

	env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, 'TWTEST', '任务权重测试岗位', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)
	env.DB.Exec(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, code)
		VALUES ($1, $2, '能力点A', 'TWT-A'), ($3, $2, '能力点B', 'TWT-B')
	`, abilityPointA, testhelper.TestTenantID, abilityPointB)

	// 先给 A、B 各存一组权重（直接插库，模拟历史数据）
	env.DB.Exec(ctx, `INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)
		VALUES ('11111111-2222-4333-8444-aaaaaaaaaaaa', $1, $2, 'draft', 'custom')`, testhelper.TestTenantID, positionID)
	ruleID := "11111111-2222-4333-8444-aaaaaaaaaaaa"
	env.DB.Exec(ctx, `INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
		VALUES (gen_random_uuid(), $1, $2, '11111111-2222-4333-8444-000000000001', 100, $3)`, ruleID, abilityPointA, testhelper.TestTenantID)
	env.DB.Exec(ctx, `INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
		VALUES (gen_random_uuid(), $1, $2, '11111111-2222-4333-8444-000000000002', 100, $3)`, ruleID, abilityPointB, testhelper.TestTenantID)

	// 合计不为 100 → 400
	w := env.Do("PUT", "/api/v1/evaluation/certifications/positions/"+positionID+"/points/"+abilityPointA+"/task-weights", map[string]interface{}{
		"taskWeights": []map[string]interface{}{
			{"taskId": "11111111-2222-4333-8444-000000000003", "weight": 30},
			{"taskId": "11111111-2222-4333-8444-000000000004", "weight": 40},
		},
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("合计不为100: expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 合法（合计 100）→ 200，只更新 A，保留 B
	w = env.Do("PUT", "/api/v1/evaluation/certifications/positions/"+positionID+"/points/"+abilityPointA+"/task-weights", map[string]interface{}{
		"taskWeights": []map[string]interface{}{
			{"taskId": "11111111-2222-4333-8444-000000000003", "weight": 40},
			{"taskId": "11111111-2222-4333-8444-000000000004", "weight": 60},
		},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("保存单点任务权重: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	var aCount, bCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM certification_weights WHERE rule_id=$1 AND ability_point_id=$2 AND task_id IS NOT NULL`, ruleID, abilityPointA).Scan(&aCount)
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM certification_weights WHERE rule_id=$1 AND ability_point_id=$2 AND task_id IS NOT NULL`, ruleID, abilityPointB).Scan(&bCount)
	if aCount != 2 {
		t.Fatalf("能力点A任务权重应为2条，got %d", aCount)
	}
	if bCount != 1 {
		t.Fatalf("能力点B任务权重应保留1条（不被覆盖），got %d", bCount)
	}
}
