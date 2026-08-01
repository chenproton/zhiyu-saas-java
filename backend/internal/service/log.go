package service

import "github.com/zhiyu-saas/backend/internal/store"

// LogService 日志业务编排。
type LogService struct {
	*Service
	st *store.Store
}

// NewLogService 创建日志服务。
func NewLogService(s *Service) *LogService {
	return &LogService{Service: s, st: s.Store()}
}

// Queryer 暴露底层查询器（供 handler 列表查询使用）。
func (s *LogService) Queryer() store.Queryer { return s.st.Q() }
