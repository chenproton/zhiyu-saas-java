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
func TestPartner_RegisterEnterpriseFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	authH := newPartnerAuthHandler(env)
	r := chi.NewRouter()
	r.Post("/auth/partner/register", authH.PartnerRegister)

	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName":          "注册字段测试企业-" + suffix,
		"username":                "partner_fld_" + suffix,
		"password":                "abc12345",
		"unifiedSocialCreditCode": "91330100MA00" + suffix[:6],
		"contactPerson":           "张测试",
		"contactPhone":            "13800000000",
		"contactEmail":            "test@example.com",
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

	var creditCode, person, phone, email *string
	var enablePublic bool
	if err := env.DB.QueryRow(context.Background(), `
		SELECT unified_social_credit_code, contact_person, contact_phone, contact_email, enable_public
		FROM partner_enterprises WHERE tenant_id = $1`, tenantID).
		Scan(&creditCode, &person, &phone, &email, &enablePublic); err != nil {
		t.Fatalf("查询企业主体失败: %v", err)
	}
	if !enablePublic {
		t.Fatal("注册企业默认应开启对外展示（enable_public=true）")
	}
	if creditCode == nil || *creditCode != "91330100MA00"+suffix[:6] {
		t.Fatalf("统一社会信用代码未落库: %v", creditCode)
	}
	if person == nil || *person != "张测试" {
		t.Fatalf("联系人未落库: %v", person)
	}
	if phone == nil || *phone != "13800000000" {
		t.Fatalf("联系电话未落库: %v", phone)
	}
	if email == nil || *email != "test@example.com" {
		t.Fatalf("联系邮箱未落库: %v", email)
	}
}

// setupPartnerRouter 注册企业并构造注入 PartnerService 的路由（含专家/改密/学校状态等）。
func setupPartnerRouter(t *testing.T, env *testhelper.TestEnv, namePrefix string) (chi.Router, *middleware.Claims, partnerLoginResp) {
	t.Helper()
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": namePrefix + "-" + suffix,
		"username":       "partner_t_" + suffix,
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

	svc := service.New(store.New(env.DB))
	ph := &handler.PartnerHandler{Service: service.NewPartnerService(svc)}
	r := chi.NewRouter()
	r.Get("/partner/enterprise/profile", ph.GetProfile)
	r.Put("/partner/enterprise/profile", ph.UpdateProfile)
	r.Get("/partner/experts", ph.ListExperts)
	r.Post("/partner/experts", ph.CreateExpert)
	r.Put("/partner/experts/{id}", ph.UpdateExpert)
	r.Delete("/partner/experts/{id}", ph.DeleteExpert)
	r.Get("/partner/experts/me", ph.GetMyExpert)
	r.Put("/partner/experts/me", ph.UpdateMyExpert)
	r.Put("/partner/me/password", ph.ChangeMyPassword)
	r.Put("/partner/schools/{tenantId}/status", ph.UpdateSchoolStatus)
	r.Get("/partner/cooperation", ph.ListCooperation)
	r.Get("/partner/mentor-tasks", ph.ListMentorTasks)

	claims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &tenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseAdmin},
	}
	return r, claims, reg
}

