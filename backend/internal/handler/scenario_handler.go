package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioHandler struct {
	Service *service.ScenarioService
	DB      *store.Store
}

type ScenarioListResponse struct {
	Items []domain.Scenario `json:"items"`
	Total int               `json:"total"`
}

type CreateScenarioRequest struct {
	Name             string   `json:"name"`
	Code             string   `json:"code"`
	CoverImage       *string  `json:"coverImage"`
	CareerPositionID *string  `json:"careerPositionId"`
	IndustryIDs      []string `json:"industryIds"`
	ProfessionIDs    []string `json:"professionIds"`
	BatchID          *string  `json:"batchId"`
	Difficulty       int      `json:"difficulty"`
	Version          string   `json:"version"`
	Background       *string  `json:"background"`
	DeliveryGoal     *string  `json:"deliveryGoal"`
	CoBuilderIDs     []string `json:"coBuilderIds"`
}

// NullableString tracks whether a JSON field was explicitly provided so that
// omitted fields can keep their existing value while explicit null/empty values
// can clear the column.
type NullableString struct {
	Value   *string
	Present bool
}

func (n *NullableString) UnmarshalJSON(data []byte) error {
	n.Present = true
	if string(data) == "null" {
		n.Value = nil
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	n.Value = &s
	return nil
}

// NullableStringSlice tracks whether a JSON array field was explicitly provided.
type NullableStringSlice struct {
	Value   []string
	Present bool
}

func (n *NullableStringSlice) UnmarshalJSON(data []byte) error {
	n.Present = true
	if string(data) == "null" {
		n.Value = nil
		return nil
	}
	var s []string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	n.Value = s
	return nil
}

type UpdateScenarioRequest struct {
	Name             string              `json:"name"`
	Code             string              `json:"code"`
	CoverImage       NullableString      `json:"coverImage"`
	CareerPositionID NullableString      `json:"careerPositionId"`
	IndustryIDs      NullableStringSlice `json:"industryIds"`
	ProfessionIDs    NullableStringSlice `json:"professionIds"`
	BatchID          NullableString      `json:"batchId"`
	Difficulty       int                 `json:"difficulty"`
	Version          string              `json:"version"`
	Background       NullableString      `json:"background"`
	DeliveryGoal     NullableString      `json:"deliveryGoal"`
	CoBuilderIDs     []string            `json:"coBuilderIds"`
}

func (h *ScenarioHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.Scenario]{
		Table: "scenarios s LEFT JOIN LATERAL (SELECT COALESCE(array_agg(i.name), '{}') AS names FROM industries i WHERE i.id::text = ANY(s.industry_ids)) ind ON true LEFT JOIN LATERAL (SELECT COALESCE(array_agg(m2.name), '{}') AS names FROM majors m2 WHERE m2.id = ANY(s.profession_ids)) prof ON true LEFT JOIN view_counters vc ON vc.target_type = 'scenario' AND vc.target_id = s.id LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM scenario_tasks t WHERE t.scenario_id = s.id) tcnt ON true",
		SelectColumns: `s.id, s.name, s.code, s.cover_image, s.career_position_id, s.industry_ids, COALESCE(ind.names, '{}') AS industry_names, s.profession_ids, COALESCE(prof.names, '{}') AS profession_names, s.batch_id, s.difficulty, s.version, s.status, s.background, s.delivery_goal, s.creator_id, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time, COALESCE(vc.cnt, 0) AS view_count, COALESCE(tcnt.cnt, 0) AS task_count`,
		TenantScoped:  true,
		TenantColumn:  "s.tenant_id",
		SearchColumns: []string{"s.name", "s.code"},
		SearchParam:   "search",
		OrderBy:       "s.created_at DESC",
		DefaultLimit:  50,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			status := p.Values["status"]
			batchID := p.Values["batchId"]
			careerPositionID := p.Values["careerPositionId"]
			if status != "" {
				qb.AddCondition("s.status = " + qb.NextArg(status))
			} else {
				qb.AddCondition("s.status != " + qb.NextArg("archived"))
			}
			if batchID != "" {
				qb.AddCondition("s.batch_id = " + qb.NextArg(batchID))
			}
			if careerPositionID != "" {
				qb.AddCondition("s.career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询场景方案失败")
		return
	}
	respondJSON(w, http.StatusOK, ScenarioListResponse{Items: items, Total: total})
}

func (h *ScenarioHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	claims := middleware.CurrentUser(r)
	var userID, tenantID any
	if claims != nil {
		userID = claims.UserID
		if claims.TenantID != nil {
			tenantID = *claims.TenantID
		}
	}
	_ = h.Service.IncrementView(r.Context(), id, userID, tenantID)
	scenario, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景方案不存在")
		return
	}
	respondJSON(w, http.StatusOK, scenario)
}

