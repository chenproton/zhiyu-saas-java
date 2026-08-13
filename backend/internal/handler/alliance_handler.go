package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AllianceHandler struct {
	Store  *store.AllianceStore
	Links  *store.AllianceEnterpriseLinkStore
	Grants *store.AllianceGrantStore
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
	filter.Limit, filter.Offset = parseLimitOffset(r, 200)
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

// ===== 学校-企业资源授权（alliance_resource_grants） =====

// ListGrants 学校查看某企业的资源授权（position/scene 两行）。
func (h *AllianceHandler) ListGrants(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	enterpriseID := r.URL.Query().Get("enterpriseId")
	if enterpriseID == "" {
		respondError(w, http.StatusBadRequest, "缺少企业参数")
		return
	}
	items, err := h.Grants.ListBySchool(r.Context(), tenantID, enterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询授权失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"enterpriseId": enterpriseID,
		"grants":       items,
	})
}

// saveGrantsRequest 保存授权请求（覆盖式：整组替换某类型资源授权）。
type saveGrantsRequest struct {
	EnterpriseID string   `json:"enterpriseId"`
	ResourceType string   `json:"resourceType"` // position | scene
	ResourceIDs  []string `json:"resourceIds"`
}

// SaveGrants 保存某企业对某类型资源的编辑授权（空数组 = 清空授权）。
func (h *AllianceHandler) SaveGrants(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req saveGrantsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.EnterpriseID == "" {
		respondError(w, http.StatusBadRequest, "缺少企业参数")
		return
	}
	if req.ResourceType != "position" && req.ResourceType != "scene" {
		respondError(w, http.StatusBadRequest, "无效资源类型")
		return
	}
	// 仅允许对本校已引入企业授权
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), req.EnterpriseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业未引入或不存在")
		return
	}
	// 资源归属校验：只能授权本校的岗位/场景（防跨租户授权）
	if ok, err := h.Grants.VerifyGrantsOwnership(r.Context(), tenantID, req.ResourceType, req.ResourceIDs); err != nil {
		respondServerError(w, r, err, "校验授权资源失败")
		return
	} else if !ok {
		respondError(w, http.StatusBadRequest, "包含非本校资源，无法授权")
		return
	}
	// 保存时自动并入该企业共建资源（新建共建资源已自动授权，此处防止整组保存误删）
	if err := h.Grants.UpsertMergingCoBuilt(r.Context(), tenantID, req.EnterpriseID, req.ResourceType, req.ResourceIDs, claims.UserID); err != nil {
		respondServerError(w, r, err, "保存授权失败")
		return
	}
	items, err := h.Grants.ListBySchool(r.Context(), tenantID, req.EnterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询授权失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"enterpriseId": req.EnterpriseID,
		"grants":       items,
	})
}

