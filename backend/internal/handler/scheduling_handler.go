package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type SchedulingHandler struct {
	Service *service.AffairsService
}

// ---------- 场地 ----------
type VenueRequest struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Capacity *int   `json:"capacity"`
}

func (h *SchedulingHandler) ListVenues(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Scheduling().ListVenuesConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListVenues(r.Context(), params, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询场地列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Venue]{Items: items, Total: total})
}

func (h *SchedulingHandler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req VenueRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	venue, err := h.Service.CreateVenue(r.Context(), &store.VenueParams{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Capacity: req.Capacity,
	})
	if err != nil {
		respondServerError(w, r, err, "创建场地失败")
		return
	}
	respondJSON(w, http.StatusCreated, venue)
}

func (h *SchedulingHandler) UpdateVenue(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Service.GetVenue(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "场地不存在")
		return
	}

	var req VenueRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	venue, err := h.Service.UpdateVenue(r.Context(), id, tenantID, &store.VenueParams{
		Name:     req.Name,
		Type:     req.Type,
		Capacity: req.Capacity,
	})
	if err != nil {
		respondServerError(w, r, err, "更新场地失败")
		return
	}
	respondJSON(w, http.StatusOK, venue)
}

func (h *SchedulingHandler) DeleteVenue(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Service.GetVenue(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "场地不存在")
		return
	}

	if err := h.Service.DeleteVenue(r.Context(), id, tenantID); err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusBadRequest, "该场地已被排课引用，无法删除")
			return
		}
		respondServerError(w, r, err, "删除场地失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ---------- 节次 ----------
type PeriodSlotRequest struct {
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	SortOrder int     `json:"sortOrder"`
	StartTime *string `json:"startTime"`
	EndTime   *string `json:"endTime"`
}

// periodSlotType 归一化节次时段类型，空值默认 morning（上午）。
func periodSlotType(t string) string {
	switch t {
	case "morning_self", "afternoon", "evening", "morning":
		return t
	default:
		return "morning"
	}
}

func (h *SchedulingHandler) ListPeriodSlots(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Scheduling().ListPeriodSlotsConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListPeriodSlotsPage(r.Context(), params, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询节次列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PeriodSlot]{Items: items, Total: total})
}

func (h *SchedulingHandler) CreatePeriodSlot(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req PeriodSlotRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	slot, err := h.Service.CreatePeriodSlot(r.Context(), &store.PeriodSlotParams{
		TenantID:  tenantID,
		Name:      req.Name,
		Type:      periodSlotType(req.Type),
		SortOrder: req.SortOrder,
		StartTime: emptyStrToNil(req.StartTime),
		EndTime:   emptyStrToNil(req.EndTime),
	})
	if err != nil {
		respondServerError(w, r, err, "创建节次失败")
		return
	}
	respondJSON(w, http.StatusCreated, slot)
}

func (h *SchedulingHandler) UpdatePeriodSlot(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Service.GetPeriodSlot(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "节次不存在")
		return
	}

	var req PeriodSlotRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	slot, err := h.Service.UpdatePeriodSlot(r.Context(), id, tenantID, &store.PeriodSlotParams{
		Name:      req.Name,
		Type:      periodSlotType(req.Type),
		SortOrder: req.SortOrder,
		StartTime: emptyStrToNil(req.StartTime),
		EndTime:   emptyStrToNil(req.EndTime),
	})
	if err != nil {
		respondServerError(w, r, err, "更新节次失败")
		return
	}
	respondJSON(w, http.StatusOK, slot)
}

