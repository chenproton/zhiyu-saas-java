package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
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

// doAlliance 直接调用 alliance handler 方法（绕过路由层，验证 handler 内部权限检查）。
func doAlliance(h *handler.AllianceHandler, method, path string, body interface{}, claims *middleware.Claims) *httptest.ResponseRecorder {
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
	switch method {
	case http.MethodPost:
		h.CreateEnterprise(w, req)
	case http.MethodGet:
		h.ListEnterprises(w, req)
	default:
		http.Error(w, "unsupported", http.StatusInternalServerError)
	}
	return w
}

// TestAlliance_BusinessRolePermission 产教融合模块面向业务角色（教师/企业导师）开放，
// 学生仍被拒绝；与 school_admin 行为一致。
func TestAlliance_BusinessRolePermission(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := &handler.AllianceHandler{Store: store.New(env.DB).Alliance()}

	t.Run("teacher list ok", func(t *testing.T) {
		w := doAlliance(h, http.MethodGet, "/api/v1/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("teacher create ok", func(t *testing.T) {
		w := doAlliance(h, http.MethodPost, "/api/v1/alliance/enterprises", map[string]interface{}{
			"name": "教师创建的合作企业",
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher))
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var ent domain.AllianceEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &ent); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		defer env.DB.Exec(context.Background(), "DELETE FROM alliance_enterprises WHERE id = $1", ent.ID)
	})

	t.Run("enterprise mentor list ok", func(t *testing.T) {
		w := doAlliance(h, http.MethodGet, "/api/v1/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12", domain.RoleEnterpriseMentor))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student forbidden", func(t *testing.T) {
		w := doAlliance(h, http.MethodGet, "/api/v1/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student create forbidden", func(t *testing.T) {
		w := doAlliance(h, http.MethodPost, "/api/v1/alliance/enterprises", map[string]interface{}{
			"name": "学生创建的合作企业",
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestAllianceProject_PartialUpdatePreservesFields 列表页“前台展示”开关仅携带 {isPublic} 部分更新，
// 其余字段必须回退到已存在记录，禁止 PUT 全列覆盖清空数据（回归 bug：合作项目数据丢失）。
func TestAllianceProject_PartialUpdatePreservesFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := &handler.AllianceHandler{Store: store.New(env.DB).Alliance()}
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
func TestAllianceImport_TeacherPermission(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := &handler.ResourceImportHandler{DB: env.DB}
	file := buildExcel(t, "合作企业", [][]interface{}{
		{"填写说明"},
		{"企业名称 *", "企业类型", "所属行业", "所在地区", "合作状态", "合作评级", "联系人", "联系电话", "联系邮箱", "企业地址", "统一社会信用代码", "成立年份", "企业规模（人数）", "企业简介"},
		{"导入教师企业", "合作企业", "智能制造", "苏州市", "合作中", "战略合作", "张伟", "13800000000", "a@example.com", "苏州市工业园区", "91320594MA1P7ABC1X", "2015", "1200", "测试企业简介"},
	})
	defer env.DB.Exec(context.Background(), "DELETE FROM alliance_enterprises WHERE tenant_id=$1 AND name='导入教师企业'", testhelper.TestTenantID)

	t.Run("teacher import ok", func(t *testing.T) {
		w := httptest.NewRecorder()
		h.ImportEnterprises(w, makeRequest(t, "/import/alliance-enterprises/excel", file, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)))
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student import forbidden", func(t *testing.T) {
		w := httptest.NewRecorder()
		h.ImportEnterprises(w, makeRequest(t, "/import/alliance-enterprises/excel", file, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent)))
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
