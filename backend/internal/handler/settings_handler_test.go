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

func TestSettings_TenantThemeOverride(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID

	// 未配置租户覆盖 → 回退平台默认（当前为 #1677ff，见上一个用例；此处显式验证回退逻辑）
	w := env.DoNoAuth("GET", "/api/v1/settings/theme?tenantId="+tenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get tenant theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err := testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] != "#1677ff" {
		t.Fatalf("fallback primary = %q, want #1677ff", got["primary"])
	}

	// 非法 tenantId → 400
	w = env.DoNoAuth("GET", "/api/v1/settings/theme?tenantId=not-a-uuid", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid tenantId: expected 400, got %d", w.Code)
	}

	// 设置租户覆盖色 → 公开接口按租户返回
	w = env.Do("PUT", "/api/v1/admin/tenants/"+tenantID+"/settings/theme", map[string]string{"primary": "#0b5bd0"})
	if w.Code != http.StatusOK {
		t.Fatalf("update tenant theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoNoAuth("GET", "/api/v1/settings/theme?tenantId="+tenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get tenant theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err = testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] != "#0b5bd0" {
		t.Fatalf("tenant primary = %q, want #0b5bd0", got["primary"])
	}

	// 全局主题不受租户覆盖影响
	w = env.DoNoAuth("GET", "/api/v1/settings/theme", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get global theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err = testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] != "#1677ff" {
		t.Fatalf("global primary = %q, want #1677ff", got["primary"])
	}

	// 清除租户覆盖 → 回退平台默认
	w = env.Do("DELETE", "/api/v1/admin/tenants/"+tenantID+"/settings/theme")
	if w.Code != http.StatusOK {
		t.Fatalf("delete tenant theme: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoNoAuth("GET", "/api/v1/settings/theme?tenantId="+tenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get tenant theme after delete: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	got, err = testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["primary"] != "#1677ff" {
		t.Fatalf("fallback primary = %q, want #1677ff", got["primary"])
	}
}
