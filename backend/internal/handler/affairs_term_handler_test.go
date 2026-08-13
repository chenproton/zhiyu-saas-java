package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAffairsTerm_CRUD 学期 CRUD 全链路（此前该 handler 无任何层测试）。
func TestAffairsTerm_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	schoolAdminToken := env.NewTokenWithIdentity("term-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, schoolAdminToken)
	}

	name := "SMOKE_测试学期" + time.Now().Format("150405")
	wc := do("POST", "/api/v1/affairs/terms", map[string]interface{}{
		"name":       name,
		"startDate":  "2026-09-01",
		"endDate":    "2027-01-15",
		"weeksCount": 20,
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	term, err := testhelper.Unmarshal[domain.Term](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM terms WHERE id = $1", term.ID)

	wList := do("GET", "/api/v1/affairs/terms?tenantId="+testhelper.TestTenantID, nil)
	if wList.Code != http.StatusOK {
		t.Fatalf("list: %d %s", wList.Code, testhelper.ErrMsg(wList))
	}
	items, _, err := testhelper.UnmarshalList[domain.Term](wList)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected terms list non-empty")
	}

	wUpd := do("PUT", "/api/v1/affairs/terms/"+term.ID, map[string]interface{}{
		"name":       name + "-更新",
		"startDate":  "2026-09-01",
		"endDate":    "2027-02-28",
		"weeksCount": 24,
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	termUpd, err := testhelper.Unmarshal[domain.Term](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if termUpd.Name != name+"-更新" || termUpd.WeeksCount != 24 {
		t.Fatalf("unexpected updated term: %+v", termUpd)
	}

	wd := do("DELETE", "/api/v1/affairs/terms/"+term.ID, nil)
	if wd.Code != http.StatusOK {
		t.Fatalf("delete: %d %s", wd.Code, testhelper.ErrMsg(wd))
	}

	// 学期无按 id 查询路由，删除后列表不应再包含该学期
	wList2 := do("GET", "/api/v1/affairs/terms?tenantId="+testhelper.TestTenantID, nil)
	if wList2.Code != http.StatusOK {
		t.Fatalf("list after delete: %d", wList2.Code)
	}
	items2, _, err := testhelper.UnmarshalList[domain.Term](wList2)
	if err != nil {
		t.Fatalf("unmarshal list after delete: %v", err)
	}
	for _, it := range items2 {
		if it.ID == term.ID {
			t.Fatalf("term %s still present after delete", term.ID)
		}
	}
}
