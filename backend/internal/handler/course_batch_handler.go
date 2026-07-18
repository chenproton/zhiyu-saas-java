package handler

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type CourseBatchHandler struct {
	*BatchHandler
}

func NewCourseBatchHandler(db *pgxpool.Pool) *CourseBatchHandler {
	return &CourseBatchHandler{
		BatchHandler: NewBatchHandler(db, BatchTableConfig{
			TableName:          "lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id",
			WriteTableName:     "lesson_batches",
			SelectColumns:      "lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
			EntityName:         "batch",
			StatusOpen:         string(domain.LessonBatchStatusOpen),
			StatusClosed:       string(domain.LessonBatchStatusClosed),
			SearchColumns:      []string{"name", "code"},
			TenantScoped:       true,
			TenantFilterColumn: "lb.tenant_id",
			ExtraListFilters: func(r *http.Request, argIdx int) (clauses []string, args []any) {
				majorID := r.URL.Query().Get("majorId")
				if majorID == "" {
					return nil, nil
				}
				return []string{"lb.major_id = $" + itoa(argIdx)}, []any{majorID}
			},
			CreateExtraCols:  []string{"course_count"},
			CreateExtraVals:  []any{0},
			CreateWithStatus: true,
			UpdateWithStatus: true,
			ScanRow:          scanLessonBatchRow,
			ScanRows:         scanLessonBatchRows,
		}),
	}
}

func scanLessonBatchRow(ctx context.Context, db *pgxpool.Pool, id string) (any, error) {
	var b domain.LessonBatch
	var majorID, majorName *string
	err := db.QueryRow(ctx, `
		SELECT lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name,
			lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at
		FROM lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id WHERE lb.id = $1
	`, id).Scan(
		&b.ID, &b.Name, &b.Code, &b.OrgNodeID, &majorID, &majorName,
		&b.WorkflowID, &b.Status, &b.CourseCount, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.MajorID = majorID
	b.MajorName = majorName
	return &b, nil
}

func scanLessonBatchRows(rows pgx.Rows) (any, error) {
	items := make([]domain.LessonBatch, 0)
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
