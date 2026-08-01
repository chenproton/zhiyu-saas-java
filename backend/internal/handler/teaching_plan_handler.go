package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TeachingPlanHandler struct {
	Service *service.PositionService
}

type TeachingPlanListResponse struct {
	Items []domain.TeachingPlan `json:"items"`
	Total int                   `json:"total"`
}

type TeachingPlanDetailResponse struct {
	TeachingPlan domain.TeachingPlan      `json:"plan"`
	Entries      []domain.TeachingPlanEntry `json:"entries"`
}

type GenerateTeachingPlanRequest struct {
	ProgramID string `json:"programId"`
	TermID    string `json:"termId"`
}

type UpdateTeachingPlanEntryRequest struct {
	WeekHours    *int     `json:"weekHours"`
	StartWeek    *int     `json:"startWeek"`
	EndWeek      *int     `json:"endWeek"`
	WeekPattern  *string  `json:"weekPattern"`
	ClassNodeID  *string  `json:"classNodeId"`
	ClassNodeIDs *[]string `json:"classNodeIds"`
	TeacherID    *string  `json:"teacherId"`
	TeacherType  *string  `json:"teacherType"`
	VenueType    *string  `json:"venueType"`
	Credits      *float64 `json:"credits"`
	TotalHours   *int     `json:"totalHours"`
	Status       *string  `json:"status"`
}

func (h *TeachingPlanHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := store.ListQueryConfig[domain.TeachingPlan]{
		Table:         "teaching_plans p LEFT JOIN training_programs tp ON tp.id = p.program_id LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN majors m ON m.id = p.major_id",
		SelectColumns: "p.id, p.program_id, COALESCE(tp.name, '') AS program_name, p.term_id, COALESCE(t.name, '') AS term_name, p.major_id, COALESCE(m.name, '') AS major_name, p.entry_year, p.status, (SELECT COUNT(*) FROM teaching_plan_entries e WHERE e.plan_id = p.id) AS entry_count, p.generated_at, p.confirmed_at",
		TenantScoped:  true,
		TenantColumn:  "p.tenant_id",
		OrderBy:       "p.generated_at DESC",
		ScanRows:      store.ScanTeachingPlanRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("p.status = " + qb.NextArg(status))
			}
			if programID := p.Values["programId"]; programID != "" {
				qb.AddCondition("p.program_id = " + qb.NextArg(programID))
			}
			if termID := p.Values["termId"]; termID != "" {
				qb.AddCondition("p.term_id = " + qb.NextArg(termID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTeachingPlans(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询教学计划失败")
		return
	}
	respondJSON(w, http.StatusOK, TeachingPlanListResponse{Items: items, Total: total})
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
		respondError(w, http.StatusInternalServerError, "查询方案课程失败")
		return
	}
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "该人培方案尚未配置课程")
		return
	}

	if existingPlanID, err := h.Service.FindTeachingPlanExisting(ctx, req.ProgramID, req.TermID, tenantID); err == nil && existingPlanID != "" {
		scheduledCount, _ := h.Service.TeachingPlanScheduledCount(ctx, existingPlanID)
		if scheduledCount > 0 {
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

	planID, err := h.Service.GenerateTeachingPlan(ctx, &store.GeneratePlanParams{
		TenantID: tenantID, ProgramID: req.ProgramID, TermID: req.TermID,
		MajorID: program.MajorID, EntryYear: program.EntryYear,
	}, courses, posScenMap, weeksCount)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成教学计划失败")
		return
	}

	plan, _ := h.Service.GetTeachingPlan(ctx, planID, tenantID)
	entries, _ := h.Service.ListTeachingPlanEntries(ctx, planID, tenantID)
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
	entries, _ := h.Service.ListTeachingPlanEntries(r.Context(), id, tenantID)
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
		respondError(w, http.StatusInternalServerError, "更新计划条目失败")
		return
	}
	entry, _ = h.Service.GetTeachingPlanEntry(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, entry)
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
		respondError(w, http.StatusInternalServerError, "确认教学计划失败")
		return
	}
	plan, _ := h.Service.GetTeachingPlan(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, plan)
}
