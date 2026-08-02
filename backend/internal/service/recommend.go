package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListRecommends 查询推荐位列表。
func (s *PositionService) ListRecommends(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.PositionRecommendation]) ([]domain.PositionRecommendation, int, error) {
	return s.st.Recommends().List(ctx, p, cfg)
}

// GetRecommend 查询单个推荐位。
func (s *PositionService) GetRecommend(ctx context.Context, id string) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Get(ctx, id)
}

// CreateRecommend 创建推荐位。
func (s *PositionService) CreateRecommend(ctx context.Context, tenantID string, p *store.RecommendParams) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Create(ctx, tenantID, p)
}

// UpdateRecommend 更新推荐位。
func (s *PositionService) UpdateRecommend(ctx context.Context, id string, p *store.RecommendParams) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Update(ctx, id, p)
}

// DeleteRecommend 删除推荐位。
func (s *PositionService) DeleteRecommend(ctx context.Context, id string) error {
	return s.st.Recommends().Delete(ctx, id)
}