func (h *SchedulingHandler) DeletePeriodSlot(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.Service.GetPeriodSlot(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "节次不存在")
		return
	}

	if err := h.Service.DeletePeriodSlot(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除节次失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ReplacePeriodSlots PUT /affairs/period-slots/replace — 按名称整体替换节次（事务内）。
type ReplacePeriodSlotsRequest struct {
	Items []PeriodSlotRequest `json:"items"`
}

func (h *SchedulingHandler) ReplacePeriodSlots(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req ReplacePeriodSlotsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		respondError(w, http.StatusBadRequest, "节次列表不能为空")
		return
	}
	for _, it := range req.Items {
		if it.Name == "" {
			respondError(w, http.StatusBadRequest, "节次名称不能为空")
			return
		}
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	items := make([]store.PeriodSlotParams, 0, len(req.Items))
	for _, it := range req.Items {
		items = append(items, store.PeriodSlotParams{
			TenantID:  tenantID,
			Name:      it.Name,
			Type:      periodSlotType(it.Type),
			SortOrder: it.SortOrder,
			StartTime: emptyStrToNil(it.StartTime),
			EndTime:   emptyStrToNil(it.EndTime),
		})
	}
	slots, err := h.Service.ReplacePeriodSlots(r.Context(), tenantID, items)
	if err != nil {
		respondServerError(w, r, err, "保存节次失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PeriodSlot]{Items: slots, Total: len(slots)})
}

// ---------- 排课 ----------
type ScheduleEntryRequest struct {
	TermID       string           `json:"termId"`
	PlanEntryID  *string          `json:"planEntryId"`
	CourseName   string           `json:"courseName"`
	CourseCode   *string          `json:"courseCode"`
	CourseID     *string          `json:"courseId"`
	Type         string           `json:"type"`
	ClassNodeID  string           `json:"classNodeId"`
	ClassNodeIDs []string         `json:"classNodeIds"`
	TeacherID    *string          `json:"teacherId"`
	DayOfWeek    int              `json:"dayOfWeek"`
	Periods      domain.JSONSlice `json:"periods"`
	StartWeek    int              `json:"startWeek"`
	EndWeek      int              `json:"endWeek"`
	WeekPattern  string           `json:"weekPattern"`
	VenueID      *string          `json:"venueId"`
	ScenarioID   *string          `json:"scenarioId"`
}

func (h *SchedulingHandler) ListSchedules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Scheduling().ListSchedulesConfig()

	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListSchedules(r.Context(), params, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询排课列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScheduleEntry]{Items: items, Total: total})
}

func (h *SchedulingHandler) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req ScheduleEntryRequest
	if !decodeBody(w, r, &req) {
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	// 班级兜底：请求未带班级且来源教学计划条目时，优先从 junction table 读取，
	// 再 fallback 到 class_node_id 字段。
	if req.PlanEntryID != nil && *req.PlanEntryID != "" {
		if !h.checkPlanEntryTenant(w, r, ctx, *req.PlanEntryID, tenantID) {
			return
		}
	}
	if req.ClassNodeID == "" && req.PlanEntryID != nil && *req.PlanEntryID != "" {
		fallbackClassID := h.Service.FallbackClassID(ctx, *req.PlanEntryID)
		if fallbackClassID != nil && *fallbackClassID != "" {
			req.ClassNodeID = *fallbackClassID
		} else {
			respondError(w, http.StatusBadRequest, "该教学计划条目尚未设置班级，请先在教学计划中设置班级")
			return
		}
	}

	if !validateScheduleRequest(w, &req) {
		return
	}

	if _, err := h.fetchTermBrief(ctx, req.TermID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	entryType := req.Type
	if entryType == "" {
		entryType = "traditional"
	}
	weekPattern := req.WeekPattern
	if weekPattern == "" {
		weekPattern = "all"
	}

	courseID := req.CourseID
	if courseID == nil || *courseID == "" {
		courseID = h.Service.ResolveCourseIDByCode(ctx, tenantID, req.CourseCode)
	}
	if req.PlanEntryID != nil && *req.PlanEntryID != "" {
		if planCourseID := h.Service.PlanEntryCourseID(ctx, *req.PlanEntryID); planCourseID != nil && *planCourseID != "" {
			courseID = planCourseID
		}
	}
	// 合并班级：优先 classNodeIds 数组，缺省回退 classNodeId
	classIDs := req.ClassNodeIDs
	if len(classIDs) == 0 && req.ClassNodeID != "" {
		classIDs = []string{req.ClassNodeID}
	}
	primaryClass := req.ClassNodeID
	if primaryClass == "" && len(classIDs) > 0 {
		primaryClass = classIDs[0]
	}

	id, conflicts, err := h.Service.CreateScheduleChecked(ctx, tenantID, &store.ScheduleCreateParams{
		TenantID:     tenantID,
		TermID:       req.TermID,
		PlanEntryID:  emptyStrToNil(req.PlanEntryID),
		CourseName:   req.CourseName,
		CourseCode:   emptyStrToNil(req.CourseCode),
		CourseID:     courseID,
		Type:         entryType,
		ClassNodeID:  primaryClass,
		ClassNodeIDs: classIDs,
		TeacherID:    emptyStrToNil(req.TeacherID),
		DayOfWeek:    req.DayOfWeek,
		Periods:      req.Periods,
		StartWeek:    req.StartWeek,
		EndWeek:      req.EndWeek,
		WeekPattern:  weekPattern,
		VenueID:      emptyStrToNil(req.VenueID),
		ScenarioID:   emptyStrToNil(req.ScenarioID),
		Source:       "manual",
	})
	if err != nil {
		respondServerError(w, r, err, "创建排课失败")
		return
	}
	if len(conflicts) > 0 {
		respondJSON(w, http.StatusConflict, map[string]interface{}{"error": "排课冲突", "conflicts": conflicts})
		return
	}

	entry, err := h.fetchScheduleEntry(ctx, id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "创建排课失败")
		return
	}
	respondJSON(w, http.StatusCreated, entry)
}

func (h *SchedulingHandler) UpdateSchedule(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.fetchScheduleEntry(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "排课记录不存在")
		return
	}

	var req ScheduleEntryRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validateScheduleRequest(w, &req) {
		return
	}
	ctx := r.Context()

	entryType := req.Type
	if entryType == "" {
		entryType = "traditional"
	}
	weekPattern := req.WeekPattern
	if weekPattern == "" {
		weekPattern = "all"
	}

	courseID := req.CourseID
	if courseID == nil || *courseID == "" {
		courseID = h.Service.ResolveCourseIDByCode(ctx, tenantID, req.CourseCode)
	}
	if req.PlanEntryID != nil && *req.PlanEntryID != "" {
		// 校验教学计划条目属于当前租户，防止跨租户引用
		if !h.checkPlanEntryTenant(w, r, ctx, *req.PlanEntryID, tenantID) {
			return
		}
		if planCourseID := h.Service.PlanEntryCourseID(ctx, *req.PlanEntryID); planCourseID != nil && *planCourseID != "" {
			courseID = planCourseID
		}
	}
	classIDs := req.ClassNodeIDs
	if len(classIDs) == 0 && req.ClassNodeID != "" {
		classIDs = []string{req.ClassNodeID}
	}
	primaryClass := req.ClassNodeID
	if primaryClass == "" && len(classIDs) > 0 {
		primaryClass = classIDs[0]
	}
	conflicts, err := h.Service.UpdateScheduleChecked(ctx, id, tenantID, &store.ScheduleCreateParams{
		TermID:       req.TermID,
		PlanEntryID:  emptyStrToNil(req.PlanEntryID),
		CourseName:   req.CourseName,
		CourseCode:   emptyStrToNil(req.CourseCode),
		CourseID:     courseID,
		Type:         entryType,
		ClassNodeID:  primaryClass,
		ClassNodeIDs: classIDs,
		TeacherID:    emptyStrToNil(req.TeacherID),
		DayOfWeek:    req.DayOfWeek,
		Periods:      req.Periods,
		StartWeek:    req.StartWeek,
		EndWeek:      req.EndWeek,
		WeekPattern:  weekPattern,
		VenueID:      emptyStrToNil(req.VenueID),
		ScenarioID:   emptyStrToNil(req.ScenarioID),
	})
	if err != nil {
		respondServerError(w, r, err, "更新排课失败")
		return
	}
	if len(conflicts) > 0 {
		respondJSON(w, http.StatusConflict, map[string]interface{}{"error": "排课冲突", "conflicts": conflicts})
		return
	}

	entry, err := h.fetchScheduleEntry(ctx, id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "更新排课失败")
		return
	}
	respondJSON(w, http.StatusOK, entry)
}

