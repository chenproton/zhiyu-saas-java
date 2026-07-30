package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type SchedulingHandler struct {
	DB *pgxpool.Pool
}

// ---------- 场地 ----------

type VenueListResponse struct {
	Items []domain.Venue `json:"items"`
	Total int            `json:"total"`
}

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

	cfg := listQueryConfig[domain.Venue]{
		Table:         "venues",
		SelectColumns: "id, name, type, capacity, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "name",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if venueType := r.URL.Query().Get("type"); venueType != "" {
				qb.addCondition("type = " + qb.nextArg(venueType))
			}
		},
		ScanRows: func(rows pgx.Rows) ([]domain.Venue, error) {
			items := make([]domain.Venue, 0)
			for rows.Next() {
				var v domain.Venue
				if err := rows.Scan(&v.ID, &v.Name, &v.Type, &v.Capacity, &v.CreatedAt); err != nil {
					return nil, err
				}
				items = append(items, v)
			}
			return items, nil
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询场地列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询场地列表失败")
		return
	}
	respondJSON(w, http.StatusOK, VenueListResponse{Items: items, Total: total})
}

func (h *SchedulingHandler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req VenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO venues (id, tenant_id, name, type, capacity) VALUES ($1, $2, $3, $4, $5)
	`, id, tenantID, req.Name, req.Type, req.Capacity)
	if err != nil {
		slog.Error("创建场地失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建场地失败")
		return
	}

	venue, _ := h.fetchVenue(r.Context(), id, tenantID)
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
	if _, err := h.fetchVenue(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "场地不存在")
		return
	}

	var req VenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE venues SET name = $1, type = $2, capacity = $3 WHERE id = $4 AND tenant_id = $5
	`, req.Name, req.Type, req.Capacity, id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新场地失败")
		return
	}

	venue, _ := h.fetchVenue(r.Context(), id, tenantID)
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
	if _, err := h.fetchVenue(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "场地不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM venues WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "该场地已被排课引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *SchedulingHandler) fetchVenue(ctx context.Context, id, tenantID string) (domain.Venue, error) {
	var v domain.Venue
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, type, capacity, created_at FROM venues WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&v.ID, &v.Name, &v.Type, &v.Capacity, &v.CreatedAt)
	return v, err
}

// ---------- 节次 ----------

type PeriodSlotListResponse struct {
	Items []domain.PeriodSlot `json:"items"`
	Total int                 `json:"total"`
}

type PeriodSlotRequest struct {
	Name      string  `json:"name"`
	SortOrder int     `json:"sortOrder"`
	StartTime *string `json:"startTime"`
	EndTime   *string `json:"endTime"`
}

func (h *SchedulingHandler) ListPeriodSlots(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.PeriodSlot]{
		Table:         "period_slots",
		SelectColumns: "id, name, sort_order, start_time::text, end_time::text",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC",
		ScanRows:      scanPeriodSlotRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询节次列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询节次列表失败")
		return
	}
	respondJSON(w, http.StatusOK, PeriodSlotListResponse{Items: items, Total: total})
}

