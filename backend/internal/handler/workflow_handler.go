package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type WorkflowHandler struct {
	Service *service.ApprovalService
}

// WorkflowRequest 审批流程创建/更新请求体（更新时忽略 status 时默认沿用现有状态）。
type WorkflowRequest struct {
	Name        string             `json:"name"`
	Scene       *string            `json:"scene"`
	Description *string            `json:"description"`
	Steps       domain.JSONSlice   `json:"steps"`
	MajorIds    domain.StringSlice `json:"majorIds"`
	Status      string             `json:"status"`
}

func (h *WorkflowHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Workflows().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListWorkflows(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询审批流程失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Workflow]{Items: items, Total: total})
}

// crud 返回审批流程 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *WorkflowHandler) crud() crudConfig[WorkflowRequest, domain.Workflow] {
	return crudConfig[WorkflowRequest, domain.Workflow]{
		NotFoundMsg:        "审批流程不存在",
		CreateErrMsg:       "创建审批流程失败",
		UpdateErrMsg:       "更新审批流程失败",
		DeleteErrMsg:       "删除审批流程失败",
		UniqueViolationMsg: "工作流名称已存在，请使用其他名称",
		CheckOwnership:     true,
		ValidateCreate: func(t *WorkflowRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *WorkflowRequest) (string, bool) {
			claims := middleware.CurrentUser(r)
			if claims == nil || claims.TenantID == nil {
				return "", true
			}
			return *claims.TenantID, true
		},
		ValidateUpdate: func(t *WorkflowRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		ValidateUpdateExisting: func(t *WorkflowRequest, existing *domain.Workflow) string {
			if t.Status == "" {
				t.Status = string(existing.Status)
			}
			if t.Status != string(domain.WorkflowStatusActive) && t.Status != string(domain.WorkflowStatusInactive) {
				return "无效状态"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *WorkflowRequest, tenantID, userID string) (string, error) {
			steps := t.Steps
			if steps == nil {
				steps = domain.JSONSlice{}
			}
			majorIds := t.MajorIds
			if majorIds == nil {
				majorIds = domain.StringSlice{}
			}
			wf, err := h.Service.CreateWorkflow(ctx, store.StrPtrIfNonEmpty(tenantID), &store.WorkflowParams{
				Name: t.Name, Scene: t.Scene, Description: t.Description,
				Steps: steps, MajorIds: majorIds, Status: domain.WorkflowStatusActive,
			})
			if err != nil {
				return "", err
			}
			return wf.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *WorkflowRequest) error {
			// 部分更新兜底：未携带的列表字段回退现有值，防止清空已配置步骤/适用专业
			existing, err := h.Service.GetWorkflow(ctx, id, tenantID)
			if err != nil {
				return err
			}
			steps := t.Steps
			if steps == nil {
				steps = existing.Steps
			}
			majorIds := t.MajorIds
			if majorIds == nil {
				majorIds = existing.MajorIds
			}
			if t.Name == "" {
				t.Name = existing.Name
			}
			if t.Description == nil {
				t.Description = existing.Description
			}
			_, err = h.Service.UpdateWorkflow(ctx, id, tenantID, &store.WorkflowParams{
				Name: t.Name, Scene: t.Scene, Description: t.Description,
				Steps: steps, MajorIds: majorIds, Status: domain.WorkflowStatus(t.Status),
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteWorkflow(ctx, id, tenantID)
		},
		DeleteChecks: []func(ctx context.Context, t *domain.Workflow) (string, error){
			func(ctx context.Context, t *domain.Workflow) (string, error) {
				hasPending, err := h.Service.WorkflowHasPendingApprovals(ctx, t.ID)
				if err != nil {
					return "", err
				}
				if hasPending {
					return "该审批流程仍有待处理的审批单，无法删除", nil
				}
				return "", nil
			},
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.Workflow, error) {
			wf, err := h.Service.GetWorkflow(ctx, id, tenantID)
			if err != nil {
				return domain.Workflow{}, err
			}
			return *wf, nil
		},
		TenantFn: requireTenant,
		TenantIDFn: func(t *domain.Workflow) string {
			if t.TenantID == nil {
				return ""
			}
			return *t.TenantID
		},
	}
}

func (h *WorkflowHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *WorkflowHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *WorkflowHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *WorkflowHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
