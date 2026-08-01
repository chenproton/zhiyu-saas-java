package service

import "github.com/zhiyu-saas/backend/internal/store"

// LearnRoadService 学习路径业务编排。
type LearnRoadService struct {
	*Service
	st *store.Store
}

// NewLearnRoadService 创建学习路径服务。
func NewLearnRoadService(s *Service) *LearnRoadService {
	return &LearnRoadService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *LearnRoadService) Queryer() store.Queryer { return s.st.Q() }
