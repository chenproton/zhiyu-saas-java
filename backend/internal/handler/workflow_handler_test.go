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

// TestWorkflow_DeleteBlockedByPendingApproval 删除保护回归：仍有待处理审批单的审批流禁止删除（409），
// 全部完结后允许删除（200）。
func TestWorkflow_DeleteBlockedByPendingApproval(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	wfID := uuid.NewString()
	recordID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO workflows (id, tenant_id, name) VALUES ($1, $2, $3)`,
		wfID, testhelper.TestTenantID, "审批流-删除保护"); err != nil {
		t.Fatalf("预置审批流失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM workflows WHERE id = $1`, wfID)

	// 预置真实提交人（approval_records.submitter_id 有 FK 约束，不依赖测试库残留用户）
	submitterID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'wf_submitter', 'wf_submitter', $3, '审批提交人', 'active', '{}')
	`, submitterID, testhelper.TestTenantID, "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"); err != nil {
		t.Fatalf("预置提交人失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM users WHERE id = $1`, submitterID)

	svc := service.New(store.New(env.DB))
	h := &handler.WorkflowHandler{Service: service.NewApprovalService(svc)}
	r := chi.NewRouter()
	r.Delete("/workflows/{id}", h.Delete)

	claims := claimsWithRoles(submitterID, domain.RoleTeacher)

	t.Run("有待处理审批单时阻止删除", func(t *testing.T) {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO approval_records (id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id)
			VALUES ($1, $2, 'course', $3, $4, 0, 'pending', $5)`,
			recordID, testhelper.TestTenantID, uuid.NewString(), wfID, submitterID); err != nil {
			t.Fatalf("预置待审批记录失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM approval_records WHERE id = $1`, recordID)

		w := doWithClaims(r, http.MethodDelete, "/workflows/"+wfID, nil, claims)
		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
		if msg := testhelper.ErrMsg(w); msg == "" {
			t.Fatalf("应返回阻止删除原因: %s", w.Body.String())
		}

		var exists bool
		if err := env.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workflows WHERE id = $1)`, wfID).Scan(&exists); err != nil {
			t.Fatalf("校验流程存在失败: %v", err)
		}
		if !exists {
			t.Fatal("删除被拦截后审批流不应被删除")
		}
	})

	t.Run("审批单完结后允许删除", func(t *testing.T) {
		if _, err := env.DB.Exec(ctx, `UPDATE approval_records SET status = 'approved' WHERE id = $1`, recordID); err != nil {
			t.Fatalf("完结审批单失败: %v", err)
		}
		w := doWithClaims(r, http.MethodDelete, "/workflows/"+wfID, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}
