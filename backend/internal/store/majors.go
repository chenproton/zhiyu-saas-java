package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type MajorsStore struct {
	DB *pgxpool.Pool
}

func NewMajorsStore(db *pgxpool.Pool) *MajorsStore {
	return &MajorsStore{DB: db}
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
	err := s.DB.QueryRow(ctx,
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
	_, err := s.DB.Exec(ctx,
		`INSERT INTO majors (id, tenant_id, code, name, alias, enabled, created_at, updated_at) VALUES ($1,$2,$3,normalize($4,NFKC),normalize($5,NFKC),$6,NOW(),NOW())`,
		id, p.TenantID, p.Code, p.Name, p.Alias, p.Enabled,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *MajorsStore) Update(ctx context.Context, id string, p MajorUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE majors SET code=$1, name=normalize($2,NFKC), alias=normalize($3,NFKC), enabled=$4, updated_at=NOW() WHERE id=$5`,
		p.Code, p.Name, p.Alias, p.Enabled, id,
	)
	return err
}

func (s *MajorsStore) CountUserRefs(ctx context.Context, majorID string) (int, error) {
	var count int
	err := s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE major_id = $1`, majorID).Scan(&count)
	return count, err
}

func (s *MajorsStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM majors WHERE id = $1`, id)
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
