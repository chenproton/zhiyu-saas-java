package handler

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type EvaluationBatchHandler struct {
	*BatchHandler
}

func NewEvaluationBatchHandler(db *pgxpool.Pool) *EvaluationBatchHandler {
	return &EvaluationBatchHandler{
		BatchHandler: NewBatchHandler(db, BatchTableConfig{
			TableName:          "evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id",
			WriteTableName:     "evaluation_batches",
			SelectColumns:      "eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
			EntityName:         "evaluation batch",
			StatusOpen:         "open",
			StatusClosed:       "closed",
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "eb.tenant_id",
			ScanRow:       scanEvaluationBatchRow,
			ScanRows:      scanEvaluationBatchRows,
		}),
	}
}

func scanEvaluationBatchRow(ctx context.Context, db *pgxpool.Pool, id string) (any, error) {
	var b domain.EvaluationBatch
	var code, orgNodeID, majorID, majorName, workflowID *string
	err := db.QueryRow(ctx, `
		SELECT eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name,
			eb.workflow_id, eb.status, eb.created_at, eb.updated_at
		FROM evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id WHERE eb.id = $1
	`, id).Scan(
		&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID,
		&b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.Code = code
	b.OrgNodeID = orgNodeID
	b.MajorID = majorID
	b.MajorName = majorName
	b.WorkflowID = workflowID
	return b, nil
}

func scanEvaluationBatchRows(rows pgx.Rows) (any, error) {
	items := make([]domain.EvaluationBatch, 0)
	for rows.Next() {
		var b domain.EvaluationBatch
		var code, orgNodeID, majorID, majorName, workflowID *string
		if err := rows.Scan(
			&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID,
			&b.Status, &b.CreatedAt, &b.UpdatedAt,
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
