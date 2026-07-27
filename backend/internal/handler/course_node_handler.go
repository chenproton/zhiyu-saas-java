package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseNodeHandler struct {
	DB *pgxpool.Pool
}

type CourseNodeListResponse struct {
	Items []SystemCourseNodeResponse `json:"items"`
	Total int                        `json:"total"`
}

// SystemCourseNodeResponse 是前端编辑页需要的完整节点模型。
type SystemCourseNodeResponse struct {
	ID                 string                           `json:"id"`
	CourseID           string                           `json:"courseId"`
	ParentID           *string                          `json:"parentId,omitempty"`
	Name               string                           `json:"name"`
	Code               *string                          `json:"code,omitempty"`
	Order              int                              `json:"order"`
	Type               string                           `json:"type"`
	SourceID           *string                          `json:"sourceId,omitempty"`
	SourceName         *string                          `json:"sourceName,omitempty"`
	TeachingGoals      *string                          `json:"teachingGoals,omitempty"`
	DetailedDescription *string                         `json:"detailedDescription,omitempty"`
	DescriptionPdf     *string                          `json:"descriptionPdf,omitempty"`
	Background         *string                          `json:"background,omitempty"`
	EstimatedHours     *float64                         `json:"estimatedHours,omitempty"`
	Duration           *float64                         `json:"duration,omitempty"`
	Difficulty         *int                             `json:"difficulty,omitempty"`
	KnowledgePoints    []SystemCourseNodeKnowledgePoint `json:"knowledgePoints,omitempty"`
	AbilityPoints      []SystemCourseNodeAbilityPoint   `json:"abilityPoints,omitempty"`
	Resources          []SystemCourseNodeResource       `json:"resources,omitempty"`
	Quizzes            []domain.NodeQuiz                `json:"quizzes,omitempty"`
	Homeworks          []domain.NodeHomework            `json:"homeworks,omitempty"`
	EvalData           domain.JSONMap                   `json:"evalData,omitempty"`
	Status             string                           `json:"status"`
}

type SystemCourseNodeKnowledgePoint struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Code        *string `json:"code,omitempty"`
	Description *string `json:"description,omitempty"`
	Linked      bool    `json:"linked"`
}

type SystemCourseNodeAbilityPoint struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Description *string `json:"description,omitempty"`
}

type SystemCourseNodeResource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	URL  string `json:"url"`
	Size *int   `json:"size,omitempty"`
}

type CreateCourseNodeRequest struct {
	CourseID           string           `json:"courseId"`
	ParentID           *string          `json:"parentId"`
	Name               string           `json:"name"`
	Code               *string          `json:"code"`
	SortOrder          int              `json:"sortOrder"`
	RefType            string           `json:"refType"`
	SourceID           *string          `json:"sourceId"`
	SourceName         *string          `json:"sourceName"`
	TeachingGoals      *string          `json:"teachingGoals"`
	DetailedDescription *string         `json:"detailedDescription"`
	DescriptionPdf     *string          `json:"descriptionPdf"`
	Background         *string          `json:"background"`
	EstimatedHours     *float64         `json:"estimatedHours"`
	Duration           *float64         `json:"duration"`
	Difficulty         *int             `json:"difficulty"`
	KnowledgePointIds  domain.JSONSlice `json:"knowledgePointIds"`
	AbilityPointIds    domain.JSONSlice `json:"abilityPointIds"`
	ResourceIds        domain.JSONSlice `json:"resourceIds"`
	EvalData           domain.JSONMap   `json:"evalData"`
	Status             string           `json:"status"`
}

type UpdateCourseNodeRequest struct {
	Name               string           `json:"name"`
	Code               *string          `json:"code"`
	SortOrder          int              `json:"sortOrder"`
	RefType            string           `json:"refType"`
	SourceID           *string          `json:"sourceId"`
	SourceName         *string          `json:"sourceName"`
	TeachingGoals      *string          `json:"teachingGoals"`
	DetailedDescription *string         `json:"detailedDescription"`
	DescriptionPdf     *string          `json:"descriptionPdf"`
	Background         *string          `json:"background"`
	EstimatedHours     *float64         `json:"estimatedHours"`
	Duration           *float64         `json:"duration"`
	Difficulty         *int             `json:"difficulty"`
	KnowledgePointIds  domain.JSONSlice `json:"knowledgePointIds"`
	AbilityPointIds    domain.JSONSlice `json:"abilityPointIds"`
	ResourceIds        domain.JSONSlice `json:"resourceIds"`
	EvalData           domain.JSONMap   `json:"evalData"`
	Status             string           `json:"status"`
}

