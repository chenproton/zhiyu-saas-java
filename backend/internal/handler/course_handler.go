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

type CourseHandler struct {
	DB *pgxpool.Pool
}

type CourseListResponse struct {
	Items []domain.Course `json:"items"`
	Total int             `json:"total"`
}

type CreateCourseRequest struct {
	Code          string           `json:"code"`
	Name          string           `json:"name"`
	Type          string           `json:"type"`
	Category      string           `json:"category"`
	MajorID       *string          `json:"majorId"`
	TeacherID     *string          `json:"teacherId"`
	IndustryID    *string          `json:"industryId"`
	Version       *string          `json:"version"`
	OnlineHours   *float64         `json:"onlineHours"`
	OfflineHours  *float64         `json:"offlineHours"`
	OnlineWeight  *float64         `json:"onlineWeight"`
	OfflineWeight *float64         `json:"offlineWeight"`
	Semester      *string          `json:"semester"`
	ClassName     *string          `json:"className"`
	CoverColor    *string          `json:"coverColor"`
	CoverImage    *string          `json:"coverImage"`
	CourseTag     *string          `json:"courseTag"`
	CoCreatorIds  domain.JSONSlice `json:"coCreatorIds"`
	BatchID       *string          `json:"batchId"`
}

type UpdateCourseRequest struct {
	Code          string           `json:"code"`
	Name          string           `json:"name"`
	Type          string           `json:"type"`
	Category      string           `json:"category"`
	MajorID       *string          `json:"majorId"`
	TeacherID     *string          `json:"teacherId"`
	IndustryID    *string          `json:"industryId"`
	Version       *string          `json:"version"`
	OnlineHours   *float64         `json:"onlineHours"`
	OfflineHours  *float64         `json:"offlineHours"`
	OnlineWeight  *float64         `json:"onlineWeight"`
	OfflineWeight *float64         `json:"offlineWeight"`
	Semester      *string          `json:"semester"`
	ClassName     *string          `json:"className"`
	CoverColor    *string          `json:"coverColor"`
	CoverImage    *string          `json:"coverImage"`
	CourseTag     *string          `json:"courseTag"`
	CoCreatorIds  domain.JSONSlice `json:"coCreatorIds"`
	BatchID       *string          `json:"batchId"`
}

func (h *CourseHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	courseType := r.URL.Query().Get("type")
	category := r.URL.Query().Get("category")
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	batchID := r.URL.Query().Get("batchId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
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
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "c.tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if courseType != "" {
		where = append(where, "c.type = $"+itoa(argIdx))
		args = append(args, courseType)
		argIdx++
	}
	if category != "" {
		where = append(where, "c.category = $"+itoa(argIdx))
		args = append(args, category)
		argIdx++
	}
	if status != "" {
		where = append(where, "c.status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "(c.name ILIKE $"+itoa(argIdx)+" OR c.code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if batchID != "" {
		where = append(where, "c.batch_id = $"+itoa(argIdx))
		args = append(args, batchID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM courses c WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, c.resource_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'course' AND target_id = c.id) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY c.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list courses")
		return
	}
	defer rows.Close()

	items, err := h.scanCourseRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan courses")
		return
	}

	respondJSON(w, http.StatusOK, CourseListResponse{Items: items, Total: total})
}

func (h *CourseHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	course, err := h.fetchCourse(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "course not found")
		return
	}
	respondJSON(w, http.StatusOK, course)
}

func (h *CourseHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateCourseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Code == "" || req.Name == "" || req.Type == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if req.Version == nil || *req.Version == "" {
		v := "v1.0"
		req.Version = &v
	}

	id := uuid.NewString()
	if req.CoCreatorIds == nil {
		req.CoCreatorIds = domain.JSONSlice{}
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, creator_id, co_creator_ids, batch_id,
			node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18, $19, $20, $21, $22, 0, 0, 0)
	`, id, tenantID, req.Code, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, claims.UserID, req.CoCreatorIds, req.BatchID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create course")
		return
	}

	course, _ := h.fetchCourse(r.Context(), id)
	respondJSON(w, http.StatusCreated, course)
}

func (h *CourseHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchCourse(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "course not found")
		return
	}

	var req UpdateCourseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		req.Code = existing.Code
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Type == "" {
		req.Type = existing.Type
	}
	if req.Category == "" {
		req.Category = existing.Category
	}

	if req.CoCreatorIds == nil {
		req.CoCreatorIds = domain.JSONSlice{}
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE courses SET code = $1, name = $2, type = $3, category = $4, major_id = $5, teacher_id = $6,
			industry_id = $7, version = $8, online_hours = $9, offline_hours = $10, online_weight = $11,
			offline_weight = $12, semester = $13, class_name = $14, cover_color = $15, cover_image = $16,
			course_tag = $17, co_creator_ids = $18, batch_id = $19, updated_at = NOW()
		WHERE id = $20
	`, req.Code, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, req.CoCreatorIds, req.BatchID, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update course")
		return
	}

	course, _ := h.fetchCourse(r.Context(), id)
	respondJSON(w, http.StatusOK, course)
}

func (h *CourseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCourse(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "course not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM courses WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete course")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "courses",
		entityName: "course",
		inviteCol:  "co_creator_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchCourse(ctx, id)
		},
	}
}

func (h *CourseHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *CourseHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *CourseHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *CourseHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *CourseHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *CourseHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *CourseHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *CourseHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *CourseHandler) fetchCourse(ctx context.Context, id string) (*domain.Course, error) {
	var c domain.Course
	err := h.DB.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, c.resource_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'course' AND target_id = c.id) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
		&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
		&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
		&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (h *CourseHandler) scanCourseRows(rows pgx.Rows) ([]domain.Course, error) {
	items := make([]domain.Course, 0)
	for rows.Next() {
		var c domain.Course
		if err := rows.Scan(
			&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
			&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
			&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
			&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, nil
}
