package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionConfigService 岗位能力绑定/职责业务编排。
type PositionConfigService struct {
	*Service
	st *store.Store
}

// NewPositionConfigService 创建岗位配置服务。
func NewPositionConfigService(s *Service) *PositionConfigService {
	return &PositionConfigService{Service: s, st: s.Store()}
}

// ListAbilityBindings 查询能力绑定列表。
func (s *PositionConfigService) ListAbilityBindings(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.PositionAbilityBinding]) ([]domain.PositionAbilityBinding, int, error) {
	return s.st.PositionAbilities().List(ctx, p, cfg)
}

// GetAbilityBinding 查询单个绑定。
func (s *PositionConfigService) GetAbilityBinding(ctx context.Context, id string) (*domain.PositionAbilityBinding, error) {
	return s.st.PositionAbilities().Get(ctx, id)
}

// CreateAbilityBinding 创建绑定。
func (s *PositionConfigService) CreateAbilityBinding(ctx context.Context, tenantID string, p *store.PositionAbilityParams) (*domain.PositionAbilityBinding, error) {
	return s.st.PositionAbilities().Create(ctx, tenantID, p)
}

// UpdateAbilityBinding 更新绑定。
func (s *PositionConfigService) UpdateAbilityBinding(ctx context.Context, id string, p *store.PositionAbilityParams) (*domain.PositionAbilityBinding, error) {
	return s.st.PositionAbilities().Update(ctx, id, p)
}

// DeleteAbilityBinding 删除绑定。
func (s *PositionConfigService) DeleteAbilityBinding(ctx context.Context, id string) error {
	return s.st.PositionAbilities().Delete(ctx, id)
}

// ListResponsibilities 查询职责列表。
func (s *PositionConfigService) ListResponsibilities(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.PositionResponsibility]) ([]domain.PositionResponsibility, int, error) {
	return s.st.PositionResponsibilities().List(ctx, p, cfg)
}

// GetResponsibility 查询单个职责。
func (s *PositionConfigService) GetResponsibility(ctx context.Context, id string) (*domain.PositionResponsibility, error) {
	return s.st.PositionResponsibilities().Get(ctx, id)
}

// CreateResponsibility 创建职责。
func (s *PositionConfigService) CreateResponsibility(ctx context.Context, p *store.PositionResponsibilityParams) (*domain.PositionResponsibility, error) {
	return s.st.PositionResponsibilities().Create(ctx, p)
}

// UpdateResponsibility 更新职责。
func (s *PositionConfigService) UpdateResponsibility(ctx context.Context, id string, p *store.PositionResponsibilityParams) (*domain.PositionResponsibility, error) {
	return s.st.PositionResponsibilities().Update(ctx, id, p)
}

// DeleteResponsibility 删除职责。
func (s *PositionConfigService) DeleteResponsibility(ctx context.Context, id string) error {
	return s.st.PositionResponsibilities().Delete(ctx, id)
}
