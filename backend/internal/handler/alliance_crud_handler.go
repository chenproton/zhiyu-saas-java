package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// allianceList 统一 "claims 检查 → executeListQuery → {items,total}" 的列表流程。
func allianceList[T any](w http.ResponseWriter, r *http.Request, db store.ListQueryDB, cfg store.ListQueryConfig[T], errMsg string) {
	if !canManageAlliance(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	items, total, err := executeListQuery(r.Context(), db, r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, errMsg)
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[T]{Items: items, Total: total})
}

// alliancePublicGetErr 公开详情统一错误映射（404 = 不存在/无权限，其余 500）。
func alliancePublicGetErr(w http.ResponseWriter, r *http.Request, err error, notFoundMsg string) {
	if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		respondError(w, http.StatusNotFound, notFoundMsg)
		return
	}
	respondServerError(w, r, err, "查询失败")
}

// alliancePublicList 统一匿名公开列表：store 查询 → {items,total}。
func alliancePublicList[T any](w http.ResponseWriter, r *http.Request, listFn func(ctx context.Context) ([]T, error)) {
	items, err := listFn(r.Context())
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[T]{Items: items, Total: len(items)})
}

// alliancePublicGet 统一匿名公开详情：store 查询 → 404/响应。
func alliancePublicGet[T any](w http.ResponseWriter, r *http.Request, getFn func(ctx context.Context, id string) (*T, error), notFoundMsg string) {
	id := chi.URLParam(r, "id")
	item, err := getFn(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, notFoundMsg)
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// allianceCRUD 组装联盟实体 CRUD 公共差异：业务角色权限 + requireTenant 租户过滤。
func allianceCRUD[T any, V any]() crudConfig[T, V] {
	return crudConfig[T, V]{
		Permit: func(r *http.Request) bool { return canManageAlliance(r) },
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *T) (string, bool) {
			return requireTenant(w, r)
		},
		TenantFn: func(w http.ResponseWriter, r *http.Request) (string, bool) {
			return requireTenant(w, r)
		},
	}
}

// ===== 合作项目 =====

func (h *AllianceHandler) projectCRUD() crudConfig[domain.AllianceProject, domain.AllianceProject] {
	cfg := allianceCRUD[domain.AllianceProject, domain.AllianceProject]()
	cfg.NotFoundMsg = "项目不存在"
	cfg.CreateErrMsg = "创建项目失败"
	cfg.UpdateErrMsg = "更新项目失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.AllianceProject) string {
		if t.Name == "" {
			return "项目名称不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.AllianceProject, tenantID, userID string) {
		t.TenantID = tenantID
		t.CreatedBy = &userID
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceProject, tenantID, userID string) (string, error) {
		return h.Store.CreateProject(ctx, t)
	}
	cfg.UpdateFn = func(ctx context.Context, id, tenantID string, t *domain.AllianceProject) error {
		return h.Store.UpdateProject(ctx, id, tenantID, t)
	}
	// 部分更新兜底：请求未携带的字段回退到已存在记录，避免 PUT 全列覆盖清空数据。
	cfg.ValidateUpdateExisting = func(t *domain.AllianceProject, existing *domain.AllianceProject) string {
		if t.Name == "" {
			t.Name = existing.Name
		}
		if t.Type == nil {
			t.Type = existing.Type
		}
		if t.Description == nil {
			t.Description = existing.Description
		}
		if t.Phase == "" {
			t.Phase = existing.Phase
		}
		if t.PublishStatus == "" {
			t.PublishStatus = existing.PublishStatus
		}
		if t.StartDate == nil {
			t.StartDate = existing.StartDate
		}
		if t.EndDate == nil {
			t.EndDate = existing.EndDate
		}
		if t.Budget == nil {
			t.Budget = existing.Budget
		}
		if t.CoverImage == nil {
			t.CoverImage = existing.CoverImage
		}
		// 数组字段：仅"未携带"（nil）时回退；显式传空数组表示清空关联
		if t.EnterpriseIDs == nil {
			t.EnterpriseIDs = existing.EnterpriseIDs
		}
		if t.AgreementIDs == nil {
			t.AgreementIDs = existing.AgreementIDs
		}
		if t.SecondaryColleges == nil {
			t.SecondaryColleges = existing.SecondaryColleges
		}
		// 展示开关：请求未携带时保留已有状态，防止局部更新把已公开内容静默下架
		if t.IsPublic == nil {
			t.IsPublic = existing.IsPublic
		}
		return ""
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteProject(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceProject, error) {
		p, err := h.Store.GetProjectByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceProject{}, err
		}
		return *p, nil
	}
	return cfg
}

