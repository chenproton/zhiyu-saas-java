package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPositionModelSceneTasksOnly 验证岗位能力认定模型只返回场景任务：
// 岗位场景下的场景任务（scenario_tasks 直连能力点）保留；租户课程（courses
// ability_point_ids 匹配，体系课/混合课）被临时过滤（certifications.go 的
// certificationSceneTasksOnly 开关，恢复课程参与时置 false）。
func TestPositionModelSceneTasksOnly(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	positionID := "33333333-2222-4333-8444-cccccccccccc"
	abilityPointID := "33333333-2222-4333-8444-dddddddddddd"
	responsibilityID := "33333333-2222-4333-8444-eeeeeeeeeeee"
	scenarioID := "33333333-2222-4333-8444-ffffffffffff"
	sceneTaskID := "33333333-2222-4333-8444-111111111111"
	courseID := "33333333-2222-4333-8444-222222222222"

	cleanup := func() {
		env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE tenant_id = $1", testhelper.TestTenantID)
		env.DB.Exec(ctx, "DELETE FROM scenarios WHERE creator_id = $1", testhelper.TestOperatorID)
		env.DB.Exec(ctx, "DELETE FROM courses WHERE creator_id = $1", testhelper.TestOperatorID)
		env.DB.Exec(ctx, "DELETE FROM position_ability_bindings WHERE career_position_id = $1", positionID)
		env.DB.Exec(ctx, "DELETE FROM position_responsibilities WHERE id = $1", responsibilityID)
		env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", abilityPointID)
		env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
	}
	defer cleanup()

	mustExec := func(sql string, args ...any) {
		t.Helper()
		if _, err := env.DB.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("测试数据插入失败: %v\nSQL: %s", err, sql)
		}
	}

	mustExec(`
		INSERT INTO career_positions (id, code, name, position_type, requirements, version, status, created_by, tenant_id)
		VALUES ($1, 'SCENE-ONLY', '场景任务过滤测试', 'job', '{}', 'v1', 'published', $2, $3)
	`, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)
	mustExec(`
		INSERT INTO ability_points (id, tenant_id, name, code)
		VALUES ($1, $2, '测试能力点', 'SCENE-AP')
	`, abilityPointID, testhelper.TestTenantID)
	mustExec(`
		INSERT INTO position_responsibilities (id, career_position_id, name, tenant_id)
		VALUES ($1, $2, '测试职责', $3)
	`, responsibilityID, positionID, testhelper.TestTenantID)
	mustExec(`
		INSERT INTO position_ability_bindings (career_position_id, responsibility_id, ability_point_id, required_level, tenant_id)
		VALUES ($1, $2, $3, 'proficient', $4)
	`, positionID, responsibilityID, abilityPointID, testhelper.TestTenantID)

	// 岗位场景 + 场景任务（scenario_tasks.ability_point_ids 直接关联能力点）
	mustExec(`
		INSERT INTO scenarios (id, name, code, career_position_id, version, status, creator_id, tenant_id)
		VALUES ($1, '岗位场景', 'SCN-1', $2, 'v1', 'published', $3, $4)
	`, scenarioID, positionID, testhelper.TestOperatorID, testhelper.TestTenantID)
	mustExec(`
		INSERT INTO scenario_tasks (id, scenario_id, name, code, task_type, tenant_id, ability_point_ids)
		VALUES ($1, $2, '场景任务A', 'T-SCN', 'training', $3, $4::uuid[])
	`, sceneTaskID, scenarioID, testhelper.TestTenantID, []string{abilityPointID})

	// 租户课程（体系课/混合课）能力点匹配：应被临时过滤
	mustExec(`
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id, ability_point_ids)
		VALUES ($1, 'COURSE-1', '体系课A', 'system', 'course', 'published', $2, $3, $4::uuid[])
	`, courseID, testhelper.TestOperatorID, testhelper.TestTenantID, []string{abilityPointID})

	w := env.Do("GET", "/api/v1/evaluation/certifications/positions/"+positionID+"/model", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("模型加载: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	var resp struct {
		Domains []struct {
			Points []struct {
				Tasks []domain.CertificationModelTask `json:"tasks"`
			} `json:"points"`
		} `json:"domains"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("解析模型失败: %v", err)
	}
	if len(resp.Domains) != 1 || len(resp.Domains[0].Points) != 1 {
		t.Fatalf("模型结构异常: domains=%d", len(resp.Domains))
	}
	tasks := resp.Domains[0].Points[0].Tasks
	if len(tasks) != 1 {
		t.Fatalf("任务数: expected 1（仅场景任务，课程被过滤）, got %d: %+v", len(tasks), tasks)
	}
	if tasks[0].TaskID != sceneTaskID || tasks[0].TaskType != "scene" {
		t.Fatalf("期望场景任务 %s(scene), got %s(%s)", sceneTaskID, tasks[0].TaskID, tasks[0].TaskType)
	}
}
