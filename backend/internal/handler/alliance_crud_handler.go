package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// allianceList 统一 "claims 检查 → executeListQuery → {items,total}" 的列表流程。
func allianceList[T any](w http.ResponseWriter, r *http.Request, db store.ListQueryDB, cfg store.ListQueryConfig[T], errMsg string) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
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
		respondError(w, http.StatusNotFound, notFoundMsg)
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// allianceCRUD 组装联盟实体 CRUD 公共差异：门户管理权限 + requireTenant 租户过滤。
func allianceCRUD[T any, V any]() crudConfig[T, V] {
	return crudConfig[T, V]{
		Permit: func(r *http.Request) bool { return canManagePortal(middleware.CurrentUser(r)) },
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *T) (string, bool) {
			return requireTenant(w, r)
		},
		TenantFn: func(w http.ResponseWriter, r *http.Request) (string, bool) {
			return requireTenant(w, r)
		},
	}
}

// ===== 合作企业 =====

// allianceEnterpriseRequest 企业创建/更新请求体（两者字段相同）。
type allianceEnterpriseRequest struct {
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

func (h *AllianceHandler) enterpriseCRUD() crudConfig[allianceEnterpriseRequest, domain.AllianceEnterprise] {
	cfg := allianceCRUD[allianceEnterpriseRequest, domain.AllianceEnterprise]()
	cfg.NotFoundMsg = "企业不存在"
	cfg.CreateErrMsg = "创建企业失败"
	cfg.UpdateErrMsg = "更新企业失败"
	cfg.DeleteErrMsg = "删除企业失败"
	cfg.ValidateCreate = func(t *allianceEnterpriseRequest) string {
		if t.Name == "" {
			return "企业名称不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *allianceEnterpriseRequest, tenantID, userID string) {
		if t.EnterpriseType == "" {
			t.EnterpriseType = "platform"
		}
		if t.Status == "" {
			t.Status = "negotiating"
		}
	}
	cfg.CreateFn = func(ctx context.Context, t *allianceEnterpriseRequest, tenantID, userID string) (string, error) {
		return h.Store.CreateEnterprise(ctx, &store.AllianceEnterpriseCreateParams{
			TenantID:                   tenantID,
			Name:                       t.Name,
			CreatedBy:                  &userID,
			EnterpriseType:             t.EnterpriseType,
			Industry:                   t.Industry,
			Region:                     t.Region,
			Description:                t.Description,
			LogoURL:                    t.LogoURL,
			CoverImage:                 t.CoverImage,
			Status:                     t.Status,
			Rating:                     t.Rating,
			CooperationTypes:           t.CooperationTypes,
			ContactPerson:              t.ContactPerson,
			ContactPhone:               t.ContactPhone,
			ContactEmail:               t.ContactEmail,
			Address:                    t.Address,
			UnifiedSocialCreditCode:    t.UnifiedSocialCreditCode,
			EstablishedYear:            t.EstablishedYear,
			EmployeeCount:              t.EmployeeCount,
			BusinessLicensePhotos:      t.BusinessLicensePhotos,
			QualificationPhotos:        t.QualificationPhotos,
			IntellectualPropertyPhotos: t.IntellectualPropertyPhotos,
			CoverPhotos:                t.CoverPhotos,
			SecondaryColleges:          t.SecondaryColleges,
			RatingRecord:               t.RatingRecord,
			IsPublic:                   t.IsPublic,
		})
	}
	cfg.UpdateFn = func(ctx context.Context, id string, t *allianceEnterpriseRequest) error {
		return h.Store.UpdateEnterprise(ctx, id, &store.AllianceEnterpriseUpdateParams{
			Name:                       t.Name,
			EnterpriseType:             t.EnterpriseType,
			Industry:                   t.Industry,
			Region:                     t.Region,
			Description:                t.Description,
			LogoURL:                    t.LogoURL,
			CoverImage:                 t.CoverImage,
			Status:                     t.Status,
			Rating:                     t.Rating,
			CooperationTypes:           t.CooperationTypes,
			ContactPerson:              t.ContactPerson,
			ContactPhone:               t.ContactPhone,
			ContactEmail:               t.ContactEmail,
			Address:                    t.Address,
			UnifiedSocialCreditCode:    t.UnifiedSocialCreditCode,
			EstablishedYear:            t.EstablishedYear,
			EmployeeCount:              t.EmployeeCount,
			BusinessLicensePhotos:      t.BusinessLicensePhotos,
			QualificationPhotos:        t.QualificationPhotos,
			IntellectualPropertyPhotos: t.IntellectualPropertyPhotos,
			CoverPhotos:                t.CoverPhotos,
			SecondaryColleges:          t.SecondaryColleges,
			RatingRecord:               t.RatingRecord,
			IsPublic:                   t.IsPublic,
		})
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteEnterprise(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceEnterprise, error) {
		e, err := h.Store.GetEnterpriseByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceEnterprise{}, err
		}
		return *e, nil
	}
	return cfg
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
	cfg.UpdateFn = func(ctx context.Context, id string, t *domain.AllianceProject) error {
		return h.Store.UpdateProject(ctx, id, t)
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
	cfg.UpdateFn = func(ctx context.Context, id string, t *domain.AllianceAchievement) error {
		return h.Store.UpdateAchievement(ctx, id, t)
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

// ===== 专家 =====

func (h *AllianceHandler) expertCRUD() crudConfig[domain.AllianceExpert, domain.AllianceExpert] {
	cfg := allianceCRUD[domain.AllianceExpert, domain.AllianceExpert]()
	cfg.NotFoundMsg = "专家不存在"
	cfg.CreateErrMsg = "创建专家失败"
	cfg.UpdateErrMsg = "更新失败"
	cfg.DeleteErrMsg = "删除失败"
	cfg.ValidateCreate = func(t *domain.AllianceExpert) string {
		if t.Name == "" {
			return "专家姓名不能为空"
		}
		return ""
	}
	cfg.PrepareCreate = func(t *domain.AllianceExpert, tenantID, userID string) {
		t.TenantID = tenantID
		t.CreatedBy = &userID
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceExpert, tenantID, userID string) (string, error) {
		return h.Store.CreateExpert(ctx, t)
	}
	cfg.UpdateFn = func(ctx context.Context, id string, t *domain.AllianceExpert) error {
		return h.Store.UpdateExpert(ctx, id, t)
	}
	cfg.DeleteFn = func(ctx context.Context, id, tenantID string) error {
		return h.Store.DeleteExpert(ctx, id, tenantID)
	}
	cfg.GetByIDFn = func(ctx context.Context, id, tenantID string) (domain.AllianceExpert, error) {
		e, err := h.Store.GetExpertByID(ctx, id, tenantID)
		if err != nil {
			return domain.AllianceExpert{}, err
		}
		return *e, nil
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
	cfg.UpdateFn = func(ctx context.Context, id string, t *domain.AllianceAgreement) error {
		return h.Store.UpdateAgreement(ctx, id, t)
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
	}
	cfg.CreateFn = func(ctx context.Context, t *domain.AllianceBrand, tenantID, userID string) (string, error) {
		return h.Store.CreateBrand(ctx, t)
	}
	cfg.UpdateFn = func(ctx context.Context, id string, t *domain.AllianceBrand) error {
		return h.Store.UpdateBrand(ctx, id, t)
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
