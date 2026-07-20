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

func createTestOrgType(t *testing.T, env *testhelper.TestEnv) string {
	t.Helper()
	ctx := context.Background()
	id := uuid.NewString()
	name := "TestOrgType_" + id[:8]
	_, err := env.DB.Exec(ctx,
		`INSERT INTO org_types (id, tenant_id, name, category) VALUES ($1, $2, $3, 'internal')`,
		id, testhelper.TestTenantID, name,
	)
	if err != nil {
		t.Fatalf("create org type: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(context.Background(), "DELETE FROM org_types WHERE id = $1", id)
	})
	return id
}

func TestOrg_Create(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	w := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "Test Org",
		"typeId":   typeID,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	org, err := testhelper.Unmarshal[domain.Organization](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if org.Name != "Test Org" {
		t.Fatalf("expected name 'Test Org', got %s", org.Name)
	}
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", org.ID)
}

func TestOrg_Create_MissingFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	w := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"typeId":   "some-type-id",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestOrg_List(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	w1 := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "OrgA",
		"typeId":   typeID,
	})
	if w1.Code != http.StatusCreated {
		t.Fatalf("create 1: %d %s", w1.Code, testhelper.ErrMsg(w1))
	}
	org1, _ := testhelper.Unmarshal[domain.Organization](w1)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", org1.ID)

	w2 := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "OrgB",
		"typeId":   typeID,
	})
	if w2.Code != http.StatusCreated {
		t.Fatalf("create 2: %d %s", w2.Code, testhelper.ErrMsg(w2))
	}
	org2, _ := testhelper.Unmarshal[domain.Organization](w2)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", org2.ID)

	w := do("GET", "/api/v1/organizations?tenantId="+testhelper.TestTenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	items, total, err := testhelper.UnmarshalList[domain.Organization](w)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}
	if total < 2 {
		t.Fatalf("expected total >= 2, got %d", total)
	}
}

func TestOrg_Tree(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	wParent := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "Parent Org",
		"typeId":   typeID,
	})
	if wParent.Code != http.StatusCreated {
		t.Fatalf("create parent: %d %s", wParent.Code, testhelper.ErrMsg(wParent))
	}
	parent, _ := testhelper.Unmarshal[domain.Organization](wParent)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", parent.ID)

	wChild := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "Child Org",
		"typeId":   typeID,
		"parentId": parent.ID,
	})
	if wChild.Code != http.StatusCreated {
		t.Fatalf("create child: %d %s", wChild.Code, testhelper.ErrMsg(wChild))
	}
	child, _ := testhelper.Unmarshal[domain.Organization](wChild)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", child.ID)

	w := do("GET", "/api/v1/organizations/tree?tenantId="+testhelper.TestTenantID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	type treeResp struct {
		Items []struct {
			domain.Organization
			Children []struct {
				domain.Organization
			} `json:"children"`
		} `json:"items"`
	}
	tr, err := testhelper.Unmarshal[treeResp](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(tr.Items) == 0 {
		t.Fatal("expected tree items > 0")
	}
}

func TestOrg_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	wc := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "GetOrg",
		"typeId":   typeID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Organization](wc)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", created.ID)

	w := do("GET", "/api/v1/organizations/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	org, err := testhelper.Unmarshal[domain.Organization](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if org.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, org.ID)
	}
}

func TestOrg_Get_NotFound(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	w := do("GET", "/api/v1/organizations/nonexistent", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestOrg_Update(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	wc := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "OldOrg",
		"typeId":   typeID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Organization](wc)
	defer env.DB.Exec(ctx, "DELETE FROM organizations WHERE id = $1", created.ID)

	w := do("PUT", "/api/v1/organizations/"+created.ID, map[string]interface{}{
		"name":   "UpdatedOrg",
		"typeId": typeID,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	org, err := testhelper.Unmarshal[domain.Organization](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if org.Name != "UpdatedOrg" {
		t.Fatalf("expected name 'UpdatedOrg', got %s", org.Name)
	}
}

func TestOrg_Delete(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	typeID := createTestOrgType(t, env)

	wc := do("POST", "/api/v1/organizations", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"name":     "DeleteOrg",
		"typeId":   typeID,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	created, _ := testhelper.Unmarshal[domain.Organization](wc)

	w := do("DELETE", "/api/v1/organizations/"+created.ID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	_ = ctx
	wg := do("GET", "/api/v1/organizations/"+created.ID, nil)
	if wg.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", wg.Code)
	}
}

func TestOrgType_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	var typeID string

	t.Run("Create", func(t *testing.T) {
		w := do("POST", "/api/v1/org-types", map[string]interface{}{
			"tenantId":    testhelper.TestTenantID,
			"name":        "Test Org Type",
			"category":    "internal",
			"description": "A test org type",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		ot, err := testhelper.Unmarshal[domain.OrgType](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ot.Name != "Test Org Type" {
			t.Errorf("name = %q, want %q", ot.Name, "Test Org Type")
		}
		if ot.Category != domain.OrgTypeCategoryInternal {
			t.Errorf("category = %q, want internal", ot.Category)
		}
		typeID = ot.ID
	})
	defer func() {
		if typeID != "" {
			env.DB.Exec(ctx, "DELETE FROM org_types WHERE id = $1", typeID)
		}
	}()

	if typeID == "" {
		t.Fatal("no created org type ID")
	}

	t.Run("List", func(t *testing.T) {
		w := do("GET", "/api/v1/org-types?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.OrgType](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want >= 1", total)
		}
		_ = items
	})

	t.Run("Get", func(t *testing.T) {
		w := do("GET", "/api/v1/org-types/"+typeID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		ot, err := testhelper.Unmarshal[domain.OrgType](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ot.ID != typeID {
			t.Errorf("ID = %q, want %q", ot.ID, typeID)
		}
	})

	t.Run("Update", func(t *testing.T) {
		w := do("PUT", "/api/v1/org-types/"+typeID, map[string]interface{}{
			"name":        "Updated Org Type",
			"category":    "business",
			"description": "Updated description",
		})
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		ot, err := testhelper.Unmarshal[domain.OrgType](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ot.Name != "Updated Org Type" {
			t.Errorf("name = %q, want %q", ot.Name, "Updated Org Type")
		}
		if ot.Category != domain.OrgTypeCategoryBusiness {
			t.Errorf("category = %q, want business", ot.Category)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		deletedID := typeID
		w := do("DELETE", "/api/v1/org-types/"+deletedID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		typeID = ""

		w = do("GET", "/api/v1/org-types/"+deletedID, nil)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404 after delete, got %d", w.Code)
		}
	})
}
