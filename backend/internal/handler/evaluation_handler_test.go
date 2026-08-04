package handler_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestQuestionBank_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Test Bank",
		"description": "desc",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, err := testhelper.Unmarshal[domain.QuestionBank](w)
	if err != nil {
		t.Fatalf("unmarshal bank: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	if bank.Name != "Test Bank" {
		t.Fatalf("expected name 'Test Bank', got %q", bank.Name)
	}

	w = env.Do("GET", "/api/v1/evaluation/question-banks", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	_, total, err := testhelper.UnmarshalList[domain.QuestionBank](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 1 {
		t.Fatal("expected at least 1 bank in list")
	}

	w = env.Do("GET", "/api/v1/evaluation/question-banks/"+bank.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.QuestionBank](w)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if got.ID != bank.ID {
		t.Fatalf("expected id %s, got %s", bank.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/evaluation/question-banks/"+bank.ID, map[string]interface{}{
		"name":        "Updated Bank",
		"description": "updated desc",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d", w.Code)
	}
	updated, err := testhelper.Unmarshal[domain.QuestionBank](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Name != "Updated Bank" {
		t.Fatalf("expected name 'Updated Bank', got %q", updated.Name)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/question-banks/"+bank.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/question-banks/"+bank.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", w.Code)
	}
}

func TestQuestion_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Question Test Bank",
		"description": "for question tests",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, _ := testhelper.Unmarshal[domain.QuestionBank](w)
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	w = env.Do("POST", "/api/v1/evaluation/questions", map[string]interface{}{
		"bankId":     bank.ID,
		"type":       "single",
		"content":    "What?",
		"options":    []string{"A", "B", "C", "D"},
		"answer":     []string{"A"},
		"score":      10,
		"difficulty": "easy",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create question: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	q, err := testhelper.Unmarshal[domain.Question](w)
	if err != nil {
		t.Fatalf("unmarshal question: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", q.ID)

	if q.Content != "What?" {
		t.Fatalf("expected content 'What?', got %q", q.Content)
	}

	w = env.Do("GET", "/api/v1/evaluation/questions", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	_, total, err := testhelper.UnmarshalList[domain.Question](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 1 {
		t.Fatal("expected at least 1 question in list")
	}

	w = env.Do("GET", "/api/v1/evaluation/questions/"+q.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.Question](w)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if got.ID != q.ID {
		t.Fatalf("expected id %s, got %s", q.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/evaluation/questions/"+q.ID, map[string]interface{}{
		"type":    "single",
		"content": "Updated?",
		"options": []string{"A", "B", "C", "D"},
		"answer":  []string{"B"},
		"score":   20,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d", w.Code)
	}
	updated, err := testhelper.Unmarshal[domain.Question](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Content != "Updated?" {
		t.Fatalf("expected content 'Updated?', got %q", updated.Content)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/questions/"+q.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/questions/"+q.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", w.Code)
	}
}

func TestQuestion_BatchCreate(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Batch Test Bank",
		"description": "for batch tests",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, _ := testhelper.Unmarshal[domain.QuestionBank](w)
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	w = env.Do("POST", "/api/v1/evaluation/questions/batch", map[string]interface{}{
		"bankId": bank.ID,
		"items": []map[string]interface{}{
			{
				"type":    "single",
				"content": "Batch Q1?",
				"options": []string{"A", "B"},
				"answer":  []string{"A"},
				"score":   5,
			},
			{
				"type":    "single",
				"content": "Batch Q2?",
				"options": []string{"C", "D"},
				"answer":  []string{"D"},
				"score":   5,
			},
		},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("batch create: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	w = env.Do("GET", "/api/v1/evaluation/questions?bankId="+bank.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list by bankId: expected 200, got %d", w.Code)
	}
	items, total, err := testhelper.UnmarshalList[domain.Question](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 2 {
		t.Fatalf("expected at least 2 questions, got %d", total)
	}
	for _, q := range items {
		env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", q.ID)
	}
}

func TestExam_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Exam Test Bank",
		"description": "for exam tests",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, _ := testhelper.Unmarshal[domain.QuestionBank](w)
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	w = env.Do("POST", "/api/v1/evaluation/questions", map[string]interface{}{
		"bankId":  bank.ID,
		"type":    "single",
		"content": "Exam Q?",
		"options": []string{"A", "B", "C", "D"},
		"answer":  []string{"A"},
		"score":   10,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create question: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	q, _ := testhelper.Unmarshal[domain.Question](w)
	defer env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", q.ID)

	w = env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"name":        "Test Exam",
		"description": "desc",
		"duration":    60,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	exam, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal exam: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam.ID)

	w = env.Do("POST", "/api/v1/evaluation/exams/"+exam.ID+"/questions", map[string]interface{}{
		"questionId": q.ID,
		"score":      10,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("add question: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	examWithQ, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal exam with q: %v", err)
	}
	if len(examWithQ.Questions) < 1 {
		t.Fatal("expected at least 1 question in exam")
	}

	w = env.Do("GET", "/api/v1/evaluation/exams", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	_, total, err := testhelper.UnmarshalList[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 1 {
		t.Fatal("expected at least 1 exam in list")
	}

	w = env.Do("GET", "/api/v1/evaluation/exams/"+exam.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}
	gotExam, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if len(gotExam.Questions) < 1 {
		t.Fatal("get should include questions")
	}

	w = env.Do("PUT", "/api/v1/evaluation/exams/"+exam.ID, map[string]interface{}{
		"name":        "Updated Exam",
		"description": "updated desc",
		"duration":    90,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d", w.Code)
	}
	updated, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Name != "Updated Exam" {
		t.Fatalf("expected name 'Updated Exam', got %q", updated.Name)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/exams/"+exam.ID+"/questions/"+q.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("remove question: expected 200, got %d", w.Code)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/exams/"+exam.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/exams/"+exam.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", w.Code)
	}
}

func TestExam_ValidationErrors(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"description": "missing name",
		"duration":    60,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing name, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/exams/non-existent-id", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-existent exam, got %d", w.Code)
	}
}

func TestExam_CreateWithoutDescription(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"name":     "No Desc Exam",
		"duration": 60,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create exam without description: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	exam, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal exam: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam.ID)
	if exam.Description != "" {
		t.Fatalf("expected empty description, got %q", exam.Description)
	}

	w = env.Do("GET", "/api/v1/evaluation/exams/"+exam.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get exam without description: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

func TestExamUsage_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Usage Test Bank",
		"description": "for usage tests",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, _ := testhelper.Unmarshal[domain.QuestionBank](w)
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	w = env.Do("POST", "/api/v1/evaluation/questions", map[string]interface{}{
		"bankId":  bank.ID,
		"type":    "single",
		"content": "Usage Q?",
		"options": []string{"A", "B"},
		"answer":  []string{"A"},
		"score":   10,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create question: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	q, _ := testhelper.Unmarshal[domain.Question](w)
	defer env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", q.ID)

	w = env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"name":        "Usage Exam",
		"description": "desc",
		"duration":    60,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	exam, _ := testhelper.Unmarshal[domain.Exam](w)
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam.ID)

	now := time.Now().Format(time.RFC3339)
	later := time.Now().Add(time.Hour).Format(time.RFC3339)
	w = env.Do("POST", "/api/v1/evaluation/exam-usages", map[string]interface{}{
		"examId":     exam.ID,
		"name":       "Test Usage",
		"startTime":  now,
		"endTime":    later,
		"duration":   60,
		"targetType": "class",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create usage: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	usage, err := testhelper.Unmarshal[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal usage: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usage.ID)

	w = env.Do("GET", "/api/v1/evaluation/exam-usages", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	_, total, err := testhelper.UnmarshalList[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 1 {
		t.Fatal("expected at least 1 usage in list")
	}

	w = env.Do("GET", "/api/v1/evaluation/exam-usages/"+usage.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}

	w = env.Do("PUT", "/api/v1/evaluation/exam-usages/"+usage.ID, map[string]interface{}{
		"examId":     exam.ID,
		"name":       "Updated Usage",
		"startTime":  now,
		"endTime":    later,
		"duration":   120,
		"targetType": "class",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d", w.Code)
	}
	updated, err := testhelper.Unmarshal[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Name != "Updated Usage" {
		t.Fatalf("expected name 'Updated Usage', got %q", updated.Name)
	}

	w = env.Do("POST", "/api/v1/evaluation/exam-usages/"+usage.ID+"/start", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("start: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	started, err := testhelper.Unmarshal[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal start: %v", err)
	}
	if started.Status != "in_progress" {
		t.Fatalf("expected status 'in_progress', got %q", started.Status)
	}

	w = env.Do("POST", "/api/v1/evaluation/exam-usages/"+usage.ID+"/finish", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("finish: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	finished, err := testhelper.Unmarshal[domain.ExamUsage](w)
	if err != nil {
		t.Fatalf("unmarshal finish: %v", err)
	}
	if finished.Status != "finished" {
		t.Fatalf("expected status 'finished', got %q", finished.Status)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/exam-usages/"+usage.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/exam-usages/"+usage.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", w.Code)
	}
}

func TestExamUsage_StartWindow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{
		"name":        "Window Test Bank",
		"description": "for window tests",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, _ := testhelper.Unmarshal[domain.QuestionBank](w)
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)

	w = env.Do("POST", "/api/v1/evaluation/questions", map[string]interface{}{
		"bankId":  bank.ID,
		"type":    "single",
		"content": "Window Q?",
		"options": []string{"A", "B"},
		"answer":  []string{"A"},
		"score":   10,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create question: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	q, _ := testhelper.Unmarshal[domain.Question](w)
	defer env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", q.ID)

	w = env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"name":        "Window Exam",
		"description": "desc",
		"duration":    60,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	exam, _ := testhelper.Unmarshal[domain.Exam](w)
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam.ID)

	// 未到开始时间 → 400 考试尚未开始
	future := time.Now().Add(time.Hour).Format(time.RFC3339)
	later := time.Now().Add(2 * time.Hour).Format(time.RFC3339)
	w = env.Do("POST", "/api/v1/evaluation/exam-usages", map[string]interface{}{
		"examId":     exam.ID,
		"name":       "Future Usage",
		"startTime":  future,
		"endTime":    later,
		"duration":   60,
		"targetType": "class",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create usage: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	futureUsage, _ := testhelper.Unmarshal[domain.ExamUsage](w)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", futureUsage.ID)

	w = env.Do("POST", "/api/v1/evaluation/exam-usages/"+futureUsage.ID+"/start", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("start before window: expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 已过结束时间 → 400 考试已结束
	past := time.Now().Add(-2 * time.Hour).Format(time.RFC3339)
	earlier := time.Now().Add(-time.Hour).Format(time.RFC3339)
	w = env.Do("POST", "/api/v1/evaluation/exam-usages", map[string]interface{}{
		"examId":     exam.ID,
		"name":       "Past Usage",
		"startTime":  past,
		"endTime":    earlier,
		"duration":   60,
		"targetType": "class",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create usage: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pastUsage, _ := testhelper.Unmarshal[domain.ExamUsage](w)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", pastUsage.ID)

	w = env.Do("POST", "/api/v1/evaluation/exam-usages/"+pastUsage.ID+"/start", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("start after window: expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 窗口内（开始已过、结束未到）→ 200 in_progress
	now := time.Now().Format(time.RFC3339)
	w = env.Do("POST", "/api/v1/evaluation/exam-usages", map[string]interface{}{
		"examId":     exam.ID,
		"name":       "Open Usage",
		"startTime":  now,
		"endTime":    later,
		"duration":   60,
		"targetType": "class",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create usage: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	openUsage, _ := testhelper.Unmarshal[domain.ExamUsage](w)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", openUsage.ID)

	w = env.Do("POST", "/api/v1/evaluation/exam-usages/"+openUsage.ID+"/start", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("start in window: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	started, _ := testhelper.Unmarshal[domain.ExamUsage](w)
	if started.Status != "in_progress" {
		t.Fatalf("expected status 'in_progress', got %q", started.Status)
	}
}

func TestTaskDelete_CleansExamUsage(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	createScenario := func(name string) domain.Scenario {
		w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
			"name":       name,
			"difficulty": 3,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		s, _ := testhelper.Unmarshal[domain.Scenario](w)
		return s
	}
	createTask := func(scenarioID, name string) domain.ScenarioTask {
		w := env.Do("POST", "/api/v1/scene/tasks", map[string]interface{}{
			"scenarioId": scenarioID,
			"name":       name,
			"code":       "T-" + name,
			"taskType":   "training",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create task: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		tt, _ := testhelper.Unmarshal[domain.ScenarioTask](w)
		return tt
	}
	createTempExam := func(name string) domain.Exam {
		w := env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
			"name":     name,
			"duration": 60,
			"isTemp":   true,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create temp exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		e, _ := testhelper.Unmarshal[domain.Exam](w)
		return e
	}
	createUsage := func(examID, targetType string, targetIDs []string) domain.ExamUsage {
		w := env.Do("POST", "/api/v1/evaluation/exam-usages", map[string]interface{}{
			"examId":     examID,
			"name":       "Usage-" + examID,
			"targetType": targetType,
			"targetIds":  targetIDs,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create usage: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		u, _ := testhelper.Unmarshal[domain.ExamUsage](w)
		return u
	}

	// 场景 1：删除任务 → 任务安排与独占临时考试一并清理
	sc1 := createScenario("Cleanup-Scene-1")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", sc1.ID)
	task1 := createTask(sc1.ID, "Task-1")
	exam1 := createTempExam("Temp-Exam-1")
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam1.ID)
	usage1 := createUsage(exam1.ID, "task", []string{task1.ID})
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usage1.ID)

	w := env.Do("DELETE", "/api/v1/scene/tasks/"+task1.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete task: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	w = env.Do("GET", "/api/v1/evaluation/exam-usages?examId="+exam1.ID, nil)
	_, total, _ := testhelper.UnmarshalList[domain.ExamUsage](w)
	if total != 0 {
		t.Fatalf("expected 0 usages after task delete, got %d", total)
	}
	w = env.Do("GET", "/api/v1/evaluation/exams/"+exam1.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected temp exam 404 after task delete, got %d", w.Code)
	}

	// 场景 2：删除场景 → 任务安排清理；仍被其他安排引用的临时考试保留
	sc2 := createScenario("Cleanup-Scene-2")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", sc2.ID)
	task2 := createTask(sc2.ID, "Task-2")
	exam2 := createTempExam("Temp-Exam-2")
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", exam2.ID)
	createUsage(exam2.ID, "task", []string{task2.ID})
	keepUsage := createUsage(exam2.ID, "public", []string{task2.ID})
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", keepUsage.ID)

	w = env.Do("DELETE", "/api/v1/scene/scenarios/"+sc2.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete scenario: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	w = env.Do("GET", "/api/v1/evaluation/exam-usages?examId="+exam2.ID, nil)
	items, total, _ := testhelper.UnmarshalList[domain.ExamUsage](w)
	if total != 1 || items[0].ID != keepUsage.ID {
		t.Fatalf("expected only the public usage to remain, got %d items", total)
	}
	w = env.Do("GET", "/api/v1/evaluation/exams/"+exam2.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected temp exam kept while referenced, got %d", w.Code)
	}

	// 移除剩余引用后，再次删除该场景（场景已删，直接走任务清理路径不可行；
	// 此处验证正式试卷不受任务删除影响）
	sc3 := createScenario("Cleanup-Scene-3")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", sc3.ID)
	task3 := createTask(sc3.ID, "Task-3")
	w = env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{
		"name":     "Real Exam",
		"duration": 60,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create real exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	realExam, _ := testhelper.Unmarshal[domain.Exam](w)
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", realExam.ID)
	createUsage(realExam.ID, "task", []string{task3.ID})

	w = env.Do("DELETE", "/api/v1/scene/tasks/"+task3.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete task 3: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.Do("GET", "/api/v1/evaluation/exams/"+realExam.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("real exam must survive task delete, got %d", w.Code)
	}
}

func TestEvaluationResult(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("GET", "/api/v1/evaluation/results", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list results: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/results/non-existent-id/grade", map[string]interface{}{
		"score":   85,
		"comment": "Good work",
	})
	if w.Code != http.StatusNotFound {
		t.Errorf("grade non-existent: expected 404, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/results/batch-grade", map[string]interface{}{
		"items": []map[string]interface{}{
			{"id": "non-existent-id", "score": 90},
		},
	})
	if w.Code == http.StatusOK {
		t.Errorf("batch grade with non-existent ids should not return 200, got %d", w.Code)
	}
}

func TestEvaluationResult_SubmitWithoutEvaluator(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := "11111111-2222-4333-8444-555555555555"
	_, err := env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'student', 'saas', 'evalres-stu', 'evalres-stu', 'x', 'Eval Stu', 'active', '{}')
	`, userID, testhelper.TestTenantID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM scene_evaluation_results WHERE evaluatee_id = $1", userID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)

	taskID := "d8c7bccb-2509-4281-8c86-46224df98732"
	sceneID := "5e9a300c-48fd-45b6-8d8f-74009957349e"

	// 不传 evaluatorId：uuid 列必须落 NULL，不能因空串报 22P02
	w := env.Do("POST", "/api/v1/evaluation/results", map[string]interface{}{
		"taskId":      taskID,
		"sceneId":     sceneID,
		"methodKey":   "review",
		"evaluateeId": userID,
		"maxScore":    100,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("submit without evaluatorId: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var evaluatorID *string
	var gotSceneID string
	if err := env.DB.QueryRow(ctx, `
		SELECT evaluator_id, scene_id FROM scene_evaluation_results WHERE evaluatee_id = $1
	`, userID).Scan(&evaluatorID, &gotSceneID); err != nil {
		t.Fatalf("query result: %v", err)
	}
	if evaluatorID != nil {
		t.Fatalf("expected evaluator_id NULL, got %v", *evaluatorID)
	}
	if gotSceneID != sceneID {
		t.Fatalf("expected scene_id %s, got %s", sceneID, gotSceneID)
	}

	// 显式传空串 evaluatorId/sceneId 同样应归一化为 NULL，而不是 500
	w = env.Do("POST", "/api/v1/evaluation/results", map[string]interface{}{
		"taskId":      taskID,
		"sceneId":     "",
		"methodKey":   "review",
		"evaluateeId": userID,
		"evaluatorId": "",
		"maxScore":    100,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("submit with empty evaluatorId/sceneId: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	if err := env.DB.QueryRow(ctx, `
		SELECT evaluator_id, scene_id FROM scene_evaluation_results WHERE evaluatee_id = $1
	`, userID).Scan(&evaluatorID, &gotSceneID); err != nil {
		t.Fatalf("query result: %v", err)
	}
	if evaluatorID != nil || gotSceneID != "" {
		t.Fatalf("expected evaluator_id NULL and scene_id NULL, got %v / %q", evaluatorID, gotSceneID)
	}
}

func TestCertification_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
		"name":         "Test Position",
		"positionType": "tech",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal position: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", pos.ID)

	w = env.Do("POST", "/api/v1/evaluation/certifications", map[string]interface{}{
		"careerPositionId": pos.ID,
		"ruleSource":       "manual",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create rule: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	rule, err := testhelper.Unmarshal[domain.CertificationRule](w)
	if err != nil {
		t.Fatalf("unmarshal rule: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE id = $1", rule.ID)

	w = env.Do("GET", "/api/v1/evaluation/certifications", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list rules: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/certifications/"+rule.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get rule: expected 200, got %d", w.Code)
	}

	w = env.Do("PUT", "/api/v1/evaluation/certifications/"+rule.ID, map[string]interface{}{
		"careerPositionId": pos.ID,
		"ruleSource":       "manual",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update rule: expected 200, got %d", w.Code)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/certifications/"+rule.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete rule: expected 200, got %d", w.Code)
	}
}

func TestCertification_ConfigItemsPoints(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
		"name":         "Cert Items Position",
		"positionType": "tech",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal position: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", pos.ID)

	w = env.Do("POST", "/api/v1/evaluation/certifications", map[string]interface{}{
		"careerPositionId": pos.ID,
		"ruleSource":       "manual",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create rule: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	rule, _ := testhelper.Unmarshal[domain.CertificationRule](w)
	defer env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE id = $1", rule.ID)

	w = env.Do("POST", "/api/v1/evaluation/certifications/"+rule.ID+"/items", map[string]interface{}{
		"name": "Item 1",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create item: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	item, err := testhelper.Unmarshal[domain.CertificationAbilityItem](w)
	if err != nil {
		t.Fatalf("unmarshal item: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM certification_ability_items WHERE id = $1", item.ID)

	w = env.Do("GET", "/api/v1/evaluation/certifications/"+rule.ID+"/items", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list items: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/certifications/items/"+item.ID+"/points", map[string]interface{}{
		"abilityPointId": "test-ability-point-id",
		"requiredLevel":  "A",
		"weight":         50,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create point: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	point, err := testhelper.Unmarshal[domain.CertificationAbilityPoint](w)
	if err != nil {
		t.Fatalf("unmarshal point: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM certification_ability_points WHERE id = $1", point.ID)

	w = env.Do("GET", "/api/v1/evaluation/certifications/items/"+item.ID+"/points", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list points: expected 200, got %d", w.Code)
	}
}

func TestGraduation(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
		"name":         "Grad Position",
		"positionType": "tech",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal position: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", pos.ID)

	w = env.Do("POST", "/api/v1/evaluation/graduation/topics", map[string]interface{}{
		"name":             "Topic 1",
		"careerPositionId": pos.ID,
		"college":          "CS",
		"source":           "scene",
		"capacity":         5,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create topic: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	topic, err := testhelper.Unmarshal[domain.GraduationProjectTopic](w)
	if err != nil {
		t.Fatalf("unmarshal topic: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM graduation_project_topics WHERE id = $1", topic.ID)

	w = env.Do("GET", "/api/v1/evaluation/graduation/topics", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list topics: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/graduation/topics/"+topic.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get topic: expected 200, got %d", w.Code)
	}

	w = env.Do("PUT", "/api/v1/evaluation/graduation/topics/"+topic.ID, map[string]interface{}{
		"name":             "Updated Topic",
		"careerPositionId": pos.ID,
		"college":          "CS",
		"source":           "scene",
		"capacity":         10,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update topic: expected 200, got %d", w.Code)
	}
	updated, err := testhelper.Unmarshal[domain.GraduationProjectTopic](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Name != "Updated Topic" {
		t.Fatalf("expected name 'Updated Topic', got %q", updated.Name)
	}

	w = env.Do("POST", "/api/v1/evaluation/graduation/topics/"+topic.ID+"/apply", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("apply topic: expected 200, got %d", w.Code)
	}
	applied, err := testhelper.Unmarshal[domain.GraduationProjectTopic](w)
	if err != nil {
		t.Fatalf("unmarshal apply: %v", err)
	}
	if applied.AppliedCount < 1 {
		t.Fatal("expected applied count >= 1 after apply")
	}

	w = env.Do("GET", "/api/v1/evaluation/graduation/archives", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list archives: expected 200, got %d", w.Code)
	}
	// apply 已自动创建档案（doc_status=making），此处验证而非重复创建
	archives, _, err := testhelper.UnmarshalList[domain.GraduationProjectArchive](w)
	if err != nil {
		t.Fatalf("unmarshal archives: %v", err)
	}
	var archive *domain.GraduationProjectArchive
	for i := range archives {
		if archives[i].TopicID == topic.ID && archives[i].UserID == testhelper.TestOperatorID {
			archive = &archives[i]
			break
		}
	}
	if archive == nil {
		t.Fatal("expected archive auto-created by apply")
	}
	defer env.DB.Exec(ctx, "DELETE FROM graduation_project_archives WHERE id = $1", archive.ID)

	if archive.DocStatus != "making" {
		t.Fatalf("expected docStatus 'making', got %q", archive.DocStatus)
	}

	w = env.Do("GET", "/api/v1/evaluation/graduation/evaluations", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list evaluations: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/graduation/evaluations", map[string]interface{}{
		"topicId":            topic.ID,
		"userId":             testhelper.TestOperatorID,
		"advisorScore":       85,
		"comprehensiveGrade": "B",
		"isExcellent":        false,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create evaluation: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	eval, err := testhelper.Unmarshal[domain.GraduationProjectEvaluation](w)
	if err != nil {
		t.Fatalf("unmarshal evaluation: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM graduation_project_evaluations WHERE id = $1", eval.ID)

	if *eval.ComprehensiveGrade != "B" {
		t.Fatalf("expected comprehensiveGrade 'B', got %q", *eval.ComprehensiveGrade)
	}

	w = env.Do("GET", "/api/v1/evaluation/graduation/query", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("query results: expected 200, got %d", w.Code)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/graduation/topics/"+topic.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete topic: expected 200, got %d", w.Code)
	}
}

func TestStudentPortrait(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("GET", "/api/v1/evaluation/portraits", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list portraits: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/portraits/archives", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list archives: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/portraits/archives", map[string]interface{}{
		"userId":       testhelper.TestOperatorID,
		"materialType": "certificate",
		"materialName": "Test Cert",
		"issuingOrg":   "Test Org",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create archive: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	archive, err := testhelper.Unmarshal[domain.StudentAbilityArchive](w)
	if err != nil {
		t.Fatalf("unmarshal archive: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM student_ability_archives WHERE id = $1", archive.ID)

	if archive.MaterialName != "Test Cert" {
		t.Fatalf("expected materialName 'Test Cert', got %q", archive.MaterialName)
	}
}

func TestMicroCert(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/certificates/templates", map[string]interface{}{
		"title":        "Test Template",
		"certTypeId":   "type-1",
		"certTypeName": "Type A",
		"content":      "Hello",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create template: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	tmpl, err := testhelper.Unmarshal[domain.MicroCertTemplate](w)
	if err != nil {
		t.Fatalf("unmarshal template: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM micro_cert_templates WHERE id = $1", tmpl.ID)

	w = env.Do("GET", "/api/v1/evaluation/certificates/templates", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list templates: expected 200, got %d", w.Code)
	}

	w = env.Do("PUT", "/api/v1/evaluation/certificates/templates/"+tmpl.ID, map[string]interface{}{
		"title":        "Updated Template",
		"certTypeId":   "type-1",
		"certTypeName": "Type A",
		"content":      "Updated",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("update template: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.MicroCertTemplate](w)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if updated.Title != "Updated Template" {
		t.Fatalf("expected title 'Updated Template', got %q", updated.Title)
	}

	w = env.Do("POST", "/api/v1/evaluation/certificates/issue", map[string]interface{}{
		"templateId": tmpl.ID,
		"userIds":    []string{testhelper.TestOperatorID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("issue certs: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	w = env.Do("GET", "/api/v1/evaluation/certificates/history", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list history: expected 200, got %d", w.Code)
	}

	w = env.Do("DELETE", "/api/v1/evaluation/certificates/templates/"+tmpl.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete template: expected 200, got %d", w.Code)
	}
}

func TestEvaluationMethods(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("GET", "/api/v1/evaluation/methods/categories", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list categories: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/methods", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list methods: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/methods/non-existent-id/toggle", map[string]interface{}{
		"enabled": true,
	})
	if w.Code != http.StatusNotFound {
		t.Errorf("toggle non-existent method: expected 404, got %d", w.Code)
	}
}

func TestAppeal(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/evaluation/appeals", map[string]interface{}{
		"userId": testhelper.TestOperatorID,
		"type":   "grade",
		"reason": "Test reason",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create appeal: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	appeal, err := testhelper.Unmarshal[domain.AppealRecord](w)
	if err != nil {
		t.Fatalf("unmarshal appeal: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM appeal_records WHERE id = $1", appeal.ID)

	w = env.Do("GET", "/api/v1/evaluation/appeals", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list appeals: expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/evaluation/appeals/"+appeal.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get appeal: expected 200, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/evaluation/appeals/"+appeal.ID+"/process", map[string]interface{}{
		"status": "approved",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("process appeal: expected 200, got %d", w.Code)
	}
	processed, err := testhelper.Unmarshal[domain.AppealRecord](w)
	if err != nil {
		t.Fatalf("unmarshal processed: %v", err)
	}
	if processed.Status != "approved" {
		t.Fatalf("expected status 'approved', got %q", processed.Status)
	}
}

func TestEvaluationResult_BatchGradeWithItems(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("POST", "/api/v1/evaluation/results/batch-grade", map[string]interface{}{
		"items": []map[string]interface{}{
			{"id": "dummy-id-1", "score": 80},
			{"id": "dummy-id-2", "score": 90},
		},
	})
	if w.Code == http.StatusOK {
		t.Errorf("batch grade with dummy ids should not return 200, got %d", w.Code)
	}
}
