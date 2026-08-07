package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListHybridModules 查询混合模块列表。
func (s *LessonContentService) ListHybridModules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.HybridNodeModule]) ([]domain.HybridNodeModule, int, error) {
	return s.st.HybridModules().List(ctx, p, cfg)
}

// GetHybridModule 查询单个混合模块（限定租户）。
func (s *LessonContentService) GetHybridModule(ctx context.Context, id, tenantID string) (*domain.HybridNodeModule, error) {
	return s.st.HybridModules().Get(ctx, id, tenantID)
}

// UpsertHybridModule 创建或更新混合模块。
func (s *LessonContentService) UpsertHybridModule(ctx context.Context, tenantID, id string, p *store.HybridModuleParams) (*domain.HybridNodeModule, error) {
	if id != "" {
		return s.st.HybridModules().Update(ctx, id, tenantID, p)
	}
	return s.st.HybridModules().Create(ctx, tenantID, p)
}

// DeleteHybridModule 删除混合模块（限定租户）。
func (s *LessonContentService) DeleteHybridModule(ctx context.Context, id, tenantID string) error {
	return s.st.HybridModules().Delete(ctx, id, tenantID)
}

// ReplaceHybridModules 全量替换某节点的混合模块（事务内 DELETE + INSERT）。
func (s *LessonContentService) ReplaceHybridModules(ctx context.Context, tenantID, nodeID string, modules []store.HybridModuleParams) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.HybridModules().ReplaceByNode(ctx, txStore.Q(), tenantID, nodeID, modules)
	})
}