// ===== 合作成果 =====

func (h *AllianceHandler) achievementCRUD() crudConfig[domain.AllianceAchievement, domain.AllianceAchievement] {
	cfg := allianceCRUD[domain.AllianceAchievement, domain.AllianceAchievement]()
	cfg.NotFoundMsg = "成果不存在"
	cfg.CreateErrMsg = "创建成果失败"
	cfg.UpdateErrMsg = "更新失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.AllianceAchievement) string {
		if t.Title == "" {
			return "成果标题不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.AllianceAchievement, tenantID, userID string) {
		t.TenantID = tenantID
		t.CreatedBy = &userID
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceAchievement, tenantID, userID string) (string, error) {
		return h.Store.CreateAchievement(ctx, t)
	}
	cfg.ValidateUpdateExisting = func(t *domain.AllianceAchievement, existing *domain.AllianceAchievement) string {
		if t.Title == "" {
			t.Title = existing.Title
		}
		if t.Type == "" {
			t.Type = existing.Type
		}
		if t.Description == nil {
			t.Description = existing.Description
		}
		if t.AchievementDate == nil {
			t.AchievementDate = existing.AchievementDate
		}
		if t.CoverImage == nil {
			t.CoverImage = existing.CoverImage
		}
		if t.CitationReason == nil {
			t.CitationReason = existing.CitationReason
		}
		if t.Status == "" {
			t.Status = existing.Status
		}
		// 数组字段：仅"未携带"（nil）时回退；显式传空数组表示清空关联
		if t.Attachments == nil {
			t.Attachments = existing.Attachments
		}
		if t.Images == nil {
			t.Images = existing.Images
		}
		if t.OwnerPersons == nil {
			t.OwnerPersons = existing.OwnerPersons
		}
		if t.CoBuilders == nil {
			t.CoBuilders = existing.CoBuilders
		}
		if t.EnterpriseIDs == nil {
			t.EnterpriseIDs = existing.EnterpriseIDs
		}
		if t.ProjectIDs == nil {
			t.ProjectIDs = existing.ProjectIDs
		}
		if t.RelatedPositions == nil {
			t.RelatedPositions = existing.RelatedPositions
		}
		if t.RelatedScenes == nil {
			t.RelatedScenes = existing.RelatedScenes
		}
		if t.RelatedCourses == nil {
			t.RelatedCourses = existing.RelatedCourses
		}
		if t.SecondaryColleges == nil {
			t.SecondaryColleges = existing.SecondaryColleges
		}
		// 展示开关：请求未携带时保留已有状态；浏览量不受编辑影响（由阅读自增）
		if t.IsPublic == nil {
			t.IsPublic = existing.IsPublic
		}
		t.ViewCount = existing.ViewCount
		return ""
	}
	cfg.UpdateFn = func(ctx context.Context, id, tenantID string, t *domain.AllianceAchievement) error {
		return h.Store.UpdateAchievement(ctx, id, tenantID, t)
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteAchievement(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceAchievement, error) {
		a, err := h.Store.GetAchievementByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceAchievement{}, err
		}
		return *a, nil
	}
	return cfg
}

// ===== 合作协议 =====

