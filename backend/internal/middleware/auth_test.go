package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

const testSecret = "test-jwt-secret-auth-test"

func TestGenerateToken(t *testing.T) {
	user := &domain.User{
		ID:       "user-001",
		Username: "testuser",
		Role:     domain.UserRoleOperator,
		TenantID: strPtr("tenant-001"),
	}

	token, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	if token == "" {
		t.Fatal("token should not be empty")
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
	if claims.UserID != "user-001" {
		t.Errorf("UserID = %q, want user-001", claims.UserID)
	}
	if claims.Username != "testuser" {
		t.Errorf("Username = %q, want testuser", claims.Username)
	}
	if claims.Role != domain.UserRoleOperator {
		t.Errorf("Role = %q, want operator", claims.Role)
	}
	if claims.TenantID == nil || *claims.TenantID != "tenant-001" {
		t.Errorf("TenantID = %v, want tenant-001", claims.TenantID)
	}
}

func TestJWT_ValidToken(t *testing.T) {
	user := &domain.User{
		ID:       "user-002",
		Username: "validuser",
		Role:     domain.UserRoleOperator,
		TenantID: strPtr("tenant-002"),
	}

	tokenStr, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.CurrentUser(r)
		if claims == nil {
			t.Error("CurrentUser returned nil")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if claims.UserID != "user-002" {
			t.Errorf("UserID = %q, want user-002", claims.UserID)
		}
		if claims.Username != "validuser" {
			t.Errorf("Username = %q, want validuser", claims.Username)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestJWT_NoAuthHeader(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestJWT_MalformedToken(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "raw-token-without-bearer-prefix")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for malformed token, got %d", w.Code)
	}
}

func TestCurrentUser_Nil(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)

	claims := middleware.CurrentUser(req)
	if claims != nil {
		t.Errorf("expected nil for request without context, got %v", claims)
	}
}

func strPtr(s string) *string {
	return &s
}