// ListGrantResourceOptions 学校可授权资源候选（该企业共建 + 学校自建已发布）。
func (h *AllianceHandler) ListGrantResourceOptions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	enterpriseID := r.URL.Query().Get("enterpriseId")
	if enterpriseID == "" {
		respondError(w, http.StatusBadRequest, "缺少企业参数")
		return
	}
	items, err := h.Grants.ResourceOptions(r.Context(), tenantID, enterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询资源失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceGrantResourceOption]{Items: items, Total: len(items)})
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
	// 状态白名单（与字典 enterprise_status / 企业侧流转表一致），防写入任意字符串
	switch req.Status {
	case "negotiating", "active", "paused", "terminated":
	default:
		respondError(w, http.StatusBadRequest, "无效的合作状态")
		return
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
	// 指针包装区分「未携带」与「默认值」：isCompleted/sortOrder 未携带时回退已有值，
	// 防止局部编辑把已完成里程碑重置为未完成、排序重置为 0
	var m struct {
		ProjectID     string  `json:"projectId"`
		Name          string  `json:"name"`
		Description   *string `json:"description"`
		DueDate       *string `json:"dueDate"`
		CompletedDate *string `json:"completedDate"`
		IsCompleted   *bool   `json:"isCompleted"`
		SortOrder     *int    `json:"sortOrder"`
	}
	if !decodeBody(w, r, &m) {
		return
	}
	// 部分更新兜底：缺失字段回退已有值，防止全列覆盖清空数据
	milestone := *existing
	if m.ProjectID != "" {
		milestone.ProjectID = m.ProjectID
	}
	if m.Name != "" {
		milestone.Name = m.Name
	}
	if m.Description != nil {
		milestone.Description = m.Description
	}
	if m.DueDate != nil {
		milestone.DueDate = m.DueDate
	}
	if m.CompletedDate != nil {
		milestone.CompletedDate = m.CompletedDate
	}
	if m.IsCompleted != nil {
		milestone.IsCompleted = *m.IsCompleted
	}
	if m.SortOrder != nil {
		milestone.SortOrder = *m.SortOrder
	}
	if err := h.Store.UpdateMilestone(r.Context(), id, tenantID, &milestone); err != nil {
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
	filter.Limit, filter.Offset = parseLimitOffset(r, 200)
	items, total, err := h.Store.ListByEnterpriseIDs(r.Context(), tenantID, enterpriseIDs, filter)
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
	// 校本教师专家档案副本（enterprise_id 为空且属于本校租户）：允许本校直接读取/编辑
	if expert.EnterpriseID == nil {
		if expert.TenantID != tenantID {
			respondError(w, http.StatusNotFound, "专家不存在")
			return
		}
		respondJSON(w, http.StatusOK, expert)
		return
	}
	// 越权防线：专家所属企业必须在本校 links 内
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), *expert.EnterpriseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	respondJSON(w, http.StatusOK, expert)
}

// CreateSchoolExpert 学校侧创建专家档案（用于校本师资品牌资料补充：复制教师为无企业关联的专家档案，
// 与 /partner/experts 共用 alliance_experts 表，不单独建表）。
func (h *AllianceHandler) CreateSchoolExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req domain.AllianceExpert
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求体")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "姓名不能为空")
		return
	}
	if req.UserID != nil && *req.UserID != "" {
		// 同一教师仅保留一份专家档案副本
		existing, err := h.Store.GetExpertByUserID(r.Context(), tenantID, *req.UserID)
		if err == nil && existing != nil {
			respondJSON(w, http.StatusOK, existing)
			return
		}
	}
	req.ID = ""
	req.TenantID = tenantID
	req.EnterpriseID = nil
	if req.Status == "" {
		req.Status = "active"
	}
	if req.ExpertType == nil || *req.ExpertType == "" {
		expertType := "teacher"
		req.ExpertType = &expertType
	}
	id, err := h.Store.CreateExpert(r.Context(), &req)
	if err != nil {
		respondServerError(w, r, err, "创建专家档案失败")
		return
	}
	req.ID = id
	respondJSON(w, http.StatusOK, req)
}

// UpdateSchoolExpert 学校侧更新专家档案（仅限本校创建的无企业关联档案，即校本教师资料副本）。
func (h *AllianceHandler) UpdateSchoolExpert(w http.ResponseWriter, r *http.Request) {
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
	expert, err := h.Store.GetExpertByIDGlobal(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if expert.EnterpriseID != nil || expert.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "仅可编辑本校创建的师资档案")
		return
	}
	var req domain.AllianceExpert
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求体")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "姓名不能为空")
		return
	}
	req.ID = id
	req.TenantID = tenantID
	req.UserID = expert.UserID
	req.CreatedAt = expert.CreatedAt
	// 部分更新兜底：未携带字段回退已有值（评级/照片/二级学院/就业方向等
	// 学校侧维护字段不得被清空；展示开关未携带时保留已有状态）
	applyExpertPartialUpdate(&req, expert)
	// 校本教师资料副本不得关联企业
	req.EnterpriseID = nil
	if err := h.Store.UpdateExpert(r.Context(), id, tenantID, &req); err != nil {
		respondServerError(w, r, err, "更新专家档案失败")
		return
	}
	respondJSON(w, http.StatusOK, req)
}

