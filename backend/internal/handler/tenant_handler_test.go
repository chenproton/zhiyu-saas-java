package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

type createTenantResp struct {
	Tenant domain.Tenant `json:"tenant"`
}

type adminEnterpriseResp struct {
	Tenant     domain.Tenant             `json:"tenant"`
	Enterprise domain.AllianceEnterprise `json:"enterprise"`
}

func cleanupTenant(ctx context.Context, t *testing.T, env *testhelper.TestEnv, tenantID string) {
	t.Helper()
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-test-create")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-list-a")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-list-b")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-get-test")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-update-test")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-status-test")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-status-inv-test")
	env.DB.Exec(ctx, "DELETE FROM users WHERE login_name = $1", "admin-admin-sub-test")
	env.DB.Exec(ctx, "DELETE FROM users WHERE tenant_id = $1", tenantID)
	env.DB.Exec(ctx, "DELETE FROM roles WHERE tenant_id = $1", tenantID)
	env.DB.Exec(ctx, "DELETE FROM subscription_packages WHERE tenant_id = $1", tenantID)
	env.DB.Exec(ctx, "DELETE FROM org_types WHERE tenant_id = $1", tenantID)
	env.DB.Exec(ctx, "DELETE FROM tenants WHERE id = $1", tenantID)
}

func TestTenant_Create(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Test Tenant Create",
		"code": "test-create",
	}, env.SaasAdminToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	resp, err := testhelper.Unmarshal[createTenantResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	tenant := resp.Tenant
	if tenant.Name != "Test Tenant Create" {
		t.Fatalf("expected name 'Test Tenant Create', got %s", tenant.Name)
	}
	var industryCount int
	if err := env.DB.QueryRow(ctx,
		"SELECT COUNT(*) FROM industries WHERE tenant_id = $1", tenant.ID).Scan(&industryCount); err != nil {
		t.Fatalf("count industries: %v", err)
	}
	if industryCount != 97 {
		t.Fatalf("expected 97 seeded industries, got %d", industryCount)
	}
	defer cleanupTenant(ctx, t, env, tenant.ID)
}

func TestTenant_Create_MissingFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"code": "no-name",
	}, env.SaasAdminToken)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestTenant_Create_DuplicateCode(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w1 := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Dup Code A",
		"code": "dup-code-test",
	}, env.SaasAdminToken)
	if w1.Code != http.StatusCreated {
		t.Fatalf("create 1: %d %s", w1.Code, testhelper.ErrMsg(w1))
	}
	r1, _ := testhelper.Unmarshal[createTenantResp](w1)
	defer cleanupTenant(ctx, t, env, r1.Tenant.ID)

	w2 := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Dup Code B",
		"code": "dup-code-test",
	}, env.SaasAdminToken)
	if w2.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w2.Code, testhelper.ErrMsg(w2))
	}
}

func TestTenant_List(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w1 := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "ListTenantA", "code": "list-a"}, env.SaasAdminToken)
	if w1.Code != http.StatusCreated {
		t.Fatalf("create tenant 1: %d %s", w1.Code, testhelper.ErrMsg(w1))
	}
	r1, _ := testhelper.Unmarshal[createTenantResp](w1)
	t1 := r1.Tenant
	defer cleanupTenant(ctx, t, env, t1.ID)

	w2 := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "ListTenantB", "code": "list-b"}, env.SaasAdminToken)
	if w2.Code != http.StatusCreated {
		t.Fatalf("create tenant 2: %d %s", w2.Code, testhelper.ErrMsg(w2))
	}
	r2, _ := testhelper.Unmarshal[createTenantResp](w2)
	t2 := r2.Tenant
	defer cleanupTenant(ctx, t, env, t2.ID)

	w := env.Do("GET", "/api/v1/tenants", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, total, err := testhelper.UnmarshalList[domain.Tenant](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	// 认证版租户列表按租户隔离：只返回调用者自己的租户，跨租户列表走 /admin/tenants
	if total != 1 {
		t.Fatalf("expected total == 1 (own tenant only), got %d", total)
	}
	if len(items) != 1 || items[0].ID != testhelper.TestTenantID {
		t.Fatalf("expected only own tenant %s, got %+v", testhelper.TestTenantID, items)
	}
}

func TestTenant_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "Get Test Tenant", "code": "get-test"}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	cr, _ := testhelper.Unmarshal[createTenantResp](wc)
	created := cr.Tenant
	defer cleanupTenant(ctx, t, env, created.ID)

	w := env.Do("GET", "/api/v1/tenants/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	tenant, err := testhelper.Unmarshal[domain.Tenant](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if tenant.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, tenant.ID)
	}
}

