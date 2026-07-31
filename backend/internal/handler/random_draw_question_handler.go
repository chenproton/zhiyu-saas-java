package handler

import (
	"context"
	"net/http"

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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	majorID := r.URL.Query().Get("majorId")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.RandomDrawQuestion]{
		Table:         "random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		SelectColumns: "rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at",
		TenantScoped:  false,
		SearchColumns: []string{"rdq.name", "rdq.description", "m.name"},
		DefaultLimit:  200,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if majorID != "" {
				qb.addCondition("rdq.major_id = " + qb.nextArg(majorID))
			}
		},
		ScanRows: h.scanRows,
	})
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
	q, err := h.fetchQuestion(r.Context(), id)
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
		respondError(w, http.StatusInternalServerError, "创建随机抽题失败")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusCreated, q)
}

func (h *RandomDrawQuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
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

	_, err := h.DB.Exec(r.Context(), `
		UPDATE random_draw_questions SET name = $1, description = $2, answer = $3, major_id = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.Description, req.Answer, req.MajorID, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "现场问答题名称已存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新随机抽题失败")
		return
	}

	q, _ := h.fetchQuestion(r.Context(), id)
	respondJSON(w, http.StatusOK, q)
}

func (h *RandomDrawQuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchQuestion(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "随机抽题不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM random_draw_questions WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除随机抽题失败")
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
