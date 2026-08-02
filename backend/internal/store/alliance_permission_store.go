package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 权限 =====

func (s *AllianceStore) ScanPermissionRows(rows pgx.Rows) ([]domain.AlliancePermission, error) {
	items := make([]domain.AlliancePermission, 0)
	for rows.Next() {
		var p domain.AlliancePermission
		var enterpriseID, expertID *string
		var resourcePerms, platformPerms json.RawMessage
		if err := rows.Scan(&p.ID, &p.TenantID, &p.AccountName, &p.AccountType,
			&enterpriseID, &expertID, &p.IsEnabled, &resourcePerms, &platformPerms,
			&p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.EnterpriseID = enterpriseID
		p.ExpertID = expertID
		p.ResourcePermissions = resourcePerms
		p.PlatformPermissions = platformPerms
		items = append(items, p)
	}
	return items, nil
}

func (s *AllianceStore) CreatePermission(ctx context.Context, p *domain.AlliancePermission) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type,
			enterprise_id, expert_id, is_enabled, resource_permissions, platform_permissions,
			created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
	`, id, p.TenantID, p.AccountName, p.AccountType, p.EnterpriseID, p.ExpertID,
		p.IsEnabled, emptyJSON(p.ResourcePermissions), emptyJSON(p.PlatformPermissions))
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdatePermission(ctx context.Context, id string, p *domain.AlliancePermission) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_permissions SET
			account_name = $1, account_type = $2, enterprise_id = $3, expert_id = $4,
			is_enabled = $5, resource_permissions = $6, platform_permissions = $7, updated_at = NOW()
		WHERE id = $8
	`, p.AccountName, p.AccountType, p.EnterpriseID, p.ExpertID,
		p.IsEnabled, emptyJSON(p.ResourcePermissions), emptyJSON(p.PlatformPermissions), id)
	return err
}

func (s *AllianceStore) DeletePermission(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_permissions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
