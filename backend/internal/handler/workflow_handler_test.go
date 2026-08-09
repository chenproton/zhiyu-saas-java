package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestWorkflow_ListByIDs ids 逗号拼接过滤回归：ANY() 标量传参曾报
// malformed array literal 导致审批页 500。
func TestWorkflow_ListByIDs(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	idA, idB, idC := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, id := range []string{idA, idB, idC} {
		if _, err := env.DB.Exec(ctx, `INSERT INTO workflows (id, tenant_id, name) VALUES ($1, $2, $3)`,
			id, testhelper.TestTenantID, "审批流-"+id[:8]); err != nil {
			t.Fatalf("预置审批流失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM workflows WHERE id IN ($1,$2,$3)`, idA, idB, idC)

	svc := service.New(store.New(env.DB))
	h := &handler.WorkflowHandler{Service: service.NewApprovalService(svc)}
	r := chi.NewRouter()
	r.Get("/workflows", h.List)

	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	t.Run("comma joined ids", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/workflows?ids="+idA+","+idB, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[domain.Workflow](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items) != 2 {
			t.Fatalf("应只返回 2 条指定审批流: %s", w.Body.String())
		}
	})

	t.Run("single id", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/workflows?ids="+idC, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[domain.Workflow](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items) != 1 || items[0].ID != idC {
			t.Fatalf("单 id 过滤错误: %s", w.Body.String())
		}
	})
}
