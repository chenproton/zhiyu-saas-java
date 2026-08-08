package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PartnerHandler 企业平台（Partner）服务台接口：主体信息/专家/成员/工作台/合作学校。
type PartnerHandler struct {
	Service *service.PartnerService
}

// ===== 企业主体信息 =====

func (h *PartnerHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	enterprise, err := h.Service.GetProfile(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "企业主体不存在")
			return
		}
		respondServerError(w, r, err, "获取企业信息失败")
		return
	}
	respondJSON(w, http.StatusOK, enterprise)
}

// partnerProfileRequest 企业主体信息更新请求（与 store 更新参数同构）。
type partnerProfileRequest struct {
	Name                       string          `json:"name"`
	Industry                   *string         `json:"industry"`
	Region                     *string         `json:"region"`
	Description                *string         `json:"description"`
	LogoURL                    *string         `json:"logoUrl"`
	CoverImage                 *string         `json:"coverImage"`
	CooperationTypes           json.RawMessage `json:"cooperationTypes"`
	ContactPerson              *string         `json:"contactPerson"`
	ContactPhone               *string         `json:"contactPhone"`
	ContactEmail               *string         `json:"contactEmail"`
	Address                    *string         `json:"address"`
	UnifiedSocialCreditCode    *string         `json:"unifiedSocialCreditCode"`
	EstablishedYear            *int            `json:"establishedYear"`
	EmployeeCount              *int            `json:"employeeCount"`
	BusinessLicensePhotos      json.RawMessage `json:"businessLicensePhotos"`
	QualificationPhotos        json.RawMessage `json:"qualificationPhotos"`
	IntellectualPropertyPhotos json.RawMessage `json:"intellectualPropertyPhotos"`
	CoverPhotos                json.RawMessage `json:"coverPhotos"`
	EnablePublic               bool            `json:"enablePublic"`
}

func (h *PartnerHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req partnerProfileRequest
	if !decodeBody(w, r, &req) {
		return
	}

	existing, err := h.Service.GetProfile(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "企业主体不存在")
		return
	}
	// 部分更新兜底：name 未携带时保留原值
	if req.Name == "" {
		req.Name = existing.Name
	}

	updated, err := h.Service.UpdateProfile(r.Context(), tenantID, &store.AllianceEnterpriseProfileUpdateParams{
		Name:                       req.Name,
		Industry:                   req.Industry,
		Region:                     req.Region,
		Description:                req.Description,
		LogoURL:                    req.LogoURL,
		CoverImage:                 req.CoverImage,
		CooperationTypes:           req.CooperationTypes,
		ContactPerson:              req.ContactPerson,
		ContactPhone:               req.ContactPhone,
		ContactEmail:               req.ContactEmail,
		Address:                    req.Address,
		UnifiedSocialCreditCode:    req.UnifiedSocialCreditCode,
		EstablishedYear:            req.EstablishedYear,
		EmployeeCount:              req.EmployeeCount,
		BusinessLicensePhotos:      req.BusinessLicensePhotos,
		QualificationPhotos:        req.QualificationPhotos,
		IntellectualPropertyPhotos: req.IntellectualPropertyPhotos,
		CoverPhotos:                req.CoverPhotos,
		EnablePublic:               req.EnablePublic,
	})
	if err != nil {
		respondServerError(w, r, err, "更新企业信息失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// ===== 专家资源（企业租户内 CRUD，写操作仅 enterprise_admin——路由层控制） =====

func (h *PartnerHandler) ListExperts(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.AllianceExpert](
		r.Context(), h.Service.Store().Alliance().Q(), r, h.Service.Store().Alliance().ListExpertsConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询专家列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceExpert]{Items: items, Total: total})
}

