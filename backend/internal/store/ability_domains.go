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
func (s *AbilityDomainStore) Get(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	d, err := s.fetchDomain(ctx, id)
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
	return s.Get(ctx, id)
}

// Update 更新能力域。
func (s *AbilityDomainStore) Update(ctx context.Context, id string, p *AbilityDomainParams) (*domain.AbilityDomain, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_domains SET
			career_position_id = $1, name = $2, description = $3, binding_ids = $4, sort_order = $5
		WHERE id = $6
	`, p.CareerPositionID, p.Name, p.Description, p.BindingIDs, p.SortOrder, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除能力域。
func (s *AbilityDomainStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM ability_domains WHERE id = $1`, id)
	return err
}

// AbilityDomainParams 能力域参数。
type AbilityDomainParams struct {
	CareerPositionID string
	Name             string
	Description      *string
	BindingIDs       []string
	SortOrder        int
}

func (s *AbilityDomainStore) fetchDomain(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var tenantID, description *string
	var bindingIDs []string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains WHERE id = $1
	`, id).Scan(&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder)
	if err != nil {
		return nil, err
	}
	d.TenantID = tenantID
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
	return items, nil
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
