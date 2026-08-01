package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeQuizHandler struct {
	DB *pgxpool.Pool
}

type NodeQuizListResponse struct {
	Items []domain.NodeQuiz `json:"items"`
	Total int               `json:"total"`
}

type NodeQuizQuestionListResponse struct {
	Items []domain.NodeQuizQuestion `json:"items"`
	Total int                       `json:"total"`
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

type UpdateNodeQuizQuestionRequest struct {
	Type      string         `json:"type"`
	Question  string         `json:"question"`
	Options   domain.JSONMap `json:"options"`
	Answer    *string        `json:"answer"`
	Score     float64        `json:"score"`
	SortOrder int            `json:"sortOrder"`
}

func (h *NodeQuizHandler) ListQuizzes(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")

	items, total, err := executeListQuery(r.Context(), h.DB, r, store.ListQueryConfig[domain.NodeQuiz]{
		Table:         "node_quizzes",
		SelectColumns: "id, node_id, title, type, time_limit",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		NoPagination:  true,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if nodeID != "" {
				qb.AddCondition("node_id = " + qb.NextArg(nodeID))
			}
		},
		ScanRows: h.scanNodeQuizRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询测验失败")
		return
	}

	respondJSON(w, http.StatusOK, NodeQuizListResponse{Items: items, Total: total})
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.NodeID, req.Title, req.Type, req.TimeLimit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建测验失败")
		return
	}

	quiz, _ := h.fetchNodeQuiz(r.Context(), id)
	respondJSON(w, http.StatusCreated, quiz)
}

func (h *NodeQuizHandler) UpdateQuiz(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchNodeQuiz(r.Context(), id); err != nil {
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

	_, err := h.DB.Exec(r.Context(), `
		UPDATE node_quizzes SET title = $1, type = $2, time_limit = $3
		WHERE id = $4
	`, req.Title, req.Type, req.TimeLimit, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新测验失败")
		return
	}

	quiz, _ := h.fetchNodeQuiz(r.Context(), id)
	respondJSON(w, http.StatusOK, quiz)
}

func (h *NodeQuizHandler) DeleteQuiz(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchNodeQuiz(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `DELETE FROM node_quiz_questions WHERE quiz_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除测验题目失败")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM node_quizzes WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除测验失败")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
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
	if _, err := h.fetchNodeQuiz(r.Context(), quizID); err != nil {
		respondError(w, http.StatusNotFound, "测验不存在")
		return
	}

	countQuery := `SELECT COUNT(*) FROM node_quiz_questions WHERE quiz_id = $1`
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, quizID).Scan(&total)

	query := `
		SELECT id, quiz_id, type, question, options, answer, score, sort_order
		FROM node_quiz_questions
		WHERE quiz_id = $1
		ORDER BY sort_order ASC
	`
	rows, err := h.DB.Query(r.Context(), query, quizID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询题目失败")
		return
	}
	defer rows.Close()

	items, err := h.scanNodeQuizQuestionRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取题目失败")
		return
	}

	respondJSON(w, http.StatusOK, NodeQuizQuestionListResponse{Items: items, Total: total})
}

func (h *NodeQuizHandler) AddQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	quizID := chi.URLParam(r, "id")
	if _, err := h.fetchNodeQuiz(r.Context(), quizID); err != nil {
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, tenantID, quizID, req.Type, req.Question, req.Options, req.Answer, req.Score, req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "添加题目失败")
		return
	}

	question, _ := h.fetchNodeQuizQuestion(r.Context(), id)
	respondJSON(w, http.StatusCreated, question)
}

func (h *NodeQuizHandler) UpdateQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	questionID := chi.URLParam(r, "questionId")
	if _, err := h.fetchNodeQuizQuestion(r.Context(), questionID); err != nil {
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

	_, err := h.DB.Exec(r.Context(), `
		UPDATE node_quiz_questions SET type = $1, question = $2, options = $3, answer = $4,
			score = $5, sort_order = $6
		WHERE id = $7
	`, req.Type, req.Question, req.Options, req.Answer, req.Score, req.SortOrder, questionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新题目失败")
		return
	}

	question, _ := h.fetchNodeQuizQuestion(r.Context(), questionID)
	respondJSON(w, http.StatusOK, question)
}

func (h *NodeQuizHandler) DeleteQuestion(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	questionID := chi.URLParam(r, "questionId")
	if _, err := h.fetchNodeQuizQuestion(r.Context(), questionID); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM node_quiz_questions WHERE id = $1`, questionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除题目失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": questionID})
}

func (h *NodeQuizHandler) fetchNodeQuiz(ctx context.Context, id string) (*domain.NodeQuiz, error) {
	var q domain.NodeQuiz
	err := h.DB.QueryRow(ctx, `
		SELECT id, node_id, title, type, time_limit FROM node_quizzes WHERE id = $1
	`, id).Scan(&q.ID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func (h *NodeQuizHandler) fetchNodeQuizQuestion(ctx context.Context, id string) (*domain.NodeQuizQuestion, error) {
	var q domain.NodeQuizQuestion
	err := h.DB.QueryRow(ctx, `
		SELECT id, quiz_id, type, question, options, answer, score, sort_order
		FROM node_quiz_questions WHERE id = $1
	`, id).Scan(&q.ID, &q.QuizID, &q.Type, &q.Question, &q.Options, &q.Answer, &q.Score, &q.SortOrder)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func (h *NodeQuizHandler) scanNodeQuizRows(rows pgx.Rows) ([]domain.NodeQuiz, error) {
	items := make([]domain.NodeQuiz, 0)
	for rows.Next() {
		var q domain.NodeQuiz
		if err := rows.Scan(&q.ID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, nil
}

func (h *NodeQuizHandler) scanNodeQuizQuestionRows(rows pgx.Rows) ([]domain.NodeQuizQuestion, error) {
	items := make([]domain.NodeQuizQuestion, 0)
	for rows.Next() {
		var q domain.NodeQuizQuestion
		if err := rows.Scan(&q.ID, &q.QuizID, &q.Type, &q.Question, &q.Options, &q.Answer, &q.Score, &q.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, nil
}
