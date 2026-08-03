package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type LearnRoadsStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *LearnRoadsStore) Q() Queryer {
	return s.q
}

func NewLearnRoadsStore(q Queryer) *LearnRoadsStore {
	return &LearnRoadsStore{q: q}
}

// ListConfig 返回学习路径列表查询配置，SQL 片段沉淀在 store 层。
func (s *LearnRoadsStore) ListConfig() ListQueryConfig[domain.LearnRoad] {
	return ListQueryConfig[domain.LearnRoad]{
		Table:         "learn_roads",
		SelectColumns: "id, name, description, position_ids, steps, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if name := p.Values["name"]; name != "" {
				qb.AddCondition("name ILIKE " + qb.NextArg("%"+name+"%"))
			}
		},
		ScanRows: s.ScanRows,
	}
}

type LearnRoadCreateParams struct {
	TenantID    string
	Name        string
	Description *string
	PositionIDs []string
	Steps       domain.JSONSlice
}

type LearnRoadUpdateParams struct {
	Name        string
	Description *string
	PositionIDs []string
	Steps       domain.JSONSlice
}

func (s *LearnRoadsStore) GetByID(ctx context.Context, id, tenantID string) (domain.LearnRoad, error) {
	var r domain.LearnRoad
	var desc *string
	var posIDs []string
	var steps domain.JSONSlice
	err := s.q.QueryRow(ctx,
		`SELECT id, name, description, position_ids, steps, created_at, updated_at FROM learn_roads WHERE id = $1 AND tenant_id = $2`, id, tenantID,
	).Scan(&r.ID, &r.Name, &desc, &posIDs, &steps, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return r, err
	}
	r.Description = desc
	r.PositionIDs = posIDs
	r.Steps = steps
	return r, nil
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

func (s *LearnRoadsStore) Create(ctx context.Context, p LearnRoadCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO learn_roads (id, tenant_id, name, description, position_ids, steps) VALUES ($1,$2,$3,$4,$5,$6)`,
		id, p.TenantID, p.Name, p.Description, normalizePositionIDs(p.PositionIDs), p.Steps,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *LearnRoadsStore) Update(ctx context.Context, id, tenantID string, p LearnRoadUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE learn_roads SET name=$1, description=$2, position_ids=$3, steps=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`,
		p.Name, p.Description, normalizePositionIDs(p.PositionIDs), p.Steps, id, tenantID,
	)
	return err
}

func (s *LearnRoadsStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM learn_roads WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *LearnRoadsStore) ScanRows(rows pgx.Rows) ([]domain.LearnRoad, error) {
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
