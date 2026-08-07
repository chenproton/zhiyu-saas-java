package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// SourceCourseFields 课程克隆源字段。
type SourceCourseFields struct {
	Name              string
	Type              string
	Category          string
	MajorID           *string
	TeacherID         *string
	IndustryID        *string
	Version           *string
	OnlineHours       *float64
	OfflineHours      *float64
	OnlineWeight      *float64
	OfflineWeight     *float64
	Semester          *string
	ClassName         *string
	CoverColor        *string
	CoverImage        *string
	CourseTag         *string
	Difficulty        *int
	Description       *string
	KnowledgePointIds []string
	AbilityPointIds   []string
	ResourceIds       []string
	CoCreatorIds      []string
	BatchID           *string
	EvalData          domain.JSONMap
	TenantID          *string
}

// CourseCloneStore 课程克隆持久化（事务内多表复制）。
type CourseCloneStore struct {
	q Queryer
}

// NewCourseCloneStore 创建课程克隆 store。
func NewCourseCloneStore(q Queryer) *CourseCloneStore {
	return &CourseCloneStore{q: q}
}

// FetchSource 查询源课程字段。
func (s *CourseCloneStore) FetchSource(ctx context.Context, id string) (*SourceCourseFields, error) {
	var f SourceCourseFields
	err := s.q.QueryRow(ctx, `
		SELECT name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			cover_color, cover_image, course_tag, difficulty, description,
			knowledge_point_ids::text[] AS knowledge_point_ids,
			ability_point_ids::text[] AS ability_point_ids,
			resource_ids::text[] AS resource_ids,
			co_creator_ids, batch_id, eval_data, tenant_id
		FROM courses WHERE id = $1
	`, id).Scan(
		&f.Name, &f.Type, &f.Category, &f.MajorID, &f.TeacherID, &f.IndustryID, &f.Version,
		&f.OnlineHours, &f.OfflineHours, &f.OnlineWeight, &f.OfflineWeight, &f.Semester, &f.ClassName,
		&f.CoverColor, &f.CoverImage, &f.CourseTag, &f.Difficulty, &f.Description,
		&f.KnowledgePointIds, &f.AbilityPointIds, &f.ResourceIds,
		&f.CoCreatorIds, &f.BatchID, &f.EvalData, &f.TenantID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &f, nil
}

// CloneCourse 在事务内克隆课程及全部关联（绑定/体系课节点/节点子表）。
// 混合课与体系课共用 system_course_nodes 节点表，一并克隆节点及全部子表。
// 返回新课程 ID。
func (s *CourseCloneStore) CloneCourse(ctx context.Context, tx Queryer, tenantID, oldCourseID, newName string, src *SourceCourseFields, createdBy, code string) (string, error) {
	newID := uuid.NewString()
	if _, err := tx.Exec(ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			'draft', $17, $18, $19, $20, $21, $22, $23::uuid[], $24, $25::uuid[], $26::uuid[], $27::uuid[], $28, 0, 0, 0)
	`, newID, tenantID, code, newName, src.Type, src.Category, src.MajorID, src.TeacherID, src.IndustryID, src.Version,
		src.OnlineHours, src.OfflineHours, src.OnlineWeight, src.OfflineWeight, src.Semester, src.ClassName,
		src.CoverColor, src.CoverImage, src.CourseTag, src.Difficulty, src.Description, createdBy, src.CoCreatorIds,
		src.BatchID, src.KnowledgePointIds, src.AbilityPointIds,
		src.ResourceIds, src.EvalData); err != nil {
		return "", err
	}

	if err := s.cloneCourseBindings(ctx, tx, oldCourseID, newID, tenantID); err != nil {
		return "", err
	}

	if src.Type == "system" || src.Type == "hybrid" {
		if err := s.cloneCourseNodes(ctx, tx, oldCourseID, newID, tenantID); err != nil {
			return "", err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE courses SET node_count = (SELECT COUNT(*) FROM system_course_nodes WHERE course_id = $1), updated_at = NOW()
			WHERE id = $1
		`, newID); err != nil {
			return "", err
		}
	}

	return newID, nil
}

