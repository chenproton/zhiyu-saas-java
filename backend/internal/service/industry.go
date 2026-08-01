package service

import "github.com/zhiyu-saas/backend/internal/store"

// IndustryService 行业业务编排。
type IndustryService struct {
	*Service
	st *store.Store
}

// NewIndustryService 创建行业服务。
func NewIndustryService(s *Service) *IndustryService {
	return &IndustryService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *IndustryService) Queryer() store.Queryer { return s.st.Q() }
