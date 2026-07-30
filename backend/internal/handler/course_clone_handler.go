package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseCloneHandler struct {
	DB *pgxpool.Pool
}

type CloneCourseRequest struct {
	Name string `json:"name"`
}

func (h *CourseCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("[CloneCourse] panic recovered", "panic", rec, "stack", string(debug.Stack()))
			respondError(w, http.StatusInternalServerError, "服务器内部错误")
		}
	}()

	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	slog.Info("[CloneCourse] start", "course_id", id, "user_id", claims.UserID)

	src, err := h.fetchSourceCourse(r.Context(), id)
	if err != nil {
		slog.Error("[CloneCourse] fetch source course failed", "course_id", id, "error", err)
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CloneCourseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	newName := req.Name
	if newName == "" {
		newName = src.Name + " (克隆)"
	}

	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(ctx)

	newID := uuid.NewString()
	prefix := "XT"
	if src.Type == "granular" {
		prefix = "KL"
	}
	code, err := generateUniqueEntityCode(ctx, tx, prefix, "courses", tenantID)
	if err != nil {
		slog.Error("[CloneCourse] generate code failed", "error", err)
		respondError(w, http.StatusInternalServerError, "生成课程代码失败")
		return
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			'draft', $17, $18, $19, $20, $21, $22, $23::uuid[], $24, $25::uuid[], $26::uuid[], $27::uuid[], $28, 0, 0, 0)
	`, newID, tenantID, code, newName, src.Type, src.Category, src.MajorID, src.TeacherID, src.IndustryID, src.Version,
		src.OnlineHours, src.OfflineHours, src.OnlineWeight, src.OfflineWeight, src.Semester, src.ClassName,
		src.CoverColor, src.CoverImage, src.CourseTag, src.Difficulty, src.Description, claims.UserID, coalesceStringSlice(src.CoCreatorIds),
		emptyStrToNil(src.BatchID), coalesceStringSlice(src.KnowledgePointIds), coalesceStringSlice(src.AbilityPointIds),
		coalesceStringSlice(src.ResourceIds), src.EvalData)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "课程名称已存在，请使用其他名称")
			return
		}
		slog.Error("[CloneCourse] insert course failed", "error", err)
		respondError(w, http.StatusInternalServerError, "克隆课程失败")
		return
	}

	if err := h.cloneCourseBindings(ctx, tx, id, newID, tenantID); err != nil {
		slog.Error("[CloneCourse] clone course bindings failed", "error", err)
		respondError(w, http.StatusInternalServerError, "克隆课程绑定失败")
		return
	}

	if src.Type == "system" {
		if err := h.cloneSystemCourseNodes(ctx, tx, id, newID, tenantID); err != nil {
			slog.Error("[CloneCourse] clone system course nodes failed", "error", err)
			respondError(w, http.StatusInternalServerError, "克隆体系课节点失败")
			return
		}
		if _, err := tx.Exec(ctx, `
			UPDATE courses SET node_count = (SELECT COUNT(*) FROM system_course_nodes WHERE course_id = $1), updated_at = NOW()
			WHERE id = $1
		`, newID); err != nil {
			slog.Error("[CloneCourse] update node_count failed", "error", err)
			respondError(w, http.StatusInternalServerError, "更新节点数量失败")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("[CloneCourse] commit failed", "error", err)
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	handler := &CourseHandler{DB: h.DB}
	course, err := handler.fetchCourse(ctx, newID)
	if err != nil {
		slog.Error("[CloneCourse] fetch cloned course failed", "error", err)
		respondError(w, http.StatusInternalServerError, "获取克隆课程失败")
		return
	}
	slog.Info("[CloneCourse] success", "new_course_id", newID)
	respondJSON(w, http.StatusCreated, course)
}

type sourceCourseFields struct {
	Name             string
	Type             string
	Category         string
	MajorID          *string
	TeacherID        *string
	IndustryID       *string
	Version          *string
	OnlineHours      *float64
	OfflineHours     *float64
	OnlineWeight     *float64
	OfflineWeight    *float64
	Semester         *string
	ClassName        *string
	CoverColor       *string
	CoverImage       *string
	CourseTag        *string
	Difficulty       *int
	Description      *string
	KnowledgePointIds []string
	AbilityPointIds  []string
	ResourceIds      []string
	CoCreatorIds     []string
	BatchID          *string
	EvalData         domain.JSONMap
	TenantID         *string
}

func (h *CourseCloneHandler) fetchSourceCourse(ctx context.Context, id string) (*sourceCourseFields, error) {
	var s sourceCourseFields
	err := h.DB.QueryRow(ctx, `
		SELECT name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			cover_color, cover_image, course_tag, difficulty, description,
			knowledge_point_ids::text[] AS knowledge_point_ids,
			ability_point_ids::text[] AS ability_point_ids,
			resource_ids::text[] AS resource_ids,
			co_creator_ids, batch_id, eval_data, tenant_id
		FROM courses WHERE id = $1
	`, id).Scan(
		&s.Name, &s.Type, &s.Category, &s.MajorID, &s.TeacherID, &s.IndustryID, &s.Version,
		&s.OnlineHours, &s.OfflineHours, &s.OnlineWeight, &s.OfflineWeight, &s.Semester, &s.ClassName,
		&s.CoverColor, &s.CoverImage, &s.CourseTag, &s.Difficulty, &s.Description,
		&s.KnowledgePointIds, &s.AbilityPointIds, &s.ResourceIds,
		&s.CoCreatorIds, &s.BatchID, &s.EvalData, &s.TenantID,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (h *CourseCloneHandler) cloneCourseBindings(ctx context.Context, tx pgx.Tx, oldCourseID, newCourseID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT knowledge_point_id, bind_type, source_id
		FROM course_knowledge_bindings WHERE course_id = $1
	`, oldCourseID)
	if err != nil {
		slog.Error("[CloneCourse] query knowledge bindings failed", "error", err)
		return err
	}
	defer rows.Close()

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
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range kpRows {
		_, err := tx.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), tenantID, newCourseID, r.KpID, r.BindType, r.SourceID)
		if err != nil {
			return err
		}
	}

	resRows, resErr := tx.Query(ctx, `
		SELECT resource_id FROM course_resource_bindings WHERE course_id = $1
	`, oldCourseID)
	if resErr != nil {
		slog.Error("[CloneCourse] query resource bindings failed", "error", resErr)
		return resErr
	}
	defer resRows.Close()
	for resRows.Next() {
		var resID string
		if err := resRows.Scan(&resID); err != nil {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newCourseID, resID)
		if err != nil {
			return err
		}
	}
	return resRows.Err()
}

