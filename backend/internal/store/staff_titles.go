package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type StaffTitlesStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *StaffTitlesStore) Q() Queryer {
	return s.q
}

func NewStaffTitlesStore(q Queryer) *StaffTitlesStore {
	return &StaffTitlesStore{q: q}
}

type StaffTitleCreateParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Status      string
}

type StaffTitleUpdateParams struct {
	Name        string
	Description *string
	Status      string
}

func (s *StaffTitlesStore) GetByID(ctx context.Context, id string) (domain.StaffTitle, error) {
	var t domain.StaffTitle
	var desc *string
	err := s.q.QueryRow(ctx,
		`SELECT id, tenant_id, code, name, description, user_count, status, created_at FROM staff_titles WHERE id = $1`, id,
	).Scan(&t.ID, &t.TenantID, &t.Code, &t.Name, &desc, &t.UserCount, &t.Status, &t.CreatedAt)
	if err != nil {
		return t, err
	}
	t.Description = desc
	return t, nil
}

func (s *StaffTitlesStore) Create(ctx context.Context, p StaffTitleCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO staff_titles (id, tenant_id, code, name, description, user_count, status) VALUES ($1,$2,$3,$4,$5,0,$6)`,
		id, p.TenantID, p.Code, p.Name, p.Description, p.Status,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *StaffTitlesStore) Update(ctx context.Context, id string, p StaffTitleUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE staff_titles SET name=$1, description=$2, status=COALESCE(NULLIF($3,''), status), updated_at=NOW() WHERE id=$4`,
		p.Name, p.Description, p.Status, id,
	)
	return err
}

func (s *StaffTitlesStore) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := s.q.Exec(ctx,
		`UPDATE staff_titles SET status=$1, updated_at=NOW() WHERE id=$2`, status, id,
	)
	return err
}

func (s *StaffTitlesStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM staff_titles WHERE id = $1`, id)
	return err
}

func (s *StaffTitlesStore) CountUserRefs(ctx context.Context, tenantID, titleID string) (int, error) {
	var count int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND $2 = ANY(title_ids)`, tenantID, titleID,
	).Scan(&count)
	return count, err
}

func (s *StaffTitlesStore) BatchCountUsersByTitle(ctx context.Context, tenantID string, titleIDs []string) (map[string]int, error) {
	rows, err := s.q.Query(ctx,
		`SELECT title_id, COUNT(*) FROM users, unnest(title_ids) AS title_id WHERE tenant_id=$1 AND title_id=ANY($2::uuid[]) GROUP BY title_id`,
		tenantID, titleIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			continue
		}
		counts[id] = count
	}
	return counts, nil
}

func (s *StaffTitlesStore) ScanRows(rows pgx.Rows) ([]domain.StaffTitle, error) {
	items := make([]domain.StaffTitle, 0)
	for rows.Next() {
		var t domain.StaffTitle
		var desc *string
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Code, &t.Name, &desc, &t.UserCount, &t.Status, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.Description = desc
		items = append(items, t)
	}
	return items, nil
}
