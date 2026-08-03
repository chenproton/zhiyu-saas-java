package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type KnowledgePointHandler struct {
	Service *service.LessonContentService
}

// KnowledgePointRequest 知识点创建/更新请求体（更新时忽略 sourceType/sourceId）。
type KnowledgePointRequest struct {
	Name              string           `json:"name"`
	Code              *string          `json:"code"`
	Description       *string          `json:"description"`
	Linked            bool             `json:"linked"`
	GranularLessonIds domain.JSONSlice `json:"granularLessonIds"`
	SourceType        *string          `json:"sourceType"`
	SourceID          *string          `json:"sourceId"`
}

func (h *KnowledgePointHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().KnowledgePoints().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListKnowledgePoints(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询知识点失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.KnowledgePoint]{Items: items, Total: total})
}

// crud 返回知识点 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *KnowledgePointHandler) crud() crudConfig[KnowledgePointRequest, domain.KnowledgePoint] {
	return crudConfig[KnowledgePointRequest, domain.KnowledgePoint]{
		NotFoundMsg:        "知识点不存在",
		CreateErrMsg:       "创建知识点失败",
		UpdateErrMsg:       "更新知识点失败",
		DeleteErrMsg:       "删除知识点失败",
		UniqueViolationMsg: "知识点名称已存在，请使用其他名称",
		ValidateCreate: func(t *KnowledgePointRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *KnowledgePointRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *KnowledgePointRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *KnowledgePointRequest, tenantID, userID string) (string, error) {
			kp, err := h.Service.CreateKnowledgePoint(ctx, tenantID, &store.KnowledgePointCreateParams{
				Name:              t.Name,
				Code:              t.Code,
				Description:       t.Description,
				Linked:            t.Linked,
				GranularLessonIds: t.GranularLessonIds,
				CreatorID:         userID,
				SourceType:        t.SourceType,
				SourceID:          t.SourceID,
			})
			if err != nil {
				return "", err
			}
			return kp.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *KnowledgePointRequest) error {
			_, err := h.Service.UpdateKnowledgePoint(ctx, tenantID, id, &store.KnowledgePointUpdateParams{
				Name:              t.Name,
				Code:              t.Code,
				Description:       t.Description,
				Linked:            t.Linked,
				GranularLessonIds: t.GranularLessonIds,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteKnowledgePoint(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.KnowledgePoint, error) {
			kp, err := h.Service.GetKnowledgePoint(ctx, id, tenantID)
			if err != nil {
				return domain.KnowledgePoint{}, err
			}
			return *kp, nil
		},
		TenantFn: requireTenant,
	}
}

func (h *KnowledgePointHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *KnowledgePointHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *KnowledgePointHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *KnowledgePointHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
