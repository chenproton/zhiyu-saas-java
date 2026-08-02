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
}

type TenantListResponse struct {
	Items []domain.Tenant `json:"items"`
	Total int             `json:"total"`
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
	respondJSON(w, http.StatusOK, TenantListResponse{Items: items, Total: total})
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

var _ = errors.Is

// fetchTenant 按 ID 查询租户（兼容 tenant_admin_handler 复用，不存在返回错误）。
func (h *TenantHandler) fetchTenant(ctx context.Context, id string) (domain.Tenant, error) {
	t, err := h.Service.Get(ctx, id)
	if err != nil {
		return domain.Tenant{}, err
	}
	return *t, nil
}
