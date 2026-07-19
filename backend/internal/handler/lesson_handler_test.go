package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestCourse_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST001",
		"name":     "Test Course",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	course, err := testhelper.Unmarshal[domain.Course](w)
	if err != nil {
		t.Fatalf("unmarshal course: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	if course.Code != "TEST001" {
		t.Fatalf("expected code TEST001, got %s", course.Code)
	}
	if course.Name != "Test Course" {
		t.Fatalf("expected name Test Course, got %s", course.Name)
	}

	w = env.Do("GET", "/api/v1/lesson/courses?type=system", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.Course](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 course in list")
	}

	w = env.Do("GET", "/api/v1/lesson/courses/"+course.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.Course](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != course.ID {
		t.Fatalf("expected id %s, got %s", course.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/lesson/courses/"+course.ID, map[string]interface{}{
		"code":     "TEST001",
		"name":     "Test Course Updated",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.Course](w)
	if err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.Name != "Test Course Updated" {
		t.Fatalf("expected name 'Test Course Updated', got %s", updated.Name)
	}

	w = env.Do("DELETE", "/api/v1/lesson/courses/"+course.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/courses/"+course.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", w.Code)
	}
}

func TestCourse_StatusTransitions(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST002",
		"name":     "Status Test",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	if course.Status != domain.CourseStatusDraft {
		t.Fatalf("expected draft, got %s", course.Status)
	}

	w = env.Do("POST", "/api/v1/lesson/courses/"+course.ID+"/submit", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	course, _ = testhelper.Unmarshal[domain.Course](w)
	if course.Status != domain.CourseStatusPending {
		t.Fatalf("expected pending, got %s", course.Status)
	}

	w = env.Do("POST", "/api/v1/lesson/courses/"+course.ID+"/review", map[string]string{
		"status": "approved",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	course, _ = testhelper.Unmarshal[domain.Course](w)
	if course.Status != domain.CourseStatusApproved {
		t.Fatalf("expected approved, got %s", course.Status)
	}

	w = env.Do("POST", "/api/v1/lesson/courses/"+course.ID+"/publish", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	course, _ = testhelper.Unmarshal[domain.Course](w)
	if course.Status != domain.CourseStatusPublished {
		t.Fatalf("expected published, got %s", course.Status)
	}
}

func TestCourse_ValidationErrors(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"name":     "No Code",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing code, got %d", w.Code)
	}

	w = env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST003",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing name, got %d", w.Code)
	}
}

func TestKnowledgePoint_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	code := "KP001"
	w := env.Do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{
		"name": "Knowledge 1",
		"code": code,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	kp, err := testhelper.Unmarshal[domain.KnowledgePoint](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE id = $1", kp.ID)

	if kp.Name != "Knowledge 1" {
		t.Fatalf("expected name Knowledge 1, got %s", kp.Name)
	}

	w = env.Do("GET", "/api/v1/lesson/knowledge-points", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.KnowledgePoint](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 knowledge point")
	}

	w = env.Do("GET", "/api/v1/lesson/knowledge-points/"+kp.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.KnowledgePoint](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != kp.ID {
		t.Fatalf("expected id %s, got %s", kp.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/lesson/knowledge-points/"+kp.ID, map[string]interface{}{
		"name": "Knowledge 1 Updated",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.KnowledgePoint](w)
	if err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.Name != "Knowledge 1 Updated" {
		t.Fatalf("expected 'Knowledge 1 Updated', got %s", updated.Name)
	}

	w = env.Do("DELETE", "/api/v1/lesson/knowledge-points/"+kp.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/knowledge-points/"+kp.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", w.Code)
	}
}

func TestCourseNode_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST004",
		"name":     "Node Test Course",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	w = env.Do("POST", "/api/v1/lesson/nodes", map[string]interface{}{
		"courseId":  course.ID,
		"name":      "Node 1",
		"sortOrder": 0,
		"refType":   "normal",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	node, err := testhelper.Unmarshal[domain.SystemCourseNode](w)
	if err != nil {
		t.Fatalf("unmarshal node: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", node.ID)

	if node.Name != "Node 1" {
		t.Fatalf("expected Node 1, got %s", node.Name)
	}
	if node.CourseID != course.ID {
		t.Fatalf("expected courseId %s, got %s", course.ID, node.CourseID)
	}

	w = env.Do("GET", "/api/v1/lesson/nodes?courseId="+course.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.SystemCourseNode](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 node")
	}

	w = env.Do("GET", "/api/v1/lesson/nodes/"+node.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.SystemCourseNode](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != node.ID {
		t.Fatalf("expected id %s, got %s", node.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/lesson/nodes/"+node.ID, map[string]interface{}{
		"name":      "Node 1 Updated",
		"sortOrder": 1,
		"refType":   "normal",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.SystemCourseNode](w)
	if err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.Name != "Node 1 Updated" {
		t.Fatalf("expected 'Node 1 Updated', got %s", updated.Name)
	}

	w = env.Do("POST", "/api/v1/lesson/nodes", map[string]interface{}{
		"courseId":  course.ID,
		"parentId":  node.ID,
		"name":      "Child Node 1",
		"sortOrder": 0,
		"refType":   "normal",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 for child node, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	child, err := testhelper.Unmarshal[domain.SystemCourseNode](w)
	if err != nil {
		t.Fatalf("unmarshal child: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", child.ID)

	if child.ParentID == nil || *child.ParentID != node.ID {
		t.Fatal("expected parentId to match parent node")
	}

	w = env.Do("POST", "/api/v1/lesson/nodes/reorder", map[string]interface{}{
		"courseId": course.ID,
		"nodeIds":  []string{child.ID, node.ID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for reorder, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	w = env.Do("DELETE", "/api/v1/lesson/nodes/"+child.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("DELETE", "/api/v1/lesson/nodes/"+node.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/nodes/"+node.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", w.Code)
	}
}

func TestNodeQuiz_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST005",
		"name":     "Quiz Test Course",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	w = env.Do("POST", "/api/v1/lesson/nodes", map[string]interface{}{
		"courseId":  course.ID,
		"name":      "Quiz Node",
		"sortOrder": 0,
		"refType":   "normal",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	node, _ := testhelper.Unmarshal[domain.SystemCourseNode](w)
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", node.ID)

	w = env.Do("POST", "/api/v1/lesson/quizzes", map[string]interface{}{
		"nodeId": node.ID,
		"title":  "Quiz 1",
		"type":   "paper",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	quiz, err := testhelper.Unmarshal[domain.NodeQuiz](w)
	if err != nil {
		t.Fatalf("unmarshal quiz: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM node_quizzes WHERE id = $1", quiz.ID)

	if quiz.Title != "Quiz 1" {
		t.Fatalf("expected Quiz 1, got %s", quiz.Title)
	}

	w = env.Do("GET", "/api/v1/lesson/quizzes?nodeId="+node.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.NodeQuiz](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 quiz")
	}

	answer := "A"
	w = env.Do("POST", "/api/v1/lesson/quizzes/"+quiz.ID+"/questions", map[string]interface{}{
		"type":      "single",
		"question":  "What is 2+2?",
		"options":   map[string]interface{}{"A": "3", "B": "4", "C": "5", "D": "6"},
		"answer":    answer,
		"score":     10.0,
		"sortOrder": 0,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 for question, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	question, err := testhelper.Unmarshal[domain.NodeQuizQuestion](w)
	if err != nil {
		t.Fatalf("unmarshal question: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM node_quiz_questions WHERE id = $1", question.ID)

	w = env.Do("GET", "/api/v1/lesson/quizzes/"+quiz.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	qItems, _, err := testhelper.UnmarshalList[domain.NodeQuizQuestion](w)
	if err != nil {
		t.Fatalf("unmarshal question list: %v", err)
	}
	if len(qItems) < 1 {
		t.Fatal("expected at least 1 question")
	}

	w = env.Do("PUT", "/api/v1/lesson/quizzes/"+quiz.ID, map[string]interface{}{
		"title": "Quiz 1 Updated",
		"type":  "paper",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updatedQuiz, err := testhelper.Unmarshal[domain.NodeQuiz](w)
	if err != nil {
		t.Fatalf("unmarshal updated quiz: %v", err)
	}
	if updatedQuiz.Title != "Quiz 1 Updated" {
		t.Fatalf("expected 'Quiz 1 Updated', got %s", updatedQuiz.Title)
	}

	w = env.Do("DELETE", "/api/v1/lesson/quizzes/"+quiz.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/quizzes/"+quiz.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", w.Code)
	}
}

func TestNodeHomework_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST006",
		"name":     "Homework Test Course",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	w = env.Do("POST", "/api/v1/lesson/nodes", map[string]interface{}{
		"courseId":  course.ID,
		"name":      "Homework Node",
		"sortOrder": 0,
		"refType":   "normal",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	node, _ := testhelper.Unmarshal[domain.SystemCourseNode](w)
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", node.ID)

	w = env.Do("POST", "/api/v1/lesson/homeworks", map[string]interface{}{
		"nodeId": node.ID,
		"title":  "HW 1",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	hw, err := testhelper.Unmarshal[domain.NodeHomework](w)
	if err != nil {
		t.Fatalf("unmarshal homework: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM node_homeworks WHERE id = $1", hw.ID)

	if hw.Title != "HW 1" {
		t.Fatalf("expected HW 1, got %s", hw.Title)
	}

	w = env.Do("GET", "/api/v1/lesson/homeworks?nodeId="+node.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.NodeHomework](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 homework")
	}

	w = env.Do("GET", "/api/v1/lesson/homeworks/"+hw.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	got, err := testhelper.Unmarshal[domain.NodeHomework](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != hw.ID {
		t.Fatalf("expected id %s, got %s", hw.ID, got.ID)
	}

	w = env.Do("PUT", "/api/v1/lesson/homeworks/"+hw.ID, map[string]interface{}{
		"title": "HW 1 Updated",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.NodeHomework](w)
	if err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.Title != "HW 1 Updated" {
		t.Fatalf("expected 'HW 1 Updated', got %s", updated.Title)
	}

	w = env.Do("DELETE", "/api/v1/lesson/homeworks/"+hw.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/homeworks/"+hw.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", w.Code)
	}
}

func TestCourseBatch_CRUD(t *testing.T) {
	t.Skip("lesson_batches table not yet created in migrations")
}

func TestHybridModule(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"code":     "TEST007",
		"name":     "Hybrid Test Course",
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	w = env.Do("POST", "/api/v1/lesson/nodes", map[string]interface{}{
		"courseId":  course.ID,
		"name":      "Hybrid Node",
		"sortOrder": 0,
		"refType":   "normal",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	node, _ := testhelper.Unmarshal[domain.SystemCourseNode](w)
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", node.ID)

	w = env.Do("POST", "/api/v1/lesson/hybrid-modules", map[string]interface{}{
		"nodeId":    node.ID,
		"moduleKey": "prePreview",
		"mode":      "online",
		"data":      map[string]interface{}{},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	module, err := testhelper.Unmarshal[domain.HybridNodeModule](w)
	if err != nil {
		t.Fatalf("unmarshal module: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM hybrid_node_modules WHERE id = $1", module.ID)

	if module.ModuleKey != "prePreview" {
		t.Fatalf("expected prePreview, got %s", module.ModuleKey)
	}

	w = env.Do("GET", "/api/v1/lesson/hybrid-modules?nodeId="+node.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.HybridNodeModule](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) < 1 {
		t.Fatal("expected at least 1 hybrid module")
	}

	w = env.Do("DELETE", "/api/v1/lesson/hybrid-modules/"+module.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = env.Do("GET", "/api/v1/lesson/hybrid-modules?nodeId="+node.ID, nil)
	items, _, _ = testhelper.UnmarshalList[domain.HybridNodeModule](w)
	if len(items) != 0 {
		t.Fatalf("expected 0 modules after delete, got %d", len(items))
	}
}