type ReorderCourseNodesRequest struct {
	CourseID string   `json:"courseId"`
	NodeIDs  []string `json:"nodeIds"`
}

type courseNodeBase struct {
	ID                 string
	CourseID           string
	ParentID           *string
	Name               string
	Code               *string
	SortOrder          int
	RefType            string
	SourceID           *string
	SourceName         *string
	TeachingGoals      *string
	DetailedDescription *string
	DescriptionPdf     *string
	Background         *string
	EstimatedHours     *float64
	Duration           *float64
	Difficulty         *int
	KnowledgePointIds  []string
	AbilityPointIds    []string
	ResourceIds        []string
	EvalData           domain.JSONMap
	Status             string
}

func (h *CourseNodeHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	courseID := r.URL.Query().Get("courseId")
	parentID := r.URL.Query().Get("parentId")

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if courseID != "" {
		where = append(where, "course_id = $"+itoa(argIdx))
		args = append(args, courseID)
		argIdx++
	}
	if parentID != "" {
		where = append(where, "parent_id = $"+itoa(argIdx))
		args = append(args, parentID)
		argIdx++
	} else if r.URL.Query().Get("rootOnly") == "true" {
		where = append(where, "parent_id IS NULL")
	}

	countQuery := "SELECT COUNT(*) FROM system_course_nodes WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name,
			n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours,
			n.duration, n.difficulty, n.knowledge_point_ids::text[], n.ability_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status
		FROM system_course_nodes n
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY n.sort_order ASC, n.id ASC
	`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list course nodes")
		return
	}
	defer rows.Close()

	bases, err := h.scanCourseNodeBaseRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan course nodes")
		return
	}

	items, err := h.enrichCourseNodes(r.Context(), bases)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to enrich course nodes")
		return
	}

	respondJSON(w, http.StatusOK, CourseNodeListResponse{Items: items, Total: total})
}

func (h *CourseNodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	node, err := h.fetchCourseNode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "course node not found")
		return
	}
	respondJSON(w, http.StatusOK, node)
}

func (h *CourseNodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateCourseNodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CourseID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	abIDs := jsonSliceToUUIDSlice(req.AbilityPointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)

	_, err = tx.Exec(r.Context(), `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type, source_id, source_name,
			teaching_goals, detailed_description, description_pdf, background, estimated_hours,
			duration, difficulty, knowledge_point_ids, ability_point_ids, resource_ids, eval_data, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
	`, id, tenantID, req.CourseID, req.ParentID, req.Name, req.Code, req.SortOrder, req.RefType, req.SourceID, req.SourceName,
		req.TeachingGoals, req.DetailedDescription, req.DescriptionPdf, req.Background, req.EstimatedHours,
		req.Duration, req.Difficulty, kpIDs, abIDs, resIDs, req.EvalData, req.Status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create course node")
		return
	}

	for _, kpID := range kpIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID)
	}
	for _, abID := range abIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_ability_point_bindings (node_id, ability_point_id) VALUES ($1, $2)`, id, abID)
	}
	for _, resID := range resIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID)
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	node, _ := h.fetchCourseNode(r.Context(), id)
	respondJSON(w, http.StatusCreated, node)
}

