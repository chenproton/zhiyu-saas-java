package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type LearnRoadsStore struct {
	DB *pgxpool.Pool
}

func NewLearnRoadsStore(db *pgxpool.Pool) *LearnRoadsStore {
	return &LearnRoadsStore{DB: db}
}

type LearnRoadCreateParams struct {
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

func (s *LearnRoadsStore) GetByID(ctx context.Context, id string) (domain.LearnRoad, error) {
	var r domain.LearnRoad
	var desc *string
	var posIDs []string
	var steps domain.JSONSlice
	err := s.DB.QueryRow(ctx,
		`SELECT id, name, description, position_ids, steps, created_at, updated_at FROM learn_roads WHERE id = $1`, id,
	).Scan(&r.ID, &r.Name, &desc, &posIDs, &steps, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return r, err
	}
	r.Description = desc
	r.PositionIDs = posIDs
	r.Steps = steps
	return r, nil
}

func (s *LearnRoadsStore) Create(ctx context.Context, p LearnRoadCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO learn_roads (id, name, description, position_ids, steps) VALUES ($1,$2,$3,$4,$5)`,
		id, p.Name, p.Description, p.PositionIDs, p.Steps,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *LearnRoadsStore) Update(ctx context.Context, id string, p LearnRoadUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE learn_roads SET name=$1, description=$2, position_ids=$3, steps=$4, updated_at=NOW() WHERE id=$5`,
		p.Name, p.Description, p.PositionIDs, p.Steps, id,
	)
	return err
}

func (s *LearnRoadsStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM learn_roads WHERE id = $1`, id)
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
	return items, nil
}
