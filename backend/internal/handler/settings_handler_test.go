package handler_test

import (
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestSettings_ThemePublicGet(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	// 公开接口无需登录
	w := env.DoNoAuth("GET", "/api/v1/settings/theme", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err := testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] == "" || len(got["primary"]) != 7 {
		t.Fatalf("expected #RRGGBB primary, got %q", got["primary"])
	}
}

func TestSettings_ThemeAdminUpdate(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	// 非法格式 → 400
	w := env.Do("PUT", "/api/v1/admin/settings/theme", map[string]string{"primary": "red"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid color: expected 400, got %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 未登录 → 401
	w = env.DoNoAuth("PUT", "/api/v1/admin/settings/theme", map[string]string{"primary": "#1677ff"})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no auth: expected 401, got %d", w.Code)
	}

	// 正常保存 → 保存后公开接口读取一致
	w = env.Do("PUT", "/api/v1/admin/settings/theme", map[string]string{"primary": "#1677ff"})
	if w.Code != http.StatusOK {
		t.Fatalf("update theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoNoAuth("GET", "/api/v1/settings/theme", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err := testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] != "#1677ff" {
		t.Fatalf("primary = %q, want #1677ff", got["primary"])
	}
}
