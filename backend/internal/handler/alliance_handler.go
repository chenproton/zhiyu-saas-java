package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

func formatNullableDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

type AllianceHandler struct {
	DB    *pgxpool.Pool
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
	if err := json.NewDecoder(r.Body).Decode(&info); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	status := r.URL.Query().Get("status")
	rating := r.URL.Query().Get("rating")
	selectCols := "id, tenant_id, name, enterprise_type, industry, region, description, " +
		"logo_url, cover_image, status, rating, cooperation_types, contact_person, " +
		"contact_phone, contact_email, address, unified_social_credit_code, " +
		"established_year, employee_count, business_license_photos, qualification_photos, " +
		"intellectual_property_photos, cover_photos, secondary_colleges, rating_record, " +
		"is_public, created_by, created_at, updated_at"

	items, total, err := executeListQuery[domain.AllianceEnterprise](r.Context(), h.DB, r, listQueryConfig[domain.AllianceEnterprise]{
		Table:         "alliance_enterprises",
		SelectColumns: selectCols,
		TenantScoped:  true,
		SearchColumns: []string{"name", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
			if rating != "" {
				qb.addCondition("rating = " + qb.nextArg(rating))
			}
		},
		ScanRows: h.Store.ScanEnterpriseRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询企业列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询企业列表失败")
		return
	}

	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetEnterprise(w http.ResponseWriter, r *http.Request) {
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
	enterprise, err := h.Store.GetEnterpriseByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}
	respondJSON(w, http.StatusOK, enterprise)
}

func (h *AllianceHandler) CreateEnterprise(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var body struct {
		Name                       string          `json:"name"`
		EnterpriseType             string          `json:"enterpriseType"`
		Industry                   *string         `json:"industry"`
		Region                     *string         `json:"region"`
		Description                *string         `json:"description"`
		LogoURL                    *string         `json:"logoUrl"`
		CoverImage                 *string         `json:"coverImage"`
		Status                     string          `json:"status"`
		Rating                     *string         `json:"rating"`
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
		SecondaryColleges          json.RawMessage `json:"secondaryColleges"`
		RatingRecord               json.RawMessage `json:"ratingRecord"`
		IsPublic                   bool            `json:"isPublic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if body.Name == "" {
		respondError(w, http.StatusBadRequest, "企业名称不能为空")
		return
	}
	if body.EnterpriseType == "" {
		body.EnterpriseType = "platform"
	}
	if body.Status == "" {
		body.Status = "negotiating"
	}

	id, err := h.Store.CreateEnterprise(r.Context(), &store.AllianceEnterpriseCreateParams{
		TenantID:                   tenantID,
		Name:                       body.Name,
		CreatedBy:                  &claims.UserID,
		EnterpriseType:             body.EnterpriseType,
		Industry:                   body.Industry,
		Region:                     body.Region,
		Description:                body.Description,
		LogoURL:                    body.LogoURL,
		CoverImage:                 body.CoverImage,
		Status:                     body.Status,
		Rating:                     body.Rating,
		CooperationTypes:           body.CooperationTypes,
		ContactPerson:              body.ContactPerson,
		ContactPhone:               body.ContactPhone,
		ContactEmail:               body.ContactEmail,
		Address:                    body.Address,
		UnifiedSocialCreditCode:    body.UnifiedSocialCreditCode,
		EstablishedYear:            body.EstablishedYear,
		EmployeeCount:              body.EmployeeCount,
		BusinessLicensePhotos:      body.BusinessLicensePhotos,
		QualificationPhotos:        body.QualificationPhotos,
		IntellectualPropertyPhotos: body.IntellectualPropertyPhotos,
		CoverPhotos:                body.CoverPhotos,
		SecondaryColleges:          body.SecondaryColleges,
		RatingRecord:               body.RatingRecord,
		IsPublic:                   body.IsPublic,
	})
	if err != nil {
		slog.Error("创建企业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建企业失败")
		return
	}

	enterprise, _ := h.Store.GetEnterpriseByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, enterprise)
}

func (h *AllianceHandler) UpdateEnterprise(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}

	var body struct {
		Name                       string          `json:"name"`
		EnterpriseType             string          `json:"enterpriseType"`
		Industry                   *string         `json:"industry"`
		Region                     *string         `json:"region"`
		Description                *string         `json:"description"`
		LogoURL                    *string         `json:"logoUrl"`
		CoverImage                 *string         `json:"coverImage"`
		Status                     string          `json:"status"`
		Rating                     *string         `json:"rating"`
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
		SecondaryColleges          json.RawMessage `json:"secondaryColleges"`
		RatingRecord               json.RawMessage `json:"ratingRecord"`
		IsPublic                   bool            `json:"isPublic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if err := h.Store.UpdateEnterprise(r.Context(), id, &store.AllianceEnterpriseUpdateParams{
		Name:                       body.Name,
		EnterpriseType:             body.EnterpriseType,
		Industry:                   body.Industry,
		Region:                     body.Region,
		Description:                body.Description,
		LogoURL:                    body.LogoURL,
		CoverImage:                 body.CoverImage,
		Status:                     body.Status,
		Rating:                     body.Rating,
		CooperationTypes:           body.CooperationTypes,
		ContactPerson:              body.ContactPerson,
		ContactPhone:               body.ContactPhone,
		ContactEmail:               body.ContactEmail,
		Address:                    body.Address,
		UnifiedSocialCreditCode:    body.UnifiedSocialCreditCode,
		EstablishedYear:            body.EstablishedYear,
		EmployeeCount:              body.EmployeeCount,
		BusinessLicensePhotos:      body.BusinessLicensePhotos,
		QualificationPhotos:        body.QualificationPhotos,
		IntellectualPropertyPhotos: body.IntellectualPropertyPhotos,
		CoverPhotos:                body.CoverPhotos,
		SecondaryColleges:          body.SecondaryColleges,
		RatingRecord:               body.RatingRecord,
		IsPublic:                   body.IsPublic,
	}); err != nil {
		slog.Error("更新企业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新企业失败")
		return
	}

	enterprise, _ := h.Store.GetEnterpriseByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, enterprise)
}

