package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestStaffTitle_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/staff-titles", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"code":        "test-title",
		"name":        "测试职称",
		"description": "测试描述",
		"status":      "active",
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	title, err := testhelper.Unmarshal[domain.StaffTitle](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM staff_titles WHERE id = $1", title.ID)

	wList := do("GET", "/api/v1/staff-titles?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.StaffTitle](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := do("GET", "/api/v1/staff-titles/"+title.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d %s", wGet.Code, testhelper.ErrMsg(wGet))
	}
	titleGet, err := testhelper.Unmarshal[domain.StaffTitle](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if titleGet.ID != title.ID {
		t.Fatalf("expected id %s, got %s", title.ID, titleGet.ID)
	}
	if titleGet.Description == nil || *titleGet.Description != "测试描述" {
		t.Fatalf("expected description '测试描述', got %v", titleGet.Description)
	}

	wUpd := do("PUT", "/api/v1/staff-titles/"+title.ID, map[string]interface{}{
		"name":        "更新职称",
		"description": "更新描述",
		"status":      "",
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	titleUpd, err := testhelper.Unmarshal[domain.StaffTitle](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if titleUpd.Name != "更新职称" {
		t.Fatalf("expected name '更新职称', got %s", titleUpd.Name)
	}
	// status 空串走 COALESCE(NULLIF($3,''),status) 分支，保持原状态
	if titleUpd.Status != "active" {
		t.Fatalf("expected status 'active' preserved, got %s", titleUpd.Status)
	}

	wStatus := do("POST", "/api/v1/staff-titles/"+title.ID+"/status", map[string]interface{}{
		"status": "disabled",
	})
	if wStatus.Code != http.StatusOK {
		t.Fatalf("toggle status: %d %s", wStatus.Code, testhelper.ErrMsg(wStatus))
	}

	wDel := do("DELETE", "/api/v1/staff-titles/"+title.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}
