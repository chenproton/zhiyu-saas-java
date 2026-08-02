package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type MajorsStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *MajorsStore) Q() Queryer {
	return s.q
}

func NewMajorsStore(q Queryer) *MajorsStore {
	return &MajorsStore{q: q}
}

type MajorCreateParams struct {
	TenantID string
	Code     string
	Name     string
	Alias    *string
	Enabled  bool
}

type MajorUpdateParams struct {
	Code    string
	Name    string
	Alias   *string
	Enabled bool
}

func (s *MajorsStore) GetByID(ctx context.Context, id string) (domain.Major, error) {
	var m domain.Major
	var alias *string
	err := s.q.QueryRow(ctx,
		`SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at FROM majors WHERE id = $1`, id,
	).Scan(&m.ID, &m.TenantID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return m, err
	}
	m.Alias = alias
	return m, nil
}

func (s *MajorsStore) Create(ctx context.Context, p MajorCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO majors (id, tenant_id, code, name, alias, enabled, created_at, updated_at) VALUES ($1,$2,$3,normalize($4,NFKC),normalize($5,NFKC),$6,NOW(),NOW())`,
		id, p.TenantID, p.Code, p.Name, p.Alias, p.Enabled,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *MajorsStore) Update(ctx context.Context, id string, p MajorUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE majors SET code=$1, name=normalize($2,NFKC), alias=normalize($3,NFKC), enabled=$4, updated_at=NOW() WHERE id=$5`,
		p.Code, p.Name, p.Alias, p.Enabled, id,
	)
	return err
}

func (s *MajorsStore) CountUserRefs(ctx context.Context, majorID string) (int, error) {
	var count int
	err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE major_id = $1`, majorID).Scan(&count)
	return count, err
}

func (s *MajorsStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM majors WHERE id = $1`, id)
	return err
}

func (s *MajorsStore) ScanRows(rows pgx.Rows) ([]domain.Major, error) {
	items := make([]domain.Major, 0)
	for rows.Next() {
		var m domain.Major
		var alias *string
		if err := rows.Scan(&m.ID, &m.TenantID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Alias = alias
		items = append(items, m)
	}
	return items, nil
}

// ListConfig 返回专业列表查询配置，SQL 片段沉淀在 store 层。
func (s *MajorsStore) ListConfig() ListQueryConfig[domain.Major] {
	return ListQueryConfig[domain.Major]{
		Table:         "majors",
		SelectColumns: "id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if enabledStr := p.Values["enabled"]; enabledStr != "" {
				qb.AddCondition("enabled = " + qb.NextArg(enabledStr == "true"))
			}
		},
		ScanRows: s.ScanRows,
	}
}