func (h *CourseCloneHandler) cloneSystemCourseNodes(ctx context.Context, tx pgx.Tx, oldCourseID, newCourseID, tenantID string) error {
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
		slog.Error("[CloneCourse] query nodes failed", "error", err)
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
		newNodeID := uuid.NewString()
		nodeIDMap[n.ID] = newNodeID
	}

	for _, n := range nodes {
		newNodeID := nodeIDMap[n.ID]
		newParentID := (*string)(nil)
		if n.ParentID != nil && *n.ParentID != "" {
			if mapped, ok := nodeIDMap[*n.ParentID]; ok {
				newParentID = &mapped
			}
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type,
				source_id, source_name, teaching_goals, detailed_description, description_pdf, background,
				estimated_hours, duration, difficulty, knowledge_point_ids, resource_ids, ability_point_ids, eval_data, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
		`, newNodeID, tenantID, newCourseID, newParentID, n.Name, n.Code, n.SortOrder, n.RefType,
			n.SourceID, n.SourceName, n.TeachingGoals, n.DetailedDescription, n.DescriptionPdf, n.Background,
			n.EstimatedHours, n.Duration, n.Difficulty,
			coalesceStringSlice(n.KnowledgePointIds), coalesceStringSlice(n.ResourceIds),
			coalesceStringSlice(n.AbilityPointIds), n.EvalData, n.Status)
		if err != nil {
			return err
		}

		if err := h.cloneNodeKnowledgeBindings(ctx, tx, n.ID, newNodeID, tenantID); err != nil {
			return err
		}
		if err := h.cloneNodeResourceBindings(ctx, tx, n.ID, newNodeID, tenantID); err != nil {
			return err
		}
	}

	if err := h.cloneNodeQuizzes(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}
	if err := h.cloneNodeHomeworks(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}
	if err := h.cloneHybridNodeModules(ctx, tx, nodeIDMap, tenantID); err != nil {
		return err
	}

	return nil
}

func (h *CourseCloneHandler) cloneNodeQuizzes(ctx context.Context, tx pgx.Tx, nodeIDMap map[string]string, tenantID string) error {
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
	defer rows.Close()

	quizIDMap := make(map[string]string)
	for rows.Next() {
		var q quizRow
		if err := rows.Scan(&q.OldID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit); err != nil {
			return err
		}
		newNodeID, ok := nodeIDMap[q.NodeID]
		if !ok {
			continue
		}
		newQuizID := uuid.NewString()
		quizIDMap[q.OldID] = newQuizID
		_, err := tx.Exec(ctx, `
			INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, newQuizID, tenantID, newNodeID, q.Title, q.Type, q.TimeLimit)
		if err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
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
	defer qRows.Close()

	for qRows.Next() {
		var qq domain.NodeQuizQuestion
		var oldQuizID string
		if err := qRows.Scan(&oldQuizID, &qq.Type, &qq.Question, &qq.Options, &qq.Answer, &qq.Score, &qq.SortOrder); err != nil {
			return err
		}
		newQuizID, ok := quizIDMap[oldQuizID]
		if !ok {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), tenantID, newQuizID, qq.Type, qq.Question, qq.Options, qq.Answer, qq.Score, qq.SortOrder)
		if err != nil {
			return err
		}
	}
	return qRows.Err()
}

