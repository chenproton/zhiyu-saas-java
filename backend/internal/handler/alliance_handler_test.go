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
	"github.com/zhiyu-saas/backend/internal/store"
)

// claimsWithRoles 构造指定角色 codes 的 claims（无系统菜单权限）。
func claimsWithRoles(userID string, roleCodes ...string) *middleware.Claims {
	tenantID := testhelper.TestTenantID
	return &middleware.Claims{
		UserID:    userID,
		TenantID:  &tenantID,
		RoleCodes: roleCodes,
	}
}

// newAllianceTestHandler 构造带 link store 的 alliance handler。
func newAllianceTestHandler(env *testhelper.TestEnv) *handler.AllianceHandler {
	st := store.New(env.DB)
	return &handler.AllianceHandler{Store: st.Alliance(), Links: st.AllianceEnterpriseLinks()}
}

// doWithClaims 用指定 claims 请求路由（绕过 JWT 中间件，验证 handler 内部权限检查）。
func doWithClaims(r chi.Router, method, path string, body interface{}, claims *middleware.Claims) *httptest.ResponseRecorder {
	var reqBody *strings.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = strings.NewReader(string(b))
	} else {
		reqBody = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reqBody)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// TestAlliance_BusinessRolePermission 产教融合模块面向业务角色（教师/企业导师）开放，
