package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// LogService 日志业务编排。
type LogService struct {
	*Service
	st *store.Store
}

// NewLogService 创建日志服务。
func NewLogService(s *Service) *LogService {
	return &LogService{Service: s, st: s.Store()}
}

// ListLoginLogs 分页查询登录日志。
func (s *LogService) ListLoginLogs(ctx context.Context, p store.ListParams) ([]domain.LoginLog, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, store.LoginLogsListConfig())
}

// ListOperationLogs 分页查询操作日志。
func (s *LogService) ListOperationLogs(ctx context.Context, p store.ListParams) ([]domain.OperationLog, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, store.OperationLogsListConfig())
}
