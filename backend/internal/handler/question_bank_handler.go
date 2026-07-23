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

type QuestionBankHandler struct {
	DB *pgxpool.Pool
}

type QuestionBankListResponse struct {
	Items []domain.QuestionBank `json:"items"`
	Total int                   `json:"total"`
}

type CreateQuestionBankRequest struct {
	Name                string   `json:"name"`
	Description         string   `json:"description"`
	CoverImage          *string  `json:"coverImage"`
	CollaboratorIDs     []string `json:"collaboratorIds"`
	CollaboratorDeptIDs []string `json:"collaboratorDeptIds"`
	KnowledgePointIds   []string `json:"knowledgePointIds"`
	BatchID             *string  `json:"batchId"`
}

func (h *QuestionBankHandler) List(w http.ResponseWriter, r *http.Request) {
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

	countQuery := "SELECT COUNT(*) FROM question_banks WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT qb.id, qb.name, qb.description, qb.cover_image, qb.status,
                (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS question_count,
                qb.creator_id,
			COALESCE((SELECT u.name FROM users u WHERE u.id = qb.creator_id), qb.creator_id::text) AS creator_name,
			qb.collaborator_ids,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool,
			(SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) AS knowledge_point_ids,
			qb.created_at, qb.updated_at
		FROM question_banks qb
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY qb.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list question banks")
		return
	}
	defer rows.Close()

	items, err := h.scanQuestionBankRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan question banks")
		return
	}

	respondJSON(w, http.StatusOK, QuestionBankListResponse{Items: items, Total: total})
}

func (h *QuestionBankHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	bank, err := h.fetchQuestionBank(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "question bank not found")
		return
	}
	respondJSON(w, http.StatusOK, bank)
}

func (h *QuestionBankHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateQuestionBankRequest
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
	creatorID := claims.UserID
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO question_banks (id, tenant_id, name, description, cover_image, status, question_count, creator_id,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, is_draft_pool)
		VALUES ($1, $2, $3, $4, $5, 'draft', 0, $6, $7, $8, $9, 'v1.0', 'mine', false)
	`, id, tenantID, req.Name, req.Description, req.CoverImage, creatorID, coalesceStringSlice(req.CollaboratorIDs), coalesceStringSlice(req.CollaboratorDeptIDs), req.BatchID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "题库名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create question bank")
		return
	}

	for _, kpID := range req.KnowledgePointIds {
		if kpID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO question_bank_knowledge_points (question_bank_id, knowledge_point_id)
			VALUES ($1, $2)
		`, id, kpID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert knowledge point binding")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	bank, _ := h.fetchQuestionBank(r.Context(), id)
	respondJSON(w, http.StatusCreated, bank)
}

func (h *QuestionBankHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchQuestionBank(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "question bank not found")
		return
	}

	var req CreateQuestionBankRequest
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
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}

	collaboratorIDs := req.CollaboratorIDs
	if collaboratorIDs == nil {
		collaboratorIDs = existing.CollaboratorIDs
	}
	collaboratorDeptIDs := req.CollaboratorDeptIDs
	if collaboratorDeptIDs == nil {
		collaboratorDeptIDs = existing.CollaboratorDeptIDs
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE question_banks SET name = $1, description = $2, cover_image = $3,
			collaborator_ids = $4, collaborator_dept_ids = $5, batch_id = $6, updated_at = NOW()
		WHERE id = $7
	`, req.Name, req.Description, req.CoverImage, collaboratorIDs, collaboratorDeptIDs, req.BatchID, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "题库名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update question bank")
		return
	}

	_, err = tx.Exec(r.Context(), `DELETE FROM question_bank_knowledge_points WHERE question_bank_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clear knowledge point bindings")
		return
	}
	for _, kpID := range req.KnowledgePointIds {
		if kpID == "" {
			continue
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO question_bank_knowledge_points (question_bank_id, knowledge_point_id)
			VALUES ($1, $2)
		`, id, kpID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert knowledge point binding")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	bank, _ := h.fetchQuestionBank(r.Context(), id)
	respondJSON(w, http.StatusOK, bank)
}

func (h *QuestionBankHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestionBank(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "question bank not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM question_banks WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete question bank")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *QuestionBankHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "question_banks",
		entityName: "question bank",
		targetType: "question_bank",
		inviteCol:  "collaborator_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchQuestionBank(ctx, id)
		},
	}
}

func (h *QuestionBankHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *QuestionBankHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *QuestionBankHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *QuestionBankHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *QuestionBankHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *QuestionBankHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *QuestionBankHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *QuestionBankHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *QuestionBankHandler) fetchQuestionBank(ctx context.Context, id string) (domain.QuestionBank, error) {
	var b domain.QuestionBank
	var coverImage, creatorID, batchID *string
	err := h.DB.QueryRow(ctx, `
		SELECT qb.id, qb.name, qb.description, qb.cover_image, qb.status,
                (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS question_count,
                qb.creator_id,
			COALESCE((SELECT u.name FROM users u WHERE u.id = qb.creator_id), qb.creator_id::text) AS creator_name,
			qb.collaborator_ids,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool,
			(SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) AS knowledge_point_ids,
			qb.created_at, qb.updated_at
		FROM question_banks qb WHERE qb.id = $1
	`, id).Scan(
		&b.ID, &b.Name, &b.Description, &coverImage, &b.Status, &b.QuestionCount, &creatorID,
		&b.CreatorName, &b.CollaboratorIDs, &b.CollaboratorNames,
		&b.CollaboratorDeptIDs, &batchID, &b.Version, &b.OwnerType, &b.IsDraftPool,
		&b.KnowledgePointIDs, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return b, err
	}
	b.CoverImage = coverImage
	b.CreatorID = creatorID
	b.BatchID = batchID
	return b, nil
}

func (h *QuestionBankHandler) scanQuestionBankRows(rows pgx.Rows) ([]domain.QuestionBank, error) {
	items := make([]domain.QuestionBank, 0)
	for rows.Next() {
		var b domain.QuestionBank
		var coverImage, creatorID, batchID *string
		if err := rows.Scan(
			&b.ID, &b.Name, &b.Description, &coverImage, &b.Status, &b.QuestionCount, &creatorID,
			&b.CreatorName, &b.CollaboratorIDs, &b.CollaboratorNames,
			&b.CollaboratorDeptIDs, &batchID, &b.Version, &b.OwnerType, &b.IsDraftPool,
			&b.KnowledgePointIDs, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		b.CoverImage = coverImage
		b.CreatorID = creatorID
		b.BatchID = batchID
		items = append(items, b)
	}
	return items, nil
}
