package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type AbilityDomainsStore struct {
	DB *pgxpool.Pool
}

func NewAbilityDomainsStore(db *pgxpool.Pool) *AbilityDomainsStore {
	return &AbilityDomainsStore{DB: db}
}

type AbilityDomainCreateParams struct {
	TenantID         string
	CareerPositionID string
	Name             string
	Description      *string
	BindingIDs       []string
	SortOrder        int
}

type AbilityDomainUpdateParams struct {
	CareerPositionID string
	Name             string
	Description      *string
	BindingIDs       []string
	SortOrder        int
}

func (s *AbilityDomainsStore) GetByID(ctx context.Context, id string) (domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var desc *string
	var bindings []string
	err := s.DB.QueryRow(ctx,
		`SELECT id, career_position_id, name, description, binding_ids, sort_order FROM ability_domains WHERE id = $1`, id,
	).Scan(&d.ID, &d.CareerPositionID, &d.Name, &desc, &bindings, &d.SortOrder)
	if err != nil {
		return d, err
	}
	d.Description = desc
	d.BindingIDs = bindings
	return d, nil
}

func (s *AbilityDomainsStore) Create(ctx context.Context, p AbilityDomainCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, p.TenantID, p.CareerPositionID, p.Name, p.Description, coalesceStrSlice(p.BindingIDs), p.SortOrder,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AbilityDomainsStore) Update(ctx context.Context, id string, p AbilityDomainUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE ability_domains SET career_position_id=$1, name=$2, description=$3, binding_ids=$4, sort_order=$5 WHERE id=$6`,
		p.CareerPositionID, p.Name, p.Description, coalesceStrSlice(p.BindingIDs), p.SortOrder, id,
	)
	return err
}

func (s *AbilityDomainsStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM ability_domains WHERE id = $1`, id)
	return err
}

func (s *AbilityDomainsStore) ScanRows(rows pgx.Rows) ([]domain.AbilityDomain, error) {
	items := make([]domain.AbilityDomain, 0)
	for rows.Next() {
		var d domain.AbilityDomain
		var desc *string
		var bindings []string
		if err := rows.Scan(&d.ID, &d.CareerPositionID, &d.Name, &desc, &bindings, &d.SortOrder); err != nil {
			return nil, err
		}
		d.Description = desc
		d.BindingIDs = bindings
		items = append(items, d)
	}
	return items, nil
}
