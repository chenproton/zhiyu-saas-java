package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// WorkflowStore 审批流程持久化。
type WorkflowStore struct {
	q Queryer
}

// NewWorkflowStore 创建审批流程 store。
func NewWorkflowStore(q Queryer) *WorkflowStore {
	return &WorkflowStore{q: q}
}

// List 查询审批流程列表。
func (s *WorkflowStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Workflow]) ([]domain.Workflow, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanWorkflowRows)
}

// Get 查询单个审批流程。
func (s *WorkflowStore) Get(ctx context.Context, id string) (*domain.Workflow, error) {
	var w domain.Workflow
	var tenantID, description, scene *string
	var majorIds domain.StringSlice
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at
		FROM workflows WHERE id = $1
	`, id).Scan(&w.ID, &tenantID, &w.Name, &scene, &description, &w.Steps, &majorIds, &w.UsageCount, &w.Status, &w.CreatedAt)
	if err != nil {
		return nil, err
	}
	w.TenantID = tenantID
	w.Scene = scene
	w.Description = description
	w.MajorIds = majorIds
	return &w, nil
}

// Create 创建审批流程。
func (s *WorkflowStore) Create(ctx context.Context, tenantID *string, p *WorkflowParams) (*domain.Workflow, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO workflows (id, tenant_id, name, scene, description, steps, major_ids, usage_count, status)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, $7)
		RETURNING id
	`, tenantID, p.Name, p.Scene, p.Description, p.Steps, p.MajorIds, p.Status).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新审批流程。
func (s *WorkflowStore) Update(ctx context.Context, id string, p *WorkflowParams) (*domain.Workflow, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE workflows SET
			name = $1, scene = $2, description = $3, steps = $4, major_ids = $5, status = $6
		WHERE id = $7
	`, p.Name, p.Scene, p.Description, p.Steps, p.MajorIds, p.Status, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除审批流程。
func (s *WorkflowStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM workflows WHERE id = $1`, id)
	return err
}

// WorkflowParams 审批流程参数。
type WorkflowParams struct {
	Name        string
	Scene       *string
	Description *string
	Steps       domain.JSONSlice
	MajorIds    domain.StringSlice
	Status      domain.WorkflowStatus
}

// ListConfig 返回审批流程列表查询配置，SQL 片段沉淀在 store 层。
func (s *WorkflowStore) ListConfig() ListQueryConfig[domain.Workflow] {
	return ListQueryConfig[domain.Workflow]{
		Table:         "workflows",
		SelectColumns: "id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ScanRows:      ScanWorkflowRows,
	}
}

// ScanWorkflowRows 扫描审批流程行。
func ScanWorkflowRows(rows pgx.Rows) ([]domain.Workflow, error) {
	items := make([]domain.Workflow, 0)
	for rows.Next() {
		var w domain.Workflow
		var tenantID, description, scene *string
		var majorIds domain.StringSlice
		if err := rows.Scan(&w.ID, &tenantID, &w.Name, &scene, &description, &w.Steps, &majorIds, &w.UsageCount, &w.Status, &w.CreatedAt); err != nil {
			return nil, err
		}
		w.TenantID = tenantID
		w.Scene = scene
		w.Description = description
		w.MajorIds = majorIds
		items = append(items, w)
	}
	return items, nil
}
