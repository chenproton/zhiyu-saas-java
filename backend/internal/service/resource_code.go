package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListResourceCodes 查询资源码列表。
func (s *PositionService) ListResourceCodes(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ResourceCode]) ([]domain.ResourceCode, int, error) {
	return s.st.ResourceCodes().List(ctx, p, cfg)
}

// GetResourceCode 查询单个资源码。
func (s *PositionService) GetResourceCode(ctx context.Context, id string) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Get(ctx, id)
}

// CreateResourceCode 创建资源码。
func (s *PositionService) CreateResourceCode(ctx context.Context, p *store.ResourceCodeParams) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Create(ctx, p)
}

// UpdateResourceCode 更新资源码。
func (s *PositionService) UpdateResourceCode(ctx context.Context, id string, p *store.ResourceCodeParams) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Update(ctx, id, p)
}

// DeleteResourceCode 删除资源码。
func (s *PositionService) DeleteResourceCode(ctx context.Context, id string) error {
	return s.st.ResourceCodes().Delete(ctx, id)
}
