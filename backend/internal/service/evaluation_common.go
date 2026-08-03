package service

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/store"
)

// BatchList 分页查询批次（通用批次处理器使用）。
func (s *EvaluationService) BatchList(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[any]) ([]any, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, cfg)
}

// BatchTenantOf 查询批次租户。
func (s *EvaluationService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return s.st.Batches().TenantOf(ctx, table, id)
}

// BatchCreate 创建批次。
func (s *EvaluationService) BatchCreate(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return s.st.Batches().CreateFields(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

// BatchUpdate 更新批次。
func (s *EvaluationService) BatchUpdate(ctx context.Context, table string, fields store.BatchUpdateFields, id string) error {
	return s.st.Batches().UpdateFields(ctx, table, fields, id)
}

// BatchDelete 删除批次。
func (s *EvaluationService) BatchDelete(ctx context.Context, table, id string) error {
	return s.st.Batches().Delete(ctx, table, id)
}

// BatchUpdateStatus 更新批次状态。
func (s *EvaluationService) BatchUpdateStatus(ctx context.Context, table, id, status string) error {
	return s.st.Batches().UpdateStatus(ctx, table, id, status)
}

// BatchGetByTable 按表查询批次单行。
func (s *EvaluationService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return s.st.Batches().GetByTable(ctx, s.st.Q(), table, selectColumns, id)
}
