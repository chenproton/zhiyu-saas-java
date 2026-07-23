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

type ExamHandler struct {
	DB *pgxpool.Pool
}

type ExamListResponse struct {
	Items []domain.Exam `json:"items"`
	Total int           `json:"total"`
}

type CreateExamRequest struct {
	Name                string   `json:"name"`
	Description         string   `json:"description"`
	Duration            int      `json:"duration"`
	CoverImage          *string  `json:"coverImage"`
	CollaboratorIDs     []string `json:"collaboratorIds"`
	CollaboratorDeptIDs []string `json:"collaboratorDeptIds"`
	BatchID             *string  `json:"batchId"`
}

type AddExamQuestionRequest struct {
	QuestionID string  `json:"questionId"`
	Score      float64 `json:"score"`
}

func (h *ExamHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR description ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM exams WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT e.id, e.name, e.description, e.status, e.total_score, e.duration, e.cover_image,
			e.collaborator_ids,
			COALESCE((SELECT u.name FROM users u WHERE u.id = e.creator_id), e.creator_id::text) AS creator_name,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(e.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			e.collaborator_dept_ids, e.batch_id, e.version, e.owner_type, e.creator_id, e.created_at, e.updated_at
		FROM exams e
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY e.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list exams")
		return
	}
	defer rows.Close()

	items, err := h.scanExamRows(r.Context(), rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan exams")
		return
	}

	respondJSON(w, http.StatusOK, ExamListResponse{Items: items, Total: total})
}

func (h *ExamHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	exam, err := h.fetchExam(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "exam not found")
		return
	}
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id)
		VALUES ($1, $2, $3, $4, 'draft', 0, $5, $6, $7, $8, $9, 'v1.0', 'mine', $10)
	`, id, tenantID, req.Name, req.Description, req.Duration, req.CoverImage, coalesceStringSlice(req.CollaboratorIDs), coalesceStringSlice(req.CollaboratorDeptIDs), req.BatchID, claims.UserID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "考试名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create exam")
		return
	}

	exam, _ := h.fetchExam(r.Context(), id)
	respondJSON(w, http.StatusCreated, exam)
}

func (h *ExamHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchExam(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "exam not found")
		return
	}

	var req CreateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Description == "" {
		req.Description = existing.Description
	}
	if req.Duration == 0 {
		req.Duration = existing.Duration
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	if req.BatchID == nil {
		req.BatchID = existing.BatchID
	}

	collaboratorIDs := req.CollaboratorIDs
	if collaboratorIDs == nil {
		collaboratorIDs = existing.CollaboratorIDs
	}
	collaboratorDeptIDs := req.CollaboratorDeptIDs
	if collaboratorDeptIDs == nil {
		collaboratorDeptIDs = existing.CollaboratorDeptIDs
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE exams SET name = $1, description = $2, duration = $3, cover_image = $4,
			collaborator_ids = $5, collaborator_dept_ids = $6, batch_id = $7, updated_at = NOW()
		WHERE id = $8
	`, req.Name, req.Description, req.Duration, req.CoverImage, collaboratorIDs, collaboratorDeptIDs, req.BatchID, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "考试名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update exam")
		return
	}

	exam, _ := h.fetchExam(r.Context(), id)
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchExam(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "exam not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM exams WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete exam")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ExamHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "exams",
		entityName: "exam",
		targetType: "exam",
		inviteCol:  "collaborator_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchExam(ctx, id)
		},
	}
}

func (h *ExamHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *ExamHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *ExamHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *ExamHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *ExamHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ExamHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ExamHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *ExamHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *ExamHandler) AddQuestion(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchExam(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "exam not found")
		return
	}

	var req AddExamQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.QuestionID == "" {
		respondError(w, http.StatusBadRequest, "missing question id")
		return
	}

	var q domain.Question
	var analysis, optionsStr, answerStr *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, type, content, options, answer, analysis, score FROM questions WHERE id = $1
	`, req.QuestionID).Scan(&q.ID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis, &q.Score)
	if err != nil {
		respondError(w, http.StatusNotFound, "question not found")
		return
	}
	q.Analysis = analysis
	if optionsStr != nil {
		_ = json.Unmarshal([]byte(*optionsStr), &q.Options)
	}
	if answerStr != nil {
		_ = json.Unmarshal([]byte(*answerStr), &q.Answer)
	}
	if q.Answer == nil {
		q.Answer = domain.JSONSlice{}
	}

	score := req.Score
	if score == 0 {
		score = q.Score
	}

	optionsJSON, _ := json.Marshal(q.Options)
	answerJSON, _ := json.Marshal(q.Answer)

	tenantID, ok := requireTenant(w, r); if !ok { return }

	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM exam_questions WHERE exam_id = $3))
	`, uuid.NewString(), tenantID, id, q.ID, q.Type, q.Content, string(optionsJSON), string(answerJSON), q.Analysis, score)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to add question")
		return
	}

	_ = h.recalcExamTotal(r.Context(), id)
	exam, _ := h.fetchExam(r.Context(), id)
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) RemoveQuestion(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	questionID := chi.URLParam(r, "questionId")
	if _, err := h.fetchExam(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "exam not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, id, questionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to remove question")
		return
	}

	_ = h.recalcExamTotal(r.Context(), id)
	exam, _ := h.fetchExam(r.Context(), id)
	respondJSON(w, http.StatusOK, exam)
}

