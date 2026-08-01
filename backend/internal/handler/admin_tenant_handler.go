package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// Superadmin console handlers for /api/v1/admin/tenants.
// 按产品决策：内部隐藏控制台，不做鉴权，跨租户管理。

func (h *TenantHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.Tenant](r.Context(), h.DB, r, store.ListQueryConfig[domain.Tenant]{
		Table:         "tenants",
		SelectColumns: "id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, admin_ids, status, created_at, updated_at",
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}, h.scanTenantRows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询租户失败")
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
