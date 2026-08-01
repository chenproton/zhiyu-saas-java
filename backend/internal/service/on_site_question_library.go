package service

import "github.com/zhiyu-saas/backend/internal/store"

// OnSiteQuestionLibraryService 现场题库业务编排。
type OnSiteQuestionLibraryService struct {
	*Service
	st *store.Store
}

// NewOnSiteQuestionLibraryService 创建现场题库服务。
func NewOnSiteQuestionLibraryService(s *Service) *OnSiteQuestionLibraryService {
	return &OnSiteQuestionLibraryService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *OnSiteQuestionLibraryService) Queryer() store.Queryer { return s.st.Q() }
