package store

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// SubscriptionStore 订阅持久化。
type SubscriptionStore struct {
	q Queryer
}

// NewSubscriptionStore 创建订阅 store。
func NewSubscriptionStore(q Queryer) *SubscriptionStore {
	return &SubscriptionStore{q: q}
}

// Get 查询单个订阅。
func (s *SubscriptionStore) Get(ctx context.Context, id string) (*domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE id = $1
	`, id).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return &sub, nil
}

// GetByTenant 查询租户订阅（最新）。
func (s *SubscriptionStore) GetByTenant(ctx context.Context, tenantID string) (*domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return &sub, nil
}

// Create 创建订阅。
func (s *SubscriptionStore) Create(ctx context.Context, p *SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO subscription_packages (id, tenant_id, name, valid_until, modules, status)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, p.TenantID, p.Name, p.ValidUntil, p.Modules, p.Status).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新订阅。
func (s *SubscriptionStore) Update(ctx context.Context, id string, p *SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE subscription_packages SET name = $1, valid_until = $2, modules = $3, status = $4, updated_at = NOW()
		WHERE id = $5
	`, p.Name, p.ValidUntil, p.Modules, p.Status, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// SubscriptionUpdateParams 订阅更新参数。
type SubscriptionUpdateParams struct {
	TenantID   string
	Name       string
	ValidUntil *string
	Modules    domain.JSONMap
	Status     string
}

// ===== 资源码 =====
