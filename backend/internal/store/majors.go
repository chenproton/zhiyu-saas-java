package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

type MajorsStore struct {
	*DictStore[domain.Major]
}

func NewMajorsStore(q Queryer) *MajorsStore {
	return &MajorsStore{DictStore: NewDictStore(q, DictConfig[domain.Major]{
		Table:         "majors",
		SelectColumns: "id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		CreateSQL:     `INSERT INTO majors (id, tenant_id, code, name, alias, enabled, created_at, updated_at) VALUES ($1,$2,$3,normalize($4,NFKC),normalize($5,NFKC),$6,NOW(),NOW())`,
		UpdateSQL:     `UPDATE majors SET code=$1, name=normalize($2,NFKC), alias=normalize($3,NFKC), enabled=$4, updated_at=NOW() WHERE id=$5`,
		GetByIDSQL:    `SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at FROM majors WHERE id = $1`,
		DeleteSQL:     `DELETE FROM majors WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if enabledStr := p.Values["enabled"]; enabledStr != "" {
				qb.AddCondition("enabled = " + qb.NextArg(enabledStr == "true"))
			}
		},
	})}
}

type MajorCreateParams struct {
	TenantID string
	Code     string
	Name     string
	Alias    *string
	Enabled  bool
}

func (p MajorCreateParams) Tenant() string { return p.TenantID }

func (p MajorCreateParams) Args() []any {
	return []any{p.Code, p.Name, p.Alias, p.Enabled}
}

type MajorUpdateParams struct {
	Code    string
	Name    string
	Alias   *string
	Enabled bool
}

func (p MajorUpdateParams) Args() []any {
	return []any{p.Code, p.Name, p.Alias, p.Enabled}
}

// CountUserRefs 返回引用该专业的用户数（删除前引用检查）。
func (s *MajorsStore) CountUserRefs(ctx context.Context, majorID string) (int, error) {
	var count int
	err := s.Q().QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE major_id = $1`, majorID).Scan(&count)
	return count, err
}
