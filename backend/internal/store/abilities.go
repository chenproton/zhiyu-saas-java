package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// AbilityStore 能力点持久化。
type AbilityStore struct {
	q Queryer
}

// NewAbilityStore 创建能力点 store。
func NewAbilityStore(q Queryer) *AbilityStore {
	return &AbilityStore{q: q}
}

// List 查询能力点列表。
func (s *AbilityStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAbilityPointRows)
}

// Get 查询单个能力点。
func (s *AbilityStore) Get(ctx context.Context, id, tenantID string) (*domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var description, code *string
	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, description, category, attributes, is_public, creator_id, created_at
		FROM ability_points WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&a.ID, &a.Name, &code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	a.Description = description
	a.Code = code
	return &a, nil
}

// Create 创建能力点。
func (s *AbilityStore) Create(ctx context.Context, tenantID string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, description, category, attributes, is_public, creator_id)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, tenantID, p.Name, p.Description, p.Category, p.Attributes, p.IsPublic, p.CreatorID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新能力点。
func (s *AbilityStore) Update(ctx context.Context, id, tenantID string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	if _, err := s.Get(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_points SET name = $1, description = $2, category = $3, attributes = $4, is_public = $5
		WHERE id = $6 AND tenant_id = $7
	`, p.Name, p.Description, p.Category, p.Attributes, p.IsPublic, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除能力点。
func (s *AbilityStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM ability_points WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// AbilityPointParams 能力点参数。
type AbilityPointParams struct {
	Name        string
	Description *string
	Category    string
	Attributes  []string
	IsPublic    bool
	CreatorID   string
}

// ScanAbilityPointRows 扫描能力点行。
func ScanAbilityPointRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var description, code *string
		if err := rows.Scan(&a.ID, &a.Name, &code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Description = description
		a.Code = code
		items = append(items, a)
	}
	return items, nil
}

// ListConfig 返回能力点列表查询配置，SQL 片段沉淀在 store 层。
func (s *AbilityStore) ListConfig() ListQueryConfig[domain.AbilityPoint] {
	return ListQueryConfig[domain.AbilityPoint]{
		Table:         "ability_points",
		SelectColumns: "id, name, code, description, category, attributes, is_public, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ScanRows:      ScanAbilityPointRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if p.Values["isPublic"] == "true" {
				qb.AddCondition("is_public = " + qb.NextArg(true))
			}
			if category := p.Values["category"]; category != "" {
				qb.AddCondition("category = " + qb.NextArg(category))
			}
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
		},
	}
}

// ===== 能力域 =====