func (s *CourseCloneStore) cloneCourseBindings(ctx context.Context, tx Queryer, oldCourseID, newCourseID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT knowledge_point_id, bind_type, source_id
		FROM course_knowledge_bindings WHERE course_id = $1
	`, oldCourseID)
	if err != nil {
		return err
	}
	type kpRow struct {
		KpID     string
		BindType string
		SourceID *string
	}
	var kpRows []kpRow
	for rows.Next() {
		var r kpRow
		if err := rows.Scan(&r.KpID, &r.BindType, &r.SourceID); err != nil {
			continue
		}
		kpRows = append(kpRows, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range kpRows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), tenantID, newCourseID, r.KpID, r.BindType, r.SourceID); err != nil {
			return err
		}
	}

	resRows, resErr := tx.Query(ctx, `
		SELECT resource_id FROM course_resource_bindings WHERE course_id = $1
	`, oldCourseID)
	if resErr != nil {
		return resErr
	}
	var resIDs []string
	for resRows.Next() {
		var resID string
		if err := resRows.Scan(&resID); err != nil {
			continue
		}
		resIDs = append(resIDs, resID)
	}
	if err := resRows.Err(); err != nil {
		return err
	}
	for _, resID := range resIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newCourseID, resID); err != nil {
			return err
		}
	}
	return nil
}

func (s *CourseCloneStore) cloneCourseNodes(ctx context.Context, tx Queryer, oldCourseID, newCourseID, tenantID string) error {
	type nodeRow struct {
		ID                  string
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
		AbilityPointIds     []string
		EvalData            domain.JSONMap
		Status              string
	}

	rows, err := tx.Query(ctx, `
		SELECT id, parent_id, name, code, sort_order, ref_type, source_id, source_name,
			teaching_goals, detailed_description, description_pdf, background, estimated_hours,
			duration, difficulty, knowledge_point_ids::text[], resource_ids::text[],
			ability_point_ids::text[], eval_data, status
		FROM system_course_nodes
		WHERE course_id = $1
		ORDER BY sort_order ASC, id ASC
	`, oldCourseID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var nodes []nodeRow
	for rows.Next() {
		var n nodeRow
		if err := rows.Scan(&n.ID, &n.ParentID, &n.Name, &n.Code, &n.SortOrder, &n.RefType,
			&n.SourceID, &n.SourceName, &n.TeachingGoals, &n.DetailedDescription, &n.DescriptionPdf,
			&n.Background, &n.EstimatedHours, &n.Duration, &n.Difficulty,
			&n.KnowledgePointIds, &n.ResourceIds, &n.AbilityPointIds, &n.EvalData, &n.Status); err != nil {
			return err
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(nodes) == 0 {
		return nil
	}

	nodeIDMap := make(map[string]string, len(nodes))
	for _, n := range nodes {
		nodeIDMap[n.ID] = uuid.NewString()
	}

	for _, n := range nodes {
		newNodeID := nodeIDMap[n.ID]
		var newParentID *string
		if n.ParentID != nil && *n.ParentID != "" {
			if mapped, ok := nodeIDMap[*n.ParentID]; ok {
				newParentID = &mapped
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type,
				source_id, source_name, teaching_goals, detailed_description, description_pdf, background,
				estimated_hours, duration, difficulty, knowledge_point_ids, resource_ids, ability_point_ids, eval_data, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
		`, newNodeID, tenantID, newCourseID, newParentID, n.Name, n.Code, n.SortOrder, n.RefType,
			n.SourceID, n.SourceName, n.TeachingGoals, n.DetailedDescription, n.DescriptionPdf, n.Background,
			n.EstimatedHours, n.Duration, n.Difficulty,
			n.KnowledgePointIds, n.ResourceIds, n.AbilityPointIds, n.EvalData, n.Status); err != nil {
			return err
		}
		if err := s.cloneNodeKnowledgeBindings(ctx, tx, n.ID, newNodeID); err != nil {
			return err
		}
		if err := s.cloneNodeResourceBindings(ctx, tx, n.ID, newNodeID); err != nil {
			return err
		}
	}

	if err := s.cloneNodeQuizzes(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}
	if err := s.cloneNodeHomeworks(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}
	if err := s.cloneHybridNodeModules(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}
	return nil
}

