package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type CertificateLibraryStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *CertificateLibraryStore) Q() Queryer {
	return s.q
}

func NewCertificateLibraryStore(q Queryer) *CertificateLibraryStore {
	return &CertificateLibraryStore{q: q}
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
	err := s.q.QueryRow(ctx,
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
	_, err := s.q.Exec(ctx,
		`INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, p.TenantID, p.Name, p.URL, p.Description, p.ImageURL, p.CreatorID,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *CertificateLibraryStore) Update(ctx context.Context, id string, p CertificateLibraryUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE certificate_library SET name=$1, url=COALESCE(NULLIF($2,''), url), description=$3, image_url=$4, updated_at=NOW() WHERE id=$5`,
		p.Name, p.URL, p.Description, p.ImageURL, id,
	)
	return err
}

func (s *CertificateLibraryStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM certificate_library WHERE id = $1`, id)
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

// ListConfig 返回证书库列表查询配置，SQL 片段沉淀在 store 层。
func (s *CertificateLibraryStore) ListConfig() ListQueryConfig[domain.CertificateLibraryItem] {
	return ListQueryConfig[domain.CertificateLibraryItem]{
		Table:         "certificate_library",
		SelectColumns: "id, tenant_id, name, url, description, image_url, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
		},
		ScanRows: s.ScanRows,
	}
}
