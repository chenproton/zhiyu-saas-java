package service

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/store"
)

// BatchList 分页查询批次（通用批次处理器使用）。
func (s *PositionService) BatchList(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[any]) ([]any, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, cfg)
}

// BatchTenantOf 查询批次租户。
func (s *PositionService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return s.st.Batches().TenantOf(ctx, table, id)
}

// BatchCreate 创建批次。
func (s *PositionService) BatchCreate(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return s.st.Batches().CreateFields(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

// BatchUpdate 更新批次。
func (s *PositionService) BatchUpdate(ctx context.Context, table string, fields store.BatchUpdateFields, id string) error {
	return s.st.Batches().UpdateFields(ctx, table, fields, id)
}

// BatchDelete 删除批次。
func (s *PositionService) BatchDelete(ctx context.Context, table, id string) error {
	return s.st.Batches().Delete(ctx, table, id)
}

// BatchUpdateStatus 更新批次状态。
func (s *PositionService) BatchUpdateStatus(ctx context.Context, table, id, status string) error {
	return s.st.Batches().UpdateStatus(ctx, table, id, status)
}

// BatchGetByTable 按表查询批次单行。
func (s *PositionService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return s.st.Batches().GetByTable(ctx, s.st.Q(), table, selectColumns, id)
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
