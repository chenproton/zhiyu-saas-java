package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"golang.org/x/crypto/bcrypt"
)

// createPortalUser 直接插入一个 portal 用户并返回其 ID。
func createPortalUser(t *testing.T, env *testhelper.TestEnv, username, password string) string {
	t.Helper()
	ctx := context.Background()
	id := uuid.NewString()
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	_, err := env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', $3, $3, $4, '测试用户', 'active', '{}') ON CONFLICT (id) DO NOTHING
	`, id, testhelper.TestTenantID, username, string(hash))
	if err != nil {
		t.Fatalf("insert portal user: %v", err)
	}
	return id
}

func TestPortalWorkspace_UpdateMe(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := createPortalUser(t, env, "selfupdate-"+uuid.NewString()[:8], "oldpass123")
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	token := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "student")

	w := env.DoWithToken("PUT", "/api/v1/portal/workspace/me", map[string]interface{}{
		"name": "李小明",
	}, token)
	if w.Code != http.StatusOK {
		t.Fatalf("update name: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	updated, err := testhelper.Unmarshal[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if updated.Name != "李小明" {
		t.Fatalf("expected name 李小明, got %s", updated.Name)
	}
	if updated.ID != userID {
		t.Fatalf("user id must not change: %s != %s", updated.ID, userID)
	}

	var dbName string
	if err := env.DB.QueryRow(ctx, "SELECT name FROM users WHERE id = $1", userID).Scan(&dbName); err != nil {
		t.Fatalf("query db: %v", err)
	}
	if dbName != "李小明" {
		t.Fatalf("db name = %s, want 李小明", dbName)
	}
}

func TestPortalWorkspace_UpdateMeEmptyName(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := createPortalUser(t, env, "selfupdate-"+uuid.NewString()[:8], "oldpass123")
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	token := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "teacher")

	w := env.DoWithToken("PUT", "/api/v1/portal/workspace/me", map[string]interface{}{
		"name": "",
	}, token)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", w.Code, testhelper.ErrMsg(w))
	}
}

func TestPortalWorkspace_ChangeMyPassword(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	username := "selfpwd-" + uuid.NewString()[:8]
	userID := createPortalUser(t, env, username, "oldpass123")
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	token := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")

	w := env.DoWithToken("POST", "/api/v1/portal/workspace/me/password", map[string]interface{}{
		"newPassword": "newpass456",
	}, token)
	if w.Code != http.StatusOK {
		t.Fatalf("change password: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 旧密码登录失败
	wOld := env.DoNoAuth("POST", "/api/v1/auth/portal/login", map[string]interface{}{
		"username": username,
		"password": "oldpass123",
	})
	if wOld.Code != http.StatusUnauthorized {
		t.Fatalf("old password login should fail, got %d", wOld.Code)
	}

	// 新密码登录成功
	wNew := env.DoNoAuth("POST", "/api/v1/auth/portal/login", map[string]interface{}{
		"username": username,
		"password": "newpass456",
	})
	if wNew.Code != http.StatusOK {
		t.Fatalf("new password login: %d %s", wNew.Code, testhelper.ErrMsg(wNew))
	}
}

func TestPortalWorkspace_ChangeMyPasswordWeak(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID := createPortalUser(t, env, "selfpwd-"+uuid.NewString()[:8], "oldpass123")
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	token := env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "student")

	w := env.DoWithToken("POST", "/api/v1/portal/workspace/me/password", map[string]interface{}{
		"newPassword": "123",
	}, token)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for weak password, got %d", w.Code)
	}
}
