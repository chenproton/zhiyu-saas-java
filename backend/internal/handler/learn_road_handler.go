package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type LearnRoadHandler struct {
	Store *store.LearnRoadsStore
}

type CreateLearnRoadRequest struct {
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PositionIDs []string         `json:"positionIds"`
	Steps       domain.JSONSlice `json:"steps"`
}

func (h *LearnRoadHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Store.ListConfig()

	items, total, err := executeListQuery(r.Context(), h.Store.Q(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询学习路径失败", "error", err)
		respondServerError(w, r, err, "查询学习路径失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.LearnRoad]{Items: items, Total: total})
}

// crud 返回学习路径 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *LearnRoadHandler) crud() crudConfig[CreateLearnRoadRequest, domain.LearnRoad] {
	return crudConfig[CreateLearnRoadRequest, domain.LearnRoad]{
		NotFoundMsg:  "学习路径不存在",
		CreateErrMsg: "创建学习路径失败",
		UpdateErrMsg: "更新学习路径失败",
		DeleteErrMsg: "删除学习路径失败",
		ValidateCreate: func(t *CreateLearnRoadRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			if t.Steps == nil {
				t.Steps = domain.JSONSlice{}
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *CreateLearnRoadRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *CreateLearnRoadRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *CreateLearnRoadRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.LearnRoadCreateParams{
				TenantID:    tenantID,
				Name:        t.Name,
				Description: t.Description,
				PositionIDs: t.PositionIDs,
				Steps:       t.Steps,
			})
		},
		UpdateFn: func(ctx context.Context, id string, t *CreateLearnRoadRequest) error {
			// 部分更新：未传的字段回填现有值，避免清空
			existing, err := h.Store.GetByID(ctx, id)
			if err != nil {
				return err
			}
			description := t.Description
			if description == nil {
				description = existing.Description
			}
			positionIDs := t.PositionIDs
			if positionIDs == nil {
				positionIDs = existing.PositionIDs
			}
			steps := t.Steps
			if steps == nil {
				steps = existing.Steps
			}
			return h.Store.Update(ctx, id, store.LearnRoadUpdateParams{
				Name:        t.Name,
				Description: description,
				PositionIDs: positionIDs,
				Steps:       steps,
			})
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Store.Delete(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.LearnRoad, error) {
			return h.Store.GetByID(ctx, id)
		},
	}
}

func (h *LearnRoadHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *LearnRoadHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *LearnRoadHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *LearnRoadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
