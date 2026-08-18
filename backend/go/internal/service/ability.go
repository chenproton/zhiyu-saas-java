package service

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListAbilities 查询能力点列表。
func (s *PositionService) ListAbilities(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return s.st.Abilities().List(ctx, p, cfg)
}

// AbilityCitationStats 能力点引用次数分布（顶部指标卡片用）。
func (s *PositionService) AbilityCitationStats(ctx context.Context, tenantID string) (store.CitationStats, error) {
	return s.st.Abilities().CitationStats(ctx, tenantID)
}

// ListUncitedAbilities 零引用能力点列表（弹窗：创建时段筛选 + 分页）。
func (s *PositionService) ListUncitedAbilities(ctx context.Context, tenantID string, from, to *time.Time, limit, offset int) ([]store.UncitedItem, int, error) {
	return s.st.Abilities().ListUncited(ctx, tenantID, from, to, limit, offset)
}

// GetAbility 查询单个能力点。
func (s *PositionService) GetAbility(ctx context.Context, id, tenantID string) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Get(ctx, id, tenantID)
}

// CreateAbility 创建能力点。
func (s *PositionService) CreateAbility(ctx context.Context, tenantID string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Create(ctx, tenantID, p)
}

// UpdateAbility 更新能力点。
func (s *PositionService) UpdateAbility(ctx context.Context, id, tenantID string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Update(ctx, id, tenantID, p)
}

// DeleteAbility 删除能力点。
func (s *PositionService) DeleteAbility(ctx context.Context, id, tenantID string) error {
	return s.st.Abilities().Delete(ctx, id, tenantID)
}

// ListAbilityDomains 查询能力域列表。
func (s *PositionService) ListAbilityDomains(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityDomain]) ([]domain.AbilityDomain, int, error) {
	return s.st.AbilityDomains().List(ctx, p, cfg)
}

// GetAbilityDomain 查询单个能力域。
func (s *PositionService) GetAbilityDomain(ctx context.Context, id, tenantID string) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Get(ctx, id, tenantID)
}

// CreateAbilityDomain 创建能力域。
func (s *PositionService) CreateAbilityDomain(ctx context.Context, tenantID string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Create(ctx, tenantID, p)
}

// UpdateAbilityDomain 更新能力域。
func (s *PositionService) UpdateAbilityDomain(ctx context.Context, id, tenantID string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Update(ctx, id, tenantID, p)
}

// DeleteAbilityDomain 删除能力域。
func (s *PositionService) DeleteAbilityDomain(ctx context.Context, id, tenantID string) error {
	return s.st.AbilityDomains().Delete(ctx, id, tenantID)
}
