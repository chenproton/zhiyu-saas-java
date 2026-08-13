package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
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

// TestAlliance_BusinessRolePermission 产教融合模块面向业务角色（教师）开放，
// 学生被拒绝；B13 角色收窄后企业导师（enterprise_mentor）不再有联盟管理权限（403）。
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

	t.Run("enterprise mentor forbidden (B13 角色收窄)", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12", domain.RoleEnterpriseMentor))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
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
	if after.IsPublic == nil || !*after.IsPublic {
		t.Fatalf("isPublic 未生效: %+v", after.IsPublic)
	}
}

// TestAllianceProject_PartialUpdatePreservesPublicFlag 项目部分更新不携带 isPublic 时保留已有状态。

// TestAllianceBrand_PartialUpdatePreservesPublicFlag 品牌详情页保存局部内容（如专业特色课程 data）
// 不携带 isPublic/isFeatured/sortOrder 时，必须保留既有“前台展示/推荐/排序”状态，
// 禁止 PUT 全列覆盖把展示开关重置为 false（回归 bug：修改专业内容后前台展示被关闭）。
func TestAllianceBrand_PartialUpdatePreservesPublicFlag(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Post("/alliance/brands", h.CreateBrand)
	r.Put("/alliance/brands/{id}", h.UpdateBrand)
	r.Get("/alliance/brands/{id}", h.GetBrand)

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

	create := do(http.MethodPost, "/alliance/brands", map[string]interface{}{
		"name":       "部分更新测试专业品牌",
		"brandType":  "major",
		"isPublic":   true,
		"isFeatured": true,
		"sortOrder":  7,
		"data":       map[string]interface{}{"featuredCourses": []string{"a", "b"}},
	})
	if create.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", create.Code, create.Body.String())
	}
	var brand domain.AllianceBrand
	if err := json.Unmarshal(create.Body.Bytes(), &brand); err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(context.Background(), "DELETE FROM alliance_brands WHERE id = $1", brand.ID)

	// 模拟专业详情页保存专业内容：仅携带 data
	upd := do(http.MethodPut, "/alliance/brands/"+brand.ID, map[string]interface{}{
		"data": map[string]interface{}{"featuredCourses": []string{"a", "b", "c"}},
	})
	if upd.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d: %s", upd.Code, upd.Body.String())
	}

	got := do(http.MethodGet, "/alliance/brands/"+brand.ID, nil)
	if got.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d: %s", got.Code, got.Body.String())
	}
	var after domain.AllianceBrand
	if err := json.Unmarshal(got.Body.Bytes(), &after); err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if after.IsPublic == nil || !*after.IsPublic {
		t.Fatalf("isPublic 被部分更新重置: %+v", after.IsPublic)
	}
	if after.IsFeatured == nil || !*after.IsFeatured {
		t.Fatalf("isFeatured 被部分更新重置: %+v", after.IsFeatured)
	}
	if after.SortOrder != 7 {
		t.Fatalf("sortOrder 被部分更新重置: %d", after.SortOrder)
	}
	if string(after.Data) != `{"featuredCourses":["a","b","c"]}` {
		t.Fatalf("data 更新未生效: %s", string(after.Data))
	}

	// 显式携带 isPublic=false 仍可关闭展示开关（开关语义不受影响）
	off := do(http.MethodPut, "/alliance/brands/"+brand.ID, map[string]interface{}{"isPublic": false})
	if off.Code != http.StatusOK {
		t.Fatalf("update isPublic=false: expected 200, got %d: %s", off.Code, off.Body.String())
	}
	got2 := do(http.MethodGet, "/alliance/brands/"+brand.ID, nil)
	var after2 domain.AllianceBrand
	if err := json.Unmarshal(got2.Body.Bytes(), &after2); err != nil {
		t.Fatalf("unmarshal get2: %v", err)
	}
	if after2.IsPublic == nil || *after2.IsPublic {
		t.Fatalf("isPublic=false 未生效: %+v", after2.IsPublic)
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

// TestAlliance_LinkEnterpriseEmptyBody 引入企业空请求体回归：前端
// POST /alliance/enterprises/:id/link 不带请求体，decodeBody 曾对 io.EOF 返回 400。
func TestAlliance_LinkEnterpriseEmptyBody(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Post("/alliance/enterprises/{id}/link", h.LinkEnterprise)

	ctx := context.Background()
	eid := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		eid, testhelper.TestTenantID, "空体引入测试企业-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, eid)
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, eid)

	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	t.Run("empty body returns 201", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/"+eid+"/link", nil, claims)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("duplicate link conflict", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/"+eid+"/link", nil, claims)
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestAllianceEnterprises_Pagination 验证学校侧已引入企业列表支持分页、搜索、状态过滤，
// 并正确返回 total（Partner 改造后曾丢失分页导致 Total 恒为切片长度）。
func TestAllianceEnterprises_Pagination(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/enterprises", h.ListEnterprises)

	ctx := context.Background()
	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa31", domain.RoleTeacher)

	// 预置 3 个企业主体，并全部引入本校；其中 2 个为 active、1 个为 negotiating。
	entIDs := make([]string, 3)
	for i := 0; i < 3; i++ {
		id := uuid.NewString()
		entIDs[i] = id
		name := fmt.Sprintf("分页测试企业-%d-%s", i, id[:8])
		status := "active"
		if i == 2 {
			status = "negotiating"
		}
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`, id, testhelper.TestTenantID, name); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, id)
		if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, status) VALUES ($1,$2,$3)`, testhelper.TestTenantID, id, status); err != nil {
			t.Fatalf("预置 link 失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, id)
	}

	t.Run("limit/offset pagination", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises?limit=2&offset=0", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceLinkedEnterprise](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 3 {
			t.Fatalf("total = %d, want 3", total)
		}
		if len(items) != 2 {
			t.Fatalf("items len = %d, want 2", len(items))
		}
	})

	t.Run("search by name", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises?search=分页测试企业-0", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceLinkedEnterprise](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 {
			t.Fatalf("total = %d, want 1", total)
		}
		if len(items) != 1 {
			t.Fatalf("items len = %d, want 1", len(items))
		}
	})

	t.Run("filter by status", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/enterprises?status=negotiating", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceLinkedEnterprise](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 {
			t.Fatalf("total = %d, want 1", total)
		}
		if len(items) != 1 || items[0].Status != "negotiating" {
			t.Fatalf("status filter failed: %+v", items)
		}
	})
}

