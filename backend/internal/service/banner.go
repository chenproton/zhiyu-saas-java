package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListBanners 查询轮播图列表。
func (s *PositionService) ListBanners(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.JobBannerConfig]) ([]domain.JobBannerConfig, int, error) {
	return s.st.Banners().List(ctx, p, cfg)
}

// GetBanner 查询单个轮播图。
func (s *PositionService) GetBanner(ctx context.Context, id string) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Get(ctx, id)
}

// CreateBanner 创建轮播图。
func (s *PositionService) CreateBanner(ctx context.Context, tenantID string, p *store.BannerParams) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Create(ctx, tenantID, p)
}

// UpdateBanner 更新轮播图。
func (s *PositionService) UpdateBanner(ctx context.Context, id string, p *store.BannerParams) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Update(ctx, id, p)
}

// DeleteBanner 删除轮播图。
func (s *PositionService) DeleteBanner(ctx context.Context, id string) error {
	return s.st.Banners().Delete(ctx, id)
}

// ListAnnouncements 查询公告。
func (s *PositionService) ListAnnouncements(ctx context.Context, role string, tenantID *string) ([]store.AnnouncementRow, error) {
	return s.st.Portal().ListAnnouncements(ctx, role, tenantID)
}
