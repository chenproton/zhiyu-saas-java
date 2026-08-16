package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestEmptyList(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("GET", "/api/v1/resource-codes?type=zzz-nonexistent-type", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.ResourceCode](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
}

func TestPagination(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := uuid.NewString()
	_, err := env.DB.Exec(ctx,
		`INSERT INTO org_types (id, tenant_id, name, category) VALUES ($1, $2, $3, 'internal')`,
		typeID, testhelper.TestTenantID, "Pagination OrgType")
	if err != nil {
		t.Fatalf("create org type: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM org_types WHERE id = $1", typeID)

	for i := 1; i <= 3; i++ {
		w := do("POST", "/api/v1/organizations", map[string]interface{}{
			"tenantId": testhelper.TestTenantID,
			"name":     fmt.Sprintf("Pagination Org %d", i),
			"typeId":   typeID,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create org %d: expected 201, got %d", i, w.Code)
		}
		org, _ := testhelper.Unmarshal[domain.Organization](w)
		defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", org.ID)
	}

	w := do("GET", "/api/v1/organizations?tenantId="+testhelper.TestTenantID+"&limit=2&offset=0", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.Organization](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2 items (limit=2), got %d", len(items))
	}
	if total < 3 {
		t.Errorf("expected total >= 3, got %d", total)
	}
}

func TestSearchFilter(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	body1 := map[string]interface{}{
		"name":         "SearchTarget Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w1 := env.Do("POST", "/api/v1/job/positions", body1)
	if w1.Code != http.StatusCreated {
		t.Fatalf("create position 1: %d %s", w1.Code, testhelper.ErrMsg(w1))
	}
	p1, _ := testhelper.Unmarshal[domain.CareerPosition](w1)
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", p1.ID)

	body2 := map[string]interface{}{
		"name":         "Noise Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w2 := env.Do("POST", "/api/v1/job/positions", body2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("create position 2: %d %s", w2.Code, testhelper.ErrMsg(w2))
	}
	p2, _ := testhelper.Unmarshal[domain.CareerPosition](w2)
	defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", p2.ID)

	w := env.Do("GET", "/api/v1/job/positions?search=SearchTarget", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total < 1 {
		t.Fatal("expected at least 1 search result")
	}
	found := false
	hasNoise := false
	for _, item := range items {
		if item.ID == p1.ID {
			found = true
		}
		if item.ID == p2.ID {
			hasNoise = true
		}
	}
	if !found {
		t.Error("SearchTarget Position not found in search results")
	}
	if hasNoise {
		t.Error("Noise Position should not appear in search results")
	}
}

func TestUnauthorizedAccess(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.DoNoAuth("GET", "/api/v1/tenants", nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated access, got %d", w.Code)
	}
}

func TestNonOperatorAccess(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	schoolUserID := uuid.NewString()
	token := env.NewTokenWithIdentity(schoolUserID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	_, err := env.DB.Exec(ctx,
		`INSERT INTO users (id, tenant_id, role, username, login_name, password_hash, name, status, title_ids) VALUES ($1, $2, 'school', $3, $3, $4, 'School User', 'active', '{}') ON CONFLICT (id) DO NOTHING`,
		schoolUserID, testhelper.TestTenantID, schoolUserID[:8], "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
	if err != nil {
		t.Fatalf("create school user: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", schoolUserID)

	// 生产路由中租户创建只存在于 saas 平台管理端 /admin/tenants；
	// school_admin（portal 平台、非 platform_admin）访问应被平台隔离/角色门禁拒绝（403）
	w := env.DoWithToken("POST", "/api/v1/admin/tenants", map[string]string{
		"name": "Unauthorized Create",
		"code": "unauth",
	}, token)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-operator creating tenant, got %d", w.Code)
	}
}
