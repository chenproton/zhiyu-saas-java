package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// FindRuleByPosition 按岗位查规则。
func (s *EvaluationService) FindRuleByPosition(ctx context.Context, tenantID, positionID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().FindRuleByPosition(ctx, tenantID, positionID)
}

// ListEvaluationCategories 查询评价分类。
func (s *EvaluationService) ListEvaluationCategories(ctx context.Context) ([]domain.EvaluationMethodCategory, error) {
	return s.st.EvaluationMethods().ListCategories(ctx)
}
