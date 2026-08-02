package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// HybridModuleStore 混合模块持久化。
type HybridModuleStore struct {
	q Queryer
}

// NewHybridModuleStore 创建混合模块 store。
func NewHybridModuleStore(q Queryer) *HybridModuleStore {
	return &HybridModuleStore{q: q}
}

// List 查询混合模块列表。
func (s *HybridModuleStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.HybridNodeModule]) ([]domain.HybridNodeModule, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanHybridModuleRows)
}

// ListConfig 返回混合模块列表查询配置，SQL 片段沉淀在 store 层。
func (s *HybridModuleStore) ListConfig() ListQueryConfig[domain.HybridNodeModule] {
	return ListQueryConfig[domain.HybridNodeModule]{
		Table:         "hybrid_node_modules",
		SelectColumns: "id, node_id, module_key, mode, data",
		TenantScoped:  true,
		OrderBy:       "module_key ASC",
		NoPagination:  true,
		ScanRows:      ScanHybridModuleRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if nodeID := p.Values["nodeId"]; nodeID != "" {
				qb.AddCondition("node_id = " + qb.NextArg(nodeID))
			}
		},
	}
}

// Get 查询单个混合模块（限定租户）。
func (s *HybridModuleStore) Get(ctx context.Context, id, tenantID string) (*domain.HybridNodeModule, error) {
	var m domain.HybridNodeModule
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, module_key, mode, data FROM hybrid_node_modules WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&m.ID, &m.NodeID, &m.ModuleKey, &m.Mode, &m.Data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Create 创建混合模块。
func (s *HybridModuleStore) Create(ctx context.Context, tenantID string, p *HybridModuleParams) (*domain.HybridNodeModule, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, tenantID, p.NodeID, p.ModuleKey, p.Mode, p.Data).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新混合模块（限定租户）。
func (s *HybridModuleStore) Update(ctx context.Context, id, tenantID string, p *HybridModuleParams) (*domain.HybridNodeModule, error) {
	if _, err := s.Get(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE hybrid_node_modules SET node_id = $1, module_key = $2, mode = $3, data = $4
		WHERE id = $5 AND tenant_id = $6
	`, p.NodeID, p.ModuleKey, p.Mode, p.Data, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除混合模块（限定租户）。
func (s *HybridModuleStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM hybrid_node_modules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// HybridModuleParams 混合模块参数。
type HybridModuleParams struct {
	NodeID    string
	ModuleKey string
	Mode      string
	Data      domain.JSONMap
}

// ScanHybridModuleRows 扫描混合模块行。
func ScanHybridModuleRows(rows pgx.Rows) ([]domain.HybridNodeModule, error) {
	items := make([]domain.HybridNodeModule, 0)
	for rows.Next() {
		var m domain.HybridNodeModule
		if err := rows.Scan(&m.ID, &m.NodeID, &m.ModuleKey, &m.Mode, &m.Data); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, nil
}