// DeleteSchoolExpert 学校侧删除专家档案（仅限本校创建的无企业关联档案，即校本教师资料副本）。
func (h *AllianceHandler) DeleteSchoolExpert(w http.ResponseWriter, r *http.Request) {
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
	expert, err := h.Store.GetExpertByIDGlobal(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if expert.EnterpriseID != nil || expert.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "仅可删除本校创建的师资档案")
		return
	}
	if err := h.Store.DeleteExpert(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除专家档案失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
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
	// 指针包装区分「未携带」与「默认值」：isEnabled 未携带时回退已有状态，
	// 防止局部更新把已启用权限重置为停用
	var req struct {
		AccountName         string          `json:"accountName"`
		AccountType         string          `json:"accountType"`
		EnterpriseID        *string         `json:"enterpriseId"`
		ExpertID            *string         `json:"expertId"`
		IsEnabled           *bool           `json:"isEnabled"`
		ResourcePermissions json.RawMessage `json:"resourcePermissions"`
		PlatformPermissions json.RawMessage `json:"platformPermissions"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	// 部分更新兜底：请求未携带的字段回退到已存在记录，避免 PUT 全列覆盖清空数据。
	p := *existing
	if req.AccountName != "" {
		p.AccountName = req.AccountName
	}
	if req.AccountType != "" {
		p.AccountType = req.AccountType
	}
	if req.EnterpriseID != nil {
		p.EnterpriseID = req.EnterpriseID
	}
	if req.ExpertID != nil {
		p.ExpertID = req.ExpertID
	}
	if req.IsEnabled != nil {
		p.IsEnabled = *req.IsEnabled
	}
	if len(req.ResourcePermissions) > 0 {
		p.ResourcePermissions = req.ResourcePermissions
	}
	if len(req.PlatformPermissions) > 0 {
		p.PlatformPermissions = req.PlatformPermissions
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

	// SortOrder 指针区分「未携带」与 0：局部更新（如仅改名）不重置排序
	var req struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sortOrder"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	// 部分更新兜底：未携带 name 时回退现有值，防止全列覆盖清空字典项名
	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}
	sortOrder := existing.SortOrder
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	if err := h.Store.UpdateDictionary(r.Context(), id, tenantID, &domain.AllianceDictionary{
		Name:      name,
		SortOrder: sortOrder,
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
	switch r.URL.Query().Get("brandType") {
	case "employer":
		h.listEmployerBrands(w, r)
		return
	case "job":
		h.listJobBrands(w, r)
		return
	}
	allianceList(w, r, h.Store.Q(), h.Store.ListBrandsConfig(), "查询品牌列表失败")
}

// listJobBrands 岗位品牌列表（含关联岗位资料，支持名称搜索与分页）。
func (h *AllianceHandler) listJobBrands(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	search := r.URL.Query().Get("search")
	limit, offset := parseLimitOffset(r, 20)
	items, total, err := h.Store.ListJobBrands(r.Context(), tenantID, search, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询品牌列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.JobBrand]{Items: items, Total: total})
}

// listEmployerBrands 雇主品牌列表（含引用企业资料，支持名称搜索与分页）。
func (h *AllianceHandler) listEmployerBrands(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	search := r.URL.Query().Get("search")
	limit, offset := parseLimitOffset(r, 20)
	items, total, err := h.Store.ListEmployerBrands(r.Context(), tenantID, search, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询品牌列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EmployerBrand]{Items: items, Total: total})
}

func (h *AllianceHandler) GetBrand(w http.ResponseWriter, r *http.Request) {
	if !crudCheckPermit(w, r, func(r *http.Request) bool { return canManageAlliance(middleware.CurrentUser(r)) }) {
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetBrandByID(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "品牌不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if item.BrandType == "employer" {
		if eb, err := h.Store.GetEmployerBrandByID(r.Context(), id, tenantID); err == nil {
			respondJSON(w, http.StatusOK, eb)
			return
		}
	}
	if item.BrandType == "job" {
		if jb, err := h.Store.GetJobBrandByID(r.Context(), id, tenantID); err == nil {
			respondJSON(w, http.StatusOK, jb)
			return
		}
	}
	respondJSON(w, http.StatusOK, item)
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

// ===== 人才画像排名 =====

func (h *AllianceHandler) ListTalentRanking(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	groups, err := h.Store.ListTalentRanking(r.Context(), tenantID, r.URL.Query().Get("search"), false)
	if err != nil {
		respondServerError(w, r, err, "查询人才画像排名失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": groups})
}

func (h *AllianceHandler) ListBrandMajorRankConfigs(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListBrandMajorRankConfigs(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询专业排名配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

// SaveBrandMajorRankConfigs 批量保存专业排名启用配置（路由挂 RequireAllianceManager）。
func (h *AllianceHandler) SaveBrandMajorRankConfigs(w http.ResponseWriter, r *http.Request) {
	// 与同文件其余写接口一致：handler 内补权限校验（纵深防御，不依赖路由中间件）
	if !canManageAlliance(middleware.CurrentUser(r)) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var body struct {
		Configs []domain.BrandMajorRankConfig `json:"configs"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if err := h.Store.SaveBrandMajorRankConfigs(r.Context(), tenantID, body.Configs); err != nil {
		respondServerError(w, r, err, "保存专业排名配置失败")
		return
	}
	items, err := h.Store.ListBrandMajorRankConfigs(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询专业排名配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

// ListPublicTalentRanking 公开人才画像排名：仅启用专业，每专业前 rankLimit 名（供前台 landing）。
// tenantId 缺失时（auth 未就绪的瞬态请求）返回空列表，避免 400 报错刷屏。
func (h *AllianceHandler) ListPublicTalentRanking(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		respondJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}
	groups, err := h.Store.ListTalentRanking(r.Context(), tenantID, r.URL.Query().Get("search"), true)
	if err != nil {
		respondServerError(w, r, err, "查询人才画像排名失败")
		return
	}
	out := make([]domain.TalentRankMajorGroup, 0, len(groups))
	for _, g := range groups {
		if !g.Enabled {
			continue
		}
		if len(g.Students) > g.RankLimit {
			g.Students = g.Students[:g.RankLimit]
		}
		for i := range g.Students {
			g.Students[i].Positions = nil
		}
		out = append(out, g)
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": out})
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
	limit, offset := publicListParams(r)
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceEnterprise, error) {
		return h.Store.ListPublicEnterprises(ctx, tenantID, limit, offset)
	})
}

func (h *AllianceHandler) GetPublicEnterprise(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceEnterprise, error) {
		return h.Store.GetPublicEnterpriseByID(ctx, id, tenantID)
	}, "企业不存在")
}

