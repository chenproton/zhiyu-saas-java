package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RandomDrawQuestionHandler struct {
	Service *service.EvaluationService
}

// RandomDrawQuestionRequest 随机抽题创建/更新请求体（字段一致）。
type RandomDrawQuestionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Answer      *string `json:"answer"`
	MajorID     *string `json:"majorId"`
}

func (h *RandomDrawQuestionHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().RandomDrawQuestions().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListRandomDrawQuestions(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询随机抽题失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.RandomDrawQuestion]{Items: items, Total: total})
}

// crud 返回随机抽题 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *RandomDrawQuestionHandler) crud() crudConfig[RandomDrawQuestionRequest, domain.RandomDrawQuestion] {
	return crudConfig[RandomDrawQuestionRequest, domain.RandomDrawQuestion]{
		NotFoundMsg:        "随机抽题不存在",
		CreateErrMsg:       "创建随机抽题失败",
		UpdateErrMsg:       "更新随机抽题失败",
		DeleteErrMsg:       "删除随机抽题失败",
		UniqueViolationMsg: "现场问答题名称已存在",
		ValidateCreate: func(t *RandomDrawQuestionRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *RandomDrawQuestionRequest) (string, bool) {
			return requireTenant(w, r)
		},
		TenantFn: func(w http.ResponseWriter, r *http.Request) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *RandomDrawQuestionRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *RandomDrawQuestionRequest, tenantID, userID string) (string, error) {
			q, err := h.Service.CreateRandomDrawQuestion(ctx, tenantID, &store.RandomDrawQuestionParams{
				Name:        t.Name,
				Description: t.Description,
				Answer:      t.Answer,
				MajorID:     t.MajorID,
			})
			if err != nil {
				return "", err
			}
			return q.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *RandomDrawQuestionRequest) error {
			_, err := h.Service.UpdateRandomDrawQuestion(ctx, id, tenantID, &store.RandomDrawQuestionParams{
				Name:        t.Name,
				Description: t.Description,
				Answer:      t.Answer,
				MajorID:     t.MajorID,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteRandomDrawQuestion(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.RandomDrawQuestion, error) {
			q, err := h.Service.GetRandomDrawQuestion(ctx, id, tenantID)
			if err != nil {
				return domain.RandomDrawQuestion{}, err
			}
			return *q, nil
		},
	}
}

func (h *RandomDrawQuestionHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *RandomDrawQuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *RandomDrawQuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *RandomDrawQuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
