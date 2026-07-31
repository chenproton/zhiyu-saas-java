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

type TrainingProgramHandler struct {
	DB *pgxpool.Pool
}

type TrainingProgramListResponse struct {
	Items []domain.TrainingProgram `json:"items"`
	Total int                      `json:"total"`
}

type TrainingProgramRequest struct {
	Name         string   `json:"name"`
	Code         *string  `json:"code"`
	MajorID      *string  `json:"majorId"`
	EntryYear    int      `json:"entryYear"`
	Level        *string  `json:"level"`
	Duration     *int     `json:"duration"`
	TotalCredits *float64 `json:"totalCredits"`
	Description  *string  `json:"description"`
}

type TrainingProgramCourseRequest struct {
	Name       string  `json:"name"`
	Code       *string `json:"code"`
	Credits    float64 `json:"credits"`
	Hours      int     `json:"hours"`
	Semester   int     `json:"semester"`
	Nature     string  `json:"nature"`
	Assessment *string `json:"assessment"`
	PositionID *string `json:"positionId"`
	CourseID   *string `json:"courseId"`
	SortOrder  int     `json:"sortOrder"`
}

type PutProgramCoursesRequest struct {
	Courses []TrainingProgramCourseRequest `json:"courses"`
}

func (h *TrainingProgramHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.TrainingProgram]{
		Table:         "training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id",
		SelectColumns: "tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, '') AS major_name, tp.entry_year, tp.level, tp.duration, tp.total_credits, tp.status, tp.description, (SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id) AS course_count, tp.created_by, COALESCE(cu.name, '') AS created_by_name, tp.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, tp.batch_id, COALESCE(lb.name, '') AS batch_name, tp.created_at, tp.updated_at",
		TenantScoped:  true,
		TenantColumn:  "tp.tenant_id",
		SearchColumns: []string{"tp.name"},
		OrderBy:       "tp.created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("tp.status = " + qb.nextArg(status))
			}
			if majorID := r.URL.Query().Get("majorId"); majorID != "" {
				qb.addCondition("tp.major_id = " + qb.nextArg(majorID))
			}
			if entryYear := r.URL.Query().Get("entryYear"); entryYear != "" {
				if v, err := parseInt(entryYear, 0); err == nil && v > 0 {
					qb.addCondition("tp.entry_year = " + qb.nextArg(v))
				}
			}
		},
		ScanRows: scanTrainingProgramRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询人培方案列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询人培方案列表失败")
		return
	}

	respondJSON(w, http.StatusOK, TrainingProgramListResponse{Items: items, Total: total})
}

func (h *TrainingProgramHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	program, err := h.fetchProgram(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	respondJSON(w, http.StatusOK, program)
}

func (h *TrainingProgramHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req TrainingProgramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" || req.EntryYear <= 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO training_programs (id, tenant_id, name, code, major_id, entry_year, level, duration, total_credits, status, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11)
	`, id, tenantID, req.Name, emptyStrToNil(req.Code), emptyStrToNil(req.MajorID), req.EntryYear,
		emptyStrToNil(req.Level), req.Duration, req.TotalCredits, emptyStrToNil(req.Description), claims.UserID)
	if err != nil {
		slog.Error("创建人培方案失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建人培方案失败")
		return
	}

	program, _ := h.fetchProgram(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, program)
}

func (h *TrainingProgramHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.fetchProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}

	var req TrainingProgramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" || req.EntryYear <= 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE training_programs
		SET name = $1, code = $2, major_id = $3, entry_year = $4, level = $5, duration = $6,
			total_credits = $7, description = $8, updated_at = NOW()
		WHERE id = $9 AND tenant_id = $10
	`, req.Name, emptyStrToNil(req.Code), emptyStrToNil(req.MajorID), req.EntryYear,
		emptyStrToNil(req.Level), req.Duration, req.TotalCredits, emptyStrToNil(req.Description), id, tenantID)
	if err != nil {
		slog.Error("更新人培方案失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新人培方案失败")
		return
	}

	program, _ := h.fetchProgram(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, program)
}

