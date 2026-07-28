package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type JobBannersStore struct {
	DB *pgxpool.Pool
}

func NewJobBannersStore(db *pgxpool.Pool) *JobBannersStore {
	return &JobBannersStore{DB: db}
}

type JobBannerCreateParams struct {
	TenantID  string
	Title     string
	ImageURL  string
	LinkURL   *string
	SortOrder int
	IsEnabled bool
}

type JobBannerUpdateParams struct {
	Title     string
	ImageURL  string
	LinkURL   *string
	SortOrder int
	IsEnabled bool
}

func (s *JobBannersStore) GetByID(ctx context.Context, id string) (domain.JobBannerConfig, error) {
	var b domain.JobBannerConfig
	var link *string
	err := s.DB.QueryRow(ctx,
		`SELECT id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at FROM banner_configs WHERE id = $1`, id,
	).Scan(&b.ID, &b.Title, &b.ImageURL, &link, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return b, err
	}
	b.LinkURL = link
	return b, nil
}

func (s *JobBannersStore) Create(ctx context.Context, p JobBannerCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO banner_configs (id, tenant_id, title, image_url, link_url, sort_order, is_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, p.TenantID, p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *JobBannersStore) Update(ctx context.Context, id string, p JobBannerUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE banner_configs SET title=$1, image_url=$2, link_url=$3, sort_order=$4, is_enabled=$5, updated_at=NOW() WHERE id=$6`,
		p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled, id,
	)
	return err
}

func (s *JobBannersStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM banner_configs WHERE id = $1`, id)
	return err
}

func (s *JobBannersStore) ScanRows(rows pgx.Rows) ([]domain.JobBannerConfig, error) {
	items := make([]domain.JobBannerConfig, 0)
	for rows.Next() {
		var b domain.JobBannerConfig
		var link *string
		if err := rows.Scan(&b.ID, &b.Title, &b.ImageURL, &link, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		b.LinkURL = link
		items = append(items, b)
	}
	return items, nil
}
