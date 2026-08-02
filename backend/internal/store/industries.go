package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type IndustriesStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *IndustriesStore) Q() Queryer {
	return s.q
}

func NewIndustriesStore(q Queryer) *IndustriesStore {
	return &IndustriesStore{q: q}
}

type IndustryCreateParams struct {
	TenantID  string
	Code      string
	Name      string
	ParentID  *string
	Enabled   bool
	SortOrder int
}

type IndustryUpdateParams struct {
	Code      string
	Name      string
	ParentID  *string
	Enabled   bool
	SortOrder int
}

func (s *IndustriesStore) GetByID(ctx context.Context, id string) (domain.Industry, error) {
	var i domain.Industry
	var parentID *string

	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at
		FROM industries WHERE id = $1
	`, id).Scan(&i.ID, &i.TenantID, &i.Code, &i.Name, &parentID, &i.Enabled, &i.SortOrder, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return i, err
	}
	i.ParentID = parentID
	return i, nil
}

func (s *IndustriesStore) Create(ctx context.Context, p IndustryCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO industries (id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`, id, p.TenantID, p.Code, p.Name, p.ParentID, p.Enabled, p.SortOrder)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *IndustriesStore) Update(ctx context.Context, id string, p IndustryUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE industries SET code = $1, name = $2, parent_id = $3, enabled = $4, sort_order = $5, updated_at = NOW()
		WHERE id = $6
	`, p.Code, p.Name, p.ParentID, p.Enabled, p.SortOrder, id)
	return err
}

func (s *IndustriesStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM industries WHERE id = $1`, id)
	return err
}

func (s *IndustriesStore) CountChildren(ctx context.Context, parentID string) (int, error) {
	var count int
	err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM industries WHERE parent_id = $1`, parentID).Scan(&count)
	return count, err
}

func (s *IndustriesStore) ScanRows(rows pgx.Rows) ([]domain.Industry, error) {
	items := make([]domain.Industry, 0)
	for rows.Next() {
		var i domain.Industry
		var parentID *string
		if err := rows.Scan(&i.ID, &i.TenantID, &i.Code, &i.Name, &parentID, &i.Enabled, &i.SortOrder, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		i.ParentID = parentID
		items = append(items, i)
	}
	return items, nil
}
