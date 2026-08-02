package store

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// BatchStore 批次通用持久化（5 类批次表共享）。
type BatchStore struct {
	q Queryer
}

// NewBatchStore 创建批次 store。
func NewBatchStore(q Queryer) *BatchStore {
	return &BatchStore{q: q}
}

// allowedBatchSelectColumns 批次 SelectColumns 白名单。
var allowedBatchSelectColumns = []string{
	"b.id, b.name, b.code, b.org_node_id, b.major_id, COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count, b.published_count, b.pending_count, b.created_at, b.updated_at",
	"sb.id, sb.name, sb.code, sb.org_node_id, sb.major_id, COALESCE(m.name, '') AS major_name, sb.workflow_id, sb.status, sb.scenario_count, sb.created_at, sb.updated_at",
	"lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
	"eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
	"ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, '') AS major_name, ab.workflow_id, ab.status, ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at",
}

// allowedBatchTables 批次表+Join 白名单。
var allowedBatchTables = []string{
	"batches b LEFT JOIN majors m ON m.id = b.major_id",
	"scene_batches sb LEFT JOIN majors m ON m.id = sb.major_id",
	"lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id",
	"evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id",
	"affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id",
}

// GetByTable 按表与 ID 查询单行（Scan 由调用方以 pgx.Row 完成）。
func (s *BatchStore) GetByTable(ctx context.Context, q Queryer, table, selectColumns, id string) (pgx.Row, error) {
	if _, err := SanitizeIdentifier(table, allowedBatchTables); err != nil {
		return nil, err
	}
	if _, err := SanitizeIdentifier(selectColumns, allowedBatchSelectColumns); err != nil {
		return nil, err
	}
	fields := strings.Fields(table)
	alias := fields[0]
	if len(fields) > 1 {
		alias = fields[1]
	}
	return q.QueryRow(ctx, "SELECT "+selectColumns+" FROM "+table+" WHERE "+alias+".id = $1", id), nil
}

