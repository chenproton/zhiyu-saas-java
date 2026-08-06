package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// 平台级配置键。
const (
	KeyThemePrimary = "theme_primary"
)

// ErrSettingNotFound 表示平台配置不存在（返回默认值兜底）。
var ErrSettingNotFound = errors.New("store: platform setting not found")

// PlatformSettingsStore 平台级键值配置（主题色等）。
type PlatformSettingsStore struct {
	q Queryer
}

// NewPlatformSettingsStore 创建平台配置 store。
func NewPlatformSettingsStore(q Queryer) *PlatformSettingsStore {
	return &PlatformSettingsStore{q: q}
}

// Get 读取配置值；不存在时返回 ErrSettingNotFound。
func (s *PlatformSettingsStore) Get(ctx context.Context, key string) (string, error) {
	var value string
	err := s.q.QueryRow(ctx, `
		SELECT value FROM platform_settings WHERE key = $1
	`, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrSettingNotFound
	}
	return value, err
}

// Upsert 写入配置值（不存在则插入）。
func (s *PlatformSettingsStore) Upsert(ctx context.Context, key, value string) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
	`, key, value)
	return err
}

// GetTenant 读取租户级配置值；不存在时返回 ErrSettingNotFound。
func (s *PlatformSettingsStore) GetTenant(ctx context.Context, tenantID, key string) (string, error) {
	var value string
	err := s.q.QueryRow(ctx, `
		SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = $2
	`, tenantID, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrSettingNotFound
	}
	return value, err
}

// UpsertTenant 写入租户级配置值（不存在则插入）。
func (s *PlatformSettingsStore) UpsertTenant(ctx context.Context, tenantID, key, value string) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
	`, tenantID, key, value)
	return err
}

// DeleteTenant 删除租户级配置值（回退到平台默认）。
func (s *PlatformSettingsStore) DeleteTenant(ctx context.Context, tenantID, key string) error {
	_, err := s.q.Exec(ctx, `
		DELETE FROM tenant_settings WHERE tenant_id = $1 AND key = $2
	`, tenantID, key)
	return err
}
