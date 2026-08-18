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
func (s *ApprovalService) GetApproval(ctx context.Context, tenantID, id string) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Get(ctx, tenantID, id)
}

// CreateApproval 创建审批记录。
func (s *ApprovalService) CreateApproval(ctx context.Context, tenantID *string, p *store.ApprovalCreateParams) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Create(ctx, tenantID, p)
}

// StepDecision 评审步骤决策回调：基于锁内最新历史判断本步骤是否完成，
// 返回 (complete, newStatus, newStepIdx)。
type StepDecision func(history domain.JSONSlice, stepIdx int) (complete bool, newStatus string, newStepIdx int)

// ReviewStep 评审审批（事务+行锁）：锁内追加本次评审、以最新历史重算步骤完成度，
// 完成则推进/驳回。修复历史并发覆盖与「全部审批人批准后记录卡在 pending」两类竞态：
// 此前完成度判断基于请求开始时的旧快照，且 AdvanceRecord 以旧 history 整段覆写，
// 并发评审会互相清掉对方的审批记录。
func (s *ApprovalService) ReviewStep(ctx context.Context, id string, entry domain.JSONMap, targetType, targetID string, tenantID *string, decide StepDecision) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		ar, err := txStore.Approvals().LockApproval(ctx, txStore.Q(), id)
		if err != nil {
			return err
		}
		if ar.Status != string(domain.ApprovalStatusPending) {
			return store.ErrNotFound
		}
		history := appendHistoryEntry(ar.History, entry)
		complete, newStatus, newStepIdx := decide(history, ar.CurrentStepIdx)
		if !complete {
			ok, err := txStore.Approvals().SetHistory(ctx, txStore.Q(), id, history)
			if err != nil {
				return err
			}
			if !ok {
				return store.ErrNotFound
			}
			return nil
		}
		ok, err := txStore.Approvals().AdvanceRecord(ctx, txStore.Q(), id, newStatus, newStepIdx, ar.CurrentStepIdx, history)
		if err != nil {
			return err
		}
		if !ok {
			return store.ErrNotFound
		}
		// 终态（通过/驳回）才同步实体状态；非终态推进只改步骤
		if newStatus != string(domain.ApprovalStatusPending) && tenantID != nil {
			// 学校自建资源编辑稿审批通过 → 合并覆盖原资源（仅通过时合并）
			if newStatus == string(domain.ApprovalStatusApproved) {
				if merged, err := txStore.MergeSourceEditDraft(ctx, txStore.Q(), targetType, targetID, *tenantID); err != nil {
					return err
				} else if merged {
					return nil
				}
			}
			if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
				return err
			}
		}
		return nil
	})
}

// appendHistoryEntry 追加评审记录；同一评审人同一步骤的重复提交不重复追加。
func appendHistoryEntry(history domain.JSONSlice, entry domain.JSONMap) domain.JSONSlice {
	rid, _ := entry["reviewerId"].(string)
	stepIdx, _ := entry["stepIdx"].(int)
	for _, h := range history {
		m, ok := h.(map[string]interface{})
		if !ok || m["reviewerId"] != rid {
			continue
		}
		switch v := m["stepIdx"].(type) {
		case float64:
			if int(v) == stepIdx {
				return history
			}
		case int:
			if v == stepIdx {
				return history
			}
		}
	}
	return append(history, entry)
}

// PendingApprovalCount 待审批数。
func (s *ApprovalService) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	return s.st.Portal().PendingApprovalCount(ctx, tenantID)
}
