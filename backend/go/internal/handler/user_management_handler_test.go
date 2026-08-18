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

func createTestRole(t *testing.T, env *testhelper.TestEnv) string {
	t.Helper()
	ctx := context.Background()
	id := uuid.NewString()
	code := "test-role-" + id[:8]
	_, err := env.DB.Exec(ctx,
		`INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status) VALUES ($1, $2, $3, $4, '', '{}', 0, 'active')`,
		id, testhelper.TestTenantID, code, "Test Role",
	)
	if err != nil {
		t.Fatalf("create role: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(context.Background(), "DELETE FROM roles WHERE id = $1", id)
	})
	return id
}

func TestUser_Create(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	w := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "newtestuser",
		"password": "testpass",
		"name":     "Test User",
		"roleId":   roleID,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	user, err := testhelper.Unmarshal[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if user.Username != "newtestuser" {
		t.Fatalf("expected username 'newtestuser', got %s", user.Username)
	}
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)
}

func TestUser_List(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	wc := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "listuser",
		"password": "testpass",
		"name":     "List User",
		"roleId":   roleID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	user, _ := testhelper.Unmarshal[domain.User](wc)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)

	w := do("GET", "/api/v1/users?tenantId="+testhelper.TestTenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}
}

func TestUser_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	wc := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "getuser",
		"password": "testpass",
		"name":     "Get User",
		"roleId":   roleID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.User](wc)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)

	w := do("GET", "/api/v1/users/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	user, err := testhelper.Unmarshal[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if user.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, user.ID)
	}
}

func TestUser_Update(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	wc := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "updateuser",
		"password": "testpass",
		"name":     "Old Name",
		"roleId":   roleID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.User](wc)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)

	w := do("PUT", "/api/v1/users/"+created.ID, map[string]interface{}{
		"username": "updateuser",
		"name":     "Updated Name",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	user, err := testhelper.Unmarshal[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if user.Name != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got %s", user.Name)
	}
}

func TestUser_Delete(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	wc := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "deleteuser",
		"password": "testpass",
		"name":     "Delete User",
		"roleId":   roleID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.User](wc)

	w := do("DELETE", "/api/v1/users/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	wg := do("GET", "/api/v1/users/"+created.ID, nil)
	if wg.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", wg.Code)
	}

	_ = ctx
}

func TestUser_UpdateStatus(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	wc := do("POST", "/api/v1/users", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"username": "statususer",
		"password": "testpass",
		"name":     "Status User",
		"roleId":   roleID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.User](wc)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)

	w := do("POST", "/api/v1/users/"+created.ID+"/status", map[string]string{
		"status": "disabled",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	user, err := testhelper.Unmarshal[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if user.Status != "disabled" {
		t.Fatalf("expected status 'disabled', got %s", user.Status)
	}
}

func TestUser_BatchCreate(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	roleID := createTestRole(t, env)

	w := do("POST", "/api/v1/users/batch", map[string]interface{}{
		"users": []map[string]interface{}{
			{
				"tenantId": testhelper.TestTenantID,
				"username": "batchuser1",
				"password": "testpass",
				"name":     "Batch User 1",
				"roleId":   roleID,
			},
			{
				"tenantId": testhelper.TestTenantID,
				"username": "batchuser2",
				"password": "testpass",
				"name":     "Batch User 2",
				"roleId":   roleID,
			},
		},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	items, total, err := testhelper.UnmarshalList[domain.User](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	for _, u := range items {
		defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", u.ID)
	}
}
