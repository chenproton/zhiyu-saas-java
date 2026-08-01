package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// allianceCRUDConfig 描述一个 alliance 实体 Create/Update/Delete 的行为差异；
// HTTP 流程骨架（claims 检查 → requireTenant → decode → 校验 → store → 回读 → 响应）
// 由下方泛型函数统一实现。各实体的响应状态码/JSON 形状/错误文案与原手写实现逐一对应。
type allianceCRUDConfig[T any] struct {
	LogName      string // slog 日志中的实体名，如 "企业"
	NotFoundMsg  string
	CreateErrMsg string
	UpdateErrMsg string
	DeleteErrMsg string

	ValidateCreate func(t *T) string // 返回非空时响应 400
	PrepareCreate  func(t *T, tenantID, userID string)
	CreateFn       func(ctx context.Context, t *T, tenantID, userID string) (string, error)
	UpdateFn       func(ctx context.Context, id string, t *T) error
	DeleteFn       func(ctx context.Context, id, tenantID string) error
	GetFn          func(ctx context.Context, id, tenantID string) (any, error)

	DeleteCheck bool // 删除前是否先 GetFn 存在性检查（仅企业）
}

// allianceList 统一 "claims 检查 → executeListQuery → {items,total}" 的列表流程。
func allianceList[T any](w http.ResponseWriter, r *http.Request, db listQueryDB, cfg listQueryConfig[T], errMsg string) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	items, total, err := executeListQuery(r.Context(), db, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error(errMsg, "error", err)
		respondError(w, http.StatusInternalServerError, errMsg)
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: total})
}

// allianceGet 统一 "claims 检查 → requireTenant → GetByID → 404/响应" 的详情流程。
func allianceGet[T any](w http.ResponseWriter, r *http.Request, getFn func(ctx context.Context, id, tenantID string) (*T, error), notFoundMsg string) {
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
	item, err := getFn(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, notFoundMsg)
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func allianceCreate[T any](w http.ResponseWriter, r *http.Request, cfg allianceCRUDConfig[T]) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var body T
	if !decodeBody(w, r, &body) {
		return
	}
	if cfg.PrepareCreate != nil {
		cfg.PrepareCreate(&body, tenantID, claims.UserID)
	}
	if cfg.ValidateCreate != nil {
		if msg := cfg.ValidateCreate(&body); msg != "" {
			respondError(w, http.StatusBadRequest, msg)
			return
		}
	}

	id, err := cfg.CreateFn(r.Context(), &body, tenantID, claims.UserID)
	if err != nil {
		slog.Error("创建"+cfg.LogName+"失败", "error", err)
		respondError(w, http.StatusInternalServerError, cfg.CreateErrMsg)
		return
	}
	item, _ := cfg.GetFn(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, item)
}

func allianceUpdate[T any](w http.ResponseWriter, r *http.Request, cfg allianceCRUDConfig[T]) {
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
	if _, err := cfg.GetFn(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, cfg.NotFoundMsg)
		return
	}

	var body T
	if !decodeBody(w, r, &body) {
		return
	}
	if err := cfg.UpdateFn(r.Context(), id, &body); err != nil {
		slog.Error("更新"+cfg.LogName+"失败", "error", err)
		respondError(w, http.StatusInternalServerError, cfg.UpdateErrMsg)
		return
	}
	item, _ := cfg.GetFn(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, item)
}

