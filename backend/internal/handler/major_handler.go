package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type MajorHandler struct {
	DB    *pgxpool.Pool
	Store *store.MajorsStore
}

type MajorListResponse struct {
	Items []domain.Major `json:"items"`
	Total int            `json:"total"`
}

type CreateMajorRequest struct {
	TenantID string  `json:"tenantId"`
	Code     string  `json:"code"`
	Name     string  `json:"name"`
	Alias    *string `json:"alias"`
	Enabled  bool    `json:"enabled"`
}

type UpdateMajorRequest struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Alias   *string `json:"alias"`
	Enabled bool    `json:"enabled"`
}

func (h *MajorHandler) List(w http.ResponseWriter, r *http.Request) {
	enabledStr := r.URL.Query().Get("enabled")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.Major]{
		Table:         "majors",
		SelectColumns: "id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if enabledStr != "" {
				qb.addCondition("enabled = " + qb.nextArg(enabledStr == "true"))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询专业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询专业失败")
		return
	}

	respondJSON(w, http.StatusOK, MajorListResponse{Items: items, Total: total})
}

func (h *MajorHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	major, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "专业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, major)
}

func (h *MajorHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateMajorRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.TenantID == "" || req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	id, err := h.Store.Create(r.Context(), store.MajorCreateParams{
		TenantID: req.TenantID,
		Code:     req.Code,
		Name:     req.Name,
		Alias:    req.Alias,
		Enabled:  req.Enabled,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "专业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建专业失败")
		return
	}

	major, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, major)
}

func (h *MajorHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	major, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "专业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}

	var req UpdateMajorRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err = h.Store.Update(r.Context(), id, store.MajorUpdateParams{
		Code:    req.Code,
		Name:    req.Name,
		Alias:   req.Alias,
		Enabled: req.Enabled,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "专业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新专业失败")
		return
	}

	major, _ = h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, major)
}

func (h *MajorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	major, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "专业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}

	userCount, err := h.Store.CountUserRefs(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "检查专业引用失败")
		return
	}
	if userCount > 0 {
		respondError(w, http.StatusConflict, "该专业下仍有学生，请先将学生调整到其他专业")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除专业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
