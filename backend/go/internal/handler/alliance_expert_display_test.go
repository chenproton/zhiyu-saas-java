package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// setupExpertDisplayFixture 预置企业（enable_public）+ link（is_public=true）+ 专家。
// 返回专家 id 与清理函数；expertPublic 控制专家 is_public 初始值。
func setupExpertDisplayFixture(t *testing.T, env *testhelper.TestEnv, ctx context.Context, expertPublic bool) (string, func()) {
	t.Helper()
	tenantID := testhelper.TestTenantID
	entID, expID := uuid.NewString(), uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name, enable_public) VALUES ($1,$2,$3,true)`,
		entID, tenantID, "展示开关测试企业-"+entID[:8]); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, is_public) VALUES ($1,$2,true)`,
		tenantID, entID); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, is_public) VALUES ($1,$2,$3,$4,'active',$5)`,
		expID, tenantID, "展示开关测试专家-"+expID[:8], entID, expertPublic); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	cleanup := func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, expID)
		env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = $2`, tenantID, entID)
		env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
	}
	return expID, cleanup
}

// TestExpertDisplay_Toggle 学校侧"前台展示"开关：
// - PUT /alliance/experts/{id}/display 可切换专家 is_public
// - 未引入企业的专家 404；不存在的专家 404
// - 开关只改 is_public，不影响专家其他字段
func TestExpertDisplay_Toggle(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Put("/alliance/experts/{id}/display", h.ToggleExpertDisplay)

	expID, cleanup := setupExpertDisplayFixture(t, env, ctx, false)
	defer cleanup()

	teacher := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	t.Run("toggle on", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/alliance/experts/"+expID+"/display", map[string]bool{"isPublic": true}, teacher)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var got bool
		if err := env.DB.QueryRow(ctx, `SELECT is_public FROM alliance_experts WHERE id = $1`, expID).Scan(&got); err != nil {
			t.Fatalf("查询专家失败: %v", err)
		}
		if !got {
			t.Fatal("is_public 应已开启")
		}
	})

	t.Run("toggle off keeps other fields", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/alliance/experts/"+expID+"/display", map[string]bool{"isPublic": false}, teacher)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var got bool
		var name, status string
		if err := env.DB.QueryRow(ctx, `SELECT is_public, name, status FROM alliance_experts WHERE id = $1`, expID).Scan(&got, &name, &status); err != nil {
			t.Fatalf("查询专家失败: %v", err)
		}
		if got || status != "active" || name == "" {
			t.Fatalf("仅 is_public 应变化: isPublic=%v status=%s", got, status)
		}
	})

	t.Run("unlinked enterprise expert not found", func(t *testing.T) {
		// 企业未引入本校（无 link）的专家，不得被操作
		entB, expB := uuid.NewString(), uuid.NewString()
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name, enable_public) VALUES ($1,$2,$3,true)`,
			entB, tenantID, "未引入企业-"+entB[:8]); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, is_public) VALUES ($1,$2,$3,$4,'active',true)`,
			expB, tenantID, "未引入企业专家", entB); err != nil {
			t.Fatalf("预置专家失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, expB)
		defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entB)

		w := doWithClaims(r, http.MethodPut, "/alliance/experts/"+expB+"/display", map[string]bool{"isPublic": false}, teacher)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("nonexistent expert not found", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/alliance/experts/"+uuid.NewString()+"/display", map[string]bool{"isPublic": true}, teacher)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPublicExperts_IncludeNonPublic 前台专家列表 includeNonPublic：
// 默认仅返回 is_public=true；includeNonPublic=true 时返回同企业未上首页专家
// （企业 enable_public + link 双控仍生效），支撑企业详情页"专家团队"展示不受开关影响。
func TestPublicExperts_IncludeNonPublic(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/public/experts", h.ListPublicExperts)

	expHidden, cleanup := setupExpertDisplayFixture(t, env, ctx, false)
	defer cleanup()
	expPublic, cleanup2 := setupExpertDisplayFixture(t, env, ctx, true)
	defer cleanup2()

	contains := func(body []byte, id string) bool {
		var resp struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		for _, it := range resp.Items {
			if it.ID == id {
				return true
			}
		}
		return false
	}

	t.Run("default excludes non-public expert", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/experts?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if contains(w.Body.Bytes(), expHidden) {
			t.Fatalf("默认不应返回未开启前台展示的专家: %s", w.Body.String())
		}
		if !contains(w.Body.Bytes(), expPublic) {
			t.Fatalf("应返回已开启前台展示的专家: %s", w.Body.String())
		}
	})

	t.Run("includeNonPublic returns hidden expert", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/experts?tenantId="+testhelper.TestTenantID+"&includeNonPublic=true", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if !contains(w.Body.Bytes(), expHidden) || !contains(w.Body.Bytes(), expPublic) {
			t.Fatalf("includeNonPublic=true 应返回全部专家: %s", w.Body.String())
		}
	})
}
