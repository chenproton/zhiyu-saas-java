package handler_test

import (
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestCaptcha_Get 生成接口返回完整前端数据。
func TestCaptcha_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.DoNoAuth(http.MethodGet, "/api/v1/auth/captcha", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	resp, err := testhelper.Unmarshal[map[string]interface{}](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, field := range []string{"captchaId", "image"} {
		if v, ok := resp[field]; !ok || v == "" {
			t.Fatalf("field %s missing or empty: %v", field, v)
		}
	}
}

// 常用设备（已信任）登录失败达到阈值后必须携带验证码。
const captchaTestDevice = "captcha-test-device-1"

// TestLogin_CaptchaRequiredAfterFailures 常用设备连续失败 3 次后必须携带验证码。
func TestLogin_CaptchaRequiredAfterFailures(t *testing.T) {
	env := testhelper.SetupTestEnvWithCaptcha(t)
	defer env.Cleanup()

	// 常用设备：预信任后前 3 次错误密码仍返回 401（未要求验证码）
	env.TrustDevice(domain.UserPlatformPortal, "seedtestuser", captchaTestDevice)
	for i := 0; i < 3; i++ {
		w := env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
			"username": "seedtestuser",
			"password": "wrongpass",
			"deviceId": captchaTestDevice,
		})
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d", i+1, w.Code)
		}
	}

	// 第 4 次不带验证码 → 400 captcha_required
	w := env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
		"username": "seedtestuser",
		"password": "wrongpass",
		"deviceId": captchaTestDevice,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	resp, err := testhelper.Unmarshal[map[string]interface{}](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if code, _ := resp["code"].(string); code != "captcha_required" {
		t.Fatalf("expected code captcha_required, got %v", resp["code"])
	}
}

// TestLogin_CaptchaWrong 携带验证码但字符错误 → 400 captcha_wrong。
func TestLogin_CaptchaWrong(t *testing.T) {
	env := testhelper.SetupTestEnvWithCaptcha(t)
	defer env.Cleanup()

	env.TrustDevice(domain.UserPlatformPortal, "seedtestuser", captchaTestDevice)
	for i := 0; i < 3; i++ {
		env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
			"username": "seedtestuser",
			"password": "wrongpass",
			"deviceId": captchaTestDevice,
		})
	}

	// 获取验证码（答案存在服务端），提交错误字符
	captchaResp := env.DoNoAuth(http.MethodGet, "/api/v1/auth/captcha", nil)
	captcha, err := testhelper.Unmarshal[map[string]interface{}](captchaResp)
	if err != nil {
		t.Fatalf("unmarshal captcha: %v", err)
	}

	w := env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
		"username":    "seedtestuser",
		"password":    "wrongpass",
		"deviceId":    captchaTestDevice,
		"captchaId":   captcha["captchaId"],
		"captchaCode": "zzzz",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	resp, err := testhelper.Unmarshal[map[string]interface{}](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if code, _ := resp["code"].(string); code != "captcha_wrong" {
		t.Fatalf("expected code captcha_wrong, got %v", resp["code"])
	}
}

// TestLogin_SuccessResetsFailures 登录成功后失败计数清零，无需验证码即可再次登录。
func TestLogin_SuccessResetsFailures(t *testing.T) {
	env := testhelper.SetupTestEnvWithCaptcha(t)
	defer env.Cleanup()

	env.TrustDevice(domain.UserPlatformPortal, "seedtestuser", captchaTestDevice)
	env.TrustDevice(domain.UserPlatformSaas, "seedtestuser", captchaTestDevice)

	// 失败 2 次（未到阈值）
	for i := 0; i < 2; i++ {
		env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
			"username": "seedtestuser",
			"password": "wrongpass",
			"deviceId": captchaTestDevice,
		})
	}
	// 用正确密码登录成功（seedtestuser 为 saas 平台种子用户）
	ok := env.DoNoAuth(http.MethodPost, "/api/v1/auth/saas/login", map[string]interface{}{
		"username": "seedtestuser",
		"password": "test123",
		"deviceId": captchaTestDevice,
	})
	if ok.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", ok.Code, ok.Body.String())
	}
	// 清零后再次错误登录不触发验证码（仍 401）
	w := env.DoNoAuth(http.MethodPost, "/api/v1/auth/portal/login", map[string]interface{}{
		"username": "seedtestuser",
		"password": "wrongpass",
		"deviceId": captchaTestDevice,
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after reset, got %d: %s", w.Code, w.Body.String())
	}
}
