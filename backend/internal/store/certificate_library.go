package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type CertificateLibraryStore struct {
	DB *pgxpool.Pool
}

func NewCertificateLibraryStore(db *pgxpool.Pool) *CertificateLibraryStore {
	return &CertificateLibraryStore{DB: db}
}

type CertificateLibraryCreateParams struct {
	TenantID    string
	Name        string
	URL         *string
	Description *string
	ImageURL    *string
	CreatorID   string
}

type CertificateLibraryUpdateParams struct {
	Name        string
	URL         string
	Description *string
	ImageURL    *string
}

func (s *CertificateLibraryStore) GetByID(ctx context.Context, id string) (domain.CertificateLibraryItem, error) {
	var c domain.CertificateLibraryItem
	var url, desc, img, creator *string
	err := s.DB.QueryRow(ctx,
		`SELECT id, tenant_id, name, url, description, image_url, creator_id, created_at FROM certificate_library WHERE id = $1`, id,
	).Scan(&c.ID, &c.TenantID, &c.Name, &url, &desc, &img, &creator, &c.CreatedAt)
	if err != nil {
		return c, err
	}
	c.URL = url
	c.Description = desc
	c.ImageURL = img
	c.CreatorID = creator
	return c, nil
}

func (s *CertificateLibraryStore) Create(ctx context.Context, p CertificateLibraryCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, p.TenantID, p.Name, p.URL, p.Description, p.ImageURL, p.CreatorID,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *CertificateLibraryStore) Update(ctx context.Context, id string, p CertificateLibraryUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE certificate_library SET name=$1, url=COALESCE(NULLIF($2,''), url), description=$3, image_url=$4, updated_at=NOW() WHERE id=$5`,
		p.Name, p.URL, p.Description, p.ImageURL, id,
	)
	return err
}

func (s *CertificateLibraryStore) Delete(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM certificate_library WHERE id = $1`, id)
	return err
}

func (s *CertificateLibraryStore) ScanRows(rows pgx.Rows) ([]domain.CertificateLibraryItem, error) {
	items := make([]domain.CertificateLibraryItem, 0)
	for rows.Next() {
		var c domain.CertificateLibraryItem
		var url, desc, img, creator *string
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &url, &desc, &img, &creator, &c.CreatedAt); err != nil {
			return nil, err
		}
		c.URL = url
		c.Description = desc
		c.ImageURL = img
		c.CreatorID = creator
		items = append(items, c)
	}
	return items, nil
}
