package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// GetSubscription 查询订阅。
func (s *PositionService) GetSubscription(ctx context.Context, id string) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Get(ctx, id)
}

// GetSubscriptionByTenant 查询租户订阅。
func (s *PositionService) GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().GetByTenant(ctx, tenantID)
}

// UpdateSubscription 更新订阅。
func (s *PositionService) UpdateSubscription(ctx context.Context, id string, p *store.SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Update(ctx, id, p)
}

// CreateSubscription 创建订阅。
func (s *PositionService) CreateSubscription(ctx context.Context, p *store.SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Create(ctx, p)
}
