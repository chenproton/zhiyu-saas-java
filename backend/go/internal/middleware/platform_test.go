package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

func TestRequirePlatform(t *testing.T) {
	mkUser := func(platform domain.UserPlatform) *domain.User {
		return &domain.User{
			ID:       "user-plat-001",
			Username: "platform-user",
			Role:     domain.UserRoleOperator,
			TenantID: strPtr("tenant-001"),
			Platform: platform,
		}
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	cases := []struct {
		name       string
		user       *domain.User
		required   domain.UserPlatform
		wantStatus int
	}{
		{"匹配平台放行", mkUser(domain.UserPlatformPortal), domain.UserPlatformPortal, http.StatusOK},
		{"跨平台拒绝", mkUser(domain.UserPlatformPortal), domain.UserPlatformSaas, http.StatusForbidden},
		{"saas 匹配放行", mkUser(domain.UserPlatformSaas), domain.UserPlatformSaas, http.StatusOK},
		{"portal 访问 saas 拒绝", mkUser(domain.UserPlatformSaas), domain.UserPlatformPortal, http.StatusForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tokenStr, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: tc.user})
			if err != nil {
				t.Fatalf("generate token: %v", err)
			}

			handler := middleware.JWT(testSecret)(middleware.RequirePlatform(tc.required)(next))

			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("Authorization", "Bearer "+tokenStr)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
		})
	}
}

func TestRequirePlatform_NoToken(t *testing.T) {
	handler := middleware.JWT(testSecret)(middleware.RequirePlatform(domain.UserPlatformPortal)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}
