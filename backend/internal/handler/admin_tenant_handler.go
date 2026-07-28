package handler

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Superadmin console handlers for /api/v1/admin/tenants.
// 按产品决策：内部隐藏控制台，不做鉴权，跨租户管理。

func (h *TenantHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
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
		respondError(w, http.StatusInternalServerError, "查询租户失败")
		return
	}
	defer rows.Close()

	items, err := h.scanTenantRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取租户失败")
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

func (h *TenantHandler) AdminDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.fetchTenant(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	// 显式清理该租户下的用户，避免 tenant_id SET NULL 后留下孤儿账户
	if _, err := tx.Exec(r.Context(), `DELETE FROM users WHERE tenant_id = $1`, id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除租户用户失败")
		return
	}

	if _, err := tx.Exec(r.Context(), `DELETE FROM tenants WHERE id = $1`, id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除租户失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "deleted": "true"})
}
