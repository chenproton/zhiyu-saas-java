package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// BannerStore 轮播图持久化。
type BannerStore struct {
	q Queryer
}

// NewBannerStore 创建轮播图 store。
func NewBannerStore(q Queryer) *BannerStore {
	return &BannerStore{q: q}
}

// List 查询轮播图列表。
func (s *BannerStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.JobBannerConfig]) ([]domain.JobBannerConfig, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanBannerRows)
}

// Get 查询单个轮播图。
func (s *BannerStore) Get(ctx context.Context, id string) (*domain.JobBannerConfig, error) {
	var b domain.JobBannerConfig
	var linkURL *string
	err := s.q.QueryRow(ctx, `
		SELECT id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at
		FROM banner_configs WHERE id = $1
	`, id).Scan(&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	b.LinkURL = linkURL
	return &b, nil
}

// Create 创建轮播图。
func (s *BannerStore) Create(ctx context.Context, tenantID string, p *BannerParams) (*domain.JobBannerConfig, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO banner_configs (id, tenant_id, title, image_url, link_url, sort_order, is_enabled)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, tenantID, p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新轮播图。
func (s *BannerStore) Update(ctx context.Context, id string, p *BannerParams) (*domain.JobBannerConfig, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE banner_configs SET
			title = $1, image_url = $2, link_url = $3, sort_order = $4, is_enabled = $5, updated_at = NOW()
		WHERE id = $6
	`, p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除轮播图。
func (s *BannerStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM banner_configs WHERE id = $1`, id)
	return err
}

// BannerParams 轮播图参数。
type BannerParams struct {
	Title     string
	ImageURL  string
	LinkURL   *string
	SortOrder int
	IsEnabled bool
}

// ListConfig 返回轮播图列表查询配置，SQL 片段沉淀在 store 层。
func (s *BannerStore) ListConfig() ListQueryConfig[domain.JobBannerConfig] {
	return ListQueryConfig[domain.JobBannerConfig]{
		Table:         "banner_configs",
		SelectColumns: "id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC, created_at DESC",
		ScanRows:      ScanBannerRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if isEnabled := p.Values["isEnabled"]; isEnabled != "" {
				qb.AddCondition("is_enabled = " + qb.NextArg(isEnabled == "true"))
			}
		},
	}
}

// ScanBannerRows 扫描轮播图行。
func ScanBannerRows(rows pgx.Rows) ([]domain.JobBannerConfig, error) {
	items := make([]domain.JobBannerConfig, 0)
	for rows.Next() {
		var b domain.JobBannerConfig
		var linkURL *string
		if err := rows.Scan(&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		b.LinkURL = linkURL
		items = append(items, b)
	}
	return items, nil
}

// ===== 学期 =====
