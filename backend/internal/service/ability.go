package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListAbilities 查询能力点列表。
func (s *PositionService) ListAbilities(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return s.st.Abilities().List(ctx, p, cfg)
}

// GetAbility 查询单个能力点。
func (s *PositionService) GetAbility(ctx context.Context, id string) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Get(ctx, id)
}

// CreateAbility 创建能力点。
func (s *PositionService) CreateAbility(ctx context.Context, tenantID string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Create(ctx, tenantID, p)
}

// UpdateAbility 更新能力点。
func (s *PositionService) UpdateAbility(ctx context.Context, id string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Update(ctx, id, p)
}

// DeleteAbility 删除能力点。
func (s *PositionService) DeleteAbility(ctx context.Context, id string) error {
	return s.st.Abilities().Delete(ctx, id)
}

// ListAbilityDomains 查询能力域列表。
func (s *PositionService) ListAbilityDomains(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityDomain]) ([]domain.AbilityDomain, int, error) {
	return s.st.AbilityDomains().List(ctx, p, cfg)
}

// GetAbilityDomain 查询单个能力域。
func (s *PositionService) GetAbilityDomain(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Get(ctx, id)
}

// CreateAbilityDomain 创建能力域。
func (s *PositionService) CreateAbilityDomain(ctx context.Context, tenantID string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Create(ctx, tenantID, p)
}

// UpdateAbilityDomain 更新能力域。
func (s *PositionService) UpdateAbilityDomain(ctx context.Context, id string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Update(ctx, id, p)
}

// DeleteAbilityDomain 删除能力域。
func (s *PositionService) DeleteAbilityDomain(ctx context.Context, id string) error {
	return s.st.AbilityDomains().Delete(ctx, id)
}

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

// ListTerms 查询学期列表。
func (s *PositionService) ListTerms(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Term]) ([]domain.Term, int, error) {
	return s.st.Terms().List(ctx, p, cfg)
}

// GetTerm 查询单个学期。
func (s *PositionService) GetTerm(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	return s.st.Terms().Get(ctx, id, tenantID)
}

// CreateTerm 创建学期（事务）。
func (s *PositionService) CreateTerm(ctx context.Context, tenantID string, p *store.TermParams) (string, error) {
	var id string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		i, err := txStore.Terms().Create(ctx, txStore.Q(), tenantID, p)
		if err != nil {
			return err
		}
		id = i
		return nil
	})
	return id, err
}

// UpdateTerm 更新学期（事务）。
func (s *PositionService) UpdateTerm(ctx context.Context, tenantID, id string, p *store.TermParams) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Terms().Update(ctx, txStore.Q(), tenantID, id, p)
	})
}

// DeleteTerm 删除学期。
func (s *PositionService) DeleteTerm(ctx context.Context, id, tenantID string) error {
	return s.st.Terms().Delete(ctx, id, tenantID)
}