func (h *SchedulingHandler) CreatePeriodSlot(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req PeriodSlotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO period_slots (id, tenant_id, name, sort_order, start_time, end_time)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.Name, req.SortOrder, emptyStrToNil(req.StartTime), emptyStrToNil(req.EndTime))
	if err != nil {
		slog.Error("创建节次失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建节次失败")
		return
	}

	slot, _ := h.fetchPeriodSlot(r.Context(), id, tenantID)
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
	if _, err := h.fetchPeriodSlot(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "节次不存在")
		return
	}

	var req PeriodSlotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE period_slots SET name = $1, sort_order = $2, start_time = $3, end_time = $4
		WHERE id = $5 AND tenant_id = $6
	`, req.Name, req.SortOrder, emptyStrToNil(req.StartTime), emptyStrToNil(req.EndTime), id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新节次失败")
		return
	}

	slot, _ := h.fetchPeriodSlot(r.Context(), id, tenantID)
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
	if _, err := h.fetchPeriodSlot(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "节次不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM period_slots WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除节次失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *SchedulingHandler) fetchPeriodSlot(ctx context.Context, id, tenantID string) (domain.PeriodSlot, error) {
	var s domain.PeriodSlot
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, sort_order, start_time::text, end_time::text FROM period_slots WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&s.ID, &s.Name, &s.SortOrder, &s.StartTime, &s.EndTime)
	return s, err
}

func scanPeriodSlotRows(rows pgx.Rows) ([]domain.PeriodSlot, error) {
	items := make([]domain.PeriodSlot, 0)
	for rows.Next() {
		var s domain.PeriodSlot
		if err := rows.Scan(&s.ID, &s.Name, &s.SortOrder, &s.StartTime, &s.EndTime); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}

// ---------- 排课 ----------

type ScheduleEntryListResponse struct {
	Items []domain.ScheduleEntry `json:"items"`
	Total int                    `json:"total"`
}

type ScheduleEntryRequest struct {
	TermID      string           `json:"termId"`
	PlanEntryID *string          `json:"planEntryId"`
	CourseName  string           `json:"courseName"`
	CourseCode  *string          `json:"courseCode"`
	CourseID    *string          `json:"courseId"`
	Type        string           `json:"type"`
	ClassNodeID string           `json:"classNodeId"`
	TeacherID   *string          `json:"teacherId"`
	DayOfWeek   int              `json:"dayOfWeek"`
	Periods     domain.JSONSlice `json:"periods"`
	StartWeek   int              `json:"startWeek"`
	EndWeek     int              `json:"endWeek"`
	WeekPattern string           `json:"weekPattern"`
	VenueID     *string          `json:"venueId"`
	ScenarioID  *string          `json:"scenarioId"`
}

const scheduleEntrySelectColumns = "se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type, se.class_node_id, COALESCE(o.name, '') AS class_name, se.teacher_id, COALESCE(u.name, '') AS teacher_name, se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern, se.venue_id, COALESCE(v.name, '') AS venue_name, se.scenario_id, COALESCE(sc.name, '') AS scenario_name, se.source, se.status, se.version, se.created_at, se.updated_at"

const scheduleEntryFrom = "schedule_entries se LEFT JOIN organizations o ON o.id = se.class_node_id LEFT JOIN users u ON u.id = se.teacher_id LEFT JOIN venues v ON v.id = se.venue_id LEFT JOIN scenarios sc ON sc.id = se.scenario_id"

func scanScheduleEntryRow(rows pgx.Rows) ([]domain.ScheduleEntry, error) {
	items := make([]domain.ScheduleEntry, 0)
	for rows.Next() {
		var e domain.ScheduleEntry
		if err := rows.Scan(&e.ID, &e.TermID, &e.PlanEntryID, &e.CourseName, &e.CourseCode, &e.CourseID, &e.Type,
			&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.DayOfWeek, &e.Periods,
			&e.StartWeek, &e.EndWeek, &e.WeekPattern, &e.VenueID, &e.VenueName,
			&e.ScenarioID, &e.ScenarioName, &e.Source, &e.Status, &e.Version, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, nil
}

func (h *SchedulingHandler) ListSchedules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.ScheduleEntry]{
		Table:         scheduleEntryFrom,
		SelectColumns: scheduleEntrySelectColumns,
		TenantScoped:  true,
		TenantColumn:  "se.tenant_id",
		OrderBy:       "se.day_of_week ASC, se.start_week ASC",
		DefaultLimit:  200,
		ExtraFilter:   scheduleListFilter,
		ScanRows:      scanScheduleEntryRow,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询排课列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询排课列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ScheduleEntryListResponse{Items: items, Total: total})
}

func scheduleListFilter(r *http.Request, qb *listQueryBuilder) {
	if termID := r.URL.Query().Get("termId"); termID != "" {
		qb.addCondition("se.term_id = " + qb.nextArg(termID))
	}
	if status := r.URL.Query().Get("status"); status != "" {
		qb.addCondition("se.status = " + qb.nextArg(status))
	}
	if classNodeID := r.URL.Query().Get("classNodeId"); classNodeID != "" {
		qb.addCondition("se.class_node_id = " + qb.nextArg(classNodeID))
	}
	if teacherID := r.URL.Query().Get("teacherId"); teacherID != "" {
		qb.addCondition("se.teacher_id = " + qb.nextArg(teacherID))
	}
	if entryType := r.URL.Query().Get("type"); entryType != "" {
		qb.addCondition("se.type = " + qb.nextArg(entryType))
	}
}

func (h *SchedulingHandler) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req ScheduleEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if !validateScheduleRequest(w, &req) {
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

	conflicts, err := h.checkScheduleConflicts(ctx, tenantID, &req, "")
	if err != nil {
		slog.Error("排课冲突校验失败", "error", err)
		respondError(w, http.StatusInternalServerError, "排课冲突校验失败")
		return
	}
	if len(conflicts) > 0 {
		respondJSON(w, http.StatusConflict, map[string]interface{}{"error": "排课冲突", "conflicts": conflicts})
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

	id := uuid.NewString()
	err = withTx(ctx, h.DB, func(tx pgx.Tx) error {
		var courseID *string
		if req.CourseID != nil && *req.CourseID != "" {
			courseID = req.CourseID
		} else {
			courseID = resolveCourseIDByCode(ctx, tx, tenantID, req.CourseCode)
		}
		if req.PlanEntryID != nil && *req.PlanEntryID != "" {
			var planCourseID *string
			_ = tx.QueryRow(ctx, `SELECT course_id FROM teaching_plan_entries WHERE id = $1`, *req.PlanEntryID).Scan(&planCourseID)
			if planCourseID != nil && *planCourseID != "" {
				courseID = planCourseID
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
				class_node_id, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
				venue_id, scenario_id, source, status, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'manual', 'draft', 1)
		`, id, tenantID, req.TermID, emptyStrToNil(req.PlanEntryID), req.CourseName, emptyStrToNil(req.CourseCode), courseID, entryType,
			req.ClassNodeID, emptyStrToNil(req.TeacherID), req.DayOfWeek, req.Periods, req.StartWeek, req.EndWeek, weekPattern,
			emptyStrToNil(req.VenueID), emptyStrToNil(req.ScenarioID)); err != nil {
			return err
		}
		// 来源教学计划条目标记为已排，待排课程区不再显示
		if req.PlanEntryID != nil && *req.PlanEntryID != "" {
			if _, err := tx.Exec(ctx, `
				UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = $1
			`, *req.PlanEntryID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		slog.Error("创建排课失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建排课失败")
		return
	}

	entry, _ := h.fetchScheduleEntry(ctx, id, tenantID)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if !validateScheduleRequest(w, &req) {
		return
	}
	ctx := r.Context()

	conflicts, err := h.checkScheduleConflicts(ctx, tenantID, &req, id)
	if err != nil {
		slog.Error("排课冲突校验失败", "error", err)
		respondError(w, http.StatusInternalServerError, "排课冲突校验失败")
		return
	}
	if len(conflicts) > 0 {
		respondJSON(w, http.StatusConflict, map[string]interface{}{"error": "排课冲突", "conflicts": conflicts})
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

	var courseID *string
	if req.CourseID != nil && *req.CourseID != "" {
		courseID = req.CourseID
	} else {
		courseID = resolveCourseIDByCode(ctx, h.DB, tenantID, req.CourseCode)
	}
	if req.PlanEntryID != nil && *req.PlanEntryID != "" {
		var planCourseID *string
		_ = h.DB.QueryRow(ctx, `SELECT course_id FROM teaching_plan_entries WHERE id = $1`, *req.PlanEntryID).Scan(&planCourseID)
		if planCourseID != nil && *planCourseID != "" {
			courseID = planCourseID
		}
	}
	_, err = h.DB.Exec(ctx, `
		UPDATE schedule_entries
		SET term_id = $1, plan_entry_id = $2, course_name = $3, course_code = $4, course_id = $5, type = $6,
			class_node_id = $7, teacher_id = $8, day_of_week = $9, periods = $10,
			start_week = $11, end_week = $12, week_pattern = $13, venue_id = $14, scenario_id = $15, updated_at = NOW()
		WHERE id = $16 AND tenant_id = $17
	`, req.TermID, emptyStrToNil(req.PlanEntryID), req.CourseName, emptyStrToNil(req.CourseCode), courseID, entryType,
		req.ClassNodeID, emptyStrToNil(req.TeacherID), req.DayOfWeek, req.Periods,
		req.StartWeek, req.EndWeek, weekPattern, emptyStrToNil(req.VenueID), emptyStrToNil(req.ScenarioID), id, tenantID)
	if err != nil {
		slog.Error("更新排课失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新排课失败")
		return
	}

	entry, _ := h.fetchScheduleEntry(ctx, id, tenantID)
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
	err = withTx(ctx, h.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM schedule_entries WHERE id = $1 AND tenant_id = $2`, id, tenantID); err != nil {
			return err
		}
		// 该计划条目已无其他排课时恢复为待排
		if entry.PlanEntryID != nil && *entry.PlanEntryID != "" {
			if _, err := tx.Exec(ctx, `
				UPDATE teaching_plan_entries SET status = 'planned'
				WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM schedule_entries WHERE plan_entry_id = $1)
			`, *entry.PlanEntryID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除排课失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
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

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE schedule_entries SET status = 'published', version = version + 1, updated_at = NOW()
		WHERE tenant_id = $1 AND term_id = $2 AND status = 'draft'
	`, tenantID, req.TermID)
	if err != nil {
		slog.Error("发布课表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "发布课表失败")
		return
	}

	var version int
	_ = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(MAX(version), 1) FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2
	`, tenantID, req.TermID).Scan(&version)

	respondJSON(w, http.StatusOK, map[string]interface{}{"published": tag.RowsAffected(), "version": version})
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
		slog.Error("查询课表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询课表失败")
		return
	}

	var version int
	_ = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(MAX(version), 1) FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2 AND status = 'published'
	`, tenantID, termID).Scan(&version)

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items), "version": version})
}

