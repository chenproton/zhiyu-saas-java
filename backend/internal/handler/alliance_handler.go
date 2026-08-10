package handler

import (
	"context"
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

type AllianceHandler struct {
	Store *store.AllianceStore
	Links *store.AllianceEnterpriseLinkStore
	// PartnerService 学校代注册企业（创建企业租户+主体+管理员，router 装配时注入）。
	PartnerService *service.PartnerService
}

// ===== 通用响应结构 =====

// ===== 学校信息 =====

func (h *AllianceHandler) GetSchoolInfo(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	info, err := h.Store.GetSchoolInfo(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondJSON(w, http.StatusOK, &domain.AllianceSchoolInfo{
				TenantID: tenantID,
				Name:     "",
			})
			return
		}
		respondServerError(w, r, err, "获取学校信息失败")
		return
	}
	respondJSON(w, http.StatusOK, info)
}

func (h *AllianceHandler) UpdateSchoolInfo(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var info domain.AllianceSchoolInfo
	if !decodeBody(w, r, &info) {
		return
	}
	info.TenantID = tenantID

	if err := h.Store.UpsertSchoolInfo(r.Context(), &info); err != nil {
		respondServerError(w, r, err, "更新学校信息失败")
		return
	}

	updated, err := h.Store.GetSchoolInfo(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新学校信息失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// ===== 合作企业（学校侧：引入/关联企业，主体只读 + link 管理字段） =====

// ListEnterprises 本校已引入企业列表（link 合并视图：全局主体 + 学校侧管理字段）。
func (h *AllianceHandler) ListEnterprises(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	filter := store.AllianceEnterpriseListFilter{
		Search: r.URL.Query().Get("search"),
		Status: r.URL.Query().Get("status"),
	}
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 200); err == nil && v > 0 {
		filter.Limit = v
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		filter.Offset = v
	}
	items, total, err := h.Links.ListBySchoolTenant(r.Context(), tenantID, filter)
	if err != nil {
		respondServerError(w, r, err, "查询企业列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceLinkedEnterprise]{Items: items, Total: total})
}

// GetEnterprise 单企业合并视图（主体只读 + link 管理字段）。
func (h *AllianceHandler) GetEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	item, err := h.Links.GetLinkedByEnterprise(r.Context(), chi.URLParam(r, "id"), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "企业不存在或未引入")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// SearchEnterprises 全局企业池搜索（跨租户只读，排除已引入企业），供"引入企业"选择。
func (h *AllianceHandler) SearchEnterprises(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Links.SearchEnterprises(r.Context(), tenantID, r.URL.Query().Get("keyword"), 20)
	if err != nil {
		respondServerError(w, r, err, "搜索企业失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceEnterprise]{Items: items, Total: len(items)})
}

// registerEnterpriseRequest 学校代注册企业请求（企业管理员账号由学校代填后转交企业）。
type registerEnterpriseRequest struct {
	EnterpriseName          string `json:"enterpriseName" validate:"required"`
	Username                string `json:"username" validate:"required"`
	Password                string `json:"password" validate:"required"`
	UnifiedSocialCreditCode string `json:"unifiedSocialCreditCode"`
	ContactPerson           string `json:"contactPerson"`
	ContactPhone            string `json:"contactPhone"`
	ContactEmail            string `json:"contactEmail"`
}

// RegisterEnterprise 学校代注册企业：创建企业租户+主体+管理员账号，并直接建立
// 本校-企业合作关联（status=active）。企业已存在时由前端改走"引入企业"流程。
func (h *AllianceHandler) RegisterEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req registerEnterpriseRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.EnterpriseName == "" || req.Username == "" {
		respondError(w, http.StatusBadRequest, "企业名称和用户名不能为空")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.PartnerService.Register(r.Context(), &service.PartnerRegisterParams{
		EnterpriseName:          req.EnterpriseName,
		Username:                req.Username,
		Password:                req.Password,
		UnifiedSocialCreditCode: req.UnifiedSocialCreditCode,
		ContactPerson:           req.ContactPerson,
		ContactPhone:            req.ContactPhone,
		ContactEmail:            req.ContactEmail,
	})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrPartnerUsernameExists):
			respondError(w, http.StatusConflict, "用户名已被注册")
		case isUniqueViolation(err):
			respondError(w, http.StatusConflict, "企业名称已被注册，可在「引入企业」中搜索并引入")
		default:
			respondServerError(w, r, err, "代注册企业失败")
		}
		return
	}

	// 建立本校-企业合作关联（合作中）
	if _, err := h.Links.CreateLink(r.Context(), &store.AllianceEnterpriseLinkCreateParams{
		TenantID:     tenantID,
		EnterpriseID: res.EnterpriseID,
		RelationType: "alliance",
		Status:       "active",
		CreatedBy:    &claims.UserID,
	}); err != nil {
		respondServerError(w, r, err, "代注册企业失败")
		return
	}

	item, err := h.Links.GetLinkedByEnterprise(r.Context(), res.EnterpriseID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "代注册企业失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

// linkEnterpriseRequest 引入企业请求（均为可选，默认值由 store 兜底）。
type linkEnterpriseRequest struct {
	RelationType   string  `json:"relationType"`
	EnterpriseType string  `json:"enterpriseType"`
	Status         string  `json:"status"`
	Rating         *string `json:"rating"`
}

// LinkEnterprise 引入企业（创建学校-企业合作关联）。
func (h *AllianceHandler) LinkEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	eid := chi.URLParam(r, "id")
	if _, err := h.Store.GetEnterpriseByIDGlobal(r.Context(), eid); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}
	var req linkEnterpriseRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if _, err := h.Links.CreateLink(r.Context(), &store.AllianceEnterpriseLinkCreateParams{
		TenantID:       tenantID,
		EnterpriseID:   eid,
		RelationType:   req.RelationType,
		Status:         req.Status,
		Rating:         req.Rating,
		EnterpriseType: req.EnterpriseType,
		CreatedBy:      &claims.UserID,
	}); err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "该企业已引入")
			return
		}
		respondServerError(w, r, err, "引入企业失败")
		return
	}
	item, err := h.Links.GetLinkedByEnterprise(r.Context(), eid, tenantID)
	if err != nil {
		respondServerError(w, r, err, "引入企业失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

// UnlinkEnterprise 解除引入（删除 link；历史协议/项目/成果引用保留，页面不再展示）。
func (h *AllianceHandler) UnlinkEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	eid := chi.URLParam(r, "id")
	if err := h.Links.DeleteLink(r.Context(), eid, tenantID); err != nil {
		respondServerError(w, r, err, "解除引入失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": eid})
}

// updateEnterpriseLinkRequest 学校侧管理字段更新（仅 link 字段，企业主体不可改）。
type updateEnterpriseLinkRequest struct {
	Status            string          `json:"status"`
	Rating            *string         `json:"rating"`
	EnterpriseType    string          `json:"enterpriseType"`
	IsPublic          *bool           `json:"isPublic"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges"`
}

// UpdateEnterprise 仅更新 link 学校侧管理字段（rating/status/enterprise_type/is_public/secondary_colleges）。
func (h *AllianceHandler) UpdateEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	eid := chi.URLParam(r, "id")
	existing, err := h.Links.GetLinkByEnterprise(r.Context(), eid, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "企业不存在或未引入")
		return
	}
	var req updateEnterpriseLinkRequest
	if !decodeBody(w, r, &req) {
		return
	}
	// 部分更新兜底：未携带字段回退已有值
	if req.Status == "" {
		req.Status = existing.Status
	}
	if req.Rating == nil {
		req.Rating = existing.Rating
	}
	if req.EnterpriseType == "" {
		req.EnterpriseType = existing.EnterpriseType
	}
	if req.IsPublic == nil {
		req.IsPublic = &existing.IsPublic
	}
	if len(req.SecondaryColleges) == 0 {
		req.SecondaryColleges = existing.SecondaryColleges
	}
	if err := h.Links.UpdateLink(r.Context(), eid, tenantID, &store.AllianceEnterpriseLinkUpdateParams{
		Status:            req.Status,
		Rating:            req.Rating,
		EnterpriseType:    req.EnterpriseType,
		IsPublic:          *req.IsPublic,
		SecondaryColleges: req.SecondaryColleges,
	}); err != nil {
		respondServerError(w, r, err, "更新企业失败")
		return
	}
	item, err := h.Links.GetLinkedByEnterprise(r.Context(), eid, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新企业失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// ===== 企业合作协议 =====

func (h *AllianceHandler) ListEnterpriseAgreements(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	eid := chi.URLParam(r, "eid")
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), eid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}

	items, err := h.Store.ListEnterpriseAgreements(r.Context(), eid, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceEnterpriseAgreement]{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	eid := chi.URLParam(r, "eid")
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), eid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}
	var p store.AllianceEnterpriseAgreementCreateParams
	if !decodeBody(w, r, &p) {
		return
	}
	p.TenantID = tenantID
	p.EnterpriseID = eid
	if p.Name == "" {
		respondError(w, http.StatusBadRequest, "协议名称不能为空")
		return
	}

	id, err := h.Store.CreateEnterpriseAgreement(r.Context(), &p)
	if err != nil {
		respondServerError(w, r, err, "创建失败")
		return
	}

	item, err := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *AllianceHandler) UpdateEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	eid := chi.URLParam(r, "eid")
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), eid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "协议不存在")
		return
	}

	var p store.AllianceEnterpriseAgreementUpdateParams
	if !decodeBody(w, r, &p) {
		return
	}
	// 部分更新兜底：缺失字段回退已有值，防止全列覆盖清空数据
	if p.Name == "" {
		p.Name = existing.Name
	}
	if p.Status == "" {
		p.Status = existing.Status
	}
	if p.Type == nil {
		p.Type = existing.Type
	}
	if p.StartDate == nil {
		p.StartDate = existing.StartDate
	}
	if p.EndDate == nil {
		p.EndDate = existing.EndDate
	}
	if p.Content == nil {
		p.Content = existing.Content
	}
	if len(p.Attachments) == 0 {
		p.Attachments = existing.Attachments
	}
	if err := h.Store.UpdateEnterpriseAgreement(r.Context(), id, tenantID, &p); err != nil {
		respondServerError(w, r, err, "更新失败")
		return
	}

	item, err := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *AllianceHandler) DeleteEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	eid := chi.URLParam(r, "eid")
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), eid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteEnterpriseAgreement(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 合作项目 =====

func (h *AllianceHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListProjectsConfig(), "查询项目列表失败")
}

