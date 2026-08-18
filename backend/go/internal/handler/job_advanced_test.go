package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestPositionAbility_CreateBindingAndList(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	posBody := map[string]interface{}{
		"name":         "Binding Test Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w := env.Do("POST", "/api/v1/job/positions", posBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, _ := testhelper.Unmarshal[domain.CareerPosition](w)
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", pos.ID)

	abilityBody := map[string]interface{}{
		"name":     "Binding Ability Point",
		"category": "skill",
		"isPublic": true,
	}
	w = env.Do("POST", "/api/v1/job/abilities", abilityBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ability: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	ability, _ := testhelper.Unmarshal[domain.AbilityPoint](w)
	defer env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", ability.ID)

	respID := uuid.NewString()
	_, errr := env.DB.Exec(ctx,
		`INSERT INTO position_responsibilities (id, career_position_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
		respID, pos.ID, "Binding Test Responsibility", 1)
	if errr != nil {
		t.Fatalf("create responsibility: %v", errr)
	}
	defer env.DB.Exec(ctx, "DELETE FROM position_responsibilities WHERE id = $1", respID)

	var bindingID string

	t.Run("CreateBinding", func(t *testing.T) {
		body := map[string]interface{}{
			"careerPositionId": pos.ID,
			"responsibilityId": respID,
			"abilityPointId":   ability.ID,
			"source":           "custom",
			"requiredLevel":    "A",
			"weight":           1.0,
		}
		w := env.Do("POST", "/api/v1/job/position-abilities", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.PositionAbilityBinding](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.CareerPositionID != pos.ID {
			t.Errorf("careerPositionId = %q, want %q", b.CareerPositionID, pos.ID)
		}
		if b.AbilityPointID != ability.ID {
			t.Errorf("abilityPointId = %q, want %q", b.AbilityPointID, ability.ID)
		}
		bindingID = b.ID
	})
	defer func() {
		if bindingID != "" {
			env.DB.Exec(ctx, "DELETE FROM position_ability_bindings WHERE id = $1", bindingID)
		}
	}()

	if bindingID == "" {
		t.Fatal("no created binding ID")
	}

	t.Run("ListBindings", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/position-abilities?careerPositionId=%s", pos.ID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionAbilityBinding](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want >= 1", total)
		}
		var found bool
		for _, it := range items {
			if it.ID == bindingID {
				found = true
				if it.AbilityName == nil || *it.AbilityName != "Binding Ability Point" {
					t.Errorf("abilityName = %v, want %q", it.AbilityName, "Binding Ability Point")
				}
			}
		}
		if !found {
			t.Errorf("binding %s not found in list", bindingID)
		}
	})
}

func TestTaskKnowledgeAbility_BindKnowledgeAndAbility(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	scCode := fmt.Sprintf("test-tka-sc-%s", uuid.NewString()[:8])
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "TKA Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	sc, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := sc.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	taskCode := fmt.Sprintf("tka-task-%s", uuid.NewString()[:8])
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "TKA Task", "code": taskCode, "taskType": "assessment", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	kpCode := fmt.Sprintf("TKA-KP-%s", uuid.NewString()[:8])
	w = env.Do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{
		"name": "TKA Knowledge Point",
		"code": kpCode,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create knowledge point: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	kp, _ := testhelper.Unmarshal[domain.KnowledgePoint](w)
	kpID := kp.ID
	defer env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE id = $1", kpID)

	abBody := map[string]interface{}{
		"name": "TKA Ability Point", "category": "skill", "isPublic": true,
	}
	w = env.Do("POST", "/api/v1/job/abilities", abBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ability: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	ap, _ := testhelper.Unmarshal[domain.AbilityPoint](w)
	apID := ap.ID
	defer env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", apID)

	var kbID, abID string

	t.Run("BindKnowledge", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/scene/task-bindings/knowledge", map[string]interface{}{
			"taskId":           taskID,
			"knowledgePointId": kpID,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.TaskKnowledgeBinding](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.TaskID != taskID {
			t.Errorf("taskId = %q, want %q", b.TaskID, taskID)
		}
		if b.KnowledgePointID != kpID {
			t.Errorf("knowledgePointId = %q, want %q", b.KnowledgePointID, kpID)
		}
		kbID = b.ID
	})
	defer func() {
		if kbID != "" {
			env.DB.Exec(ctx, "DELETE FROM task_knowledge_bindings WHERE id = $1", kbID)
		}
	}()

	t.Run("BindAbility", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/scene/task-bindings/ability", map[string]interface{}{
			"taskId":         taskID,
			"abilityPointId": apID,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.TaskAbilityBinding](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.TaskID != taskID {
			t.Errorf("taskId = %q, want %q", b.TaskID, taskID)
		}
		if b.AbilityPointID != apID {
			t.Errorf("abilityPointId = %q, want %q", b.AbilityPointID, apID)
		}
		abID = b.ID
	})
	defer func() {
		if abID != "" {
			env.DB.Exec(ctx, "DELETE FROM task_ability_bindings WHERE id = $1", abID)
		}
	}()
}

func TestScenarioGrade_ListGradeMappings(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	scCode := fmt.Sprintf("test-sgm-list-%s", uuid.NewString()[:8])
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Grade List Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	sc, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := sc.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	var mappingID string

	w = env.Do("POST", "/api/v1/scene/grade-mappings", map[string]interface{}{
		"scenarioId": scID,
		"level":      "A",
		"minScore":   90,
		"maxScore":   100,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create grade mapping: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	m, _ := testhelper.Unmarshal[domain.ScenarioGradeMapping](w)
	mappingID = m.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_grade_mappings WHERE id = $1", mappingID)

	w = env.Do("GET", fmt.Sprintf("/api/v1/scene/grade-mappings?scenarioId=%s", scID), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list grade mappings: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	listItems, listTotal, listErr := testhelper.UnmarshalList[domain.ScenarioGradeMapping](w)
	if listErr != nil {
		t.Fatalf("unmarshal list: %v", listErr)
	}
	if listTotal < 1 {
		t.Errorf("grade mapping total = %d, want >= 1", listTotal)
	}
	found := false
	for _, item := range listItems {
		if item.ID == mappingID {
			found = true
			break
		}
	}
	if !found {
		t.Error("created grade mapping not found in list")
	}
}

func TestScenarioWeight_ListWeights(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	scCode := fmt.Sprintf("test-sw-list-%s", uuid.NewString()[:8])
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Weight List Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	sc, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := sc.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	taskCode := fmt.Sprintf("tsk-sw-l-%s", uuid.NewString()[:8])
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Weight Task", "code": taskCode, "taskType": "assessment", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	w = env.Do("POST", "/api/v1/scene/weights", map[string]interface{}{
		"scenarioId": scID,
		"taskId":     taskID,
		"weight":     50,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create weight: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	weight, _ := testhelper.Unmarshal[domain.ScenarioWeightConfig](w)
	weightID := weight.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_weight_configs WHERE id = $1", weightID)

	w = env.Do("GET", fmt.Sprintf("/api/v1/scene/weights?scenarioId=%s", scID), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list weights: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	listItems, listTotal, err := testhelper.UnmarshalList[domain.ScenarioWeightConfig](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if listTotal < 1 {
		t.Errorf("weight total = %d, want >= 1", listTotal)
	}
	found := false
	for _, item := range listItems {
		if item.ID == weightID {
			found = true
			break
		}
	}
	if !found {
		t.Error("created weight not found in list")
	}
}

func TestSubscription_GetAndUpdate(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	subID := uuid.NewString()
	_, err := env.DB.Exec(ctx, `INSERT INTO subscription_packages (id, tenant_id, name, modules, status) VALUES ($1, $2, 'Test Plan', '{}', 'active')`,
		subID, testhelper.TestTenantID)
	if err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM subscription_packages WHERE id = $1", subID)

	t.Run("Get", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/subscriptions?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		sub, err := testhelper.Unmarshal[domain.SubscriptionPackage](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if sub.Name != "Test Plan" {
			t.Errorf("name = %q, want %q", sub.Name, "Test Plan")
		}
	})

	t.Run("Update", func(t *testing.T) {
		// 生产路由中订阅变更走 saas 平台管理端 /admin/tenants/{tenantId}/subscription
		w := env.DoWithToken("PUT", fmt.Sprintf("/api/v1/admin/tenants/%s/subscription", testhelper.TestTenantID), map[string]interface{}{
			"name":    "Updated Plan",
			"modules": domain.JSONMap{"moduleA": true},
			"status":  "inactive",
		}, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		sub, err := testhelper.Unmarshal[domain.SubscriptionPackage](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if sub.Name != "Updated Plan" {
			t.Errorf("name = %q, want %q", sub.Name, "Updated Plan")
		}
		if sub.Status != "inactive" {
			t.Errorf("status = %q, want inactive", sub.Status)
		}
	})
}
