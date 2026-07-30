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

type TeachingPlanHandler struct {
	DB *pgxpool.Pool
}

type TeachingPlanListResponse struct {
	Items []domain.TeachingPlan `json:"items"`
	Total int                   `json:"total"`
}

type GenerateTeachingPlanRequest struct {
	ProgramID string `json:"programId"`
	TermID    string `json:"termId"`
}

type UpdateTeachingPlanEntryRequest struct {
	WeekHours   *int    `json:"weekHours"`
	StartWeek   *int    `json:"startWeek"`
	EndWeek     *int    `json:"endWeek"`
	WeekPattern *string `json:"weekPattern"`
	ClassNodeID *string `json:"classNodeId"`
	TeacherID   *string `json:"teacherId"`
	TeacherType *string `json:"teacherType"`
	VenueType   *string `json:"venueType"`
	Status      *string `json:"status"`
}

type TeachingPlanDetailResponse struct {
	domain.TeachingPlan
	Entries []domain.TeachingPlanEntry `json:"entries"`
}

func (h *TeachingPlanHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.TeachingPlan]{
		Table:         "teaching_plans p LEFT JOIN training_programs tp ON tp.id = p.program_id LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN majors m ON m.id = p.major_id",
		SelectColumns: "p.id, p.program_id, COALESCE(tp.name, '') AS program_name, p.term_id, COALESCE(t.name, '') AS term_name, p.major_id, COALESCE(m.name, '') AS major_name, p.entry_year, p.status, (SELECT COUNT(*) FROM teaching_plan_entries e WHERE e.plan_id = p.id) AS entry_count, p.generated_at, p.confirmed_at",
		TenantScoped:  true,
		TenantColumn:  "p.tenant_id",
		OrderBy:       "p.generated_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if termID := r.URL.Query().Get("termId"); termID != "" {
				qb.addCondition("p.term_id = " + qb.nextArg(termID))
			}
			if programID := r.URL.Query().Get("programId"); programID != "" {
				qb.addCondition("p.program_id = " + qb.nextArg(programID))
			}
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("p.status = " + qb.nextArg(status))
			}
			if majorID := r.URL.Query().Get("majorId"); majorID != "" {
				qb.addCondition("p.major_id = " + qb.nextArg(majorID))
			}
		},
		ScanRows: scanTeachingPlanRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询教学计划列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询教学计划列表失败")
		return
	}

	respondJSON(w, http.StatusOK, TeachingPlanListResponse{Items: items, Total: total})
}

// Generate POST /affairs/teaching-plans — 从人培方案生成教学计划。
// 合并方案课程：场景性质课程生成 type=scene 条目并带 scenario_id，实践性质课程生成
// type=practice 条目，普通课程按学时构成生成 theory/practice 条目。
// 同一方案同一学期已存在教学计划时返回 409。
func (h *TeachingPlanHandler) Generate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req GenerateTeachingPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	program, err := h.fetchProgramBrief(ctx, req.ProgramID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	weeksCount, err := h.fetchTermWeeks(ctx, req.TermID, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	courses, err := h.fetchProgramCoursesForPlan(ctx, req.ProgramID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询方案课程失败")
		return
	}
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "该人培方案尚未配置课程")
		return
	}

	planID := uuid.NewString()
	err = withTx(ctx, h.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO teaching_plans (id, tenant_id, program_id, term_id, major_id, entry_year, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'draft')
		`, planID, tenantID, req.ProgramID, req.TermID, program.MajorID, program.EntryYear); err != nil {
			return err
		}

		for _, c := range courses {
			entryType := planEntryType(c)
			weekHours := 0
			if c.Hours > 0 && weeksCount > 0 {
				weekHours = (c.Hours + weeksCount - 1) / weeksCount
			}
			scenarioID := (*string)(nil)
			if entryType == "scene" {
				scenarioID = c.ScenarioID
			}
			courseID := (*string)(nil)
			if c.CourseID != nil && *c.CourseID != "" {
				courseID = c.CourseID
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO teaching_plan_entries (id, plan_id, course_name, course_code, type, nature, credits, total_hours, week_hours, start_week, end_week, week_pattern, scenario_id, course_id, status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, 'all', $11, $12, 'planned')
			`, uuid.NewString(), planID, c.Name, emptyStrToNil(c.Code), entryType, emptyStrToNil(c.Nature),
				c.Credits, c.Hours, weekHours, weeksCount, scenarioID, courseID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "该方案在此学期已生成教学计划")
			return
		}
		slog.Error("生成教学计划失败", "error", err)
		respondError(w, http.StatusInternalServerError, "生成教学计划失败")
		return
	}

	plan, _ := h.fetchPlan(ctx, planID, tenantID)
	entries, _ := h.fetchPlanEntries(ctx, planID, tenantID)
	respondJSON(w, http.StatusCreated, TeachingPlanDetailResponse{TeachingPlan: plan, Entries: entries})
}

