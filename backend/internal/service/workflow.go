package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListWorkflows 查询审批流程列表。
func (s *ApprovalService) ListWorkflows(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Workflow]) ([]domain.Workflow, int, error) {
	return s.st.Workflows().List(ctx, p, cfg)
}

// GetWorkflow 查询单个审批流程。
func (s *ApprovalService) GetWorkflow(ctx context.Context, id, tenantID string) (*domain.Workflow, error) {
	return s.st.Workflows().Get(ctx, id, tenantID)
}

// CreateWorkflow 创建审批流程。
func (s *ApprovalService) CreateWorkflow(ctx context.Context, tenantID *string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Create(ctx, tenantID, p)
}

// UpdateWorkflow 更新审批流程。
func (s *ApprovalService) UpdateWorkflow(ctx context.Context, id, tenantID string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Update(ctx, id, tenantID, p)
}

// DeleteWorkflow 删除审批流程。
func (s *ApprovalService) DeleteWorkflow(ctx context.Context, id, tenantID string) error {
	return s.st.Workflows().Delete(ctx, id, tenantID)
}

// WorkflowHasPendingApprovals 判断审批流程是否仍有待处理审批单（删除保护）。
func (s *ApprovalService) WorkflowHasPendingApprovals(ctx context.Context, workflowID string) (bool, error) {
	return s.st.Approvals().ExistsPendingByWorkflow(ctx, workflowID)
}
