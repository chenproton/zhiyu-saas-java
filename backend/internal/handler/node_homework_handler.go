package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeHomeworkHandler struct {
	Service *service.LessonContentService
}

// NodeHomeworkRequest 作业创建/更新请求体（更新时忽略 nodeId）。
type NodeHomeworkRequest struct {
	NodeID         string     `json:"nodeId"`
	Title          string     `json:"title"`
	Requirement    *string    `json:"requirement"`
	NeedAttachment bool       `json:"needAttachment"`
	Deadline       *time.Time `json:"deadline"`
}

func (h *NodeHomeworkHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().NodeHomeworks().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListNodeHomeworks(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询作业失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.NodeHomework]{Items: items, Total: total})
}

// crud 返回作业 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// 实体无 TenantID 字段，租户隔离通过 GetByIDFn 的租户限定查询实现（TenantFn=requireTenant）。
func (h *NodeHomeworkHandler) crud() crudConfig[NodeHomeworkRequest, domain.NodeHomework] {
	return crudConfig[NodeHomeworkRequest, domain.NodeHomework]{
		NotFoundMsg:  "作业不存在",
		CreateErrMsg: "创建作业失败",
		UpdateErrMsg: "更新作业失败",
		DeleteErrMsg: "删除作业失败",
		ValidateCreate: func(t *NodeHomeworkRequest) string {
			if t.NodeID == "" || t.Title == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *NodeHomeworkRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *NodeHomeworkRequest) string {
			if t.Title == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *NodeHomeworkRequest, tenantID, userID string) (string, error) {
			hw, err := h.Service.CreateNodeHomework(ctx, tenantID, &store.NodeHomeworkCreateParams{
				NodeID:         t.NodeID,
				Title:          t.Title,
				Requirement:    t.Requirement,
				NeedAttachment: t.NeedAttachment,
				Deadline:       t.Deadline,
			})
			if err != nil {
				return "", err
			}
			return hw.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *NodeHomeworkRequest) error {
			// 部分更新兜底：未携带字段回退现有值
			existing, err := h.Service.GetNodeHomework(ctx, id, tenantID)
			if err != nil {
				return err
			}
			if t.Requirement == nil {
				t.Requirement = existing.Requirement
			}
			if t.Deadline == nil {
				t.Deadline = existing.Deadline
			}
			if t.Title == "" {
				t.Title = existing.Title
			}
			_, err = h.Service.UpdateNodeHomework(ctx, id, tenantID, &store.NodeHomeworkUpdateParams{
				Title:          t.Title,
				Requirement:    t.Requirement,
				NeedAttachment: t.NeedAttachment,
				Deadline:       t.Deadline,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteNodeHomework(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.NodeHomework, error) {
			hw, err := h.Service.GetNodeHomework(ctx, id, tenantID)
			if err != nil {
				return domain.NodeHomework{}, err
			}
			return *hw, nil
		},
		TenantFn: requireTenant,
	}
}

func (h *NodeHomeworkHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *NodeHomeworkHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *NodeHomeworkHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *NodeHomeworkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
