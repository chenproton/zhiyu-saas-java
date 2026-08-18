package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
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

// TestTagFilter_KnowledgePoint 回归：知识点页标签筛选。
// 知识点主表无别名时，AddTagFilter 若传裸 "id" 会被 EXISTS 子查询内层表
// resource_tag_relations 的 id 列遮蔽（rtr.resource_id = rtr.id 恒不成立），
// 导致任何带标签筛选都返回空。此测试验证：
//  1. 资源绑 A+B 两个标签时，单选 A 应被筛出（OR/并集语义）
//  2. 多选 A+B 取并集
func TestTagFilter_KnowledgePoint(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := uuid.NewString()
	token := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.RoleTeacher, nil, "teacher")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	// testhelper 未注册标签绑定路由，此处补注册（与 TestTags_ListFilter 同模式）
	tagH := &handler.TagHandler{Service: service.NewTagService(service.New(store.New(env.DB)))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Post("/api/v1/library/resource-tags", tagH.SetBindings)
	})
	// 知识点 creator_id 有外键约束，先建用户（user_role 枚举：school/enterprise/operator）
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, username, login_name, password_hash, name, status)
		VALUES ($1, $2, 'operator', $3, $3, 'x', $3, 'active') ON CONFLICT (id) DO NOTHING
	`, userID, testhelper.TestTenantID, "tag-filter-teacher-"+userID[:8]); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM tags WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_tag_relations WHERE tenant_id = $1", testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE tenant_id = $1", testhelper.TestTenantID)

	prefix := fmt.Sprintf("KP标签回归-%s", uuid.NewString()[:6])

	// 直接插标签 A、B（testhelper 未注册标签 CRUD 路由，与 TestTags_ListFilter 同模式）
	tagA := uuid.NewString()
	tagB := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO tags (id, tenant_id, name, color)
		VALUES ($1, $2, $3, '#6366f1'), ($4, $2, $5, '#3b82f6')
	`, tagA, testhelper.TestTenantID, prefix+"-标签A", tagB, prefix+"-标签B"); err != nil {
		t.Fatalf("insert tags: %v", err)
	}

	// 建知识点：kpAB 绑 A+B，kpA 只绑 A，kpNone 不绑
	createKP := func(name string) string {
		w := do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{"name": name, "linked": false})
		if w.Code != http.StatusCreated {
			t.Fatalf("create kp: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var kp struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&kp); err != nil {
			t.Fatalf("decode kp: %v", err)
		}
		return kp.ID
	}
	kpAB := createKP(prefix + "-A+B")
	kpA := createKP(prefix + "-仅A")
	createKP(prefix + "-无标签")

	bind := func(resourceID string, tagIDs []string) {
		w := do("POST", "/api/v1/library/resource-tags", map[string]interface{}{
			"resourceType": "knowledge_point",
			"resourceId":   resourceID,
			"tagIds":       tagIDs,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("bind tags: %d %s", w.Code, testhelper.ErrMsg(w))
		}
	}
	bind(kpAB, []string{tagA, tagB})
	bind(kpA, []string{tagA})

	listNames := func(tagIds string) map[string]bool {
		w := do("GET", "/api/v1/lesson/knowledge-points?tagIds="+tagIds+"&limit=50", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("list: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var resp struct {
			Items []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"items"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode list: %v", err)
		}
		names := map[string]bool{}
		for _, it := range resp.Items {
			names[it.ID] = true
		}
		return names
	}

	// 场景 1：单选 A → 应同时筛出 kpAB（A+B）与 kpA
	got := listNames(tagA)
	if !got[kpAB] || !got[kpA] {
		t.Fatalf("单选A应筛出 A+B 与 仅A 资源，实际: A+B=%v 仅A=%v", got[kpAB], got[kpA])
	}

	// 场景 2：多选 A+B → 并集仍为 kpAB + kpA（kpNone 不应出现）
	got = listNames(tagA + "," + tagB)
	if !got[kpAB] || !got[kpA] {
		t.Fatalf("多选A+B并集应包含 kpAB 与 kpA，实际: A+B=%v 仅A=%v", got[kpAB], got[kpA])
	}
	if len(got) != 2 {
		t.Fatalf("并集应恰有 2 个资源，实际 %d: %v", len(got), got)
	}
}
