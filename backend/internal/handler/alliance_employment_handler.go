package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AllianceEmploymentHandler 就业服务管理（人才与岗位供需服务大厅）。
// 管理端 CRUD + 岗位/投递总览 + 前台大厅（学生按 target_groups 可见性过滤）。
// 见 docs/spec/02-api-contract.md §1.9。
type AllianceEmploymentHandler struct {
	Store *store.AllianceStore
}

// ===== 管理端：就业项目 CRUD =====

func (h *AllianceEmploymentHandler) employmentProjectCRUD() crudConfig[domain.EmploymentProject, domain.EmploymentProject] {
	cfg := allianceCRUD[domain.EmploymentProject, domain.EmploymentProject]()
	cfg.NotFoundMsg = "就业项目不存在"
	cfg.CreateErrMsg = "创建就业项目失败"
	cfg.UpdateErrMsg = "更新就业项目失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.EmploymentProject) string {
		if t.Name == "" {
			return "项目名称不能为空"
		}
		if t.Type == "" {
			return "项目类型不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.EmploymentProject, tenantID, userID string) {
		t.TenantID = tenantID
		t.CreatedBy = &userID
		if t.PublishStatus != "published" {
			t.PublishStatus = "draft"
		}
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.EmploymentProject, tenantID, userID string) (string, error) {
		return h.Store.CreateEmploymentProject(ctx, t)
	}
	cfg.UpdateFn = func(ctx context.Context, id, tenantID string, t *domain.EmploymentProject) error {
		return h.Store.UpdateEmploymentProject(ctx, id, tenantID, t)
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteEmploymentProject(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.EmploymentProject, error) {
		p, err := h.Store.GetEmploymentProjectByID(ctx, id, tenantID)
		if err != nil {
			return domain.EmploymentProject{}, err
		}
		return *p, nil
	}
	// 部分更新兜底：请求未携带的字段回退到已存在记录，避免 PUT 全列覆盖清空数据。
	cfg.ValidateUpdateExisting = func(t *domain.EmploymentProject, existing *domain.EmploymentProject) string {
		if t.Name == "" {
			t.Name = existing.Name
		}
		if t.Type == "" {
			t.Type = existing.Type
		}
		if t.Organizer == nil {
			t.Organizer = existing.Organizer
		}
		if t.Description == nil {
			t.Description = existing.Description
		}
		if t.CoverImage == nil {
			t.CoverImage = existing.CoverImage
		}
		if t.StartDate == nil {
			t.StartDate = existing.StartDate
		}
		if t.EndDate == nil {
			t.EndDate = existing.EndDate
		}
		if t.PublishStatus == "" {
			t.PublishStatus = existing.PublishStatus
		}
		if len(t.EnterpriseIDs) == 0 {
			t.EnterpriseIDs = existing.EnterpriseIDs
		}
		if len(t.TargetGroups) == 0 {
			t.TargetGroups = existing.TargetGroups
		}
		return ""
	}
	// 详情回读附带岗位数/投递数聚合。
	cfg.AfterLoad = func(ctx context.Context, t *domain.EmploymentProject) error {
		jobCount, appCount, err := h.Store.GetEmploymentProjectCounts(ctx, t.ID, t.TenantID)
		if err != nil {
			return err
		}
		t.JobCount = jobCount
		t.ApplicationCount = appCount
		return nil
	}
	return cfg
}

func (h *AllianceEmploymentHandler) ListEmploymentProjects(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListEmploymentProjectsConfig(), "查询就业项目列表失败")
}

func (h *AllianceEmploymentHandler) GetEmploymentProject(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.employmentProjectCRUD())
}

func (h *AllianceEmploymentHandler) CreateEmploymentProject(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.employmentProjectCRUD())
}

func (h *AllianceEmploymentHandler) UpdateEmploymentProject(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.employmentProjectCRUD())
}

func (h *AllianceEmploymentHandler) DeleteEmploymentProject(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.employmentProjectCRUD())
}

// ===== 管理端：岗位与投递总览 =====

func (h *AllianceEmploymentHandler) ListEmploymentJobs(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListEmploymentJobsConfig(), "查询岗位列表失败")
}

