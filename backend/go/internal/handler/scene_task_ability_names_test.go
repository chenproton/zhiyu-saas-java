package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestScenarioTask_ListReturnsAbilityPointNames 验证任务列表/详情接口返回能力点名称，
// 前端卡片预览不再依赖全量能力点列表接口（该接口 maxPageSize=200 会截断，导致
// 引用旧能力点的任务预览名称缺失）。
func TestScenarioTask_ListReturnsAbilityPointNames(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// 创建场景
	code := fmt.Sprintf("test-sc-ab-%s", t.Name())
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       "能力点名称测试场景",
		"code":       code,
		"difficulty": 3,
		"version":    "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scenario.ID)

	// 创建能力点
	w = env.Do("POST", "/api/v1/job/abilities", map[string]interface{}{
		"name":     "软件项目经理核心技术能力",
		"category": "skill",
		"isPublic": true,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create ability: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	ability, _ := testhelper.Unmarshal[domain.AbilityPoint](w)
	defer env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", ability.ID)

	// 创建任务并关联能力点
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId":      scenario.ID,
		"name":            "任务A",
		"code":            "TASK-AB-001",
		"sortOrder":       0,
		"estimatedHours":  4,
		"taskType":        "training",
		"difficulty":      3,
		"abilityPointIds": []string{ability.ID},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", task.ID)

	t.Run("ListReturnsNames", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/scene/tasks?scenarioId="+scenario.ID+"&limit=200", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("list tasks: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, _, err := testhelper.UnmarshalList[domain.ScenarioTask](w)
		if err != nil {
			t.Fatalf("unmarshal tasks: %v", err)
		}
		found := false
		for _, it := range items {
			if it.ID != task.ID {
				continue
			}
			found = true
			if len(it.AbilityPointNames) != 1 || it.AbilityPointNames[0] != "软件项目经理核心技术能力" {
				t.Fatalf("abilityPointNames = %v, want [软件项目经理核心技术能力]", it.AbilityPointNames)
			}
		}
		if !found {
			t.Fatal("created task not found in list")
		}
	})

	t.Run("GetReturnsNames", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/scene/tasks/"+task.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("get task: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		got, err := testhelper.Unmarshal[domain.ScenarioTask](w)
		if err != nil {
			t.Fatalf("unmarshal task: %v", err)
		}
		if len(got.AbilityPointNames) != 1 || got.AbilityPointNames[0] != "软件项目经理核心技术能力" {
			t.Fatalf("abilityPointNames = %v, want [软件项目经理核心技术能力]", got.AbilityPointNames)
		}
	})
}
