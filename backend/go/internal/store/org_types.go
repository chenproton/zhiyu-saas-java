package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

type OrgTypesStore struct {
	*DictStore[domain.OrgType]
}

func NewOrgTypesStore(q Queryer) *OrgTypesStore {
	return &OrgTypesStore{DictStore: NewDictStore(q, DictConfig[domain.OrgType]{
		Table:         "org_types",
		SelectColumns: "id, tenant_id, name, category, description, is_default, created_at",
		CreateSQL:     `INSERT INTO org_types (id, tenant_id, name, category, description) VALUES ($1,$2,$3,$4,$5)`,
		UpdateSQL:     `UPDATE org_types SET name=$1, category=$2, description=$3 WHERE id=$4`,
		GetByIDSQL:    `SELECT id, tenant_id, name, category, description, is_default, created_at FROM org_types WHERE id = $1`,
		DeleteSQL:     `DELETE FROM org_types WHERE id = $1`,
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
	})}
}

type OrgTypeCreateParams struct {
	TenantID    string
	Name        string
	Category    string
	Description *string
}

func (p OrgTypeCreateParams) Tenant() string { return p.TenantID }

func (p OrgTypeCreateParams) Args() []any {
	return []any{p.Name, p.Category, p.Description}
}

type OrgTypeUpdateParams struct {
	Name        string
	Category    string
	Description *string
}

func (p OrgTypeUpdateParams) Args() []any {
	return []any{p.Name, p.Category, p.Description}
}

// CountOrgRefs 返回引用该组织类型的组织数（删除前引用检查）。
func (s *OrgTypesStore) CountOrgRefs(ctx context.Context, orgTypeID string) (int, error) {
	var count int
	err := s.Q().QueryRow(ctx, `SELECT COUNT(*) FROM organizations WHERE type_id = $1`, orgTypeID).Scan(&count)
	return count, err
}
