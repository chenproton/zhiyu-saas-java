package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RandomDrawQuestionHandler struct {
	Service *service.EvaluationService
}
type CreateRandomDrawQuestionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Answer      *string `json:"answer"`
	MajorID     *string `json:"majorId"`
}

type UpdateRandomDrawQuestionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Answer      *string `json:"answer"`
	MajorID     *string `json:"majorId"`
}

func (h *RandomDrawQuestionHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().RandomDrawQuestions().ListConfig()
	params, ok := listParamsFromRequest(r, false)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListRandomDrawQuestions(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.RandomDrawQuestion]{Items: items, Total: total})
}

func (h *RandomDrawQuestionHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	q, err := h.Service.GetRandomDrawQuestion(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "随机抽题不存在")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func (h *RandomDrawQuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateRandomDrawQuestionRequest
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

	q, err := h.Service.CreateRandomDrawQuestion(r.Context(), tenantID, &store.RandomDrawQuestionParams{
		Name:        req.Name,
		Description: req.Description,
		Answer:      req.Answer,
		MajorID:     req.MajorID,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "现场问答题名称已存在")
			return
		}
		respondServerError(w, r, err, "创建随机抽题失败")
		return
	}
	respondJSON(w, http.StatusCreated, q)
}

func (h *RandomDrawQuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetRandomDrawQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "随机抽题不存在")
		return
	}

	var req UpdateRandomDrawQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	q, err := h.Service.UpdateRandomDrawQuestion(r.Context(), id, &store.RandomDrawQuestionParams{
		Name:        req.Name,
		Description: req.Description,
		Answer:      req.Answer,
		MajorID:     req.MajorID,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "现场问答题名称已存在")
			return
		}
		respondServerError(w, r, err, "更新随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func (h *RandomDrawQuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetRandomDrawQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "随机抽题不存在")
		return
	}
	if err := h.Service.DeleteRandomDrawQuestion(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
