package service

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 批次表通用操作的 PositionService 公开方法（实现收敛于 sharedBatchOps）。
func (s *PositionService) BatchList(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[any]) ([]any, int, error) {
	return sharedBatchOps{st: s.st}.list(ctx, p, cfg)
}

func (s *PositionService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return sharedBatchOps{st: s.st}.tenantOf(ctx, table, id)
}

func (s *PositionService) BatchCreate(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return sharedBatchOps{st: s.st}.create(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

func (s *PositionService) BatchUpdate(ctx context.Context, table, tenantID string, fields store.BatchUpdateFields, id string) error {
	return sharedBatchOps{st: s.st}.update(ctx, table, tenantID, fields, id)
}

func (s *PositionService) BatchDelete(ctx context.Context, table, id, tenantID string) error {
	return sharedBatchOps{st: s.st}.delete(ctx, table, id, tenantID)
}

func (s *PositionService) BatchUpdateStatus(ctx context.Context, table, id, tenantID, status string) error {
	return sharedBatchOps{st: s.st}.updateStatus(ctx, table, id, tenantID, status)
}

func (s *PositionService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return sharedBatchOps{st: s.st}.getByTable(ctx, table, selectColumns, id)
}

// BatchCourseProgress 课程进度。
func (s *PositionService) BatchCourseProgress(ctx context.Context, courseIDs []string, userID string) map[string]int {
	return s.st.Portal().BatchCourseProgress(ctx, courseIDs, userID)
}

// BatchCourseStudentCounts 课程学生数。
func (s *PositionService) BatchCourseStudentCounts(ctx context.Context, courseIDs []string) map[string]int {
	return s.st.Portal().BatchCourseStudentCounts(ctx, courseIDs)
}

// BatchSceneTaskStatus 任务状态。
func (s *PositionService) BatchSceneTaskStatus(ctx context.Context, taskIDs []string, userID string) map[string]string {
	return s.st.Portal().BatchSceneTaskStatus(ctx, taskIDs, userID)
}
