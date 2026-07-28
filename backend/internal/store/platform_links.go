package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type PlatformLinksStore struct {
	DB *pgxpool.Pool
}

func NewPlatformLinksStore(db *pgxpool.Pool) *PlatformLinksStore {
	return &PlatformLinksStore{DB: db}
}

type PlatformLinkUpsertParams struct {
	Platform string
	URL      string
	Enabled  bool
}

type PlatformLinkUpdateParams struct {
	URL     string
	Enabled bool
}

func (s *PlatformLinksStore) GetByID(ctx context.Context, id string) (domain.PlatformLink, error) {
	var p domain.PlatformLink
	err := s.DB.QueryRow(ctx,
		`SELECT id, platform, url, enabled FROM platform_links WHERE id = $1`, id,
	).Scan(&p.ID, &p.Platform, &p.URL, &p.Enabled)
	return p, err
}

func (s *PlatformLinksStore) GetByPlatform(ctx context.Context, platform string) (domain.PlatformLink, error) {
	var p domain.PlatformLink
	err := s.DB.QueryRow(ctx,
		`SELECT id, platform, url, enabled FROM platform_links WHERE platform = $1`, platform,
	).Scan(&p.ID, &p.Platform, &p.URL, &p.Enabled)
	return p, err
}

func (s *PlatformLinksStore) Upsert(ctx context.Context, p PlatformLinkUpsertParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO platform_links (id, platform, url, enabled) VALUES ($1,$2,$3,$4) ON CONFLICT (platform) DO UPDATE SET url=EXCLUDED.url, enabled=EXCLUDED.enabled`,
		id, p.Platform, p.URL, p.Enabled,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *PlatformLinksStore) Update(ctx context.Context, id string, p PlatformLinkUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE platform_links SET url=$1, enabled=$2 WHERE id=$3`,
		p.URL, p.Enabled, id,
	)
	return err
}

func (s *PlatformLinksStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM platform_links WHERE id = $1`, id)
	return err
}

func (s *PlatformLinksStore) ScanRows(rows pgx.Rows) ([]domain.PlatformLink, error) {
	items := make([]domain.PlatformLink, 0)
	for rows.Next() {
		var p domain.PlatformLink
		if err := rows.Scan(&p.ID, &p.Platform, &p.URL, &p.Enabled); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}