func (h *PartnerHandler) GetExpert(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	expert, err := h.Service.Store().Alliance().GetExpertByID(r.Context(), chi.URLParam(r, "id"), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

// ownEnterpriseID 本企业租户唯一主体 ID（专家强制归属本企业）。
func (h *PartnerHandler) ownEnterpriseID(w http.ResponseWriter, r *http.Request, tenantID string) (string, bool) {
	enterprise, err := h.Service.GetProfile(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "获取企业信息失败")
		return "", false
	}
	return enterprise.ID, true
}

func (h *PartnerHandler) CreateExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var e domain.AllianceExpert
	if !decodeBody(w, r, &e) {
		return
	}
	if e.Name == "" {
		respondError(w, http.StatusBadRequest, "专家姓名不能为空")
		return
	}
	enterpriseID, ok := h.ownEnterpriseID(w, r, tenantID)
	if !ok {
		return
	}
	e.TenantID = tenantID
	e.EnterpriseID = &enterpriseID
	e.CreatedBy = &claims.UserID
	if e.Status == "" {
		e.Status = "active"
	}

	id, err := h.Service.Store().Alliance().CreateExpert(r.Context(), &e)
	if err != nil {
		respondServerError(w, r, err, "创建专家失败")
		return
	}
	expert, err := h.Service.Store().Alliance().GetExpertByID(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "创建专家失败")
		return
	}
	respondJSON(w, http.StatusCreated, expert)
}

func (h *PartnerHandler) UpdateExpert(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.Store().Alliance().GetExpertByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	var e domain.AllianceExpert
	if !decodeBody(w, r, &e) {
		return
	}
	// 部分更新兜底：未携带字段回退已有值；企业归属强制本企业，不可改绑
	if e.Name == "" {
		e.Name = existing.Name
	}
	if e.Status == "" {
		e.Status = existing.Status
	}
	if e.Title == nil {
		e.Title = existing.Title
	}
	if e.Position == nil {
		e.Position = existing.Position
	}
	if e.ExpertType == nil {
		e.ExpertType = existing.ExpertType
	}
	if e.Industry == nil {
		e.Industry = existing.Industry
	}
	if e.Gender == nil {
		e.Gender = existing.Gender
	}
	if e.Age == nil {
		e.Age = existing.Age
	}
	if e.ExperienceYears == nil {
		e.ExperienceYears = existing.ExperienceYears
	}
	if e.Education == nil {
		e.Education = existing.Education
	}
	if e.Introduction == nil {
		e.Introduction = existing.Introduction
	}
	if e.WorkExperience == nil {
		e.WorkExperience = existing.WorkExperience
	}
	if e.City == nil {
		e.City = existing.City
	}
	if e.AvatarURL == nil {
		e.AvatarURL = existing.AvatarURL
	}
	if e.CoverImage == nil {
		e.CoverImage = existing.CoverImage
	}
	if e.Organization == nil {
		e.Organization = existing.Organization
	}
	if e.Rating == nil {
		e.Rating = existing.Rating
	}
	if e.PartnerSource == nil {
		e.PartnerSource = existing.PartnerSource
	}
	if e.PositionDirection == nil {
		e.PositionDirection = existing.PositionDirection
	}
	if len(e.ProfessionalFields) == 0 {
		e.ProfessionalFields = existing.ProfessionalFields
	}
	if len(e.Specialties) == 0 {
		e.Specialties = existing.Specialties
	}
	if len(e.Photos) == 0 {
		e.Photos = existing.Photos
	}
	if len(e.Attachments) == 0 {
		e.Attachments = existing.Attachments
	}
	if len(e.SecondaryColleges) == 0 {
		e.SecondaryColleges = existing.SecondaryColleges
	}
	if e.UserID == nil {
		e.UserID = existing.UserID
	}
	e.EnterpriseID = existing.EnterpriseID

	if err := h.Service.Store().Alliance().UpdateExpert(r.Context(), id, tenantID, &e); err != nil {
		respondServerError(w, r, err, "更新专家失败")
		return
	}
	expert, err := h.Service.Store().Alliance().GetExpertByID(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新专家失败")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

func (h *PartnerHandler) DeleteExpert(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Service.Store().Alliance().DeleteExpert(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除专家失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 成员账号（仅 enterprise_admin——路由层控制） =====

func (h *PartnerHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.User](
		r.Context(), h.Service.Store().Q(), r, h.Service.Store().Users().ListConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询成员列表失败")
		return
	}
	h.Service.Store().Users().AttachUserRoles(r.Context(), items)
	respondJSON(w, http.StatusOK, ListResponse[domain.User]{Items: items, Total: total})
}

type partnerMemberCreateRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Name     string `json:"name"`
	RoleCode string `json:"roleCode"`
}

func (h *PartnerHandler) CreateMember(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req partnerMemberCreateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "用户名和姓名不能为空")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.RoleCode == "" {
		req.RoleCode = domain.RoleEnterpriseMember
	}

	user, err := h.Service.CreateMember(r.Context(), tenantID, req.Username, req.Password, req.Name, req.RoleCode)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrPartnerUsernameExists):
			respondError(w, http.StatusConflict, "用户名已被注册")
		case isUniqueViolation(err):
			respondError(w, http.StatusConflict, "用户名已存在")
		default:
			respondServerError(w, r, err, "创建成员失败")
		}
		return
	}
	user.PasswordHash = ""
	user.Oauth = nil
	respondJSON(w, http.StatusCreated, user)
}

