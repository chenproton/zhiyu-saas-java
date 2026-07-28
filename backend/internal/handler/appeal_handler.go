package handler

import (
	"errors"
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type AppealHandler struct {
	DB *pgxpool.Pool
}

type AppealListResponse struct {
	Items []domain.AppealRecord `json:"items"`
	Total int                   `json:"total"`
}

type CreateAppealRequest struct {
	UserID string `json:"userId"`
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

type ProcessAppealRequest struct {
	Status string  `json:"status"`
	Remark *string `json:"remark"`
}

func (h *AppealHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	appealType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.AppealRecord]{
		Table:         "appeal_records",
		SelectColumns: "id, user_id, type, reason, status, created_at",
		TenantScoped:  true,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if appealType != "" {
				qb.addCondition("type = " + qb.nextArg(appealType))
			}
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.scanAppealRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询申诉失败")
		return
	}

	respondJSON(w, http.StatusOK, AppealListResponse{Items: items, Total: total})
}

func (h *AppealHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	appeal, err := h.fetchAppeal(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "申诉不存在")
		return
	}
	respondJSON(w, http.StatusOK, appeal)
}

func (h *AppealHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.UserID == "" || req.Type == "" || req.Reason == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO appeal_records (id, tenant_id, user_id, type, reason, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
	`, id, tenantID, req.UserID, req.Type, req.Reason)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建申诉失败")
		return
	}

	appeal, _ := h.fetchAppeal(r.Context(), id)
	respondJSON(w, http.StatusCreated, appeal)
}

func (h *AppealHandler) Process(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req ProcessAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Status == "" {
		respondError(w, http.StatusBadRequest, "缺少状态")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE appeal_records SET status = $1 WHERE id = $2
	`, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "处理申诉失败")
		return
	}

	appeal, _ := h.fetchAppeal(r.Context(), id)
	respondJSON(w, http.StatusOK, appeal)
}

func (h *AppealHandler) fetchAppeal(ctx context.Context, id string) (domain.AppealRecord, error) {
	var a domain.AppealRecord
	err := h.DB.QueryRow(ctx, `
		SELECT id, user_id, type, reason, status, created_at
		FROM appeal_records WHERE id = $1
	`, id).Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt)
	return a, err
}

func (h *AppealHandler) scanAppealRows(rows pgx.Rows) ([]domain.AppealRecord, error) {
	items := make([]domain.AppealRecord, 0)
	for rows.Next() {
		var a domain.AppealRecord
		if err := rows.Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}
