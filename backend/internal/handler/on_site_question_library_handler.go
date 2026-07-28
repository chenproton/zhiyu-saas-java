package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type OnSiteQuestionLibraryHandler struct {
	DB    *pgxpool.Pool
	Store *store.OnSiteQuestionLibraryStore
}

type OnSiteQuestionLibraryListResponse struct {
	Items []domain.OnSiteQuestionLibraryItem `json:"items"`
	Total int                                `json:"total"`
}

type CreateOnSiteQuestionLibraryRequest struct {
	QuestionText      string   `json:"questionText"`
	Answer            *string  `json:"answer"`
	QuestionType      string   `json:"questionType"`
	Score             float64  `json:"score"`
	Difficulty        *string  `json:"difficulty"`
	KnowledgePointIDs []string `json:"knowledgePointIds"`
	Tags              []string `json:"tags"`
}

type UpdateOnSiteQuestionLibraryRequest struct {
	QuestionText      *string  `json:"questionText"`
	Answer            *string  `json:"answer"`
	QuestionType      *string  `json:"questionType"`
	Score             *float64 `json:"score"`
	Difficulty        *string  `json:"difficulty"`
	KnowledgePointIDs []string `json:"knowledgePointIds"`
	Tags              []string `json:"tags"`
}

func (h *OnSiteQuestionLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.OnSiteQuestionLibraryItem](r.Context(), h.DB, r, listQueryConfig[domain.OnSiteQuestionLibraryItem]{
		Table:         "on_site_question_library",
		SelectColumns: "id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"question_text", "answer"},
		ScanRows:      h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询现场题库列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询现场题库列表失败")
		return
	}
	respondJSON(w, http.StatusOK, OnSiteQuestionLibraryListResponse{Items: items, Total: total})
}

func (h *OnSiteQuestionLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *OnSiteQuestionLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateOnSiteQuestionLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.QuestionText == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.Create(r.Context(), store.OnSiteQuestionLibraryCreateParams{
		TenantID:          tenantID,
		QuestionText:      req.QuestionText,
		Answer:            req.Answer,
		QuestionType:      req.QuestionType,
		Score:             req.Score,
		Difficulty:        req.Difficulty,
		KnowledgePointIDs: req.KnowledgePointIDs,
		Tags:              req.Tags,
		CreatorID:         claims.UserID,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建题目失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *OnSiteQuestionLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateOnSiteQuestionLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	q := existing.QuestionText
	if req.QuestionText != nil {
		q = *req.QuestionText
	}
	a := existing.Answer
	if req.Answer != nil {
		a = req.Answer
	}
	qt := existing.QuestionType
	if req.QuestionType != nil {
		qt = *req.QuestionType
	}
	s := existing.Score
	if req.Score != nil {
		s = *req.Score
	}
	d := existing.Difficulty
	if req.Difficulty != nil {
		d = req.Difficulty
	}
	kps := coalesceStringSlice(req.KnowledgePointIDs)
	if len(kps) == 0 {
		kps = existing.KnowledgePointIDs
	}
	ts := coalesceStringSlice(req.Tags)
	if len(ts) == 0 {
		ts = existing.Tags
	}

	err = h.Store.Update(r.Context(), id, store.OnSiteQuestionLibraryUpdateParams{
		QuestionText:      q,
		Answer:            a,
		QuestionType:      qt,
		Score:             s,
		Difficulty:        d,
		KnowledgePointIDs: kps,
		Tags:              ts,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新题目失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *OnSiteQuestionLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除题目失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
