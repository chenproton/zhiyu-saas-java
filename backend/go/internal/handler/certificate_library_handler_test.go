package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestCertificateLibrary_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity(testhelper.TestOperatorID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	wc := do("POST", "/api/v1/job/certificate-library", map[string]interface{}{
		"tenantId":    testhelper.TestTenantID,
		"name":        "测试证书",
		"url":         "https://example.com/cert.pdf",
		"description": "证书描述",
		"imageUrl":    "https://example.com/cert.png",
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	item, err := testhelper.Unmarshal[domain.CertificateLibraryItem](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM certificate_library WHERE id = $1", item.ID)

	wList := do("GET", "/api/v1/job/certificate-library?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d", wList.Code)
	}
	items, _, err := testhelper.UnmarshalList[domain.CertificateLibraryItem](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected items > 0")
	}

	wGet := do("GET", "/api/v1/job/certificate-library/"+item.ID, nil)
	if wGet.Code != http.StatusOK {
		t.Fatalf("get: %d %s", wGet.Code, testhelper.ErrMsg(wGet))
	}
	itemGet, err := testhelper.Unmarshal[domain.CertificateLibraryItem](wGet)
	if err != nil {
		t.Fatalf("unmarshal get: %v", err)
	}
	if itemGet.ID != item.ID {
		t.Fatalf("expected id %s, got %s", item.ID, itemGet.ID)
	}
	if itemGet.URL == nil || *itemGet.URL != "https://example.com/cert.pdf" {
		t.Fatalf("expected url, got %v", itemGet.URL)
	}

	wUpd := do("PUT", "/api/v1/job/certificate-library/"+item.ID, map[string]interface{}{
		"name":        "更新证书",
		"url":         "https://example.com/cert-v2.pdf",
		"description": "更新描述",
		"imageUrl":    "",
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	itemUpd, err := testhelper.Unmarshal[domain.CertificateLibraryItem](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if itemUpd.Name != "更新证书" {
		t.Fatalf("expected name '更新证书', got %s", itemUpd.Name)
	}

	wDel := do("DELETE", "/api/v1/job/certificate-library/"+item.ID, nil)
	if wDel.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wDel.Code, testhelper.ErrMsg(wDel))
	}
}