// Get GET /affairs/teaching-plans/{id} — 计划详情（含 entries）。
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
	plan, err := h.fetchPlan(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}
	entries, err := h.fetchPlanEntries(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询计划条目失败")
		return
	}
	respondJSON(w, http.StatusOK, TeachingPlanDetailResponse{TeachingPlan: plan, Entries: entries})
}

// UpdateEntry PUT /affairs/teaching-plans/entries/{id} — 行内编辑/指定教师。
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
	entry, err := h.fetchPlanEntry(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "计划条目不存在")
		return
	}

	var req UpdateTeachingPlanEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	_, err = h.DB.Exec(r.Context(), `
		UPDATE teaching_plan_entries e
		SET week_hours = $1, start_week = $2, end_week = $3, week_pattern = $4,
			class_node_id = $5, teacher_id = $6, teacher_type = $7, venue_type = $8, status = $9
		FROM teaching_plans p
		WHERE e.id = $10 AND p.id = e.plan_id AND p.tenant_id = $11
	`, entry.WeekHours, entry.StartWeek, entry.EndWeek, entry.WeekPattern,
		entry.ClassNodeID, entry.TeacherID, entry.TeacherType, entry.VenueType, entry.Status, id, tenantID)
	if err != nil {
		slog.Error("更新计划条目失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新计划条目失败")
		return
	}

	entry, _ = h.fetchPlanEntry(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, entry)
}

// DeleteEntry DELETE /affairs/teaching-plans/entries/{id}。
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
	if _, err := h.fetchPlanEntry(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "计划条目不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		DELETE FROM teaching_plan_entries e USING teaching_plans p
		WHERE e.id = $1 AND p.id = e.plan_id AND p.tenant_id = $2
	`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "该条目已被排课引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// Confirm POST /affairs/teaching-plans/{id}/confirm — 确认教学计划。
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
	if _, err := h.fetchPlan(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE teaching_plans SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "确认教学计划失败")
		return
	}

	plan, _ := h.fetchPlan(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, plan)
}

type programBrief struct {
	MajorID   *string
	EntryYear int
}

func (h *TeachingPlanHandler) fetchProgramBrief(ctx context.Context, id, tenantID string) (programBrief, error) {
	var p programBrief
	err := h.DB.QueryRow(ctx, `
		SELECT major_id, entry_year FROM training_programs WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&p.MajorID, &p.EntryYear)
	return p, err
}

func (h *TeachingPlanHandler) fetchTermWeeks(ctx context.Context, id, tenantID string) (int, error) {
	var weeks int
	err := h.DB.QueryRow(ctx, `SELECT weeks_count FROM terms WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(&weeks)
	return weeks, err
}

type planCourseRow struct {
	Name          string
	Code          *string
	Credits       float64
	Hours         int
	TheoryHours   int
	PracticeHours int
	Nature        *string
	ScenarioID    *string
	CourseID      *string
}

func (h *TeachingPlanHandler) fetchProgramCoursesForPlan(ctx context.Context, programID string) ([]planCourseRow, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT name, code, credits, hours, theory_hours, practice_hours, nature, scenario_id, course_id
		FROM training_program_courses WHERE program_id = $1 ORDER BY semester, sort_order, id
	`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]planCourseRow, 0)
	for rows.Next() {
		var c planCourseRow
		if err := rows.Scan(&c.Name, &c.Code, &c.Credits, &c.Hours, &c.TheoryHours, &c.PracticeHours, &c.Nature, &c.ScenarioID, &c.CourseID); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, nil
}

// planEntryType 判定计划条目类型：
// 场景性质 → scene（带 scenario_id）；实践性质 → practice；
// 普通课程纯实践学时（practice_hours>0 且无理论学时）→ practice，其余 → theory。
func planEntryType(c planCourseRow) string {
	nature := ""
	if c.Nature != nil {
		nature = *c.Nature
	}
	switch nature {
	case "场景":
		return "scene"
	case "实践":
		return "practice"
	}
	if c.PracticeHours > 0 && c.TheoryHours == 0 {
		return "practice"
	}
	return "theory"
}

