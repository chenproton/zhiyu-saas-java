package service

import "github.com/zhiyu-saas/backend/internal/store"

// CertificateLibraryService 证书库业务编排。
type CertificateLibraryService struct {
	*Service
	st *store.Store
}

// NewCertificateLibraryService 创建证书库服务。
func NewCertificateLibraryService(s *Service) *CertificateLibraryService {
	return &CertificateLibraryService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *CertificateLibraryService) Queryer() store.Queryer { return s.st.Q() }
