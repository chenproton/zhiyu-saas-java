package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// BatchScanRowFunc 批次单行扫描（经 store 查询后由扫描函数转换）。
type BatchScanRowFunc func(ctx context.Context, row pgx.Row) (any, error)

// BatchScanRowsFunc 批次列表行扫描。
type BatchScanRowsFunc func(rows pgx.Rows) ([]any, error)

// BatchTableConfig 描述 5 类业务批次（岗位/场景/课程/评测/教务）的表/列/状态差异，
// SQL 片段统一沉淀在 store 层；BatchHandler 模板据此构建查询与写入。
type BatchTableConfig struct {
	TableName      string
	WriteTableName string
	SelectColumns  string
	EntityName     string
	StatusOpen     string
	StatusClosed   string

	SearchColumns []string

	ExtraListFilters ListQueryFilter

	CreateExtraCols []string
	CreateExtraVals []any

	TenantScoped       bool
	TenantFilterColumn string

	CreateWithStatus bool
	UpdateWithStatus bool

	ScanRow  BatchScanRowFunc
	ScanRows BatchScanRowsFunc
}

// NewJobBatchTableConfig 岗位批次配置。
func NewJobBatchTableConfig() BatchTableConfig {
	return BatchTableConfig{
		TableName:          "batches b LEFT JOIN majors m ON m.id = b.major_id",
		WriteTableName:     "batches",
		SelectColumns:      "b.id, b.name, b.code, b.org_node_id, b.major_id, COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count, b.published_count, b.pending_count, b.created_at, b.updated_at",
		EntityName:         "batch",
		StatusOpen:         string(domain.BatchStatusOpen),
		StatusClosed:       string(domain.BatchStatusClosed),
		SearchColumns:      []string{"b.name"},
		TenantScoped:       true,
		TenantFilterColumn: "b.tenant_id",
		ScanRow:            ScanJobBatchRow,
		ScanRows:           ScanJobBatchRows,
	}
}

// NewSceneBatchTableConfig 场景批次配置。
func NewSceneBatchTableConfig() BatchTableConfig {
	return BatchTableConfig{
		TableName:          "scene_batches sb LEFT JOIN majors m ON m.id = sb.major_id",
		WriteTableName:     "scene_batches",
		SelectColumns:      "sb.id, sb.name, sb.code, sb.org_node_id, sb.major_id, COALESCE(m.name, '') AS major_name, sb.workflow_id, sb.status, sb.scenario_count, sb.created_at, sb.updated_at",
		EntityName:         "scene batch",
		StatusOpen:         string(domain.SceneBatchStatusOpen),
		StatusClosed:       string(domain.SceneBatchStatusClosed),
		SearchColumns:      []string{"sb.name"},
		TenantScoped:       true,
		TenantFilterColumn: "sb.tenant_id",
		ScanRow:            ScanSceneBatchRow,
		ScanRows:           ScanSceneBatchRows,
	}
}

// NewCourseBatchTableConfig 课程批次配置。
func NewCourseBatchTableConfig() BatchTableConfig {
	return BatchTableConfig{
		TableName:          "lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id",
		WriteTableName:     "lesson_batches",
		SelectColumns:      "lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
		EntityName:         "batch",
		StatusOpen:         string(domain.LessonBatchStatusOpen),
		StatusClosed:       string(domain.LessonBatchStatusClosed),
		SearchColumns:      []string{"lb.name", "lb.code"},
		TenantScoped:       true,
		TenantFilterColumn: "lb.tenant_id",
		ExtraListFilters: func(p ListParams, qb *ListQueryBuilder) {
			if majorID := p.Values["majorId"]; majorID != "" {
				qb.AddCondition("lb.major_id = " + qb.NextArg(majorID))
			}
		},
		CreateExtraCols:  []string{"course_count"},
		CreateExtraVals:  []any{0},
		CreateWithStatus: true,
		UpdateWithStatus: true,
		ScanRow:          ScanLessonBatchRow,
		ScanRows:         ScanLessonBatchRows,
	}
}

// NewEvaluationBatchTableConfig 评测批次配置。
func NewEvaluationBatchTableConfig() BatchTableConfig {
	return BatchTableConfig{
		TableName:          "evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id",
		WriteTableName:     "evaluation_batches",
		SelectColumns:      "eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
		EntityName:         "evaluation batch",
		StatusOpen:         string(domain.BatchStatusOpen),
		StatusClosed:       string(domain.BatchStatusClosed),
		SearchColumns:      []string{"eb.name"},
		TenantScoped:       true,
		TenantFilterColumn: "eb.tenant_id",
		ScanRow:            ScanEvaluationBatchRow,
		ScanRows:           ScanEvaluationBatchRows,
	}
}

// NewAffairsBatchTableConfig 教务批次配置。
func NewAffairsBatchTableConfig() BatchTableConfig {
	return BatchTableConfig{
		TableName:          "affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id",
		WriteTableName:     "affairs_batches",
		SelectColumns:      "ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, '') AS major_name, ab.workflow_id, ab.status, ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at",
		EntityName:         "affairs batch",
		StatusOpen:         string(domain.BatchStatusOpen),
		StatusClosed:       string(domain.BatchStatusClosed),
		SearchColumns:      []string{"ab.name"},
		TenantScoped:       true,
		TenantFilterColumn: "ab.tenant_id",
		ScanRow:            ScanAffairsBatchRow,
		ScanRows:           ScanAffairsBatchRows,
	}
}

// ===== 批次列表行扫描 =====

func ScanJobBatchRows(rows pgx.Rows) ([]any, error) {
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

func ScanSceneBatchRows(rows pgx.Rows) ([]any, error) {
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

func ScanLessonBatchRows(rows pgx.Rows) ([]any, error) {
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

func ScanEvaluationBatchRows(rows pgx.Rows) ([]any, error) {
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

func ScanAffairsBatchRows(rows pgx.Rows) ([]any, error) {
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
