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

type RandomDrawQuestionListResponse struct {
	Items []domain.RandomDrawQuestion `json:"items"`
	Total int                         `json:"total"`
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

	majorID := r.URL.Query().Get("majorId")

	cfg := store.ListQueryConfig[domain.RandomDrawQuestion]{
		Table:         "random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		SelectColumns: "rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at",
		TenantScoped:  false,
		SearchColumns: []string{"rdq.name", "rdq.description", "m.name"},
		DefaultLimit:  200,
		ScanRows:      store.ScanRandomDrawQuestionRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if majorID != "" {
				qb.AddCondition("rdq.major_id = " + qb.NextArg(majorID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, false)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListRandomDrawQuestions(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, RandomDrawQuestionListResponse{Items: items, Total: total})
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
		respondError(w, http.StatusInternalServerError, "创建随机抽题失败")
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
		respondError(w, http.StatusInternalServerError, "更新随机抽题失败")
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
		respondError(w, http.StatusInternalServerError, "删除随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
