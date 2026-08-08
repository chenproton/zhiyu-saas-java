package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TeachingPlanHandler struct {
	Service *service.AffairsPlanService
}
type TeachingPlanDetailResponse struct {
	domain.TeachingPlan
	Entries []domain.TeachingPlanEntry `json:"entries"`
}

type GenerateTeachingPlanRequest struct {
	ProgramID string `json:"programId"`
	TermID    string `json:"termId"`
}

type UpdateTeachingPlanEntryRequest struct {
	WeekHours    *int      `json:"weekHours"`
	StartWeek    *int      `json:"startWeek"`
	EndWeek      *int      `json:"endWeek"`
	WeekPattern  *string   `json:"weekPattern"`
	ClassNodeID  *string   `json:"classNodeId"`
	ClassNodeIDs *[]string `json:"classNodeIds"`
	TeacherID    *string   `json:"teacherId"`
	TeacherType  *string   `json:"teacherType"`
	VenueType    *string   `json:"venueType"`
	Credits      *float64  `json:"credits"`
	TotalHours   *int      `json:"totalHours"`
	Status       *string   `json:"status"`
}

func (h *TeachingPlanHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().TeachingPlans().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTeachingPlans(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.TeachingPlan]{Items: items, Total: total})
}

// Create 内容管理通用入口：生成教学计划（选择人培方案+学期后生成草稿）。
func (h *TeachingPlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	h.Generate(w, r)
}

func (h *TeachingPlanHandler) Generate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req GenerateTeachingPlanRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ProgramID == "" || req.TermID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	program, err := h.Service.FetchTeachingPlanProgramBrief(ctx, req.ProgramID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	weeksCount, err := h.Service.FetchTeachingPlanTermWeeks(ctx, req.TermID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}
	courses, err := h.Service.FetchTeachingPlanCourses(ctx, req.ProgramID)
	if err != nil {
		respondServerError(w, r, err, "查询方案课程失败")
		return
	}
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "该人培方案尚未配置课程")
		return
	}

	if existingPlanID, err := h.Service.FindTeachingPlanExisting(ctx, req.ProgramID, req.TermID, tenantID); err == nil && existingPlanID != "" {
		scheduledCount, serr := h.Service.TeachingPlanScheduledCount(ctx, existingPlanID)
		if serr == nil && scheduledCount > 0 {
			respondError(w, http.StatusConflict, "该计划已有排课记录，无法重新生成")
			return
		}
	}

	posScenMap := make(map[string][]store.ScenarioBrief)
	for _, c := range courses {
		if c.PositionID != nil && *c.PositionID != "" {
			if _, ok := posScenMap[*c.PositionID]; !ok {
				scenarios, _ := h.Service.FetchPositionScenarios(ctx, *c.PositionID)
				posScenMap[*c.PositionID] = scenarios
			}
		}
	}

	var classNodeIDs []string
	if program.MajorID != nil && *program.MajorID != "" {
		classNodeIDs, err = h.Service.FetchTeachingPlanMajorClasses(ctx, tenantID, *program.MajorID)
		if err != nil {
			respondServerError(w, r, err, "查询专业班级失败")
			return
		}
	}

	planID, err := h.Service.GenerateTeachingPlan(ctx, &store.GeneratePlanParams{
		TenantID: tenantID, ProgramID: req.ProgramID, TermID: req.TermID,
		MajorID: program.MajorID, EntryYear: program.EntryYear, CreatedBy: &claims.UserID,
		ClassNodeIDs: classNodeIDs,
	}, courses, posScenMap, weeksCount)
	if err != nil {
		respondServerError(w, r, err, "生成教学计划失败")
		return
	}

	plan, err := h.Service.GetTeachingPlan(ctx, planID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划失败")
		return
	}
	entries, err := h.Service.ListTeachingPlanEntries(ctx, planID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划条目失败")
		return
	}
	respondJSON(w, http.StatusCreated, TeachingPlanDetailResponse{TeachingPlan: *plan, Entries: entries})
}

func (h *TeachingPlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	plan, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}
	entries, err := h.Service.ListTeachingPlanEntries(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询计划条目失败")
		return
	}
	respondJSON(w, http.StatusOK, TeachingPlanDetailResponse{TeachingPlan: *plan, Entries: entries})
}