func (h *AllianceHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.projectCRUD())
}

func (h *AllianceHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.projectCRUD())
}

func (h *AllianceHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.projectCRUD())
}

func (h *AllianceHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.projectCRUD())
}

// ===== 里程碑 =====

func (h *AllianceHandler) ListMilestones(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	pid := chi.URLParam(r, "pid")
	if _, err := h.Store.GetProjectByID(r.Context(), pid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "项目不存在")
		return
	}
	items, err := h.Store.ListMilestones(r.Context(), pid, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceProjectMilestone]{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	pid := chi.URLParam(r, "pid")
	if _, err := h.Store.GetProjectByID(r.Context(), pid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "项目不存在")
		return
	}
	var m domain.AllianceProjectMilestone
	if !decodeBody(w, r, &m) {
		return
	}
	m.TenantID = tenantID
	m.ProjectID = pid

	id, err := h.Store.CreateMilestone(r.Context(), &m)
	if err != nil {
		respondServerError(w, r, err, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdateMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetMilestoneByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "里程碑不存在")
		return
	}
	var m domain.AllianceProjectMilestone
	if !decodeBody(w, r, &m) {
		return
	}
	// 部分更新兜底：缺失字段回退已有值，防止全列覆盖清空数据
	if m.ProjectID == "" {
		m.ProjectID = existing.ProjectID
	}
	if m.Name == "" {
		m.Name = existing.Name
	}
	if m.Description == nil {
		m.Description = existing.Description
	}
	if m.DueDate == nil {
		m.DueDate = existing.DueDate
	}
	if m.CompletedDate == nil {
		m.CompletedDate = existing.CompletedDate
	}
	if err := h.Store.UpdateMilestone(r.Context(), id, tenantID, &m); err != nil {
		respondServerError(w, r, err, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeleteMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteMilestone(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 合作成果 =====

func (h *AllianceHandler) ListAchievements(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListAchievementsConfig(), "查询成果列表失败")
}

func (h *AllianceHandler) GetAchievement(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.achievementCRUD())
}

func (h *AllianceHandler) CreateAchievement(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.achievementCRUD())
}

