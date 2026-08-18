package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestCourse_ListReturnsKnowledgePointNames 验证课程列表/详情接口返回知识点名称，
// 前端颗粒课编辑页不再依赖全量知识点列表接口（该接口 maxPageSize=200 会截断，导致
// 引用旧知识点的课程回显名称缺失）。
func TestCourse_ListReturnsKnowledgePointNames(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// 创建知识点
	w := env.Do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{
		"name":   "颗粒课核心知识点",
		"linked": false,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create knowledge point: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	kp, _ := testhelper.Unmarshal[domain.KnowledgePoint](w)
	defer env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE id = $1", kp.ID)

	// 创建课程并关联知识点
	code := fmt.Sprintf("test-course-kp-%s", t.Name())
	w = env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"name":              "知识点名称测试课程",
		"code":              code,
		"type":              "granular",
		"category":          "专业基础",
		"knowledgePointIds": []string{kp.ID},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create course: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	course, _ := testhelper.Unmarshal[domain.Course](w)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", course.ID)

	t.Run("ListReturnsNames", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/lesson/courses?type=granular&limit=200", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("list courses: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, _, err := testhelper.UnmarshalList[domain.Course](w)
		if err != nil {
			t.Fatalf("unmarshal courses: %v", err)
		}
		found := false
		for _, it := range items {
			if it.ID != course.ID {
				continue
			}
			found = true
			names := it.KnowledgePointNames
			if len(names) != 1 {
				t.Fatalf("knowledgePointNames length = %d, want 1", len(names))
			}
			name, ok := names[0].(string)
			if !ok || name != "颗粒课核心知识点" {
				t.Fatalf("knowledgePointNames[0] = %v, want 颗粒课核心知识点", names[0])
			}
		}
		if !found {
			t.Fatal("created course not found in list")
		}
	})

	t.Run("GetReturnsNames", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/lesson/courses/"+course.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("get course: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		got, err := testhelper.Unmarshal[domain.Course](w)
		if err != nil {
			t.Fatalf("unmarshal course: %v", err)
		}
		names := got.KnowledgePointNames
		if len(names) != 1 {
			t.Fatalf("knowledgePointNames length = %d, want 1", len(names))
		}
		name, ok := names[0].(string)
		if !ok || name != "颗粒课核心知识点" {
			t.Fatalf("knowledgePointNames[0] = %v, want 颗粒课核心知识点", names[0])
		}
	})
}