type partnerMemberUpdateRequest struct {
	Name     *string `json:"name"`
	Status   *string `json:"status"`
	RoleCode *string `json:"roleCode"`
	Password *string `json:"password"`
}

// verifyMemberTenant 校验目标用户属于本企业租户（防跨租户操作）。
func (h *PartnerHandler) verifyMemberTenant(w http.ResponseWriter, r *http.Request, tenantID, userID string) (*domain.User, bool) {
	user, err := h.Service.Store().Users().Get(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "成员不存在")
		return nil, false
	}
	if user.TenantID == nil || *user.TenantID != tenantID || user.Platform != domain.UserPlatformPartner {
		respondError(w, http.StatusForbidden, "无权操作：成员不属于本企业")
		return nil, false
	}
	return user, true
}

func (h *PartnerHandler) UpdateMember(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, ok := h.verifyMemberTenant(w, r, tenantID, id); !ok {
		return
	}
	var req partnerMemberUpdateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	users := h.Service.Store().Users()
	if req.Name != nil && *req.Name != "" {
		if err := users.UpdateSelfName(r.Context(), id, *req.Name); err != nil {
			respondServerError(w, r, err, "更新成员失败")
			return
		}
	}
	if req.Status != nil && *req.Status != "" {
		if err := users.UpdateStatus(r.Context(), id, *req.Status); err != nil {
			respondServerError(w, r, err, "更新成员失败")
			return
		}
	}
	if req.RoleCode != nil && *req.RoleCode != "" {
		roleID, err := h.Service.Store().Partner().GetRoleIDByCode(r.Context(), tenantID, *req.RoleCode)
		if err != nil {
			respondError(w, http.StatusBadRequest, "无效角色")
			return
		}
		if err := users.BindRoles(r.Context(), h.Service.Store().Q(), id, []string{roleID}); err != nil {
			respondServerError(w, r, err, "更新成员失败")
			return
		}
	}
	if req.Password != nil && *req.Password != "" {
		if err := validatePassword(*req.Password); err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := users.ResetPassword(r.Context(), id, *req.Password); err != nil {
			respondServerError(w, r, err, "重置密码失败")
			return
		}
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PartnerHandler) DeleteMember(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if id == claims.UserID {
		respondError(w, http.StatusBadRequest, "不能删除当前登录账号")
		return
	}
	if _, ok := h.verifyMemberTenant(w, r, tenantID, id); !ok {
		return
	}
	if err := h.Service.Store().Users().Delete(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除成员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 个人 =====

type partnerChangePasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

func (h *PartnerHandler) ChangeMyPassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.UserID == "" {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}
	var req partnerChangePasswordRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if err := validatePassword(req.NewPassword); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.Service.ResetMyPassword(r.Context(), claims.UserID, req.NewPassword); err != nil {
		respondServerError(w, r, err, "修改密码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": claims.UserID})
}

// ===== 工作台 / 合作学校 =====

func (h *PartnerHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	d, err := h.Service.Dashboard(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "获取工作台统计失败")
		return
	}
	respondJSON(w, http.StatusOK, d)
}

func (h *PartnerHandler) ListSchools(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListSchools(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询合作学校失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AlliancePartnerSchool]{Items: items, Total: len(items)})
}