// publicListParams 解析公开列表分页参数（limit 默认 100，上限 500；offset 默认 0）。
func publicListParams(r *http.Request) (limit, offset int) {
	if v, err := parseInt(r.URL.Query().Get("limit"), 100); err == nil && v > 0 {
		limit = v
	} else {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	return limit, offset
}

func (h *AllianceHandler) ListPublicProjects(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	limit, offset := publicListParams(r)
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceProject, error) {
		return h.Store.ListPublicProjects(ctx, tenantID, limit, offset)
	})
}

func (h *AllianceHandler) GetPublicProject(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetPublicProjectByID(r.Context(), id, tenantID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "项目不存在")
		return
	}
	h.Store.IncrementAllianceView(r.Context(), "alliance_projects", id)
	respondJSON(w, http.StatusOK, item)
}

// ListPublicMilestones 前台公开里程碑（含本校链接双控，规则同 GetPublicProject）。
func (h *AllianceHandler) ListPublicMilestones(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	projectID := chi.URLParam(r, "pid")
	if projectID == "" {
		respondError(w, http.StatusBadRequest, "缺少项目 id")
		return
	}
	items, err := h.Store.ListPublicMilestones(r.Context(), projectID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询里程碑失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceProjectMilestone]{Items: items, Total: len(items)})
}

