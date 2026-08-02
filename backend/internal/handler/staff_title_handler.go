package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type StaffTitleHandler struct {
	Service *service.StaffTitleService
	Store   *store.StaffTitlesStore
}

// StaffTitleRequest 职称创建/更新请求体（更新流程忽略 tenantId 与 code）。
type StaffTitleRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type ToggleStaffTitleStatusRequest struct {
	Status string `json:"status"`
}

func (h *StaffTitleHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := store.ListQueryConfig[domain.StaffTitle]{
		Table:         "staff_titles",
		SelectColumns: "id, tenant_id, code, name, description, user_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ScanRows:      h.Store.ScanRows,
	}

	items, total, err := executeListQuery(r.Context(), h.Service.Queryer(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询职称失败", "error", err)
		respondServerError(w, r, err, "查询职称失败")
		return
	}

	if len(items) > 0 {
		if tenantID, ok := tenantFilter(middleware.CurrentUser(r)); ok {
			ids := make([]string, len(items))
			for i := range items {
				ids[i] = items[i].ID
			}
			counts, _ := h.Store.BatchCountUsersByTitle(r.Context(), tenantID, ids)
			for i := range items {
				items[i].UserCount = counts[items[i].ID]
			}
		}
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.StaffTitle]{Items: items, Total: total})
}

// crud 返回职称 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *StaffTitleHandler) crud() crudConfig[StaffTitleRequest, domain.StaffTitle] {
	return crudConfig[StaffTitleRequest, domain.StaffTitle]{
		NotFoundMsg:        "职称不存在",
		CreateErrMsg:       "创建职称失败",
		UpdateErrMsg:       "更新职称失败",
		DeleteErrMsg:       "删除职称失败",
		DeleteCheckErrMsg:  "检查职称引用失败",
		Permit:             canManageUsers,
		UniqueViolationMsg: "职称代码已存在，请使用其他代码",
		CheckOwnership:     true,
		GetOwnership:       true,
		ValidateCreate: func(t *StaffTitleRequest) string {
			if t.TenantID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			if t.Status == "" {
				t.Status = "active"
			}
			if t.Status != "active" && t.Status != "inactive" {
				return "无效状态"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *StaffTitleRequest) (string, bool) {
			return t.TenantID, verifyRequestTenant(w, r, t.TenantID)
		},
		ValidateUpdate: func(t *StaffTitleRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			if t.Status != "" && t.Status != "active" && t.Status != "inactive" {
				return "无效状态"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *StaffTitleRequest, tenantID, userID string) (string, error) {
			code := t.Code
			if code == "" {
				code = generateCodeFromName(t.Name)
			}
			return h.Store.Create(ctx, store.StaffTitleCreateParams{
				TenantID:    tenantID,
				Code:        code,
				Name:        t.Name,
				Description: t.Description,
				Status:      t.Status,
			})
		},
		UpdateFn: func(ctx context.Context, id string, t *StaffTitleRequest) error {
			return h.Store.Update(ctx, id, store.StaffTitleUpdateParams{
				Name:        t.Name,
				Description: t.Description,
				Status:      t.Status,
			})
		},
		DeleteFn: h.Store.Delete,
		GetByIDFn: func(ctx context.Context, id string) (domain.StaffTitle, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.StaffTitle) string { return t.TenantID },
		AfterLoad: func(ctx context.Context, t *domain.StaffTitle) error {
			count, _ := h.Store.CountUserRefs(ctx, t.TenantID, t.ID)
			t.UserCount = count
			return nil
		},
		DeleteChecks: []func(ctx context.Context, t *domain.StaffTitle) (string, error){
			func(ctx context.Context, t *domain.StaffTitle) (string, error) {
				count, err := h.Store.CountUserRefs(ctx, t.TenantID, t.ID)
				if err != nil {
					return "", err
				}
				if count > 0 {
					return "该职位仍有用户关联，不可删除", nil
				}
				return "", nil
			},
		},
	}
}

func (h *StaffTitleHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *StaffTitleHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *StaffTitleHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *StaffTitleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}

func (h *StaffTitleHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var req ToggleStaffTitleStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	if err := h.Store.UpdateStatus(r.Context(), id, req.Status); err != nil {
		respondServerError(w, r, err, "更新状态失败")
		return
	}

	title, _ = h.Store.GetByID(r.Context(), id)
	count, _ := h.Store.CountUserRefs(r.Context(), title.TenantID, id)
	title.UserCount = count
	respondJSON(w, http.StatusOK, title)
}

func generateCodeFromName(name string) string {
	var b strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if b.Len() > 0 && b.String()[b.Len()-1] != '_' {
			b.WriteRune('_')
		}
	}
	code := strings.Trim(b.String(), "_")
	if code == "" {
		code = "title"
	}
	return code
}
