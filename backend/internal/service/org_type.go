package service

import "github.com/zhiyu-saas/backend/internal/store"

// OrgTypeService 组织类型业务编排。
type OrgTypeService struct {
	*Service
	st *store.Store
}

// NewOrgTypeService 创建组织类型服务。
func NewOrgTypeService(s *Service) *OrgTypeService {
	return &OrgTypeService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *OrgTypeService) Queryer() store.Queryer { return s.st.Q() }
