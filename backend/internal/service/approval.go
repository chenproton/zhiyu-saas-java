package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListApprovals 查询审批记录列表。
func (s *ApprovalService) ListApprovals(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ApprovalRecord]) ([]domain.ApprovalRecord, int, error) {
	return s.st.Approvals().List(ctx, p, cfg)
}

// GetApproval 查询单个审批记录。
func (s *ApprovalService) GetApproval(ctx context.Context, id string) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Get(ctx, id)
}

// CreateApproval 创建审批记录。
func (s *ApprovalService) CreateApproval(ctx context.Context, tenantID *string, p *store.ApprovalCreateParams) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Create(ctx, tenantID, p)
}

// ReviewApproval 评审审批（事务：更新记录+同步实体状态）。
func (s *ApprovalService) ReviewApproval(ctx context.Context, id, action, newStatus string, stepIdx int, oldStepIdx int, history domain.JSONSlice, targetType, targetID string, tenantID *string, syncStatus bool) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if action == string(domain.ApprovalStatusRejected) {
			ok, err := txStore.Approvals().RejectRecord(ctx, txStore.Q(), id, newStatus, history)
			if err != nil {
				return err
			}
			if !ok {
				return store.ErrNotFound
			}
			if syncStatus && tenantID != nil {
				if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
					return err
				}
			}
			return nil
		}
		ok, err := txStore.Approvals().AdvanceRecord(ctx, txStore.Q(), id, newStatus, stepIdx, oldStepIdx, history)
		if err != nil {
			return err
		}
		if !ok {
			return store.ErrNotFound
		}
		if syncStatus && tenantID != nil {
			if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
				return err
			}
		}
		return nil
	})
}

// UpdateApprovalHistory 更新审批历史（不推进）。
func (s *ApprovalService) UpdateApprovalHistory(ctx context.Context, id string, history domain.JSONSlice) (bool, error) {
	return s.st.Approvals().UpdateHistory(ctx, id, history)
}

// PendingApprovalCount 待审批数。
func (s *ApprovalService) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	return s.st.Portal().PendingApprovalCount(ctx, tenantID)
}
