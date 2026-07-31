package handler

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AffairsBatchHandler struct {
	*BatchHandler
}

func NewAffairsBatchHandler(db *pgxpool.Pool) *AffairsBatchHandler {
	return &AffairsBatchHandler{
		BatchHandler: NewBatchHandler(db, BatchTableConfig{
			TableName:          "affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id",
			WriteTableName:     "affairs_batches",
			SelectColumns:      "ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, '') AS major_name, ab.workflow_id, ab.status, ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at",
			EntityName:         "affairs batch",
			StatusOpen:         "open",
			StatusClosed:       "closed",
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "ab.tenant_id",
			ScanRow:            scanAffairsBatchRow,
			ScanRows:           scanAffairsBatchRows,
		}),
	}
}

func scanAffairsBatchRow(ctx context.Context, db *pgxpool.Pool, id string) (any, error) {
	var b struct {
		ID, Name, Status string
		Code, OrgNodeID, MajorID, MajorName, WorkflowID *string
		ProgramCount, PublishedCount, PendingCount int
		CreatedAt, UpdatedAt string
	}
	err := db.QueryRow(ctx, `
		SELECT ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, ''), ab.workflow_id, ab.status,
			ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at
		FROM affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id WHERE ab.id = $1
	`, id).Scan(&b.ID, &b.Name, &b.Code, &b.OrgNodeID, &b.MajorID, &b.MajorName, &b.WorkflowID, &b.Status,
		&b.ProgramCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt)
	if err != nil { return nil, err }
	return &b, nil
}

func scanAffairsBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
	for rows.Next() {
		var b struct {
			ID, Name, Status string
			Code, OrgNodeID, MajorID, MajorName, WorkflowID *string
			ProgramCount, PublishedCount, PendingCount int
			CreatedAt, UpdatedAt string
		}
		if err := rows.Scan(&b.ID, &b.Name, &b.Code, &b.OrgNodeID, &b.MajorID, &b.MajorName, &b.WorkflowID, &b.Status,
			&b.ProgramCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt); err != nil { return nil, err }
		items = append(items, &b)
	}
	return items, nil
}