func (h *AllianceHandler) DeleteEnterprise(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetEnterpriseByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}

	if err := h.Store.DeleteEnterprise(r.Context(), id, tenantID); err != nil {
		slog.Error("删除企业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "删除企业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 企业合作协议 =====

func (h *AllianceHandler) ListEnterpriseAgreements(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	eid := chi.URLParam(r, "eid")

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, enterprise_id, name, type, start_date, end_date,
			status, content, attachments, created_at, updated_at
		FROM alliance_enterprise_agreements
		WHERE enterprise_id = $1
		ORDER BY created_at DESC
	`, eid)
	if err != nil {
		slog.Error("查询企业协议列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()

	items, err := h.Store.ScanEnterpriseAgreementRows(rows)
	if err != nil {
		slog.Error("扫描企业协议列表失败", "error", err)
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
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	phase := r.URL.Query().Get("phase")

	items, total, err := executeListQuery[domain.AllianceProject](r.Context(), h.DB, r, listQueryConfig[domain.AllianceProject]{
		Table:         "alliance_projects",
		SelectColumns: "id, tenant_id, name, type, description, phase, publish_status, start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if phase != "" {
				qb.addCondition("phase = " + qb.nextArg(phase))
			}
		},
		ScanRows: h.Store.ScanProjectRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询项目列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询项目列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetProject(w http.ResponseWriter, r *http.Request) {
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
	project, err := h.Store.GetProjectByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "项目不存在")
		return
	}
	respondJSON(w, http.StatusOK, project)
}

func (h *AllianceHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var p domain.AllianceProject
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	p.TenantID = tenantID
	if p.Name == "" {
		respondError(w, http.StatusBadRequest, "项目名称不能为空")
		return
	}

	p.CreatedBy = &claims.UserID
	id, err := h.Store.CreateProject(r.Context(), &p)
	if err != nil {
		slog.Error("创建项目失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	project, _ := h.Store.GetProjectByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, project)
}

func (h *AllianceHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetProjectByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "项目不存在")
		return
	}

	var p domain.AllianceProject
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateProject(r.Context(), id, &p); err != nil {
		slog.Error("更新项目失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新项目失败")
		return
	}
	project, _ := h.Store.GetProjectByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, project)
}

func (h *AllianceHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteProject(r.Context(), id, tenantID); err != nil {
		slog.Error("删除项目失败", "error", err)
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 里程碑 =====

func (h *AllianceHandler) ListMilestones(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	pid := chi.URLParam(r, "pid")
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, project_id, name, description, due_date, completed_date,
			is_completed, sort_order, created_at, updated_at
		FROM alliance_project_milestones WHERE project_id = $1 ORDER BY sort_order ASC
	`, pid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanMilestoneRows(rows)
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
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	achieveType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.AllianceAchievement](r.Context(), h.DB, r, listQueryConfig[domain.AllianceAchievement]{
		Table:         "alliance_achievements",
		SelectColumns: "id, tenant_id, title, type, description, achievement_date, cover_image, attachments, citation_reason, images, owner_persons, co_builders, enterprise_ids, project_ids, related_positions, related_scenes, related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"title"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if achieveType != "" {
				qb.addCondition("type = " + qb.nextArg(achieveType))
			}
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanAchievementRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询成果列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询成果列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetAchievement(w http.ResponseWriter, r *http.Request) {
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
	a, err := h.Store.GetAchievementByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "成果不存在")
		return
	}
	respondJSON(w, http.StatusOK, a)
}

func (h *AllianceHandler) CreateAchievement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var a domain.AllianceAchievement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	a.TenantID = tenantID
	if a.Title == "" {
		respondError(w, http.StatusBadRequest, "成果标题不能为空")
		return
	}

	a.CreatedBy = &claims.UserID
	id, err := h.Store.CreateAchievement(r.Context(), &a)
	if err != nil {
		slog.Error("创建成果失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建成果失败")
		return
	}
	ach, _ := h.Store.GetAchievementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, ach)
}

