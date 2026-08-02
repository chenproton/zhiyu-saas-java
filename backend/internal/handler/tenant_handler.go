package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TenantHandler struct {
	Service      *service.TenantService
	AdminService *service.TenantAdminService
}
type CreateTenantRequest struct {
	Name           string  `json:"name"`
	Code           string  `json:"code"`
	LogoURL        *string `json:"logoUrl"`
	Domain         *string `json:"domain"`
	EnterpriseCode *string `json:"enterpriseCode"`
	Contact        *string `json:"contact"`
	Phone          *string `json:"phone"`
	Address        *string `json:"address"`
	Description    *string `json:"description"`
}

type UpdateTenantRequest struct {
	Name              string          `json:"name"`
	LogoURL           *string         `json:"logoUrl"`
	Domain            *string         `json:"domain"`
	EnterpriseCode    *string         `json:"enterpriseCode"`
	Contact           *string         `json:"contact"`
	Phone             *string         `json:"phone"`
	Address           *string         `json:"address"`
	Description       *string         `json:"description"`
	ShortName         *string         `json:"shortName"`
	SchoolType        *string         `json:"schoolType"`
	Province          *string         `json:"province"`
	City              *string         `json:"city"`
	Website           *string         `json:"website"`
	ContactPhone      *string         `json:"contactPhone"`
	ScaleData         json.RawMessage `json:"scaleData"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges"`
	EducationLevel    *string         `json:"educationLevel"`
	EducationNature   *string         `json:"educationNature"`
}

type UpdateTenantStatusRequest struct {
	Status domain.TenantStatus `json:"status"`
}

type CreateTenantResponse struct {
	Tenant    domain.Tenant  `json:"tenant"`
	AdminUser *adminUserInfo `json:"adminUser,omitempty"`
}

type adminUserInfo struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	LoginName string `json:"loginName"`
}

func (h *TenantHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := store.ListQueryConfig[domain.Tenant]{
		Table:         "tenants",
		SelectColumns: "id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, admin_ids, status, created_at, updated_at",
		TenantScoped:  true,
		TenantColumn:  "id",
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, cfg.TenantScoped)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询租户列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Tenant]{Items: items, Total: total})
}

func (h *TenantHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		if claims == nil || claims.TenantID == nil || *claims.TenantID != tenant.ID {
			respondError(w, http.StatusForbidden, "只能查看自己的租户")
			return
		}
	}
	respondJSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

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
		respondServerError(w, r, err, "创建租户失败")
		return
	}

	tenant, err := h.Service.Get(r.Context(), result.TenantID)
	if err != nil {
		respondServerError(w, r, err, "创建租户失败")
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

func (h *TenantHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) && !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if !canManagePlatform(claims) {
		if claims.TenantID == nil || *claims.TenantID != id {
			respondError(w, http.StatusForbidden, "只能更新自己的租户")
			return
		}
	}

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
		respondServerError(w, r, err, "更新租户失败")
		return
	}

	tenant, _ := h.Service.Get(r.Context(), id)
	respondJSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

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
		respondServerError(w, r, err, "更新状态失败")
		return
	}

	tenant, _ := h.Service.Get(r.Context(), id)
	respondJSON(w, http.StatusOK, tenant)
}

// fetchTenant 按 ID 查询租户（兼容 tenant_admin_handler 复用，不存在返回错误）。
func (h *TenantHandler) fetchTenant(ctx context.Context, id string) (domain.Tenant, error) {
	t, err := h.Service.Get(ctx, id)
	if err != nil {
		return domain.Tenant{}, err
	}
	return *t, nil
}

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
		respondServerError(w, r, err, "查询租户失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Tenant]{Items: items, Total: total})
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
		respondServerError(w, r, err, "创建租户失败")
		return
	}

	tenant, err := h.Service.Get(r.Context(), result.TenantID)
	if err != nil {
		respondServerError(w, r, err, "创建租户失败")
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
		respondServerError(w, r, err, "更新租户失败")
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
		respondServerError(w, r, err, "更新状态失败")
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
		respondServerError(w, r, err, "删除租户失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "deleted": "true"})
}

// CreateTenantAdminRequest is used by the superadmin console to add a school admin.
type CreateTenantAdminRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
}

// UpdateTenantAdminRequest is used by the superadmin console to edit a school admin.
type UpdateTenantAdminRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
}

// AdminListAdmins lists all school_admin users for a tenant.
func (h *TenantHandler) AdminListAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	items, err := h.AdminService.List(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// AdminCreateAdmin creates a new school admin for a tenant with a random password.
func (h *TenantHandler) AdminCreateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	var req CreateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	admin, plainPassword, err := h.AdminService.Create(r.Context(), tenantID, req.Username, req.Name)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "创建管理员失败")
		return
	}

	admin.NewPassword = plainPassword
	respondJSON(w, http.StatusCreated, admin)
}

// AdminUpdateAdmin updates a school admin's username and name.
func (h *TenantHandler) AdminUpdateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	var req UpdateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err := h.AdminService.Update(r.Context(), tenantID, adminID, req.Username, req.Name)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "更新管理员失败")
		return
	}

	updated, err2 := h.AdminService.Get(r.Context(), tenantID, adminID)
	if err2 != nil {
		respondServerError(w, r, err2, "获取更新后的管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// AdminDeleteAdmin deletes a school admin user.
func (h *TenantHandler) AdminDeleteAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	if err := h.AdminService.Delete(r.Context(), tenantID, adminID); err != nil {
		respondServerError(w, r, err, "删除管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "deleted": "true"})
}

// AdminResetPassword generates a new random password for a school admin.
func (h *TenantHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := h.AdminService.ResetPassword(r.Context(), adminID)
	if err != nil {
		respondServerError(w, r, err, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}

// ListSchoolAdmins lists all school_admin users for the current tenant.
func (h *TenantHandler) ListSchoolAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	items, err := h.AdminService.List(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// CreateSchoolAdmin creates a new school admin for the current tenant with a random password.
func (h *TenantHandler) CreateSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	admin, plainPassword, err := h.AdminService.Create(r.Context(), tenantID, req.Username, req.Name)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "创建管理员失败")
		return
	}

	admin.NewPassword = plainPassword
	respondJSON(w, http.StatusCreated, admin)
}

// UpdateSchoolAdmin updates a school admin's username and name within current tenant.
func (h *TenantHandler) UpdateSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	var req UpdateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err := h.AdminService.Update(r.Context(), tenantID, adminID, req.Username, req.Name)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "更新管理员失败")
		return
	}

	updated, _ := h.AdminService.Get(r.Context(), tenantID, adminID)
	respondJSON(w, http.StatusOK, updated)
}

// DeleteSchoolAdmin deletes a school admin user within current tenant.
func (h *TenantHandler) DeleteSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	if err := h.AdminService.Delete(r.Context(), tenantID, adminID); err != nil {
		respondServerError(w, r, err, "删除管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "deleted": "true"})
}

// ResetSchoolAdminPassword resets a school admin's password and returns the new one.
func (h *TenantHandler) ResetSchoolAdminPassword(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := h.AdminService.ResetPassword(r.Context(), adminID)
	if err != nil {
		respondServerError(w, r, err, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}

// PreviewSchoolAdminPassword is an alias for ResetSchoolAdminPassword.
func (h *TenantHandler) PreviewSchoolAdminPassword(w http.ResponseWriter, r *http.Request) {
	h.ResetSchoolAdminPassword(w, r)
}