func (h *ScenarioHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateScenarioRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Version == "" {
		req.Version = "v1.0"
	}

	var tenantID *string
	if claims.TenantID != nil && *claims.TenantID != "" {
		tenantID = claims.TenantID
	}
	if tenantID == nil || *tenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	code, err := store.GenerateUniqueEntityCode(r.Context(), h.DB.Q(), "CJ", "scenarios", *tenantID)
	if err != nil {
		respondServerError(w, r, err, "生成scenario code失败")
		return
	}

	scenario, err := h.Service.Create(r.Context(), *tenantID, &store.ScenarioCreateParams{
		Name:             req.Name,
		Code:             code,
		CoverImage:       req.CoverImage,
		CareerPositionID: req.CareerPositionID,
		IndustryIDs:      coalesceStringSlice(req.IndustryIDs),
		ProfessionIDs:    coalesceStringSlice(req.ProfessionIDs),
		BatchID:          emptyStrToNil(req.BatchID),
		Difficulty:       req.Difficulty,
		Version:          req.Version,
		Background:       req.Background,
		DeliveryGoal:     req.DeliveryGoal,
		CreatorID:        claims.UserID,
		CoBuilderIDs:     coalesceStringSlice(req.CoBuilderIDs),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "场景方案代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建场景方案失败")
		return
	}
	respondJSON(w, http.StatusCreated, scenario)
}

func (h *ScenarioHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景方案不存在")
		return
	}

	var req UpdateScenarioRequest
	if !decodeBody(w, r, &req) {
		return
	}

	name := req.Name
	if name == "" {
		name = existing.Name
	}
	version := req.Version
	if version == "" {
		version = existing.Version
	}
	difficulty := req.Difficulty
	if difficulty == 0 {
		difficulty = existing.Difficulty
	}
	coBuilderIDs := req.CoBuilderIDs
	if coBuilderIDs == nil {
		coBuilderIDs = existing.CoBuilderIDs
	}

	resolveNullable := func(n NullableString, existing *string) *string {
		if !n.Present {
			return existing
		}
		if n.Value != nil && *n.Value == "" {
			return nil
		}
		return n.Value
	}
	resolveNullableSlice := func(n NullableStringSlice, existing []string) []string {
		if !n.Present {
			return existing
		}
		return coalesceStringSlice(n.Value)
	}

	coverImage := resolveNullable(req.CoverImage, existing.CoverImage)
	careerPositionID := resolveNullable(req.CareerPositionID, existing.CareerPositionID)
	industryIDs := resolveNullableSlice(req.IndustryIDs, existing.IndustryIDs)
	professionIDs := resolveNullableSlice(req.ProfessionIDs, existing.ProfessionIDs)
	batchID := resolveNullable(req.BatchID, existing.BatchID)
	background := resolveNullable(req.Background, existing.Background)
	deliveryGoal := resolveNullable(req.DeliveryGoal, existing.DeliveryGoal)

	scenario, err := h.Service.Update(r.Context(), id, &store.ScenarioUpdateParams{
		Name:             name,
		CoverImage:       coverImage,
		CareerPositionID: careerPositionID,
		IndustryIDs:      industryIDs,
		ProfessionIDs:    professionIDs,
		BatchID:          batchID,
		Difficulty:       difficulty,
		Version:          version,
		Background:       background,
		DeliveryGoal:     deliveryGoal,
		CoBuilderIDs:     coBuilderIDs,
	})
	if err != nil {
		respondServerError(w, r, err, "更新场景方案失败")
		return
	}
	respondJSON(w, http.StatusOK, scenario)
}

func (h *ScenarioHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.Get(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "场景方案不存在")
		return
	}
	if err := h.Service.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除场景方案失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioHandler) actions() contentActions {
	return contentActions{
		db:         h.DB.Q(),
		pool:       h.DB,
		table:      "scenarios",
		entityName: "scenario",
		targetType: "scenario",
		inviteCol:  "co_builder_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.Service.Get(ctx, id)
		},
	}
}

func (h *ScenarioHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *ScenarioHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ScenarioHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *ScenarioHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *ScenarioHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *ScenarioHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *ScenarioHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ScenarioHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}
