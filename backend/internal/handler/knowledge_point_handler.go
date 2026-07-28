package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type KnowledgePointHandler struct {
	DB *pgxpool.Pool
}

type KnowledgePointListResponse struct {
	Items []domain.KnowledgePoint `json:"items"`
	Total int                     `json:"total"`
}

type CreateKnowledgePointRequest struct {
	Name              string           `json:"name"`
	Code              *string          `json:"code"`
	Description       *string          `json:"description"`
	Linked            bool             `json:"linked"`
	GranularLessonIds domain.JSONSlice `json:"granularLessonIds"`
}

type UpdateKnowledgePointRequest struct {
	Name              string           `json:"name"`
	Code              *string          `json:"code"`
	Description       *string          `json:"description"`
	Linked            bool             `json:"linked"`
	GranularLessonIds domain.JSONSlice `json:"granularLessonIds"`
}

func (h *KnowledgePointHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.KnowledgePoint]{
		Table:         "knowledge_points",
		SelectColumns: "id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if linkedStr := r.URL.Query().Get("linked"); linkedStr != "" {
				qb.addCondition("linked = " + qb.nextArg(linkedStr == "true"))
			}
			if creatorID := r.URL.Query().Get("creatorId"); creatorID != "" {
				qb.addCondition("creator_id = " + qb.nextArg(creatorID))
			}
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.scanKnowledgePointRows)
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
		} else {
			respondError(w, http.StatusInternalServerError, "failed to list knowledge points")
		}
		return
	}

	respondJSON(w, http.StatusOK, KnowledgePointListResponse{Items: items, Total: total})
}

func (h *KnowledgePointHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	kp, err := h.fetchKnowledgePoint(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "knowledge point not found")
		return
	}
	respondJSON(w, http.StatusOK, kp)
}

func (h *KnowledgePointHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateKnowledgePointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	creatorID := claims.UserID
	if req.GranularLessonIds == nil {
		req.GranularLessonIds = domain.JSONSlice{}
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO knowledge_points (id, tenant_id, name, code, description, linked, granular_lesson_ids, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, id, tenantID, req.Name, req.Code, req.Description, req.Linked, req.GranularLessonIds, creatorID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "知识点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create knowledge point")
		return
	}

	h.syncCourseKnowledgePoints(r.Context(), tenantID, id, jsonSliceToStringSlice(req.GranularLessonIds))

	kp, _ := h.fetchKnowledgePoint(r.Context(), id)
	respondJSON(w, http.StatusCreated, kp)
}

func (h *KnowledgePointHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "knowledge point not found")
		return
	}

	var req UpdateKnowledgePointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.GranularLessonIds == nil {
		req.GranularLessonIds = domain.JSONSlice{}
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE knowledge_points SET name = $1, code = $2, description = $3, linked = $4,
			granular_lesson_ids = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Name, req.Code, req.Description, req.Linked, req.GranularLessonIds, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "知识点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update knowledge point")
		return
	}

	h.syncCourseKnowledgePoints(r.Context(), tenantID, id, jsonSliceToStringSlice(req.GranularLessonIds))

	kp, _ := h.fetchKnowledgePoint(r.Context(), id)
	respondJSON(w, http.StatusOK, kp)
}

func (h *KnowledgePointHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "knowledge point not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM knowledge_points WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete knowledge point")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *KnowledgePointHandler) fetchKnowledgePoint(ctx context.Context, id string) (*domain.KnowledgePoint, error) {
	var kp domain.KnowledgePoint
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, created_at, updated_at
		FROM knowledge_points WHERE id = $1
	`, id).Scan(
		&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked, &kp.GranularLessonIds,
		&kp.CreatorID, &kp.CreatedAt, &kp.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &kp, nil
}

func (h *KnowledgePointHandler) scanKnowledgePointRows(rows pgx.Rows) ([]domain.KnowledgePoint, error) {
	items := make([]domain.KnowledgePoint, 0)
	for rows.Next() {
		var kp domain.KnowledgePoint
		if err := rows.Scan(
			&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked, &kp.GranularLessonIds,
			&kp.CreatorID, &kp.CreatedAt, &kp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, kp)
	}
	return items, nil
}

// syncCourseKnowledgePoints 维护颗粒课对当前知识点的双向引用：
// 将 knowledgePointID 加入所有关联颗粒课的 knowledge_point_ids，并从已移除关联的颗粒课中删除。
func (h *KnowledgePointHandler) syncCourseKnowledgePoints(ctx context.Context, tenantID, knowledgePointID string, courseIDs []string) {
	if tenantID == "" {
		return
	}
	_, _ = h.DB.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_append(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs)
	_, _ = h.DB.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_remove(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs)
}

func jsonSliceToStringSlice(ids domain.JSONSlice) []string {
	out := make([]string, 0, len(ids))
	for _, v := range ids {
		s, ok := v.(string)
		if !ok || s == "" {
			continue
		}
		out = append(out, s)
	}
	return out
}
