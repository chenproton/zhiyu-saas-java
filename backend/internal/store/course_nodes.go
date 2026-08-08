package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CourseNodeBase 课程节点基础行。
type CourseNodeBase struct {
	ID                  string
	CourseID            string
	ParentID            *string
	Name                string
	Code                *string
	SortOrder           int
	RefType             string
	SourceID            *string
	SourceName          *string
	TeachingGoals       *string
	DetailedDescription *string
	DescriptionPdf      *string
	Background          *string
	EstimatedHours      *float64
	Duration            *float64
	Difficulty          *int
	KnowledgePointIds   []string
	ResourceIds         []string
	EvalData            domain.JSONMap
	Status              string
}

// NodeKnowledgePoint 节点知识点（enrich 用）。
type NodeKnowledgePoint struct {
	ID          string
	Name        string
	Code        *string
	Description *string
	Linked      bool
}

// NodeResource 节点资源（enrich 用）。
type NodeResource struct {
	ID   string
	Name string
	Type string
	URL  string
	Size int
}

// CourseNodeStore 体系课节点持久化。
type CourseNodeStore struct {
	q Queryer
}

// NewCourseNodeStore 创建课程节点 store。
func NewCourseNodeStore(q Queryer) *CourseNodeStore {
	return &CourseNodeStore{q: q}
}

// List 查询节点基础行。
func (s *CourseNodeStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[CourseNodeBase]) ([]CourseNodeBase, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanCourseNodeBaseRows)
}

// ListConfig 返回课程节点列表查询配置，SQL 片段沉淀在 store 层。
func (s *CourseNodeStore) ListConfig() ListQueryConfig[CourseNodeBase] {
	return ListQueryConfig[CourseNodeBase]{
		Table:         "system_course_nodes n",
		SelectColumns: "n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name, n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours, n.duration, n.difficulty, n.knowledge_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status",
		TenantScoped:  true,
		OrderBy:       "n.sort_order ASC, n.id ASC",
		NoPagination:  true,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if p.Values["courseId"] != "" {
				qb.AddCondition("n.course_id = " + qb.NextArg(p.Values["courseId"]))
			}
			if p.Values["parentId"] != "" {
				qb.AddCondition("n.parent_id = " + qb.NextArg(p.Values["parentId"]))
			} else if p.Values["rootOnly"] == "true" {
				qb.AddCondition("n.parent_id IS NULL")
			}
		},
	}
}

// CourseIDOf 查询节点所属课程（租户归属校验用）。
func (s *CourseNodeStore) CourseIDOf(ctx context.Context, nodeID string) (string, error) {
	var courseID string
	err := s.q.QueryRow(ctx, `SELECT course_id FROM system_course_nodes WHERE id = $1`, nodeID).Scan(&courseID)
	return courseID, err
}

