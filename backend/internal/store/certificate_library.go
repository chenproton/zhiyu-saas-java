package store

import (
	"context"
	"time"

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

// CitationStats 证书引用次数分布（引用源：岗位证书绑定）。
func (s *CertificateLibraryStore) CitationStats(ctx context.Context, tenantID string) (CitationStats, error) {
	rows, err := s.Q().Query(ctx, `
		SELECT `+citationBucketCase+`, COUNT(*) AS cnt
		FROM (
			SELECT cl.id,
				COALESCE((SELECT COUNT(*) FROM position_certificates pc WHERE pc.certificate_library_id = cl.id), 0) AS ref_count
			FROM certificate_library cl
			WHERE cl.tenant_id = $1
		) refs
		GROUP BY bucket
	`, tenantID)
	if err != nil {
		return CitationStats{}, err
	}
	defer rows.Close()
	return scanCitationStats(rows)
}

// ListUncited 零引用证书列表（弹窗：创建时段筛选 + 分页）。
func (s *CertificateLibraryStore) ListUncited(ctx context.Context, tenantID string, from, to *time.Time, limit, offset int) ([]UncitedItem, int, error) {
	where := "cl.tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2
	if from != nil {
		where += " AND cl.created_at >= $" + Itoa(argIdx)
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		where += " AND cl.created_at < $" + Itoa(argIdx)
		args = append(args, *to)
		argIdx++
	}
	uncited := `
		AND NOT EXISTS (SELECT 1 FROM position_certificates pc WHERE pc.certificate_library_id = cl.id)`

	var total int
	if err := s.Q().QueryRow(ctx, "SELECT COUNT(*) FROM certificate_library cl WHERE "+where+uncited, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	rows, err := s.Q().Query(ctx, `
		SELECT cl.id, cl.name, cl.created_at
		FROM certificate_library cl
		WHERE `+where+uncited+`
		ORDER BY cl.created_at DESC
		LIMIT $`+Itoa(argIdx)+` OFFSET $`+Itoa(argIdx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]UncitedItem, 0, limit)
	for rows.Next() {
		var it UncitedItem
		if err := rows.Scan(&it.ID, &it.Name, &it.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}