func (h *TrainingProgramHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.fetchProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM training_programs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "该方案已被教学计划引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// Publish POST /affairs/programs/{id}/publish — draft/published 状态切换。
// 请求体可携带 {"status":"published"|"draft"}；缺省时切换为 published。
func (h *TrainingProgramHandler) Publish(w http.ResponseWriter, r *http.Request) {
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
	program, err := h.fetchProgram(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}

	status := "published"
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Status != "" {
		status = req.Status
	}
	if status != "draft" && status != "published" {
		respondError(w, http.StatusBadRequest, "状态仅支持 draft/published")
		return
	}
	if program.Status == status {
		respondJSON(w, http.StatusOK, program)
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE training_programs SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3
	`, status, id, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新方案状态失败")
		return
	}

	program, _ = h.fetchProgram(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, program)
}

// ListCourses GET /affairs/programs/{id}/courses — 课程设置列表。
func (h *TrainingProgramHandler) ListCourses(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.fetchProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}

	courses, err := h.fetchProgramCourses(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询课程设置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": courses, "total": len(courses)})
}

// PutCourses PUT /affairs/programs/{id}/courses — 课程设置整体保存（全量替换）。
func (h *TrainingProgramHandler) PutCourses(w http.ResponseWriter, r *http.Request) {
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
	if _, err := h.fetchProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}

	var req PutProgramCoursesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	for _, c := range req.Courses {
		if (c.PositionID == nil || *c.PositionID == "") && (c.CourseID == nil || *c.CourseID == "") {
			respondError(w, http.StatusBadRequest, "须至少关联岗位或体系课")
			return
		}
	}

	err := withTx(r.Context(), h.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(r.Context(), `DELETE FROM training_program_courses WHERE program_id = $1`, id); err != nil {
			return err
		}
		for i, c := range req.Courses {
			nature := c.Nature
			if nature == "" {
				nature = "必修"
			}
			sortOrder := c.SortOrder
			if sortOrder == 0 {
				sortOrder = i
			}
			name := c.Name
			if name == "" && c.PositionID != nil && *c.PositionID != "" {
				_ = tx.QueryRow(r.Context(), `SELECT name FROM career_positions WHERE id=$1`, *c.PositionID).Scan(&name)
			}
			if name == "" && c.CourseID != nil && *c.CourseID != "" {
				_ = tx.QueryRow(r.Context(), `SELECT name FROM courses WHERE id=$1`, *c.CourseID).Scan(&name)
			}
			if _, err := tx.Exec(r.Context(), `
				INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			`, uuid.NewString(), id, name, emptyStrToNil(c.Code), c.Credits, c.Hours,
				c.Semester, nature, emptyStrToNil(c.Assessment), emptyStrToNil(c.PositionID), emptyStrToNil(c.CourseID), sortOrder); err != nil {
				return err
			}
		}
		_, err := tx.Exec(r.Context(), `UPDATE training_programs SET updated_at = NOW() WHERE id = $1`, id)
		return err
	})
	if err != nil {
		slog.Error("保存课程设置失败", "error", err)
		respondError(w, http.StatusInternalServerError, "保存课程设置失败")
		return
	}

	courses, _ := h.fetchProgramCourses(r.Context(), id)
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": courses, "total": len(courses)})
}

func (h *TrainingProgramHandler) fetchProgram(ctx context.Context, id, tenantID string) (domain.TrainingProgram, error) {
	var p domain.TrainingProgram
	err := h.DB.QueryRow(ctx, `
		SELECT tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, ''), tp.entry_year, tp.level, tp.duration,
			tp.total_credits, tp.status, tp.description,
			(SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id),
			tp.created_by, COALESCE(cu.name, ''), tp.collaborators,
			COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}'),
			tp.batch_id, COALESCE(lb.name, ''), tp.created_at, tp.updated_at
		FROM training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id
		WHERE tp.id = $1 AND tp.tenant_id = $2
	`, id, tenantID).Scan(&p.ID, &p.Name, &p.Code, &p.MajorID, &p.MajorName, &p.EntryYear, &p.Level, &p.Duration,
		&p.TotalCredits, &p.Status, &p.Description, &p.CourseCount, &p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames, &p.BatchID, &p.BatchName, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func (h *TrainingProgramHandler) fetchProgramCourses(ctx context.Context, programID string) ([]domain.TrainingProgramCourse, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT c.id, c.program_id, c.name, COALESCE(NULLIF(c.code,''), cp.code, co.code) AS code, c.credits, c.hours,
			c.semester, c.nature, c.assessment, c.position_id, COALESCE(cp.name, ''), c.course_id, COALESCE(co.name, ''), c.sort_order
		FROM training_program_courses c
		LEFT JOIN career_positions cp ON cp.id = c.position_id
		LEFT JOIN courses co ON co.id = c.course_id
		WHERE c.program_id = $1
		ORDER BY c.semester, c.sort_order, c.id
	`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.TrainingProgramCourse, 0)
	for rows.Next() {
		var c domain.TrainingProgramCourse
		if err := rows.Scan(&c.ID, &c.ProgramID, &c.Name, &c.Code, &c.Credits, &c.Hours,
			&c.Semester, &c.Nature, &c.Assessment, &c.PositionID, &c.PositionName, &c.CourseID, &c.CourseName, &c.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, nil
}

func scanTrainingProgramRows(rows pgx.Rows) ([]domain.TrainingProgram, error) {
	items := make([]domain.TrainingProgram, 0)
	for rows.Next() {
		var p domain.TrainingProgram
		if err := rows.Scan(&p.ID, &p.Name, &p.Code, &p.MajorID, &p.MajorName, &p.EntryYear, &p.Level, &p.Duration,
			&p.TotalCredits, &p.Status, &p.Description, &p.CourseCount, &p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames, &p.BatchID, &p.BatchName, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

func (h *TrainingProgramHandler) actions() contentActions {
	return contentActions{db: h.DB, table: "training_programs", entityName: "人培方案", targetType: "training_program", inviteCol: "collaborators", fetch: nil}
}

func (h *TrainingProgramHandler) Submit(w http.ResponseWriter, r *http.Request)     { h.actions().transition(w, r, domain.StatusPending) }
func (h *TrainingProgramHandler) Withdraw(w http.ResponseWriter, r *http.Request)   { h.actions().transition(w, r, domain.StatusDraft) }
func (h *TrainingProgramHandler) Invite(w http.ResponseWriter, r *http.Request)     { h.actions().invite(w, r) }
func (h *TrainingProgramHandler) Review(w http.ResponseWriter, r *http.Request)     { h.actions().review(w, r) }
func (h *TrainingProgramHandler) Archive(w http.ResponseWriter, r *http.Request)    { h.actions().transition(w, r, domain.StatusArchived) }
func (h *TrainingProgramHandler) Unpublish(w http.ResponseWriter, r *http.Request)  { h.actions().transition(w, r, domain.StatusDraft) }
func (h *TrainingProgramHandler) SaveDraft(w http.ResponseWriter, r *http.Request)  { /* no-op: draft is default */ }

// Clone POST /affairs/programs/{id}/clone — 克隆人培方案及课程设置。
func (h *TrainingProgramHandler) Clone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil { respondError(w, http.StatusForbidden, "权限不足"); return }
	tenantID, ok := requireTenant(w, r)
	if !ok { return }
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var req struct {
		Name *string `json:"name"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	src, err := h.fetchProgram(ctx, id, tenantID)
	if err != nil { respondError(w, http.StatusNotFound, "人培方案不存在"); return }
	if src.Status == "" { src.Status = "draft" }

	newName := src.Name + " (克隆)"
	if req.Name != nil && *req.Name != "" { newName = *req.Name }

	newID := uuid.NewString()
	err = withTx(ctx, h.DB, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO training_programs (id, tenant_id, name, code, major_id, entry_year, level, duration, total_credits, status, description, created_by, collaborators)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'{}')
		`, newID, tenantID, newName, src.Code, src.MajorID, src.EntryYear, src.Level, src.Duration, src.TotalCredits, "draft", src.Description, claims.UserID); err != nil {
			return err
		}
		// 克隆课程设置
		if _, err := tx.Exec(ctx, `
			INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order)
			SELECT gen_random_uuid(), $1, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order
			FROM training_program_courses WHERE program_id = $2
		`, newID, id); err != nil {
			return err
		}
		return nil
	})
	if err != nil { respondError(w, http.StatusInternalServerError, "克隆失败"); return }

	program, _ := h.fetchProgram(ctx, newID, tenantID)
	respondJSON(w, http.StatusCreated, program)
}