// Get 查询单个节点基础行。
func (s *CourseNodeStore) Get(ctx context.Context, id, tenantID string) (*CourseNodeBase, error) {
	n, err := s.fetchNode(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return n, nil
}

// Create 在事务内创建节点并绑定知识点/资源。
func (s *CourseNodeStore) Create(ctx context.Context, tx Queryer, tenantID string, p *CourseNodeCreateParams, kpIDs, resIDs []string) (*CourseNodeBase, error) {
	id := uuid.NewString()
	evalData := p.EvalData
	if evalData == nil {
		evalData = domain.JSONMap{}
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type, source_id, source_name,
			teaching_goals, detailed_description, description_pdf, background, estimated_hours,
			duration, difficulty, knowledge_point_ids, resource_ids, eval_data, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
	`, id, tenantID, p.CourseID, p.ParentID, p.Name, p.Code, p.SortOrder, p.RefType, p.SourceID, p.SourceName,
		p.TeachingGoals, p.DetailedDescription, p.DescriptionPdf, p.Background, p.EstimatedHours,
		p.Duration, p.Difficulty, kpIDs, resIDs, evalData, p.Status); err != nil {
		return nil, err
	}
	for _, kpID := range kpIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID); err != nil {
			return nil, err
		}
	}
	for _, resID := range resIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID); err != nil {
			return nil, err
		}
	}
	return s.fetchNodeWith(ctx, tx, id, tenantID)
}

// Update 在事务内更新节点并重绑知识点/资源。
func (s *CourseNodeStore) Update(ctx context.Context, tx Queryer, id, tenantID string, p *CourseNodeUpdateParams, kpIDs, resIDs []string) (*CourseNodeBase, error) {
	if _, err := s.fetchNodeWith(ctx, tx, id, tenantID); err != nil {
		return nil, err
	}
	evalData := p.EvalData
	if evalData == nil {
		evalData = domain.JSONMap{}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE system_course_nodes SET name = $1, code = $2, sort_order = $3, ref_type = $4, source_id = $5,
			source_name = $6, teaching_goals = $7, detailed_description = $8, description_pdf = $9,
			background = $10, estimated_hours = $11, duration = $12, difficulty = $13,
			knowledge_point_ids = $14, resource_ids = $15, eval_data = $16, status = $17, updated_at = NOW()
		WHERE id = $18 AND tenant_id = $19
	`, p.Name, p.Code, p.SortOrder, p.RefType, p.SourceID, p.SourceName, p.TeachingGoals,
		p.DetailedDescription, p.DescriptionPdf, p.Background, p.EstimatedHours,
		p.Duration, p.Difficulty, kpIDs, resIDs, evalData, p.Status, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM node_knowledge_point_bindings WHERE node_id = $1`, id); err != nil {
		return nil, fmt.Errorf("delete node knowledge bindings: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM node_resource_bindings WHERE node_id = $1`, id); err != nil {
		return nil, fmt.Errorf("delete node resource bindings: %w", err)
	}
	for _, kpID := range kpIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID); err != nil {
			return nil, err
		}
	}
	for _, resID := range resIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID); err != nil {
			return nil, err
		}
	}
	return s.fetchNodeWith(ctx, tx, id, tenantID)
}

// Delete 删除节点。
func (s *CourseNodeStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM system_course_nodes WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// Reorder 在事务内批量更新节点排序。
func (s *CourseNodeStore) Reorder(ctx context.Context, tx Queryer, courseID string, nodeIDs []string) error {
	for i, nodeID := range nodeIDs {
		if _, err := tx.Exec(ctx, `
			UPDATE system_course_nodes SET sort_order = $1, updated_at = NOW()
			WHERE id = $2 AND course_id = $3
		`, i, nodeID, courseID); err != nil {
			return err
		}
	}
	return nil
}

// KnowledgePointsByIDs 批量查询知识点。
func (s *CourseNodeStore) KnowledgePointsByIDs(ctx context.Context, ids []string) (map[string]NodeKnowledgePoint, error) {
	out := make(map[string]NodeKnowledgePoint)
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT kp.id, kp.name, kp.code, kp.description, kp.linked
		FROM knowledge_points kp
		WHERE kp.id = ANY($1::uuid[])
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var kp NodeKnowledgePoint
		if err := rows.Scan(&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked); err != nil {
			return nil, err
		}
		out[kp.ID] = kp
	}
	return out, rows.Err()
}

// ResourcesByIDs 批量查询资源。
func (s *CourseNodeStore) ResourcesByIDs(ctx context.Context, ids []string) (map[string]NodeResource, error) {
	out := make(map[string]NodeResource)
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT rl.id, rl.name, rl.resource_type, COALESCE(rl.url, ''), COALESCE(rl.file_size, 0)::int
		FROM unnest($1::uuid[]) AS res_id
		JOIN resource_library rl ON rl.id = res_id
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var res NodeResource
		if err := rows.Scan(&res.ID, &res.Name, &res.Type, &res.URL, &res.Size); err != nil {
			return nil, err
		}
		out[res.ID] = res
	}
	return out, rows.Err()
}

