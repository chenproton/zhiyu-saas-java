package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestTags_CRUDAndBindings 验证标签 CRUD、资源绑定全量替换、批量查询、删除级联清理。
func TestTags_CRUDAndBindings(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	tagH := &handler.TagHandler{Service: service.NewTagService(service.New(st))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Get("/api/v1/library/tags", tagH.List)
		r.Post("/api/v1/library/tags", tagH.Create)
		r.Put("/api/v1/library/tags/{id}", tagH.Update)
		r.Delete("/api/v1/library/tags/{id}", tagH.Delete)
		r.Post("/api/v1/library/resource-tags", tagH.SetBindings)
		r.Post("/api/v1/library/resource-tags/query", tagH.QueryBindings)
	})

	token := env.NewTokenWithIdentity("teacher-tag-001", testhelper.TestTenantID, domain.RoleTeacher, nil, "teacher")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}
	defer env.DB.Exec(ctx, "DELETE FROM tags WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_tag_relations WHERE tenant_id = $1", testhelper.TestTenantID)

	// 1. 创建标签
	w := do("POST", "/api/v1/library/tags", map[string]string{"name": "重点教材", "color": "#ef4444"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	tag, err := testhelper.Unmarshal[domain.TagItem](w)
	if err != nil {
		t.Fatalf("unmarshal tag: %v", err)
	}
	if tag.Name != "重点教材" || tag.Color != "#ef4444" {
		t.Fatalf("unexpected tag: %+v", tag)
	}

	// 2. 重复名称 → 409
	w = do("POST", "/api/v1/library/tags", map[string]string{"name": "重点教材"})
	if w.Code != http.StatusConflict {
		t.Fatalf("duplicate name should be 409, got %d", w.Code)
	}

	// 3. 非法颜色 → 400
	w = do("POST", "/api/v1/library/tags", map[string]string{"name": "红色", "color": "red"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid color should be 400, got %d", w.Code)
	}

	// 4. 设置资源绑定（全量替换）
	resID := uuid.NewString()
	w = do("POST", "/api/v1/library/resource-tags", map[string]interface{}{
		"resourceType": "resource_library",
		"resourceId":   resID,
		"tagIds":       []string{tag.ID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("set bindings: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 5. 批量查询绑定
	w = do("POST", "/api/v1/library/resource-tags/query", map[string]interface{}{
		"resourceType": "resource_library",
		"resourceIds":  []string{resID, uuid.NewString()},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("query bindings: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	rels, _, err := testhelper.UnmarshalList[domain.ResourceTagRelation](w)
	if err != nil {
		t.Fatalf("unmarshal rels: %v", err)
	}
	if len(rels) != 1 || rels[0].ResourceID != resID || len(rels[0].Tags) != 1 {
		t.Fatalf("unexpected bindings: %+v", rels)
	}

	// 6. 列表含绑定数量
	w = do("GET", "/api/v1/library/tags?tenantId="+testhelper.TestTenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	tags, _, err := testhelper.UnmarshalList[domain.TagItem](w)
	if err != nil {
		t.Fatalf("unmarshal tags: %v", err)
	}
	var found bool
	for _, tg := range tags {
		if tg.ID == tag.ID {
			found = true
			if tg.ResourceCount != 1 {
				t.Fatalf("expected resourceCount 1, got %d", tg.ResourceCount)
			}
		}
	}
	if !found {
		t.Fatalf("expected tag in list, got %d items", len(tags))
	}

	// 7. 更新标签
	w = do("PUT", "/api/v1/library/tags/"+tag.ID, map[string]string{"name": "重点教材v2", "color": "#3b82f6"})
	if w.Code != http.StatusOK {
		t.Fatalf("update: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 8. 删除标签 → 绑定级联清理
	w = do("DELETE", "/api/v1/library/tags/"+tag.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = do("POST", "/api/v1/library/resource-tags/query", map[string]interface{}{
		"resourceType": "resource_library",
		"resourceIds":  []string{resID},
	})
	rels, _, err = testhelper.UnmarshalList[domain.ResourceTagRelation](w)
	if err != nil {
		t.Fatalf("unmarshal rels after delete: %v", err)
	}
	if len(rels) != 0 {
		t.Fatalf("bindings should be cascaded after tag delete, got %+v", rels)
	}
}

// TestTags_ResourceDeleteCleansBindings 验证删除资源时绑定关系被清理（防脏数据）。
func TestTags_ResourceDeleteCleansBindings(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	tagH := &handler.TagHandler{Service: service.NewTagService(service.New(st))}
	resH := &handler.ResourceLibraryHandler{Service: service.NewResourceService(service.New(st))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Post("/api/v1/library/resource-tags", tagH.SetBindings)
		r.Post("/api/v1/library/resource-tags/query", tagH.QueryBindings)
		r.Delete("/api/v1/library/resources/{id}", resH.Delete)
	})

	token := env.NewTokenWithIdentity("teacher-tag-002", testhelper.TestTenantID, domain.RoleTeacher, nil, "teacher")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}
	defer env.DB.Exec(ctx, "DELETE FROM tags WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_tag_relations WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_library WHERE tenant_id = $1", testhelper.TestTenantID)

	tagID := uuid.NewString()
	resID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO tags (id, tenant_id, name, color) VALUES ($1, $2, '临时标签', '#6366f1')
	`, tagID, testhelper.TestTenantID); err != nil {
		t.Fatalf("insert tag: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by)
		VALUES ($1, $2, '待删资源', 'document', $2)
	`, resID, testhelper.TestTenantID); err != nil {
		t.Fatalf("insert resource: %v", err)
	}
	w := do("POST", "/api/v1/library/resource-tags", map[string]interface{}{
		"resourceType": "resource_library",
		"resourceId":   resID,
		"tagIds":       []string{tagID},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("set bindings: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 删除资源后绑定应被清理
	w = do("DELETE", "/api/v1/library/resources/"+resID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("delete resource: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = do("POST", "/api/v1/library/resource-tags/query", map[string]interface{}{
		"resourceType": "resource_library",
		"resourceIds":  []string{resID},
	})
	rels, _, err := testhelper.UnmarshalList[domain.ResourceTagRelation](w)
	if err != nil {
		t.Fatalf("unmarshal rels: %v", err)
	}
	if len(rels) != 0 {
		t.Fatalf("bindings should be cleaned after resource delete, got %+v", rels)
	}
}

// TestTags_ListFilter 验证资源列表按标签多选筛选（OR 语义）。
func TestTags_ListFilter(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	tagH := &handler.TagHandler{Service: service.NewTagService(service.New(st))}
	resH := &handler.ResourceLibraryHandler{Service: service.NewResourceService(service.New(st))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Post("/api/v1/library/resource-tags", tagH.SetBindings)
		r.Get("/api/v1/library/resources", resH.List)
	})

	token := env.NewTokenWithIdentity("teacher-tag-003", testhelper.TestTenantID, domain.RoleTeacher, nil, "teacher")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}
	defer env.DB.Exec(ctx, "DELETE FROM tags WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_tag_relations WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_library WHERE tenant_id = $1", testhelper.TestTenantID)

	tagA := uuid.NewString()
	tagB := uuid.NewString()
	resA := uuid.NewString()
	resB := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO tags (id, tenant_id, name, color) VALUES ($1, $2, '标签甲', '#ef4444'), ($3, $2, '标签乙', '#3b82f6')
	`, tagA, testhelper.TestTenantID, tagB); err != nil {
		t.Fatalf("insert tags: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by)
		VALUES ($1, $2, '资源甲', 'document', $2), ($3, $2, '资源乙', 'software', $2)
	`, resA, testhelper.TestTenantID, resB); err != nil {
		t.Fatalf("insert resources: %v", err)
	}
	for _, b := range []map[string]interface{}{
		{"resourceType": "resource_library", "resourceId": resA, "tagIds": []string{tagA}},
		{"resourceType": "resource_library", "resourceId": resB, "tagIds": []string{tagB}},
	} {
		if w := do("POST", "/api/v1/library/resource-tags", b); w.Code != http.StatusOK {
			t.Fatalf("set bindings: %d %s", w.Code, testhelper.ErrMsg(w))
		}
	}

	w := do("GET", "/api/v1/library/resources?tagIds="+tagA+","+tagB+"&limit=200", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	items, _, err := testhelper.UnmarshalList[domain.ResourceLibraryItem](w)
	if err != nil {
		t.Fatalf("unmarshal items: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 resources with OR filter, got %d", len(items))
	}

	w = do("GET", "/api/v1/library/resources?tagIds="+tagA+"&limit=200", nil)
	items, _, err = testhelper.UnmarshalList[domain.ResourceLibraryItem](w)
	if err != nil {
		t.Fatalf("unmarshal items: %v", err)
	}
	if len(items) != 1 || items[0].ID != resA {
		t.Fatalf("expected only 资源甲, got %+v", items)
	}
}
