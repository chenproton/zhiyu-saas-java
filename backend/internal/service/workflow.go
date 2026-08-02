package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListWorkflows 查询审批流程列表。
func (s *PositionService) ListWorkflows(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Workflow]) ([]domain.Workflow, int, error) {
	return s.st.Workflows().List(ctx, p, cfg)
}

// GetWorkflow 查询单个审批流程。
func (s *PositionService) GetWorkflow(ctx context.Context, id string) (*domain.Workflow, error) {
	return s.st.Workflows().Get(ctx, id)
}

// CreateWorkflow 创建审批流程。
func (s *PositionService) CreateWorkflow(ctx context.Context, tenantID *string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Create(ctx, tenantID, p)
}

// UpdateWorkflow 更新审批流程。
func (s *PositionService) UpdateWorkflow(ctx context.Context, id string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Update(ctx, id, p)
}

// DeleteWorkflow 删除审批流程。
func (s *PositionService) DeleteWorkflow(ctx context.Context, id string) error {
	return s.st.Workflows().Delete(ctx, id)
}