func (h *AllianceHandler) UpdateAchievement(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.achievementCRUD())
}

func (h *AllianceHandler) DeleteAchievement(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.achievementCRUD())
}

// ===== 专家（学校侧：跨租户只读，按已引入企业过滤；越权防线：enterprise_id 必须 ∈ 本校 links） =====

// ListExperts 本校已引入企业的专家列表（跨租户只读）。
// query 指定 enterpriseId 时必须在已引入企业集合内，否则 403。
func (h *AllianceHandler) ListExperts(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	enterpriseIDs, err := h.Links.ListEnterpriseIDsBySchoolTenant(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询专家列表失败")
		return
	}
	if eid := r.URL.Query().Get("enterpriseId"); eid != "" {
		allowed := false
		for _, id := range enterpriseIDs {
			if id == eid {
				allowed = true
				break
			}
		}
		if !allowed {
			respondError(w, http.StatusForbidden, "无权查看：该企业未引入")
			return
		}
		enterpriseIDs = []string{eid}
	}
	filter := store.AllianceExpertListFilter{
		Search: r.URL.Query().Get("search"),
		Status: r.URL.Query().Get("status"),
	}
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 200); err == nil && v > 0 {
		filter.Limit = v
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		filter.Offset = v
	}
	items, total, err := h.Store.ListByEnterpriseIDs(r.Context(), enterpriseIDs, filter)
	if err != nil {
		respondServerError(w, r, err, "查询专家列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceExpert]{Items: items, Total: total})
}

// GetExpert 专家详情（跨租户只读；专家所属企业必须已引入本校）。
func (h *AllianceHandler) GetExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	expert, err := h.Store.GetExpertByIDGlobal(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	// 越权防线：专家所属企业必须在本校 links 内
	if expert.EnterpriseID == nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), *expert.EnterpriseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

// ===== 合作协议（独立） =====

func (h *AllianceHandler) ListAgreements(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListAgreementsConfig(), "查询协议列表失败")
}