func (h *SchedulingHandler) DeleteSchedule(w http.ResponseWriter, r *http.Request) {
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
	entry, err := h.fetchScheduleEntry(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "排课记录不存在")
		return
	}

	ctx := r.Context()
	err = h.Service.DeleteScheduleWithRestore(ctx, id, tenantID, entry.PlanEntryID)
	if err != nil {
		respondServerError(w, r, err, "删除排课失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// AutoSchedule POST /affairs/schedules/auto-schedule — 为教学计划待排条目自动分配时间+场地。
func (h *SchedulingHandler) AutoSchedule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req struct {
		TermID string `json:"termId"`
		PlanID string `json:"planId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TermID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段 termId")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	if _, err := h.fetchTermBrief(ctx, req.TermID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	success, failed, failures, err := h.Service.AutoSchedule(ctx, tenantID, req.TermID, req.PlanID)
	if err != nil {
		if errors.Is(err, service.ErrNoPeriodSlots) || errors.Is(err, service.ErrNoVenues) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondServerError(w, r, err, "自动排课失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":  success,
		"failed":   failed,
		"failures": failures,
	})
}

// PublishSchedules POST /affairs/schedules/publish — 按 term 批量发布（draft → published，version+1）。
func (h *SchedulingHandler) PublishSchedules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req struct {
		TermID string `json:"termId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TermID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段 termId")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.fetchTermBrief(r.Context(), req.TermID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	published, version, err := h.Service.PublishSchedules(r.Context(), tenantID, req.TermID)
	if err != nil {
		respondServerError(w, r, err, "发布课表失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"published": published, "version": version})
}

// ExportSchedules GET /affairs/schedules/export?termId= — 导出教学计划课程列表 + 参考表。
// 主表：该学期教学计划全部条目（已排的回填 星期/节次/教师/场地/班级，未排的留空待填）。
// 参考表：教师名单 / 场地名单 / 班级名单 / 节次表。
func (h *SchedulingHandler) ExportSchedules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	termID := r.URL.Query().Get("termId")
	if termID == "" {
		respondError(w, http.StatusBadRequest, "缺少 termId 参数")
		return
	}
	term, err := h.fetchTermBrief(r.Context(), termID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	dayMap := map[int]string{1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}
	weekPatMap := map[string]string{"all": "全部", "odd": "单周", "even": "双周"}

	// ===== 主表：课程列表 =====
	mainSheet := "课程列表"
	f.NewSheet(mainSheet)
	headers := []string{"课程名称 *", "类型", "起始周 *", "结束周 *", "周次模式", "星期", "节次", "教师", "场地", "班级"}
	widths := []float64{28, 10, 10, 10, 10, 8, 20, 16, 18, 30}
	note := "填写说明：\n* 必填列。\n星期：1-7 或 周一~周日。\n节次：填写节次名称（如 上午1-2）。\n教师：姓名或登录账号。\n场地：场地名称。\n班级：班级名称，多个班级用逗号分隔。\n已排课的条目已回填星期/节次/教师/场地/班级，未排的留空待你填写。\n参考「教师名单/场地名单/班级名单/节次表」Sheet 填写。\n导入时将以该表为准，先清空当前学期排课再重新生成。"
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	f.MergeCell(mainSheet, start, end)
	f.SetCellValue(mainSheet, start, note)
	f.SetCellStyle(mainSheet, start, end, noteStyle)
	f.SetCellStyle(mainSheet, start, end, wrapAlign)
	f.SetRowHeight(mainSheet, 1, 90)
	for ci, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(mainSheet, cell, hdr)
		f.SetCellStyle(mainSheet, cell, cell, hdrStyle)
		f.SetColWidth(mainSheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(mainSheet, 2, 28)
	f.SetPanes(mainSheet, &excelize.Panes{Freeze: true, YSplit: 2})

	// 已排课映射：plan_entry_id -> (day, periods, teacherName, venueName, classNames)
	schedMap := map[string]map[string]string{}
	srows, err := h.Service.ListScheduledExportMap(r.Context(), tenantID, termID)
	if err != nil {
		respondServerError(w, r, err, "导出排课表生成失败")
		return
	}
	for _, m := range srows {
		if m.PlanEntryID != nil {
			schedMap[*m.PlanEntryID] = map[string]string{
				"day": dayMap[m.Day], "periods": strings.Join(store.JSONSliceToStrings(m.Periods), "，"),
				"teacher": m.TeacherName, "venue": m.VenueName, "classes": strings.Join(m.ClassNames, "，"),
			}
		}
	}

	// 教学计划全部条目
	entries, err := h.Service.ListPlanEntryBriefs(r.Context(), tenantID, termID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划失败")
		return
	}
	rowIdx := 3
	for _, e := range entries {
		sd := schedMap[e.ID]
		typeLabel := "课程"
		if e.EntryType == "scene" {
			typeLabel = "场景"
		}
		vals := []interface{}{
			e.CourseName, typeLabel, e.StartWeek, e.EndWeek, weekPatMap[e.WeekPattern],
			sd["day"], sd["periods"], sd["teacher"], sd["venue"], sd["classes"],
		}
		for ci, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(ci+1, rowIdx)
			f.SetCellValue(mainSheet, cell, v)
		}
		rowIdx++
	}

	// ===== 参考表：教师名单（全部教师） =====
	teacherSheet := "【参考】教师名单"
	f.NewSheet(teacherSheet)
	f.SetCellValue(teacherSheet, "A1", "教师姓名")
	f.SetCellStyle(teacherSheet, "A1", "A1", hdrStyle)
	teacherNames, err := h.Service.ListTeacherNames(r.Context(), tenantID)
	if err != nil {
		slog.Warn("schedule export query failed", "error", err)
	}
	ti := 2
	for _, n := range teacherNames {
		if cell, err := excelize.CoordinatesToCellName(1, ti); err == nil {
			f.SetCellValue(teacherSheet, cell, n)
		}
		ti++
	}
	f.SetColWidth(teacherSheet, "A", "A", 20)

	// ===== 参考表：场地名单（全部场地） =====
	venueSheet := "【参考】场地名单"
	f.NewSheet(venueSheet)
	f.SetCellValue(venueSheet, "A1", "场地名称")
	f.SetCellStyle(venueSheet, "A1", "A1", hdrStyle)
	f.SetCellValue(venueSheet, "B1", "类型")
	f.SetCellStyle(venueSheet, "B1", "B1", hdrStyle)
	venueBriefs, err := h.Service.ListVenueBriefs(r.Context(), tenantID)
	if err != nil {
		slog.Warn("schedule export query failed", "error", err)
	}
	vi := 2
	for _, v := range venueBriefs {
		if c1, e1 := excelize.CoordinatesToCellName(1, vi); e1 == nil {
			f.SetCellValue(venueSheet, c1, v.Name)
		}
		if c2, e2 := excelize.CoordinatesToCellName(2, vi); e2 == nil {
			f.SetCellValue(venueSheet, c2, v.Type)
		}
		vi++
	}
	f.SetColWidth(venueSheet, "A", "A", 20)
	f.SetColWidth(venueSheet, "B", "B", 16)

	// ===== 参考表：班级名单（全部班级组织节点） =====
	classSheet := "【参考】班级名单"
	f.NewSheet(classSheet)
	f.SetCellValue(classSheet, "A1", "班级名称")
	f.SetCellStyle(classSheet, "A1", "A1", hdrStyle)
	classNames, err := h.Service.ListClassNames(r.Context(), tenantID)
	if err != nil {
		slog.Warn("schedule export query failed", "error", err)
	}
	ci2 := 2
	for _, n := range classNames {
		if cell, err := excelize.CoordinatesToCellName(1, ci2); err == nil {
			f.SetCellValue(classSheet, cell, n)
		}
		ci2++
	}
	f.SetColWidth(classSheet, "A", "A", 24)

	// ===== 参考表：节次表 =====
	periodSheet := "【参考】节次表"
	f.NewSheet(periodSheet)
	f.SetCellValue(periodSheet, "A1", "节次名称")
	f.SetCellStyle(periodSheet, "A1", "A1", hdrStyle)
	f.SetCellValue(periodSheet, "B1", "开始时间")
	f.SetCellStyle(periodSheet, "B1", "B1", hdrStyle)
	f.SetCellValue(periodSheet, "C1", "结束时间")
	f.SetCellStyle(periodSheet, "C1", "C1", hdrStyle)
	periodSlots, err := h.Service.ListPeriodSlots(r.Context(), tenantID)
	if err != nil {
		slog.Warn("schedule export query failed", "error", err)
	}
	pi := 2
	for _, ps := range periodSlots {
		s, e := "", ""
		if ps.StartTime != nil {
			s = *ps.StartTime
		}
		if ps.EndTime != nil {
			e = *ps.EndTime
		}
		if c1, e1 := excelize.CoordinatesToCellName(1, pi); e1 == nil {
			f.SetCellValue(periodSheet, c1, ps.Name)
		}
		if c2, e2 := excelize.CoordinatesToCellName(2, pi); e2 == nil {
			f.SetCellValue(periodSheet, c2, s)
		}
		if c3, e3 := excelize.CoordinatesToCellName(3, pi); e3 == nil {
			f.SetCellValue(periodSheet, c3, e)
		}
		pi++
	}

	f.DeleteSheet("Sheet1")
	idx, _ := f.GetSheetIndex(mainSheet)
	f.SetActiveSheet(idx)
	writeExcel(w, f, "排课导入_"+term.Name+".xlsx")
}

// Timetable GET /affairs/schedules/timetable?termId=&classNodeId=&teacherId= — 班级/教师课表视图。
// 默认只返回已发布（published）课表，可用 status 参数覆盖。
func (h *SchedulingHandler) Timetable(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	termID := r.URL.Query().Get("termId")
	classNodeID := r.URL.Query().Get("classNodeId")
	teacherID := r.URL.Query().Get("teacherId")
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "published"
	}
	if classNodeID == "" && teacherID == "" {
		respondError(w, http.StatusBadRequest, "缺少 classNodeId 或 teacherId 参数")
		return
	}
	if termID == "" {
		respondError(w, http.StatusBadRequest, "缺少 termId 参数")
		return
	}

	items, err := h.listTimetableEntries(r.Context(), tenantID, termID, classNodeID, teacherID, status)
	if err != nil {
		respondServerError(w, r, err, "查询课表失败")
		return
	}

	version := h.Service.TimetableVersion(r.Context(), tenantID, termID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items), "version": version})
}

func (h *SchedulingHandler) listTimetableEntries(ctx context.Context, tenantID, termID, classNodeID, teacherID, status string) ([]domain.ScheduleEntry, error) {
	return h.Service.ListTimetableEntries(ctx, tenantID, termID, classNodeID, teacherID, status)
}

// MySchedule GET /portal/workspace/my-schedule?termId= — 个人课表。
// 学生 → 其班级组织节点的已发布排课；教师/其他角色 → teacher_id=本人的已发布排课。
func (h *SchedulingHandler) MySchedule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	ctx := r.Context()

	var classNodeID, teacherID string
	viewAs := "teacher"
	if middleware.HasRole(claims, domain.RoleStudent) {
		viewAs = "student"
		if nodeID := h.Service.UserOrgNodeID(ctx, claims.UserID, tenantID); nodeID != nil {
			classNodeID = *nodeID
		}
	} else {
		teacherID = claims.UserID
	}

	termID := r.URL.Query().Get("termId")
	if termID == "" {
		t, err := h.Service.FindTermForSchedule(ctx, tenantID, claims.UserID, classNodeID)
		if err != nil {
			respondError(w, http.StatusNotFound, "尚未配置学期")
			return
		}
		termID = t
	}
	term, err := h.fetchTermBrief(ctx, termID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	items := make([]domain.ScheduleEntry, 0)
	if classNodeID != "" || teacherID != "" {
		items, err = h.listTimetableEntries(ctx, tenantID, termID, classNodeID, teacherID, "published")
		if err != nil {
			respondServerError(w, r, err, "查询个人课表失败")
			return
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"term":   term,
		"viewAs": viewAs,
		"items":  items,
		"total":  len(items),
	})
}

// ---------- 排课内部助手 ----------

func validateScheduleRequest(w http.ResponseWriter, req *ScheduleEntryRequest) bool {
	if req.TermID == "" || req.CourseName == "" || req.ClassNodeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段（termId/courseName/classNodeId）")
		return false
	}
	if req.DayOfWeek < 1 || req.DayOfWeek > 7 {
		respondError(w, http.StatusBadRequest, "星期取值必须为 1-7")
		return false
	}
	if len(req.Periods) == 0 {
		respondError(w, http.StatusBadRequest, "节次不能为空")
		return false
	}
	if req.StartWeek <= 0 || req.EndWeek <= 0 || req.StartWeek > req.EndWeek {
		respondError(w, http.StatusBadRequest, "周次区间无效")
		return false
	}
	if req.WeekPattern != "" && req.WeekPattern != "all" && req.WeekPattern != "odd" && req.WeekPattern != "even" {
		respondError(w, http.StatusBadRequest, "周次模式仅支持 all/odd/even")
		return false
	}
	return true
}

func (h *SchedulingHandler) fetchScheduleEntry(ctx context.Context, id, tenantID string) (*domain.ScheduleEntry, error) {
	return h.Service.GetSchedule(ctx, id, tenantID)
}

// checkPlanEntryTenant 校验教学计划条目属于当前租户，防止跨租户引用排课。
func (h *SchedulingHandler) checkPlanEntryTenant(w http.ResponseWriter, r *http.Request, ctx context.Context, planEntryID, tenantID string) bool {
	entryTenant, err := h.Service.PlanEntryTenantID(ctx, planEntryID)
	if err != nil {
		respondError(w, http.StatusNotFound, "教学计划条目不存在")
		return false
	}
	if entryTenant != tenantID {
		respondError(w, http.StatusNotFound, "教学计划条目不存在")
		return false
	}
	return true
}

func (h *SchedulingHandler) fetchTermBrief(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	return h.Service.FetchTermBrief(ctx, id, tenantID)
}