const teachingPlanSelect = `
	SELECT p.id, p.program_id, COALESCE(tp.name, ''), p.term_id, COALESCE(t.name, ''),
		p.major_id, COALESCE(m.name, ''), p.entry_year, p.status,
		(SELECT COUNT(*) FROM teaching_plan_entries e WHERE e.plan_id = p.id),
		p.generated_at, p.confirmed_at
	FROM teaching_plans p
	LEFT JOIN training_programs tp ON tp.id = p.program_id
	LEFT JOIN terms t ON t.id = p.term_id
	LEFT JOIN majors m ON m.id = p.major_id
`

func (h *TeachingPlanHandler) fetchPlan(ctx context.Context, id, tenantID string) (domain.TeachingPlan, error) {
	var p domain.TeachingPlan
	err := h.DB.QueryRow(ctx, teachingPlanSelect+` WHERE p.id = $1 AND p.tenant_id = $2`, id, tenantID).
		Scan(&p.ID, &p.ProgramID, &p.ProgramName, &p.TermID, &p.TermName, &p.MajorID, &p.MajorName,
			&p.EntryYear, &p.Status, &p.EntryCount, &p.GeneratedAt, &p.ConfirmedAt)
	return p, err
}

func (h *TeachingPlanHandler) fetchPlanEntry(ctx context.Context, id, tenantID string) (domain.TeachingPlanEntry, error) {
	var e domain.TeachingPlanEntry
	err := h.DB.QueryRow(ctx, `
		SELECT e.id, e.plan_id, e.course_name, e.course_code, e.type, e.nature, e.credits, e.total_hours,
			e.week_hours, e.start_week, e.end_week, e.week_pattern,
			e.class_node_id, COALESCE(o.name, ''), e.teacher_id, COALESCE(u.name, ''), e.teacher_type, e.venue_type,
			e.scenario_id, COALESCE(s.name, ''), e.course_id, COALESCE(c.name, ''), e.status
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		LEFT JOIN organizations o ON o.id = e.class_node_id
		LEFT JOIN users u ON u.id = e.teacher_id
		LEFT JOIN scenarios s ON s.id = e.scenario_id
		LEFT JOIN courses c ON c.id = e.course_id
		WHERE e.id = $1 AND p.tenant_id = $2
	`, id, tenantID).Scan(&e.ID, &e.PlanID, &e.CourseName, &e.CourseCode, &e.Type, &e.Nature, &e.Credits, &e.TotalHours,
		&e.WeekHours, &e.StartWeek, &e.EndWeek, &e.WeekPattern,
		&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.TeacherType, &e.VenueType,
		&e.ScenarioID, &e.ScenarioName, &e.CourseID, &e.LinkedCourseName, &e.Status)
	return e, err
}

func (h *TeachingPlanHandler) fetchPlanEntries(ctx context.Context, planID, tenantID string) ([]domain.TeachingPlanEntry, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT e.id, e.plan_id, e.course_name, e.course_code, e.type, e.nature, e.credits, e.total_hours,
			e.week_hours, e.start_week, e.end_week, e.week_pattern,
			e.class_node_id, COALESCE(o.name, ''), e.teacher_id, COALESCE(u.name, ''), e.teacher_type, e.venue_type,
			e.scenario_id, COALESCE(s.name, ''), e.course_id, COALESCE(c.name, ''), e.status
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		LEFT JOIN organizations o ON o.id = e.class_node_id
		LEFT JOIN users u ON u.id = e.teacher_id
		LEFT JOIN scenarios s ON s.id = e.scenario_id
		LEFT JOIN courses c ON c.id = e.course_id
		WHERE e.plan_id = $1 AND p.tenant_id = $2
		ORDER BY e.start_week, e.course_name, e.id
	`, planID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.TeachingPlanEntry, 0)
	for rows.Next() {
		var e domain.TeachingPlanEntry
		if err := rows.Scan(&e.ID, &e.PlanID, &e.CourseName, &e.CourseCode, &e.Type, &e.Nature, &e.Credits, &e.TotalHours,
			&e.WeekHours, &e.StartWeek, &e.EndWeek, &e.WeekPattern,
			&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.TeacherType, &e.VenueType,
			&e.ScenarioID, &e.ScenarioName, &e.CourseID, &e.LinkedCourseName, &e.Status); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, nil
}

func scanTeachingPlanRows(rows pgx.Rows) ([]domain.TeachingPlan, error) {
	items := make([]domain.TeachingPlan, 0)
	for rows.Next() {
		var p domain.TeachingPlan
		if err := rows.Scan(&p.ID, &p.ProgramID, &p.ProgramName, &p.TermID, &p.TermName, &p.MajorID, &p.MajorName,
			&p.EntryYear, &p.Status, &p.EntryCount, &p.GeneratedAt, &p.ConfirmedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}
