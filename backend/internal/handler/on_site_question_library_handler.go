package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

type OnSiteQuestionLibraryHandler struct {
	Store *store.OnSiteQuestionLibraryStore
}

// OnSiteQuestionLibraryRequest 现场题库题目创建/更新请求体。
// 更新流程为部分更新：指针字段未传时回填现有值。
type OnSiteQuestionLibraryRequest struct {
	QuestionText      *string  `json:"questionText"`
	Answer            *string  `json:"answer"`
	QuestionType      *string  `json:"questionType"`
	Score             *float64 `json:"score"`
	Difficulty        *string  `json:"difficulty"`
	KnowledgePointIDs []string `json:"knowledgePointIds"`
	Tags              []string `json:"tags"`
}

func (h *OnSiteQuestionLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := h.Store.ListConfig()
	items, total, err := executeListQuery[domain.OnSiteQuestionLibraryItem](r.Context(), h.Store.Q(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询现场题库列表失败", "error", err)
		respondServerError(w, r, err, "查询现场题库列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.OnSiteQuestionLibraryItem]{Items: items, Total: total})
}

// crud 返回现场题库题目 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *OnSiteQuestionLibraryHandler) crud() crudConfig[OnSiteQuestionLibraryRequest, domain.OnSiteQuestionLibraryItem] {
	return crudConfig[OnSiteQuestionLibraryRequest, domain.OnSiteQuestionLibraryItem]{
		NotFoundMsg:    "题目不存在",
		CreateErrMsg:   "创建题目失败",
		UpdateErrMsg:   "更新题目失败",
		DeleteErrMsg:   "删除题目失败",
		CheckOwnership: true,
		GetOwnership:   true,
		ValidateCreate: func(t *OnSiteQuestionLibraryRequest) string {
			if t.QuestionText == nil || *t.QuestionText == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *OnSiteQuestionLibraryRequest) (string, bool) {
			return requireTenant(w, r)
		},
		CreateFn: func(ctx context.Context, t *OnSiteQuestionLibraryRequest, tenantID, userID string) (string, error) {
			qt := ""
			if t.QuestionType != nil {
				qt = *t.QuestionType
			}
			score := 0.0
			if t.Score != nil {
				score = *t.Score
			}
			return h.Store.Create(ctx, store.OnSiteQuestionLibraryCreateParams{
				TenantID:          tenantID,
				QuestionText:      *t.QuestionText,
				Answer:            t.Answer,
				QuestionType:      qt,
				Score:             score,
				Difficulty:        t.Difficulty,
				KnowledgePointIDs: coalesceStringSlice(t.KnowledgePointIDs),
				Tags:              coalesceStringSlice(t.Tags),
				CreatorID:         userID,
			})
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *OnSiteQuestionLibraryRequest) error {
			// 部分更新：未传的字段回填现有值，避免清空
			existing, err := h.Store.GetByID(ctx, id)
			if err != nil {
				return err
			}
			q := existing.QuestionText
			if t.QuestionText != nil {
				q = *t.QuestionText
			}
			a := existing.Answer
			if t.Answer != nil {
				a = t.Answer
			}
			qt := existing.QuestionType
			if t.QuestionType != nil {
				qt = *t.QuestionType
			}
			s := existing.Score
			if t.Score != nil {
				s = *t.Score
			}
			d := existing.Difficulty
			if t.Difficulty != nil {
				d = t.Difficulty
			}
			kps := coalesceStringSlice(t.KnowledgePointIDs)
			if len(kps) == 0 {
				kps = existing.KnowledgePointIDs
			}
			ts := coalesceStringSlice(t.Tags)
			if len(ts) == 0 {
				ts = existing.Tags
			}
			return h.Store.Update(ctx, id, store.OnSiteQuestionLibraryUpdateParams{
				QuestionText:      q,
				Answer:            a,
				QuestionType:      qt,
				Score:             s,
				Difficulty:        d,
				KnowledgePointIDs: kps,
				Tags:              ts,
			})
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Store.Delete(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.OnSiteQuestionLibraryItem, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.OnSiteQuestionLibraryItem) string { return t.TenantID },
	}
}

func (h *OnSiteQuestionLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *OnSiteQuestionLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *OnSiteQuestionLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *OnSiteQuestionLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