func (h *TeachingPlanHandler) UpdateEntry(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	entry, err := h.Service.GetTeachingPlanEntry(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "计划条目不存在")
		return
	}
	var req UpdateTeachingPlanEntryRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.WeekHours != nil {
		entry.WeekHours = *req.WeekHours
	}
	if req.StartWeek != nil {
		entry.StartWeek = *req.StartWeek
	}
	if req.EndWeek != nil {
		entry.EndWeek = *req.EndWeek
	}
	if req.WeekPattern != nil {
		if *req.WeekPattern != "all" && *req.WeekPattern != "odd" && *req.WeekPattern != "even" {
			respondError(w, http.StatusBadRequest, "周次模式仅支持 all/odd/even")
			return
		}
		entry.WeekPattern = *req.WeekPattern
	}
	if req.ClassNodeID != nil {
		entry.ClassNodeID = emptyStrToNil(req.ClassNodeID)
	}
	if req.TeacherID != nil {
		entry.TeacherID = emptyStrToNil(req.TeacherID)
	}
	if req.TeacherType != nil {
		entry.TeacherType = emptyStrToNil(req.TeacherType)
	}
	if req.VenueType != nil {
		entry.VenueType = emptyStrToNil(req.VenueType)
	}
	if req.Credits != nil {
		entry.Credits = *req.Credits
	}
	if req.TotalHours != nil {
		entry.TotalHours = *req.TotalHours
	}
	if req.Status != nil {
		if *req.Status != "planned" && *req.Status != "scheduled" {
			respondError(w, http.StatusBadRequest, "状态仅支持 planned/scheduled")
			return
		}
		entry.Status = *req.Status
	}
	if entry.StartWeek > entry.EndWeek {
		respondError(w, http.StatusBadRequest, "起始周不能大于结束周")
		return
	}

	err = h.Service.UpdateTeachingPlanEntry(r.Context(), id, tenantID, entry, req.Credits, req.TotalHours, req.ClassNodeIDs)
	if err != nil {
		respondServerError(w, r, err, "更新计划条目失败")
		return
	}
	updatedEntry, err := h.Service.GetTeachingPlanEntry(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新后查询计划条目失败")
		return
	}
	respondJSON(w, http.StatusOK, updatedEntry)
}

func (h *TeachingPlanHandler) DeleteEntry(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetTeachingPlanEntry(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "计划条目不存在")
		return
	}
	if err := h.Service.DeleteTeachingPlanEntry(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusBadRequest, "该条目已被排课引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TeachingPlanHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if err := h.Service.ConfirmTeachingPlan(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "确认教学计划失败")
		return
	}
	plan, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划失败")
		return
	}
	respondJSON(w, http.StatusOK, plan)
}

// Update 更新计划元数据（批次绑定 / 共建人）。
func (h *TeachingPlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req struct {
		BatchID       *string  `json:"batchId"`
		Collaborators []string `json:"collaborators"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if _, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}
	var collaborators *[]string
	if req.Collaborators != nil {
		collaborators = &req.Collaborators
	}
	if err := h.Service.UpdateTeachingPlanMeta(r.Context(), id, tenantID, req.BatchID, collaborators); err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusBadRequest, "批次不存在")
			return
		}
		respondServerError(w, r, err, "更新教学计划失败")
		return
	}
	plan, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划失败")
		return
	}
	respondJSON(w, http.StatusOK, plan)
}

// Delete 删除计划（已被排课引用的计划由外键拒绝）。
func (h *TeachingPlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}
	if err := h.Service.DeleteTeachingPlan(r.Context(), id, tenantID); err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusBadRequest, "该计划已有排课记录，无法删除")
			return
		}
		respondServerError(w, r, err, "删除教学计划失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TeachingPlanHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.TeachingPlanStoreRef(),
		table:      "teaching_plans",
		entityName: "teaching_plan",
		targetType: "teaching_plan",
		inviteCol:  "collaborators",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.Service.GetTeachingPlanByID(ctx, id)
		},
	}
}

func (h *TeachingPlanHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}
func (h *TeachingPlanHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}
func (h *TeachingPlanHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}
func (h *TeachingPlanHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}
func (h *TeachingPlanHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}
func (h *TeachingPlanHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}
func (h *TeachingPlanHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

// Publish 发布（approved → published），同时记录确认时间。
func (h *TeachingPlanHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transitionWithHook(w, r, domain.StatusPublished, func(txStore *store.Store, id string) error {
		return txStore.TeachingPlans().MarkConfirmed(r.Context(), txStore.Q(), id)
	})
}
