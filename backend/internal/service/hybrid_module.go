package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListHybridModules 查询混合模块列表。
func (s *PositionService) ListHybridModules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.HybridNodeModule]) ([]domain.HybridNodeModule, int, error) {
	return s.st.HybridModules().List(ctx, p, cfg)
}

// GetHybridModule 查询单个混合模块。
func (s *PositionService) GetHybridModule(ctx context.Context, id string) (*domain.HybridNodeModule, error) {
	return s.st.HybridModules().Get(ctx, id)
}

// UpsertHybridModule 创建或更新混合模块。
func (s *PositionService) UpsertHybridModule(ctx context.Context, tenantID, id string, p *store.HybridModuleParams) (*domain.HybridNodeModule, error) {
	if id != "" {
		return s.st.HybridModules().Update(ctx, id, p)
	}
	return s.st.HybridModules().Create(ctx, tenantID, p)
}

// DeleteHybridModule 删除混合模块。
func (s *PositionService) DeleteHybridModule(ctx context.Context, id string) error {
	return s.st.HybridModules().Delete(ctx, id)
}
