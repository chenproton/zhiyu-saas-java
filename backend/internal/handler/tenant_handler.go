package handler

import (
	"context"
	"encoding/json"
	"errors"
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
	// PartnerService 企业租户创建/主体信息查询（router 装配时注入）。
	PartnerService *service.PartnerService
}
type CreateTenantRequest struct {
	Name           string  `json:"name"`
	Code           string  `json:"code"`
	Type           string  `json:"type"`
	Username       string  `json:"username"`
	Password       string  `json:"password"`
	LogoURL        *string `json:"logoUrl"`
	Domain         *string `json:"domain"`
	EnterpriseCode *string `json:"enterpriseCode"`
	Contact        *string `json:"contact"`
	Phone          *string `json:"phone"`
	Address        *string `json:"address"`
	Description    *string `json:"description"`
}

// strValue 解引用可选字符串，nil 视为空串。
func strValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
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

// SetPasswordRequest 手动修改学校管理员密码的请求体。
type SetPasswordRequest struct {
	Password string `json:"password"`
}

type CreateTenantResponse struct {
	Tenant    domain.Tenant  `json:"tenant"`
	AdminUser *adminUserInfo `json:"adminUser,omitempty"`
}

type adminUserInfo struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	LoginName string `json:"loginName"`
	// InitialPassword 企业租户创建时下发初始密码（学校租户不返回）。
	InitialPassword *string `json:"initialPassword,omitempty"`
}

func (h *TenantHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := h.Service.Store().Tenants().ListConfig()
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

	tenant, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询租户失败")
		return
	}
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

	tenant, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询租户失败")
		return
	}
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
	cfg := h.Service.Store().Tenants().AdminListConfig()
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
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	// 企业租户：复用 partner 注册流程（租户+角色种子+企业主体+管理员账号）
	if req.Type == string(domain.TenantTypeEnterprise) {
		h.adminCreateEnterprise(w, r, &req)
		return
	}
	if req.Code == "" {
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

// adminCreateEnterprise 超管创建企业租户：企业租户 + 企业主体 + 管理员账号（与 partner 自助注册一致）。
func (h *TenantHandler) adminCreateEnterprise(w http.ResponseWriter, r *http.Request, req *CreateTenantRequest) {
	if req.Username == "" {
		respondError(w, http.StatusBadRequest, "企业管理员用户名不能为空")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.PartnerService.Register(r.Context(), &service.PartnerRegisterParams{
		EnterpriseName:          req.Name,
		Username:                req.Username,
		Password:                req.Password,
		ContactName:             strValue(req.Contact),
		UnifiedSocialCreditCode: strValue(req.EnterpriseCode),
		ContactPerson:           strValue(req.Contact),
		ContactPhone:            strValue(req.Phone),
	})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrPartnerUsernameExists):
			respondError(w, http.StatusConflict, "用户名已被注册")
		case isUniqueViolation(err):
			respondError(w, http.StatusConflict, "企业名称已被注册")
		default:
			respondServerError(w, r, err, "创建企业租户失败")
		}
		return
	}

	tenant, err := h.Service.Get(r.Context(), res.TenantID)
	if err != nil {
		respondServerError(w, r, err, "创建企业租户失败")
		return
	}
	respondJSON(w, http.StatusCreated, CreateTenantResponse{
		Tenant: *tenant,
		AdminUser: &adminUserInfo{
			ID:              res.User.ID,
			Username:        res.User.Username,
			LoginName:       res.User.Username,
			InitialPassword: &req.Password,
		},
	})
}

// AdminGetEnterprise 超管查看企业租户的企业主体信息（信用代码/联系人/展示开关等）。
func (h *TenantHandler) AdminGetEnterprise(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "id")
	tenant, err := h.Service.Get(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if tenant.Type != domain.TenantTypeEnterprise {
		respondError(w, http.StatusBadRequest, "非企业租户")
		return
	}
	profile, err := h.PartnerService.GetProfile(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询企业信息失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"tenant": tenant, "enterprise": profile})
}

// AdminUpdateEnterprise 超管编辑企业租户主体信息（信用代码/联系人/电话/邮箱/展示开关）。
func (h *TenantHandler) AdminUpdateEnterprise(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "id")
	tenant, err := h.Service.Get(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if tenant.Type != domain.TenantTypeEnterprise {
		respondError(w, http.StatusBadRequest, "非企业租户")
		return
	}

	existing, err := h.PartnerService.GetProfile(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询企业信息失败")
		return
	}

	var req adminEnterpriseUpdateRequest
	if !decodeBody(w, r, &req) {
		return
	}

	// 部分更新兜底：未携带字段保留原值
	creditCode := store.StrPtrIfNonEmpty(req.UnifiedSocialCreditCode)
	if creditCode == nil {
		creditCode = existing.UnifiedSocialCreditCode
	}
	contactPerson := store.StrPtrIfNonEmpty(req.ContactPerson)
	if contactPerson == nil {
		contactPerson = existing.ContactPerson
	}
	contactPhone := store.StrPtrIfNonEmpty(req.ContactPhone)
	if contactPhone == nil {
		contactPhone = existing.ContactPhone
	}
	contactEmail := store.StrPtrIfNonEmpty(req.ContactEmail)
	if contactEmail == nil {
		contactEmail = existing.ContactEmail
	}
	enablePublic := existing.EnablePublic
	if req.EnablePublic != nil {
		enablePublic = *req.EnablePublic
	}

	if _, err := h.PartnerService.UpdateProfile(r.Context(), tenantID, &store.AllianceEnterpriseProfileUpdateParams{
		Name:                    existing.Name,
		UnifiedSocialCreditCode: creditCode,
		ContactPerson:           contactPerson,
		ContactPhone:            contactPhone,
		ContactEmail:            contactEmail,
		EnablePublic:            enablePublic,
	}); err != nil {
		respondServerError(w, r, err, "更新企业信息失败")
		return
	}

	updated, err := h.PartnerService.GetProfile(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询企业信息失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// adminEnterpriseUpdateRequest 超管编辑企业主体信息请求。
type adminEnterpriseUpdateRequest struct {
	UnifiedSocialCreditCode string `json:"unifiedSocialCreditCode"`
	ContactPerson           string `json:"contactPerson"`
	ContactPhone            string `json:"contactPhone"`
	ContactEmail            string `json:"contactEmail"`
	EnablePublic            *bool  `json:"enablePublic"`
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

	tenant, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询租户失败")
		return
	}
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

	tenant, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询租户失败")
		return
	}
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

// AdminResetPassword sets a school admin's password to the given plaintext password.
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

	var req SetPasswordRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.AdminService.SetPassword(r.Context(), adminID, req.Password); err != nil {
		respondServerError(w, r, err, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "updated": "true"})
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

	updated, err := h.AdminService.Get(r.Context(), tenantID, adminID)
	if err != nil {
		respondServerError(w, r, err, "查询学校管理员失败")
		return
	}
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

// ResetSchoolAdminPassword sets a school admin's password to the given plaintext password.
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

	var req SetPasswordRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.AdminService.SetPassword(r.Context(), adminID, req.Password); err != nil {
		respondServerError(w, r, err, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "updated": "true"})
}
