package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 企业平台（Partner）专用查询 =====

type PartnerStore struct {
	q Queryer
}

func NewPartnerStore(q Queryer) *PartnerStore {
	return &PartnerStore{q: q}
}

// ErrPartnerUsernameExists partner 平台内用户名已被占用。
var ErrPartnerUsernameExists = errors.New("partner username exists")

// PartnerUsernameExists partner 平台内 username 全局唯一校验（应用层防线，
// 现有 users 唯一约束是租户级 login_name，不动）。
func (s *PartnerStore) PartnerUsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND platform = $2)`,
		username, domain.UserPlatformPartner).Scan(&exists)
	return exists, err
}

// GetRoleIDByCode 按租户+角色 code 查询角色 ID（企业租户种子角色绑定用）。
func (s *PartnerStore) GetRoleIDByCode(ctx context.Context, tenantID, code string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx,
		`SELECT id FROM roles WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
		tenantID, code).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return id, nil
}

// CountExpertsByTenant 企业租户专家数量（服务台统计）。
func (s *PartnerStore) CountExpertsByTenant(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM alliance_experts WHERE tenant_id = $1`, tenantID).Scan(&n)
	return n, err
}

// CountMembersByTenant 企业租户成员账号数量（服务台统计）。
func (s *PartnerStore) CountMembersByTenant(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND platform = $2`,
		tenantID, domain.UserPlatformPartner).Scan(&n)
	return n, err
}
