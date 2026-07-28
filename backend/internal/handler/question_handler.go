package handler

import (
	"errors"
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

type QuestionHandler struct {
	DB *pgxpool.Pool
}

type QuestionListResponse struct {
	Items []domain.Question `json:"items"`
	Total int               `json:"total"`
}

type CreateQuestionRequest struct {
	BankID          string              `json:"bankId"`
	Type            domain.QuestionType `json:"type"`
	Content         string              `json:"content"`
	Options         []string            `json:"options"`
	Answer          domain.JSONSlice    `json:"answer"`
	Analysis        *string             `json:"analysis"`
	Score           float64             `json:"score"`
	Difficulty      *string             `json:"difficulty"`
	KnowledgePoints []string            `json:"knowledgePoints"`
	Source          *string             `json:"source"`
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

	cfg := listQueryConfig[domain.Question]{
		Table:         "questions",
		SelectColumns: "id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"content"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if bankID := r.URL.Query().Get("bankId"); bankID != "" {
				qb.addCondition("bank_id = " + qb.nextArg(bankID))
			}
			if qType := r.URL.Query().Get("type"); qType != "" {
				qb.addCondition("type = " + qb.nextArg(qType))
			}
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.scanQuestionRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, QuestionListResponse{Items: items, Total: total})
}

func (h *QuestionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	q, err := h.fetchQuestion(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func (h *QuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.BankID == "" || req.Content == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	code, err := generateUniqueEntityCode(r.Context(), h.DB, "TM", "questions", tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成题目编码失败")
		return
	}
	if req.Answer == nil {
		req.Answer = domain.JSONSlice{}
	}
	answerJSON, _ := json.Marshal(req.Answer)
	optionsJSON, _ := json.Marshal(coalesceStringSlice(req.Options))
	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
	`, id, tenantID, code, req.BankID, req.Type, req.Content, string(optionsJSON), string(answerJSON), req.Analysis, req.Score, req.Difficulty, coalesceStringSlice(req.KnowledgePoints), claims.UserID, req.Source)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建题目失败")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusCreated, q)
}

func (h *QuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}

	var req CreateQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Content == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.Answer == nil {
		req.Answer = domain.JSONSlice{}
	}
	answerJSON, _ := json.Marshal(req.Answer)
	optionsJSON, _ := json.Marshal(coalesceStringSlice(req.Options))

	setClauses := []string{
		"type = $1",
		"content = $2",
		"options = $3",
		"answer = $4",
		"analysis = $5",
		"score = $6",
		"difficulty = $7",
		"knowledge_point_ids = $8",
		"source = $9",
	}
	args := []interface{}{req.Type, req.Content, string(optionsJSON), string(answerJSON), req.Analysis, req.Score, req.Difficulty, coalesceStringSlice(req.KnowledgePoints), req.Source}
	argIdx := 10
	if req.BankID != "" {
		setClauses = append(setClauses, "bank_id = $"+itoa(argIdx))
		args = append(args, req.BankID)
		argIdx++
	}
	args = append(args, id)

	_, err := h.DB.Exec(r.Context(), `
		UPDATE questions SET `+strings.Join(setClauses, ", ")+`
		WHERE id = $`+itoa(argIdx)+`
	`, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新题目失败")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusOK, q)
}

func (h *QuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "题目不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM questions WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除题目失败")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.BankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	tenantID, ok := requireTenant(w, r); if !ok { return }

	count := 0
	for _, item := range req.Items {
		if item.Content == "" || item.Type == "" {
			continue
		}
		if item.Answer == nil {
			item.Answer = domain.JSONSlice{}
		}
		answerJSON, _ := json.Marshal(item.Answer)
		optionsJSON, _ := json.Marshal(coalesceStringSlice(item.Options))
		id := uuid.NewString()
		code := generateEntityCode("TM")
		_, err := tx.Exec(r.Context(), `
			INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
		`, id, tenantID, code, req.BankID, item.Type, item.Content, string(optionsJSON), string(answerJSON), item.Analysis, item.Score, item.Difficulty, coalesceStringSlice(item.KnowledgePoints), claims.UserID, item.Source)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "批量创建题目失败")
			return
		}
		count++
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *QuestionHandler) fetchQuestion(ctx context.Context, id string) (domain.Question, error) {
	var q domain.Question
	var analysis, difficulty, creatorID, source, answerStr, optionsStr *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at
		FROM questions WHERE id = $1
	`, id).Scan(
		&q.ID, &q.Code, &q.BankID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis, &q.Score, &difficulty, &q.KnowledgePoints, &creatorID, &source, &q.Status, &q.CreatedAt,
	)
	if err != nil {
		return q, err
	}
	q.Analysis = analysis
	q.Difficulty = difficulty
	q.CreatorID = creatorID
	q.Source = source
	if answerStr != nil {
		_ = json.Unmarshal([]byte(*answerStr), &q.Answer)
	}
	if q.Answer == nil {
		q.Answer = domain.JSONSlice{}
	}
	if optionsStr != nil {
		_ = json.Unmarshal([]byte(*optionsStr), &q.Options)
	}
	return q, nil
}

func (h *QuestionHandler) scanQuestionRows(rows pgx.Rows) ([]domain.Question, error) {
	items := make([]domain.Question, 0)
	for rows.Next() {
		var q domain.Question
		var analysis, difficulty, creatorID, source, answerStr, optionsStr *string
		if err := rows.Scan(
			&q.ID, &q.Code, &q.BankID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis, &q.Score, &difficulty, &q.KnowledgePoints, &creatorID, &source, &q.Status, &q.CreatedAt,
		); err != nil {
			return nil, err
		}
		q.Analysis = analysis
		q.Difficulty = difficulty
		q.CreatorID = creatorID
		q.Source = source
		if answerStr != nil {
			_ = json.Unmarshal([]byte(*answerStr), &q.Answer)
		}
		if q.Answer == nil {
			q.Answer = domain.JSONSlice{}
		}
		if optionsStr != nil {
			_ = json.Unmarshal([]byte(*optionsStr), &q.Options)
		}
		items = append(items, q)
	}
	return items, nil
}
