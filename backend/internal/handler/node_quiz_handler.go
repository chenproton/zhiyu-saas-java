package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeQuizHandler struct {
	Service *service.LessonContentService
}

type CreateNodeQuizRequest struct {
	NodeID    string `json:"nodeId"`
	Title     string `json:"title"`
	Type      string `json:"type"`
	TimeLimit *int   `json:"timeLimit"`
}

type UpdateNodeQuizRequest struct {
	Title     string `json:"title"`
	Type      string `json:"type"`
	TimeLimit *int   `json:"timeLimit"`
}

type CreateNodeQuizQuestionRequest struct {
	Type      string         `json:"type"`
	Question  string         `json:"question"`
	Options   domain.JSONMap `json:"options"`
	Answer    *string        `json:"answer"`
	Score     float64        `json:"score"`
	SortOrder int            `json:"sortOrder"`
}

type UpdateNodeQuizQuestionRequest = CreateNodeQuizQuestionRequest

func (h *NodeQuizHandler) ListQuizzes(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().NodeQuizzes().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListQuizzes(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询测验失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.NodeQuiz]{Items: items, Total: total})
}

func (h *NodeQuizHandler) CreateQuiz(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateNodeQuizRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" || req.Title == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	quiz, err := h.Service.CreateQuiz(r.Context(), tenantID, &store.NodeQuizParams{
		NodeID:    req.NodeID,
		Title:     req.Title,
		Type:      req.Type,
		TimeLimit: req.TimeLimit,
	})
	if err != nil {
		respondServerError(w, r, err, "创建测验失败")
		return
	}
	respondJSON(w, http.StatusCreated, quiz)
}

func (h *NodeQuizHandler) UpdateQuiz(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuiz(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	var req UpdateNodeQuizRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	quiz, err := h.Service.UpdateQuiz(r.Context(), id, &store.NodeQuizUpdateParams{
		Title:     req.Title,
		Type:      req.Type,
		TimeLimit: req.TimeLimit,
	})
	if err != nil {
		respondServerError(w, r, err, "更新测验失败")
		return
	}
	respondJSON(w, http.StatusOK, quiz)
}

func (h *NodeQuizHandler) DeleteQuiz(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuiz(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	if err := h.Service.DeleteQuiz(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除测验失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *NodeQuizHandler) ListQuestions(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	quizID := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuiz(r.Context(), quizID); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	items, total, err := h.Service.ListQuizQuestions(r.Context(), quizID)
	if err != nil {
		respondServerError(w, r, err, "查询题目失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.NodeQuizQuestion]{Items: items, Total: total})
}

func (h *NodeQuizHandler) AddQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	quizID := chi.URLParam(r, "id")
	if _, err := h.Service.GetQuiz(r.Context(), quizID); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	var req CreateNodeQuizQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Type == "" || req.Question == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	question, err := h.Service.AddQuizQuestion(r.Context(), tenantID, quizID, &store.NodeQuizQuestionParams{
		Type:      req.Type,
		Question:  req.Question,
		Options:   req.Options,
		Answer:    req.Answer,
		Score:     req.Score,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		respondServerError(w, r, err, "添加题目失败")
		return
	}
	respondJSON(w, http.StatusCreated, question)
}

func (h *NodeQuizHandler) UpdateQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	questionID := chi.URLParam(r, "questionId")
	if _, err := h.Service.GetQuizQuestion(r.Context(), questionID); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}

	var req UpdateNodeQuizQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Type == "" || req.Question == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	question, err := h.Service.UpdateQuizQuestion(r.Context(), questionID, &store.NodeQuizQuestionParams{
		Type:      req.Type,
		Question:  req.Question,
		Options:   req.Options,
		Answer:    req.Answer,
		Score:     req.Score,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		respondServerError(w, r, err, "更新题目失败")
		return
	}
	respondJSON(w, http.StatusOK, question)
}

func (h *NodeQuizHandler) DeleteQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	questionID := chi.URLParam(r, "questionId")
	if _, err := h.Service.GetQuizQuestion(r.Context(), questionID); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	if err := h.Service.DeleteQuizQuestion(r.Context(), questionID); err != nil {
		respondServerError(w, r, err, "删除题目失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": questionID})
}
