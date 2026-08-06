package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TagService 标签业务编排：薄转发到 store，预留事务扩展点。
type TagService struct {
	*Service
	st *store.Store
}

// NewTagService 创建标签服务。
func NewTagService(s *Service) *TagService {
	return &TagService{Service: s, st: s.Store()}
}

// List 查询租户标签列表（含绑定数量）。
func (s *TagService) List(ctx context.Context, tenantID string) ([]domain.TagItem, error) {
	return s.st.Tags().List(ctx, tenantID)
}

// Create 创建标签。
func (s *TagService) Create(ctx context.Context, tenantID, name, color string) (*domain.TagItem, error) {
	return s.st.Tags().Create(ctx, tenantID, name, color)
}

// Update 更新标签。
func (s *TagService) Update(ctx context.Context, tenantID, id, name, color string) (*domain.TagItem, error) {
	return s.st.Tags().Update(ctx, tenantID, id, name, color)
}

// Delete 删除标签（绑定关系级联清理）。
func (s *TagService) Delete(ctx context.Context, tenantID, id string) error {
	return s.st.Tags().Delete(ctx, tenantID, id)
}

// SetResourceTags 全量替换某资源的标签绑定。
func (s *TagService) SetResourceTags(ctx context.Context, tenantID, resourceType, resourceID string, tagIDs []string) error {
	return s.st.Tags().SetResourceTags(ctx, tenantID, resourceType, resourceID, tagIDs)
}

// QueryBindings 批量查询资源的标签绑定。
func (s *TagService) QueryBindings(ctx context.Context, tenantID, resourceType string, resourceIDs []string) ([]domain.ResourceTagRelation, error) {
	return s.st.Tags().QueryBindings(ctx, tenantID, resourceType, resourceIDs)
}