func (h *AllianceHandler) GetAgreement(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.agreementCRUD())
}

func (h *AllianceHandler) CreateAgreement(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.agreementCRUD())
}

func (h *AllianceHandler) UpdateAgreement(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.agreementCRUD())
}

func (h *AllianceHandler) DeleteAgreement(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.agreementCRUD())
}

// ===== 权限 =====

func (h *AllianceHandler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.AlliancePermission](
		r.Context(), h.Store.Q(), r, h.Store.ListPermissionsConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询权限列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AlliancePermission]{Items: items, Total: total})
}

func (h *AllianceHandler) GetPermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	p, err := h.Store.GetPermissionByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "权限不存在")
		return
	}
	respondJSON(w, http.StatusOK, p)
}

func (h *AllianceHandler) CreatePermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var p domain.AlliancePermission
	if !decodeBody(w, r, &p) {
		return
	}
	p.TenantID = tenantID
	if p.AccountName == "" {
		respondError(w, http.StatusBadRequest, "账号名称不能为空")
		return
	}

	id, err := h.Store.CreatePermission(r.Context(), &p)
	if err != nil {
		respondServerError(w, r, err, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetPermissionByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "权限不存在")
		return
	}
	var p domain.AlliancePermission
	if !decodeBody(w, r, &p) {
		return
	}
	// 部分更新兜底：请求未携带的字段回退到已存在记录，避免 PUT 全列覆盖清空数据。
	if p.AccountName == "" {
		p.AccountName = existing.AccountName
	}
	if p.AccountType == "" {
		p.AccountType = existing.AccountType
	}
	if p.EnterpriseID == nil {
		p.EnterpriseID = existing.EnterpriseID
	}
	if p.ExpertID == nil {
		p.ExpertID = existing.ExpertID
	}
	if len(p.ResourcePermissions) == 0 {
		p.ResourcePermissions = existing.ResourcePermissions
	}
	if len(p.PlatformPermissions) == 0 {
		p.PlatformPermissions = existing.PlatformPermissions
	}
	if err := h.Store.UpdatePermission(r.Context(), id, tenantID, &p); err != nil {
		respondServerError(w, r, err, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeletePermission(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 字典 =====

func (h *AllianceHandler) ListDictionaryItems(w http.ResponseWriter, r *http.Request) {
	dictType := chi.URLParam(r, "dictType")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	items, err := h.Store.ListDictionaries(r.Context(), dictType, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceDictionary]{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	dictType := chi.URLParam(r, "dictType")

	var req struct {
		Code      string `json:"code"`
		Name      string `json:"name"`
		SortOrder int    `json:"sortOrder"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "编码和名称不能为空")
		return
	}

	id, err := h.Store.CreateDictionary(r.Context(), &domain.AllianceDictionary{
		TenantID:  tenantID,
		DictType:  dictType,
		Code:      req.Code,
		Name:      req.Name,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "字典项编码已存在")
			return
		}
		respondServerError(w, r, err, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdateDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetDictionaryByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "字典项不存在")
		return
	}

	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sortOrder"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	// 部分更新兜底：未携带 name 时回退现有值，防止全列覆盖清空字典项名
	if req.Name == "" {
		req.Name = existing.Name
	}
	if err := h.Store.UpdateDictionary(r.Context(), id, tenantID, &domain.AllianceDictionary{
		Name:      req.Name,
		SortOrder: req.SortOrder,
	}); err != nil {
		respondServerError(w, r, err, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeleteDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteDictionary(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 品牌 =====

func (h *AllianceHandler) ListBrands(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListBrandsConfig(), "查询品牌列表失败")
}

func (h *AllianceHandler) GetBrand(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.brandCRUD())
}

func (h *AllianceHandler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.brandCRUD())
}

func (h *AllianceHandler) UpdateBrand(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.brandCRUD())
}

func (h *AllianceHandler) DeleteBrand(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.brandCRUD())
}

// ===== 公开 API（门户前台） =====

func (h *AllianceHandler) GetPublicSchoolInfo(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "缺少 tenantId")
		return
	}
	info, err := h.Store.GetSchoolInfo(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondJSON(w, http.StatusOK, &domain.AllianceSchoolInfo{})
			return
		}
		respondServerError(w, r, err, "获取失败")
		return
	}
	respondJSON(w, http.StatusOK, info)
}

func (h *AllianceHandler) ListPublicEnterprises(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceEnterprise, error) {
		return h.Store.ListPublicEnterprises(ctx, tenantID)
	})
}

func (h *AllianceHandler) GetPublicEnterprise(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceEnterprise, error) {
		return h.Store.GetPublicEnterpriseByID(ctx, id, tenantID)
	}, "企业不存在")
}

func (h *AllianceHandler) ListPublicProjects(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceProject, error) {
		return h.Store.ListPublicProjects(ctx, tenantID)
	})
}

func (h *AllianceHandler) GetPublicProject(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceProject, error) {
		return h.Store.GetPublicProjectByID(ctx, id, tenantID)
	}, "项目不存在")
}

func (h *AllianceHandler) ListPublicAchievements(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceAchievement, error) {
		return h.Store.ListPublicAchievements(ctx, tenantID)
	})
}

func (h *AllianceHandler) GetPublicAchievement(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceAchievement, error) {
		return h.Store.GetPublicAchievementByID(ctx, id, tenantID)
	}, "成果不存在")
}

func (h *AllianceHandler) ListPublicAgreements(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AlliancePublicAgreement, error) {
		return h.Store.ListPublicAgreements(ctx, tenantID)
	})
}

func (h *AllianceHandler) ListPublicExperts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceExpert, error) {
		return h.Store.ListPublicExperts(ctx, tenantID)
	})
}

func (h *AllianceHandler) GetPublicExpert(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceExpert, error) {
		return h.Store.GetPublicExpertByID(ctx, id, tenantID)
	}, "专家不存在")
}

func (h *AllianceHandler) ListPublicBrands(w http.ResponseWriter, r *http.Request) {
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceBrand, error) {
		return h.Store.ListPublicBrands(ctx, r.URL.Query().Get("brandType"))
	})
}

func (h *AllianceHandler) GetPublicBrand(w http.ResponseWriter, r *http.Request) {
	alliancePublicGet(w, r, h.Store.GetPublicBrandByID, "品牌不存在")
}

func (h *AllianceHandler) GetPublicStats(w http.ResponseWriter, r *http.Request) {
	stats := h.Store.GetPublicStats(r.Context(), r.URL.Query().Get("tenantId"))
	respondJSON(w, http.StatusOK, map[string]int{
		"enterpriseCount":  stats.EnterpriseCount,
		"projectCount":     stats.ProjectCount,
		"expertCount":      stats.ExpertCount,
		"achievementCount": stats.AchievementCount,
		"brandCount":       stats.BrandCount,
	})
}
