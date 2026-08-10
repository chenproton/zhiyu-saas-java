package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestRequireAllianceManager 联盟管理权限中间件：教师/校管/平台管理员/系统菜单权限放行，
// 企业导师（B13 角色收窄）与无角色用户拒绝。
func TestRequireAllianceManager(t *testing.T) {
	token := func(roleCodes []string, perms domain.JSONMap) string {
		t.Helper()
		tok, err := GenerateToken("sec", TokenInput{
			User:        &domain.User{ID: "u-test", TenantID: strPtr("t1")},
			RoleCodes:   roleCodes,
			Permissions: perms,
		})
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	cases := []struct {
		name string
		tok  string
		want int
	}{
		{"教师放行", token([]string{domain.RoleTeacher}, nil), http.StatusOK},
		{"校管放行", token([]string{domain.RoleSchoolAdmin}, nil), http.StatusOK},
		{"平台管理员放行", token([]string{domain.RolePlatformAdmin}, nil), http.StatusOK},
		{"系统菜单权限放行", token(nil, domain.JSONMap{"admin": true}), http.StatusOK},
		{"企业导师拒绝", token([]string{domain.RoleEnterpriseMentor}, nil), http.StatusForbidden},
		{"无角色拒绝", token(nil, nil), http.StatusForbidden},
		{"未登录拒绝", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/alliance/projects", nil)
			if tc.tok != "" {
				req.Header.Set("Authorization", "Bearer "+tc.tok)
			}
			w := httptest.NewRecorder()
			JWT("sec")(RequireAllianceManager()(next)).ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}

func strPtr(s string) *string { return &s }
