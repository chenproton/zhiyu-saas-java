package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListAppeals 查询申诉列表。
func (s *EvaluationService) ListAppeals(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AppealRecord]) ([]domain.AppealRecord, int, error) {
	return s.st.Appeals().List(ctx, p, cfg)
}

// GetAppeal 查询单个申诉。
func (s *EvaluationService) GetAppeal(ctx context.Context, id string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Get(ctx, id)
}

// CreateAppeal 创建申诉。
func (s *EvaluationService) CreateAppeal(ctx context.Context, tenantID, userID, appealType, reason string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Create(ctx, tenantID, userID, appealType, reason)
}

// ProcessAppeal 处理申诉。
func (s *EvaluationService) ProcessAppeal(ctx context.Context, id, status string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Process(ctx, id, status)
}
