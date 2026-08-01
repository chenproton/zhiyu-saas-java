package handler

import (
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CourseBatchHandler struct {
	*BatchHandler
}

func NewCourseBatchHandler(svc *service.PositionService) *CourseBatchHandler {
	return &CourseBatchHandler{
		BatchHandler: NewBatchHandler(svc, BatchTableConfig{
			TableName:          "lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id",
			WriteTableName:     "lesson_batches",
			SelectColumns:      "lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
			EntityName:         "batch",
			StatusOpen:         string(domain.LessonBatchStatusOpen),
			StatusClosed:       string(domain.LessonBatchStatusClosed),
			SearchColumns:      []string{"name", "code"},
			TenantScoped:       true,
			TenantFilterColumn: "lb.tenant_id",
			ExtraListFilters: func(p store.ListParams, qb *store.ListQueryBuilder) {
				majorID := p.Values["majorId"]
				if majorID != "" {
					qb.AddCondition("lb.major_id = " + qb.NextArg(majorID))
				}
			},
			CreateExtraCols:  []string{"course_count"},
			CreateExtraVals:  []any{0},
			CreateWithStatus: true,
			UpdateWithStatus: true,
			ScanRow:          store.ScanLessonBatchRow,
			ScanRows:         scanLessonBatchRows,
		}),
	}
}

func scanLessonBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
	for rows.Next() {
		var b domain.LessonBatch
		var majorID, majorName *string
		if err := rows.Scan(
			&b.ID, &b.Name, &b.Code, &b.OrgNodeID, &majorID, &majorName,
			&b.WorkflowID, &b.Status, &b.CourseCount, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		b.MajorID = majorID
		b.MajorName = majorName
		items = append(items, b)
	}
	return items, nil
}