func (h *AllianceHandler) ListPublicAchievements(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	limit, offset := publicListParams(r)
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceAchievement, error) {
		return h.Store.ListPublicAchievements(ctx, tenantID, limit, offset)
	})
}

func (h *AllianceHandler) GetPublicAchievement(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetPublicAchievementByID(r.Context(), id, tenantID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "成果不存在")
		return
	}
	h.Store.IncrementAllianceView(r.Context(), "alliance_achievements", id)
	respondJSON(w, http.StatusOK, item)
}

func (h *AllianceHandler) ListPublicAgreements(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	limit, offset := publicListParams(r)
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AlliancePublicAgreement, error) {
		return h.Store.ListPublicAgreements(ctx, tenantID, limit, offset)
	})
}

// ListPublicExperts 前台公开专家列表；includeNonPublic=true 时忽略专家 is_public
// （企业详情页"专家团队"用）。仅已登录用户可用，匿名访客强制 is_public 过滤，
// 防止隐私开关被查询参数绕过。
func (h *AllianceHandler) ListPublicExperts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	limit, offset := publicListParams(r)
	includeNonPublic := false
	if middleware.CurrentUser(r) != nil {
		includeNonPublic = r.URL.Query().Get("includeNonPublic") == "true"
	}
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.AllianceExpert, error) {
		return h.Store.ListPublicExperts(ctx, tenantID, limit, offset, includeNonPublic)
	})
}

// ToggleExpertDisplay 学校侧维护专家"前台展示"开关（PUT /alliance/experts/{id}/display）。
// 仅控制专家在联盟首页等 is_public 双控场景的展示，企业详情页"专家团队"不受影响。
// 越权防线与 GetExpert 一致：专家所属企业必须已引入本校。
func (h *AllianceHandler) ToggleExpertDisplay(w http.ResponseWriter, r *http.Request) {
	// 与同文件其余写接口一致：handler 内补权限校验（纵深防御，不依赖路由中间件）
	if !canManageAlliance(middleware.CurrentUser(r)) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	expertID := chi.URLParam(r, "id")
	var req struct {
		IsPublic bool `json:"isPublic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "请求参数错误")
		return
	}
	expert, err := h.Store.GetExpertByIDGlobal(r.Context(), expertID)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if expert.EnterpriseID == nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if _, err := h.Links.GetLinkByEnterprise(r.Context(), *expert.EnterpriseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	if err := h.Store.UpdateExpertIsPublic(r.Context(), expertID, tenantID, req.IsPublic); err != nil {
		respondServerError(w, r, err, "更新前台展示失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"id": expertID, "isPublic": req.IsPublic})
}

func (h *AllianceHandler) GetPublicExpert(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicGet(w, r, func(ctx context.Context, id string) (*domain.AllianceExpert, error) {
		return h.Store.GetPublicExpertByID(ctx, id, tenantID)
	}, "专家不存在")
}

func (h *AllianceHandler) ListPublicBrands(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.PublicBrandItem, error) {
		return h.Store.ListPublicBrands(ctx, tenantID, r.URL.Query().Get("brandType"))
	})
}

func (h *AllianceHandler) GetPublicBrand(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetPublicBrandByID(r.Context(), id, tenantID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "品牌不存在")
		return
	}
	h.Store.IncrementAllianceView(r.Context(), "alliance_brands", id)
	respondJSON(w, http.StatusOK, item)
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
