package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// UserExtensionFieldService 用户扩展字段业务编排。
type UserExtensionFieldService struct {
	*Service
	st *store.Store
}

// NewUserExtensionFieldService 创建扩展字段服务。
func NewUserExtensionFieldService(s *Service) *UserExtensionFieldService {
	return &UserExtensionFieldService{Service: s, st: s.Store()}
}

// List 查询租户扩展字段（自动补齐默认槽位）。
func (s *UserExtensionFieldService) List(ctx context.Context, tenantID string) ([]domain.UserExtensionField, error) {
	if err := s.st.UserExtensionFields().EnsureDefaultSlots(ctx, tenantID); err != nil {
		return nil, err
	}
	return s.st.UserExtensionFields().List(ctx, tenantID)
}

// Get 查询单个扩展字段。
func (s *UserExtensionFieldService) Get(ctx context.Context, id string) (*domain.UserExtensionField, error) {
	return s.st.UserExtensionFields().Get(ctx, id)
}

// Update 更新扩展字段（角色编码先过滤为租户内真实存在的）。
func (s *UserExtensionFieldService) Update(ctx context.Context, tenantID, id string, p *store.UserExtensionFieldUpdateParams) (*domain.UserExtensionField, error) {
	p.ApplicableRoleCodes = s.st.UserExtensionFields().FilterTenantRoleCodes(ctx, tenantID, p.ApplicableRoleCodes)
	return s.st.UserExtensionFields().Update(ctx, id, p)
}
