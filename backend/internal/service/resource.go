package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ResourceService 资源库业务编排：组合 Service 获得 WithTx/Store 能力，
// 无跨 store 组合时直通 store，预留事务扩展点。
type ResourceService struct {
	*Service
	st *store.Store
}

// NewResourceService 创建资源服务。
func NewResourceService(s *Service) *ResourceService {
	return &ResourceService{Service: s, st: s.Store()}
}

// List 查询资源列表。
func (s *ResourceService) List(ctx context.Context, tenantID string, f store.ResourceFilter) ([]domain.ResourceLibraryItem, int, error) {
	return s.st.ResourceLibrary().List(ctx, tenantID, f)
}

// CountByType 按类型统计资源数量（列表总览统计卡片用）。
func (s *ResourceService) CountByType(ctx context.Context, tenantID, search string) ([]store.ResourceTypeCount, error) {
	return s.st.ResourceLibrary().CountByType(ctx, tenantID, search)
}

// Get 查询单个资源。
func (s *ResourceService) Get(ctx context.Context, id string) (*domain.ResourceLibraryItem, error) {
	return s.st.ResourceLibrary().Get(ctx, id)
}

// Create 创建资源。
func (s *ResourceService) Create(ctx context.Context, tenantID string, p *store.ResourceCreateParams) (*domain.ResourceLibraryItem, error) {
	return s.st.ResourceLibrary().Create(ctx, tenantID, p)
}

// Update 更新资源。
func (s *ResourceService) Update(ctx context.Context, id string, p *store.ResourceUpdateParams) (*domain.ResourceLibraryItem, error) {
	return s.st.ResourceLibrary().Update(ctx, id, p)
}

// Delete 删除资源。
func (s *ResourceService) Delete(ctx context.Context, id string) error {
	return s.st.ResourceLibrary().Delete(ctx, id)
}
