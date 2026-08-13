package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// AbilityDomainStore 能力域持久化。
type AbilityDomainStore struct {
	q Queryer
}

// NewAbilityDomainStore 创建能力域 store。
func NewAbilityDomainStore(q Queryer) *AbilityDomainStore {
	return &AbilityDomainStore{q: q}
}

// List 查询能力域列表。
func (s *AbilityDomainStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AbilityDomain]) ([]domain.AbilityDomain, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAbilityDomainRows)
}

// Get 查询单个能力域。
func (s *AbilityDomainStore) Get(ctx context.Context, id, tenantID string) (*domain.AbilityDomain, error) {
	d, err := s.fetchDomain(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

// Create 创建能力域。
func (s *AbilityDomainStore) Create(ctx context.Context, tenantID string, p *AbilityDomainParams) (*domain.AbilityDomain, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, tenantID, p.CareerPositionID, p.Name, p.Description, p.BindingIDs, p.SortOrder).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新能力域。
func (s *AbilityDomainStore) Update(ctx context.Context, id, tenantID string, p *AbilityDomainParams) (*domain.AbilityDomain, error) {
	if _, err := s.Get(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_domains SET
			career_position_id = $1, name = $2, description = $3, binding_ids = $4, sort_order = $5
		WHERE id = $6 AND tenant_id = $7
	`, p.CareerPositionID, p.Name, p.Description, p.BindingIDs, p.SortOrder, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除能力域。
func (s *AbilityDomainStore) Delete(ctx context.Context, id, tenantID string) error {
	tag, err := s.q.Exec(ctx, `DELETE FROM ability_domains WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	// 与 abilities.go Delete 语义一致：不存在时报 NotFound
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AbilityDomainParams 能力域参数。
type AbilityDomainParams struct {
	CareerPositionID string
	Name             string
	Description      *string
	BindingIDs       []string
	SortOrder        int
}

func (s *AbilityDomainStore) fetchDomain(ctx context.Context, id, tenantID string) (*domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var tenant, description *string
	var bindingIDs []string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&d.ID, &tenant, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder)
	if err != nil {
		return nil, err
	}
	d.TenantID = tenant
	d.Description = description
	d.BindingIDs = bindingIDs
	return &d, nil
}

// ScanAbilityDomainRows 扫描能力域行。
func ScanAbilityDomainRows(rows pgx.Rows) ([]domain.AbilityDomain, error) {
	items := make([]domain.AbilityDomain, 0)
	for rows.Next() {
		var d domain.AbilityDomain
		var tenantID, description *string
		var bindingIDs []string
		if err := rows.Scan(&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder); err != nil {
			return nil, err
		}
		d.TenantID = tenantID
		d.Description = description
		d.BindingIDs = bindingIDs
		items = append(items, d)
	}
	return items, rows.Err()
}

// ListConfig 返回能力域列表查询配置，SQL 片段沉淀在 store 层。
func (s *AbilityDomainStore) ListConfig() ListQueryConfig[domain.AbilityDomain] {
	return ListQueryConfig[domain.AbilityDomain]{
		Table:         "ability_domains",
		SelectColumns: "id, tenant_id, career_position_id, name, description, binding_ids, sort_order",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC",
		ScanRows:      ScanAbilityDomainRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
}

// ===== 轮播图 =====
