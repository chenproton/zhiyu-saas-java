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
// 审批通过且目标为「学校自建资源编辑稿」（source_resource_id 非空）时，
// 用 draft 内容覆盖原资源并删除 draft，而不是仅同步状态。
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
			// 学校自建资源编辑稿审批通过 → 合并覆盖原资源
			if merged, err := txStore.MergeSourceEditDraft(ctx, txStore.Q(), targetType, targetID, *tenantID); err != nil {
				return err
			} else if merged {
				return nil
			}
			if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
				return err
			}
		}
		return nil
	})
}

// UpdateApprovalHistory 追加审批历史（不推进）。
func (s *ApprovalService) UpdateApprovalHistory(ctx context.Context, id string, entry domain.JSONMap) (bool, error) {
	return s.st.Approvals().UpdateHistory(ctx, id, entry)
}

// PendingApprovalCount 待审批数。
func (s *ApprovalService) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	return s.st.Portal().PendingApprovalCount(ctx, tenantID)
}