func TestTenant_Get_NotFound(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("GET", "/api/v1/tenants/nonexistent-id", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestTenant_Update(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "Old Name", "code": "update-test"}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	cr, _ := testhelper.Unmarshal[createTenantResp](wc)
	created := cr.Tenant
	defer cleanupTenant(ctx, t, env, created.ID)

	w := env.Do("PUT", "/api/v1/tenants/"+created.ID, map[string]string{"name": "Updated Name"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	tenant, err := testhelper.Unmarshal[domain.Tenant](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if tenant.Name != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got %s", tenant.Name)
	}
}

func TestTenant_Update_NotFound(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("PUT", "/api/v1/tenants/nonexistent-id", map[string]string{"name": "X"})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestTenant_UpdateStatus(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "Status Tenant", "code": "status-test"}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	cr, _ := testhelper.Unmarshal[createTenantResp](wc)
	created := cr.Tenant
	defer cleanupTenant(ctx, t, env, created.ID)

	w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+created.ID+"/status", map[string]string{"status": "inactive"}, env.SaasAdminToken)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	tenant, err := testhelper.Unmarshal[domain.Tenant](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if tenant.Status != "inactive" {
		t.Fatalf("expected status 'inactive', got %s", tenant.Status)
	}
}

func TestTenant_UpdateStatus_Invalid(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{"name": "StatusInv Tenant", "code": "status-inv-test"}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	cr, _ := testhelper.Unmarshal[createTenantResp](wc)
	created := cr.Tenant
	defer cleanupTenant(ctx, t, env, created.ID)

	w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+created.ID+"/status", map[string]string{"status": "bogus"}, env.SaasAdminToken)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestTenant_AdminCreate_CreatesSubscription(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Admin Tenant Sub",
		"code": "admin-sub-test",
	}, env.SaasAdminToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	resp, err := testhelper.Unmarshal[createTenantResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	tenant := resp.Tenant
	defer cleanupTenant(ctx, t, env, tenant.ID)

	var subID string
	err = env.DB.QueryRow(ctx,
		`SELECT id FROM subscription_packages WHERE tenant_id = $1`, tenant.ID,
	).Scan(&subID)
	if err != nil {
		t.Fatalf("subscription not found for admin-created tenant: %v", err)
	}
}

type tenantAdminResp struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenantId"`
	Username    string `json:"username"`
	LoginName   string `json:"loginName"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	NewPassword string `json:"newPassword"`
}

type tenantAdminListResp struct {
	Items []tenantAdminResp `json:"items"`
	Total int               `json:"total"`
}

func TestTenantAdmin_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Admin Mgmt Tenant",
		"code": "admin-mgmt-test",
	}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create tenant: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	cr, _ := testhelper.Unmarshal[createTenantResp](wc)
	created := cr.Tenant
	defer cleanupTenant(ctx, t, env, created.ID)

	// List admins should contain the default admin created by createTenant.
	wl := env.DoWithToken("GET", "/api/v1/admin/tenants/"+created.ID+"/admins", nil, env.SaasAdminToken)
	if wl.Code != http.StatusOK {
		t.Fatalf("list admins: %d %s", wl.Code, testhelper.ErrMsg(wl))
	}
	list, _ := testhelper.Unmarshal[tenantAdminListResp](wl)
	if list.Total != 1 {
		t.Fatalf("expected 1 default admin, got %+v", list)
	}

	// Set a manual password for the default admin.
	defaultAdminID := list.Items[0].ID
	setPassword := "Abc12345"
	wp := env.DoWithToken("POST", "/api/v1/admin/tenants/"+created.ID+"/admins/"+defaultAdminID+"/reset-password", map[string]string{
		"password": setPassword,
	}, env.SaasAdminToken)
	if wp.Code != http.StatusOK {
		t.Fatalf("set password: %d %s", wp.Code, testhelper.ErrMsg(wp))
	}

	// Weak password should be rejected.
	ww := env.DoWithToken("POST", "/api/v1/admin/tenants/"+created.ID+"/admins/"+defaultAdminID+"/reset-password", map[string]string{
		"password": "weak",
	}, env.SaasAdminToken)
	if ww.Code != http.StatusBadRequest {
		t.Fatalf("weak password: expected 400, got %d %s", ww.Code, testhelper.ErrMsg(ww))
	}

	// Verify the set password can be used to log in via portal login.
	loginW := env.Do("POST", "/api/v1/auth/portal/login", map[string]string{
		"username": list.Items[0].Username,
		"password": setPassword,
	})
	if loginW.Code != http.StatusOK {
		t.Fatalf("portal login with set password: %d %s", loginW.Code, testhelper.ErrMsg(loginW))
	}

	// Create a new school admin.
	wc2 := env.DoWithToken("POST", "/api/v1/admin/tenants/"+created.ID+"/admins", map[string]string{
		"username": "extra-admin",
		"name":     "额外管理员",
	}, env.SaasAdminToken)
	if wc2.Code != http.StatusCreated {
		t.Fatalf("create admin: %d %s", wc2.Code, testhelper.ErrMsg(wc2))
	}
	newAdmin, _ := testhelper.Unmarshal[tenantAdminResp](wc2)
	if newAdmin.NewPassword == "" {
		t.Fatalf("expected new admin new password")
	}

	// Update the new admin.
	wu := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+created.ID+"/admins/"+newAdmin.ID, map[string]string{
		"username": "extra-admin-renamed",
		"name":     "已重命名管理员",
	}, env.SaasAdminToken)
	if wu.Code != http.StatusOK {
		t.Fatalf("update admin: %d %s", wu.Code, testhelper.ErrMsg(wu))
	}
	updated, _ := testhelper.Unmarshal[tenantAdminResp](wu)
	if updated.Username != "extra-admin-renamed" {
		t.Fatalf("expected username updated, got %s", updated.Username)
	}

	// Delete the new admin.
	wd := env.DoWithToken("DELETE", "/api/v1/admin/tenants/"+created.ID+"/admins/"+newAdmin.ID, nil, env.SaasAdminToken)
	if wd.Code != http.StatusOK {
		t.Fatalf("delete admin: %d %s", wd.Code, testhelper.ErrMsg(wd))
	}

	// List should now contain only the default admin again.
	wl2 := env.DoWithToken("GET", "/api/v1/admin/tenants/"+created.ID+"/admins", nil, env.SaasAdminToken)
	list2, _ := testhelper.Unmarshal[tenantAdminListResp](wl2)
	if list2.Total != 1 {
		t.Fatalf("expected 1 admin after delete, got %+v", list2)
	}
}

// cleanupEnterpriseTenant 清理超管创建的企业租户测试数据（含企业主体/角色/link）。
func cleanupEnterpriseTenant(env *testhelper.TestEnv, tenantID string) {
	ctx := context.Background()
	env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id IN (SELECT id FROM partner_enterprises WHERE tenant_id = $1)`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM roles WHERE tenant_id = $1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, tenantID)
}

// TestAdmin_CreateEnterpriseTenant 超管创建企业租户：企业租户+企业主体+管理员账号，
// 列表按 type 过滤，企业主体可查看/编辑（信用代码/联系人/展示开关）。
func TestAdmin_CreateEnterpriseTenant(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := uuid.NewString()[:8]
	enterpriseName := "超管企业-" + suffix
	username := "super_ent_" + suffix
	password := "abc12345"
	creditCode := "91320000" + suffix + "X"

	var tenantID string

	t.Run("create enterprise tenant", func(t *testing.T) {
		w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]interface{}{
			"name":           enterpriseName,
			"type":           "enterprise",
			"username":       username,
			"password":       password,
			"enterpriseCode": creditCode,
			"contact":        "张三",
			"phone":          "13800000000",
		}, env.SaasAdminToken)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		var resp createTenantResp
		var err error
		resp, err = testhelper.Unmarshal[createTenantResp](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		tenant := resp.Tenant
		tenantID = tenant.ID
		if tenant.Type != domain.TenantTypeEnterprise {
			t.Fatalf("expected type enterprise, got %s", tenant.Type)
		}
		var entCount int
		if err := env.DB.QueryRow(ctx,
			"SELECT COUNT(*) FROM partner_enterprises WHERE tenant_id = $1", tenantID).Scan(&entCount); err != nil {
			t.Fatalf("count enterprises: %v", err)
		}
		if entCount != 1 {
			t.Fatalf("expected 1 enterprise profile, got %d", entCount)
		}
		var userCount int
		if err := env.DB.QueryRow(ctx,
			"SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND platform = 'partner'", tenantID).Scan(&userCount); err != nil {
			t.Fatalf("count users: %v", err)
		}
		if userCount != 1 {
			t.Fatalf("expected 1 partner admin user, got %d", userCount)
		}
		var enterpriseRoleCount int
		if err := env.DB.QueryRow(ctx,
			"SELECT COUNT(*) FROM roles WHERE tenant_id = $1 AND code = 'enterprise_admin'", tenantID).Scan(&enterpriseRoleCount); err != nil {
			t.Fatalf("count roles: %v", err)
		}
		if enterpriseRoleCount != 1 {
			t.Fatalf("expected enterprise_admin role, got %d", enterpriseRoleCount)
		}
	})
	if tenantID == "" {
		t.Fatalf("创建企业租户失败，跳过后续用例")
	}
	defer cleanupEnterpriseTenant(env, tenantID)

	t.Run("admin list filtered by type", func(t *testing.T) {
		w := env.DoWithToken("GET", "/api/v1/admin/tenants?type=enterprise&limit=100", nil, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.Tenant](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total == 0 {
			t.Fatalf("expected enterprise tenants in list")
		}
		found := false
		for _, it := range items {
			if it.Type != domain.TenantTypeEnterprise {
				t.Fatalf("enterprise filter returned school tenant: %s", it.ID)
			}
			if it.ID == tenantID {
				found = true
			}
		}
		if !found {
			t.Fatalf("created enterprise tenant not in filtered list")
		}
	})

	t.Run("get enterprise profile", func(t *testing.T) {
		w := env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/enterprise", nil, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		var resp adminEnterpriseResp
		var err error
		resp, err = testhelper.Unmarshal[adminEnterpriseResp](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if resp.Enterprise.Name != enterpriseName {
			t.Fatalf("expected enterprise name %s, got %s", enterpriseName, resp.Enterprise.Name)
		}
		if resp.Enterprise.UnifiedSocialCreditCode == nil || *resp.Enterprise.UnifiedSocialCreditCode != creditCode {
			t.Fatalf("expected credit code %s, got %v", creditCode, resp.Enterprise.UnifiedSocialCreditCode)
		}
	})

	t.Run("update enterprise profile", func(t *testing.T) {
		w := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/enterprise", map[string]interface{}{
			"contactEmail": "ent@example.com",
			"enablePublic": true,
		}, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		var ent domain.AllianceEnterprise
		var err error
		ent, err = testhelper.Unmarshal[domain.AllianceEnterprise](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ent.ContactEmail == nil || *ent.ContactEmail != "ent@example.com" {
			t.Fatalf("expected email updated, got %v", ent.ContactEmail)
		}
		if !ent.EnablePublic {
			t.Fatalf("expected enablePublic true")
		}
		if ent.UnifiedSocialCreditCode == nil || *ent.UnifiedSocialCreditCode != creditCode {
			t.Fatalf("credit code should be preserved on partial update, got %v", ent.UnifiedSocialCreditCode)
		}
	})

	t.Run("created admin can login on partner platform", func(t *testing.T) {
		w := env.DoNoAuth("POST", "/api/v1/auth/partner/login", map[string]string{
			"username": username,
			"password": password,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("same username in another enterprise ok (multi-tenant login)", func(t *testing.T) {
		// 同一用户名可在多个企业注册（同一个人多个企业），登录时选择企业
		w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]interface{}{
			"name":     "另一家企业-" + suffix,
			"type":     "enterprise",
			"username": username,
			"password": password,
		}, env.SaasAdminToken)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		other, _ := testhelper.Unmarshal[createTenantResp](w)
		defer cleanupEnterpriseTenant(env, other.Tenant.ID)

		// 登录应返回多企业候选
		wl := env.DoNoAuth("POST", "/api/v1/auth/partner/login", map[string]string{
			"username": username,
			"password": password,
		})
		if wl.Code != http.StatusOK {
			t.Fatalf("login: %d %s", wl.Code, testhelper.ErrMsg(wl))
		}
		var lr partnerLoginResp2
		var err error
		lr, err = testhelper.Unmarshal[partnerLoginResp2](wl)
		if err != nil {
			t.Fatalf("unmarshal login: %v", err)
		}
		if !lr.NeedsTenantSelection || len(lr.Tenants) != 2 {
			t.Fatalf("expected 2 tenant options, got %+v", lr)
		}
	})
}

// TestAdmin_EnterpriseAdminCRUD 超管企业管理员配置：列表（含注册时的初始管理员）/
// 新增（随机密码，可登录 partner）/编辑/重置密码/删除。
func TestAdmin_EnterpriseAdminCRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := uuid.NewString()[:8]
	enterpriseName := "超管管理员企业-" + suffix
	username := "super_ent_adm_" + suffix

	// 先创建企业租户（自带 1 个企业管理员）
	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]interface{}{
		"name":     enterpriseName,
		"type":     "enterprise",
		"username": username,
		"password": "abc12345",
	}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create enterprise tenant: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[createTenantResp](wc)
	tenantID := created.Tenant.ID
	defer cleanupEnterpriseTenant(env, tenantID)

	t.Run("list includes initial admin", func(t *testing.T) {
		w := env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins", nil, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		list, _ := testhelper.Unmarshal[tenantAdminListResp](w)
		if list.Total != 1 {
			t.Fatalf("expected 1 initial admin, got %d", list.Total)
		}
		if list.Items[0].Username != username {
			t.Fatalf("expected initial admin %s, got %s", username, list.Items[0].Username)
		}
	})

	var newAdmin tenantAdminResp
	t.Run("create enterprise admin", func(t *testing.T) {
		w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins", map[string]string{
			"username": "ent_admin_extra_" + suffix,
			"name":     "企业管理员B",
		}, env.SaasAdminToken)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		newAdmin, _ = testhelper.Unmarshal[tenantAdminResp](w)
		if newAdmin.NewPassword == "" {
			t.Fatalf("expected initial password")
		}
		// 绑定 enterprise_admin 角色
		var roleCode string
		if err := env.DB.QueryRow(ctx, `
			SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1
		`, newAdmin.ID).Scan(&roleCode); err != nil {
			t.Fatalf("query role: %v", err)
		}
		if roleCode != "enterprise_admin" {
			t.Fatalf("expected enterprise_admin role, got %s", roleCode)
		}
		// 平台应为 partner
		var platform string
		if err := env.DB.QueryRow(ctx, `SELECT platform FROM users WHERE id = $1`, newAdmin.ID).Scan(&platform); err != nil {
			t.Fatalf("query platform: %v", err)
		}
		if platform != "partner" {
			t.Fatalf("expected partner platform, got %s", platform)
		}
	})

	t.Run("new admin can login on partner platform", func(t *testing.T) {
		w := env.DoNoAuth("POST", "/api/v1/auth/partner/login", map[string]string{
			"username": newAdmin.Username,
			"password": newAdmin.NewPassword,
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("same username in another enterprise ok", func(t *testing.T) {
		// 跨企业同名用户名允许（多企业登录场景）：在另一个企业创建与当前企业同名的管理员
		w2 := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]interface{}{
			"name":     "另一家企业-" + suffix,
			"type":     "enterprise",
			"username": "other_ent_" + suffix,
			"password": "abc12345",
		}, env.SaasAdminToken)
		if w2.Code != http.StatusCreated {
			t.Fatalf("create other enterprise: %d %s", w2.Code, testhelper.ErrMsg(w2))
		}
		other, _ := testhelper.Unmarshal[createTenantResp](w2)
		defer cleanupEnterpriseTenant(env, other.Tenant.ID)

		// 在另一家企业添加与当前企业初始管理员同名的管理员 → 应成功
		w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+other.Tenant.ID+"/enterprise-admins", map[string]string{
			"username": username,
			"name":     "同名管理员",
		}, env.SaasAdminToken)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("duplicate username within same tenant conflict", func(t *testing.T) {
		// 同租户内重复用户名 → login_name 唯一约束 → 409
		w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins", map[string]string{
			"username": username,
			"name":     "重复管理员",
		}, env.SaasAdminToken)
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("update enterprise admin", func(t *testing.T) {
		w := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins/"+newAdmin.ID, map[string]string{
			"username": "ent_admin_renamed_" + suffix,
			"name":     "企业管理员B改",
		}, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		updated, _ := testhelper.Unmarshal[tenantAdminResp](w)
		if updated.Username != "ent_admin_renamed_"+suffix {
			t.Fatalf("expected renamed username, got %s", updated.Username)
		}
	})

	t.Run("reset enterprise admin password", func(t *testing.T) {
		w := env.DoWithToken("POST", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins/"+newAdmin.ID+"/reset-password", map[string]string{
			"password": "newpass123",
		}, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		wl := env.DoNoAuth("POST", "/api/v1/auth/partner/login", map[string]string{
			"username": "ent_admin_renamed_" + suffix,
			"password": "newpass123",
		})
		if wl.Code != http.StatusOK {
			t.Fatalf("login with new password failed: %d %s", wl.Code, testhelper.ErrMsg(wl))
		}
	})

	t.Run("delete enterprise admin", func(t *testing.T) {
		w := env.DoWithToken("DELETE", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins/"+newAdmin.ID, nil, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		wl := env.DoWithToken("GET", "/api/v1/admin/tenants/"+tenantID+"/enterprise-admins", nil, env.SaasAdminToken)
		list, _ := testhelper.Unmarshal[tenantAdminListResp](wl)
		if list.Total != 1 {
			t.Fatalf("expected 1 admin after delete, got %d", list.Total)
		}
	})
}

// TestAdmin_UpdateEnterpriseSynced 企业编辑合并更新：名称/状态/信用代码/联系人
// 同时同步到租户与企业主体。
func TestAdmin_UpdateEnterpriseSynced(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	suffix := uuid.NewString()[:8]
	wc := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]interface{}{
		"name":           "同步更新企业-" + suffix,
		"type":           "enterprise",
		"username":       "sync_ent_" + suffix,
		"password":       "abc12345",
		"enterpriseCode": "91320000" + suffix,
		"contact":        "王五",
		"phone":          "13700000000",
	}, env.SaasAdminToken)
	if wc.Code != http.StatusCreated {
		t.Fatalf("create enterprise tenant: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[createTenantResp](wc)
	tenantID := created.Tenant.ID
	defer cleanupEnterpriseTenant(env, tenantID)

	t.Run("merged update syncs tenant and profile", func(t *testing.T) {
		newName := "同步更新企业改名-" + suffix
		w := env.DoWithToken("PUT", "/api/v1/admin/tenants/"+tenantID+"/enterprise", map[string]interface{}{
			"name":                    newName,
			"unifiedSocialCreditCode": "91329999" + suffix,
			"contactPerson":           "赵六",
			"contactPhone":            "13600000000",
			"contactEmail":            "sync@example.com",
			"enablePublic":            true,
			"status":                  "inactive",
		}, env.SaasAdminToken)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}

		// 租户同步
		var tenantName, contact, phone, enterpriseCode, status string
		if err := env.DB.QueryRow(ctx, `
			SELECT name, COALESCE(contact, ''), COALESCE(phone, ''), COALESCE(enterprise_code, ''), status
			FROM tenants WHERE id = $1
		`, tenantID).Scan(&tenantName, &contact, &phone, &enterpriseCode, &status); err != nil {
			t.Fatalf("query tenant: %v", err)
		}
		if tenantName != newName {
			t.Fatalf("tenant name not synced: %s", tenantName)
		}
		if contact != "赵六" || phone != "13600000000" {
			t.Fatalf("tenant contact not synced: %s/%s", contact, phone)
		}
		if enterpriseCode != "91329999"+suffix {
			t.Fatalf("tenant enterprise_code not synced: %s", enterpriseCode)
		}
		if status != "inactive" {
			t.Fatalf("tenant status not synced: %s", status)
		}

		// 企业主体同步
		var profileName, creditCode, person, email string
		if err := env.DB.QueryRow(ctx, `
			SELECT name, COALESCE(unified_social_credit_code, ''), COALESCE(contact_person, ''), COALESCE(contact_email, '')
			FROM partner_enterprises WHERE tenant_id = $1
		`, tenantID).Scan(&profileName, &creditCode, &person, &email); err != nil {
			t.Fatalf("query profile: %v", err)
		}
		if profileName != newName {
			t.Fatalf("profile name not synced: %s", profileName)
		}
		if creditCode != "91329999"+suffix || person != "赵六" || email != "sync@example.com" {
			t.Fatalf("profile fields not synced: %s/%s/%s", creditCode, person, email)
		}
	})
}
