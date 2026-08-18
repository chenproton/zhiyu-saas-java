package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListTerms 查询学期列表。
func (s *AffairsPlanService) ListTerms(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Term]) ([]domain.Term, int, error) {
	return s.st.Terms().List(ctx, p, cfg)
}

// GetTerm 查询单个学期。
func (s *AffairsPlanService) GetTerm(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	return s.st.Terms().Get(ctx, id, tenantID)
}

// CreateTerm 创建学期（事务）。
func (s *AffairsPlanService) CreateTerm(ctx context.Context, tenantID string, p *store.TermParams) (string, error) {
	var id string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		i, err := txStore.Terms().Create(ctx, txStore.Q(), tenantID, p)
		if err != nil {
			return err
		}
		id = i
		return nil
	})
	return id, err
}

// UpdateTerm 更新学期（事务）。
func (s *AffairsPlanService) UpdateTerm(ctx context.Context, tenantID, id string, p *store.TermParams) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Terms().Update(ctx, txStore.Q(), tenantID, id, p)
	})
}

// DeleteTerm 删除学期。
func (s *AffairsPlanService) DeleteTerm(ctx context.Context, id, tenantID string) error {
	return s.st.Terms().Delete(ctx, id, tenantID)
}

// FetchTeachingPlanTermWeeks 查询学期周数。
func (s *AffairsPlanService) FetchTeachingPlanTermWeeks(ctx context.Context, id, tenantID string) (int, error) {
	return s.st.TeachingPlans().TermWeeks(ctx, id, tenantID)
}
