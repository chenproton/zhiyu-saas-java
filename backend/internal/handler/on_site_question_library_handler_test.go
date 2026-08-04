package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestOnSiteQuestionLibrary_ListGet 验证现场题库列表/详情（经 pgx 泛型位置扫描）读取正常。
// 该资源无写路由，测试数据经 SQL 直接插入。
func TestOnSiteQuestionLibrary_ListGet(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	token := env.NewTokenWithIdentity("teacher-001", testhelper.TestTenantID, domain.RoleTeacher, nil, "teacher")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}

	qID := uuid.NewString()
	_, err := env.DB.Exec(ctx, `
		INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at)
		VALUES ($1, $2, '测试题目', '测试答案', 'single', 5, 'easy', ARRAY['kp-1']::uuid[], ARRAY['标签A']::text[], $3, NOW(), NOW())
	`, qID, testhelper.TestTenantID, testhelper.TestTenantID)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM on_site_question_library WHERE id = $1", qID)

	wList := do("GET", "/api/v1/library/on-site-questions?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d %s", wList.Code, testhelper.ErrMsg(wList))
	}
	items, _, err := testhelper.UnmarshalList[domain.OnSiteQuestionLibraryItem](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	var found bool
	for _, it := range items {
		if it.ID == qID {
			found = true
			if it.QuestionText != "测试题目" {
				t.Fatalf("expected question text, got %s", it.QuestionText)
			}
			if it.Score != 5 {
				t.Fatalf("expected score 5, got %v", it.Score)
			}
		}
	}
	if !found {
		t.Fatalf("expected inserted question in list, got %d items", len(items))
	}

	wGet := do("GET", "/api/v1/library/on-site-questions/"+qID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d %s", wGet.Code, testhelper.ErrMsg(wGet))
	}
	item, err := testhelper.Unmarshal[domain.OnSiteQuestionLibraryItem](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if item.Answer == nil || *item.Answer != "测试答案" {
		t.Fatalf("expected answer, got %v", item.Answer)
	}
	if len(item.Tags) != 1 || item.Tags[0] != "标签A" {
		t.Fatalf("expected tags, got %v", item.Tags)
	}
}
