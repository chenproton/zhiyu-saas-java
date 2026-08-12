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
	EnablePublic               *bool           `json:"enablePublic"`
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
	// 部分更新兜底：未携带字段保留原值，避免 PUT 全列覆盖擦除数据
	// （如顶部展示开关只携带 enablePublic，其余字段须保留）
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Industry == nil {
		req.Industry = existing.Industry
	}
	if req.Region == nil {
		req.Region = existing.Region
	}
	if req.Description == nil {
		req.Description = existing.Description
	}
	if req.LogoURL == nil {
		req.LogoURL = existing.LogoURL
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	if req.CooperationTypes == nil {
		req.CooperationTypes = existing.CooperationTypes
	}
	if req.ContactPerson == nil {
		req.ContactPerson = existing.ContactPerson
	}
	if req.ContactPhone == nil {
		req.ContactPhone = existing.ContactPhone
	}
	if req.ContactEmail == nil {
		req.ContactEmail = existing.ContactEmail
	}
	if req.Address == nil {
		req.Address = existing.Address
	}
	if req.UnifiedSocialCreditCode == nil {
		req.UnifiedSocialCreditCode = existing.UnifiedSocialCreditCode
	}
	if req.EstablishedYear == nil {
		req.EstablishedYear = existing.EstablishedYear
	}
	if req.EmployeeCount == nil {
		req.EmployeeCount = existing.EmployeeCount
	}
	if req.BusinessLicensePhotos == nil {
		req.BusinessLicensePhotos = existing.BusinessLicensePhotos
	}
	if req.QualificationPhotos == nil {
		req.QualificationPhotos = existing.QualificationPhotos
	}
	if req.IntellectualPropertyPhotos == nil {
		req.IntellectualPropertyPhotos = existing.IntellectualPropertyPhotos
	}
	if req.CoverPhotos == nil {
		req.CoverPhotos = existing.CoverPhotos
	}
	enablePublic := existing.EnablePublic
	if req.EnablePublic != nil {
		enablePublic = *req.EnablePublic
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
		EnablePublic:               enablePublic,
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

// expertCreateRequest 创建专家请求：档案字段 + 自动生成的登录账号（用户名+密码）。
type expertCreateRequest struct {
	domain.AllianceExpert
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *PartnerHandler) CreateExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req expertCreateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "专家姓名不能为空")
		return
	}
	if req.Username == "" {
		respondError(w, http.StatusBadRequest, "登录用户名不能为空")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	enterpriseID, ok := h.ownEnterpriseID(w, r, tenantID)
	if !ok {
		return
	}
	e := req.AllianceExpert
	e.TenantID = tenantID
	e.EnterpriseID = &enterpriseID
	e.CreatedBy = &claims.UserID
	if e.Status == "" {
		e.Status = "active"
	}

	expert, plainPassword, err := h.Service.CreateExpertWithAccount(r.Context(), tenantID, enterpriseID, &e, req.Username, req.Password)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "创建专家失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"expert":          expert,
		"username":        req.Username,
		"initialPassword": plainPassword,
	})
}