func TestPartner_ChangeMyPassword(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "改密测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	t.Run("missing old password", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/me/password", map[string]interface{}{
			"newPassword": "newpass456",
		}, claims)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("wrong old password", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/me/password", map[string]interface{}{
			"oldPassword": "wrong-old-pw",
			"newPassword": "newpass456",
		}, claims)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("correct old password then login with new", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/me/password", map[string]interface{}{
			"oldPassword": "abc12345",
			"newPassword": "newpass456",
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		authH := newPartnerAuthHandler(env)
		r0 := chi.NewRouter()
		r0.Post("/auth/partner/login", authH.PartnerLogin)
		w = doNoAuthJSON(r0, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": reg.User.Username,
			"password": "newpass456",
		})
		if w.Code != http.StatusOK {
			t.Fatalf("新密码登录应成功, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPartner_UpdateProfilePreserves 企业资料 PUT 擦除回归：未携带
// coverPhotos/cooperationTypes/enablePublic 时应保留原值（曾全列覆盖成 '[]'/false）。
func TestPartner_UpdateProfilePreserves(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	r, claims, reg := setupPartnerRouter(t, env, "资料兜底测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	w := doWithClaims(r, http.MethodPut, "/partner/enterprise/profile", map[string]interface{}{
		"name":                    "资料兜底测试企业",
		"cooperationTypes":        []string{"cooperation"},
		"coverPhotos":             []string{"https://example.com/cover.png"},
		"enablePublic":            true,
		"unifiedSocialCreditCode": "91330100TEST0001",
		"industry":                "信息技术",
		"contactPerson":           "陈云龙",
	}, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("预置资料失败: %d: %s", w.Code, w.Body.String())
	}

	t.Run("omitted fields preserved", func(t *testing.T) {
		// 模拟前端表单只提交基础信息，不携带这三个字段
		w := doWithClaims(r, http.MethodPut, "/partner/enterprise/profile", map[string]interface{}{
			"name":        "资料兜底测试企业",
			"description": "只改简介",
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var ent domain.AllianceEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &ent); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if !ent.EnablePublic {
			t.Fatalf("enablePublic 未携带时应保留 true: %s", w.Body.String())
		}
		if string(ent.CooperationTypes) != `["cooperation"]` {
			t.Fatalf("cooperationTypes 未携带时应保留原值: %s", string(ent.CooperationTypes))
		}
		if string(ent.CoverPhotos) != `["https://example.com/cover.png"]` {
			t.Fatalf("coverPhotos 未携带时应保留原值: %s", string(ent.CoverPhotos))
		}
	})

	t.Run("explicit false applies", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/enterprise/profile", map[string]interface{}{
			"name":         "资料兜底测试企业",
			"enablePublic": false,
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var ent domain.AllianceEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &ent); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ent.EnablePublic {
			t.Fatalf("显式传 false 应生效: %s", w.Body.String())
		}
	})

	t.Run("toggle-only preserves all profile fields", func(t *testing.T) {
		// 模拟顶部展示开关切换：仅携带 enablePublic，其余字段必须全部保留
		w := doWithClaims(r, http.MethodPut, "/partner/enterprise/profile", map[string]interface{}{
			"enablePublic": true,
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var ent domain.AllianceEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &ent); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if !ent.EnablePublic {
			t.Fatalf("enablePublic 应变为 true: %s", w.Body.String())
		}
		if ent.UnifiedSocialCreditCode == nil || *ent.UnifiedSocialCreditCode != "91330100TEST0001" {
			t.Fatalf("信用代码未携带时应保留原值: %v", ent.UnifiedSocialCreditCode)
		}
		if ent.Industry == nil || *ent.Industry != "信息技术" {
			t.Fatalf("行业未携带时应保留原值: %v", ent.Industry)
		}
		if ent.ContactPerson == nil || *ent.ContactPerson != "陈云龙" {
			t.Fatalf("联系人未携带时应保留原值: %v", ent.ContactPerson)
		}
	})

	t.Run("name change syncs tenant name", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/enterprise/profile", map[string]interface{}{
			"name": "资料兜底测试企业-改名",
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var tenantName string
		if err := env.DB.QueryRow(ctx, `SELECT name FROM tenants WHERE id = $1`, *reg.User.TenantID).Scan(&tenantName); err != nil {
			t.Fatalf("query tenant: %v", err)
		}
		if tenantName != "资料兜底测试企业-改名" {
			t.Fatalf("企业端改名后 tenants.name 应同步: got %q", tenantName)
		}
	})
}

