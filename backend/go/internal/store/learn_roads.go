package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type LearnRoadsStore struct {
	*DictStore[domain.LearnRoad]
}

func NewLearnRoadsStore(q Queryer) *LearnRoadsStore {
	return &LearnRoadsStore{DictStore: NewDictStore(q, DictConfig[domain.LearnRoad]{
		Table:         "learn_roads",
		SelectColumns: "id, name, description, position_ids, steps, created_at, updated_at",
		CreateSQL:     `INSERT INTO learn_roads (id, tenant_id, name, description, position_ids, steps) VALUES ($1,$2,$3,$4,$5,$6)`,
		DeleteSQL:     `DELETE FROM learn_roads WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if name := p.Values["name"]; name != "" {
				qb.AddCondition("name ILIKE " + qb.NextArg("%"+name+"%"))
			}
		},
		ScanRows: func(rows pgx.Rows) ([]domain.LearnRoad, error) {
			return scanLearnRoadRows(rows)
		},
	})}
}

type LearnRoadCreateParams struct {
	TenantID    string
	Name        string
	Description *string
	PositionIDs []string
	Steps       domain.JSONSlice
}

func (p LearnRoadCreateParams) Tenant() string { return p.TenantID }

func (p LearnRoadCreateParams) Args() []any {
	return []any{p.Name, p.Description, normalizePositionIDs(p.PositionIDs), p.Steps}
}

type LearnRoadUpdateParams struct {
	Name        string
	Description *string
	PositionIDs []string
	Steps       domain.JSONSlice
}

func (p LearnRoadUpdateParams) Args() []any {
	return []any{p.Name, p.Description, normalizePositionIDs(p.PositionIDs), p.Steps}
}

// GetByID 带租户隔离查询（学习路径归属校验）。
func (s *LearnRoadsStore) GetByID(ctx context.Context, id, tenantID string) (domain.LearnRoad, error) {
	row := s.Q().QueryRow(ctx,
		`SELECT id, name, description, position_ids, steps, created_at, updated_at FROM learn_roads WHERE id = $1 AND tenant_id = $2`, id, tenantID,
	)
	return scanLearnRoadRow(row)
}

// Update 带租户隔离更新。
func (s *LearnRoadsStore) Update(ctx context.Context, id, tenantID string, p LearnRoadUpdateParams) error {
	_, err := s.Q().Exec(ctx,
		`UPDATE learn_roads SET name=$1, description=$2, position_ids=$3, steps=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`,
		p.Name, p.Description, normalizePositionIDs(p.PositionIDs), p.Steps, id, tenantID,
	)
	return err
}

// Delete 带租户隔离删除。
func (s *LearnRoadsStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.Q().Exec(ctx, `DELETE FROM learn_roads WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func normalizePositionIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if u, err := uuid.Parse(id); err == nil {
			out = append(out, u.String())
		}
		// 非法 ID 直接丢弃，避免写入 SHA1 伪 UUID 脏引用
	}
	return out
}

// scanLearnRoadRow 手动扫描：steps(jsonb→JSONSlice) 不适用位置扫描。
func scanLearnRoadRow(row pgx.Row) (domain.LearnRoad, error) {
	var r domain.LearnRoad
	var desc *string
	var posIDs []string
	var steps domain.JSONSlice
	if err := row.Scan(&r.ID, &r.Name, &desc, &posIDs, &steps, &r.CreatedAt, &r.UpdatedAt); err != nil {
		return r, err
	}
	r.Description = desc
	r.PositionIDs = posIDs
	r.Steps = steps
	return r, nil
}

func scanLearnRoadRows(rows pgx.Rows) ([]domain.LearnRoad, error) {
	items := make([]domain.LearnRoad, 0)
	for rows.Next() {
		var r domain.LearnRoad
		var desc *string
		var posIDs []string
		var steps domain.JSONSlice
		if err := rows.Scan(&r.ID, &r.Name, &desc, &posIDs, &steps, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		r.Description = desc
		r.PositionIDs = posIDs
		r.Steps = steps
		items = append(items, r)
	}
	return items, rows.Err()
}