func (h *AllianceHandler) UpdateAchievement(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetAchievementByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "成果不存在")
		return
	}

	var a domain.AllianceAchievement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateAchievement(r.Context(), id, &a); err != nil {
		slog.Error("更新成果失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	ach, _ := h.Store.GetAchievementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, ach)
}

func (h *AllianceHandler) DeleteAchievement(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteAchievement(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 专家 =====

func (h *AllianceHandler) ListExperts(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.AllianceExpert](r.Context(), h.DB, r, listQueryConfig[domain.AllianceExpert]{
		Table:         "alliance_experts",
		SelectColumns: "id, tenant_id, name, gender, age, title, position, expert_type, industry, professional_fields, specialties, experience_years, education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "title", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanExpertRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询专家列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询专家列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetExpert(w http.ResponseWriter, r *http.Request) {
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
	e, err := h.Store.GetExpertByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	respondJSON(w, http.StatusOK, e)
}

func (h *AllianceHandler) CreateExpert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var e domain.AllianceExpert
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	e.TenantID = tenantID
	if e.Name == "" {
		respondError(w, http.StatusBadRequest, "专家姓名不能为空")
		return
	}

	e.CreatedBy = &claims.UserID
	id, err := h.Store.CreateExpert(r.Context(), &e)
	if err != nil {
		slog.Error("创建专家失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建专家失败")
		return
	}
	expert, _ := h.Store.GetExpertByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, expert)
}

func (h *AllianceHandler) UpdateExpert(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetExpertByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}

	var e domain.AllianceExpert
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateExpert(r.Context(), id, &e); err != nil {
		slog.Error("更新专家失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	expert, _ := h.Store.GetExpertByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, expert)
}

func (h *AllianceHandler) DeleteExpert(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteExpert(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 合作协议（独立） =====

func (h *AllianceHandler) ListAgreements(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.AllianceAgreement](r.Context(), h.DB, r, listQueryConfig[domain.AllianceAgreement]{
		Table:         "alliance_agreements",
		SelectColumns: "id, tenant_id, name, type, content, start_date, end_date, status, enterprise_ids, project_ids, attachments, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanAgreementRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询协议列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询协议列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetAgreement(w http.ResponseWriter, r *http.Request) {
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
	a, err := h.Store.GetAgreementByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "协议不存在")
		return
	}
	respondJSON(w, http.StatusOK, a)
}

func (h *AllianceHandler) CreateAgreement(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var a domain.AllianceAgreement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	a.TenantID = tenantID
	if a.Name == "" {
		respondError(w, http.StatusBadRequest, "协议名称不能为空")
		return
	}

	a.CreatedBy = &claims.UserID
	id, err := h.Store.CreateAgreement(r.Context(), &a)
	if err != nil {
		slog.Error("创建协议失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	agreement, _ := h.Store.GetAgreementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, agreement)
}

func (h *AllianceHandler) UpdateAgreement(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetAgreementByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "协议不存在")
		return
	}

	var a domain.AllianceAgreement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateAgreement(r.Context(), id, &a); err != nil {
		slog.Error("更新协议失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	agreement, _ := h.Store.GetAgreementByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, agreement)
}

func (h *AllianceHandler) DeleteAgreement(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteAgreement(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 权限 =====

func (h *AllianceHandler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.AlliancePermission](r.Context(), h.DB, r, listQueryConfig[domain.AlliancePermission]{
		Table:         "alliance_permissions",
		SelectColumns: "id, tenant_id, account_name, account_type, enterprise_id, expert_id, is_enabled, resource_permissions, platform_permissions, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"account_name"},
		OrderBy:       "created_at DESC",
		ScanRows:      h.Store.ScanPermissionRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
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
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, account_name, account_type, enterprise_id, expert_id,
			is_enabled, resource_permissions, platform_permissions, created_at, updated_at
		FROM alliance_permissions WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, err := h.Store.ScanPermissionRows(rows)
	if err != nil || len(items) == 0 {
		respondError(w, http.StatusNotFound, "权限不存在")
		return
	}
	respondJSON(w, http.StatusOK, items[0])
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
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, dict_type, code, name, sort_order, created_at
		FROM alliance_dictionaries WHERE dict_type = $1 AND tenant_id = $2 ORDER BY sort_order ASC
	`, dictType, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()

	items, _ := h.Store.ScanDictionaryRows(rows)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	brandType := r.URL.Query().Get("brandType")
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.AllianceBrand](r.Context(), h.DB, r, listQueryConfig[domain.AllianceBrand]{
		Table:         "alliance_brands",
		SelectColumns: "id, tenant_id, brand_type, name, status, is_public, is_featured, cover_image, cover_video, description, data, student_id, enterprise_id, position_id, major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if brandType != "" {
				qb.addCondition("brand_type = " + qb.nextArg(brandType))
			}
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanBrandRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询品牌列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询品牌列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetBrand(w http.ResponseWriter, r *http.Request) {
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
	b, err := h.Store.GetBrandByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "品牌不存在")
		return
	}
	respondJSON(w, http.StatusOK, b)
}

func (h *AllianceHandler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var b domain.AllianceBrand
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	b.TenantID = tenantID
	if b.Name == "" || b.BrandType == "" {
		respondError(w, http.StatusBadRequest, "品牌名称和类型不能为空")
		return
	}

	id, err := h.Store.CreateBrand(r.Context(), &b)
	if err != nil {
		slog.Error("创建品牌失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	brand, _ := h.Store.GetBrandByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, brand)
}

func (h *AllianceHandler) UpdateBrand(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetBrandByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "品牌不存在")
		return
	}

	var b domain.AllianceBrand
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateBrand(r.Context(), id, &b); err != nil {
		slog.Error("更新品牌失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	brand, _ := h.Store.GetBrandByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, brand)
}

func (h *AllianceHandler) DeleteBrand(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteBrand(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== 品牌专题页 =====

func (h *AllianceHandler) ListBrandTopics(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.AllianceBrandTopic](r.Context(), h.DB, r, listQueryConfig[domain.AllianceBrandTopic]{
		Table:         "alliance_brand_topics",
		SelectColumns: "id, tenant_id, name, theme, description, layout, cover_image, content_blocks, related_brand_ids, status, is_recommended, sort_order, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "theme"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanBrandTopicRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询专题列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询专题列表失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

func (h *AllianceHandler) GetBrandTopic(w http.ResponseWriter, r *http.Request) {
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
	t, err := h.Store.GetBrandTopicByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "专题不存在")
		return
	}
	respondJSON(w, http.StatusOK, t)
}

func (h *AllianceHandler) CreateBrandTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var t domain.AllianceBrandTopic
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	t.TenantID = tenantID
	if t.Name == "" {
		respondError(w, http.StatusBadRequest, "专题名称不能为空")
		return
	}

	id, err := h.Store.CreateBrandTopic(r.Context(), &t)
	if err != nil {
		slog.Error("创建专题失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建失败")
		return
	}
	topic, _ := h.Store.GetBrandTopicByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, topic)
}

func (h *AllianceHandler) UpdateBrandTopic(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Store.GetBrandTopicByID(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "专题不存在")
		return
	}

	var t domain.AllianceBrandTopic
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if err := h.Store.UpdateBrandTopic(r.Context(), id, &t); err != nil {
		slog.Error("更新专题失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新失败")
		return
	}
	topic, _ := h.Store.GetBrandTopicByID(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, topic)
}

func (h *AllianceHandler) DeleteBrandTopic(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteBrandTopic(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
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
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description, logo_url,
			cover_image, status, rating, cooperation_types, contact_person, contact_phone,
			contact_email, address, unified_social_credit_code, established_year, employee_count,
			business_license_photos, qualification_photos, intellectual_property_photos,
			cover_photos, secondary_colleges, rating_record, is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanEnterpriseRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicEnterprise(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var e domain.AllianceEnterprise
	var industry, region, description, logoURL, coverImage, rating *string
	var contactPerson, contactPhone, contactEmail, address, creditCode *string
	var establishedYear, employeeCount *int
	var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos, colleges, ratingRecord json.RawMessage
	var createdBy *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description,
			logo_url, cover_image, status, rating, cooperation_types, contact_person,
			contact_phone, contact_email, address, unified_social_credit_code,
			established_year, employee_count, business_license_photos, qualification_photos,
			intellectual_property_photos, cover_photos, secondary_colleges, rating_record,
			is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE id = $1 AND is_public = true AND status = 'active'
	`, id).Scan(&e.ID, &e.TenantID, &e.Name, &e.EnterpriseType, &industry, &region,
		&description, &logoURL, &coverImage, &e.Status, &rating, &coopTypes,
		&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
		&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
		&coverPhotos, &colleges, &ratingRecord, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "企业不存在")
		return
	}
	e.Industry = industry
	e.Region = region
	e.Description = description
	e.LogoURL = logoURL
	e.CoverImage = coverImage
	e.Rating = rating
	e.CooperationTypes = coopTypes
	e.ContactPerson = contactPerson
	e.ContactPhone = contactPhone
	e.ContactEmail = contactEmail
	e.Address = address
	e.UnifiedSocialCreditCode = creditCode
	e.EstablishedYear = establishedYear
	e.EmployeeCount = employeeCount
	e.BusinessLicensePhotos = bizPhotos
	e.QualificationPhotos = qualPhotos
	e.IntellectualPropertyPhotos = ipPhotos
	e.CoverPhotos = coverPhotos
	e.SecondaryColleges = colleges
	e.RatingRecord = ratingRecord
	e.CreatedBy = createdBy
	respondJSON(w, http.StatusOK, e)
}

func (h *AllianceHandler) ListPublicProjects(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE is_public = true AND publish_status = 'published'
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanProjectRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var p domain.AllianceProject
	var typ, description, budget, coverImage *string
	var startDate, endDate *time.Time
	var enterpriseIDs, agreementIDs, colleges json.RawMessage
	var createdBy *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE id = $1 AND is_public = true AND publish_status = 'published'
	`, id).Scan(&p.ID, &p.TenantID, &p.Name, &typ, &description, &p.Phase,
		&p.PublishStatus, &startDate, &endDate, &budget, &coverImage,
		&enterpriseIDs, &agreementIDs, &colleges, &p.IsPublic, &createdBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "项目不存在")
		return
	}
	p.Type = typ
	p.Description = description
	p.StartDate = formatNullableDate(startDate)
	p.EndDate = formatNullableDate(endDate)
	p.Budget = budget
	p.CoverImage = coverImage
	p.EnterpriseIDs = enterpriseIDs
	p.AgreementIDs = agreementIDs
	p.SecondaryColleges = colleges
	p.CreatedBy = createdBy
	respondJSON(w, http.StatusOK, p)
}

func (h *AllianceHandler) ListPublicAchievements(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, title, type, description, achievement_date, cover_image,
			attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_achievements WHERE is_public = true AND status = 'published'
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanAchievementRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicAchievement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var a domain.AllianceAchievement
	var description, coverImage, citationReason *string
	var achievementDate *time.Time
	var attachments, images, ownerPersons, coBuilders, enterpriseIDs, projectIDs, relatedPositions, relatedScenes, relatedCourses, colleges json.RawMessage
	var createdBy *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, title, type, description, achievement_date, cover_image,
			attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_achievements WHERE id = $1 AND is_public = true AND status = 'published'
	`, id).Scan(&a.ID, &a.TenantID, &a.Title, &a.Type, &description, &achievementDate,
		&coverImage, &attachments, &citationReason, &images, &ownerPersons, &coBuilders,
		&enterpriseIDs, &projectIDs, &relatedPositions,
		&relatedScenes, &relatedCourses, &a.Status, &a.ViewCount, &colleges,
		&a.IsPublic, &createdBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "成果不存在")
		return
	}
	a.Description = description
	a.AchievementDate = formatNullableDate(achievementDate)
	a.CoverImage = coverImage
	a.Attachments = attachments
	a.CitationReason = citationReason
	a.Images = images
	a.OwnerPersons = ownerPersons
	a.CoBuilders = coBuilders
	a.EnterpriseIDs = enterpriseIDs
	a.ProjectIDs = projectIDs
	a.RelatedPositions = relatedPositions
	a.RelatedScenes = relatedScenes
	a.RelatedCourses = relatedCourses
	a.SecondaryColleges = colleges
	a.CreatedBy = createdBy
	respondJSON(w, http.StatusOK, a)
}

func (h *AllianceHandler) ListPublicExperts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanExpertRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicExpert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var e domain.AllianceExpert
	var gender, ttl, pos, etype, industry, edu, intro, workExp, city, avatar *string
	var age, expYrs *int
	var proFields, specs, photos, attachs json.RawMessage
	var rating, enterpriseID, coverImage, partnerSource, positionDirection, organization *string
	var colleges json.RawMessage
	var createdBy *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE id = $1 AND is_public = true AND status = 'active'
	`, id).Scan(&e.ID, &e.TenantID, &e.Name, &gender, &age, &ttl, &pos,
		&etype, &industry, &proFields, &specs, &expYrs, &edu, &intro, &workExp,
		&city, &avatar, &coverImage, &photos, &attachs, &enterpriseID, &organization, &rating,
		&e.Status, &partnerSource, &positionDirection, &colleges, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "专家不存在")
		return
	}
	e.Gender = gender
	e.Age = age
	e.Title = ttl
	e.Position = pos
	e.ExpertType = etype
	e.Industry = industry
	e.ProfessionalFields = proFields
	e.Specialties = specs
	e.ExperienceYears = expYrs
	e.Education = edu
	e.Introduction = intro
	e.WorkExperience = workExp
	e.City = city
	e.AvatarURL = avatar
	e.CoverImage = coverImage
	e.Photos = photos
	e.Attachments = attachs
	e.EnterpriseID = enterpriseID
	e.Organization = organization
	e.Rating = rating
	e.PartnerSource = partnerSource
	e.PositionDirection = positionDirection
	e.SecondaryColleges = colleges
	e.CreatedBy = createdBy
	respondJSON(w, http.StatusOK, e)
}

func (h *AllianceHandler) ListPublicBrands(w http.ResponseWriter, r *http.Request) {
	brandType := r.URL.Query().Get("brandType")
	query := `SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
		cover_image, cover_video, description, data,
		student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
		sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE is_public = true AND status = 'published'`
	args := []interface{}{}
	if brandType != "" {
		query += " AND brand_type = $1"
		args = append(args, brandType)
	}
	query += " ORDER BY sort_order ASC, created_at DESC"
	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanBrandRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicBrand(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b domain.AllianceBrand
	var coverImage, coverVideo, description *string
	var data json.RawMessage
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
			cover_image, cover_video, description, data,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
			sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE id = $1 AND is_public = true AND status = 'published'
	`, id).Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
		&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
		&data, &b.StudentID, &b.EnterpriseID, &b.PositionID, &b.MajorID,
		&b.TeacherID, &b.ExpertID, &b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "品牌不存在")
		return
	}
	b.CoverImage = coverImage
	b.CoverVideo = coverVideo
	b.Description = description
	b.Data = data
	respondJSON(w, http.StatusOK, b)
}

func (h *AllianceHandler) ListPublicBrandTopics(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, name, theme, description, layout, cover_image,
			content_blocks, related_brand_ids, status, is_recommended, sort_order, created_at, updated_at
		FROM alliance_brand_topics WHERE status = 'published'
		ORDER BY sort_order ASC, created_at DESC
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()
	items, _ := h.Store.ScanBrandTopicRows(rows)
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
}

func (h *AllianceHandler) GetPublicBrandTopic(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var t domain.AllianceBrandTopic
	var theme, description, coverImage *string
	var contentBlocks, relatedBrandIDs json.RawMessage
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, name, theme, description, layout, cover_image,
			content_blocks, related_brand_ids, status, is_recommended, sort_order, created_at, updated_at
		FROM alliance_brand_topics WHERE id = $1 AND status = 'published'
	`, id).Scan(&t.ID, &t.TenantID, &t.Name, &theme, &description, &t.Layout,
		&coverImage, &contentBlocks, &relatedBrandIDs, &t.Status, &t.IsRecommended,
		&t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		respondError(w, http.StatusNotFound, "专题不存在")
		return
	}
	t.Theme = theme
	t.Description = description
	t.CoverImage = coverImage
	t.ContentBlocks = contentBlocks
	t.RelatedBrandIDs = relatedBrandIDs
	respondJSON(w, http.StatusOK, t)
}

func (h *AllianceHandler) GetPublicStats(w http.ResponseWriter, r *http.Request) {
	var enterpriseCount, projectCount, expertCount, achievementCount, brandCount int
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM alliance_enterprises WHERE is_public = true AND status = 'active'`).Scan(&enterpriseCount)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM alliance_projects WHERE is_public = true AND publish_status = 'published'`).Scan(&projectCount)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM alliance_experts WHERE is_public = true AND status = 'active'`).Scan(&expertCount)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM alliance_achievements WHERE is_public = true AND status = 'published'`).Scan(&achievementCount)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status = 'published'`).Scan(&brandCount)
	respondJSON(w, http.StatusOK, map[string]int{
		"enterpriseCount":  enterpriseCount,
		"projectCount":     projectCount,
		"expertCount":      expertCount,
		"achievementCount": achievementCount,
		"brandCount":       brandCount,
	})
}
