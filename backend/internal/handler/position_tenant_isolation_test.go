package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPosition_TenantIsolation 验证岗位读/写接口的租户隔离：
// 租户 B 用户既看不到租户 A 的岗位（列表），也不能按 id 读取/修改/删除。
func TestPosition_TenantIsolation(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	otherTenantID := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	otherToken := env.NewUserToken("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", otherTenantID, domain.UserRoleOperator, nil)

	var positionID string

	t.Run("CreateAndPublishInTenantA", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
			"name":         "Tenant A Position",
			"positionType": "enterprise",
			"version":      "v1.0",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.TenantID != testhelper.TestTenantID {
			t.Fatalf("position tenant = %q, want %q", pos.TenantID, testhelper.TestTenantID)
		}
		positionID = pos.ID

		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/submit", positionID), nil); w.Code != http.StatusOK {
			t.Fatalf("submit: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/review", positionID), map[string]interface{}{"status": "approved"}); w.Code != http.StatusOK {
			t.Fatalf("review: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/publish", positionID), nil); w.Code != http.StatusOK {
			t.Fatalf("publish: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
	defer func() {
		if positionID != "" {
			env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
		}
	}()

	t.Run("PublicListIsTenantScoped", func(t *testing.T) {
		// 租户 A 能看到自己已发布的岗位
		wA := env.Do("GET", "/api/v1/job/public/positions?limit=200", nil)
		if wA.Code != http.StatusOK {
			t.Fatalf("tenant A public list: expected 200, got %d: %s", wA.Code, testhelper.ErrMsg(wA))
		}
		itemsA, _, err := testhelper.UnmarshalList[domain.CareerPosition](wA)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if !containsPosition(itemsA, positionID) {
			t.Fatalf("tenant A public list should contain own published position %s", positionID)
		}

		// 租户 B 不应看到租户 A 的岗位
		wB := env.DoWithToken("GET", "/api/v1/job/public/positions?limit=200", nil, otherToken)
		if wB.Code != http.StatusOK {
			t.Fatalf("tenant B public list: expected 200, got %d: %s", wB.Code, testhelper.ErrMsg(wB))
		}
		itemsB, _, err := testhelper.UnmarshalList[domain.CareerPosition](wB)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if containsPosition(itemsB, positionID) {
			t.Fatalf("tenant B public list leaked tenant A position %s", positionID)
		}
	})

	t.Run("PublicGetRejectsOtherTenant", func(t *testing.T) {
		w := env.DoWithToken("GET", fmt.Sprintf("/api/v1/job/public/positions/%s", positionID), nil, otherToken)
		if w.Code != http.StatusForbidden {
			t.Fatalf("tenant B public get: expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		wOwn := env.Do("GET", fmt.Sprintf("/api/v1/job/public/positions/%s", positionID), nil)
		if wOwn.Code != http.StatusOK {
			t.Fatalf("tenant A public get: expected 200, got %d: %s", wOwn.Code, testhelper.ErrMsg(wOwn))
		}
	})

	t.Run("AdminGetRejectsOtherTenant", func(t *testing.T) {
		w := env.DoWithToken("GET", fmt.Sprintf("/api/v1/job/positions/%s", positionID), nil, otherToken)
		if w.Code != http.StatusForbidden {
			t.Fatalf("tenant B get: expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("UpdateRejectsOtherTenant", func(t *testing.T) {
		w := env.DoWithToken("PUT", fmt.Sprintf("/api/v1/job/positions/%s", positionID), map[string]interface{}{
			"name": "Hacked Name", "positionType": "enterprise", "version": "v1.0",
		}, otherToken)
		if w.Code != http.StatusForbidden {
			t.Fatalf("tenant B update: expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("SaveFullRejectsOtherTenant", func(t *testing.T) {
		w := env.DoWithToken("PUT", fmt.Sprintf("/api/v1/job/positions/%s/save-full", positionID), map[string]interface{}{
			"name": "Hacked SaveFull", "positionType": "enterprise", "version": "v1.0",
		}, otherToken)
		if w.Code != http.StatusForbidden {
			t.Fatalf("tenant B save-full: expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("DeleteRejectsOtherTenant", func(t *testing.T) {
		w := env.DoWithToken("DELETE", fmt.Sprintf("/api/v1/job/positions/%s", positionID), nil, otherToken)
		if w.Code != http.StatusForbidden {
			t.Fatalf("tenant B delete: expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		// 岗位应仍存在（未被租户 B 删掉）
		wOwn := env.Do("GET", fmt.Sprintf("/api/v1/job/positions/%s", positionID), nil)
		if wOwn.Code != http.StatusOK {
			t.Fatalf("position should still exist after tenant B delete attempt, got %d: %s", wOwn.Code, testhelper.ErrMsg(wOwn))
		}
	})
}

func containsPosition(items []domain.CareerPosition, id string) bool {
	for _, p := range items {
		if p.ID == id {
			return true
		}
	}
	return false
}
