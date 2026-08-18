package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ResourceCodeStore 资源码持久化。
type ResourceCodeStore struct {
	q Queryer
}

// NewResourceCodeStore 创建资源码 store。
func NewResourceCodeStore(q Queryer) *ResourceCodeStore {
	return &ResourceCodeStore{q: q}
}

// List 查询资源码列表。
func (s *ResourceCodeStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ResourceCode]) ([]domain.ResourceCode, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanResourceCodeRows)
}

// Get 查询单个资源码。
func (s *ResourceCodeStore) Get(ctx context.Context, id string) (*domain.ResourceCode, error) {
	rc, err := s.fetchResourceCode(ctx, id)
	if err != nil {
		return nil, err
	}
	return rc, nil
}

// Create 创建资源码。
func (s *ResourceCodeStore) Create(ctx context.Context, p *ResourceCodeParams) (*domain.ResourceCode, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO resource_codes (id, tenant_id, code, name, description, type)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, p.TenantID, p.Code, p.Name, p.Description, p.Type).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新资源码。
func (s *ResourceCodeStore) Update(ctx context.Context, id string, p *ResourceCodeParams) (*domain.ResourceCode, error) {
	if _, err := s.fetchResourceCode(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE resource_codes SET name = $1, description = $2, type = $3
		WHERE id = $4
	`, p.Name, p.Description, p.Type, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除资源码。
func (s *ResourceCodeStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM resource_codes WHERE id = $1`, id)
	return err
}

// ResourceCodeParams 资源码参数。
type ResourceCodeParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Type        string
}

func (s *ResourceCodeStore) fetchResourceCode(ctx context.Context, id string) (*domain.ResourceCode, error) {
	var rc domain.ResourceCode
	var description *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes WHERE id = $1
	`, id).Scan(&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rc.Description = description
	return &rc, nil
}

// ListConfig 返回资源码列表查询配置，SQL 片段沉淀在 store 层。
func (s *ResourceCodeStore) ListConfig() ListQueryConfig[domain.ResourceCode] {
	return ListQueryConfig[domain.ResourceCode]{
		Table:         "resource_codes",
		SelectColumns: "id, tenant_id, code, name, description, type, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ScanRows:      ScanResourceCodeRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if resType := p.Values["type"]; resType != "" {
				qb.AddCondition("type = " + qb.NextArg(resType))
			}
		},
	}
}

// ScanResourceCodeRows 扫描资源码行。
func ScanResourceCodeRows(rows pgx.Rows) ([]domain.ResourceCode, error) {
	items := make([]domain.ResourceCode, 0)
	for rows.Next() {
		var rc domain.ResourceCode
		var description *string
		if err := rows.Scan(&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt); err != nil {
			return nil, err
		}
		rc.Description = description
		items = append(items, rc)
	}
	return items, rows.Err()
}
