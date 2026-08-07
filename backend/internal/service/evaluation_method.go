package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListEvaluationMethods 查询评价方法列表。
func (s *EvaluationService) ListEvaluationMethods(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.EvaluationMethod]) ([]domain.EvaluationMethod, int, error) {
	return s.st.EvaluationMethods().List(ctx, p, cfg)
}

// GetEvaluationMethod 查询单个评价方法。
func (s *EvaluationService) GetEvaluationMethod(ctx context.Context, id string) (*domain.EvaluationMethod, error) {
	return s.st.EvaluationMethods().Get(ctx, id)
}

// ToggleEvaluationMethod 切换启用状态。
func (s *EvaluationService) ToggleEvaluationMethod(ctx context.Context, id string, enabled bool) (*domain.EvaluationMethod, error) {
	return s.st.EvaluationMethods().Toggle(ctx, id, enabled)
}

// ListEvaluationCategories 查询评价分类。
func (s *EvaluationService) ListEvaluationCategories(ctx context.Context, tenantID string) ([]domain.EvaluationMethodCategory, error) {
	return s.st.EvaluationMethods().ListCategories(ctx, tenantID)
}
