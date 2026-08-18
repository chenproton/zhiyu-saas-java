package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestRole_Create(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	w := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "test-role",
		"name":        "Test Role",
		"permissions": domain.JSONMap{"read": true},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	role, err := testhelper.Unmarshal[domain.Role](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if role.Code != "test-role" {
		t.Fatalf("expected code 'test-role', got %s", role.Code)
	}
	defer env.DB.Exec(ctx, "DELETE FROM roles WHERE id = $1", role.ID)
}

func TestRole_List(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "list-role",
		"name":        "List Role",
		"permissions": domain.JSONMap{},
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	role, _ := testhelper.Unmarshal[domain.Role](wc)
	defer env.DB.Exec(ctx, "DELETE FROM roles WHERE id = $1", role.ID)

	w := do("GET", "/api/v1/roles?tenantId="+testhelper.TestTenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.Role](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}
}

func TestRole_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "get-role",
		"name":        "Get Role",
		"permissions": domain.JSONMap{},
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Role](wc)
	defer env.DB.Exec(ctx, "DELETE FROM roles WHERE id = $1", created.ID)

	w := do("GET", "/api/v1/roles/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	role, err := testhelper.Unmarshal[domain.Role](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if role.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, role.ID)
	}
}

func TestRole_Update(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "update-role",
		"name":        "Old Role",
		"permissions": domain.JSONMap{},
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Role](wc)
	defer env.DB.Exec(ctx, "DELETE FROM roles WHERE id = $1", created.ID)

	w := do("PUT", "/api/v1/roles/"+created.ID, map[string]interface{}{
		"name":        "Updated Role",
		"permissions": domain.JSONMap{"admin": true},
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	role, err := testhelper.Unmarshal[domain.Role](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if role.Name != "Updated Role" {
		t.Fatalf("expected name 'Updated Role', got %s", role.Name)
	}
}

func TestRole_Delete(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "delete-role",
		"name":        "Delete Role",
		"permissions": domain.JSONMap{},
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Role](wc)

	w := do("DELETE", "/api/v1/roles/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	wg := do("GET", "/api/v1/roles/"+created.ID, nil)
	if wg.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", wg.Code)
	}
}

func TestRole_Assign(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/roles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "assign-role",
		"name":        "Assign Role",
		"permissions": domain.JSONMap{},
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create role: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	role, _ := testhelper.Unmarshal[domain.Role](wc)
	defer env.DB.Exec(ctx, "DELETE FROM roles WHERE id = $1", role.ID)

	userID := uuid.NewString()
	tid := testhelper.TestTenantID
	_, err := env.DB.Exec(ctx,
		`INSERT INTO users (id, tenant_id, role, login_name, username, password_hash, name, status) VALUES ($1, $2, 'operator', $3, $3, $4, 'Assign Test User', 'active') ON CONFLICT (id) DO NOTHING`,
		userID, tid, userID, "$2a$10$placeholder",
	)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)

	w := do("POST", "/api/v1/roles/"+role.ID+"/assign", map[string]string{
		"userId": userID,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	resp, err := testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["roleId"] != role.ID || resp["userId"] != userID {
		t.Fatalf("unexpected response: %v", resp)
	}
}
