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

type OnSiteQuestionLibraryHandler struct {
	DB *pgxpool.Pool
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
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	search := r.URL.Query().Get("search")
	questionType := r.URL.Query().Get("questionType")
	difficulty := r.URL.Query().Get("difficulty")
	creatorID := r.URL.Query().Get("creatorId")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if search != "" {
		where = append(where, "(question_text ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if questionType != "" {
		where = append(where, "question_type = $"+itoa(argIdx))
		args = append(args, questionType)
		argIdx++
	}
	if difficulty != "" {
		where = append(where, "difficulty = $"+itoa(argIdx))
		args = append(args, difficulty)
		argIdx++
	}
	if creatorID != "" {
		where = append(where, "creator_id = $"+itoa(argIdx))
		args = append(args, creatorID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM on_site_question_library WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at
		FROM on_site_question_library
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list questions")
		return
	}
	defer rows.Close()

	items, err := h.scanQuestionRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan questions")
		return
	}

	respondJSON(w, http.StatusOK, OnSiteQuestionLibraryListResponse{Items: items, Total: total})
}

func (h *OnSiteQuestionLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "question not found")
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
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.QuestionText == "" {
		respondError(w, http.StatusBadRequest, "questionText is required")
		return
	}
	if req.QuestionType == "" {
		req.QuestionType = "short_answer"
	}
	if req.KnowledgePointIDs == nil {
		req.KnowledgePointIDs = []string{}
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	id := uuid.NewString()
	creatorID := claims.UserID
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, req.QuestionText, req.Answer, req.QuestionType, req.Score, req.Difficulty, req.KnowledgePointIDs, req.Tags, creatorID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create question")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *OnSiteQuestionLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "question not found")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateOnSiteQuestionLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	questionText := existing.QuestionText
	answer := existing.Answer
	questionType := existing.QuestionType
	score := existing.Score
	difficulty := existing.Difficulty
	knowledgePointIDs := existing.KnowledgePointIDs
	tags := existing.Tags

	if req.QuestionText != nil {
		questionText = *req.QuestionText
	}
	if req.Answer != nil {
		answer = req.Answer
	}
	if req.QuestionType != nil {
		questionType = *req.QuestionType
	}
	if req.Score != nil {
		score = *req.Score
	}
	if req.Difficulty != nil {
		difficulty = req.Difficulty
	}
	if req.KnowledgePointIDs != nil {
		knowledgePointIDs = req.KnowledgePointIDs
	}
	if req.Tags != nil {
		tags = req.Tags
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE on_site_question_library SET
			question_text = $1, answer = $2, question_type = $3, score = $4,
			difficulty = $5, knowledge_point_ids = $6, tags = $7, updated_at = NOW()
		WHERE id = $8
	`, questionText, answer, questionType, score, difficulty, knowledgePointIDs, tags, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update question")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *OnSiteQuestionLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "question not found")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM on_site_question_library WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete question")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *OnSiteQuestionLibraryHandler) fetchItem(ctx context.Context, id string) (domain.OnSiteQuestionLibraryItem, error) {
	var item domain.OnSiteQuestionLibraryItem
	var answer, difficulty, creatorID *string
	var knowledgePointIDs []string
	var tags []string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at
		FROM on_site_question_library WHERE id = $1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.QuestionText, &answer, &item.QuestionType,
		&item.Score, &difficulty, &knowledgePointIDs, &tags, &creatorID, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return item, err
	}
	item.Answer = answer
	item.Difficulty = difficulty
	item.KnowledgePointIDs = knowledgePointIDs
	item.Tags = tags
	item.CreatorID = creatorID
	return item, nil
}

func (h *OnSiteQuestionLibraryHandler) scanQuestionRows(rows pgx.Rows) ([]domain.OnSiteQuestionLibraryItem, error) {
	items := make([]domain.OnSiteQuestionLibraryItem, 0)
	for rows.Next() {
		var item domain.OnSiteQuestionLibraryItem
		var answer, difficulty, creatorID *string
		var knowledgePointIDs []string
		var tags []string
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.QuestionText, &answer, &item.QuestionType,
			&item.Score, &difficulty, &knowledgePointIDs, &tags, &creatorID, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.Answer = answer
		item.Difficulty = difficulty
		item.KnowledgePointIDs = knowledgePointIDs
		item.Tags = tags
		item.CreatorID = creatorID
		items = append(items, item)
	}
	return items, nil
}