func (h *CourseNodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCourseNode(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "course node not found")
		return
	}

	var req UpdateCourseNodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	abIDs := jsonSliceToUUIDSlice(req.AbilityPointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	if req.RefType == "original" {
		kpIDs = []string{}
		abIDs = []string{}
		resIDs = []string{}
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE system_course_nodes SET name = $1, code = $2, sort_order = $3, ref_type = $4, source_id = $5,
			source_name = $6, teaching_goals = $7, detailed_description = $8, description_pdf = $9,
			background = $10, estimated_hours = $11, duration = $12, difficulty = $13,
			knowledge_point_ids = $14, ability_point_ids = $15, resource_ids = $16, eval_data = $17, status = $18, updated_at = NOW()
		WHERE id = $19
	`, req.Name, req.Code, req.SortOrder, req.RefType, req.SourceID, req.SourceName, req.TeachingGoals,
		req.DetailedDescription, req.DescriptionPdf, req.Background, req.EstimatedHours,
		req.Duration, req.Difficulty, kpIDs, abIDs, resIDs, req.EvalData, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update course node")
		return
	}

	_, _ = tx.Exec(r.Context(), `DELETE FROM node_knowledge_point_bindings WHERE node_id = $1`, id)
	_, _ = tx.Exec(r.Context(), `DELETE FROM node_ability_point_bindings WHERE node_id = $1`, id)
	_, _ = tx.Exec(r.Context(), `DELETE FROM node_resource_bindings WHERE node_id = $1`, id)
	for _, kpID := range kpIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID)
	}
	for _, abID := range abIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_ability_point_bindings (node_id, ability_point_id) VALUES ($1, $2)`, id, abID)
	}
	for _, resID := range resIDs {
		_, _ = tx.Exec(r.Context(), `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID)
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	node, _ := h.fetchCourseNode(r.Context(), id)
	respondJSON(w, http.StatusOK, node)
}

func (h *CourseNodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCourseNode(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "course node not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM system_course_nodes WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete course node")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseNodeHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req ReorderCourseNodesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CourseID == "" || len(req.NodeIDs) == 0 {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	for i, nodeID := range req.NodeIDs {
		_, err := tx.Exec(r.Context(), `
			UPDATE system_course_nodes SET sort_order = $1, updated_at = NOW()
			WHERE id = $2 AND course_id = $3
		`, i, nodeID, req.CourseID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to reorder nodes")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *CourseNodeHandler) fetchCourseNode(ctx context.Context, id string) (*SystemCourseNodeResponse, error) {
	var base courseNodeBase
	err := h.DB.QueryRow(ctx, `
		SELECT n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name,
			n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours,
			n.duration, n.difficulty, n.knowledge_point_ids::text[], n.ability_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status
		FROM system_course_nodes n WHERE n.id = $1
	`, id).Scan(
		&base.ID, &base.CourseID, &base.ParentID, &base.Name, &base.Code, &base.SortOrder, &base.RefType, &base.SourceID, &base.SourceName,
		&base.TeachingGoals, &base.DetailedDescription, &base.DescriptionPdf, &base.Background, &base.EstimatedHours,
		&base.Duration, &base.Difficulty, &base.KnowledgePointIds, &base.AbilityPointIds, &base.ResourceIds, &base.EvalData, &base.Status,
	)
	if err != nil {
		return nil, err
	}
	items, err := h.enrichCourseNodes(ctx, []courseNodeBase{base})
	if err != nil {
		return nil, err
	}
	return &items[0], nil
}

func (h *CourseNodeHandler) scanCourseNodeBaseRows(rows pgx.Rows) ([]courseNodeBase, error) {
	items := make([]courseNodeBase, 0)
	for rows.Next() {
		var n courseNodeBase
		if err := rows.Scan(
			&n.ID, &n.CourseID, &n.ParentID, &n.Name, &n.Code, &n.SortOrder, &n.RefType, &n.SourceID, &n.SourceName,
			&n.TeachingGoals, &n.DetailedDescription, &n.DescriptionPdf, &n.Background, &n.EstimatedHours,
			&n.Duration, &n.Difficulty, &n.KnowledgePointIds, &n.AbilityPointIds, &n.ResourceIds, &n.EvalData, &n.Status,
		); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, nil
}

func (h *CourseNodeHandler) enrichCourseNodes(ctx context.Context, bases []courseNodeBase) ([]SystemCourseNodeResponse, error) {
	items := make([]SystemCourseNodeResponse, len(bases))
	nodeIndex := make(map[string]int, len(bases))
	nodeIDs := make([]string, 0, len(bases))
	for i, b := range bases {
		items[i] = SystemCourseNodeResponse{
			ID:                 b.ID,
			CourseID:           b.CourseID,
			ParentID:           b.ParentID,
			Name:               b.Name,
			Code:               b.Code,
			Order:              b.SortOrder,
			Type:               b.RefType,
			SourceID:           b.SourceID,
			SourceName:         b.SourceName,
			TeachingGoals:      b.TeachingGoals,
			DetailedDescription: b.DetailedDescription,
			DescriptionPdf:     b.DescriptionPdf,
			Background:         b.Background,
			EstimatedHours:     b.EstimatedHours,
			Duration:           b.Duration,
			Difficulty:         b.Difficulty,
			EvalData:           b.EvalData,
			Status:             b.Status,
		}
		nodeIndex[b.ID] = i
		nodeIDs = append(nodeIDs, b.ID)
	}

	if len(nodeIDs) == 0 {
		return items, nil
	}

	// knowledge points
	kpIDSet := make(map[string]bool)
	abIDSet := make(map[string]bool)
	resIDSet := make(map[string]bool)
	for _, b := range bases {
		for _, id := range b.KnowledgePointIds {
			kpIDSet[id] = true
		}
		for _, id := range b.AbilityPointIds {
			abIDSet[id] = true
		}
		for _, id := range b.ResourceIds {
			resIDSet[id] = true
		}
	}

	kpIDs := make([]string, 0, len(kpIDSet))
	for id := range kpIDSet {
		kpIDs = append(kpIDs, id)
	}
	abIDs := make([]string, 0, len(abIDSet))
	for id := range abIDSet {
		abIDs = append(abIDs, id)
	}
	resIDs := make([]string, 0, len(resIDSet))
	for id := range resIDSet {
		resIDs = append(resIDs, id)
	}

	kpMap := make(map[string]SystemCourseNodeKnowledgePoint)
	if len(kpIDs) > 0 {
		if rows, err := h.DB.Query(ctx, `
			SELECT kp.id, kp.name, kp.code, kp.description, kp.linked
			FROM knowledge_points kp
			WHERE kp.id = ANY($1::uuid[])
		`, kpIDs); err == nil {
			defer rows.Close()
			for rows.Next() {
				var kp SystemCourseNodeKnowledgePoint
				if err := rows.Scan(&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked); err != nil {
					return nil, err
				}
				kpMap[kp.ID] = kp
			}
		} else {
			return nil, err
		}
	}

	resMap := make(map[string]SystemCourseNodeResource)
	if len(resIDs) > 0 {
		if rows, err := h.DB.Query(ctx, `
			SELECT rl.id, rl.name, rl.resource_type, COALESCE(rl.url, ''), rl.file_size::int
			FROM unnest($1::uuid[]) AS res_id
			JOIN resource_library rl ON rl.id = res_id
		`, resIDs); err == nil {
			defer rows.Close()
			for rows.Next() {
				var res SystemCourseNodeResource
				if err := rows.Scan(&res.ID, &res.Name, &res.Type, &res.URL, &res.Size); err != nil {
					return nil, err
				}
				resMap[res.ID] = res
			}
		} else {
			return nil, err
		}
	}

	abMap := make(map[string]SystemCourseNodeAbilityPoint)
	if len(abIDs) > 0 {
		if rows, err := h.DB.Query(ctx, `
			SELECT ap.id, ap.name, ap.category, ap.description
			FROM ability_points ap
			WHERE ap.id = ANY($1::uuid[])
		`, abIDs); err == nil {
			defer rows.Close()
			for rows.Next() {
				var ap SystemCourseNodeAbilityPoint
				if err := rows.Scan(&ap.ID, &ap.Name, &ap.Category, &ap.Description); err != nil {
					return nil, err
				}
				abMap[ap.ID] = ap
			}
		} else {
			return nil, err
		}
	}

	for i, b := range bases {
		for _, id := range b.KnowledgePointIds {
			if kp, ok := kpMap[id]; ok {
				items[i].KnowledgePoints = append(items[i].KnowledgePoints, kp)
			}
		}
		for _, id := range b.AbilityPointIds {
			if ap, ok := abMap[id]; ok {
				items[i].AbilityPoints = append(items[i].AbilityPoints, ap)
			}
		}
		for _, id := range b.ResourceIds {
			if res, ok := resMap[id]; ok {
				items[i].Resources = append(items[i].Resources, res)
			}
		}
	}

	// quizzes
	if rows, err := h.DB.Query(ctx, `
		SELECT id, node_id, title, type, time_limit
		FROM node_quizzes
		WHERE node_id = ANY($1)
		ORDER BY id ASC
	`, nodeIDs); err == nil {
		defer rows.Close()
		for rows.Next() {
			var q domain.NodeQuiz
			if err := rows.Scan(&q.ID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit); err != nil {
				return nil, err
			}
			if idx, ok := nodeIndex[q.NodeID]; ok {
				items[idx].Quizzes = append(items[idx].Quizzes, q)
			}
		}
	} else {
		return nil, err
	}

	// homeworks
	if rows, err := h.DB.Query(ctx, `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks
		WHERE node_id = ANY($1)
		ORDER BY id ASC
	`, nodeIDs); err == nil {
		defer rows.Close()
		for rows.Next() {
			var hw domain.NodeHomework
			if err := rows.Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline); err != nil {
				return nil, err
			}
			if idx, ok := nodeIndex[hw.NodeID]; ok {
				items[idx].Homeworks = append(items[idx].Homeworks, hw)
			}
		}
	} else {
		return nil, err
	}

	// original 节点从来源颗粒课继承知识点和资源（以绑定表为准，避免 courses 数组字段为空）
	originalSourceIDs := make([]string, 0, len(items))
	nodeIDBySource := make(map[string][]string, len(items))
	for _, b := range bases {
		if b.RefType == "original" && b.SourceID != nil && *b.SourceID != "" {
			sourceID := *b.SourceID
			originalSourceIDs = append(originalSourceIDs, sourceID)
			nodeIDBySource[sourceID] = append(nodeIDBySource[sourceID], b.ID)
		}
	}
	if len(originalSourceIDs) > 0 {
		// 先收集各 original 节点已有的知识点/资源 ID，避免重复追加
		kpSeen := make(map[string]map[string]bool)
		resSeen := make(map[string]map[string]bool)
		for _, b := range bases {
			if b.RefType != "original" {
				continue
			}
			if kpSeen[b.ID] == nil {
				kpSeen[b.ID] = make(map[string]bool)
			}
			for _, id := range b.KnowledgePointIds {
				kpSeen[b.ID][id] = true
			}
			if resSeen[b.ID] == nil {
				resSeen[b.ID] = make(map[string]bool)
			}
			for _, id := range b.ResourceIds {
				resSeen[b.ID][id] = true
			}
		}

		// knowledge points from granular course bindings
		if rows, err := h.DB.Query(ctx, `
			SELECT ckb.course_id, kp.id, kp.name, kp.code, kp.description, TRUE AS linked
			FROM course_knowledge_bindings ckb
			JOIN knowledge_points kp ON kp.id = ckb.knowledge_point_id
			WHERE ckb.course_id = ANY($1) AND ckb.bind_type = 'course'
		`, originalSourceIDs); err == nil {
			defer rows.Close()
			for rows.Next() {
				var courseID string
				var kp SystemCourseNodeKnowledgePoint
				if err := rows.Scan(&courseID, &kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked); err != nil {
					return nil, err
				}
				for _, nodeID := range nodeIDBySource[courseID] {
					if idx, ok := nodeIndex[nodeID]; ok {
						if kpSeen[nodeID][kp.ID] {
							continue
						}
						kpSeen[nodeID][kp.ID] = true
						items[idx].KnowledgePoints = append(items[idx].KnowledgePoints, kp)
					}
				}
			}
		} else {
			return nil, err
		}

		// resources from granular course bindings
		if rows, err := h.DB.Query(ctx, `
			SELECT crb.course_id, rl.id,
				rl.name,
				rl.resource_type,
				COALESCE(rl.url, '') AS url,
				rl.file_size::int AS size
			FROM course_resource_bindings crb
			JOIN resource_library rl ON rl.id = crb.resource_id
			WHERE crb.course_id = ANY($1)
		`, originalSourceIDs); err == nil {
			defer rows.Close()
			for rows.Next() {
				var courseID string
				var res SystemCourseNodeResource
				if err := rows.Scan(&courseID, &res.ID, &res.Name, &res.Type, &res.URL, &res.Size); err != nil {
					return nil, err
				}
				for _, nodeID := range nodeIDBySource[courseID] {
					if idx, ok := nodeIndex[nodeID]; ok {
						if resSeen[nodeID][res.ID] {
							continue
						}
						resSeen[nodeID][res.ID] = true
						items[idx].Resources = append(items[idx].Resources, res)
					}
				}
			}
		} else {
			return nil, err
		}
	}

	return items, nil
}