// expertUpdateRequest 专家更新请求：IsPublic 指针区分"未携带"与"置为 false"，
// 未携带时保留原值，避免 PUT 全列覆盖误关展示开关（外层同名字段优先于内嵌解码）。
type expertUpdateRequest struct {
	domain.AllianceExpert
	IsPublic *bool `json:"isPublic"`
	// Password 选填：重置专家账号登录密码。
	Password string `json:"password"`
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
	var req expertUpdateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	e := req.AllianceExpert
	if req.IsPublic != nil {
		e.IsPublic = *req.IsPublic
	} else {
		e.IsPublic = existing.IsPublic
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
	// 选填：重置专家账号登录密码
	if req.Password != "" {
		if err := validatePassword(req.Password); err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		if existing.UserID != nil {
			if err := h.Service.ResetExpertPassword(r.Context(), *existing.UserID, req.Password); err != nil {
				respondServerError(w, r, err, "重置专家密码失败")
				return
			}
		}
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
	if err := h.Service.DeleteExpertWithAccount(r.Context(), tenantID, id); err != nil {
		respondServerError(w, r, err, "删除专家失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// GetMyExpert 专家本人的档案（按绑定账号 user_id 查询）。
func (h *PartnerHandler) GetMyExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	expert, err := h.Service.GetMyExpert(r.Context(), tenantID, claims.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "未找到我的专家档案")
			return
		}
		respondServerError(w, r, err, "查询专家档案失败")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

// UpdateMyExpert 专家维护自己的档案（仅本人，user_id 强制绑定当前账号）。
func (h *PartnerHandler) UpdateMyExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	existing, err := h.Service.GetMyExpert(r.Context(), tenantID, claims.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "未找到我的专家档案")
			return
		}
		respondServerError(w, r, err, "查询专家档案失败")
		return
	}
	var req expertUpdateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	e := req.AllianceExpert
	// 本人维护仅允许更新档案展示字段，账号/归属字段不可改
	if e.UserID == nil {
		e.UserID = existing.UserID
	}
	e.TenantID = tenantID
	e.EnterpriseID = existing.EnterpriseID
	e.CreatedBy = existing.CreatedBy
	if req.IsPublic == nil {
		e.IsPublic = existing.IsPublic
	}
	if err := h.Service.Store().Alliance().UpdateExpert(r.Context(), existing.ID, tenantID, &e); err != nil {
		respondServerError(w, r, err, "更新专家档案失败")
		return
	}
	expert, err := h.Service.Store().Alliance().GetExpertByID(r.Context(), existing.ID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新专家档案失败")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

// partnerChangePasswordRequest 修改本人密码请求。
type partnerChangePasswordRequest struct {
	OldPassword string `json:"oldPassword"`
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
	if req.OldPassword == "" {
		respondError(w, http.StatusBadRequest, "旧密码不能为空")
		return
	}
	if err := validatePassword(req.NewPassword); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.Service.ChangeMyPassword(r.Context(), tenantIDOf(claims), claims.UserID, req.OldPassword, req.NewPassword); err != nil {
		if errors.Is(err, service.ErrInvalidOldPassword) {
			respondError(w, http.StatusBadRequest, "旧密码不正确")
			return
		}
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

// partnerSchoolStatusRequest 合作关系状态确认请求。
type partnerSchoolStatusRequest struct {
	Status string `json:"status"`
}

// UpdateSchoolStatus 合作关系状态确认（仅 enterprise_admin——路由层控制）。
// 合法流转：negotiating→active、active→paused、paused→active、任意非 terminated→terminated。
func (h *PartnerHandler) UpdateSchoolStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req partnerSchoolStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}
	school, err := h.Service.UpdateSchoolStatus(r.Context(), tenantID, chi.URLParam(r, "tenantId"), req.Status)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPartnerInvalidStatus), errors.Is(err, service.ErrPartnerInvalidTransition):
			respondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, pgx.ErrNoRows):
			respondError(w, http.StatusNotFound, "合作关系不存在")
		default:
			respondServerError(w, r, err, "更新合作状态失败")
		}
		return
	}
	respondJSON(w, http.StatusOK, school)
}

// ListCooperation 合作内容只读视图：本企业被各合作学校关联的项目/成果/协议。
func (h *PartnerHandler) ListCooperation(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	schools, err := h.Service.ListCooperation(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "企业主体不存在")
			return
		}
		respondServerError(w, r, err, "查询合作内容失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"schools": schools})
}

// GetCooperationProject 合作项目详情（只读，受合作关联过滤）。
func (h *PartnerHandler) GetCooperationProject(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	detail, err := h.Service.GetCooperationProject(r.Context(), tenantID, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "项目不存在或无权查看")
			return
		}
		respondServerError(w, r, err, "查询合作项目详情失败")
		return
	}
	respondJSON(w, http.StatusOK, detail)
}

// GetCooperationAchievement 合作成果详情（只读，受合作关联过滤）。
func (h *PartnerHandler) GetCooperationAchievement(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	detail, err := h.Service.GetCooperationAchievement(r.Context(), tenantID, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "成果不存在或无权查看")
			return
		}
		respondServerError(w, r, err, "查询合作成果详情失败")
		return
	}
	respondJSON(w, http.StatusOK, detail)
}

// GetCooperationAgreement 合作协议详情（只读，受合作关联过滤）。
func (h *PartnerHandler) GetCooperationAgreement(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	detail, err := h.Service.GetCooperationAgreement(r.Context(), tenantID, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "协议不存在或无权查看")
			return
		}
		respondServerError(w, r, err, "查询合作协议详情失败")
		return
	}
	respondJSON(w, http.StatusOK, detail)
}

// ListMentorTasks 专家测评任务只读列表：本企业专家被学校指派的评审任务。
func (h *PartnerHandler) ListMentorTasks(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListMentorTasks(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "企业主体不存在")
			return
		}
		respondServerError(w, r, err, "查询专家测评任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}