// TestAllianceExperts_Pagination 验证学校侧专家列表支持分页、搜索、状态过滤并正确返回 total。
func TestAllianceExperts_Pagination(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	h := newAllianceTestHandler(env)
	r := chi.NewRouter()
	r.Get("/alliance/experts", h.ListExperts)

	ctx := context.Background()
	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa32", domain.RoleTeacher)

	entID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`, entID, testhelper.TestTenantID, "专家分页测试企业"); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, status) VALUES ($1,$2,'active')`, testhelper.TestTenantID, entID); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, entID)

	expIDs := make([]string, 3)
	for i := 0; i < 3; i++ {
		id := uuid.NewString()
		expIDs[i] = id
		name := fmt.Sprintf("专家分页测试-%d", i)
		status := "active"
		if i == 2 {
			status = "inactive"
		}
		if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status) VALUES ($1,$2,$3,$4,$5)`, id, testhelper.TestTenantID, name, entID, status); err != nil {
			t.Fatalf("预置专家失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, id)
	}

	t.Run("limit/offset pagination", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts?limit=2&offset=0", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceExpert](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 3 {
			t.Fatalf("total = %d, want 3", total)
		}
		if len(items) != 2 {
			t.Fatalf("items len = %d, want 2", len(items))
		}
	})

	t.Run("search by name", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts?search=专家分页测试-0", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceExpert](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 {
			t.Fatalf("total = %d, want 1", total)
		}
		if len(items) != 1 {
			t.Fatalf("items len = %d, want 1", len(items))
		}
	})

	t.Run("filter by status", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts?status=inactive", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AllianceExpert](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 {
			t.Fatalf("total = %d, want 1", total)
		}
		if len(items) != 1 || items[0].Status != "inactive" {
			t.Fatalf("status filter failed: %+v", items)
		}
	})
}

// TestAlliance_RegisterEnterprise 学校代注册企业：创建企业租户+主体+管理员账号，
// 并直接建立本校-企业合作关联（status=active）。
func TestAlliance_RegisterEnterprise(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	h := &handler.AllianceHandler{Store: st.Alliance(), Links: st.AllianceEnterpriseLinks()}
	h.PartnerService = service.NewPartnerService(service.New(st))
	r := chi.NewRouter()
	r.Post("/alliance/enterprises/register", h.RegisterEnterprise)

	suffix := uuid.NewString()[:8]
	enterpriseName := "代注册企业-" + suffix
	username := "proxy_ent_" + suffix
	password := "abc12345"

	var tenantID, enterpriseID string

	t.Run("register ok with active link", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/register", map[string]interface{}{
			"enterpriseName":          enterpriseName,
			"username":                username,
			"password":                password,
			"unifiedSocialCreditCode": "91320594" + suffix + "1",
			"contactPerson":           "李四",
			"contactPhone":            "13900000000",
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21", domain.RoleTeacher))
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var item domain.AllianceLinkedEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &item); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		tenantID = item.TenantID
		enterpriseID = item.ID
		if item.Name != enterpriseName {
			t.Fatalf("expected name %s, got %s", enterpriseName, item.Name)
		}
		if item.Status != "active" {
			t.Fatalf("expected link status active, got %s", item.Status)
		}
		// 租户类型必须是企业租户
		var typ string
		if err := env.DB.QueryRow(ctx, "SELECT type FROM tenants WHERE id = $1", tenantID).Scan(&typ); err != nil {
			t.Fatalf("query tenant type: %v", err)
		}
		if typ != "enterprise" {
			t.Fatalf("expected enterprise tenant, got %s", typ)
		}
	})
	if tenantID == "" || enterpriseID == "" {
		t.Fatalf("代注册失败，跳过后续用例")
	}
	defer cleanupPartnerTenant(env, tenantID)
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, enterpriseID)

	t.Run("link is associated to current school", func(t *testing.T) {
		var linkCount int
		if err := env.DB.QueryRow(ctx,
			"SELECT COUNT(*) FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = $2",
			testhelper.TestTenantID, enterpriseID).Scan(&linkCount); err != nil {
			t.Fatalf("count links: %v", err)
		}
		if linkCount != 1 {
			t.Fatalf("expected 1 link to current school, got %d", linkCount)
		}
	})

	t.Run("created admin can login on partner platform", func(t *testing.T) {
		authH := newPartnerAuthHandler(env)
		r2 := chi.NewRouter()
		r2.Post("/auth/partner/login", authH.PartnerLogin)
		w := doNoAuthJSON(r2, http.MethodPost, "/auth/partner/login", map[string]interface{}{
			"username": username,
			"password": password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("same username in another enterprise ok", func(t *testing.T) {
		// 跨企业同名用户名允许（同一个人多个企业），代注册成功并建立 link
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/register", map[string]interface{}{
			"enterpriseName": "另一家代注册企业-" + suffix,
			"username":       username,
			"password":       password,
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21", domain.RoleTeacher))
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var item domain.AllianceLinkedEnterprise
		if err := json.Unmarshal(w.Body.Bytes(), &item); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		defer cleanupPartnerTenant(env, item.TenantID)
		defer env.DB.Exec(context.Background(), `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1`, item.ID)
	})

	t.Run("duplicate enterprise name conflict", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/register", map[string]interface{}{
			"enterpriseName": enterpriseName,
			"username":       "proxy_other_" + suffix,
			"password":       password,
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21", domain.RoleTeacher))
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/enterprises/register", map[string]interface{}{
			"enterpriseName": "学生代注册-" + suffix,
			"username":       "proxy_stu_" + suffix,
			"password":       password,
		}, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa22", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}
