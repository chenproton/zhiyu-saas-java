package handler

import (
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 5 类业务批次共用 BatchHandler 模板，差异仅为表/列/状态配置。
// 子类型仅作路由类型标识，所有 config 集中在此文件维护。

type JobBatchHandler struct {
	*BatchHandler
}

func NewJobBatchHandler(svc *service.PositionService) *JobBatchHandler {
	return &JobBatchHandler{
		BatchHandler: NewBatchHandler(svc, BatchTableConfig{
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

type EvaluationBatchHandler struct {
	*BatchHandler
}

func NewEvaluationBatchHandler(svc *service.EvaluationService) *EvaluationBatchHandler {
	return &EvaluationBatchHandler{
		BatchHandler: &BatchHandler{Service: svc, Config: BatchTableConfig{
			TableName:          "evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id",
			WriteTableName:     "evaluation_batches",
			SelectColumns:      "eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
			EntityName:         "evaluation batch",
			StatusOpen:         string(domain.BatchStatusOpen),
			StatusClosed:       string(domain.BatchStatusClosed),
			SearchColumns:      []string{"name"},
			TenantScoped:       true,
			TenantFilterColumn: "eb.tenant_id",
			ScanRow:            store.ScanEvaluationBatchRow,
			ScanRows:           scanEvaluationBatchRows,
		}},
	}
}

func scanEvaluationBatchRows(rows pgx.Rows) ([]any, error) {
	items := make([]any, 0)
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
