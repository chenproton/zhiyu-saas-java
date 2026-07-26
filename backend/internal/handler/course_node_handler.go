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
	ID              string                           `json:"id"`
	CourseID        string                           `json:"courseId"`
	ParentID        *string                          `json:"parentId,omitempty"`
	Name            string                           `json:"name"`
	Order           int                              `json:"order"`
	Type            string                           `json:"type"`
	SourceID        *string                          `json:"sourceId,omitempty"`
	SourceName      *string                          `json:"sourceName,omitempty"`
	TeachingGoals   *string                          `json:"teachingGoals,omitempty"`
	Duration        *float64                         `json:"duration,omitempty"`
	KnowledgePoints []SystemCourseNodeKnowledgePoint `json:"knowledgePoints,omitempty"`
	Resources       []SystemCourseNodeResource       `json:"resources,omitempty"`
	Quizzes         []domain.NodeQuiz                `json:"quizzes,omitempty"`
	Homeworks       []domain.NodeHomework            `json:"homeworks,omitempty"`
	Status          string                           `json:"status"`
}

type SystemCourseNodeKnowledgePoint struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Code        *string `json:"code,omitempty"`
	Description *string `json:"description,omitempty"`
	Linked      bool    `json:"linked"`
}

type SystemCourseNodeResource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	URL  string `json:"url"`
	Size *int   `json:"size,omitempty"`
}

type CreateCourseNodeRequest struct {
	CourseID          string           `json:"courseId"`
	ParentID          *string          `json:"parentId"`
	Name              string           `json:"name"`
	SortOrder         int              `json:"sortOrder"`
	RefType           string           `json:"refType"`
	SourceID          *string          `json:"sourceId"`
	SourceName        *string          `json:"sourceName"`
	TeachingGoals     *string          `json:"teachingGoals"`
	Duration          *float64         `json:"duration"`
	KnowledgePointIds domain.JSONSlice `json:"knowledgePointIds"`
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	Status            string           `json:"status"`
}

type UpdateCourseNodeRequest struct {
	Name              string           `json:"name"`
	SortOrder         int              `json:"sortOrder"`
	RefType           string           `json:"refType"`
	SourceID          *string          `json:"sourceId"`
	SourceName        *string          `json:"sourceName"`
	TeachingGoals     *string          `json:"teachingGoals"`
	Duration          *float64         `json:"duration"`
	KnowledgePointIds domain.JSONSlice `json:"knowledgePointIds"`
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	Status            string           `json:"status"`
}

type ReorderCourseNodesRequest struct {
	CourseID string   `json:"courseId"`
	NodeIDs  []string `json:"nodeIds"`
}

