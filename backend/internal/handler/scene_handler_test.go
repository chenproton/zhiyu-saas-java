package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestScenario_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	code := fmt.Sprintf("test-sc-%s", t.Name())

	// Create
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       "Test Scenario",
		"code":       code,
		"difficulty": 3,
		"version":    "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal scenario: %v", err)
	}
	id := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", id)

	if scenario.Name != "Test Scenario" || scenario.Status != domain.ScenarioStatusDraft {
		t.Fatalf("unexpected scenario data: name=%s status=%s", scenario.Name, scenario.Status)
	}

	// List
	w = env.Do("GET", "/api/v1/scene/scenarios?limit=200", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total == 0 {
		t.Fatal("expected at least 1 scenario in list")
	}
	found := false
	for _, it := range items {
		if it.ID == id {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("created scenario not found in list")
	}

	// Get
	w = env.Do("GET", "/api/v1/scene/scenarios/"+id, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if s.ID != id {
		t.Fatalf("get returned wrong id: %s", s.ID)
	}

	// Update
	w = env.Do("PUT", "/api/v1/scene/scenarios/"+id, map[string]interface{}{
		"name":       "Updated Scenario",
		"code":       code,
		"difficulty": 4,
		"version":    "v2.0",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Name != "Updated Scenario" || updated.Difficulty != 4 {
		t.Fatalf("update not applied: name=%s diff=%d", updated.Name, updated.Difficulty)
	}

	// Delete
	w = env.Do("DELETE", "/api/v1/scene/scenarios/"+id, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// Verify deletion
	w = env.Do("GET", "/api/v1/scene/scenarios/"+id, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", w.Code)
	}
}

func TestScenario_StatusTransitions(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	code := fmt.Sprintf("test-st-%s", t.Name())

	// Create
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       "Status Test",
		"code":       code,
		"difficulty": 1,
		"version":    "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	id := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", id)

	if scenario.Status != domain.ScenarioStatusDraft {
		t.Fatalf("initial status should be draft, got %s", scenario.Status)
	}

	// Submit
	w = env.Do("POST", "/api/v1/scene/scenarios/"+id+"/submit", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("submit: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, _ := testhelper.Unmarshal[domain.Scenario](w)
	if s.Status != domain.ScenarioStatusPending {
		t.Fatalf("after submit: expected pending, got %s", s.Status)
	}

	// Review (approved)
	w = env.Do("POST", "/api/v1/scene/scenarios/"+id+"/review", map[string]string{
		"status": "approved",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("review: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, _ = testhelper.Unmarshal[domain.Scenario](w)
	if s.Status != domain.ScenarioStatusApproved {
		t.Fatalf("after approve: expected approved, got %s", s.Status)
	}

	// Publish
	w = env.Do("POST", "/api/v1/scene/scenarios/"+id+"/publish", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("publish: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, _ = testhelper.Unmarshal[domain.Scenario](w)
	if s.Status != domain.ScenarioStatusPublished {
		t.Fatalf("after publish: expected published, got %s", s.Status)
	}

	// Archive
	w = env.Do("POST", "/api/v1/scene/scenarios/"+id+"/archive", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("archive: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, _ = testhelper.Unmarshal[domain.Scenario](w)
	if s.Status != domain.ScenarioStatusArchived {
		t.Fatalf("after archive: expected archived, got %s", s.Status)
	}
}

func TestScenario_ValidationErrors(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// Missing name
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"code":    "bad-sc-001",
		"version": "v1",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing name: expected 400, got %d", w.Code)
	}

	// Get non-existent
	w = env.Do("GET", "/api/v1/scene/scenarios/00000000-0000-0000-0000-000000000000", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get non-existent: expected 404, got %d", w.Code)
	}

	// Review with invalid status
	code := fmt.Sprintf("test-ve-%s", t.Name())
	w = env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       "VE Test",
		"code":       code,
		"difficulty": 1,
		"version":    "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create for review test: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	s, _ := testhelper.Unmarshal[domain.Scenario](w)
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", s.ID)

	w = env.Do("POST", "/api/v1/scene/scenarios/"+s.ID+"/review", map[string]string{
		"status": "invalid_status",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("review invalid status: expected 400, got %d", w.Code)
	}
}

func TestScenarioTask_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-stcrud-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       "Task CRUD Scenario",
		"code":       scCode,
		"difficulty": 1,
		"version":    "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Create task
	taskCode := fmt.Sprintf("tsk-crud-%s", suffix)
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID,
		"name":       "Task 1",
		"code":       taskCode,
		"taskType":   "assessment",
		"difficulty": 2,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, err := testhelper.Unmarshal[domain.ScenarioTask](w)
	if err != nil {
		t.Fatalf("unmarshal task: %v", err)
	}
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	if task.ScenarioID != scID || task.TaskType != "assessment" {
		t.Fatalf("unexpected task data: scId=%s type=%s", task.ScenarioID, task.TaskType)
	}

	// List tasks by scenarioId
	w = env.Do("GET", "/api/v1/scene/tasks?scenarioId="+scID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list tasks: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	tasks, taskTotal, err := testhelper.UnmarshalList[domain.ScenarioTask](w)
	if err != nil {
		t.Fatalf("unmarshal task list: %v", err)
	}
	if taskTotal == 0 {
		t.Fatal("expected at least 1 task in list")
	}
	found := false
	for _, tk := range tasks {
		if tk.ID == taskID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("created task not found in list")
	}

	// Get task
	w = env.Do("GET", "/api/v1/scene/tasks/"+taskID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get task: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	tk, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	if tk.ID != taskID {
		t.Fatalf("get task returned wrong id: %s", tk.ID)
	}

	// Update task
	w = env.Do("PUT", "/api/v1/scene/tasks/"+taskID, map[string]interface{}{
		"scenarioId": scID,
		"name":       "Task 1 Updated",
		"code":       taskCode,
		"taskType":   "assessment",
		"difficulty": 3,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update task: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	if updated.Name != "Task 1 Updated" || updated.Difficulty != 3 {
		t.Fatalf("task update not applied: name=%s diff=%d", updated.Name, updated.Difficulty)
	}

	// Delete task
	w = env.Do("DELETE", "/api/v1/scene/tasks/"+taskID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete task: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.Do("GET", "/api/v1/scene/tasks/"+taskID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete task: expected 404, got %d", w.Code)
	}

	// Reorder: create 2 new tasks then reorder
	taskCode1 := fmt.Sprintf("tsk-reo1-%s", suffix)
	taskCode2 := fmt.Sprintf("tsk-reo2-%s", suffix)
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Reorder A", "code": taskCode1, "taskType": "practice", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create reorder task A: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	t1, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", t1.ID)

	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Reorder B", "code": taskCode2, "taskType": "practice", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create reorder task B: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	t2, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", t2.ID)

	// Reorder: swap order
	w = env.Do("POST", "/api/v1/scene/tasks/reorder", map[string]interface{}{
		"scenarioId": scID,
		"taskIds":    []string{t2.ID, t1.ID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("reorder: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

func TestScenarioTask_Reorder(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-reo-sc-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Reorder Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Create 3 tasks
	var taskIDs []string
	for i := 1; i <= 3; i++ {
		code := fmt.Sprintf("tsk-reo-%d-%s", i, suffix)
		w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
			"scenarioId": scID,
			"name":       fmt.Sprintf("Reorder Task %d", i),
			"code":       code,
			"taskType":   "practice",
			"difficulty": i,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create task %d: expected 201, got %d: %s", i, w.Code, testhelper.ErrMsg(w))
		}
		task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
		taskIDs = append(taskIDs, task.ID)
		defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", task.ID)
	}

	// Reorder: reverse
	reversed := []string{taskIDs[2], taskIDs[1], taskIDs[0]}
	w = env.Do("POST", "/api/v1/scene/tasks/reorder", map[string]interface{}{
		"scenarioId": scID,
		"taskIds":    reversed,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("reorder: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// Verify order updated
	w = env.Do("GET", "/api/v1/scene/tasks?scenarioId="+scID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list after reorder: expected 200, got %d", w.Code)
	}
	tasks, _, _ := testhelper.UnmarshalList[domain.ScenarioTask](w)
	if len(tasks) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(tasks))
	}
	for i, tk := range tasks {
		if tk.ID != reversed[i] {
			t.Fatalf("reorder mismatch at position %d: expected %s, got %s", i, reversed[i], tk.ID)
		}
	}
}

func TestTaskEvaluationConfig(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-evc-sc-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Eval Config Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Create task
	taskCode := fmt.Sprintf("tsk-evc-%s", suffix)
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Eval Task", "code": taskCode, "taskType": "assessment", "difficulty": 2,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	// Upsert evaluation config
	w = env.Do("POST", "/api/v1/scene/evaluation", map[string]interface{}{
		"taskId":    taskID,
		"methodKey": "random_draw",
		"weight":    50,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("upsert config: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	config, err := testhelper.Unmarshal[domain.TaskEvaluationConfig](w)
	if err != nil {
		t.Fatalf("unmarshal config: %v", err)
	}
	configID := config.ID
	defer env.DB.Exec(ctx, "DELETE FROM task_evaluation_configs WHERE id = $1", configID)

	if config.TaskID != taskID || config.MethodKey != "random_draw" {
		t.Fatalf("config mismatch: taskId=%s, methodKey=%s", config.TaskID, config.MethodKey)
	}

	// List configs
	w = env.Do("GET", "/api/v1/scene/evaluation?taskId="+taskID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list configs: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	configs, configTotal, _ := testhelper.UnmarshalList[domain.TaskEvaluationConfig](w)
	if configTotal == 0 {
		t.Fatal("expected at least 1 config in list")
	}
	foundCfg := false
	for _, c := range configs {
		if c.ID == configID {
			foundCfg = true
			break
		}
	}
	if !foundCfg {
		t.Fatal("config not found in list")
	}

	// Create eval point
	w = env.Do("POST", "/api/v1/scene/evaluation/"+configID+"/points", map[string]interface{}{
		"configId": configID,
		"name":     "Point 1",
		"weight":   100,
		"maxScore": 100,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create eval point: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	point, err := testhelper.Unmarshal[domain.TaskEvalPoint](w)
	if err != nil {
		t.Fatalf("unmarshal point: %v", err)
	}
	pointID := point.ID
	defer env.DB.Exec(ctx, "DELETE FROM task_eval_points WHERE id = $1", pointID)

	// List eval points
	w = env.Do("GET", "/api/v1/scene/evaluation/"+configID+"/points?configId="+configID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list eval points: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	points, pointTotal, _ := testhelper.UnmarshalList[domain.TaskEvalPoint](w)
	if pointTotal == 0 {
		t.Fatal("expected at least 1 eval point")
	}
	foundPt := false
	for _, p := range points {
		if p.ID == pointID {
			foundPt = true
			break
		}
	}
	if !foundPt {
		t.Fatal("eval point not found in list")
	}

	// Create review step
	w = env.Do("POST", "/api/v1/scene/evaluation/"+configID+"/steps", map[string]interface{}{
		"configId": configID,
		"label":    "Step 1",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("create review step: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	step, err := testhelper.Unmarshal[domain.TaskReviewStep](w)
	if err != nil {
		t.Fatalf("unmarshal step: %v", err)
	}
	stepID := step.ID
	defer env.DB.Exec(ctx, "DELETE FROM task_review_steps WHERE id = $1", stepID)

	// List review steps
	w = env.Do("GET", "/api/v1/scene/evaluation/"+configID+"/steps?configId="+configID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list review steps: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	steps, stepTotal, _ := testhelper.UnmarshalList[domain.TaskReviewStep](w)
	if stepTotal == 0 {
		t.Fatal("expected at least 1 review step")
	}
	foundSt := false
	for _, s := range steps {
		if s.ID == stepID {
			foundSt = true
			break
		}
	}
	if !foundSt {
		t.Fatal("review step not found in list")
	}

	// Delete config
	w = env.Do("DELETE", "/api/v1/scene/evaluation/"+configID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete config: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

func TestTaskResourceBinding(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-trb-sc-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Resource Binding Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Create task
	taskCode := fmt.Sprintf("tsk-trb-%s", suffix)
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Resource Task", "code": taskCode, "taskType": "assessment", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	// Bind resource with invalid refs — verify API doesn't crash
	w = env.Do("POST", "/api/v1/scene/task-resources", map[string]string{
		"taskId":     taskID,
		"resourceId": "00000000-0000-0000-0000-000000000099",
	})
	if w.Code < 400 {
		t.Errorf("binding invalid resource should return error, got %d", w.Code)
	}

	// List resources for the task
	w = env.Do("GET", "/api/v1/scene/task-resources?taskId="+taskID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list resources: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

func TestScenarioWeight(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-sw-sc-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Weight Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Create task
	taskCode := fmt.Sprintf("tsk-sw-%s", suffix)
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "Weight Task", "code": taskCode, "taskType": "assessment", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	// Upsert weight
	w = env.Do("POST", "/api/v1/scene/weights", map[string]interface{}{
		"scenarioId": scID,
		"taskId":     taskID,
		"weight":     50,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("upsert weight: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	weight, err := testhelper.Unmarshal[domain.ScenarioWeightConfig](w)
	if err != nil {
		t.Fatalf("unmarshal weight: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM scenario_weight_configs WHERE id = $1", weight.ID)

	if weight.ScenarioID != scID || weight.TaskID != taskID || weight.Weight != 50 {
		t.Fatalf("weight mismatch: scId=%s tId=%s w=%.0f", weight.ScenarioID, weight.TaskID, weight.Weight)
	}
}

func TestScenarioGradeMapping(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := t.Name()
	scCode := fmt.Sprintf("test-sgm-sc-%s", suffix)

	// Create parent scenario
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "Grade Mapping Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	// Upsert grade mapping
	w = env.Do("POST", "/api/v1/scene/grade-mappings", map[string]interface{}{
		"scenarioId": scID,
		"level":      "A",
		"minScore":   90,
		"maxScore":   100,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("upsert grade mapping: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	mapping, err := testhelper.Unmarshal[domain.ScenarioGradeMapping](w)
	if err != nil {
		t.Fatalf("unmarshal grade mapping: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM scenario_grade_mappings WHERE id = $1", mapping.ID)

	if mapping.ScenarioID != scID || mapping.Level != "A" || mapping.MinScore != 90 || mapping.MaxScore != 100 {
		t.Fatalf("grade mapping mismatch: scId=%s level=%s min=%.0f max=%.0f",
			mapping.ScenarioID, mapping.Level, mapping.MinScore, mapping.MaxScore)
	}
}

func TestScenarioCreateWithInvalidPositionId(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	code := fmt.Sprintf("test-fk-sc-%s", t.Name())
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":             "FK Test Scenario",
		"code":             code,
		"difficulty":       1,
		"version":          "v1.0",
		"careerPositionId": "00000000-0000-0000-0000-00000000dead",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create with arbitrary careerPositionId, got %d", w.Code)
	}
}

func TestScenario_ClearNullableFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	code := fmt.Sprintf("test-clear-%s", t.Name())

	// Create scenario with a careerPositionId
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":             "Clearable Scenario",
		"code":             code,
		"difficulty":       3,
		"version":          "v1.0",
		"careerPositionId": "00000000-0000-0000-0000-00000000dead",
		"background":       "original background",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, _ := testhelper.Unmarshal[domain.Scenario](w)
	id := scenario.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", id)
	if scenario.CareerPositionID == nil {
		t.Fatal("expected careerPositionId to be set after create")
	}

	// Update with explicit nulls to clear fields
	w = env.Do("PUT", "/api/v1/scene/scenarios/"+id, map[string]interface{}{
		"name":             "Clearable Scenario",
		"code":             code,
		"difficulty":       3,
		"version":          "v1.0",
		"careerPositionId": nil,
		"background":       nil,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.CareerPositionID != nil {
		t.Fatalf("careerPositionId should be nil, got %v", *updated.CareerPositionID)
	}
	if updated.Background != nil {
		t.Fatalf("background should be nil, got %v", *updated.Background)
	}

	// Verify partial update keeps cleared values when fields are omitted
	w = env.Do("PUT", "/api/v1/scene/scenarios/"+id, map[string]interface{}{
		"name": "Clearable Scenario Renamed",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("partial update: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	partial, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal partial update: %v", err)
	}
	if partial.Name != "Clearable Scenario Renamed" {
		t.Fatalf("name not updated: %s", partial.Name)
	}
	if partial.CareerPositionID != nil {
		t.Fatalf("careerPositionId should remain nil after partial update, got %v", *partial.CareerPositionID)
	}
}

func TestTaskBindKnowledgeWithInvalidId(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	scCode := fmt.Sprintf("test-tkbind-fk-%s", t.Name())
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name": "TK Bind FK Scenario", "code": scCode, "difficulty": 1, "version": "v1.0",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d", w.Code)
	}
	sc, _ := testhelper.Unmarshal[domain.Scenario](w)
	scID := sc.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scID)

	taskCode := fmt.Sprintf("tsk-tkbind-fk-%s", t.Name())
	w = env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
		"scenarioId": scID, "name": "TK Bind FK Task", "code": taskCode, "taskType": "assessment", "difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	task, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
	taskID := task.ID
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)

	w = env.Do("POST", "/api/v1/scene/task-bindings/knowledge", map[string]interface{}{
		"taskId":           taskID,
		"knowledgePointId": "00000000-0000-0000-0000-0000000000ff",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for bind with arbitrary knowledgePointId, got %d", w.Code)
	}
}
