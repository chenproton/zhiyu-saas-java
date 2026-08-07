package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AllianceHandler struct {
	Store *store.AllianceStore
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

	updated, _ := h.Store.GetSchoolInfo(r.Context(), tenantID)
	respondJSON(w, http.StatusOK, updated)
}

// ===== 合作企业 =====

func (h *AllianceHandler) ListEnterprises(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListEnterprisesConfig(), "查询企业列表失败")
}

func (h *AllianceHandler) GetEnterprise(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.enterpriseCRUD())
}

func (h *AllianceHandler) CreateEnterprise(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.enterpriseCRUD())
}

func (h *AllianceHandler) UpdateEnterprise(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.enterpriseCRUD())
}

func (h *AllianceHandler) DeleteEnterprise(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.enterpriseCRUD())
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), eid, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}

	items, err := h.Store.ListEnterpriseAgreements(r.Context(), eid)
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), eid, tenantID); err != nil {
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

	item, _ := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), eid, tenantID); err != nil {
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

	item, _ := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), eid, tenantID); err != nil {
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
	items, err := h.Store.ListMilestones(r.Context(), pid)
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

// ===== 专家 =====

func (h *AllianceHandler) ListExperts(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListExpertsConfig(), "查询专家列表失败")
}

func (h *AllianceHandler) GetExpert(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.expertCRUD())
}

func (h *AllianceHandler) CreateExpert(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.expertCRUD())
}

func (h *AllianceHandler) UpdateExpert(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.expertCRUD())
}

func (h *AllianceHandler) DeleteExpert(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.expertCRUD())
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
	if _, err := h.Store.GetDictionaryByID(r.Context(), id, tenantID); err != nil {
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
	alliancePublicList(w, r, h.Store.ListPublicEnterprises)
}

func (h *AllianceHandler) GetPublicEnterprise(w http.ResponseWriter, r *http.Request) {
	alliancePublicGet(w, r, h.Store.GetPublicEnterpriseByID, "企业不存在")
}

func (h *AllianceHandler) ListPublicProjects(w http.ResponseWriter, r *http.Request) {
	alliancePublicList(w, r, h.Store.ListPublicProjects)
}

func (h *AllianceHandler) GetPublicProject(w http.ResponseWriter, r *http.Request) {
	alliancePublicGet(w, r, h.Store.GetPublicProjectByID, "项目不存在")
}

func (h *AllianceHandler) ListPublicAchievements(w http.ResponseWriter, r *http.Request) {
	alliancePublicList(w, r, h.Store.ListPublicAchievements)
}

func (h *AllianceHandler) GetPublicAchievement(w http.ResponseWriter, r *http.Request) {
	alliancePublicGet(w, r, h.Store.GetPublicAchievementByID, "成果不存在")
}

func (h *AllianceHandler) ListPublicExperts(w http.ResponseWriter, r *http.Request) {
	alliancePublicList(w, r, h.Store.ListPublicExperts)
}

func (h *AllianceHandler) GetPublicExpert(w http.ResponseWriter, r *http.Request) {
	alliancePublicGet(w, r, h.Store.GetPublicExpertByID, "专家不存在")
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
	stats := h.Store.GetPublicStats(r.Context())
	respondJSON(w, http.StatusOK, map[string]int{
		"enterpriseCount":  stats.EnterpriseCount,
		"projectCount":     stats.ProjectCount,
		"expertCount":      stats.ExpertCount,
		"achievementCount": stats.AchievementCount,
		"brandCount":       stats.BrandCount,
	})
}
