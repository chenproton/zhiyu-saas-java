package service

import "github.com/zhiyu-saas/backend/internal/store"

// RoleService 角色业务编排。
type RoleService struct {
	*Service
	st *store.Store
}

// NewRoleService 创建角色服务。
func NewRoleService(s *Service) *RoleService {
	return &RoleService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *RoleService) Queryer() store.Queryer { return s.st.Q() }
