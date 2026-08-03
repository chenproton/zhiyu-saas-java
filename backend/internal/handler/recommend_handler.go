package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RecommendHandler struct {
	Service *service.PositionService
}

// RecommendRequest 推荐创建/更新请求体（字段一致）。
type RecommendRequest struct {
	MajorID          *string `json:"majorId"`
	CareerPositionID string  `json:"careerPositionId"`
	PositionType     string  `json:"positionType"`
	Reason           *string `json:"reason"`
	SortOrder        int     `json:"sortOrder"`
	IsEnabled        bool    `json:"isEnabled"`
}

func (h *RecommendHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Recommends().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListRecommends(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询推荐失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionRecommendation]{Items: items, Total: total})
}

// crud 返回推荐 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// 实体无 TenantID 字段，租户隔离通过 GetByIDFn 的租户限定查询实现（TenantFn=requireTenant）。
func (h *RecommendHandler) crud() crudConfig[RecommendRequest, domain.PositionRecommendation] {
	return crudConfig[RecommendRequest, domain.PositionRecommendation]{
		NotFoundMsg:  "推荐不存在",
		CreateErrMsg: "创建推荐失败",
		UpdateErrMsg: "更新推荐失败",
		DeleteErrMsg: "删除推荐失败",
		ValidateCreate: func(t *RecommendRequest) string {
			if t.CareerPositionID == "" || t.PositionType == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *RecommendRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *RecommendRequest) string {
			if t.CareerPositionID == "" || t.PositionType == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *RecommendRequest, tenantID, userID string) (string, error) {
			rec, err := h.Service.CreateRecommend(ctx, tenantID, &store.RecommendParams{
				MajorID: t.MajorID, CareerPositionID: t.CareerPositionID, PositionType: t.PositionType,
				Reason: t.Reason, SortOrder: t.SortOrder, IsEnabled: t.IsEnabled, CreatedBy: userID,
			})
			if err != nil {
				return "", err
			}
			return rec.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *RecommendRequest) error {
			_, err := h.Service.UpdateRecommend(ctx, id, tenantID, &store.RecommendParams{
				MajorID: t.MajorID, CareerPositionID: t.CareerPositionID, PositionType: t.PositionType,
				Reason: t.Reason, SortOrder: t.SortOrder, IsEnabled: t.IsEnabled,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteRecommend(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.PositionRecommendation, error) {
			rec, err := h.Service.GetRecommend(ctx, id, tenantID)
			if err != nil {
				return domain.PositionRecommendation{}, err
			}
			return *rec, nil
		},
		TenantFn: requireTenant,
	}
}

func (h *RecommendHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *RecommendHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *RecommendHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
