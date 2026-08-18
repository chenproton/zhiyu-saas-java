package handler_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestLogin_TenantExpired 租户已过有效期：禁止登录（403）。
func TestLogin_TenantExpired(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	past := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	if _, err := env.DB.Exec(ctx, `UPDATE tenants SET valid_until = $1 WHERE id = $2`, past, testhelper.TestTenantID); err != nil {
		t.Fatalf("set valid_until: %v", err)
	}
	defer env.DB.Exec(ctx, `UPDATE tenants SET valid_until = NULL WHERE id = $1`, testhelper.TestTenantID)

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": "seedtestuser",
		"password": "test123",
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

// TestLogin_TenantNotStarted 租户未到开始日期：禁止登录（403）。
func TestLogin_TenantNotStarted(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	future := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if _, err := env.DB.Exec(ctx, `UPDATE tenants SET valid_from = $1 WHERE id = $2`, future, testhelper.TestTenantID); err != nil {
		t.Fatalf("set valid_from: %v", err)
	}
	defer env.DB.Exec(ctx, `UPDATE tenants SET valid_from = NULL WHERE id = $1`, testhelper.TestTenantID)

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": "seedtestuser",
		"password": "test123",
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}

// TestLogin_TenantWithinValidity 租户在有效期内：正常登录（200）。
func TestLogin_TenantWithinValidity(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if _, err := env.DB.Exec(ctx, `UPDATE tenants SET valid_from = $1, valid_until = $2 WHERE id = $3`, yesterday, tomorrow, testhelper.TestTenantID); err != nil {
		t.Fatalf("set validity: %v", err)
	}
	defer env.DB.Exec(ctx, `UPDATE tenants SET valid_from = NULL, valid_until = NULL WHERE id = $1`, testhelper.TestTenantID)

	w := env.Do("POST", "/api/v1/auth/login", map[string]string{
		"username": "seedtestuser",
		"password": "test123",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}