// ScanJobBatchRow 扫描岗位批次行。
func ScanJobBatchRow(ctx context.Context, row pgx.Row) (any, error) {
	var b domain.JobBatch
	var code, orgNodeID, majorID, majorName, workflowID *string
	err := row.Scan(&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
		&b.PositionCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt)
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

// ScanSceneBatchRow 扫描场景批次行。
func ScanSceneBatchRow(ctx context.Context, row pgx.Row) (any, error) {
	var b domain.SceneBatch
	var code, orgNodeID, majorID, majorName, workflowID *string
	err := row.Scan(&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
		&b.ScenarioCount, &b.CreatedAt, &b.UpdatedAt)
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

// ScanLessonBatchRow 扫描课程批次行。
func ScanLessonBatchRow(ctx context.Context, row pgx.Row) (any, error) {
	var b domain.LessonBatch
	var majorID, majorName *string
	err := row.Scan(&b.ID, &b.Name, &b.Code, &b.OrgNodeID, &majorID, &majorName,
		&b.WorkflowID, &b.Status, &b.CourseCount, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	b.MajorID = majorID
	b.MajorName = majorName
	return b, nil
}

// ScanEvaluationBatchRow 扫描评测批次行。
func ScanEvaluationBatchRow(ctx context.Context, row pgx.Row) (any, error) {
	var b domain.EvaluationBatch
	var code, orgNodeID, majorID, majorName, workflowID *string
	err := row.Scan(&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID,
		&b.Status, &b.CreatedAt, &b.UpdatedAt)
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

// ScanAffairsBatchRow 扫描教务批次行。
func ScanAffairsBatchRow(ctx context.Context, row pgx.Row) (any, error) {
	var b domain.AffairsBatch
	var code, orgNodeID, majorID, majorName, workflowID *string
	err := row.Scan(&b.ID, &b.Name, &code, &orgNodeID, &majorID, &majorName, &workflowID, &b.Status,
		&b.ProgramCount, &b.PublishedCount, &b.PendingCount, &b.CreatedAt, &b.UpdatedAt)
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

// allowedBatchWriteTables 批次写表白名单。
var allowedBatchWriteTables = []string{
	"batches",
	"scene_batches",
	"lesson_batches",
	"evaluation_batches",
	"affairs_batches",
}

// TenantOf 查询批次租户。
func (s *BatchStore) TenantOf(ctx context.Context, table, id string) (string, error) {
	if _, err := SanitizeIdentifier(table, allowedBatchWriteTables); err != nil {
		return "", err
	}
	var tenantID string
	err := s.q.QueryRow(ctx, "SELECT tenant_id FROM "+table+" WHERE id = $1", id).Scan(&tenantID)
	return tenantID, err
}

// BatchCreateFields 创建批次字段（handler 只传数据，列名由 store 白名单拼接）。
type BatchCreateFields struct {
	Name       string
	Code       *string
	OrgNodeID  *string
	MajorID    *string
	WorkflowID *string
	Status     string
}

// BatchUpdateFields 更新批次字段。
type BatchUpdateFields struct {
	Name       string
	Code       *string
	OrgNodeID  *string
	MajorID    *string
	WorkflowID *string
	Status     *string
}

// CreateFields 创建批次（列名由 store 内置白名单拼接）。
func (s *BatchStore) CreateFields(ctx context.Context, table string, fields BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	if _, err := SanitizeIdentifier(table, allowedBatchWriteTables); err != nil {
		return err
	}
	cols := []string{"id", "name", "code", "org_node_id", "major_id", "workflow_id", "status"}
	vals := []any{id, fields.Name, fields.Code, fields.OrgNodeID, fields.MajorID, fields.WorkflowID, fields.Status}
	if tenantScoped {
		cols = append(cols, "tenant_id")
		vals = append(vals, tenantID)
	}
	for _, col := range extraCols {
		if _, err := SanitizeIdentifier(col, allowedBatchWriteCols); err != nil {
			return err
		}
	}
	cols = append(cols, extraCols...)
	vals = append(vals, extraVals...)
	placeholders := make([]string, len(cols))
	for i := range cols {
		placeholders[i] = "$" + itoa(i+1)
	}
	query := "INSERT INTO " + table + " (" + strings.Join(cols, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"
	_, err := s.q.Exec(ctx, query, vals...)
	return err
}

// UpdateFields 更新批次（列名由 store 内置白名单拼接）。
func (s *BatchStore) UpdateFields(ctx context.Context, table string, fields BatchUpdateFields, id string) error {
	if _, err := SanitizeIdentifier(table, allowedBatchWriteTables); err != nil {
		return err
	}
	setClauses := []string{"name = $1", "code = $2", "org_node_id = $3", "major_id = $4", "workflow_id = $5", "updated_at = NOW()"}
	args := []any{fields.Name, fields.Code, fields.OrgNodeID, fields.MajorID, fields.WorkflowID}
	argIdx := 6
	if fields.Status != nil {
		setClauses = append(setClauses, "status = $"+itoa(argIdx))
		args = append(args, *fields.Status)
		argIdx++
	}
	args = append(args, id)
	query := "UPDATE " + table + " SET " + strings.Join(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
	_, err := s.q.Exec(ctx, query, args...)
	return err
}

// Delete 删除批次。
func (s *BatchStore) Delete(ctx context.Context, table, id string) error {
	if _, err := SanitizeIdentifier(table, allowedBatchWriteTables); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, "DELETE FROM "+table+" WHERE id = $1", id)
	return err
}

// UpdateStatus 更新批次状态。
func (s *BatchStore) UpdateStatus(ctx context.Context, table, id, status string) error {
	if _, err := SanitizeIdentifier(table, allowedBatchWriteTables); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, "UPDATE "+table+" SET status = $1, updated_at = NOW() WHERE id = $2", status, id)
	return err
}

// allowedBatchWriteCols 批次写列白名单。
var allowedBatchWriteCols = []string{
	"id", "name", "code", "org_node_id", "major_id", "workflow_id", "status", "tenant_id",
	"course_count", "created_at", "updated_at",
}