func (h *SchedulingHandler) listTimetableEntries(ctx context.Context, tenantID, termID, classNodeID, teacherID, status string) ([]domain.ScheduleEntry, error) {
	qb := &listQueryBuilder{idx: 1}
	qb.addCondition("se.tenant_id = " + qb.nextArg(tenantID))
	qb.addCondition("se.term_id = " + qb.nextArg(termID))
	qb.addCondition("se.status = " + qb.nextArg(status))
	if classNodeID != "" {
		qb.addCondition("se.class_node_id = " + qb.nextArg(classNodeID))
	}
	if teacherID != "" {
		qb.addCondition("se.teacher_id = " + qb.nextArg(teacherID))
	}

	rows, err := h.DB.Query(ctx, `
		SELECT `+scheduleEntrySelectColumns+`
		FROM `+scheduleEntryFrom+`
		WHERE `+qb.whereClause()+`
		ORDER BY se.day_of_week ASC, se.start_week ASC
	`, qb.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduleEntryRow(rows)
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

	termID := r.URL.Query().Get("termId")
	if termID == "" {
		// 缺省时取当前学期，未设置当前学期则取最近一个
		err := h.DB.QueryRow(ctx, `
			SELECT id FROM terms WHERE tenant_id = $1 ORDER BY is_current DESC, start_date DESC LIMIT 1
		`, tenantID).Scan(&termID)
		if err != nil {
			respondError(w, http.StatusNotFound, "尚未配置学期")
			return
		}
	}
	term, err := h.fetchTermBrief(ctx, termID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	var classNodeID, teacherID string
	viewAs := "teacher"
	if middleware.HasRole(claims, "student") {
		viewAs = "student"
		var nodeID *string
		if err := h.DB.QueryRow(ctx, `
			SELECT org_node_id FROM users WHERE id = $1 AND tenant_id = $2
		`, claims.UserID, tenantID).Scan(&nodeID); err == nil && nodeID != nil {
			classNodeID = *nodeID
		}
	} else {
		teacherID = claims.UserID
	}

	items := make([]domain.ScheduleEntry, 0)
	if classNodeID != "" || teacherID != "" {
		items, err = h.listTimetableEntries(ctx, tenantID, termID, classNodeID, teacherID, "published")
		if err != nil {
			slog.Error("查询个人课表失败", "error", err)
			respondError(w, http.StatusInternalServerError, "查询个人课表失败")
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

func jsonSliceToStrings(s domain.JSONSlice) []string {
	out := make([]string, 0, len(s))
	for _, v := range s {
		if str, ok := v.(string); ok && str != "" {
			out = append(out, str)
		}
	}
	return out
}

// checkScheduleConflicts 校验同一 term 下教师/班级/场地的时间冲突：
// 周次区间重叠 × day_of_week 相同 × 周次模式相容 × periods(JSONB) 有交集。
// excludeID 用于更新时排除自身。
func (h *SchedulingHandler) checkScheduleConflicts(ctx context.Context, tenantID string, req *ScheduleEntryRequest, excludeID string) ([]domain.ScheduleConflict, error) {
	periods := jsonSliceToStrings(req.Periods)
	if len(periods) == 0 {
		return nil, nil
	}
	weekPattern := req.WeekPattern
	if weekPattern == "" {
		weekPattern = "all"
	}

	rows, err := h.DB.Query(ctx, `
		SELECT se.id, se.course_name, COALESCE(o.name, ''), COALESCE(u.name, ''), COALESCE(v.name, ''),
			se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern,
			se.teacher_id, se.class_node_id, se.venue_id
		FROM schedule_entries se
		LEFT JOIN organizations o ON o.id = se.class_node_id
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		WHERE se.tenant_id = $1 AND se.term_id = $2 AND se.day_of_week = $3
			AND NOT (se.end_week < $4 OR se.start_week > $5)
			AND (se.week_pattern = $6 OR se.week_pattern = 'all' OR $6 = 'all')
			AND se.periods ?| $7
			AND ($8 = '' OR se.id::text <> $8)
	`, tenantID, req.TermID, req.DayOfWeek, req.StartWeek, req.EndWeek, weekPattern, periods, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conflicts := make([]domain.ScheduleConflict, 0)
	for rows.Next() {
		var c domain.ScheduleConflict
		var rowTeacherID, rowClassNodeID, rowVenueID *string
		if err := rows.Scan(&c.EntryID, &c.CourseName, &c.ClassName, &c.TeacherName, &c.VenueName,
			&c.DayOfWeek, &c.Periods, &c.StartWeek, &c.EndWeek, &c.WeekPattern,
			&rowTeacherID, &rowClassNodeID, &rowVenueID); err != nil {
			return nil, err
		}

		if req.TeacherID != nil && *req.TeacherID != "" && rowTeacherID != nil && *rowTeacherID == *req.TeacherID {
			dup := c
			dup.Kind = "teacher"
			conflicts = append(conflicts, dup)
		}
		if rowClassNodeID != nil && *rowClassNodeID == req.ClassNodeID {
			dup := c
			dup.Kind = "class"
			conflicts = append(conflicts, dup)
		}
		if req.VenueID != nil && *req.VenueID != "" && rowVenueID != nil && *rowVenueID == *req.VenueID {
			dup := c
			dup.Kind = "venue"
			conflicts = append(conflicts, dup)
		}
	}
	return conflicts, rows.Err()
}

func (h *SchedulingHandler) fetchScheduleEntry(ctx context.Context, id, tenantID string) (domain.ScheduleEntry, error) {
	var e domain.ScheduleEntry
	err := h.DB.QueryRow(ctx, `
		SELECT `+scheduleEntrySelectColumns+`
		FROM `+scheduleEntryFrom+`
		WHERE se.id = $1 AND se.tenant_id = $2
	`, id, tenantID).Scan(&e.ID, &e.TermID, &e.PlanEntryID, &e.CourseName, &e.CourseCode, &e.CourseID, &e.Type,
		&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.DayOfWeek, &e.Periods,
		&e.StartWeek, &e.EndWeek, &e.WeekPattern, &e.VenueID, &e.VenueName,
		&e.ScenarioID, &e.ScenarioName, &e.Source, &e.Status, &e.Version, &e.CreatedAt, &e.UpdatedAt)
	return e, err
}

// rowQuerier abstracts pgx.Tx and *pgxpool.Pool for resolveCourseIDByCode.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

// resolveCourseIDByCode 根据课程代码查询课程 ID，用于排课保存时回填 schedule_entries.course_id。
func resolveCourseIDByCode(ctx context.Context, db rowQuerier, tenantID string, courseCode *string) *string {
	if courseCode == nil || *courseCode == "" {
		return nil
	}
	var id string
	err := db.QueryRow(ctx, `
		SELECT id FROM courses WHERE tenant_id = $1 AND code = $2 AND type = 'system' LIMIT 1
	`, tenantID, *courseCode).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *SchedulingHandler) fetchTermBrief(ctx context.Context, id, tenantID string) (domain.Term, error) {
	var t domain.Term
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, to_char(start_date, 'YYYY-MM-DD'), to_char(end_date, 'YYYY-MM-DD'), weeks_count, is_current, created_at
		FROM terms WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&t.ID, &t.Name, &t.StartDate, &t.EndDate, &t.WeeksCount, &t.IsCurrent, &t.CreatedAt)
	return t, err
}