type UpdateExamQuestionScoreRequest struct {
	Score float64 `json:"score"`
}

func (h *ExamHandler) UpdateQuestionScore(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	examID := chi.URLParam(r, "id")
	questionID := chi.URLParam(r, "questionId")

	var req UpdateExamQuestionScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Score <= 0 {
		respondError(w, http.StatusBadRequest, "score must be positive")
		return
	}

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE exam_questions SET score = $1 WHERE exam_id = $2 AND question_id = $3
	`, req.Score, examID, questionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update question score")
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(w, http.StatusNotFound, "question not found in exam")
		return
	}

	_ = h.recalcExamTotal(r.Context(), examID)
	exam, _ := h.fetchExam(r.Context(), examID)
	respondJSON(w, http.StatusOK, exam)
}

type BulkUpdateScoresRequest map[string]float64

func (h *ExamHandler) BulkUpdateScores(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	examID := chi.URLParam(r, "id")

	var req BulkUpdateScoresRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req) == 0 {
		respondError(w, http.StatusBadRequest, "scores map must not be empty")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	for questionID, score := range req {
		if score <= 0 {
			respondError(w, http.StatusBadRequest, "score must be positive")
			return
		}
		tag, err := tx.Exec(r.Context(), `
			UPDATE exam_questions SET score = $1 WHERE exam_id = $2 AND question_id = $3
		`, score, examID, questionID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update question score")
			return
		}
		if tag.RowsAffected() == 0 {
			respondError(w, http.StatusNotFound, "question not found in exam: "+questionID)
			return
		}
	}

	if _, err := tx.Exec(r.Context(), `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to recalc exam total")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	exam, _ := h.fetchExam(r.Context(), examID)
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) recalcExamTotal(ctx context.Context, examID string) error {
	_, err := h.DB.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID)
	return err
}

func (h *ExamHandler) fetchExam(ctx context.Context, id string) (domain.Exam, error) {
	var e domain.Exam
	var coverImage, creatorID, batchID *string
	err := h.DB.QueryRow(ctx, `
		SELECT e.id, e.name, e.description, e.status, e.total_score, e.duration, e.cover_image,
			e.collaborator_ids,
			COALESCE((SELECT u.name FROM users u WHERE u.id = e.creator_id), e.creator_id::text) AS creator_name,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(e.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			e.collaborator_dept_ids, e.batch_id, e.version, e.owner_type, e.creator_id, e.created_at, e.updated_at
		FROM exams e WHERE e.id = $1
	`, id).Scan(
		&e.ID, &e.Name, &e.Description, &e.Status, &e.TotalScore, &e.Duration, &coverImage,
		&e.CollaboratorIDs, &e.CreatorName, &e.CollaboratorNames, &e.CollaboratorDeptIDs, &batchID, &e.Version, &e.OwnerType, &creatorID, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return e, err
	}
	e.CoverImage = coverImage
	e.CreatorID = creatorID
	e.BatchID = batchID
	e.Questions, _ = h.fetchExamQuestions(ctx, id)
	return e, nil
}

func (h *ExamHandler) fetchExamQuestions(ctx context.Context, examID string) ([]domain.ExamQuestion, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order
		FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order
	`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.ExamQuestion, 0)
	for rows.Next() {
		var q domain.ExamQuestion
		var analysis, optionsStr, answerStr *string
		if err := rows.Scan(&q.ID, &q.ExamID, &q.QuestionID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis, &q.Score, &q.Order); err != nil {
			return nil, err
		}
		q.Analysis = analysis
		if optionsStr != nil {
			_ = json.Unmarshal([]byte(*optionsStr), &q.Options)
		}
		if answerStr != nil {
			_ = json.Unmarshal([]byte(*answerStr), &q.Answer)
		}
		if q.Answer == nil {
			q.Answer = domain.JSONSlice{}
		}
		items = append(items, q)
	}
	return items, nil
}

func (h *ExamHandler) scanExamRows(ctx context.Context, rows pgx.Rows) ([]domain.Exam, error) {
	items := make([]domain.Exam, 0)
	for rows.Next() {
		var e domain.Exam
		var coverImage, creatorID, batchID *string
		if err := rows.Scan(
			&e.ID, &e.Name, &e.Description, &e.Status, &e.TotalScore, &e.Duration, &coverImage,
			&e.CollaboratorIDs, &e.CreatorName, &e.CollaboratorNames, &e.CollaboratorDeptIDs, &batchID, &e.Version, &e.OwnerType, &creatorID, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		e.CoverImage = coverImage
		e.CreatorID = creatorID
		e.BatchID = batchID
		e.Questions, _ = h.fetchExamQuestions(ctx, e.ID)
		items = append(items, e)
	}
	return items, nil
}