// QuizzesByNodeIDs 批量查询节点测验。
func (s *CourseNodeStore) QuizzesByNodeIDs(ctx context.Context, nodeIDs []string) ([]domain.NodeQuiz, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, node_id, title, type, time_limit
		FROM node_quizzes
		WHERE node_id = ANY($1)
		ORDER BY id ASC
	`, nodeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNodeQuizRows(rows)
}

// HomeworksByNodeIDs 批量查询节点作业。
func (s *CourseNodeStore) HomeworksByNodeIDs(ctx context.Context, nodeIDs []string) ([]domain.NodeHomework, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks
		WHERE node_id = ANY($1)
		ORDER BY id ASC
	`, nodeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNodeHomeworkRows(rows)
}

// OriginalSourceKnowledgePoints 查询 original 节点来源颗粒课的知识点（course 绑定）。
func (s *CourseNodeStore) OriginalSourceKnowledgePoints(ctx context.Context, courseIDs []string) (map[string][]NodeKnowledgePoint, error) {
	out := make(map[string][]NodeKnowledgePoint)
	if len(courseIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT ckb.course_id, kp.id, kp.name, kp.code, kp.description, TRUE AS linked
		FROM course_knowledge_bindings ckb
		JOIN knowledge_points kp ON kp.id = ckb.knowledge_point_id
		WHERE ckb.course_id = ANY($1) AND ckb.bind_type = 'course'
	`, courseIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var courseID string
		var kp NodeKnowledgePoint
		if err := rows.Scan(&courseID, &kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked); err != nil {
			return nil, err
		}
		out[courseID] = append(out[courseID], kp)
	}
	return out, rows.Err()
}

// OriginalSourceResources 查询 original 节点来源颗粒课的资源（course 绑定）。
func (s *CourseNodeStore) OriginalSourceResources(ctx context.Context, courseIDs []string) (map[string][]NodeResource, error) {
	out := make(map[string][]NodeResource)
	if len(courseIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT crb.course_id, rl.id,
			rl.name,
			rl.resource_type,
			COALESCE(rl.url, '') AS url,
			COALESCE(rl.file_size, 0)::int AS size
		FROM course_resource_bindings crb
		JOIN resource_library rl ON rl.id = crb.resource_id
		WHERE crb.course_id = ANY($1)
	`, courseIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var courseID string
		var res NodeResource
		if err := rows.Scan(&courseID, &res.ID, &res.Name, &res.Type, &res.URL, &res.Size); err != nil {
			return nil, err
		}
		out[courseID] = append(out[courseID], res)
	}
	return out, rows.Err()
}

// CourseNodeCreateParams 创建节点参数。
type CourseNodeCreateParams struct {
	CourseID            string
	ParentID            *string
	Name                string
	Code                *string
	SortOrder           int
	RefType             string
	SourceID            *string
	SourceName          *string
	TeachingGoals       *string
	DetailedDescription *string
	DescriptionPdf      *string
	Background          *string
	EstimatedHours      *float64
	Duration            *float64
	Difficulty          *int
	EvalData            domain.JSONMap
	Status              string
}

// CourseNodeUpdateParams 更新节点参数。
type CourseNodeUpdateParams = CourseNodeCreateParams

func (s *CourseNodeStore) fetchNode(ctx context.Context, id, tenantID string) (*CourseNodeBase, error) {
	return s.fetchNodeWith(ctx, s.q, id, tenantID)
}

