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

type RandomDrawQuestionHandler struct {
	DB *pgxpool.Pool
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
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	search := r.URL.Query().Get("search")
	majorID := r.URL.Query().Get("majorId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 200
	offset := 0
	if v, err := parseInt(limitStr, 200); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if majorID != "" {
		where = append(where, "rdq.major_id = $"+itoa(argIdx))
		args = append(args, majorID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(rdq.name ILIKE $"+itoa(argIdx)+" OR rdq.description ILIKE $"+itoa(argIdx)+" OR m.name ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at
		FROM random_draw_questions rdq
		LEFT JOIN majors m ON m.id = rdq.major_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rdq.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list random draw questions")
		return
	}
	defer rows.Close()

	items, err := h.scanRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan random draw questions")
		return
	}

	respondJSON(w, http.StatusOK, RandomDrawQuestionListResponse{Items: items, Total: total})
}

func (h *RandomDrawQuestionHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	q, err := h.fetchQuestion(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "random draw question not found")
		return
	}
	respondJSON(w, http.StatusOK, q)
}

func (h *RandomDrawQuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateRandomDrawQuestionRequest
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
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO random_draw_questions (id, tenant_id, name, description, answer, major_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.Name, req.Description, req.Answer, req.MajorID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "现场问答题名称已存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create random draw question")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusCreated, q)
}

func (h *RandomDrawQuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "random draw question not found")
		return
	}

	var req UpdateRandomDrawQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE random_draw_questions SET name = $1, description = $2, answer = $3, major_id = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.Description, req.Answer, req.MajorID, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "现场问答题名称已存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update random draw question")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusOK, q)
}

func (h *RandomDrawQuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "random draw question not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM random_draw_questions WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete random draw question")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *RandomDrawQuestionHandler) fetchQuestion(ctx context.Context, id string) (domain.RandomDrawQuestion, error) {
	var q domain.RandomDrawQuestion
	var description, answer, majorID, majorName *string

	err := h.DB.QueryRow(ctx, `
		SELECT rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at
		FROM random_draw_questions rdq
		LEFT JOIN majors m ON m.id = rdq.major_id
		WHERE rdq.id = $1
	`, id).Scan(
		&q.ID, &q.Name, &description, &answer, &majorID, &majorName, &q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		return q, err
	}
	q.Description = description
	q.Answer = answer
	q.MajorID = majorID
	q.MajorName = majorName
	return q, nil
}

func (h *RandomDrawQuestionHandler) scanRows(rows pgx.Rows) ([]domain.RandomDrawQuestion, error) {
	items := make([]domain.RandomDrawQuestion, 0)
	for rows.Next() {
		var q domain.RandomDrawQuestion
		var description, answer, majorID, majorName *string
		if err := rows.Scan(
			&q.ID, &q.Name, &description, &answer, &majorID, &majorName, &q.CreatedAt, &q.UpdatedAt,
		); err != nil {
			return nil, err
		}
		q.Description = description
		q.Answer = answer
		q.MajorID = majorID
		q.MajorName = majorName
		items = append(items, q)
	}
	return items, nil
}