func (h *AllianceHandler) agreementCRUD() crudConfig[domain.AllianceAgreement, domain.AllianceAgreement] {
	cfg := allianceCRUD[domain.AllianceAgreement, domain.AllianceAgreement]()
	cfg.NotFoundMsg = "协议不存在"
	cfg.CreateErrMsg = "创建失败"
	cfg.UpdateErrMsg = "更新失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.AllianceAgreement) string {
		if t.Name == "" {
			return "协议名称不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.AllianceAgreement, tenantID, userID string) {
		t.TenantID = tenantID
		t.CreatedBy = &userID
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceAgreement, tenantID, userID string) (string, error) {
		return h.Store.CreateAgreement(ctx, t)
	}
	cfg.ValidateUpdateExisting = func(t *domain.AllianceAgreement, existing *domain.AllianceAgreement) string {
		if t.Name == "" {
			t.Name = existing.Name
		}
		if t.Type == nil {
			t.Type = existing.Type
		}
		if t.Content == nil {
			t.Content = existing.Content
		}
		if t.StartDate == nil {
			t.StartDate = existing.StartDate
		}
		if t.EndDate == nil {
			t.EndDate = existing.EndDate
		}
		if t.Status == "" {
			t.Status = existing.Status
		}
		// 数组字段：仅"未携带"（nil）时回退；显式传空数组表示清空关联
		if t.EnterpriseIDs == nil {
			t.EnterpriseIDs = existing.EnterpriseIDs
		}
		if t.ProjectIDs == nil {
			t.ProjectIDs = existing.ProjectIDs
		}
		if t.Attachments == nil {
			t.Attachments = existing.Attachments
		}
		// 展示开关：请求未携带时保留已有状态，防止局部更新把已公开内容静默下架
		if t.IsPublic == nil {
			t.IsPublic = existing.IsPublic
		}
		return ""
	}
	cfg.UpdateFn = func(ctx context.Context, id, tenantID string, t *domain.AllianceAgreement) error {
		return h.Store.UpdateAgreement(ctx, id, tenantID, t)
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteAgreement(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceAgreement, error) {
		a, err := h.Store.GetAgreementByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceAgreement{}, err
		}
		return *a, nil
	}
	return cfg
}

// ===== 品牌 =====

func (h *AllianceHandler) brandCRUD() crudConfig[domain.AllianceBrand, domain.AllianceBrand] {
	cfg := allianceCRUD[domain.AllianceBrand, domain.AllianceBrand]()
	cfg.NotFoundMsg = "品牌不存在"
	cfg.CreateErrMsg = "创建失败"
	cfg.UpdateErrMsg = "更新失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.AllianceBrand) string {
		if t.Name == "" || t.BrandType == "" {
			return "品牌名称和类型不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.AllianceBrand, tenantID, userID string) {
		t.TenantID = tenantID
		// data 列 NOT NULL（默认 '{}'）；请求未携带时补齐空对象，避免显式 NULL 绕过列默认值
		if len(t.Data) == 0 {
			t.Data = json.RawMessage(`{}`)
		}
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceBrand, tenantID, userID string) (string, error) {
		return h.Store.CreateBrand(ctx, t)
	}
	cfg.ValidateUpdateExisting = func(t *domain.AllianceBrand, existing *domain.AllianceBrand) string {
		if t.Name == "" {
			t.Name = existing.Name
		}
		if t.Status == "" {
			t.Status = existing.Status
		}
		// 展示开关（isPublic 前台展示 / isFeatured 推荐）：请求未携带时保留已有状态，
		// 防止只改 data 等局部内容的更新把开关重置为 false
		if t.IsPublic == nil {
			t.IsPublic = existing.IsPublic
		}
		if t.IsFeatured == nil {
			t.IsFeatured = existing.IsFeatured
		}
		if t.SortOrder == 0 {
			t.SortOrder = existing.SortOrder
		}
		if len(t.Data) == 0 {
			t.Data = existing.Data
		}
		if t.CoverImage == nil {
			t.CoverImage = existing.CoverImage
		}
		if t.CoverVideo == nil {
			t.CoverVideo = existing.CoverVideo
		}
		if t.Description == nil {
			t.Description = existing.Description
		}
		if t.StudentID == nil {
			t.StudentID = existing.StudentID
		}
		if t.EnterpriseID == nil {
			t.EnterpriseID = existing.EnterpriseID
		}
		if t.PositionID == nil {
			t.PositionID = existing.PositionID
		}
		if t.MajorID == nil {
			t.MajorID = existing.MajorID
		}
		if t.TeacherID == nil {
			t.TeacherID = existing.TeacherID
		}
		if t.ExpertID == nil {
			t.ExpertID = existing.ExpertID
		}
		return ""
	}
	cfg.UpdateFn = func(ctx context.Context, id, tenantID string, t *domain.AllianceBrand) error {
		return h.Store.UpdateBrand(ctx, id, tenantID, t)
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteBrand(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceBrand, error) {
		b, err := h.Store.GetBrandByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceBrand{}, err
		}
		return *b, nil
	}
	return cfg
}
