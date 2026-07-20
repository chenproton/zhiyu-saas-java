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

func TestMajor_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/majors", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"code":     "test-major",
		"name":     "Test Major",
		"enabled":  true,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	major, err := testhelper.Unmarshal[domain.Major](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM majors WHERE id = $1", major.ID)

	wList := do("GET", "/api/v1/majors?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.Major](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := do("GET", "/api/v1/majors/"+major.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d", wGet.Code)
	}
	majorGet, err := testhelper.Unmarshal[domain.Major](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if majorGet.ID != major.ID {
		t.Fatalf("expected id %s, got %s", major.ID, majorGet.ID)
	}

	wUpd := do("PUT", "/api/v1/majors/"+major.ID, map[string]interface{}{
		"code":    "test-major-upd",
		"name":    "Updated Major",
		"enabled": false,
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	majorUpd, err := testhelper.Unmarshal[domain.Major](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if majorUpd.Name != "Updated Major" {
		t.Fatalf("expected name 'Updated Major', got %s", majorUpd.Name)
	}

	wDel := do("DELETE", "/api/v1/majors/"+major.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}

func TestIndustry_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/industries", map[string]interface{}{
		"tenantId": testhelper.TestTenantID,
		"code":     "test-industry",
		"name":     "Test Industry",
		"enabled":  true,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	industry, err := testhelper.Unmarshal[domain.Industry](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM industries WHERE id = $1", industry.ID)

	wList := do("GET", "/api/v1/industries?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.Industry](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := do("GET", "/api/v1/industries/"+industry.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d", wGet.Code)
	}
	indGet, err := testhelper.Unmarshal[domain.Industry](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if indGet.ID != industry.ID {
		t.Fatalf("expected id %s, got %s", industry.ID, indGet.ID)
	}

	wUpd := do("PUT", "/api/v1/industries/"+industry.ID, map[string]interface{}{
		"code":    "test-industry-upd",
		"name":    "Updated Industry",
		"enabled": false,
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	indUpd, err := testhelper.Unmarshal[domain.Industry](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if indUpd.Name != "Updated Industry" {
		t.Fatalf("expected name 'Updated Industry', got %s", indUpd.Name)
	}

	wDel := do("DELETE", "/api/v1/industries/"+industry.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}

func TestResourceCode_Read(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	id := uuid.NewString()
	_, err := env.DB.Exec(ctx, `
		INSERT INTO resource_codes (id, tenant_id, code, name, description, type)
		VALUES ($1, $2, 'test-rc', 'Test Resource Code', 'Test', 'resource')
	`, id, testhelper.TestTenantID)
	if err != nil {
		t.Fatalf("seed resource code: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM resource_codes WHERE id = $1", id)

	wList := do("GET", "/api/v1/resource-codes?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.ResourceCode](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := do("GET", "/api/v1/resource-codes/"+id, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d %s", wGet.Code, testhelper.ErrMsg(wGet))
	}
	rcGet, err := testhelper.Unmarshal[domain.ResourceCode](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if rcGet.ID != id {
		t.Fatalf("expected id %s, got %s", id, rcGet.ID)
	}
}

func TestPlatformLink_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.Do("POST", "/api/v1/platform-links", map[string]interface{}{
		"platform": "test-platform",
		"url":      "https://example.com",
		"enabled":  true,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	link, err := testhelper.Unmarshal[domain.PlatformLink](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM platform_links WHERE id = $1", link.ID)

	wList := env.Do("GET", "/api/v1/platform-links", nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.PlatformLink](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := env.Do("GET", "/api/v1/platform-links/"+link.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d", wGet.Code)
	}
	linkGet, err := testhelper.Unmarshal[domain.PlatformLink](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if linkGet.ID != link.ID {
		t.Fatalf("expected id %s, got %s", link.ID, linkGet.ID)
	}

	wUpd := env.Do("PUT", "/api/v1/platform-links/"+link.ID, map[string]interface{}{
		"url":     "https://updated.example.com",
		"enabled": false,
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	linkUpd, err := testhelper.Unmarshal[domain.PlatformLink](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if linkUpd.URL != "https://updated.example.com" {
		t.Fatalf("expected url 'https://updated.example.com', got %s", linkUpd.URL)
	}

	wDel := env.Do("DELETE", "/api/v1/platform-links/"+link.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}

func TestAppModule_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.Do("POST", "/api/v1/app-modules", map[string]interface{}{
		"platform":    "test-pf",
		"title":       "Test Module",
		"description": "Test Desc",
		"href":        "/test",
		"sortOrder":   1,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	mod, err := testhelper.Unmarshal[domain.AppModule](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM app_modules WHERE id = $1", mod.ID)

	wList := env.Do("GET", "/api/v1/app-modules?platform=test-pf", nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}

	wGet := env.Do("GET", "/api/v1/app-modules/"+mod.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d", wGet.Code)
	}
	modGet, err := testhelper.Unmarshal[domain.AppModule](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if modGet.ID != mod.ID {
		t.Fatalf("expected id %s, got %s", mod.ID, modGet.ID)
	}

	wUpd := env.Do("PUT", "/api/v1/app-modules/"+mod.ID, map[string]interface{}{
		"platform":    "test-pf",
		"title":       "Updated Module",
		"description": "Updated Desc",
		"href":        "/updated",
		"sortOrder":   2,
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	modUpd, err := testhelper.Unmarshal[domain.AppModule](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if modUpd.Title != "Updated Module" {
		t.Fatalf("expected title 'Updated Module', got %s", modUpd.Title)
	}

	wDel := env.Do("DELETE", "/api/v1/app-modules/"+mod.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}

func TestSubscription_Get(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	w := env.Do("GET", "/api/v1/subscriptions?tenantId="+testhelper.TestTenantID, nil)
	if w.Code == http.StatusInternalServerError {
		t.Fatalf("unexpected 500: %s", testhelper.ErrMsg(w))
	}
}

func TestLogs(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	wLogin := env.Do("GET", "/api/v1/logs/login?tenantId="+testhelper.TestTenantID, nil)
	if wLogin.Code != http.StatusOK {
		t.Fatalf("login logs: expected 200, got %d", wLogin.Code)
	}

	wOp := env.Do("GET", "/api/v1/logs/operation?tenantId="+testhelper.TestTenantID, nil)
	if wOp.Code != http.StatusOK {
		t.Fatalf("operation logs: expected 200, got %d", wOp.Code)
	}
}
