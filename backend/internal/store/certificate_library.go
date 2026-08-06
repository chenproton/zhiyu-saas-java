package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

type CertificateLibraryStore struct {
	*DictStore[domain.CertificateLibraryItem]
}

func NewCertificateLibraryStore(q Queryer) *CertificateLibraryStore {
	return &CertificateLibraryStore{DictStore: NewDictStore(q, DictConfig[domain.CertificateLibraryItem]{
		Table:         "certificate_library",
		SelectColumns: "id, tenant_id, name, url, description, image_url, creator_id, created_at",
		CreateSQL:     `INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		GetByIDSQL:    `SELECT id, tenant_id, name, url, description, image_url, creator_id, created_at FROM certificate_library WHERE id = $1`,
		DeleteSQL:     `DELETE FROM certificate_library WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
			AddTagFilter(qb, p.TenantID, domain.TagResourceTypeCertificate, "id", SplitTagIDs(p.Values["tagIds"]))
		},
	})}
}

type CertificateLibraryCreateParams struct {
	TenantID    string
	Name        string
	URL         *string
	Description *string
	ImageURL    *string
	CreatorID   string
}

func (p CertificateLibraryCreateParams) Tenant() string { return p.TenantID }

func (p CertificateLibraryCreateParams) Args() []any {
	return []any{p.Name, p.URL, p.Description, p.ImageURL, p.CreatorID}
}

type CertificateLibraryUpdateParams struct {
	Name        string
	URL         string
	Description *string
	ImageURL    *string
}

func (p CertificateLibraryUpdateParams) Args() []any {
	return []any{p.Name, p.URL, p.Description, p.ImageURL}
}

// GetByID 按租户隔离查询（证书库归属校验）。
func (s *CertificateLibraryStore) GetByID(ctx context.Context, id, tenantID string) (domain.CertificateLibraryItem, error) {
	var c domain.CertificateLibraryItem
	var url, desc, img, creator *string
	err := s.Q().QueryRow(ctx,
		`SELECT id, tenant_id, name, url, description, image_url, creator_id, created_at FROM certificate_library WHERE id = $1 AND tenant_id = $2`, id, tenantID,
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

// Update 带租户隔离更新。
func (s *CertificateLibraryStore) Update(ctx context.Context, id, tenantID string, p CertificateLibraryUpdateParams) error {
	_, err := s.Q().Exec(ctx,
		`UPDATE certificate_library SET name=$1, url=COALESCE(NULLIF($2,''), url), description=$3, image_url=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`,
		p.Name, p.URL, p.Description, p.ImageURL, id, tenantID,
	)
	return err
}

// Delete 带租户隔离删除。
func (s *CertificateLibraryStore) Delete(ctx context.Context, id, tenantID string) error {
	if err := DeleteResourceTags(ctx, s.Q(), domain.TagResourceTypeCertificate, id); err != nil {
		return err
	}
	_, err := s.Q().Exec(ctx, `DELETE FROM certificate_library WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
