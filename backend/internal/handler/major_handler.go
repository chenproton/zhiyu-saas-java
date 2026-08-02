package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type MajorHandler struct {
	Service *service.MajorService
	Store   *store.MajorsStore
}

// MajorRequest 专业创建/更新请求体（更新流程忽略 tenantId）。
type MajorRequest struct {
	TenantID string  `json:"tenantId"`
	Code     string  `json:"code"`
	Name     string  `json:"name"`
	Alias    *string `json:"alias"`
	Enabled  bool    `json:"enabled"`
}

func (h *MajorHandler) List(w http.ResponseWriter, r *http.Request) {
	enabledStr := r.URL.Query().Get("enabled")

	items, total, err := executeListQuery(r.Context(), h.Service.Queryer(), r, store.ListQueryConfig[domain.Major]{
		Table:         "majors",
		SelectColumns: "id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if enabledStr != "" {
				qb.AddCondition("enabled = " + qb.NextArg(enabledStr == "true"))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询专业失败", "error", err)
		respondServerError(w, r, err, "查询专业失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.Major]{Items: items, Total: total})
}

// crud 返回专业 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *MajorHandler) crud() crudConfig[MajorRequest, domain.Major] {
	return crudConfig[MajorRequest, domain.Major]{
		NotFoundMsg:        "专业不存在",
		CreateErrMsg:       "创建专业失败",
		UpdateErrMsg:       "更新专业失败",
		DeleteErrMsg:       "删除专业失败",
		DeleteCheckErrMsg:  "检查专业引用失败",
		Permit:             func(r *http.Request) bool { return canManagePortal(middleware.CurrentUser(r)) },
		UniqueViolationMsg: "专业代码已存在，请使用其他代码",
		CheckOwnership:     true,
		GetOwnership:       true,
		ValidateCreate: func(t *MajorRequest) string {
			if t.TenantID == "" || t.Code == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *MajorRequest) (string, bool) {
			return t.TenantID, verifyRequestTenant(w, r, t.TenantID)
		},
		ValidateUpdate: func(t *MajorRequest) string {
			if t.Code == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *MajorRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.MajorCreateParams{
				TenantID: tenantID,
				Code:     t.Code,
				Name:     t.Name,
				Alias:    t.Alias,
				Enabled:  t.Enabled,
			})
		},
		UpdateFn: func(ctx context.Context, id string, t *MajorRequest) error {
			return h.Store.Update(ctx, id, store.MajorUpdateParams{
				Code:    t.Code,
				Name:    t.Name,
				Alias:   t.Alias,
				Enabled: t.Enabled,
			})
		},
		DeleteFn: h.Store.Delete,
		GetByIDFn: func(ctx context.Context, id string) (domain.Major, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.Major) string { return t.TenantID },
		DeleteChecks: []func(ctx context.Context, t *domain.Major) (string, error){
			func(ctx context.Context, t *domain.Major) (string, error) {
				count, err := h.Store.CountUserRefs(ctx, t.ID)
				if err != nil {
					return "", err
				}
				if count > 0 {
					return "该专业下仍有学生，请先将学生调整到其他专业", nil
				}
				return "", nil
			},
		},
	}
}

func (h *MajorHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *MajorHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *MajorHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *MajorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
