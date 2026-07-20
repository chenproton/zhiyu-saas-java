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
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	search := r.URL.Query().Get("search")
	linkedStr := r.URL.Query().Get("linked")
	creatorID := r.URL.Query().Get("creatorId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

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

	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if linkedStr != "" {
		where = append(where, "linked = $"+itoa(argIdx))
		args = append(args, linkedStr == "true")
		argIdx++
	}
	if creatorID != "" {
		where = append(where, "creator_id = $"+itoa(argIdx))
		args = append(args, creatorID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM knowledge_points WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, code, description, linked, granular_lesson_ids, creator_id, created_at, updated_at
		FROM knowledge_points
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list knowledge points")
		return
	}
	defer rows.Close()

	items, err := h.scanKnowledgePointRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan knowledge points")
		return
	}

	respondJSON(w, http.StatusOK, KnowledgePointListResponse{Items: items, Total: total})
}

func (h *KnowledgePointHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
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
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateKnowledgePointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
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

	kp, _ := h.fetchKnowledgePoint(r.Context(), id)
	respondJSON(w, http.StatusCreated, kp)
}

func (h *KnowledgePointHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "knowledge point not found")
		return
	}

	var req UpdateKnowledgePointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.GranularLessonIds == nil {
		req.GranularLessonIds = domain.JSONSlice{}
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

	kp, _ := h.fetchKnowledgePoint(r.Context(), id)
	respondJSON(w, http.StatusOK, kp)
}

func (h *KnowledgePointHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
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
		SELECT id, name, code, description, linked, granular_lesson_ids, creator_id, created_at, updated_at
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
