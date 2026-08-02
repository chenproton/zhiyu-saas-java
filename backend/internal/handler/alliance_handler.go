package handler

import (
	"context"
	"errors"
	"log/slog"
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

type allianceListResponse struct {
	Items interface{} `json:"items"`
	Total int         `json:"total"`
}

// ===== 学校信息 =====

func (h *AllianceHandler) GetSchoolInfo(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	_ = claims

	info, err := h.Store.GetSchoolInfo(r.Context(), tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondJSON(w, http.StatusOK, &domain.AllianceSchoolInfo{
				TenantID: tenantID,
				Name:     "",
			})
			return
		}
		slog.Error("获取学校信息失败", "error", err)
		respondError(w, http.StatusInternalServerError, "获取学校信息失败")
		return
	}
	respondJSON(w, http.StatusOK, info)
}

func (h *AllianceHandler) UpdateSchoolInfo(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
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
		slog.Error("更新学校信息失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新学校信息失败")
		return
	}

	updated, _ := h.Store.GetSchoolInfo(r.Context(), tenantID)
	respondJSON(w, http.StatusOK, updated)
}

// ===== 合作企业 =====

func (h *AllianceHandler) ListEnterprises(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	rating := r.URL.Query().Get("rating")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceEnterprise]{
		Table: "alliance_enterprises",
		SelectColumns: "id, tenant_id, name, enterprise_type, industry, region, description, " +
			"logo_url, cover_image, status, rating, cooperation_types, contact_person, " +
			"contact_phone, contact_email, address, unified_social_credit_code, " +
			"established_year, employee_count, business_license_photos, qualification_photos, " +
			"intellectual_property_photos, cover_photos, secondary_colleges, rating_record, " +
			"is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if rating != "" {
				qb.AddCondition("rating = " + qb.NextArg(rating))
			}
		},
		ScanRows: h.Store.ScanEnterpriseRows,
	}, "查询企业列表失败")
}

func (h *AllianceHandler) GetEnterprise(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetEnterpriseByID, "企业不存在")
}

func (h *AllianceHandler) CreateEnterprise(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.enterpriseCRUD())
}

func (h *AllianceHandler) UpdateEnterprise(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.enterpriseCRUD())
}

func (h *AllianceHandler) DeleteEnterprise(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.enterpriseCRUD())
}

// ===== 企业合作协议 =====

func (h *AllianceHandler) ListEnterpriseAgreements(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	eid := chi.URLParam(r, "eid")

	items, err := h.Store.ListEnterpriseAgreements(r.Context(), eid)
	if err != nil {
		slog.Error("查询企业协议列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	eid := chi.URLParam(r, "eid")
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
		slog.Error("创建企业协议失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}

	item, _ := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, item)
}

func (h *AllianceHandler) UpdateEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "协议不存在")
		return
	}

	var p store.AllianceEnterpriseAgreementUpdateParams
	if !decodeBody(w, r, &p) {
		return
	}
	if err := h.Store.UpdateEnterpriseAgreement(r.Context(), id, &p); err != nil {
		slog.Error("更新企业协议失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}

	item, _ := h.Store.GetEnterpriseAgreementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, item)
}

func (h *AllianceHandler) DeleteEnterpriseAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteEnterpriseAgreement(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 合作项目 =====

func (h *AllianceHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	phase := r.URL.Query().Get("phase")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceProject]{
		Table:         "alliance_projects",
		SelectColumns: "id, tenant_id, name, type, description, phase, publish_status, start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if phase != "" {
				qb.AddCondition("phase = " + qb.NextArg(phase))
			}
		},
		ScanRows: h.Store.ScanProjectRows,
	}, "查询项目列表失败")
}

func (h *AllianceHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetProjectByID, "项目不存在")
}

func (h *AllianceHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.projectCRUD())
}

func (h *AllianceHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.projectCRUD())
}

func (h *AllianceHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.projectCRUD())
}

// ===== 里程碑 =====

func (h *AllianceHandler) ListMilestones(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	pid := chi.URLParam(r, "pid")
	items, err := h.Store.ListMilestones(r.Context(), pid)
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	pid := chi.URLParam(r, "pid")
	var m domain.AllianceProjectMilestone
	if !decodeBody(w, r, &m) {
		return
	}
	m.TenantID = tenantID
	m.ProjectID = pid

	id, err := h.Store.CreateMilestone(r.Context(), &m)
	if err != nil {
		slog.Error("创建里程碑失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdateMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID := ""
	if c := middleware.CurrentUser(r); c != nil && c.TenantID != nil {
		tenantID = *c.TenantID
	}

	id := chi.URLParam(r, "id")
	var m domain.AllianceProjectMilestone
	if !decodeBody(w, r, &m) {
		return
	}
	if err := h.Store.UpdateMilestone(r.Context(), id, &m); err != nil {
		slog.Error("更新里程碑失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	_ = tenantID
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeleteMilestone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteMilestone(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 合作成果 =====

func (h *AllianceHandler) ListAchievements(w http.ResponseWriter, r *http.Request) {
	achieveType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceAchievement]{
		Table:         "alliance_achievements",
		SelectColumns: "id, tenant_id, title, type, description, achievement_date, cover_image, attachments, citation_reason, images, owner_persons, co_builders, enterprise_ids, project_ids, related_positions, related_scenes, related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"title"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if achieveType != "" {
				qb.AddCondition("type = " + qb.NextArg(achieveType))
			}
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: h.Store.ScanAchievementRows,
	}, "查询成果列表失败")
}

func (h *AllianceHandler) GetAchievement(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetAchievementByID, "成果不存在")
}

func (h *AllianceHandler) CreateAchievement(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.achievementCRUD())
}

func (h *AllianceHandler) UpdateAchievement(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.achievementCRUD())
}

