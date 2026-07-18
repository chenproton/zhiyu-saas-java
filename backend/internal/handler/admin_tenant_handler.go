package handler

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// Superadmin console handlers for /api/v1/admin/tenants.
// 按产品决策：内部隐藏控制台，不做鉴权，跨租户管理。

func (h *TenantHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")

	limit := 50
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM tenants WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, admin_ids, status, created_at, updated_at
		FROM tenants
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list tenants")
		return
	}
	defer rows.Close()

	items, err := h.scanTenantRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan tenants")
		return
	}

	respondJSON(w, http.StatusOK, TenantListResponse{Items: items, Total: total})
}

func (h *TenantHandler) AdminCreate(w http.ResponseWriter, r *http.Request) {
	h.createTenant(w, r)
}

func (h *TenantHandler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	h.updateTenant(w, r)
}

func (h *TenantHandler) AdminUpdateStatus(w http.ResponseWriter, r *http.Request) {
	h.updateTenantStatus(w, r)
}

// AdminDelete 不再物理删除租户及其数据，仅将租户状态置为 inactive，
// 后续可通过 AdminUpdateStatus 恢复为 active 继续使用。
func (h *TenantHandler) AdminDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.fetchTenant(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	if _, err := h.DB.Exec(r.Context(), `UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2`, domain.TenantStatusInactive, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to deactivate tenant")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "status": string(domain.TenantStatusInactive)})
}
