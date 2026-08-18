package service

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 批次表通用操作的 EvaluationService 公开方法（实现收敛于 sharedBatchOps）。
func (s *EvaluationService) BatchList(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[any]) ([]any, int, error) {
	return sharedBatchOps{st: s.st}.list(ctx, p, cfg)
}

func (s *EvaluationService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return sharedBatchOps{st: s.st}.tenantOf(ctx, table, id)
}

func (s *EvaluationService) BatchCreate(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return sharedBatchOps{st: s.st}.create(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

func (s *EvaluationService) BatchUpdate(ctx context.Context, table, tenantID string, fields store.BatchUpdateFields, id string) error {
	return sharedBatchOps{st: s.st}.update(ctx, table, tenantID, fields, id)
}

func (s *EvaluationService) BatchDelete(ctx context.Context, table, id, tenantID string) error {
	return sharedBatchOps{st: s.st}.delete(ctx, table, id, tenantID)
}

func (s *EvaluationService) BatchUpdateStatus(ctx context.Context, table, id, tenantID, status string) error {
	return sharedBatchOps{st: s.st}.updateStatus(ctx, table, id, tenantID, status)
}

func (s *EvaluationService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return sharedBatchOps{st: s.st}.getByTable(ctx, table, selectColumns, id)
}
