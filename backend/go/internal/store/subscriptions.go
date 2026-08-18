package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
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
		SELECT id, tenant_id, name, valid_until::text, modules, status, ai_token_quota, created_at, updated_at
		FROM subscription_packages WHERE id = $1
	`, id).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.AITokenQuota, &sub.CreatedAt, &sub.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
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
		SELECT id, tenant_id, name, valid_until::text, modules, status, ai_token_quota, created_at, updated_at
		FROM subscription_packages WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.AITokenQuota, &sub.CreatedAt, &sub.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
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
		INSERT INTO subscription_packages (id, tenant_id, name, valid_until, modules, status, ai_token_quota)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, COALESCE($6, 0))
		RETURNING id
	`, p.TenantID, p.Name, p.ValidUntil, p.Modules, p.Status, p.AITokenQuota).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新订阅；AITokenQuota 为 nil 时保留原值（额度仅由超管套餐配置维护）。
func (s *SubscriptionStore) Update(ctx context.Context, id string, p *SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE subscription_packages SET name = $1, valid_until = $2, modules = $3, status = $4,
			ai_token_quota = COALESCE($5, ai_token_quota), updated_at = NOW()
		WHERE id = $6
	`, p.Name, p.ValidUntil, p.Modules, p.Status, p.AITokenQuota, id); err != nil {
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
	// AITokenQuota AI token 额度（token 数）；nil 表示不修改（仅超管套餐配置维护）。
	AITokenQuota *int64
}

// ===== 资源码 =====