// TestPartner_UpdateExpertPreservesIsPublic 专家 isPublic 擦除回归：
// PUT 未携带 isPublic 时应保留原值（曾全列覆盖成 false）。
func TestPartner_UpdateExpertPreservesIsPublic(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "专家兜底测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	w := doWithClaims(r, http.MethodPost, "/partner/experts", map[string]interface{}{
		"name":     "专家甲",
		"isPublic": true,
		"username": "expert_a_" + suffix,
		"password": "abc12345",
	}, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("创建专家失败: %d: %s", w.Code, w.Body.String())
	}
	var createdResp struct {
		Expert domain.AllianceExpert `json:"expert"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &createdResp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	created := createdResp.Expert
	if created.IsPublic == nil || !*created.IsPublic {
		t.Fatalf("创建时 isPublic 应为 true: %s", w.Body.String())
	}

	t.Run("omitted isPublic preserved", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/experts/"+created.ID, map[string]interface{}{
			"name": "专家甲改",
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var updated domain.AllianceExpert
		if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if updated.IsPublic == nil || !*updated.IsPublic {
			t.Fatalf("isPublic 未携带时应保留 true: %s", w.Body.String())
		}
		if updated.Name != "专家甲改" {
			t.Fatalf("姓名更新未生效: %s", w.Body.String())
		}
	})

	t.Run("explicit false applies", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/experts/"+created.ID, map[string]interface{}{
			"isPublic": false,
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var updated domain.AllianceExpert
		if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if updated.IsPublic == nil || *updated.IsPublic {
			t.Fatalf("显式传 false 应生效: %s", w.Body.String())
		}
	})
}

// ===== 合作关系状态确认 / 合作内容视图 / 专家测评任务 =====

// partnerEnterpriseID 查询注册企业的全局主体 ID。
func partnerEnterpriseID(t *testing.T, env *testhelper.TestEnv, tenantID string) string {
	t.Helper()
	var id string
	if err := env.DB.QueryRow(context.Background(),
		`SELECT id FROM partner_enterprises WHERE tenant_id = $1`, tenantID).Scan(&id); err != nil {
		t.Fatalf("查询企业主体失败: %v", err)
	}
	return id
}

// createSchoolTenant 创建隔离的学校租户，返回租户 ID。
func createSchoolTenant(t *testing.T, env *testhelper.TestEnv, name string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := env.DB.Exec(context.Background(),
		`INSERT INTO tenants (id, name, code, status) VALUES ($1, $2, $3, 'active')`,
		id, name, "sch-"+strings.ReplaceAll(id, "-", "")[:12]); err != nil {
		t.Fatalf("创建学校租户失败: %v", err)
	}
	return id
}

// linkSchoolEnterprise 创建学校↔企业合作 link 并登记清理。
func linkSchoolEnterprise(t *testing.T, env *testhelper.TestEnv, schoolTenantID, enterpriseID, status string) {
	t.Helper()
	ctx := context.Background()
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, status) VALUES ($1, $2, $3)`,
		schoolTenantID, enterpriseID, status); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = $2`, schoolTenantID, enterpriseID)
		env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, schoolTenantID)
	})
}

// TestPartner_UpdateSchoolStatus 合作状态确认：合法流转成功、非法流转 400、他校 tenantId 404。
func TestPartner_UpdateSchoolStatus(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "状态确认测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)
	enterpriseID := partnerEnterpriseID(t, env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "状态确认学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "negotiating")

	// 他校：存在租户但与本企业无 link
	otherSchoolID := createSchoolTenant(t, env, "无关联学校-"+suffix)
	t.Cleanup(func() {
		env.DB.Exec(context.Background(), `DELETE FROM tenants WHERE id = $1`, otherSchoolID)
	})

	put := func(school, status string) *httptest.ResponseRecorder {
		return doWithClaims(r, http.MethodPut, "/partner/schools/"+school+"/status",
			map[string]interface{}{"status": status}, claims)
	}

	t.Run("confirm negotiating to active", func(t *testing.T) {
		w := put(schoolID, "active")
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var view domain.AlliancePartnerSchool
		if err := json.Unmarshal(w.Body.Bytes(), &view); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if view.Status != "active" || view.TenantID != schoolID || view.SchoolName != "状态确认学校-"+suffix {
			t.Fatalf("响应应为更新后的合作学校视图: %+v", view)
		}
	})

	t.Run("same status rejected", func(t *testing.T) {
		if w := put(schoolID, "active"); w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("pause then resume", func(t *testing.T) {
		if w := put(schoolID, "paused"); w.Code != http.StatusOK {
			t.Fatalf("active→paused 应成功, got %d: %s", w.Code, w.Body.String())
		}
		if w := put(schoolID, "active"); w.Code != http.StatusOK {
			t.Fatalf("paused→active 应成功, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("paused cannot go back to negotiating", func(t *testing.T) {
		if w := put(schoolID, "negotiating"); w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("terminate then terminated is final", func(t *testing.T) {
		if w := put(schoolID, "terminated"); w.Code != http.StatusOK {
			t.Fatalf("active→terminated 应成功, got %d: %s", w.Code, w.Body.String())
		}
		if w := put(schoolID, "active"); w.Code != http.StatusBadRequest {
			t.Fatalf("terminated 为终态应 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown status rejected", func(t *testing.T) {
		if w := put(schoolID, "unknown"); w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("other school not found", func(t *testing.T) {
		if w := put(otherSchoolID, "active"); w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPartner_Cooperation 合作内容只读视图：enterprise_ids 含/不含本企业的过滤 + 终止 link 排除。
func TestPartner_Cooperation(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "合作内容测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)
	enterpriseID := partnerEnterpriseID(t, env, *reg.User.TenantID)

	ctx := context.Background()
	suffix := uuid.NewString()[:8]
	schoolA := createSchoolTenant(t, env, "合作内容学校甲-"+suffix)
	linkSchoolEnterprise(t, env, schoolA, enterpriseID, "active")
	schoolB := createSchoolTenant(t, env, "合作内容学校乙-"+suffix)
	linkSchoolEnterprise(t, env, schoolB, enterpriseID, "terminated")

	otherEnt := uuid.NewString()
	entJSON := `["` + enterpriseID + `"]`
	otherJSON := `["` + otherEnt + `"]`

	projIn, projOut := uuid.NewString(), uuid.NewString()
	achIn, achOut := uuid.NewString(), uuid.NewString()
	agrIn, agrOut := uuid.NewString(), uuid.NewString()
	projB := uuid.NewString()

	inserts := []struct {
		query string
		args  []interface{}
	}{
		{`INSERT INTO alliance_projects (id, tenant_id, name, phase, enterprise_ids, is_public) VALUES ($1,$2,$3,'execution',$4::jsonb,true)`,
			[]interface{}{projIn, schoolA, "关联项目-" + suffix, entJSON}},
		{`INSERT INTO alliance_projects (id, tenant_id, name, phase, enterprise_ids) VALUES ($1,$2,$3,'execution',$4::jsonb)`,
			[]interface{}{projOut, schoolA, "无关项目-" + suffix, otherJSON}},
		{`INSERT INTO alliance_achievements (id, tenant_id, title, type, enterprise_ids, is_public) VALUES ($1,$2,$3,'patent',$4::jsonb,true)`,
			[]interface{}{achIn, schoolA, "关联成果-" + suffix, entJSON}},
		{`INSERT INTO alliance_achievements (id, tenant_id, title, type, enterprise_ids) VALUES ($1,$2,$3,'patent',$4::jsonb)`,
			[]interface{}{achOut, schoolA, "无关成果-" + suffix, otherJSON}},
		{`INSERT INTO alliance_agreements (id, tenant_id, name, type, status, enterprise_ids, is_public) VALUES ($1,$2,$3,'framework','active',$4::jsonb,true)`,
			[]interface{}{agrIn, schoolA, "关联协议-" + suffix, entJSON}},
		{`INSERT INTO alliance_agreements (id, tenant_id, name, type, status, enterprise_ids) VALUES ($1,$2,$3,'framework','active',$4::jsonb)`,
			[]interface{}{agrOut, schoolA, "无关协议-" + suffix, otherJSON}},
		// 终止 link 的学校：即使 enterprise_ids 含本企业也应被排除
		{`INSERT INTO alliance_projects (id, tenant_id, name, phase, enterprise_ids) VALUES ($1,$2,$3,'execution',$4::jsonb)`,
			[]interface{}{projB, schoolB, "终止校项目-" + suffix, entJSON}},
	}
	for _, in := range inserts {
		if _, err := env.DB.Exec(ctx, in.query, in.args...); err != nil {
			t.Fatalf("预置合作内容失败: %v", err)
		}
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_projects WHERE id IN ($1,$2,$3)`, projIn, projOut, projB)
		env.DB.Exec(ctx, `DELETE FROM alliance_achievements WHERE id IN ($1,$2)`, achIn, achOut)
		env.DB.Exec(ctx, `DELETE FROM alliance_agreements WHERE id IN ($1,$2)`, agrIn, agrOut)
	})

	w := doWithClaims(r, http.MethodGet, "/partner/cooperation", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Schools []domain.AlliancePartnerCooperationSchool `json:"schools"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Schools) != 1 {
		t.Fatalf("只有学校甲应返回（乙已终止且甲的无关内容不应带出）: %s", w.Body.String())
	}
	sc := resp.Schools[0]
	if sc.TenantID != schoolA || sc.SchoolName != "合作内容学校甲-"+suffix {
		t.Fatalf("学校视图字段不符: %+v", sc)
	}
	if len(sc.Projects) != 1 || sc.Projects[0].ID != projIn || !sc.Projects[0].IsPublic {
		t.Fatalf("项目过滤不符（应只含 enterprise_ids 含本企业的）: %+v", sc.Projects)
	}
	if len(sc.Achievements) != 1 || sc.Achievements[0].ID != achIn {
		t.Fatalf("成果过滤不符: %+v", sc.Achievements)
	}
	if len(sc.Agreements) != 1 || sc.Agreements[0].ID != agrIn || sc.Agreements[0].Status != "active" {
		t.Fatalf("协议过滤不符: %+v", sc.Agreements)
	}
}

// TestPartner_MentorTasks 专家测评任务只读列表：本企业专家账号被指派的评审步骤返回，
// 他企业专家/禁用步骤被排除。
func TestPartner_MentorTasks(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "测评任务测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)
	enterpriseID := partnerEnterpriseID(t, env, *reg.User.TenantID)

	ctx := context.Background()
	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "测评任务学校-"+suffix)
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, schoolID)
	})

	// 本企业专家 + 他企业专家（对照组；主体 tenant_id 与 experts.enterprise_id 均有 FK）
	expertID, otherExpertID := uuid.NewString(), uuid.NewString()
	otherEnterpriseID := uuid.NewString()
	otherEntTenant := createSchoolTenant(t, env, "他企租户-"+suffix)
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, otherEntTenant)
	})
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		otherEnterpriseID, otherEntTenant, "他企主体-"+suffix); err != nil {
		t.Fatalf("预置他企主体失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, otherEnterpriseID)
	})
	// 专家绑定账号（无 FK，模拟企业侧 partner 账号）；本企业专家已被步骤指派
	shadowUser, otherShadowUser := uuid.NewString(), uuid.NewString()

	if _, err := env.DB.Exec(ctx,
		`INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, user_id) VALUES ($1,$2,$3,$4,'active',$5)`,
		expertID, *reg.User.TenantID, "测评专家甲-"+suffix, enterpriseID, shadowUser); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, user_id) VALUES ($1,$2,$3,$4,'active',$5)`,
		otherExpertID, otherEntTenant, "他企专家-"+suffix, otherEnterpriseID, otherShadowUser); err != nil {
		t.Fatalf("预置他企专家失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id IN ($1,$2)`, expertID, otherExpertID)
	})

	// 本企业 → 学校引入 link（ListMentorTasks 依赖 link 关联任务归属学校）
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id) VALUES ($1,$2)`,
		schoolID, enterpriseID); err != nil {
		t.Fatalf("预置引入 link 失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = $2`, schoolID, enterpriseID)
	})

	// 任务链：scenario → scenario_task → evaluation_method → review_steps
	scenarioID, taskID, emID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO scenarios (id, name, code, version, status, creator_id, tenant_id) VALUES ($1,$2,$3,'1.0','published',$4,$5)`,
		scenarioID, "测评场景-"+suffix, "scn-"+suffix, reg.User.ID, schoolID); err != nil {
		t.Fatalf("预置场景失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO scenario_tasks (id, scenario_id, name, code, task_type, tenant_id) VALUES ($1,$2,$3,$4,'normal',$5)`,
		taskID, scenarioID, "测评任务-"+suffix, "task-"+suffix, schoolID); err != nil {
		t.Fatalf("预置任务失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, is_enabled) VALUES ($1,$2,$3,'review',true)`,
		emID, schoolID, taskID); err != nil {
		t.Fatalf("预置评价方式失败: %v", err)
	}

	stepID := uuid.NewString()
	disabledStepID := uuid.NewString()
	otherStepID := uuid.NewString()
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO task_review_steps (id, tenant_id, config_id, label, enabled, assigned_user_ids) VALUES ($1,$2,$3,$4,true,$5::uuid[])`,
		stepID, schoolID, emID, "企业导师评审-"+suffix, "{"+shadowUser+"}"); err != nil {
		t.Fatalf("预置评审步骤失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO task_review_steps (id, tenant_id, config_id, label, enabled, assigned_user_ids) VALUES ($1,$2,$3,$4,false,$5::uuid[])`,
		disabledStepID, schoolID, emID, "禁用步骤-"+suffix, "{"+shadowUser+"}"); err != nil {
		t.Fatalf("预置禁用步骤失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx,
		`INSERT INTO task_review_steps (id, tenant_id, config_id, label, enabled, assigned_user_ids) VALUES ($1,$2,$3,$4,true,$5::uuid[])`,
		otherStepID, schoolID, emID, "他企步骤-"+suffix, "{"+otherShadowUser+"}"); err != nil {
		t.Fatalf("预置他企步骤失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM task_review_steps WHERE id IN ($1,$2,$3)`, stepID, disabledStepID, otherStepID)
		env.DB.Exec(ctx, `DELETE FROM task_evaluation_methods WHERE id = $1`, emID)
		env.DB.Exec(ctx, `DELETE FROM scenario_tasks WHERE id = $1`, taskID)
		env.DB.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, scenarioID)
	})

	// 评分记录（scene_evaluation_results 的 evaluator/evaluatee 有 users FK，账号需真实 users 行）：
	// 本企业专家账号 2 条指派（1 条已评）；他企专家账号 1 条（同任务同校但 evaluator 不同，不应计入）
	for _, u := range []struct{ id, name string }{
		{shadowUser, "影子账号甲-" + suffix},
		{otherShadowUser, "他企影子账号-" + suffix},
	} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
			VALUES ($1,$2,'school','portal',$3,$4,'x',$5,'active','{}') ON CONFLICT (id) DO NOTHING
		`, u.id, schoolID, "em_"+u.id[:8], schoolID+"_em_"+u.id[:8], u.name); err != nil {
			t.Fatalf("预置影子账号 users 失败: %v", err)
		}
	}
	evaluatee1, evaluatee2 := uuid.NewString(), uuid.NewString()
	for _, id := range []string{evaluatee1, evaluatee2} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
			VALUES ($1,$2,'school','portal',$3,$4,'x','被评人','active','{}') ON CONFLICT (id) DO NOTHING
		`, id, schoolID, "ee_"+id[:8], schoolID+"_ee_"+id[:8]); err != nil {
			t.Fatalf("预置被评人失败: %v", err)
		}
	}
	evalIDs := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}
	seedEvals := []struct {
		id        string
		method    string
		evaluator string
		evaluatee string
		status    string
	}{
		{evalIDs[0], "review", shadowUser, evaluatee1, "evaluated"},
		{evalIDs[1], "review", shadowUser, evaluatee2, "pending"},
		{evalIDs[2], "self", otherShadowUser, evaluatee1, "evaluated"},
	}
	for _, e := range seedEvals {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO scene_evaluation_results (id, task_id, method_key, evaluatee_id, evaluator_id, status, tenant_id)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, e.id, taskID, e.method, e.evaluatee, e.evaluator, e.status, schoolID); err != nil {
			t.Fatalf("预置评分记录失败: %v", err)
		}
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM scene_evaluation_results WHERE id IN ($1,$2,$3)`, evalIDs[0], evalIDs[1], evalIDs[2])
		env.DB.Exec(ctx, `DELETE FROM users WHERE id IN ($1,$2,$3,$4)`, shadowUser, otherShadowUser, evaluatee1, evaluatee2)
	})

	w := doWithClaims(r, http.MethodGet, "/partner/mentor-tasks", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []domain.AlliancePartnerMentorTask `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("应只返回本企业专家的 1 条启用任务: %s", w.Body.String())
	}
	item := resp.Items[0]
	if item.TaskID != taskID || item.TaskName != "测评任务-"+suffix ||
		item.StepLabel != "企业导师评审-"+suffix || item.SchoolName != "测评任务学校-"+suffix ||
		item.ExpertName != "测评专家甲-"+suffix {
		t.Fatalf("任务条目字段不符: %+v", item)
	}
	if item.AssignedCount != 2 || item.GradedCount != 1 {
		t.Fatalf("评分进度应为 assignedCount=2 gradedCount=1（他企影子账号记录不计入）: %+v", item)
	}
}

