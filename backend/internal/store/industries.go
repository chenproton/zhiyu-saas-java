package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

type IndustriesStore struct {
	*DictStore[domain.Industry]
}

func NewIndustriesStore(q Queryer) *IndustriesStore {
	return &IndustriesStore{DictStore: NewDictStore(q, DictConfig[domain.Industry]{
		Table:         "industries",
		SelectColumns: "id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at",
		CreateSQL:     `INSERT INTO industries (id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
		UpdateSQL:     `UPDATE industries SET code = $1, name = $2, parent_id = $3, enabled = $4, sort_order = $5, updated_at = NOW() WHERE id = $6`,
		GetByIDSQL:    `SELECT id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at FROM industries WHERE id = $1`,
		DeleteSQL:     `DELETE FROM industries WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if parentID := p.Values["parentId"]; parentID != "" {
				qb.AddCondition("parent_id = " + qb.NextArg(parentID))
			}
			if enabledStr := p.Values["enabled"]; enabledStr != "" {
				qb.AddCondition("enabled = " + qb.NextArg(enabledStr == "true"))
			}
		},
	})}
}

type IndustryCreateParams struct {
	TenantID  string
	Code      string
	Name      string
	ParentID  *string
	Enabled   bool
	SortOrder int
}

func (p IndustryCreateParams) Tenant() string { return p.TenantID }

func (p IndustryCreateParams) Args() []any {
	return []any{p.Code, p.Name, p.ParentID, p.Enabled, p.SortOrder}
}

type IndustryUpdateParams struct {
	Code      string
	Name      string
	ParentID  *string
	Enabled   bool
	SortOrder int
}

func (p IndustryUpdateParams) Args() []any {
	return []any{p.Code, p.Name, p.ParentID, p.Enabled, p.SortOrder}
}

// CountChildren 返回直接子行业数（删除前引用检查）。
func (s *IndustriesStore) CountChildren(ctx context.Context, parentID string) (int, error) {
	var count int
	err := s.Q().QueryRow(ctx, `SELECT COUNT(*) FROM industries WHERE parent_id = $1`, parentID).Scan(&count)
	return count, err
}