// fetchNodeWith 用指定 Queryer（事务内用 tx，保证读到未提交行）查询节点。
func (s *CourseNodeStore) fetchNodeWith(ctx context.Context, q Queryer, id, tenantID string) (*CourseNodeBase, error) {
	var n CourseNodeBase
	err := q.QueryRow(ctx, `
		SELECT n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name,
			n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours,
			n.duration, n.difficulty, n.knowledge_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status
		FROM system_course_nodes n WHERE n.id = $1 AND n.tenant_id = $2
	`, id, tenantID).Scan(
		&n.ID, &n.CourseID, &n.ParentID, &n.Name, &n.Code, &n.SortOrder, &n.RefType, &n.SourceID, &n.SourceName,
		&n.TeachingGoals, &n.DetailedDescription, &n.DescriptionPdf, &n.Background, &n.EstimatedHours,
		&n.Duration, &n.Difficulty, &n.KnowledgePointIds, &n.ResourceIds, &n.EvalData, &n.Status,
	)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func scanCourseNodeBaseRows(rows pgx.Rows) ([]CourseNodeBase, error) {
	items := make([]CourseNodeBase, 0)
	for rows.Next() {
		var n CourseNodeBase
		if err := rows.Scan(
			&n.ID, &n.CourseID, &n.ParentID, &n.Name, &n.Code, &n.SortOrder, &n.RefType, &n.SourceID, &n.SourceName,
			&n.TeachingGoals, &n.DetailedDescription, &n.DescriptionPdf, &n.Background, &n.EstimatedHours,
			&n.Duration, &n.Difficulty, &n.KnowledgePointIds, &n.ResourceIds, &n.EvalData, &n.Status,
		); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, rows.Err()
}

// ListNodeKnowledgePointNames 查询节点绑定知识点名称（导出用）。
func (s *CourseNodeStore) ListNodeKnowledgePointNames(ctx context.Context, q Queryer, nodeID string) []string {
	rows, err := q.Query(ctx, `
		SELECT kp.name FROM knowledge_points kp
		JOIN node_knowledge_point_bindings nb ON nb.knowledge_point_id = kp.id
		WHERE nb.node_id=$1
		ORDER BY kp.name
	`, nodeID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil && n != "" {
			names = append(names, n)
		}
	}
	return names
}

// ListNodeResourceNames 查询节点绑定资源名称（导出用）。
func (s *CourseNodeStore) ListNodeResourceNames(ctx context.Context, q Queryer, nodeID string) []string {
	rows, err := q.Query(ctx, `
		SELECT r.name FROM resource_library r
		JOIN node_resource_bindings nb ON nb.resource_id = r.id
		WHERE nb.node_id=$1
		ORDER BY r.name
	`, nodeID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil && n != "" {
			names = append(names, n)
		}
	}
	return names
}

// ListNodeEvalMethods 查询节点测评方式（quiz 类型 + 是否有作业，导出用）。
func (s *CourseNodeStore) ListNodeEvalMethods(ctx context.Context, q Queryer, tenantID, nodeID string) ([]string, bool) {
	var methods []string
	rows, err := q.Query(ctx, `
		SELECT type FROM node_quizzes
		WHERE node_id=$1 AND tenant_id=$2
		ORDER BY type
	`, nodeID, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			if err := rows.Scan(&t); err == nil {
				methods = append(methods, t)
			}
		}
	}
	var hasHomework bool
	if err := q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE node_id=$1 AND tenant_id=$2)
	`, nodeID, tenantID).Scan(&hasHomework); err != nil {
		hasHomework = false
	}
	return methods, hasHomework
}

// CourseNodeExportRow 导出用节点行。
type CourseNodeExportRow struct {
	ID            string
	Name          string
	ParentID      string
	RefType       string
	SortOrder     int
	TeachingGoals string
	Duration      int
	Difficulty    int
}

// ListByCourse 查询课程全部节点（导出用）。
func (s *CourseNodeStore) ListByCourse(ctx context.Context, q Queryer, tenantID, courseID string) ([]CourseNodeExportRow, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, COALESCE(parent_id::text,''), COALESCE(ref_type,''), sort_order, COALESCE(teaching_goals,''), duration, difficulty
		FROM system_course_nodes
		WHERE course_id=$1 AND tenant_id=$2
		ORDER BY sort_order, created_at
	`, courseID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CourseNodeExportRow
	for rows.Next() {
		var n CourseNodeExportRow
		if err := rows.Scan(&n.ID, &n.Name, &n.ParentID, &n.RefType, &n.SortOrder, &n.TeachingGoals, &n.Duration, &n.Difficulty); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}