// AdminSetEmploymentJobStatus 学校端治理：下架（closed）/恢复（published）岗位。
func (h *AllianceEmploymentHandler) AdminSetEmploymentJobStatus(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Status != "closed" && body.Status != "published" {
		respondError(w, http.StatusBadRequest, "仅支持下架(closed)/恢复(published)")
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Store.AdminSetEmploymentJobStatus(r.Context(), id, tenantID, body.Status); err != nil {
		respondServerError(w, r, err, "更新岗位状态失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "status": body.Status})
}

func (h *AllianceEmploymentHandler) ListEmploymentApplications(w http.ResponseWriter, r *http.Request) {
	allianceList(w, r, h.Store.Q(), h.Store.ListEmploymentApplicationsConfig(), "查询投递列表失败")
}

// ===== 前台大厅（登录公开；浏览全量可见，target_groups 仅控制投递资格） =====

func (h *AllianceEmploymentHandler) ListPublicEmploymentProjects(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	limit, offset := publicListParams(r)
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.EmploymentProject, error) {
		return h.Store.ListPublicEmploymentProjects(ctx, tenantID, limit, offset)
	})
}

func (h *AllianceEmploymentHandler) GetPublicEmploymentProject(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetPublicEmploymentProjectByID(r.Context(), id, tenantID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "就业项目不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// ListPublicEmploymentJobsByProject 大厅项目下岗位列表（项目须已发布）。
func (h *AllianceEmploymentHandler) ListPublicEmploymentJobsByProject(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	projectID := chi.URLParam(r, "id")
	// 先校验项目存在且已发布，避免枚举未发布项目的岗位
	if _, err := h.Store.GetPublicEmploymentProjectByID(r.Context(), projectID, tenantID); err != nil {
		alliancePublicGetErr(w, r, err, "就业项目不存在")
		return
	}
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.EmploymentJob, error) {
		return h.Store.ListPublicEmploymentJobsByProject(ctx, projectID, tenantID)
	})
}

func (h *AllianceEmploymentHandler) GetPublicEmploymentJob(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetPublicEmploymentJobByID(r.Context(), id, tenantID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "岗位不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// ApplyPublicEmploymentJob 学生投递岗位（档案快照带出 + 求职信；重复投递 409；不在 target_groups 面向群体内 403）。
func (h *AllianceEmploymentHandler) ApplyPublicEmploymentJob(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未登录")
		return
	}
	if !middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "仅学生可投递")
		return
	}
	var body struct {
		CoverLetter string `json:"coverLetter"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	// 请求上限护栏：求职信最长 2000 字
	if len(body.CoverLetter) > 2000 {
		respondError(w, http.StatusBadRequest, "求职信最长 2000 字")
		return
	}
	scope, err := h.Store.GetEmploymentStudentScope(r.Context(), claims.UserID)
	if err != nil {
		respondServerError(w, r, err, "读取学生信息失败")
		return
	}
	jobID := chi.URLParam(r, "id")
	id, err := h.Store.CreateEmploymentApplication(r.Context(), jobID, scope, claims.UserID, body.CoverLetter)
	if err != nil {
		if store.IsUniqueViolation(err) {
			respondError(w, http.StatusConflict, "已投递过该岗位")
			return
		}
		if store.IsEmploymentNotEligible(err) {
			respondError(w, http.StatusForbidden, "你不在该岗位面向的学生群体内，暂不可投递")
			return
		}
		respondServerError(w, r, err, "投递失败")
		return
	}
	if id == "" {
		respondError(w, http.StatusNotFound, "岗位不存在或未开放投递")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

// ListMyEmploymentApplications 学生「我的投递」列表（限本租户本人）。
func (h *AllianceEmploymentHandler) ListMyEmploymentApplications(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未登录")
		return
	}
	if !middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "仅学生可查看投递记录")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	alliancePublicList(w, r, func(ctx context.Context) ([]domain.EmploymentApplication, error) {
		return h.Store.ListMyEmploymentApplications(ctx, tenantID, claims.UserID)
	})
}
