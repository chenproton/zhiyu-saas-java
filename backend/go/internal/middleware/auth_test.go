package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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

func TestJWT_ExpiredToken(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
		w.WriteHeader(http.StatusOK)
	}))

	user := &domain.User{
		ID:       "u1",
		TenantID: strPtr("t1"),
		Role:     domain.UserRoleSchool,
	}
	claims := jwt.MapClaims{
		"userId":   user.ID,
		"tenantId": *user.TenantID,
		"role":     string(user.Role),
		"exp":      time.Now().Add(-time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestJWT_WrongSecretToken(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
		w.WriteHeader(http.StatusOK)
	}))

	user := &domain.User{ID: "u1", Role: domain.UserRoleSchool}
	tokenStr, err := middleware.GenerateToken("wrong-secret", middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong-secret token, got %d", w.Code)
	}
}

func TestJWT_TamperedToken(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
		w.WriteHeader(http.StatusOK)
	}))

	user := &domain.User{ID: "u1", Role: domain.UserRoleSchool}
	tokenStr, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	// 篡改 payload（签名不匹配）
	parts := strings.Split(tokenStr, ".")
	payload := parts[1]
	mod := []byte(payload)
	mod[0] = 'A'
	tampered := parts[0] + "." + string(mod) + "." + parts[2]

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tampered)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for tampered token, got %d", w.Code)
	}
}

// TestJWTSetsAuthCookieWhenMissing 旧会话自愈：带 Bearer token 但无 cookie 的请求，
// 认证成功后应补发 zhiyu_auth cookie（否则 <img> 等 /uploads 请求 401，封面无法展示）。
func TestJWTSetsAuthCookieWhenMissing(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	user := &domain.User{ID: "u1", Role: domain.UserRoleSchool, Platform: domain.UserPlatformPortal}
	tokenStr, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	setCookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "zhiyu_auth_portal=") || !strings.Contains(setCookie, "Path=/uploads") {
		t.Fatalf("应补发平台 cookie，实际 Set-Cookie: %q", setCookie)
	}
}

// TestJWTSkipsCookieWhenAlreadySet cookie 已与 token 一致时不应重复下发。
func TestJWTSkipsCookieWhenAlreadySet(t *testing.T) {
	handler := middleware.JWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	user := &domain.User{ID: "u1", Role: domain.UserRoleSchool, Platform: domain.UserPlatformPortal}
	tokenStr, err := middleware.GenerateToken(testSecret, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	req.AddCookie(&http.Cookie{Name: "zhiyu_auth_portal", Value: tokenStr, Path: "/uploads"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Set-Cookie"); got != "" {
		t.Fatalf("cookie 已一致不应重复下发，实际 Set-Cookie: %q", got)
	}
}

// TestAuthCookiesPerPlatform 双平台共存：portal 与 partner cookie 各自独立，
// 后登录不覆盖另一端；Serve（OptionalJWT）按租户匹配取用任一 cookie。
func TestAuthCookiesPerPlatform(t *testing.T) {
	portalTok, _ := middleware.GenerateToken(testSecret, middleware.TokenInput{
		User: &domain.User{ID: "u-p", Platform: domain.UserPlatformPortal, TenantID: strPtr("t-portal")},
	})
	partnerTok, _ := middleware.GenerateToken(testSecret, middleware.TokenInput{
		User: &domain.User{ID: "u-e", Platform: domain.UserPlatformPartner, TenantID: strPtr("t-partner")},
	})

	// 1) 先登录 portal，再登录 partner：登录响应各写各的 cookie 名
	w1 := httptest.NewRecorder()
	middleware.SetAuthCookie(w1, domain.UserPlatformPortal, portalTok)
	if !strings.Contains(w1.Header().Get("Set-Cookie"), "zhiyu_auth_portal=") {
		t.Fatalf("portal 登录应写 zhiyu_auth_portal，实际 %q", w1.Header().Get("Set-Cookie"))
	}
	w2 := httptest.NewRecorder()
	middleware.SetAuthCookie(w2, domain.UserPlatformPartner, partnerTok)
	if !strings.Contains(w2.Header().Get("Set-Cookie"), "zhiyu_auth_partner=") {
		t.Fatalf("partner 登录应写 zhiyu_auth_partner，实际 %q", w2.Header().Get("Set-Cookie"))
	}

	// 2) 浏览器同时携带两个 cookie，OptionalJWT 应解析出对应平台 claims
	var gotPlatform domain.UserPlatform
	handler := middleware.OptionalJWT(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c := middleware.CurrentUser(r); c != nil {
			gotPlatform = c.Platform
		}
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest("GET", "/uploads/t-portal/x.png", nil)
	req.AddCookie(&http.Cookie{Name: "zhiyu_auth_portal", Value: portalTok, Path: "/uploads"})
	req.AddCookie(&http.Cookie{Name: "zhiyu_auth_partner", Value: partnerTok, Path: "/uploads"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if gotPlatform != domain.UserPlatformPortal {
		t.Fatalf("应解析到 portal claims（平台 cookie 优先），实际 %s", gotPlatform)
	}
}

// TestJWT_PreviousSecretRotation 验证密钥轮换：旧密钥签发的 token 在轮换窗口内仍可验签。
func TestJWT_PreviousSecretRotation(t *testing.T) {
	const current = "current-secret"
	const previous = "previous-secret"

	user := &domain.User{
		ID:       "user-rotate",
		Username: "rotateuser",
		Role:     domain.UserRoleOperator,
		TenantID: strPtr("tenant-rotate"),
	}
	oldToken, err := middleware.GenerateToken(previous, middleware.TokenInput{User: user})
	if err != nil {
		t.Fatalf("generate old token: %v", err)
	}

	handler := middleware.JWT(current, previous)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if middleware.CurrentUser(r) == nil {
			t.Error("旧密钥 token 应在轮换窗口内验签通过")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+oldToken)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("旧密钥 token 验签失败，status=%d", w.Code)
	}
}
