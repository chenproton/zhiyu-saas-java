package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// Superadmin console handlers for /api/v1/admin/tenants.
// 按产品决策：内部隐藏控制台，不做鉴权，跨租户管理。

func (h *TenantHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	cfg := store.ListQueryConfig[domain.Tenant]{
		Table:         "tenants",
		SelectColumns: "id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, admin_ids, status, created_at, updated_at",
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, _ := listParamsFromRequest(r, false)
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询租户失败")
		return
	}
	respondJSON(w, http.StatusOK, TenantListResponse{Items: items, Total: total})
}

func (h *TenantHandler) AdminCreate(w http.ResponseWriter, r *http.Request) {
	var req CreateTenantRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Code == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	result, err := h.Service.CreateWithDefaults(r.Context(), &store.TenantCreateParams{
		Name:           req.Name,
		Code:           req.Code,
		LogoURL:        req.LogoURL,
		Domain:         req.Domain,
		EnterpriseCode: req.EnterpriseCode,
		Contact:        req.Contact,
		Phone:          req.Phone,
		Address:        req.Address,
		Description:    req.Description,
	})
	if err != nil {
		if service.IsConflict(err) {
			respondError(w, http.StatusConflict, "租户标识或管理员用户名已存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建租户失败")
		return
	}

	tenant, err := h.Service.Get(r.Context(), result.TenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建租户失败")
		return
	}
	respondJSON(w, http.StatusCreated, CreateTenantResponse{
		Tenant: *tenant,
		AdminUser: &adminUserInfo{
			ID:        result.AdminUserID,
			Username:  result.AdminUser,
			LoginName: result.AdminUser,
		},
	})
}

func (h *TenantHandler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Service.Get(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	var req UpdateTenantRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err := h.Service.Update(r.Context(), id, &store.TenantUpdateParams{
		Name:              req.Name,
		LogoURL:           req.LogoURL,
		Domain:            req.Domain,
		EnterpriseCode:    req.EnterpriseCode,
		Contact:           req.Contact,
		Phone:             req.Phone,
		Address:           req.Address,
		Description:       req.Description,
		ShortName:         req.ShortName,
		SchoolType:        req.SchoolType,
		Province:          req.Province,
		City:              req.City,
		Website:           req.Website,
		ContactPhone:      req.ContactPhone,
		ScaleData:         req.ScaleData,
		SecondaryColleges: req.SecondaryColleges,
		EducationLevel:    req.EducationLevel,
		EducationNature:   req.EducationNature,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新租户失败")
		return
	}

	tenant, _ := h.Service.Get(r.Context(), id)
	respondJSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) AdminUpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Service.Get(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	var req UpdateTenantStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Status != domain.TenantStatusActive && req.Status != domain.TenantStatusInactive {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	if err := h.Service.UpdateStatus(r.Context(), id, req.Status); err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	tenant, _ := h.Service.Get(r.Context(), id)
	respondJSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) AdminDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Service.Get(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	err := h.Service.DeleteTenant(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除租户失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "deleted": "true"})
}