type courseNodeBase struct {
	ID            string
	CourseID      string
	ParentID      *string
	Name          string
	SortOrder     int
	RefType       string
	SourceID      *string
	SourceName    *string
	TeachingGoals *string
	Duration      *float64
	Status        string
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
		SELECT n.id, n.course_id, n.parent_id, n.name, n.sort_order, n.ref_type, n.source_id, n.source_name,
			n.teaching_goals, n.duration, n.status
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

	_, err = tx.Exec(r.Context(), `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type, source_id, source_name,
			teaching_goals, duration, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, id, tenantID, req.CourseID, req.ParentID, req.Name, req.SortOrder, req.RefType, req.SourceID, req.SourceName,
		req.TeachingGoals, req.Duration, req.Status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create course node")
		return
	}

	for _, v := range req.KnowledgePointIds {
		kpID, ok := v.(string)
		if !ok || kpID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert knowledge point binding")
			return
		}
	}
	for _, v := range req.ResourceIds {
		resID, ok := v.(string)
		if !ok || resID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert resource binding")
			return
		}
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

	if req.KnowledgePointIds == nil {
		req.KnowledgePointIds = domain.JSONSlice{}
	}
	if req.ResourceIds == nil {
		req.ResourceIds = domain.JSONSlice{}
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE system_course_nodes SET name = $1, sort_order = $2, ref_type = $3, source_id = $4,
			source_name = $5, teaching_goals = $6, duration = $7,
			status = $8, updated_at = NOW()
		WHERE id = $9
	`, req.Name, req.SortOrder, req.RefType, req.SourceID, req.SourceName, req.TeachingGoals,
		req.Duration, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update course node")
		return
	}

	_, err = tx.Exec(r.Context(), `DELETE FROM node_knowledge_point_bindings WHERE node_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clear knowledge point bindings")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM node_resource_bindings WHERE node_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clear resource bindings")
		return
	}

	for _, v := range req.KnowledgePointIds {
		kpID, ok := v.(string)
		if !ok || kpID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id) VALUES ($1, $2)`, id, kpID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert knowledge point binding")
			return
		}
	}
	for _, v := range req.ResourceIds {
		resID, ok := v.(string)
		if !ok || resID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO node_resource_bindings (node_id, resource_id) VALUES ($1, $2)`, id, resID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert resource binding")
			return
		}
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
		SELECT n.id, n.course_id, n.parent_id, n.name, n.sort_order, n.ref_type, n.source_id, n.source_name,
			n.teaching_goals, n.duration, n.status
		FROM system_course_nodes n WHERE n.id = $1
	`, id).Scan(
		&base.ID, &base.CourseID, &base.ParentID, &base.Name, &base.SortOrder, &base.RefType, &base.SourceID, &base.SourceName,
		&base.TeachingGoals, &base.Duration, &base.Status,
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
			&n.ID, &n.CourseID, &n.ParentID, &n.Name, &n.SortOrder, &n.RefType, &n.SourceID, &n.SourceName,
			&n.TeachingGoals, &n.Duration, &n.Status,
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
			ID:            b.ID,
			CourseID:      b.CourseID,
			ParentID:      b.ParentID,
			Name:          b.Name,
			Order:         b.SortOrder,
			Type:          b.RefType,
			SourceID:      b.SourceID,
			SourceName:    b.SourceName,
			TeachingGoals: b.TeachingGoals,
			Duration:      b.Duration,
			Status:        b.Status,
		}
		nodeIndex[b.ID] = i
		nodeIDs = append(nodeIDs, b.ID)
	}

	if len(nodeIDs) == 0 {
		return items, nil
	}

	// knowledge points
	if rows, err := h.DB.Query(ctx, `
		SELECT nkb.node_id, kp.id, kp.name, kp.code, kp.description, kp.linked
		FROM node_knowledge_point_bindings nkb
		JOIN knowledge_points kp ON kp.id = nkb.knowledge_point_id
		WHERE nkb.node_id = ANY($1)
		ORDER BY kp.id ASC
	`, nodeIDs); err == nil {
		defer rows.Close()
		for rows.Next() {
			var nodeID string
			var kp SystemCourseNodeKnowledgePoint
			if err := rows.Scan(&nodeID, &kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked); err != nil {
				return nil, err
			}
			if idx, ok := nodeIndex[nodeID]; ok {
				items[idx].KnowledgePoints = append(items[idx].KnowledgePoints, kp)
			}
		}
	} else {
		return nil, err
	}

	// resources
	if rows, err := h.DB.Query(ctx, `
		SELECT nrb.node_id, nr.id, nr.name, nr.type, nr.url, nr.size
		FROM node_resource_bindings nrb
		JOIN node_resources nr ON nr.id = nrb.resource_id
		WHERE nrb.node_id = ANY($1)
		ORDER BY nr.id ASC
	`, nodeIDs); err == nil {
		defer rows.Close()
		for rows.Next() {
			var nodeID string
			var res SystemCourseNodeResource
			if err := rows.Scan(&nodeID, &res.ID, &res.Name, &res.Type, &res.URL, &res.Size); err != nil {
				return nil, err
			}
			if idx, ok := nodeIndex[nodeID]; ok {
				items[idx].Resources = append(items[idx].Resources, res)
			}
		}
	} else {
		return nil, err
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

	return items, nil
}
