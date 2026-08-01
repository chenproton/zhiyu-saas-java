package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ExamUsageHandler struct {
	DB *pgxpool.Pool
}

type ExamUsageListResponse struct {
	Items []domain.ExamUsage `json:"items"`
	Total int                `json:"total"`
}

type CreateExamUsageRequest struct {
	ExamID      string   `json:"examId"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	StartTime   *string  `json:"startTime"`
	EndTime     *string  `json:"endTime"`
	Duration    *int     `json:"duration"`
	TargetType  *string  `json:"targetType"`
	TargetIDs   []string `json:"targetIds"`
}

func (h *ExamUsageHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	examID := r.URL.Query().Get("examId")
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.ExamUsage](r.Context(), h.DB, r, listQueryConfig[domain.ExamUsage]{
		Table:         "exam_usages",
		SelectColumns: "id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if examID != "" {
				qb.addCondition("exam_id = " + qb.nextArg(examID))
			}
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.scanExamUsageRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询考试安排列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询考试安排列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ExamUsageListResponse{Items: items, Total: total})
}

func (h *ExamUsageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.fetchExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateExamUsageRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ExamID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
	`, id, tenantID, req.ExamID, req.Name, req.Description, req.StartTime, req.EndTime, req.Duration, req.TargetType, coalesceStringSlice(req.TargetIDs), claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建考试安排失败")
		return
	}

	usage, _ := h.fetchExamUsage(r.Context(), id)
	respondJSON(w, http.StatusCreated, usage)
}

func (h *ExamUsageHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.fetchExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}

	var req CreateExamUsageRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE exam_usages SET name = $1, description = $2, start_time = $3, end_time = $4,
			duration = $5, target_type = $6, target_ids = $7, updated_at = NOW()
		WHERE id = $8
	`, req.Name, req.Description, req.StartTime, req.EndTime, req.Duration, req.TargetType, coalesceStringSlice(req.TargetIDs), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新考试安排失败")
		return
	}

	usage, _ = h.fetchExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.fetchExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM exam_usages WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除考试安排失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ExamUsageHandler) Start(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.fetchExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE exam_usages SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开始考试安排失败")
		return
	}
	usage, _ = h.fetchExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Finish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.fetchExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE exam_usages SET status = 'finished', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "完成考试安排失败")
		return
	}
	usage, _ = h.fetchExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) fetchExamUsage(ctx context.Context, id string) (domain.ExamUsage, error) {
	var u domain.ExamUsage
	var description, targetType *string
	var startTime, endTime *time.Time
	var duration *int
	var creatorID *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id, created_at, updated_at
		FROM exam_usages WHERE id = $1
	`, id).Scan(
		&u.ID, &u.TenantID, &u.ExamID, &u.Name, &description, &startTime, &endTime, &duration, &targetType, &u.TargetIDs, &u.Status, &creatorID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return u, err
	}
	u.Description = description
	if startTime != nil {
		s := startTime.Format(time.RFC3339)
		u.StartTime = &s
	}
	if endTime != nil {
		s := endTime.Format(time.RFC3339)
		u.EndTime = &s
	}
	u.Duration = duration
	u.TargetType = targetType
	u.CreatorID = creatorID
	return u, nil
}

func (h *ExamUsageHandler) scanExamUsageRows(rows pgx.Rows) ([]domain.ExamUsage, error) {
	items := make([]domain.ExamUsage, 0)
	for rows.Next() {
		var u domain.ExamUsage
		var description, targetType *string
		var startTime, endTime *time.Time
		var duration *int
		var creatorID *string
		if err := rows.Scan(
			&u.ID, &u.TenantID, &u.ExamID, &u.Name, &description, &startTime, &endTime, &duration, &targetType, &u.TargetIDs, &u.Status, &creatorID, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		u.Description = description
		if startTime != nil {
			s := startTime.Format(time.RFC3339)
			u.StartTime = &s
		}
		if endTime != nil {
			s := endTime.Format(time.RFC3339)
			u.EndTime = &s
		}
		u.Duration = duration
		u.TargetType = targetType
		u.CreatorID = creatorID
		items = append(items, u)
	}
	return items, nil
}
