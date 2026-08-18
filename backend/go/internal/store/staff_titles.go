package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

type StaffTitlesStore struct {
	*DictStore[domain.StaffTitle]
}

func NewStaffTitlesStore(q Queryer) *StaffTitlesStore {
	return &StaffTitlesStore{DictStore: NewDictStore(q, DictConfig[domain.StaffTitle]{
		Table:         "staff_titles",
		SelectColumns: "id, tenant_id, code, name, description, user_count, status, created_at",
		CreateSQL:     `INSERT INTO staff_titles (id, tenant_id, code, name, description, user_count, status) VALUES ($1,$2,$3,$4,$5,0,$6)`,
		UpdateSQL:     `UPDATE staff_titles SET name=$1, description=$2, status=COALESCE(NULLIF($3,''), status) WHERE id=$4`,
		GetByIDSQL:    `SELECT id, tenant_id, code, name, description, user_count, status, created_at FROM staff_titles WHERE id = $1`,
		DeleteSQL:     `DELETE FROM staff_titles WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
	})}
}

type StaffTitleCreateParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Status      string
}

func (p StaffTitleCreateParams) Tenant() string { return p.TenantID }

func (p StaffTitleCreateParams) Args() []any {
	return []any{p.Code, p.Name, p.Description, p.Status}
}

type StaffTitleUpdateParams struct {
	Name        string
	Description *string
	Status      string
}

func (p StaffTitleUpdateParams) Args() []any {
	return []any{p.Name, p.Description, p.Status}
}

// UpdateStatus 仅更新启用状态（不走通用 Update 的 COALESCE 分支；限定租户，纵深防御）。
func (s *StaffTitlesStore) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := s.Q().Exec(ctx,
		`UPDATE staff_titles SET status=$1 WHERE id=$2 AND tenant_id=$3`, status, id, tenantID,
	)
	return err
}

// CountUserRefs 返回引用该职称的用户数（删除前引用检查）。
func (s *StaffTitlesStore) CountUserRefs(ctx context.Context, tenantID, titleID string) (int, error) {
	var count int
	err := s.Q().QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND $2 = ANY(title_ids)`, tenantID, titleID,
	).Scan(&count)
	return count, err
}

// BatchCountUsersByTitle 批量统计各职称下的用户数（列表页用户数展示）。
func (s *StaffTitlesStore) BatchCountUsersByTitle(ctx context.Context, tenantID string, titleIDs []string) (map[string]int, error) {
	rows, err := s.Q().Query(ctx,
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
	return counts, rows.Err()
}
