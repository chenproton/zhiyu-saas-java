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
