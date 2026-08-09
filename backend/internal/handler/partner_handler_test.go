package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

// cleanupPartnerTenant 清理注册测试产生的企业租户数据。
func cleanupPartnerTenant(env *testhelper.TestEnv, tenantID string) {
	ctx := context.Background()
	env.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM roles WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, tenantID)
}

// newPartnerAuthHandler 构造注入 PartnerService 的认证 handler。
func newPartnerAuthHandler(env *testhelper.TestEnv) *handler.AuthHandler {
	st := store.New(env.DB)
	svc := service.New(st)
	authH := handler.NewAuthHandler(service.NewAuthService(svc), testhelper.TestJWTSecret)
	authH.PartnerService = service.NewPartnerService(svc)
	return authH
}

// doNoAuthJSON 无鉴权 JSON 请求（公开注册/登录接口）。
func doNoAuthJSON(r chi.Router, method, path string, body interface{}) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, strings.NewReader(string(b)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type partnerLoginResp struct {
	Token string      `json:"token"`
	User  domain.User `json:"user"`
}

// TestPartner_RegisterLoginMe 企业自助注册 → 登录 → me（含企业主体合并返回）。
func TestPartner_RegisterLoginMe(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	authH := newPartnerAuthHandler(env)
	r := chi.NewRouter()
	r.Post("/auth/partner/register", authH.PartnerRegister)
	r.Post("/auth/partner/login", authH.PartnerLogin)
	r.Get("/auth/partner/me", authH.PartnerMe)

	suffix := uuid.NewString()[:8]
	enterpriseName := "注册测试企业-" + suffix
	username := "partner_reg_" + suffix
	password := "abc12345"

	var tenantID, userID string

	t.Run("register ok", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
			"enterpriseName": enterpriseName,
			"username":       username,
			"password":       password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp partnerLoginResp
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if resp.Token == "" {
			t.Fatalf("注册后应直接签发 token")
		}
		if resp.User.Platform != domain.UserPlatformPartner {
			t.Fatalf("platform 应为 partner, got %s", resp.User.Platform)
		}
		if resp.User.TenantID == nil {
			t.Fatalf("注册用户应归属企业租户")
		}
		tenantID = *resp.User.TenantID
		userID = resp.User.ID
	})
	if tenantID == "" {
		t.Fatalf("注册失败，跳过后续用例")
	}
	defer cleanupPartnerTenant(env, tenantID)

	t.Run("register duplicate username conflict", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
			"enterpriseName": "另一家企业-" + suffix,
			"username":       username,
			"password":       password,
		})
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("register duplicate enterprise name conflict", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
			"enterpriseName": enterpriseName,
			"username":       "partner_other_" + suffix,
			"password":       password,
		})
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("login ok", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("login wrong password", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": "wrongpass1",
		})
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("me includes enterprise", func(t *testing.T) {
		claims := &middleware.Claims{
			UserID:   userID,
			TenantID: &tenantID,
			Platform: domain.UserPlatformPartner,
		}
		req := httptest.NewRequest(http.MethodGet, "/auth/partner/me", nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp struct {
			User       domain.User `json:"user"`
			Enterprise *struct {
				Name string `json:"name"`
			} `json:"enterprise"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if resp.Enterprise == nil || resp.Enterprise.Name != enterpriseName {
			t.Fatalf("me 应合并返回企业主体: %s", w.Body.String())
		}
	})

	t.Run("me rejects portal platform", func(t *testing.T) {
		claims := &middleware.Claims{
			UserID:   userID,
			TenantID: &tenantID,
			Platform: domain.UserPlatformPortal,
		}
		req := httptest.NewRequest(http.MethodGet, "/auth/partner/me", nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestAllianceEnterprise_SearchLinkUpdate 学校侧：企业池搜索（排除已引入）、
// link 管理字段更新（仅学校侧字段）、解除引入。
func TestAllianceEnterprise_SearchLinkUpdate(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/enterprises/search", h.SearchEnterprises)
	r.Get("/alliance/enterprises/{id}", h.GetEnterprise)
	r.Put("/alliance/enterprises/{id}", h.UpdateEnterprise)
	r.Delete("/alliance/enterprises/{id}", h.UnlinkEnterprise)

	ctx := context.Background()
	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)
	suffix := uuid.NewString()[:8]
	entA, entB := uuid.NewString(), uuid.NewString()
	nameA, nameB := "搜索测试企业甲-"+suffix, "搜索测试企业乙-"+suffix
	for _, e := range [][2]string{{entA, nameA}, {entB, nameB}} {
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`, e[0], testhelper.TestTenantID, e[1]); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, e[0])
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id) VALUES ($1,$2)`,
		testhelper.TestTenantID, entA); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id IN ($1,$2)`, entA, entB)

	t.Run("search excludes linked", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises/search?keyword=搜索测试企业", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[domain.AllianceEnterprise](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		var foundA, foundB bool
		for _, e := range items {
			if e.ID == entA {
				foundA = true
			}
			if e.ID == entB {
				foundB = true
			}
		}
		if foundA {
			t.Fatalf("已引入企业不应出现在搜索结果")
		}
		if !foundB {
			t.Fatalf("未引入企业应出现在搜索结果: %s", w.Body.String())
		}
	})

	t.Run("update link school fields only", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/alliance/enterprises/"+entA, map[string]interface{}{
			"status":   "active",
			"rating":   "strategic",
			"isPublic": true,
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var item domain.AllianceLinkedEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &item); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if item.Status != "active" || item.Rating == nil || *item.Rating != "strategic" || !item.IsPublic {
			t.Fatalf("link 字段更新未生效: %+v", item)
		}
		if item.Name != nameA {
			t.Fatalf("合并视图应包含主体信息: %+v", item)
		}
	})

	t.Run("update unlinked enterprise not found", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/alliance/enterprises/"+entB, map[string]interface{}{
			"status": "active",
		}, claims)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unlink then get 404", func(t *testing.T) {
		w := doWithClaims(r, http.MethodDelete, "/alliance/enterprises/"+entA, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		w = doWithClaims(r, http.MethodGet, "/alliance/enterprises/"+entA, nil, claims)
		if w.Code != http.StatusNotFound {
			t.Fatalf("解除引入后详情应 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPartner_ListMembers 成员列表回归：Users().ListConfig 不含 ScanRows，
// handler 必须走 UserStore.List（曾误用 executeListQuery 导致 500 scanRows not configured）。
func TestPartner_ListMembers(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	// 注册企业，造出企业租户 + 管理员账号
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": "成员列表测试企业-" + suffix,
		"username":       "partner_mem_" + suffix,
		"password":       "abc12345",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("注册失败: %d: %s", w.Code, w.Body.String())
	}
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	tenantID := *reg.User.TenantID
	defer cleanupPartnerTenant(env, tenantID)

	svc := service.New(store.New(env.DB))
	ph := &handler.PartnerHandler{Service: service.NewPartnerService(svc)}
	r := chi.NewRouter()
	r.Get("/partner/members", ph.ListMembers)

	claims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &tenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseAdmin},
	}
	req := httptest.NewRequest(http.MethodGet, "/partner/members", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	items, total, err := testhelper.UnmarshalList[domain.User](rec)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if total < 1 || len(items) == 0 || items[0].ID != reg.User.ID {
		t.Fatalf("成员列表应包含注册的管理员账号: total=%d body=%s", total, rec.Body.String())
	}
}