func (h *AllianceHandler) DeleteAchievement(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.achievementCRUD())
}

// ===== 专家 =====

func (h *AllianceHandler) ListExperts(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceExpert]{
		Table:         "alliance_experts",
		SelectColumns: "id, tenant_id, name, gender, age, title, position, expert_type, industry, professional_fields, specialties, experience_years, education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "title", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: h.Store.ScanExpertRows,
	}, "查询专家列表失败")
}

func (h *AllianceHandler) GetExpert(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetExpertByID, "专家不存在")
}

func (h *AllianceHandler) CreateExpert(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.expertCRUD())
}

func (h *AllianceHandler) UpdateExpert(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.expertCRUD())
}

func (h *AllianceHandler) DeleteExpert(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.expertCRUD())
}

// ===== 合作协议（独立） =====

func (h *AllianceHandler) ListAgreements(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceAgreement]{
		Table:         "alliance_agreements",
		SelectColumns: "id, tenant_id, name, type, content, start_date, end_date, status, enterprise_ids, project_ids, attachments, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: h.Store.ScanAgreementRows,
	}, "查询协议列表失败")
}

func (h *AllianceHandler) GetAgreement(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetAgreementByID, "协议不存在")
}

func (h *AllianceHandler) CreateAgreement(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.agreementCRUD())
}

func (h *AllianceHandler) UpdateAgreement(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.agreementCRUD())
}

func (h *AllianceHandler) DeleteAgreement(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.agreementCRUD())
}

// ===== 权限 =====

func (h *AllianceHandler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.AlliancePermission](r.Context(), h.Store.Q(), r, store.ListQueryConfig[domain.AlliancePermission]{
		Table:         "alliance_permissions",
		SelectColumns: "id, tenant_id, account_name, account_type, enterprise_id, expert_id, is_enabled, resource_permissions, platform_permissions, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"account_name"},
		OrderBy:       "created_at DESC",
		ScanRows:      h.Store.ScanPermissionRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询权限列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询权限列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetPermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
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
	if !canManagePortal(claims) {
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
		slog.Error("创建权限失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var p domain.AlliancePermission
	if !decodeBody(w, r, &p) {
		return
	}
	_ = tenantID
	if err := h.Store.UpdatePermission(r.Context(), id, &p); err != nil {
		slog.Error("更新权限失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeletePermission(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
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
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) CreateDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
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
		slog.Error("创建字典项失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *AllianceHandler) UpdateDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")

	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sortOrder"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if err := h.Store.UpdateDictionary(r.Context(), id, &domain.AllianceDictionary{
		Name:      req.Name,
		SortOrder: req.SortOrder,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AllianceHandler) DeleteDictionaryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteDictionary(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 品牌 =====

func (h *AllianceHandler) ListBrands(w http.ResponseWriter, r *http.Request) {
	brandType := r.URL.Query().Get("brandType")
	status := r.URL.Query().Get("status")
	allianceList(w, r, h.Store.Q(), store.ListQueryConfig[domain.AllianceBrand]{
		Table:         "alliance_brands",
		SelectColumns: "id, tenant_id, brand_type, name, status, is_public, is_featured, cover_image, cover_video, description, data, student_id, enterprise_id, position_id, major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if brandType != "" {
				qb.AddCondition("brand_type = " + qb.NextArg(brandType))
			}
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: h.Store.ScanBrandRows,
	}, "查询品牌列表失败")
}

func (h *AllianceHandler) GetBrand(w http.ResponseWriter, r *http.Request) {
	allianceGet(w, r, h.Store.GetBrandByID, "品牌不存在")
}

func (h *AllianceHandler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	allianceCreate(w, r, h.brandCRUD())
}

func (h *AllianceHandler) UpdateBrand(w http.ResponseWriter, r *http.Request) {
	allianceUpdate(w, r, h.brandCRUD())
}

func (h *AllianceHandler) DeleteBrand(w http.ResponseWriter, r *http.Request) {
	allianceDelete(w, r, h.brandCRUD())
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
		respondError(w, http.StatusInternalServerError, "获取失败")
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
