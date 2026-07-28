package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type StudentPortraitHandler struct {
	DB *pgxpool.Pool
}

type StudentPortraitListResponse struct {
	Items []domain.StudentAbilityPortrait `json:"items"`
	Total int                             `json:"total"`
}

type GeneratePortraitRequest struct {
	UserID           string `json:"userId"`
	CareerPositionID string `json:"careerPositionId"`
}

type StudentArchiveListResponse struct {
	Items []domain.StudentAbilityArchive `json:"items"`
	Total int                            `json:"total"`
}

type CreateStudentArchiveRequest struct {
	UserID       string  `json:"userId"`
	MaterialType string  `json:"materialType"`
	MaterialName string  `json:"materialName"`
	IssuingOrg   *string `json:"issuingOrg"`
	ObtainDate   *string `json:"obtainDate"`
	Direction    *string `json:"direction"`
}

func (h *StudentPortraitHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	query := `
		SELECT id, user_id, career_position_id, overall_grade, domain_scores,
			class_rank, class_total, major_rank, major_total, recommend_positions, updated_at,
			completed_courses, completed_scenes, total_credits, archive_count, course_records,
			graduation_qualified, attendance_rate, diploma_badge, dual_badge
		FROM student_ability_portraits
		ORDER BY updated_at DESC
		LIMIT $1 OFFSET $2`

	countQuery := "SELECT COUNT(*) FROM student_ability_portraits"
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery).Scan(&total)

	rows, err := h.DB.Query(r.Context(), query, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询学生画像失败")
		return
	}
	defer rows.Close()

	items, err := h.scanPortraitRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取学生画像失败")
		return
	}

	respondJSON(w, http.StatusOK, StudentPortraitListResponse{Items: items, Total: total})
}

func (h *StudentPortraitHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	portrait, err := h.fetchPortrait(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "学生画像不存在")
		return
	}
	respondJSON(w, http.StatusOK, portrait)
}

func (h *StudentPortraitHandler) Generate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req GeneratePortraitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少职业岗位ID")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO student_ability_portraits (id, tenant_id, user_id, career_position_id, overall_grade,
			domain_scores, class_rank, class_total, major_rank, major_total, recommend_positions, updated_at,
			completed_courses, completed_scenes, total_credits, archive_count, course_records,
			graduation_qualified, attendance_rate, diploma_badge, dual_badge)
		VALUES ($1, $2, $3, $4, 'D', '[]', NULL, NULL, NULL, NULL, '[]', NOW(), 0, 0, 0, 0, '[]', false, 0, '', '')
	`, id, tenantID, req.UserID, req.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成portrait失败")
		return
	}

	portrait, _ := h.fetchPortrait(r.Context(), id)
	respondJSON(w, http.StatusCreated, portrait)
}

func (h *StudentPortraitHandler) ListArchives(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	userID := r.URL.Query().Get("userId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}
	if userID != "" {
		where = append(where, "user_id = $"+itoa(argIdx))
		args = append(args, userID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM student_ability_archives WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, user_id, material_type, material_name, issuing_org, obtain_date,
			level, audit_status, audit_remark, converted_credit, direction, is_enabled, created_at
		FROM student_ability_archives
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询学生档案失败")
		return
	}
	defer rows.Close()

	items := make([]domain.StudentAbilityArchive, 0)
	for rows.Next() {
		var a domain.StudentAbilityArchive
		var issuingOrg, obtainDate, level, remark *string
		if err := rows.Scan(&a.ID, &a.UserID, &a.MaterialType, &a.MaterialName, &issuingOrg, &obtainDate,
			&level, &a.AuditStatus, &remark, &a.ConvertedCredit, &a.Direction, &a.IsEnabled, &a.CreatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "读取学生档案失败")
			return
		}
		a.IssuingOrg = issuingOrg
		a.ObtainDate = obtainDate
		a.Level = level
		a.AuditRemark = remark
		items = append(items, a)
	}
	respondJSON(w, http.StatusOK, StudentArchiveListResponse{Items: items, Total: total})
}

func (h *StudentPortraitHandler) CreateArchive(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateStudentArchiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.UserID == "" || req.MaterialName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	direction := req.Direction
	if direction == nil || *direction == "" {
		d := "positive"
		direction = &d
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO student_ability_archives (id, tenant_id, user_id, material_type, material_name, issuing_org, obtain_date,
			audit_status, converted_credit, direction, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, $8, true)
	`, id, tenantID, req.UserID, req.MaterialType, req.MaterialName, req.IssuingOrg, req.ObtainDate, *direction)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建学生档案失败")
		return
	}

	archive, _ := h.fetchArchive(r.Context(), id)
	respondJSON(w, http.StatusCreated, archive)
}

