package handler

import (

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/store"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type JobBatchHandler struct {
	*BatchHandler
}

func NewJobBatchHandler(db *pgxpool.Pool) *JobBatchHandler {
	return &JobBatchHandler{
		BatchHandler: NewBatchHandler(db, BatchTableConfig{
			TableName:          "batches b LEFT JOIN majors m ON m.id = b.major_id",
			WriteTableName:     "batches",
			SelectColumns:      "b.id, b.name, b.code, b.org_node_id, b.major_id, COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count, b.published_count, b.pending_count, b.created_at, b.updated_at",
			EntityName:         "batch",
			StatusOpen:         string(domain.BatchStatusOpen),
			StatusClosed:       string(domain.BatchStatusClosed),
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "b.tenant_id",
			ScanRow:            store.ScanJobBatchRow,
			ScanRows:           scanJobBatchRows,
		}),
	}
}

func scanJobBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
	for rows.Next() {
		var b domain.JobBatch
		var code, orgNodeID, majorID, majorName, workflowID *string
		if err := rows.Scan(
			&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
			&b.PositionCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		b.Code = code
		b.OrgNodeID = orgNodeID
		b.MajorID = majorID
		b.MajorName = majorName
		b.WorkflowID = workflowID
		items = append(items, b)
	}
	return items, nil
}