// 学生仍被拒绝；与 school_admin 行为一致。
// Partner 改造后：学校侧企业接口为「已引入列表（link 视图）+ 引入（link）」，不再创建企业主体。
func TestAlliance_BusinessRolePermission(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/enterprises", h.ListEnterprises)
	r.Post("/alliance/enterprises/{id}/link", h.LinkEnterprise)

	ctx := context.Background()

	t.Run("teacher list ok", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("teacher link ok", func(t *testing.T) {
		// 预置企业主体（Partner 平台维护的全局实体）
		entID := uuid.NewString()
		entName := "教师引入测试企业-" + entID[:8]
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
			entID, testhelper.TestTenantID, entName); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
		defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, entID)

		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/"+entID+"/link", map[string]interface{}{}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher))
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("enterprise mentor list ok", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12", domain.RoleEnterpriseMentor))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student link forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/"+uuid.NewString()+"/link", map[string]interface{}{}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestAllianceExperts_CrossTenantReadOnly 学校侧专家接口跨租户只读：
// 仅可见已引入企业的专家；enterpriseId 越权（未引入企业）返回 403。
func TestAllianceExperts_CrossTenantReadOnly(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/experts", h.ListExperts)
	r.Get("/alliance/experts/{id}", h.GetExpert)

	ctx := context.Background()
	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	// 企业 A（本校已引入，含 1 名专家）、企业 B（未引入，含 1 名专家）
	entA, entB := uuid.NewString(), uuid.NewString()
	expA, expB := uuid.NewString(), uuid.NewString()
	for _, e := range [][2]string{{entA, "越权测试企业A-" + entA[:8]}, {entB, "越权测试企业B-" + entB[:8]}} {
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`, e[0], testhelper.TestTenantID, e[1]); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, e[0])
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status) VALUES ($1,$2,$3,$4,'active')`,
		expA, testhelper.TestTenantID, "越权测试专家A", entA); err != nil {
		t.Fatalf("预置专家A失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status) VALUES ($1,$2,$3,$4,'active')`,
		expB, testhelper.TestTenantID, "越权测试专家B", entB); err != nil {
		t.Fatalf("预置专家B失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id IN ($1,$2)`, expA, expB)
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id) VALUES ($1,$2)`,
		testhelper.TestTenantID, entA); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, entA)

	t.Run("list returns only linked enterprise experts", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[domain.AllianceExpert](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		for _, e := range items {
			if e.ID == expB {
				t.Fatalf("未引入企业的专家不应可见: %+v", e)
			}
		}
	})

	t.Run("filter by linked enterprise ok", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts?enterpriseId="+entA, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("filter by unlinked enterprise forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts?enterpriseId="+entB, nil, claims)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get linked expert ok", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts/"+expA, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get unlinked expert not found", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts/"+expB, nil, claims)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestAllianceProject_PartialUpdatePreservesFields 列表页“前台展示”开关仅携带 {isPublic} 部分更新，
// 其余字段必须回退到已存在记录，禁止 PUT 全列覆盖清空数据（回归 bug：合作项目数据丢失）。
func TestAllianceProject_PartialUpdatePreservesFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Post("/alliance/projects", h.CreateProject)
	r.Put("/alliance/projects/{id}", h.UpdateProject)
	r.Get("/alliance/projects/{id}", h.GetProject)

	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21", domain.RoleTeacher)
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		var reqBody *strings.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			reqBody = strings.NewReader(string(b))
		} else {
			reqBody = strings.NewReader("")
		}
		req := httptest.NewRequest(method, path, reqBody)
		req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	desc := "联合共建测试项目描述"
	typ := "联合研发"
	budget := "300万"
	entID := "3a253303-0770-4541-9e87-608e853caddd"
	create := do(http.MethodPost, "/alliance/projects", map[string]interface{}{
		"name":          "部分更新测试项目",
		"type":          typ,
		"description":   desc,
		"phase":         "execution",
		"publishStatus": "draft",
		"budget":        budget,
		"enterpriseIds": []string{entID},
	})
	if create.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", create.Code, create.Body.String())
	}
	var proj domain.AllianceProject
	if err := json.Unmarshal(create.Body.Bytes(), &proj); err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(context.Background(), "DELETE FROM alliance_projects WHERE id = $1", proj.ID)

	upd := do(http.MethodPut, "/alliance/projects/"+proj.ID, map[string]interface{}{"isPublic": true})
	if upd.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d: %s", upd.Code, upd.Body.String())
	}

	got := do(http.MethodGet, "/alliance/projects/"+proj.ID, nil)
	if got.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d: %s", got.Code, got.Body.String())
	}
	var after domain.AllianceProject
	if err := json.Unmarshal(got.Body.Bytes(), &after); err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}

	if after.Name != "部分更新测试项目" || after.Phase != "execution" || after.PublishStatus != "draft" {
		t.Fatalf("字符串字段被部分更新清空: %+v", after)
	}
	if after.Type == nil || *after.Type != typ {
		t.Fatalf("type 被清空: %+v", after.Type)
	}
	if after.Description == nil || *after.Description != desc {
		t.Fatalf("description 被清空: %+v", after.Description)
	}
	if after.Budget == nil || *after.Budget != budget {
		t.Fatalf("budget 被清空: %+v", after.Budget)
	}
	if len(after.EnterpriseIDs) == 0 || string(after.EnterpriseIDs) != `["`+entID+`"]` {
		t.Fatalf("enterpriseIds 被清空: %s", string(after.EnterpriseIDs))
	}
	if !after.IsPublic {
		t.Fatalf("isPublic 未生效: %+v", after.IsPublic)
	}
}

// TestAllianceImport_TeacherPermission 教师可执行 alliance-* 导入（与 alliance 模块权限一致），
// 学生仍被拒绝；组织架构等基础数据导入仍限系统管理员。
// 企业/专家导入已随 Partner 平台改造移除，此处以项目导入验证 alliance-* 权限规则。
func TestAllianceImport_TeacherPermission(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := &handler.ResourceImportHandler{Store: env.Store}
	file := buildExcel(t, "合作项目", [][]interface{}{
		{"填写说明"},
		{"项目名称 *", "项目类型", "项目阶段", "开始日期", "结束日期", "描述", "预算", "关联合作企业"},
		{"导入教师项目", "联合研发", "执行中", "2026-01-15", "2027-06-30", "项目描述", "300万", ""},
	})
	defer env.DB.Exec(context.Background(), "DELETE FROM alliance_projects WHERE tenant_id=$1 AND name='导入教师项目'", testhelper.TestTenantID)

	t.Run("teacher import ok", func(t *testing.T) {
		w := httptest.NewRecorder()
		h.ImportProjects(w, makeRequest(t, "/import/alliance-projects/excel", file, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student import forbidden", func(t *testing.T) {
		w := httptest.NewRecorder()
		h.ImportProjects(w, makeRequest(t, "/import/alliance-projects/excel", file, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent)))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("teacher org import forbidden", func(t *testing.T) {
		w := httptest.NewRecorder()
		h.ImportOrganizations(w, makeRequest(t, "/import/organizations/excel", file, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}
