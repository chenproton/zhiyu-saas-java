package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
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

const scheduleEntrySelectColumns = "se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type, se.class_node_id, COALESCE(o.name, '') AS class_name, se.teacher_id, COALESCE(u.name, '') AS teacher_name, se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern, se.venue_id, COALESCE(v.name, '') AS venue_name, se.scenario_id, COALESCE(sc.name, '') AS scenario_name, se.source, se.status, se.version, se.created_at, se.updated_at, COALESCE(se.class_node_ids, '{}') AS class_node_ids, COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names"

const scheduleEntryFrom = "schedule_entries se LEFT JOIN organizations o ON o.id = se.class_node_id LEFT JOIN users u ON u.id = se.teacher_id LEFT JOIN venues v ON v.id = se.venue_id LEFT JOIN scenarios sc ON sc.id = se.scenario_id"

func scanScheduleEntryRow(rows pgx.Rows) ([]domain.ScheduleEntry, error) {
	items := make([]domain.ScheduleEntry, 0)
	for rows.Next() {
		var e domain.ScheduleEntry
		if err := rows.Scan(&e.ID, &e.TermID, &e.PlanEntryID, &e.CourseName, &e.CourseCode, &e.CourseID, &e.Type,
			&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.DayOfWeek, &e.Periods,
			&e.StartWeek, &e.EndWeek, &e.WeekPattern, &e.VenueID, &e.VenueName,
			&e.ScenarioID, &e.ScenarioName, &e.Source, &e.Status, &e.Version, &e.CreatedAt, &e.UpdatedAt,
			&e.ClassNodeIDs, &e.ClassNames); err != nil {
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
		qb.addCondition("(se.class_node_id = " + qb.nextArg(classNodeID) + " OR " + qb.nextArg(classNodeID) + " = ANY(se.class_node_ids))")
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

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	// 班级兜底：请求未带班级且来源教学计划条目时，优先从 junction table 读取，
	// 再 fallback 到 class_node_id 字段。
	if req.ClassNodeID == "" && req.PlanEntryID != nil && *req.PlanEntryID != "" {
		// 优先查多班级关联表
		var fallbackClassID *string
		_ = h.DB.QueryRow(ctx, `
			SELECT ec.class_node_id FROM teaching_plan_entry_classes ec WHERE ec.entry_id = $1 LIMIT 1
		`, *req.PlanEntryID).Scan(&fallbackClassID)
		if fallbackClassID == nil {
			_ = h.DB.QueryRow(ctx, `
				SELECT class_node_id FROM teaching_plan_entries WHERE id = $1
			`, *req.PlanEntryID).Scan(&fallbackClassID)
		}
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
		// 合并班级：优先 classNodeIds 数组，缺省回退 classNodeId
		classIDs := req.ClassNodeIDs
		if len(classIDs) == 0 && req.ClassNodeID != "" {
			classIDs = []string{req.ClassNodeID}
		}
		primaryClass := req.ClassNodeID
		if primaryClass == "" && len(classIDs) > 0 {
			primaryClass = classIDs[0]
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
				class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
				venue_id, scenario_id, source, status, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'manual', 'draft', 1)
		`, id, tenantID, req.TermID, emptyStrToNil(req.PlanEntryID), req.CourseName, emptyStrToNil(req.CourseCode), courseID, entryType,
			primaryClass, classIDs, emptyStrToNil(req.TeacherID), req.DayOfWeek, req.Periods, req.StartWeek, req.EndWeek, weekPattern,
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
	classIDs := req.ClassNodeIDs
	if len(classIDs) == 0 && req.ClassNodeID != "" {
		classIDs = []string{req.ClassNodeID}
	}
	primaryClass := req.ClassNodeID
	if primaryClass == "" && len(classIDs) > 0 {
		primaryClass = classIDs[0]
	}
	_, err = h.DB.Exec(ctx, `
		UPDATE schedule_entries
		SET term_id = $1, plan_entry_id = $2, course_name = $3, course_code = $4, course_id = $5, type = $6,
			class_node_id = $7, class_node_ids = $8, teacher_id = $9, day_of_week = $10, periods = $11,
			start_week = $12, end_week = $13, week_pattern = $14, venue_id = $15, scenario_id = $16, updated_at = NOW()
		WHERE id = $17 AND tenant_id = $18
	`, req.TermID, emptyStrToNil(req.PlanEntryID), req.CourseName, emptyStrToNil(req.CourseCode), courseID, entryType,
		primaryClass, classIDs, emptyStrToNil(req.TeacherID), req.DayOfWeek, req.Periods,
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

	// 加载节次与场地
	periodRows, err := h.DB.Query(ctx, `
		SELECT id, name, sort_order FROM period_slots WHERE tenant_id = $1 ORDER BY sort_order ASC
	`, tenantID)
	if err != nil {
		slog.Error("自动排课加载节次失败", "error", err)
		respondError(w, http.StatusInternalServerError, "加载节次失败")
		return
	}
	defer periodRows.Close()
	periodNames := make([]string, 0)
	for periodRows.Next() {
		var id, name string
		var sortOrder int
		if err := periodRows.Scan(&id, &name, &sortOrder); err != nil {
			continue
		}
		periodNames = append(periodNames, name)
	}
	if len(periodNames) == 0 {
		respondError(w, http.StatusBadRequest, "尚未配置节次，无法自动排课")
		return
	}

	venueRows, err := h.DB.Query(ctx, `
		SELECT id, name, type FROM venues WHERE tenant_id = $1 ORDER BY name
	`, tenantID)
	if err != nil {
		slog.Error("自动排课加载场地失败", "error", err)
		respondError(w, http.StatusInternalServerError, "加载场地失败")
		return
	}
	defer venueRows.Close()
	type venueInfo struct {
		id   string
		name string
		vtype string
	}
	venues := make([]venueInfo, 0)
	for venueRows.Next() {
		var v venueInfo
		if err := venueRows.Scan(&v.id, &v.name, &v.vtype); err != nil {
			continue
		}
		venues = append(venues, v)
	}
	if len(venues) == 0 {
		respondError(w, http.StatusBadRequest, "尚未配置场地，无法自动排课")
		return
	}

	// 加载待排教学计划条目
	var planFilter string
	args := []interface{}{tenantID, req.TermID}
	if req.PlanID != "" {
		planFilter = " AND p.id = $3"
		args = append(args, req.PlanID)
	}
	entryRows, err := h.DB.Query(ctx, `
		SELECT e.id, e.course_name, e.course_code, e.type, e.start_week, e.end_week, e.week_pattern,
			COALESCE(e.class_node_id::text, ''), COALESCE(e.teacher_id::text, ''), COALESCE(e.venue_type, ''),
			COALESCE(e.scenario_id::text, ''), COALESCE(e.course_id::text, '')
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		WHERE p.tenant_id = $1 AND p.term_id = $2 AND p.status = 'confirmed' AND e.status = 'planned'`+planFilter+`
		ORDER BY e.start_week, e.course_name
	`, args...)
	if err != nil {
		slog.Error("自动排课加载待排条目失败", "error", err)
		respondError(w, http.StatusInternalServerError, "加载待排条目失败")
		return
	}
	defer entryRows.Close()

	type planEntry struct {
		id          string
		courseName  string
		courseCode  string
		entryType   string
		startWeek   int
		endWeek     int
		weekPattern string
		classNodeID string
		teacherID   string
		venueType   string
		scenarioID  string
		courseID    string
	}
	pending := make([]planEntry, 0)
	for entryRows.Next() {
		var e planEntry
		if err := entryRows.Scan(&e.id, &e.courseName, &e.courseCode, &e.entryType, &e.startWeek, &e.endWeek, &e.weekPattern,
			&e.classNodeID, &e.teacherID, &e.venueType, &e.scenarioID, &e.courseID); err != nil {
			continue
		}
		if e.classNodeID == "" {
			continue
		}
		pending = append(pending, e)
	}

	success := 0
	failed := 0
	failures := make([]string, 0)

	for _, e := range pending {
		// 优先按 venueType 过滤场地，无匹配则使用全部场地
		candidateVenues := venues
		if e.venueType != "" {
			filtered := make([]venueInfo, 0)
			for _, v := range venues {
				if v.vtype == e.venueType {
					filtered = append(filtered, v)
				}
			}
			if len(filtered) > 0 {
				candidateVenues = filtered
			}
		}

		placed := false
		entryType := e.entryType
		if entryType == "theory" || entryType == "practice" {
			entryType = "traditional"
		}

	dayLoop:
		for day := 1; day <= 7; day++ {
			for _, periodName := range periodNames {
				for _, venue := range candidateVenues {
					schedReq := &ScheduleEntryRequest{
						TermID:      req.TermID,
						PlanEntryID: &e.id,
						CourseName:  e.courseName,
						CourseCode:  strPtrIfNonEmpty(e.courseCode),
						CourseID:    strPtrIfNonEmpty(e.courseID),
						Type:        entryType,
						ClassNodeID: e.classNodeID,
						TeacherID:   strPtrIfNonEmpty(e.teacherID),
						DayOfWeek:   day,
						Periods:     domain.JSONSlice{periodName},
						StartWeek:   e.startWeek,
						EndWeek:     e.endWeek,
						WeekPattern: e.weekPattern,
						VenueID:     &venue.id,
						ScenarioID:  strPtrIfNonEmpty(e.scenarioID),
					}
					conflicts, err := h.checkScheduleConflicts(ctx, tenantID, schedReq, "")
					if err != nil {
						continue
					}
					if len(conflicts) > 0 {
						continue
					}

					// 创建排课
					weekPattern := e.weekPattern
					if weekPattern == "" {
						weekPattern = "all"
					}
					_, err = h.DB.Exec(ctx, `
						INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
							class_node_id, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
							venue_id, scenario_id, source, status, version)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'auto', 'draft', 1)
					`, uuid.NewString(), tenantID, req.TermID, e.id, e.courseName, strPtrIfNonEmpty(e.courseCode),
						strPtrIfNonEmpty(e.courseID), entryType, e.classNodeID, strPtrIfNonEmpty(e.teacherID), day,
						domain.JSONSlice{periodName}, e.startWeek, e.endWeek, weekPattern, venue.id, strPtrIfNonEmpty(e.scenarioID))
					if err != nil {
						continue
					}
					// 标记教学计划条目为已排
					_, _ = h.DB.Exec(ctx, `UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = $1`, e.id)
					success++
					placed = true
					break dayLoop
				}
			}
		}

		if !placed {
			failed++
			failures = append(failures, fmt.Sprintf("%s：未找到可用时段", e.courseName))
		}
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

// ExportSchedules GET /affairs/schedules/export?termId= — 导出排课为 Excel，格式与导入模板一致。
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

	rows, err := h.DB.Query(r.Context(), `
		SELECT se.course_name, COALESCE(o.name, '') AS class_name, se.day_of_week, se.periods,
			se.start_week, se.end_week, se.week_pattern,
			COALESCE(u.name, '') AS teacher_name, COALESCE(v.name, '') AS venue_name,
			COALESCE(se.course_code, '') AS course_code, se.type, COALESCE(sc.name, '') AS scene_name
		FROM schedule_entries se
		LEFT JOIN organizations o ON o.id = se.class_node_id
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		LEFT JOIN scenarios sc ON sc.id = se.scenario_id
		WHERE se.tenant_id = $1 AND se.term_id = $2
		ORDER BY se.day_of_week, se.start_week, se.course_name
	`, tenantID, termID)
	if err != nil {
		slog.Error("查询排课导出数据失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询排课导出数据失败")
		return
	}
	defer rows.Close()

	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	headers := []string{"学期 *", "课程名称 *", "班级 *", "星期 *", "节次 *", "起始周 *", "结束周 *", "周次模式", "教师", "场地", "课程编码", "类型", "场景名称"}
	widths := []float64{16, 24, 20, 8, 16, 10, 10, 10, 14, 16, 14, 10, 20}
	s1, _ := f.NewSheet(scheduleImportSheet)
	f.SetActiveSheet(s1)

	note := strings.Join([]string{"学期：" + term.Name, "可直接修改后重新导入", "", "导入说明：", "* 必填列。", "星期：1-7 或 周一~周日。", "节次：多个用逗号分隔。", "周次模式：全部/单周/双周，默认全部。", "教师：姓名或登录账号。场地：需已在场地管理中创建。", "类型：普通/场景，类型为场景时场景名称必填。"}, "\n")
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	f.MergeCell(scheduleImportSheet, start, end)
	f.SetCellValue(scheduleImportSheet, start, note)
	f.SetCellStyle(scheduleImportSheet, start, end, noteStyle)
	f.SetCellStyle(scheduleImportSheet, start, end, wrapAlign)
	f.SetRowHeight(scheduleImportSheet, 1, 32)

	for ci, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(scheduleImportSheet, cell, hdr)
		f.SetCellStyle(scheduleImportSheet, cell, cell, hdrStyle)
		f.SetColWidth(scheduleImportSheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(scheduleImportSheet, 2, 28)

	dayMap := map[int]string{1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}
	weekPatMap := map[string]string{"all": "全部", "odd": "单周", "even": "双周"}

	rowIdx := 3
	for rows.Next() {
		var courseName, className, weekPattern, teacherName, venueName, courseCode, entryType, sceneName string
		var dayOfWeek, startWeek, endWeek int
		var periods domain.JSONSlice
		if err := rows.Scan(&courseName, &className, &dayOfWeek, &periods, &startWeek, &endWeek, &weekPattern, &teacherName, &venueName, &courseCode, &entryType, &sceneName); err != nil {
			continue
		}
		periodStrs := jsonSliceToStrings(periods)
		vals := []interface{}{
			term.Name, courseName, className,
			dayMap[dayOfWeek], strings.Join(periodStrs, "，"),
			startWeek, endWeek,
			weekPatMap[weekPattern], teacherName, venueName,
			courseCode, entryType, sceneName,
		}
		for ci, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(ci+1, rowIdx)
			f.SetCellValue(scheduleImportSheet, cell, v)
		}
		rowIdx++
	}
	writeExcel(w, f, "排课导出_"+term.Name+".xlsx")
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
		qb.addCondition("(se.class_node_id = " + qb.nextArg(classNodeID) + " OR " + qb.nextArg(classNodeID) + " = ANY(se.class_node_ids))")
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

	reqClasses := req.ClassNodeIDs
	if len(reqClasses) == 0 && req.ClassNodeID != "" {
		reqClasses = []string{req.ClassNodeID}
	}

	rows, err := h.DB.Query(ctx, `
		SELECT se.id, se.course_name, COALESCE(o.name, ''), COALESCE(u.name, ''), COALESCE(v.name, ''),
			se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern,
			se.teacher_id, se.class_node_id, se.venue_id, se.plan_entry_id, se.class_node_ids
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
		var rowTeacherID, rowClassNodeID, rowVenueID, rowPlanEntryID *string
		var rowClassNodeIDs []string
		if err := rows.Scan(&c.EntryID, &c.CourseName, &c.ClassName, &c.TeacherName, &c.VenueName,
			&c.DayOfWeek, &c.Periods, &c.StartWeek, &c.EndWeek, &c.WeekPattern,
			&rowTeacherID, &rowClassNodeID, &rowVenueID, &rowPlanEntryID, &rowClassNodeIDs); err != nil {
			return nil, err
		}

		// 同一门课（同一教学计划条目）多个班级同时上课不判冲突
		if rowPlanEntryID != nil && req.PlanEntryID != nil && *rowPlanEntryID == *req.PlanEntryID {
			continue
		}

		if req.TeacherID != nil && *req.TeacherID != "" && rowTeacherID != nil && *rowTeacherID == *req.TeacherID {
			dup := c
			dup.Kind = "teacher"
			conflicts = append(conflicts, dup)
		}
		// 班级冲突：任一班重叠即冲突
		existingClasses := rowClassNodeIDs
		if len(existingClasses) == 0 && rowClassNodeID != nil {
			existingClasses = []string{*rowClassNodeID}
		}
		classOverlap := false
		for _, ec := range existingClasses {
			for _, rc := range reqClasses {
				if ec == rc { classOverlap = true; break }
			}
			if classOverlap { break }
		}
		if classOverlap {
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
		&e.ScenarioID, &e.ScenarioName, &e.Source, &e.Status, &e.Version, &e.CreatedAt, &e.UpdatedAt,
		&e.ClassNodeIDs, &e.ClassNames)
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
