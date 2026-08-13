package service

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/store"
)

// sharedBatchOps 批次表通用操作实现（PositionService 与 EvaluationService 共用，
// 消除两处 7 个方法完全重复）。各服务保留同名公开方法做薄委托，接口不变。
type sharedBatchOps struct {
	st *store.Store
}

func (b sharedBatchOps) list(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[any]) ([]any, int, error) {
	return store.ExecuteListQuery(ctx, b.st.Q(), p, cfg)
}

func (b sharedBatchOps) tenantOf(ctx context.Context, table, id string) (string, error) {
	return b.st.Batches().TenantOf(ctx, table, id)
}

func (b sharedBatchOps) create(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return b.st.Batches().CreateFields(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

func (b sharedBatchOps) update(ctx context.Context, table, tenantID string, fields store.BatchUpdateFields, id string) error {
	return b.st.Batches().UpdateFields(ctx, table, tenantID, fields, id)
}

func (b sharedBatchOps) delete(ctx context.Context, table, id, tenantID string) error {
	return b.st.Batches().Delete(ctx, table, id, tenantID)
}

func (b sharedBatchOps) updateStatus(ctx context.Context, table, id, tenantID, status string) error {
	return b.st.Batches().UpdateStatus(ctx, table, id, tenantID, status)
}

func (b sharedBatchOps) getByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return b.st.Batches().GetByTable(ctx, b.st.Q(), table, selectColumns, id)
}