func (h *CourseCloneHandler) cloneNodeHomeworks(ctx context.Context, tx pgx.Tx, nodeIDMap map[string]string, tenantID string) error {
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
	defer rows.Close()

	for rows.Next() {
		var hw domain.NodeHomework
		var oldNodeID string
		if err := rows.Scan(&oldNodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline); err != nil {
			return err
		}
		newNodeID, ok := nodeIDMap[oldNodeID]
		if !ok {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, deadline)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), tenantID, newNodeID, hw.Title, hw.Requirement, hw.NeedAttachment, hw.Deadline)
		if err != nil {
			return err
		}
	}
	return rows.Err()
}

func (h *CourseCloneHandler) cloneHybridNodeModules(ctx context.Context, tx pgx.Tx, nodeIDMap map[string]string, tenantID string) error {
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
	defer rows.Close()

	for rows.Next() {
		var m domain.HybridNodeModule
		var oldNodeID string
		if err := rows.Scan(&oldNodeID, &m.ModuleKey, &m.Mode, &m.Data); err != nil {
			return err
		}
		newNodeID, ok := nodeIDMap[oldNodeID]
		if !ok {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), tenantID, newNodeID, m.ModuleKey, m.Mode, m.Data)
		if err != nil {
			return err
		}
	}
	return rows.Err()
}

func (h *CourseCloneHandler) cloneNodeKnowledgeBindings(ctx context.Context, tx pgx.Tx, oldNodeID, newNodeID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT knowledge_point_id FROM node_knowledge_point_bindings WHERE node_id = $1
	`, oldNodeID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var kpID string
		if err := rows.Scan(&kpID); err != nil {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO node_knowledge_point_bindings (id, tenant_id, node_id, knowledge_point_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newNodeID, kpID)
		if err != nil {
			return err
		}
	}
	return rows.Err()
}

func (h *CourseCloneHandler) cloneNodeResourceBindings(ctx context.Context, tx pgx.Tx, oldNodeID, newNodeID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT resource_id FROM node_resource_bindings WHERE node_id = $1
	`, oldNodeID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var resID string
		if err := rows.Scan(&resID); err != nil {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newNodeID, resID)
		if err != nil {
			return err
		}
	}
	return rows.Err()
}

func isNoRowsErr(err error) bool {
	if err == nil {
		return false
	}
	return err.Error() == "no rows in result set"
}
