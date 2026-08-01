package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type KnowledgePointHandler struct {
	Service *service.LessonContentService
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
	SourceType        *string          `json:"sourceType"`
	SourceID          *string          `json:"sourceId"`
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

	cfg := store.ListQueryConfig[domain.KnowledgePoint]{
		Table:         "knowledge_points",
		SelectColumns: "id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if linkedStr := p.Values["linked"]; linkedStr != "" {
				qb.AddCondition("linked = " + qb.NextArg(linkedStr == "true"))
			}
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListKnowledgePoints(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询知识点失败")
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
	kp, err := h.Service.GetKnowledgePoint(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "知识点不存在")
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
	if !decodeBody(w, r, &req) {
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

	kp, err := h.Service.CreateKnowledgePoint(r.Context(), tenantID, &store.KnowledgePointCreateParams{
		Name:              req.Name,
		Code:              req.Code,
		Description:       req.Description,
		Linked:            req.Linked,
		GranularLessonIds: req.GranularLessonIds,
		CreatorID:         claims.UserID,
		SourceType:        req.SourceType,
		SourceID:          req.SourceID,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "知识点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建知识点失败")
		return
	}
	respondJSON(w, http.StatusCreated, kp)
}

func (h *KnowledgePointHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "知识点不存在")
		return
	}

	var req UpdateKnowledgePointRequest
	if !decodeBody(w, r, &req) {
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

	kp, err := h.Service.UpdateKnowledgePoint(r.Context(), tenantID, id, &store.KnowledgePointUpdateParams{
		Name:              req.Name,
		Code:              req.Code,
		Description:       req.Description,
		Linked:            req.Linked,
		GranularLessonIds: req.GranularLessonIds,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "知识点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新知识点失败")
		return
	}
	respondJSON(w, http.StatusOK, kp)
}

func (h *KnowledgePointHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "知识点不存在")
		return
	}

	if err := h.Service.DeleteKnowledgePoint(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除知识点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
