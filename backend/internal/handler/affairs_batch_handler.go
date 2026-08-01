package handler

import (
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AffairsBatchHandler struct {
	*BatchHandler
}

func NewAffairsBatchHandler(svc *service.PositionService) *AffairsBatchHandler {
	return &AffairsBatchHandler{
		BatchHandler: NewBatchHandler(svc, BatchTableConfig{
			TableName:          "affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id",
			WriteTableName:     "affairs_batches",
			SelectColumns:      "ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, '') AS major_name, ab.workflow_id, ab.status, ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at",
			EntityName:         "affairs batch",
			StatusOpen:         string(domain.BatchStatusOpen),
			StatusClosed:       string(domain.BatchStatusClosed),
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "ab.tenant_id",
			ScanRow:            store.ScanAffairsBatchRow,
			ScanRows:           scanAffairsBatchRows,
		}),
	}
}

func scanAffairsBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
	for rows.Next() {
		var b domain.AffairsBatch
		var code, orgNodeID, majorID, majorName, workflowID *string
		if err := rows.Scan(
			&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
			&b.ProgramCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt,
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
