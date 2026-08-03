package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionHandler struct {
	Service *service.EvaluationService
}
type CreateQuestionRequest struct {
	BankID          string           `json:"bankId"`
	Type            string           `json:"type"`
	Content         string           `json:"content"`
	Options         []string         `json:"options"`
	Answer          domain.JSONSlice `json:"answer"`
	Analysis        *string          `json:"analysis"`
	Score           float64          `json:"score"`
	Difficulty      *string          `json:"difficulty"`
	KnowledgePoints []string         `json:"knowledgePoints"`
	Source          *string          `json:"source"`
}

type BatchCreateQuestionsRequest struct {
	BankID string                  `json:"bankId"`
	Items  []CreateQuestionRequest `json:"items"`
}

func (h *QuestionHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Questions().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListQuestions(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询题目列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Question]{Items: items, Total: total})
}

func (h *QuestionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	q, err := h.Service.GetQuestion(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func marshalJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func (h *QuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.BankID == "" || req.Content == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if req.Answer == nil {
		req.Answer = domain.JSONSlice{}
	}

	code, err := h.Service.GenerateEntityCode(r.Context(), "TM", "questions", tenantID)
	if err != nil {
		respondServerError(w, r, err, "生成题目编码失败")
		return
	}

	q, err := h.Service.CreateQuestion(r.Context(), tenantID, &store.QuestionCreateParams{
		Code:            code,
		BankID:          req.BankID,
		Type:            req.Type,
		Content:         req.Content,
		OptionsJSON:     marshalJSON(coalesceStringSlice(req.Options)),
		AnswerJSON:      marshalJSON(req.Answer),
		Analysis:        req.Analysis,
		Score:           req.Score,
		Difficulty:      req.Difficulty,
		KnowledgePoints: coalesceStringSlice(req.KnowledgePoints),
		CreatorID:       claims.UserID,
		Source:          req.Source,
	})
	if err != nil {
		respondServerError(w, r, err, "创建题目失败")
		return
	}
	respondJSON(w, http.StatusCreated, q)
}

func (h *QuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuestion(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}

	var req CreateQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Content == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Answer == nil {
		req.Answer = domain.JSONSlice{}
	}

	q, err := h.Service.UpdateQuestion(r.Context(), id, tenantID, &store.QuestionUpdateParams{
		BankID:          req.BankID,
		Type:            req.Type,
		Content:         req.Content,
		OptionsJSON:     marshalJSON(coalesceStringSlice(req.Options)),
		AnswerJSON:      marshalJSON(req.Answer),
		Analysis:        req.Analysis,
		Score:           req.Score,
		Difficulty:      req.Difficulty,
		KnowledgePoints: coalesceStringSlice(req.KnowledgePoints),
		Source:          req.Source,
	})
	if err != nil {
		respondServerError(w, r, err, "更新题目失败")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func (h *QuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuestion(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	if err := h.Service.DeleteQuestion(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除题目失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *QuestionHandler) BatchCreate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req BatchCreateQuestionsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.BankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	items := make([]store.QuestionCreateParams, 0, len(req.Items))
	for _, item := range req.Items {
		if item.Answer == nil {
			item.Answer = domain.JSONSlice{}
		}
		items = append(items, store.QuestionCreateParams{
			BankID:          req.BankID,
			Type:            item.Type,
			Content:         item.Content,
			OptionsJSON:     marshalJSON(coalesceStringSlice(item.Options)),
			AnswerJSON:      marshalJSON(item.Answer),
			Analysis:        item.Analysis,
			Score:           item.Score,
			Difficulty:      item.Difficulty,
			KnowledgePoints: coalesceStringSlice(item.KnowledgePoints),
			CreatorID:       claims.UserID,
			Source:          item.Source,
		})
	}

	count, err := h.Service.BatchCreateQuestions(r.Context(), tenantID, req.BankID, claims.UserID, items)
	if err != nil {
		respondServerError(w, r, err, "批量创建题目失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}
