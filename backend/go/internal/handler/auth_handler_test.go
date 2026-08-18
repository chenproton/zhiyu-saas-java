package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"golang.org/x/crypto/bcrypt"
)

func TestLogin_Success(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := uuid.NewString()
	username := "testlogin-" + userID[:8]
	password := "testpass123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	tid := testhelper.TestTenantID
	_, err = env.DB.Exec(ctx,
		`INSERT INTO users (id, tenant_id, role, login_name, username, password_hash, name, status, title_ids) VALUES ($1, $2, 'operator', $3, $3, $4, 'Test Login User', 'active', '{}') ON CONFLICT (id) DO NOTHING`,
		userID, tid, username, string(hash),
	)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": username,
		"password": password,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	resp, err := testhelper.Unmarshal[map[string]interface{}](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if token, ok := resp["token"].(string); !ok || token == "" {
		t.Fatal("expected token in response")
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": testhelper.TestOperatorID,
		"password": "wrongpassword",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": "nonexistent_user",
		"password": "anything",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMe_WithValidToken(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.DoWithToken("GET", "/api/v1/auth/me", nil, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	resp, err := testhelper.Unmarshal[map[string]interface{}](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	user, ok := resp["user"].(map[string]interface{})
	if !ok {
		t.Fatal("expected user in response")
	}
	if user["username"] != "seedtestuser" {
		t.Fatalf("expected username seedtestuser, got %v", user["username"])
	}
}

func TestMe_WithoutToken(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.DoWithToken("GET", "/api/v1/auth/me", nil, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