func (s *CourseCloneStore) cloneNodeQuizzes(ctx context.Context, tx Queryer, nodeIDMap map[string]string, tenantID string) error {
	if len(nodeIDMap) == 0 {
		return nil
	}
	type quizRow struct {
		OldID     string
		NodeID    string
		Title     string
		Type      string
		TimeLimit *int
	}
	type quizQuestionRow struct {
		OldQuizID string
		QQ        domain.NodeQuizQuestion
	}
	oldNodeIDs := make([]string, 0, len(nodeIDMap))
	for oldID := range nodeIDMap {
		oldNodeIDs = append(oldNodeIDs, oldID)
	}
	rows, err := tx.Query(ctx, `
		SELECT id, node_id, title, type, time_limit
		FROM node_quizzes
		WHERE node_id = ANY($1)
	`, oldNodeIDs)
	if err != nil {
		return err
	}
	var quizzes []quizRow
	for rows.Next() {
		var q quizRow
		if err := rows.Scan(&q.OldID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit); err != nil {
			return err
		}
		quizzes = append(quizzes, q)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	quizIDMap := make(map[string]string)
	for _, q := range quizzes {
		newNodeID, ok := nodeIDMap[q.NodeID]
		if !ok {
			continue
		}
		newQuizID := uuid.NewString()
		quizIDMap[q.OldID] = newQuizID
		if _, err := tx.Exec(ctx, `
			INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, newQuizID, tenantID, newNodeID, q.Title, q.Type, q.TimeLimit); err != nil {
			return err
		}
	}
	if len(quizIDMap) == 0 {
		return nil
	}
	oldQuizIDs := make([]string, 0, len(quizIDMap))
	for oldID := range quizIDMap {
		oldQuizIDs = append(oldQuizIDs, oldID)
	}
	qRows, qErr := tx.Query(ctx, `
		SELECT quiz_id, type, question, options, answer, score, sort_order
		FROM node_quiz_questions
		WHERE quiz_id = ANY($1)
		ORDER BY sort_order ASC
	`, oldQuizIDs)
	if qErr != nil {
		return qErr
	}
	var questions []quizQuestionRow
	for qRows.Next() {
		var qq domain.NodeQuizQuestion
		var oldQuizID string
		if err := qRows.Scan(&oldQuizID, &qq.Type, &qq.Question, &qq.Options, &qq.Answer, &qq.Score, &qq.SortOrder); err != nil {
			return err
		}
		questions = append(questions, quizQuestionRow{OldQuizID: oldQuizID, QQ: qq})
	}
	if err := qRows.Err(); err != nil {
		return err
	}
	for _, item := range questions {
		newQuizID, ok := quizIDMap[item.OldQuizID]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), tenantID, newQuizID, item.QQ.Type, item.QQ.Question, item.QQ.Options, item.QQ.Answer, item.QQ.Score, item.QQ.SortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *CourseCloneStore) cloneNodeHomeworks(ctx context.Context, tx Queryer, nodeIDMap map[string]string, tenantID string) error {
	if len(nodeIDMap) == 0 {
		return nil
	}
	oldNodeIDs := make([]string, 0, len(nodeIDMap))
	for oldID := range nodeIDMap {
		oldNodeIDs = append(oldNodeIDs, oldID)
	}
	rows, err := tx.Query(ctx, `
		SELECT node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks
		WHERE node_id = ANY($1)
	`, oldNodeIDs)
	if err != nil {
		return err
	}
	var homeworks []domain.NodeHomework
	var homeworkNodeIDs []string
	for rows.Next() {
		var hw domain.NodeHomework
		var oldNodeID string
		if err := rows.Scan(&oldNodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline); err != nil {
			return err
		}
		homeworks = append(homeworks, hw)
		homeworkNodeIDs = append(homeworkNodeIDs, oldNodeID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i, hw := range homeworks {
		newNodeID, ok := nodeIDMap[homeworkNodeIDs[i]]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, deadline)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), tenantID, newNodeID, hw.Title, hw.Requirement, hw.NeedAttachment, hw.Deadline); err != nil {
			return err
		}
	}
	return nil
}

func (s *CourseCloneStore) cloneHybridNodeModules(ctx context.Context, tx Queryer, nodeIDMap map[string]string, tenantID string) error {
	if len(nodeIDMap) == 0 {
		return nil
	}
	oldNodeIDs := make([]string, 0, len(nodeIDMap))
	for oldID := range nodeIDMap {
		oldNodeIDs = append(oldNodeIDs, oldID)
	}
	rows, err := tx.Query(ctx, `
		SELECT node_id, module_key, mode, data
		FROM hybrid_node_modules
		WHERE node_id = ANY($1)
	`, oldNodeIDs)
	if err != nil {
		return err
	}
	type moduleRow struct {
		OldNodeID string
		M         domain.HybridNodeModule
	}
	var modules []moduleRow
	for rows.Next() {
		var m domain.HybridNodeModule
		var oldNodeID string
		if err := rows.Scan(&oldNodeID, &m.ModuleKey, &m.Mode, &m.Data); err != nil {
			return err
		}
		modules = append(modules, moduleRow{OldNodeID: oldNodeID, M: m})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, item := range modules {
		newNodeID, ok := nodeIDMap[item.OldNodeID]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), tenantID, newNodeID, item.M.ModuleKey, item.M.Mode, item.M.Data); err != nil {
			return err
		}
	}
	return nil
}

func (s *CourseCloneStore) cloneNodeKnowledgeBindings(ctx context.Context, tx Queryer, oldNodeID, newNodeID string) error {
	rows, err := tx.Query(ctx, `
		SELECT knowledge_point_id FROM node_knowledge_point_bindings WHERE node_id = $1
	`, oldNodeID)
	if err != nil {
		return err
	}
	var kpIDs []string
	for rows.Next() {
		var kpID string
		if err := rows.Scan(&kpID); err != nil {
			return err
		}
		kpIDs = append(kpIDs, kpID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, kpID := range kpIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id)
			VALUES ($1, $2, $3)
		`, uuid.NewString(), newNodeID, kpID); err != nil {
			return err
		}
	}
	return nil
}

func (s *CourseCloneStore) cloneNodeResourceBindings(ctx context.Context, tx Queryer, oldNodeID, newNodeID string) error {
	rows, err := tx.Query(ctx, `
		SELECT resource_id FROM node_resource_bindings WHERE node_id = $1
	`, oldNodeID)
	if err != nil {
		return err
	}
	var resIDs []string
	for rows.Next() {
		var resID string
		if err := rows.Scan(&resID); err != nil {
			return err
		}
		resIDs = append(resIDs, resID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, resID := range resIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO node_resource_bindings (id, node_id, resource_id)
			VALUES ($1, $2, $3)
		`, uuid.NewString(), newNodeID, resID); err != nil {
			return err
		}
	}
	return nil
}

// FetchCourse 查询完整课程（含专业/行业/批次名称与计数）。
func (s *CourseCloneStore) FetchCourse(ctx context.Context, id string) (*domain.Course, error) {
	var c domain.Course
	err := s.q.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description,
			c.knowledge_point_ids::text[] AS knowledge_point_ids,
			c.ability_point_ids::text[] AS ability_point_ids,
			c.resource_ids::text[] AS resource_ids,
			c.eval_data,
			c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			COALESCE((SELECT COUNT(*) FROM system_course_nodes scn WHERE scn.course_id = c.id), 0) AS node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			COALESCE(vc.cnt, 0) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
		&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
		&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
		&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
		&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
