package service

import "github.com/zhiyu-saas/backend/internal/store"

// StaffTitleService 职称业务编排。
type StaffTitleService struct {
	*Service
	st *store.Store
}

// NewStaffTitleService 创建职称服务。
func NewStaffTitleService(s *Service) *StaffTitleService {
	return &StaffTitleService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *StaffTitleService) Queryer() store.Queryer { return s.st.Q() }