// partnerLoginResp2 多租户登录响应（含企业候选）。
type partnerLoginResp2 struct {
	Token                string                 `json:"token"`
	NeedsTenantSelection bool                   `json:"needsTenantSelection"`
	PreAuthToken         string                 `json:"preAuthToken"`
	Tenants              []handler.TenantOption `json:"tenants"`
}

// TestPartner_MultiEnterpriseLogin 同一用户名可在多个企业注册：
// 登录返回企业候选列表，选择企业后签发对应租户 token，me 返回对应企业主体。
func TestPartner_MultiEnterpriseLogin(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	authH := newPartnerAuthHandler(env)
	r := chi.NewRouter()
	r.Post("/auth/partner/register", authH.PartnerRegister)
	r.Post("/auth/partner/login", authH.PartnerLogin)
	r.Post("/auth/select-tenant", authH.SelectTenant)
	r.With(middleware.JWT(testhelper.TestJWTSecret)).Get("/auth/partner/me", authH.PartnerMe)

	suffix := uuid.NewString()[:8]
	username := "multi_ent_" + suffix
	password := "abc12345"
	entAName := "多企业A-" + suffix
	entBName := "多企业B-" + suffix

	var tenantAID, tenantBID string
	defer func() {
		if tenantAID != "" {
			cleanupPartnerTenant(env, tenantAID)
		}
		if tenantBID != "" {
			cleanupPartnerTenant(env, tenantBID)
		}
	}()

	t.Run("register A then B with same username", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
			"enterpriseName": entAName,
			"username":       username,
			"password":       password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("register A: %d %s", w.Code, w.Body.String())
		}
		var resp partnerLoginResp
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal A: %v", err)
		}
		tenantAID = *resp.User.TenantID

		// 同用户名注册企业 B 应成功（不再全局唯一）
		w2 := doNoAuthJSON(r, http.MethodPost, "/auth/partner/register", map[string]interface{}{
			"enterpriseName": entBName,
			"username":       username,
			"password":       password,
		})
		if w2.Code != http.StatusOK {
			t.Fatalf("register B with same username: %d %s", w2.Code, w2.Body.String())
		}
		var resp2 partnerLoginResp
		if err := json.Unmarshal(w2.Body.Bytes(), &resp2); err != nil {
			t.Fatalf("unmarshal B: %v", err)
		}
		tenantBID = *resp2.User.TenantID
		if tenantAID == tenantBID {
			t.Fatalf("两个企业应创建不同租户")
		}
	})

	t.Run("login returns tenant selection", func(t *testing.T) {
		w := doNoAuthJSON(r, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("login: %d %s", w.Code, w.Body.String())
		}
		var resp partnerLoginResp2
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if !resp.NeedsTenantSelection || resp.PreAuthToken == "" {
			t.Fatalf("应返回企业选择: %s", w.Body.String())
		}
		if len(resp.Tenants) != 2 {
			t.Fatalf("应有 2 个企业候选, got %d", len(resp.Tenants))
		}
		names := map[string]bool{}
		for _, tn := range resp.Tenants {
			names[tn.TenantName] = true
		}
		if !names[entAName] || !names[entBName] {
			t.Fatalf("候选企业名不符: %+v", resp.Tenants)
		}
	})

	var preAuthToken string
	t.Run("select tenant A and me returns enterprise A", func(t *testing.T) {
		wl := doNoAuthJSON(r, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": password,
		})
		var lr partnerLoginResp2
		if err := json.Unmarshal(wl.Body.Bytes(), &lr); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		preAuthToken = lr.PreAuthToken

		ws := doNoAuthJSON(r, http.MethodPost, "/auth/select-tenant", map[string]interface{}{
			"preAuthToken": preAuthToken,
			"tenantId":     tenantAID,
		})
		if ws.Code != http.StatusOK {
			t.Fatalf("select A: %d %s", ws.Code, ws.Body.String())
		}
		var sr partnerLoginResp
		if err := json.Unmarshal(ws.Body.Bytes(), &sr); err != nil {
			t.Fatalf("unmarshal select: %v", err)
		}
		if sr.Token == "" {
			t.Fatalf("应签发 token")
		}
		// 用签发的 token 访问 me，应返回企业 A
		req := httptest.NewRequest(http.MethodGet, "/auth/partner/me", nil)
		req.Header.Set("Authorization", "Bearer "+sr.Token)
		wme := httptest.NewRecorder()
		r.ServeHTTP(wme, req)
		if wme.Code != http.StatusOK {
			t.Fatalf("me: %d %s", wme.Code, wme.Body.String())
		}
		var me struct {
			Tenant *struct {
				ID string `json:"id"`
			} `json:"tenant"`
			Enterprise *struct {
				Name string `json:"name"`
			} `json:"enterprise"`
		}
		if err := json.Unmarshal(wme.Body.Bytes(), &me); err != nil {
			t.Fatalf("unmarshal me: %v", err)
		}
		if me.Tenant == nil || me.Tenant.ID != tenantAID {
			t.Fatalf("me 应归属企业 A: %s", wme.Body.String())
		}
		if me.Enterprise == nil || me.Enterprise.Name != entAName {
			t.Fatalf("me 应返回企业 A 主体: %s", wme.Body.String())
		}
	})

	t.Run("select tenant B with new pre-auth token", func(t *testing.T) {
		wl := doNoAuthJSON(r, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": password,
		})
		var lr partnerLoginResp2
		if err := json.Unmarshal(wl.Body.Bytes(), &lr); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		ws := doNoAuthJSON(r, http.MethodPost, "/auth/select-tenant", map[string]interface{}{
			"preAuthToken": lr.PreAuthToken,
			"tenantId":     tenantBID,
		})
		if ws.Code != http.StatusOK {
			t.Fatalf("select B: %d %s", ws.Code, ws.Body.String())
		}
		var sr partnerLoginResp
		if err := json.Unmarshal(ws.Body.Bytes(), &sr); err != nil {
			t.Fatalf("unmarshal select: %v", err)
		}
		req := httptest.NewRequest(http.MethodGet, "/auth/partner/me", nil)
		req.Header.Set("Authorization", "Bearer "+sr.Token)
		wme := httptest.NewRecorder()
		r.ServeHTTP(wme, req)
		if wme.Code != http.StatusOK {
			t.Fatalf("me: %d %s", wme.Code, wme.Body.String())
		}
		var me struct {
			Tenant *struct {
				ID string `json:"id"`
			} `json:"tenant"`
			Enterprise *struct {
				Name string `json:"name"`
			} `json:"enterprise"`
		}
		if err := json.Unmarshal(wme.Body.Bytes(), &me); err != nil {
			t.Fatalf("unmarshal me: %v", err)
		}
		if me.Tenant == nil || me.Tenant.ID != tenantBID {
			t.Fatalf("me 应归属企业 B: %s", wme.Body.String())
		}
		if me.Enterprise == nil || me.Enterprise.Name != entBName {
			t.Fatalf("me 应返回企业 B 主体: %s", wme.Body.String())
		}
	})
}
