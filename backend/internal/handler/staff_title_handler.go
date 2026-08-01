package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type StaffTitleHandler struct {
	DB    *pgxpool.Pool
	Store *store.StaffTitlesStore
}

type StaffTitleListResponse struct {
	Items []domain.StaffTitle `json:"items"`
	Total int                 `json:"total"`
}

type CreateStaffTitleRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type UpdateStaffTitleRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type ToggleStaffTitleStatusRequest struct {
	Status string `json:"status"`
}

func (h *StaffTitleHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := listQueryConfig[domain.StaffTitle]{
		Table:         "staff_titles",
		SelectColumns: "id, tenant_id, code, name, description, user_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ScanRows:      h.Store.ScanRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询职称失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询职称失败")
		return
	}

	if len(items) > 0 {
		if tenantID, ok := tenantFilter(middleware.CurrentUser(r)); ok {
			ids := make([]string, len(items))
			for i := range items {
				ids[i] = items[i].ID
			}
			counts, _ := h.Store.BatchCountUsersByTitle(r.Context(), tenantID, ids)
			for i := range items {
				items[i].UserCount = counts[items[i].ID]
			}
		}
	}

	respondJSON(w, http.StatusOK, StaffTitleListResponse{Items: items, Total: total})
}

func (h *StaffTitleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	title, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}
	count, _ := h.Store.CountUserRefs(r.Context(), title.TenantID, id)
	title.UserCount = count
	respondJSON(w, http.StatusOK, title)
}

func (h *StaffTitleHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateStaffTitleRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.TenantID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	if req.Status == "" {
		req.Status = "active"
	}
	if req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	code := req.Code
	if code == "" {
		code = generateCodeFromName(req.Name)
	}

	id, err := h.Store.Create(r.Context(), store.StaffTitleCreateParams{
		TenantID:    req.TenantID,
		Code:        code,
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "职称代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建职称失败")
		return
	}

	title, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, title)
}

func (h *StaffTitleHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var req UpdateStaffTitleRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.Status != "" && req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	err = h.Store.Update(r.Context(), id, store.StaffTitleUpdateParams{
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新职称失败")
		return
	}

	title, _ = h.Store.GetByID(r.Context(), id)
	count, _ := h.Store.CountUserRefs(r.Context(), title.TenantID, id)
	title.UserCount = count
	respondJSON(w, http.StatusOK, title)
}

func (h *StaffTitleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	userCount, err := h.Store.CountUserRefs(r.Context(), title.TenantID, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "检查职称引用失败")
		return
	}
	if userCount > 0 {
		respondError(w, http.StatusConflict, "该职位仍有用户关联，不可删除")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除职称失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *StaffTitleHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var req ToggleStaffTitleStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	if err := h.Store.UpdateStatus(r.Context(), id, req.Status); err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	title, _ = h.Store.GetByID(r.Context(), id)
	count, _ := h.Store.CountUserRefs(r.Context(), title.TenantID, id)
	title.UserCount = count
	respondJSON(w, http.StatusOK, title)
}


func generateCodeFromName(name string) string {
	var b strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if b.Len() > 0 && b.String()[b.Len()-1] != '_' {
			b.WriteRune('_')
		}
	}
	code := strings.Trim(b.String(), "_")
	if code == "" {
		code = "title"
	}
	return code
}
