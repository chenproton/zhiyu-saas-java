package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ErrAIConfigNotFound 租户尚未配置 AI 服务。
var ErrAIConfigNotFound = errors.New("store: tenant ai config not found")

// AIConfigStore 租户 AI 配置持久化（api_key 以密文存储，加解密在 service 层）。
type AIConfigStore struct {
	q Queryer
}

// NewAIConfigStore 创建 AI 配置 store。
func NewAIConfigStore(q Queryer) *AIConfigStore {
	return &AIConfigStore{q: q}
}

// Get 读取租户 AI 配置；不存在时返回 ErrAIConfigNotFound。
func (s *AIConfigStore) Get(ctx context.Context, tenantID string) (*domain.TenantAIConfig, error) {
	var cfg domain.TenantAIConfig
	err := s.q.QueryRow(ctx, `
		SELECT tenant_id, base_url, api_key_encrypted, model, extra, created_at, updated_at
		FROM tenant_ai_configs WHERE tenant_id = $1
	`, tenantID).Scan(
		&cfg.TenantID, &cfg.BaseURL, &cfg.APIKeyEncrypted, &cfg.Model, &cfg.Extra,
		&cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAIConfigNotFound
	}
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Upsert 写入租户 AI 配置（不存在则插入，存在则更新并刷新 updated_at）。
func (s *AIConfigStore) Upsert(ctx context.Context, cfg *domain.TenantAIConfig) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO tenant_ai_configs (tenant_id, base_url, api_key_encrypted, model, extra, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, now(), now())
		ON CONFLICT (tenant_id) DO UPDATE SET
			base_url = EXCLUDED.base_url,
			api_key_encrypted = EXCLUDED.api_key_encrypted,
			model = EXCLUDED.model,
			extra = EXCLUDED.extra,
			updated_at = now()
	`, cfg.TenantID, cfg.BaseURL, cfg.APIKeyEncrypted, cfg.Model, cfg.Extra)
	return err
}

// Delete 删除租户 AI 配置。
func (s *AIConfigStore) Delete(ctx context.Context, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM tenant_ai_configs WHERE tenant_id = $1`, tenantID)
	return err
}
