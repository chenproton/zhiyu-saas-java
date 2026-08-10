package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// AllianceGrantStore 学校-企业资源授权（alliance_resource_grants）持久化。
// 企业级授权：学校把岗位/场景编辑权授予合作企业，企业内专家/管理员可见。
type AllianceGrantStore struct {
	q Queryer
}

// NewAllianceGrantStore 创建授权 store。
func NewAllianceGrantStore(q Queryer) *AllianceGrantStore {
	return &AllianceGrantStore{q: q}
}

// ListBySchool 学校视角：某企业的授权列表（含未授权的类型行则跳过）。
func (s *AllianceGrantStore) ListBySchool(ctx context.Context, tenantID, enterpriseID string) ([]domain.AllianceResourceGrant, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, enterprise_id, resource_type, resource_ids, created_by, created_at, updated_at
		FROM alliance_resource_grants
		WHERE tenant_id = $1 AND enterprise_id = $2
		ORDER BY resource_type
	`, tenantID, enterpriseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGrants(rows)
}

// ListByEnterprise 企业视角：跨学校聚合被授权资源（co-build 列表与权限校验用）。
func (s *AllianceGrantStore) ListByEnterprise(ctx context.Context, enterpriseID string) ([]domain.AllianceResourceGrant, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, enterprise_id, resource_type, resource_ids, created_by, created_at, updated_at
		FROM alliance_resource_grants
		WHERE enterprise_id = $1
		ORDER BY resource_type
	`, enterpriseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanGrants(rows)
}

// Upsert 覆盖式保存某企业某类型资源的授权（整组替换，非增量）。
func (s *AllianceGrantStore) Upsert(ctx context.Context, tenantID, enterpriseID, resourceType string, resourceIDs []string, createdBy string) error {
	if len(resourceIDs) == 0 {
		_, err := s.q.Exec(ctx, `
			DELETE FROM alliance_resource_grants
			WHERE tenant_id = $1 AND enterprise_id = $2 AND resource_type = $3
		`, tenantID, enterpriseID, resourceType)
		return err
	}
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_resource_grants (tenant_id, enterprise_id, resource_type, resource_ids, created_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tenant_id, enterprise_id, resource_type)
		DO UPDATE SET resource_ids = EXCLUDED.resource_ids, created_by = EXCLUDED.created_by, updated_at = NOW()
	`, tenantID, enterpriseID, resourceType, resourceIDs, createdBy)
	return err
}

// GrantedResourceIDsByType 企业视角：某类型被授权资源 id 集合（跨学校）。
func (s *AllianceGrantStore) GrantedResourceIDsByType(ctx context.Context, enterpriseID, resourceType string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT DISTINCT unnest(resource_ids)::text AS rid
		FROM alliance_resource_grants
		WHERE enterprise_id = $1 AND resource_type = $2
	`, enterpriseID, resourceType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// IsGranted 企业视角：某资源是否被授权（跨学校，资源需归属授权学校的租户）。
func (s *AllianceGrantStore) IsGranted(ctx context.Context, enterpriseID, resourceType, resourceID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM alliance_resource_grants
			WHERE enterprise_id = $1 AND resource_type = $2 AND $3 = ANY(resource_ids)
		)
	`, enterpriseID, resourceType, resourceID).Scan(&exists)
	return exists, err
}

// ResourceOptions 学校可授权资源候选：该企业共建的岗位/场景（非 archived）
// + 学校自建的岗位/场景（已发布）。
func (s *AllianceGrantStore) ResourceOptions(ctx context.Context, tenantID, enterpriseID string) ([]domain.AllianceGrantResourceOption, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id::text, name, 'position' AS type, 'enterprise' AS source, '' AS school_name
		FROM career_positions
		WHERE source_enterprise_id = $2 AND status <> 'archived'
		UNION ALL
		SELECT id::text, name, 'position' AS type, 'school' AS source, '' AS school_name
		FROM career_positions
		WHERE tenant_id = $1 AND source_enterprise_id IS NULL AND status = 'published'
		UNION ALL
		SELECT id::text, name, 'scene' AS type, 'enterprise' AS source, '' AS school_name
		FROM scenarios
		WHERE source_enterprise_id = $2 AND status <> 'archived'
		UNION ALL
		SELECT id::text, name, 'scene' AS type, 'school' AS source, '' AS school_name
		FROM scenarios
		WHERE tenant_id = $1 AND source_enterprise_id IS NULL AND status = 'published'
		ORDER BY type, name
	`, tenantID, enterpriseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AllianceGrantResourceOption, 0)
	for rows.Next() {
		var o domain.AllianceGrantResourceOption
		if err := rows.Scan(&o.ID, &o.Name, &o.Type, &o.Source, &o.SchoolName); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

func scanGrants(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}) ([]domain.AllianceResourceGrant, error) {
	items := make([]domain.AllianceResourceGrant, 0)
	for rows.Next() {
		var g domain.AllianceResourceGrant
		var createdBy *string
		if err := rows.Scan(&g.ID, &g.TenantID, &g.EnterpriseID, &g.ResourceType, &g.ResourceIDs, &createdBy, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		g.CreatedBy = createdBy
		items = append(items, g)
	}
	return items, rows.Err()
}
