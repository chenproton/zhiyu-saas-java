package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type AbilitiesStore struct {
	DB *pgxpool.Pool
}

func NewAbilitiesStore(db *pgxpool.Pool) *AbilitiesStore {
	return &AbilitiesStore{DB: db}
}

type AbilityCreateParams struct {
	TenantID    string
	Name        string
	Description *string
	Category    string
	Attributes  []string
	IsPublic    bool
	CreatorID   string
}

type AbilityUpdateParams struct {
	Name        string
	Description *string
	Category    string
	Attributes  []string
	IsPublic    bool
}

func (s *AbilitiesStore) GetByID(ctx context.Context, id string) (domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var desc, code *string
	err := s.DB.QueryRow(ctx,
		`SELECT id, name, code, description, category, attributes, is_public, creator_id, created_at FROM ability_points WHERE id = $1`, id,
	).Scan(&a.ID, &a.Name, &code, &desc, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt)
	if err != nil {
		return a, err
	}
	a.Description = desc
	a.Code = code
	return a, nil
}

func (s *AbilitiesStore) Create(ctx context.Context, p AbilityCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO ability_points (id, tenant_id, name, description, category, attributes, is_public, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		id, p.TenantID, p.Name, p.Description, p.Category, coalesceStrSlice(p.Attributes), p.IsPublic, p.CreatorID,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AbilitiesStore) Update(ctx context.Context, id string, p AbilityUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE ability_points SET name=$1, description=$2, category=$3, attributes=$4, is_public=$5 WHERE id=$6`,
		p.Name, p.Description, p.Category, coalesceStrSlice(p.Attributes), p.IsPublic, id,
	)
	return err
}

func (s *AbilitiesStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM ability_points WHERE id = $1`, id)
	return err
}

func (s *AbilitiesStore) ScanRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var desc, code *string
		if err := rows.Scan(&a.ID, &a.Name, &code, &desc, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Description = desc
		a.Code = code
		items = append(items, a)
	}
	return items, nil
}

func coalesceStrSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
