package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// NodeEvaluationResultService 节点测评结果业务编排。
type NodeEvaluationResultService struct {
	*Service
	st *store.Store
}

// NewNodeEvaluationResultService 创建节点测评结果服务。
func NewNodeEvaluationResultService(s *Service) *NodeEvaluationResultService {
	return &NodeEvaluationResultService{Service: s, st: s.Store()}
}

// List 分页查询节点测评结果。
func (s *NodeEvaluationResultService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeEvaluationResult]) ([]domain.NodeEvaluationResult, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, cfg)
}

// SubmitNodeEvaluationResult 提交节点测评结果。
func (s *NodeEvaluationResultService) SubmitNodeEvaluationResult(ctx context.Context, p *store.NodeEvaluationResultSubmitParams) (*domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().Submit(ctx, p)
}

// Grade 节点测评结果评分（pending→evaluated）。
func (s *NodeEvaluationResultService) Grade(ctx context.Context, tenantID, id, graderID string, p *store.NodeEvaluationResultGradeParams) error {
	return s.st.NodeEvaluationResults().Grade(ctx, tenantID, id, graderID, p)
}

// ListByCourse 查询课程下全部节点的测评结果（教师评分列表用）。
func (s *NodeEvaluationResultService) ListByCourse(ctx context.Context, tenantID, courseID string) ([]domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().ListByCourse(ctx, tenantID, courseID)
}

// GetByID 查询单条节点测评结果（教师评分详情用）。
func (s *NodeEvaluationResultService) GetByID(ctx context.Context, tenantID, id string) (*domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().GetByID(ctx, tenantID, id)
}
