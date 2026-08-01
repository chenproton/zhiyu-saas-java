package service

import "github.com/zhiyu-saas/backend/internal/store"

// NodeEvaluationResultService 节点测评结果业务编排。
type NodeEvaluationResultService struct {
	*Service
	st *store.Store
}

// NewNodeEvaluationResultService 创建节点测评结果服务。
func NewNodeEvaluationResultService(s *Service) *NodeEvaluationResultService {
	return &NodeEvaluationResultService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *NodeEvaluationResultService) Queryer() store.Queryer { return s.st.Q() }
