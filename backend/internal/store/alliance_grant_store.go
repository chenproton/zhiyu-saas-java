package store

import (
	"context"
	"fmt"

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

// AddResourceID 增量追加资源授权（幂等去重）：企业共建资源创建时自动关联授权，
// 使共建资源与学校手动授权的资源同样处理（学校权限管理页可见、可统一管理）。
func (s *AllianceGrantStore) AddResourceID(ctx context.Context, tenantID, enterpriseID, resourceType, resourceID, createdBy string) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_resource_grants (tenant_id, enterprise_id, resource_type, resource_ids, created_by)
		VALUES ($1, $2, $3, ARRAY[$4]::uuid[], $5)
		ON CONFLICT (tenant_id, enterprise_id, resource_type)
		DO UPDATE SET resource_ids = (
			SELECT array_agg(DISTINCT x)
			FROM unnest(alliance_resource_grants.resource_ids || EXCLUDED.resource_ids) AS x
		), created_by = EXCLUDED.created_by, updated_at = NOW()
	`, tenantID, enterpriseID, resourceType, resourceID, createdBy)
	return err
}

// RemoveResourceID 从全部授权记录中移除资源 id（资源删除时清理孤儿引用，
// 资源已不存在，跨租户/企业整表移除），授权集合被清空的整行删除。
func (s *AllianceGrantStore) RemoveResourceID(ctx context.Context, resourceType, resourceID string) error {
	if _, err := s.q.Exec(ctx, `
		UPDATE alliance_resource_grants
		SET resource_ids = array_remove(resource_ids, $2::uuid), updated_at = NOW()
		WHERE resource_type = $1 AND $2::uuid = ANY(resource_ids)
	`, resourceType, resourceID); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `
		DELETE FROM alliance_resource_grants
		WHERE resource_type = $1 AND cardinality(resource_ids) = 0
	`, resourceType)
	return err
}

// coBuiltTable 企业共建资源表名（resourceType → 表，仅允许固定枚举值）。
func coBuiltTable(resourceType string) string {
	switch resourceType {
	case "position":
		return "career_positions"
	case "scene":
		return "scenarios"
	}
	return ""
}

// UpsertMergingCoBuilt 保存授权时自动并入该企业共建资源（source_enterprise_id 命中
// 且非 archived，与 ResourceOptions 候选口径一致），保证共建资源始终处于授权状态：
// 新建时已自动授权，学校在权限管理页整组保存授权也不会误删。
func (s *AllianceGrantStore) UpsertMergingCoBuilt(ctx context.Context, tenantID, enterpriseID, resourceType string, resourceIDs []string, createdBy string) error {
	table := coBuiltTable(resourceType)
	if table == "" {
		return s.Upsert(ctx, tenantID, enterpriseID, resourceType, resourceIDs, createdBy)
	}
	rows, err := s.q.Query(ctx, fmt.Sprintf(`
		SELECT id::text FROM %s
		WHERE source_enterprise_id = $1 AND status <> 'archived'
	`, table), enterpriseID)
	if err != nil {
		return err
	}
	defer rows.Close()
	merged := append([]string{}, resourceIDs...)
	seen := make(map[string]bool, len(resourceIDs))
	for _, id := range resourceIDs {
		seen[id] = true
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		if !seen[id] {
			seen[id] = true
			merged = append(merged, id)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return s.Upsert(ctx, tenantID, enterpriseID, resourceType, merged, createdBy)
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

// IsGranted 企业视角：某资源是否被授权（跨学校）。返回授权记录所属租户，
// 供消费端比对资源归属租户，防止授权记录被污染时跨租户越权。
func (s *AllianceGrantStore) IsGranted(ctx context.Context, enterpriseID, resourceType, resourceID string) (tenantID string, granted bool, err error) {
	err = s.q.QueryRow(ctx, `
		SELECT tenant_id::text, EXISTS(
			SELECT 1 FROM alliance_resource_grants
			WHERE enterprise_id = $1 AND resource_type = $2 AND $3 = ANY(resource_ids)
		)
		FROM alliance_resource_grants
		WHERE enterprise_id = $1 AND resource_type = $2 AND $3 = ANY(resource_ids)
		LIMIT 1
	`, enterpriseID, resourceType, resourceID).Scan(&tenantID, &granted)
	if err != nil {
		return "", false, err
	}
	return tenantID, granted, nil
}

// VerifyGrantsOwnership 校验资源是否全部属于指定租户（SaveGrants 源头防线：
// 学校只能授权本校的岗位/场景，杜绝跨租户授权他人资源）。空数组（清空授权）直接通过。
func (s *AllianceGrantStore) VerifyGrantsOwnership(ctx context.Context, tenantID, resourceType string, resourceIDs []string) (bool, error) {
	table := coBuiltTable(resourceType)
	if len(resourceIDs) == 0 {
		return true, nil
	}
	if table == "" {
		return false, nil
	}
	var count int
	err := s.q.QueryRow(ctx, fmt.Sprintf(`
		SELECT COUNT(*) FROM %s
		WHERE id = ANY($1::uuid[]) AND tenant_id = $2
	`, table), resourceIDs, tenantID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count == len(resourceIDs), nil
}

// ResourceOptions 学校可授权资源候选：本校全部岗位/场景（所有状态，含企业来源共建与自建），
// 携带状态、所属批次分组与来源企业信息（前端按批次分组展示 + 批量授权）。
func (s *AllianceGrantStore) ResourceOptions(ctx context.Context, tenantID, enterpriseID string) ([]domain.AllianceGrantResourceOption, error) {
	rows, err := s.q.Query(ctx, `
		SELECT cp.id::text AS id, cp.name, 'position' AS type,
			CASE WHEN cp.source_enterprise_id IS NULL THEN 'school' ELSE 'enterprise' END AS source,
			cp.source_enterprise_id, pe.name AS source_enterprise_name, cp.status, cp.batch_id, b.name AS batch_name
		FROM career_positions cp
		LEFT JOIN partner_enterprises pe ON pe.id = cp.source_enterprise_id
		LEFT JOIN batches b ON b.id = cp.batch_id
		WHERE cp.tenant_id = $1
		UNION ALL
		SELECT s.id::text AS id, s.name, 'scene' AS type,
			CASE WHEN s.source_enterprise_id IS NULL THEN 'school' ELSE 'enterprise' END AS source,
			s.source_enterprise_id, pe.name AS source_enterprise_name, s.status, s.batch_id, sb.name AS batch_name
		FROM scenarios s
		LEFT JOIN partner_enterprises pe ON pe.id = s.source_enterprise_id
		LEFT JOIN scene_batches sb ON sb.id = s.batch_id
		WHERE s.tenant_id = $1
		ORDER BY type, name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AllianceGrantResourceOption, 0)
	for rows.Next() {
		var o domain.AllianceGrantResourceOption
		if err := rows.Scan(&o.ID, &o.Name, &o.Type, &o.Source,
			&o.SourceEnterpriseID, &o.SourceEnterpriseName, &o.Status, &o.BatchID, &o.BatchName); err != nil {
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
