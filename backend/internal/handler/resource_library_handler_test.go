package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func newResourceLibraryTestEnv(t *testing.T) (env *testhelper.TestEnv, do func(method, path string, body interface{}) *httptest.ResponseRecorder) {
	env = testhelper.SetupTestEnv(t)
	// 固定 uuid 用户：resource_library.uploaded_by / knowledge_points.creator_id 等
	// uuid 列要求合法 uuid 格式，非 uuid 字符串（如 school-admin-001）会触发 22P02
	const userID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa00a1"
	_, _ = env.DB.Exec(context.Background(), `
		INSERT INTO users (id, tenant_id, role, username, login_name, password_hash, name, status)
		VALUES ($1, $2, 'operator', 'lib-test-admin', 'lib-test-admin', 'x', 'lib-test-admin', 'active')
		ON CONFLICT (id) DO NOTHING
	`, userID, testhelper.TestTenantID)
	schoolAdminToken := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	return env, func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}
}

func createTestResources(t *testing.T, do func(method, path string, body interface{}) *httptest.ResponseRecorder, prefix string, types ...string) []string {
	t.Helper()
	ids := make([]string, 0, len(types))
	for _, rt := range types {
		w := do("POST", "/api/v1/library/resources", map[string]interface{}{
			"name":         prefix + "-" + rt,
			"resourceType": rt,
			"url":          "https://example.com/" + rt,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create %s: %d %s", rt, w.Code, testhelper.ErrMsg(w))
		}
		item, err := testhelper.Unmarshal[domain.ResourceLibraryItem](w)
		if err != nil {
			t.Fatalf("unmarshal create: %v", err)
		}
		ids = append(ids, item.ID)
	}
	t.Cleanup(func() {
		for _, id := range ids {
			do("DELETE", "/api/v1/library/resources/"+id, nil)
		}
	})
	return ids
}

// TestResourceLibrary_Pagination 验证资源列表服务端分页（limit/offset/total），
// 数量超过 200 时可分页加载，数据不再被截断。
func TestResourceLibrary_Pagination(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()

	prefix := fmt.Sprintf("分页测试-%s", uuid.NewString()[:8])
	createTestResources(t, do, prefix, "document", "document", "image")

	base := "/api/v1/library/resources?search=" + prefix

	wList := do("GET", base+"&limit=200&offset=0", nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d %s", wList.Code, testhelper.ErrMsg(wList))
	}
	items, total, err := testhelper.UnmarshalList[domain.ResourceLibraryItem](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) != 3 || total != 3 {
		t.Fatalf("page1: got %d items, total %d; want 3/3", len(items), total)
	}

	wPage2 := do("GET", base+"&limit=200&offset=1", nil)
	if wPage2.Code != http.StatusOK {
		t.Fatalf("page2: %d", wPage2.Code)
	}
	items2, total2, err := testhelper.UnmarshalList[domain.ResourceLibraryItem](wPage2)
	if err != nil {
		t.Fatalf("unmarshal page2: %v", err)
	}
	if len(items2) != 2 || total2 != 3 {
		t.Fatalf("page2: got %d items, total %d; want 2/3", len(items2), total2)
	}
}

// TestResourceLibrary_Stats 验证按类型统计接口，供总览页统计卡片使用。
func TestResourceLibrary_Stats(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()

	prefix := fmt.Sprintf("统计测试-%s", uuid.NewString()[:8])
	createTestResources(t, do, prefix, "document", "document", "image")

	wStats := do("GET", "/api/v1/library/resources/stats?search="+prefix, nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("stats: %d %s", wStats.Code, testhelper.ErrMsg(wStats))
	}
	var resp struct {
		Items []struct {
			ResourceType string `json:"resourceType"`
			Count        int    `json:"count"`
		} `json:"items"`
	}
	if err := json.NewDecoder(wStats.Body).Decode(&resp); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	counts := map[string]int{}
	for _, c := range resp.Items {
		counts[c.ResourceType] = c.Count
	}
	if counts["document"] != 2 || counts["image"] != 1 {
		t.Fatalf("stats counts: %+v; want document=2 image=1", counts)
	}

	wEmpty := do("GET", "/api/v1/library/resources/stats?search="+prefix+"-不存在", nil)
	if wEmpty.Code != http.StatusOK {
		t.Fatalf("stats empty: %d %s", wEmpty.Code, testhelper.ErrMsg(wEmpty))
	}
	if err := json.NewDecoder(wEmpty.Body).Decode(&resp); err != nil {
		t.Fatalf("decode stats empty: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Fatalf("stats empty: got %d items; want 0", len(resp.Items))
	}
}

// TestResourceLibrary_PreviewImport 验证批量导入重名校验：
// 同租户同类型下按名称精确匹配返回已存在资源，其他类型/名称不误报。
func TestResourceLibrary_PreviewImport(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()

	prefix := fmt.Sprintf("导入校验-%s", uuid.NewString()[:8])
	createTestResources(t, do, prefix, "document", "image")

	w := do("POST", "/api/v1/library/resources/import/preview", map[string]interface{}{
		"names":        []string{prefix + "-document", prefix + "-image", prefix + "-不存在"},
		"resourceType": "document",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("preview: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.ResourceLibraryItem](w)
	if err != nil {
		t.Fatalf("unmarshal preview: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Name != prefix+"-document" {
		t.Fatalf("preview: got %d items total %d; want only the document", len(items), total)
	}

	wEmpty := do("POST", "/api/v1/library/resources/import/preview", map[string]interface{}{
		"names":        []string{prefix + "-不存在"},
		"resourceType": "document",
	})
	if wEmpty.Code != http.StatusOK {
		t.Fatalf("preview empty: %d %s", wEmpty.Code, testhelper.ErrMsg(wEmpty))
	}
	if _, total, err := testhelper.UnmarshalList[domain.ResourceLibraryItem](wEmpty); err != nil || total != 0 {
		t.Fatalf("preview empty: total %d err %v; want 0", total, err)
	}

	wBad := do("POST", "/api/v1/library/resources/import/preview", map[string]interface{}{
		"names": []string{},
	})
	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("preview bad request: %d; want 400", wBad.Code)
	}
}
