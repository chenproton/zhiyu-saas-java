package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

type subscriptionResp struct {
	ID           string `json:"id"`
	AITokenQuota int64  `json:"aiTokenQuota"`
}

type aiConfigResp struct {
	Configured   bool   `json:"configured"`
	BaseURL      string `json:"baseUrl"`
	Model        string `json:"model"`
	APIKeyMasked string `json:"apiKeyMasked"`
}

// createSubTestTenant 建一个用于订阅/超管 AI 配置测试的租户，返回租户 ID。
func createSubTestTenant(t *testing.T, env *testhelper.TestEnv, name, code string) string {
	t.Helper()
	w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": name,
		"code": code,
	}, env.SaasAdminToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	resp, err := testhelper.Unmarshal[createTenantResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return resp.Tenant.ID
}

// TestSubscription_AdminAIQuota 超管套餐配置：AI token 额度随订阅读写持久化。
func TestSubscription_AdminAIQuota(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := createSubTestTenant(t, env, "Sub Quota Tenant", "sub-quota-test")
	defer cleanupTenant(context.Background(), t, env, tenantID)

	// 初始额度为 0
	w := env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/subscription", nil, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	sub, err := testhelper.Unmarshal[subscriptionResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if sub.AITokenQuota != 0 {
		t.Fatalf("expected initial quota 0, got %d", sub.AITokenQuota)
	}

	// 超管设置额度（如 5 元 → 250 万 token，2 元 / 1M）；名称/有效期/状态不再展示，允许缺省
	const quota = int64(2500000)
	w = env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/subscription", map[string]interface{}{
		"modules":      map[string]bool{"system": true, "career": false},
		"aiTokenQuota": quota,
	}, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/subscription", nil, env.SaasAdminToken)
	sub, err = testhelper.Unmarshal[subscriptionResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if sub.AITokenQuota != quota {
		t.Fatalf("expected quota %d, got %d", quota, sub.AITokenQuota)
	}
}

// TestSubscription_AdminAIQuotaNilKeepsValue 不传 aiTokenQuota 时保留原额度（租户侧更新不误清）。
func TestSubscription_AdminAIQuotaNilKeepsValue(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := createSubTestTenant(t, env, "Sub Quota Keep Tenant", "sub-quota-keep-test")
	defer cleanupTenant(context.Background(), t, env, tenantID)

	if w := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/subscription", map[string]interface{}{
		"name":         "默认套餐",
		"validUntil":   nil,
		"modules":      map[string]bool{},
		"status":       "active",
		"aiTokenQuota": int64(1000000),
	}, env.SaasAdminToken); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	// 不传额度字段的普通更新（租户侧场景）
	if w := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/subscription", map[string]interface{}{
		"name":       "默认套餐",
		"validUntil": nil,
		"modules":    map[string]bool{"course": true},
		"status":     "active",
	}, env.SaasAdminToken); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	w := env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/subscription", nil, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	sub, err := testhelper.Unmarshal[subscriptionResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if sub.AITokenQuota != 1000000 {
		t.Fatalf("expected quota kept 1000000, got %d", sub.AITokenQuota)
	}
}

// TestAdminAIConfig_CRUD 超管代租户维护 AI 配置：保存→查看（脱敏）→清除；portal token 拒绝。
func TestAdminAIConfig_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := createSubTestTenant(t, env, "AI Config Tenant", "ai-config-test")
	defer cleanupTenant(context.Background(), t, env, tenantID)
	base := "/api/v1/admin/tenants/" + tenantID + "/ai/config"

	// 未配置 → configured=false
	w := env.DoWithToken("GET", base, nil, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	view, err := testhelper.Unmarshal[aiConfigResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if view.Configured {
		t.Fatal("expected configured=false for fresh tenant")
	}

	// 保存配置
	w = env.DoWithToken("PUT", base, map[string]string{
		"baseUrl": "https://api.openai.com/v1",
		"apiKey":  "sk-admin-test-key-1234",
		"model":   "gpt-4o-mini",
	}, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 查看：脱敏 key，绝不含明文
	w = env.DoWithToken("GET", base, nil, env.SaasAdminToken)
	view, err = testhelper.Unmarshal[aiConfigResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !view.Configured || view.BaseURL != "https://api.openai.com/v1" || view.Model != "gpt-4o-mini" {
		t.Fatalf("unexpected view: %+v", view)
	}
	if view.APIKeyMasked == "" || view.APIKeyMasked == "sk-admin-test-key-1234" {
		t.Fatalf("api key must be masked, got %q", view.APIKeyMasked)
	}

	// 清除
	w = env.DoWithToken("DELETE", base, nil, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", base, nil, env.SaasAdminToken)
	view, err = testhelper.Unmarshal[aiConfigResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if view.Configured {
		t.Fatal("expected configured=false after delete")
	}

	// 非超管（portal token）访问 → 403
	w = env.Do("GET", base, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for portal token, got %d", w.Code)
	}
}
