package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type OrgTypesStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *OrgTypesStore) Q() Queryer {
	return s.q
}

func NewOrgTypesStore(q Queryer) *OrgTypesStore {
	return &OrgTypesStore{q: q}
}

type OrgTypeCreateParams struct {
	TenantID    string
	Name        string
	Category    string
	Description *string
}

type OrgTypeUpdateParams struct {
	Name        string
	Category    string
	Description *string
}

func (s *OrgTypesStore) GetByID(ctx context.Context, id string) (domain.OrgType, error) {
	var o domain.OrgType
	var desc *string
	err := s.q.QueryRow(ctx,
		`SELECT id, tenant_id, name, category, description, is_default, created_at FROM org_types WHERE id = $1`, id,
	).Scan(&o.ID, &o.TenantID, &o.Name, &o.Category, &desc, &o.IsDefault, &o.CreatedAt)
	if err != nil {
		return o, err
	}
	o.Description = desc
	return o, nil
}

func (s *OrgTypesStore) Create(ctx context.Context, p OrgTypeCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO org_types (id, tenant_id, name, category, description) VALUES ($1,$2,$3,$4,$5)`,
		id, p.TenantID, p.Name, p.Category, p.Description,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *OrgTypesStore) Update(ctx context.Context, id string, p OrgTypeUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE org_types SET name=$1, category=$2, description=$3 WHERE id=$4`,
		p.Name, p.Category, p.Description, id,
	)
	return err
}

func (s *OrgTypesStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM org_types WHERE id = $1`, id)
	return err
}

func (s *OrgTypesStore) CountOrgRefs(ctx context.Context, orgTypeID string) (int, error) {
	var count int
	err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM organizations WHERE type_id = $1`, orgTypeID).Scan(&count)
	return count, err
}

func (s *OrgTypesStore) ScanRows(rows pgx.Rows) ([]domain.OrgType, error) {
	items := make([]domain.OrgType, 0)
	for rows.Next() {
		var o domain.OrgType
		var desc *string
		if err := rows.Scan(&o.ID, &o.TenantID, &o.Name, &o.Category, &desc, &o.IsDefault, &o.CreatedAt); err != nil {
			return nil, err
		}
		o.Description = desc
		items = append(items, o)
	}
	return items, nil
}

// ListConfig 返回组织类型列表查询配置，SQL 片段沉淀在 store 层。
func (s *OrgTypesStore) ListConfig() ListQueryConfig[domain.OrgType] {
	return ListQueryConfig[domain.OrgType]{
		Table:         "org_types",
		SelectColumns: "id, tenant_id, name, category, description, is_default, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if category := p.Values["category"]; category != "" {
				qb.AddCondition("category = " + qb.NextArg(category))
			}
		},
		ScanRows: s.ScanRows,
	}
}
