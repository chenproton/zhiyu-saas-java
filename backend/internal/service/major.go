package service

import "github.com/zhiyu-saas/backend/internal/store"

// MajorService 专业业务编排。
type MajorService struct {
	*Service
	st *store.Store
}

// NewMajorService 创建专业服务。
func NewMajorService(s *Service) *MajorService {
	return &MajorService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *MajorService) Queryer() store.Queryer { return s.st.Q() }
