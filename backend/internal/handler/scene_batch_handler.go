package handler

import (

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type SceneBatchHandler struct {
	*BatchHandler
}

func NewSceneBatchHandler(svc *service.ScenarioService) *SceneBatchHandler {
	return &SceneBatchHandler{
		BatchHandler: &BatchHandler{Service: svc, Config: BatchTableConfig{
			TableName:          "scene_batches sb LEFT JOIN majors m ON m.id = sb.major_id",
			WriteTableName:     "scene_batches",
			SelectColumns:      "sb.id, sb.name, sb.code, sb.org_node_id, sb.major_id, COALESCE(m.name, '') AS major_name, sb.workflow_id, sb.status, sb.scenario_count, sb.created_at, sb.updated_at",
			EntityName:         "scene batch",
			StatusOpen:         string(domain.SceneBatchStatusOpen),
			StatusClosed:       string(domain.SceneBatchStatusClosed),
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "sb.tenant_id",
			ScanRow:            store.ScanSceneBatchRow,
			ScanRows:           scanSceneBatchRows,
		}},
	}
}

func scanSceneBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
	for rows.Next() {
		var b domain.SceneBatch
		var code, orgNodeID, majorID, majorName, workflowID *string
		if err := rows.Scan(
			&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
			&b.ScenarioCount, &b.CreatedAt, &b.UpdatedAt,
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
