package service

import "github.com/zhiyu-saas/backend/internal/store"

// PortalService 门户系统域（订阅套餐/资源编码）业务编排。
type PortalService struct {
	*Service
	st *store.Store
}

// NewPortalService 创建门户系统服务。
func NewPortalService(s *Service) *PortalService {
	return &PortalService{Service: s, st: s.Store()}
}