func (h *StudentPortraitHandler) fetchPortrait(ctx context.Context, id string) (domain.StudentAbilityPortrait, error) {
	var p domain.StudentAbilityPortrait
	var overallGrade *string
	var classRank, classTotal, majorRank, majorTotal *int
	var attendanceRate *float64
	var diplomaBadge, dualBadge *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, user_id, career_position_id, overall_grade, domain_scores,
			class_rank, class_total, major_rank, major_total, recommend_positions, updated_at,
			completed_courses, completed_scenes, total_credits, archive_count, course_records,
			graduation_qualified, attendance_rate, diploma_badge, dual_badge
		FROM student_ability_portraits WHERE id = $1
	`, id).Scan(
		&p.ID, &p.UserID, &p.CareerPositionID, &overallGrade, &p.DomainScores,
		&classRank, &classTotal, &majorRank, &majorTotal, &p.RecommendPositions, &p.UpdatedAt,
		&p.CompletedCourses, &p.CompletedScenes, &p.TotalCredits, &p.ArchiveCount, &p.CourseRecords,
		&p.GraduationQualified, &attendanceRate, &diplomaBadge, &dualBadge,
	)
	if err != nil {
		return p, err
	}
	p.OverallGrade = overallGrade
	p.ClassRank = classRank
	p.ClassTotal = classTotal
	p.MajorRank = majorRank
	p.MajorTotal = majorTotal
	p.AttendanceRate = attendanceRate
	p.DiplomaBadge = diplomaBadge
	p.DualBadge = dualBadge
	return p, nil
}

func (h *StudentPortraitHandler) scanPortraitRows(rows pgx.Rows) ([]domain.StudentAbilityPortrait, error) {
	items := make([]domain.StudentAbilityPortrait, 0)
	for rows.Next() {
		var p domain.StudentAbilityPortrait
		var overallGrade *string
		var classRank, classTotal, majorRank, majorTotal *int
		var attendanceRate *float64
		var diplomaBadge, dualBadge *string
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.CareerPositionID, &overallGrade, &p.DomainScores,
			&classRank, &classTotal, &majorRank, &majorTotal, &p.RecommendPositions, &p.UpdatedAt,
			&p.CompletedCourses, &p.CompletedScenes, &p.TotalCredits, &p.ArchiveCount, &p.CourseRecords,
			&p.GraduationQualified, &attendanceRate, &diplomaBadge, &dualBadge,
		); err != nil {
			return nil, err
		}
		p.OverallGrade = overallGrade
		p.ClassRank = classRank
		p.ClassTotal = classTotal
		p.MajorRank = majorRank
		p.MajorTotal = majorTotal
		p.AttendanceRate = attendanceRate
		p.DiplomaBadge = diplomaBadge
		p.DualBadge = dualBadge
		items = append(items, p)
	}
	return items, nil
}

func (h *StudentPortraitHandler) fetchArchive(ctx context.Context, id string) (domain.StudentAbilityArchive, error) {
	var a domain.StudentAbilityArchive
	var issuingOrg, obtainDate, level, remark *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, user_id, material_type, material_name, issuing_org, obtain_date,
			level, audit_status, audit_remark, converted_credit, direction, is_enabled, created_at
		FROM student_ability_archives WHERE id = $1
	`, id).Scan(
		&a.ID, &a.UserID, &a.MaterialType, &a.MaterialName, &issuingOrg, &obtainDate,
		&level, &a.AuditStatus, &remark, &a.ConvertedCredit, &a.Direction, &a.IsEnabled, &a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	a.IssuingOrg = issuingOrg
	a.ObtainDate = obtainDate
	a.Level = level
	a.AuditRemark = remark
	return a, nil
}
