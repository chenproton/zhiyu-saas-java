package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestRequireMenu_GrantMatrix 菜单驱动授权的判定矩阵（ADR-0008）：
// 用户菜单授权（db=nil 测试环境回退旧令牌权限 map）决定 API 放行/403。
func TestRequireMenu_GrantMatrix(t *testing.T) {
	build := func(perms domain.JSONMap) *chi.Mux {
		r := chi.NewRouter()
		r.Use(MenuContext(nil, nil))
		r.With(RequireMenu("/portal/apps/alliance/brands")).Get("/api/v1/alliance/brands", okMenuHandler)
		r.With(RequireMenu("/job/positions", "/job/batches")).Get("/api/v1/job/positions", okMenuHandler)
		return r
	}
	req := func(r *chi.Mux, path, userID string, perms domain.JSONMap) *httptest.ResponseRecorder {
		claims := &Claims{UserID: userID, TenantID: menuStrPtr("t1"), Permissions: perms}
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, menuReqWithClaims(http.MethodGet, path, claims))
		return rr
	}

	t.Run("勾选 brands 菜单放行", func(t *testing.T) {
		r := build(domain.JSONMap{"menus": map[string]interface{}{"/portal/apps/alliance/brands": true}})
		if w := req(r, "/api/v1/alliance/brands", "u1", domain.JSONMap{"menus": map[string]interface{}{"/portal/apps/alliance/brands": true}}); w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
	t.Run("勾选 brands/employer 子菜单放行父 API", func(t *testing.T) {
		r := build(domain.JSONMap{"menus": map[string]interface{}{"/portal/apps/alliance/brands/employer": true}})
		if w := req(r, "/api/v1/alliance/brands", "u2", domain.JSONMap{"menus": map[string]interface{}{"/portal/apps/alliance/brands/employer": true}}); w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
	t.Run("未勾选对应菜单拒绝 403", func(t *testing.T) {
		r := build(domain.JSONMap{"menus": map[string]interface{}{"/job/positions": true}})
		if w := req(r, "/api/v1/alliance/brands", "u3", domain.JSONMap{"menus": map[string]interface{}{"/job/positions": true}}); w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}
	})
	t.Run("menus 缺失 fail-closed 拒绝", func(t *testing.T) {
		r := build(domain.JSONMap{"admin": false})
		if w := req(r, "/api/v1/job/positions", "u4", domain.JSONMap{"admin": false}); w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}
	})
	t.Run("admin 全量放行", func(t *testing.T) {
		r := build(domain.JSONMap{"admin": true})
		if w := req(r, "/api/v1/job/positions", "u5", domain.JSONMap{"admin": true}); w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
	t.Run("无 claims 401", func(t *testing.T) {
		r := build(domain.JSONMap{})
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/alliance/brands", nil))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rr.Code)
		}
	})
	t.Run("多菜单任一命中放行", func(t *testing.T) {
		r := build(domain.JSONMap{"menus": map[string]interface{}{"/job/batches": true}})
		if w := req(r, "/api/v1/job/positions", "u6", domain.JSONMap{"menus": map[string]interface{}{"/job/batches": true}}); w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

// TestMenuGrant_FullAccessFallback school_admin「无 menus=全量」兜底（ADR-0008 决策 5）。
func TestMenuGrant_FullAccessFallback(t *testing.T) {
	r := chi.NewRouter()
	r.Use(MenuContext(nil, nil))
	r.With(RequireMenu("/portal/apps/system/tenant")).Get("/api/v1/tenants/x", okMenuHandler)

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, menuReqWithClaims(http.MethodGet, "/api/v1/tenants/x",
		&Claims{UserID: "sa", RoleCodes: []string{domain.RoleSchoolAdmin}}))
	if rr.Code != http.StatusOK {
		t.Fatalf("school_admin 无 menus 应全量放行, got %d", rr.Code)
	}

	rr2 := httptest.NewRecorder()
	r.ServeHTTP(rr2, menuReqWithClaims(http.MethodGet, "/api/v1/tenants/x",
		&Claims{UserID: "t", RoleCodes: []string{domain.RoleTeacher}}))
	if rr2.Code != http.StatusForbidden {
		t.Fatalf("teacher 无 menus 应 403, got %d", rr2.Code)
	}

	// school_admin 显式配置菜单（非空）→ 按菜单而非全量
	rr3 := httptest.NewRecorder()
	r.ServeHTTP(rr3, menuReqWithClaims(http.MethodGet, "/api/v1/tenants/x",
		&Claims{
			UserID: "sa2", RoleCodes: []string{domain.RoleSchoolAdmin},
			Permissions: domain.JSONMap{"menus": map[string]interface{}{"/job/landing": true}},
		}))
	if rr3.Code != http.StatusForbidden {
		t.Fatalf("school_admin 显式配置部分菜单应按菜单判定, got %d", rr3.Code)
	}
}

// TestRequireMenu_CrossModuleReadGrant 跨模块只读引用授权（回归）：
// 岗位/场景详情页知识图谱引用 lesson 模块课程/知识点列表，属 jobViewer 只读语义。
// 仅勾选 /job/landing 菜单的企业导师等角色应可读，未勾任何业务菜单则 403。
// 背景：曾因这两个 List 接口挂在 lesson 管理菜单面，企业导师访问岗位知识图谱 403。
func TestRequireMenu_CrossModuleReadGrant(t *testing.T) {
	build := func() *chi.Mux {
		r := chi.NewRouter()
		r.Use(MenuContext(nil, nil))
		// 跨模块只读引用组授权面（与 routes.go 实际一致：allManageMenus ∪ 全部 landing）
		menuSet := []string{
			"/job/landing", "/lesson/landing", "/scene/landing",
			"/evaluation/landing", "/library/landing",
			"/job/positions", "/job/batches",
			"/lesson/admin/granular", "/library/knowledge",
		}
		for _, path := range []string{
			"/api/v1/lesson/courses",
			"/api/v1/lesson/knowledge-points",
			"/api/v1/job/abilities",
			"/api/v1/library/resources",
			"/api/v1/scene/tasks",
		} {
			r.With(RequireMenu(menuSet...)).Get(path, okMenuHandler)
		}
		return r
	}
	req := func(r *chi.Mux, path string, perms domain.JSONMap) int {
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, menuReqWithClaims(http.MethodGet, path,
			&Claims{UserID: "u", TenantID: menuStrPtr("t1"), Permissions: perms}))
		return rr.Code
	}

	t.Run("仅勾选 /job/landing 菜单可读课程列表（岗位知识图谱引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/job/landing": true}}
		if c := req(build(), "/api/v1/lesson/courses", perms); c != http.StatusOK {
			t.Fatalf("job landing 用户读课程列表: got %d, want 200", c)
		}
	})
	t.Run("仅勾选 /job/landing 菜单可读知识点列表", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/job/landing": true}}
		if c := req(build(), "/api/v1/lesson/knowledge-points", perms); c != http.StatusOK {
			t.Fatalf("job landing 用户读知识点列表: got %d, want 200", c)
		}
	})
	t.Run("勾选 /scene/landing 菜单可读课程列表（场景知识图谱引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/scene/landing": true}}
		if c := req(build(), "/api/v1/lesson/courses", perms); c != http.StatusOK {
			t.Fatalf("scene landing 用户读课程列表: got %d, want 200", c)
		}
	})
	t.Run("仅勾选 /job/landing 可读能力点列表（场景/课程编辑页引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/job/landing": true}}
		if c := req(build(), "/api/v1/job/abilities", perms); c != http.StatusOK {
			t.Fatalf("job landing 用户读能力点: got %d, want 200", c)
		}
	})
	t.Run("仅勾选 /scene/landing 可读资源库列表（场景学习页引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/scene/landing": true}}
		if c := req(build(), "/api/v1/library/resources", perms); c != http.StatusOK {
			t.Fatalf("scene landing 用户读资源库: got %d, want 200", c)
		}
	})
	t.Run("仅勾选 /job/landing 可读场景任务列表（岗位实践场景 tab 引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/job/landing": true}}
		if c := req(build(), "/api/v1/scene/tasks", perms); c != http.StatusOK {
			t.Fatalf("job landing 用户读场景任务: got %d, want 200", c)
		}
	})
	t.Run("仅勾选 /library/landing 可读课程列表（资源库关联课程引用）", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/library/landing": true}}
		if c := req(build(), "/api/v1/lesson/courses", perms); c != http.StatusOK {
			t.Fatalf("library landing 用户读课程列表: got %d, want 200", c)
		}
	})
	t.Run("未勾选任何业务菜单拒绝 403", func(t *testing.T) {
		perms := domain.JSONMap{"menus": map[string]interface{}{"/portal/workspace": true}}
		if c := req(build(), "/api/v1/lesson/courses", perms); c != http.StatusForbidden {
			t.Fatalf("无业务菜单读课程列表: got %d, want 403", c)
		}
	})
}

func okMenuHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func menuReqWithClaims(method, path string, claims *Claims) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	return req.WithContext(WithUser(context.Background(), claims))
}

func menuStrPtr(s string) *string { return &s }
