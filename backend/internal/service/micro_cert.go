package service

import "github.com/zhiyu-saas/backend/internal/store"

// MicroCertService 微证书业务编排。
type MicroCertService struct {
	*Service
	st *store.Store
}

// NewMicroCertService 创建微证书服务。
func NewMicroCertService(s *Service) *MicroCertService {
	return &MicroCertService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *MicroCertService) Queryer() store.Queryer { return s.st.Q() }