func allianceDelete[T any](w http.ResponseWriter, r *http.Request, cfg allianceCRUDConfig[T]) {
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
	if cfg.DeleteCheck {
		if _, err := cfg.GetFn(r.Context(), id, tenantID); err != nil {
			respondError(w, http.StatusNotFound, cfg.NotFoundMsg)
			return
		}
	}
	if err := cfg.DeleteFn(r.Context(), id, tenantID); err != nil {
		slog.Error("删除"+cfg.LogName+"失败", "error", err)
		respondError(w, http.StatusInternalServerError, cfg.DeleteErrMsg)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// alliancePublicList 统一匿名公开列表：store 查询 → {items,total}。
func alliancePublicList[T any](w http.ResponseWriter, r *http.Request, listFn func(ctx context.Context) ([]T, error)) {
	items, err := listFn(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	respondJSON(w, http.StatusOK, allianceListResponse{Items: items, Total: len(items)})
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

func (h *AllianceHandler) enterpriseCRUD() allianceCRUDConfig[allianceEnterpriseRequest] {
	return allianceCRUDConfig[allianceEnterpriseRequest]{
		LogName:      "企业",
		NotFoundMsg:  "企业不存在",
		CreateErrMsg: "创建企业失败",
		UpdateErrMsg: "更新企业失败",
		DeleteErrMsg: "删除企业失败",
		DeleteCheck:  true,
		ValidateCreate: func(t *allianceEnterpriseRequest) string {
			if t.Name == "" {
				return "企业名称不能为空"
			}
			return ""
		},
		PrepareCreate: func(t *allianceEnterpriseRequest, tenantID, userID string) {
			if t.EnterpriseType == "" {
				t.EnterpriseType = "platform"
			}
			if t.Status == "" {
				t.Status = "negotiating"
			}
		},
		CreateFn: func(ctx context.Context, t *allianceEnterpriseRequest, tenantID, userID string) (string, error) {
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
		},
		UpdateFn: func(ctx context.Context, id string, t *allianceEnterpriseRequest) error {
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
		},
		DeleteFn: h.Store.DeleteEnterprise,
		GetFn: func(ctx context.Context, id, tenantID string) (any, error) {
			return h.Store.GetEnterpriseByID(ctx, id, tenantID)
		},
	}
}

// ===== 合作项目 =====

func (h *AllianceHandler) projectCRUD() allianceCRUDConfig[domain.AllianceProject] {
	return allianceCRUDConfig[domain.AllianceProject]{
		LogName:      "项目",
		NotFoundMsg:  "项目不存在",
		CreateErrMsg: "创建项目失败",
		UpdateErrMsg: "更新项目失败",
		DeleteErrMsg: "删除失败",
		ValidateCreate: func(t *domain.AllianceProject) string {
			if t.Name == "" {
				return "项目名称不能为空"
			}
			return ""
		},
		PrepareCreate: func(t *domain.AllianceProject, tenantID, userID string) {
			t.TenantID = tenantID
			t.CreatedBy = &userID
		},
		CreateFn: func(ctx context.Context, t *domain.AllianceProject, tenantID, userID string) (string, error) {
			return h.Store.CreateProject(ctx, t)
		},
		UpdateFn: func(ctx context.Context, id string, t *domain.AllianceProject) error {
			return h.Store.UpdateProject(ctx, id, t)
		},
		DeleteFn: h.Store.DeleteProject,
		GetFn: func(ctx context.Context, id, tenantID string) (any, error) {
			return h.Store.GetProjectByID(ctx, id, tenantID)
		},
	}
}

// ===== 合作成果 =====

func (h *AllianceHandler) achievementCRUD() allianceCRUDConfig[domain.AllianceAchievement] {
	return allianceCRUDConfig[domain.AllianceAchievement]{
		LogName:      "成果",
		NotFoundMsg:  "成果不存在",
		CreateErrMsg: "创建成果失败",
		UpdateErrMsg: "更新失败",
		DeleteErrMsg: "删除失败",
		ValidateCreate: func(t *domain.AllianceAchievement) string {
			if t.Title == "" {
				return "成果标题不能为空"
			}
			return ""
		},
		PrepareCreate: func(t *domain.AllianceAchievement, tenantID, userID string) {
			t.TenantID = tenantID
			t.CreatedBy = &userID
		},
		CreateFn: func(ctx context.Context, t *domain.AllianceAchievement, tenantID, userID string) (string, error) {
			return h.Store.CreateAchievement(ctx, t)
		},
		UpdateFn: func(ctx context.Context, id string, t *domain.AllianceAchievement) error {
			return h.Store.UpdateAchievement(ctx, id, t)
		},
		DeleteFn: h.Store.DeleteAchievement,
		GetFn: func(ctx context.Context, id, tenantID string) (any, error) {
			return h.Store.GetAchievementByID(ctx, id, tenantID)
		},
	}
}
