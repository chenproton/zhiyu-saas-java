package middleware_test

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// TestGenerateTokenSlimClaims JWT 瘦身：完整权限 map 仅派生紧凑字段写入 token，
// 完整权限 map 不再进入载荷（Set-Cookie 大小受浏览器 4096 字节限制）。
func TestGenerateTokenSlimClaims(t *testing.T) {
	fullPerms := domain.JSONMap{
		"admin": true,
		"menus": map[string]interface{}{
			"/job/positions":                 true,
			"/library/landing":               true,
			"/portal/apps/system/tenant":     true,
			"/portal/apps/system/users":      false,
			"/portal/apps/system/organize":   true,
			"/portal/apps/alliance/projects": true,
		},
	}
	user := &domain.User{ID: "u-slim", Username: "teacher", TenantID: strPtr("t1")}
	token, err := middleware.GenerateToken(testSecret, middleware.TokenInput{
		User:        user,
		RoleCodes:   []string{"teacher"},
		Permissions: fullPerms,
	})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	parsed, err := jwt.ParseWithClaims(token, &middleware.Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	claims, ok := parsed.Claims.(*middleware.Claims)
	if !ok {
		t.Fatal("claims type assertion failed")
	}

	if !claims.Admin {
		t.Error("Admin = false, want true（admin 标记应保留）")
	}
	if !claims.HasMenu {
		t.Error("HasMenu = false, want true（有勾选菜单）")
	}
	wantSystem := []string{"/portal/apps/system/tenant", "/portal/apps/system/organize"}
	if len(claims.SystemMenus) != len(wantSystem) {
		t.Fatalf("SystemMenus = %v, want %v", claims.SystemMenus, wantSystem)
	}
	for _, p := range wantSystem {
		if !containsStr(claims.SystemMenus, p) {
			t.Errorf("SystemMenus 缺少 %q, got %v", p, claims.SystemMenus)
		}
	}
	if len(claims.Permissions) != 0 {
		t.Errorf("Permissions 不应写入 token, got %v", claims.Permissions)
	}
	if len(token) > 1500 {
		t.Errorf("token 过大 %d chars（瘦身后应远小于 4096）", len(token))
	}
}

// TestGenerateTokenSlimClaimsNoGrant 无任何授权时紧凑字段全空。
func TestGenerateTokenSlimClaimsNoGrant(t *testing.T) {
	token, err := middleware.GenerateToken(testSecret, middleware.TokenInput{
		User: &domain.User{ID: "u-none", TenantID: strPtr("t1")},
		Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/job/positions": false},
		},
	})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	parsed, err := jwt.ParseWithClaims(token, &middleware.Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	claims := parsed.Claims.(*middleware.Claims)
	if claims.Admin || claims.HasMenu || len(claims.SystemMenus) != 0 {
		t.Errorf("紧凑字段应全空, got admin=%v hasMenu=%v systemMenus=%v",
			claims.Admin, claims.HasMenu, claims.SystemMenus)
	}
}

// TestHasAnyMenuPermissionCompact 新令牌精简载荷判断。
func TestHasAnyMenuPermissionCompact(t *testing.T) {
	cases := []struct {
		name  string
		claim *middleware.Claims
		want  bool
	}{
		{"有菜单", &middleware.Claims{HasMenu: true}, true},
		{"无菜单", &middleware.Claims{HasMenu: false}, false},
		{"nil claims", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := middleware.HasAnyMenuPermission(tc.claim); got != tc.want {
				t.Errorf("HasAnyMenuPermission = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestHasAnyMenuPermissionLegacy 旧令牌（完整权限 map）回退判断。
func TestHasAnyMenuPermissionLegacy(t *testing.T) {
	cases := []struct {
		name  string
		claim *middleware.Claims
		want  bool
	}{
		{"菜单全勾选", &middleware.Claims{Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/job/positions": true, "/library": true},
		}}, true},
		{"菜单未勾选", &middleware.Claims{Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/job/positions": false},
		}}, false},
		{"无 menus 键", &middleware.Claims{Permissions: domain.JSONMap{"admin": true}}, false},
		{"空权限", &middleware.Claims{Permissions: domain.JSONMap{}}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := middleware.HasAnyMenuPermission(tc.claim); got != tc.want {
				t.Errorf("HasAnyMenuPermission = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestHasSystemPermissionCompact 新令牌精简载荷判断。
func TestHasSystemPermissionCompact(t *testing.T) {
	cases := []struct {
		name  string
		claim *middleware.Claims
		want  bool
	}{
		{"admin 标记", &middleware.Claims{Admin: true}, true},
		{"系统菜单授权", &middleware.Claims{SystemMenus: []string{"/portal/apps/system/tenant"}}, true},
		{"仅业务菜单", &middleware.Claims{HasMenu: true}, false},
		{"空载荷", &middleware.Claims{}, false},
		{"nil claims", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := middleware.HasSystemPermission(tc.claim); got != tc.want {
				t.Errorf("HasSystemPermission = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestHasSystemPermissionLegacy 旧令牌（完整权限 map）回退判断。
func TestHasSystemPermissionLegacy(t *testing.T) {
	cases := []struct {
		name  string
		claim *middleware.Claims
		want  bool
	}{
		{"admin 标记", &middleware.Claims{Permissions: domain.JSONMap{"admin": true}}, true},
		{"系统菜单勾选", &middleware.Claims{Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/portal/apps/system/tenant": true},
		}}, true},
		{"仅业务菜单勾选", &middleware.Claims{Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/job/positions": true},
		}}, false},
		{"系统菜单未勾选", &middleware.Claims{Permissions: domain.JSONMap{
			"menus": map[string]interface{}{"/portal/apps/system/tenant": false},
		}}, false},
		{"空权限", &middleware.Claims{Permissions: domain.JSONMap{}}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := middleware.HasSystemPermission(tc.claim); got != tc.want {
				t.Errorf("HasSystemPermission = %v, want %v", got, tc.want)
			}
		})
	}
}

func containsStr(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
