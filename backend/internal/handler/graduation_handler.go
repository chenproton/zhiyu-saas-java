package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type GraduationHandler struct {
	DB *pgxpool.Pool
}

type GraduationTopicListResponse struct {
	Items []domain.GraduationProjectTopic `json:"items"`
	Total int                             `json:"total"`
}

type CreateGraduationTopicRequest struct {
	Name               string  `json:"name"`
	CareerPositionID   string  `json:"careerPositionId"`
	College            string  `json:"college"`
	Source             string  `json:"source"`
	Capacity           int     `json:"capacity"`
	AdvisorID          *string `json:"advisorId"`
	EnterpriseMentorID *string `json:"enterpriseMentorId"`
	StartDate          string  `json:"startDate"`
	EndDate            string  `json:"endDate"`
	Description        *string `json:"description"`
}

type GraduationArchiveListResponse struct {
	Items []domain.GraduationProjectArchive `json:"items"`
	Total int                               `json:"total"`
}

type CreateGraduationArchiveRequest struct {
	TopicID string `json:"topicId"`
	UserID  string `json:"userId"`
	Phase   string `json:"phase"`
}

type GraduationEvaluationListResponse struct {
	Items []domain.GraduationProjectEvaluation `json:"items"`
	Total int                                  `json:"total"`
}

type CreateGraduationEvaluationRequest struct {
	TopicID            string   `json:"topicId"`
	UserID             string   `json:"userId"`
	AdvisorScore       *float64 `json:"advisorScore"`
	EnterpriseScore    *float64 `json:"enterpriseScore"`
	DefenseScore       *float64 `json:"defenseScore"`
	ComprehensiveGrade *string  `json:"comprehensiveGrade"`
	IsExcellent        bool     `json:"isExcellent"`
}

type GraduationQueryListResponse struct {
	Items []domain.GraduationQueryResult `json:"items"`
	Total int                            `json:"total"`
}

func (h *GraduationHandler) ListTopics(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
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
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM graduation_project_topics WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at
		FROM graduation_project_topics
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list graduation topics")
		return
	}
	defer rows.Close()

	items, err := h.scanTopicRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan graduation topics")
		return
	}

	respondJSON(w, http.StatusOK, GraduationTopicListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) GetTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	topic, err := h.fetchTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "graduation topic not found")
		return
	}
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateGraduationTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	startDate, _ := time.Parse(time.RFC3339, req.StartDate)
	endDate, _ := time.Parse(time.RFC3339, req.EndDate)

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO graduation_project_topics (id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, 0, $8, $9, $10, $11, $12)
	`, id, tenantID, req.Name, req.CareerPositionID, req.College, req.Source, req.Capacity, req.AdvisorID, req.EnterpriseMentorID, startDate, endDate, req.Description)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "毕业设计题目名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create graduation topic")
		return
	}

	topic, _ := h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusCreated, topic)
}

func (h *GraduationHandler) UpdateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTopic(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "graduation topic not found")
		return
	}

	var req CreateGraduationTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	startDate, _ := time.Parse(time.RFC3339, req.StartDate)
	endDate, _ := time.Parse(time.RFC3339, req.EndDate)

	_, err := h.DB.Exec(r.Context(), `
		UPDATE graduation_project_topics SET name = $1, career_position_id = $2, college = $3, source = $4,
			capacity = $5, advisor_id = $6, enterprise_mentor_id = $7, start_date = $8, end_date = $9, description = $10
		WHERE id = $11
	`, req.Name, req.CareerPositionID, req.College, req.Source, req.Capacity, req.AdvisorID, req.EnterpriseMentorID, startDate, endDate, req.Description, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "毕业设计题目名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update graduation topic")
		return
	}

	topic, _ := h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) DeleteTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTopic(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "graduation topic not found")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_evaluations WHERE topic_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete topic evaluations")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_archives WHERE topic_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete topic archives")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_topics WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete graduation topic")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *GraduationHandler) ApplyTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `
		UPDATE graduation_project_topics SET applied_count = applied_count + 1 WHERE id = $1
	`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to apply topic")
		return
	}

	topic, _ := h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) ArchivesCRUD(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateGraduationArchiveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.TopicID == "" || req.UserID == "" {
			respondError(w, http.StatusBadRequest, "missing required fields")
			return
		}

		tenantID, ok := requireTenant(w, r); if !ok { return }

		id := uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO graduation_project_archives (id, tenant_id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification)
			VALUES ($1, $2, $3, $4, $5, 'making', 0, NOW(), false)
		`, id, tenantID, req.TopicID, req.UserID, req.Phase)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create graduation archive")
			return
		}

		archive, _ := h.fetchArchive(r.Context(), id)
		respondJSON(w, http.StatusCreated, archive)
		return
	}

	topicID := r.URL.Query().Get("topicId")
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
	if topicID != "" {
		where = append(where, "topic_id = $"+itoa(argIdx))
		args = append(args, topicID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM graduation_project_archives WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification
		FROM graduation_project_archives
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY last_updated DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list graduation archives")
		return
	}
	defer rows.Close()

	items := make([]domain.GraduationProjectArchive, 0)
	for rows.Next() {
		var a domain.GraduationProjectArchive
		if err := rows.Scan(&a.ID, &a.TopicID, &a.UserID,
			&a.Phase, &a.DocStatus, &a.DocCount, &a.LastUpdated, &a.HasRectification); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to scan graduation archives")
			return
		}
		items = append(items, a)
	}
	respondJSON(w, http.StatusOK, GraduationArchiveListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) EvaluationsCRUD(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateGraduationEvaluationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.TopicID == "" || req.UserID == "" {
			respondError(w, http.StatusBadRequest, "missing required fields")
			return
		}

		tenantID, ok := requireTenant(w, r); if !ok { return }

		id := uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO graduation_project_evaluations (id, tenant_id, topic_id, user_id, advisor_score,
				enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
		`, id, tenantID, req.TopicID, req.UserID, req.AdvisorScore, req.EnterpriseScore, req.DefenseScore, req.ComprehensiveGrade, req.IsExcellent)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create graduation evaluation")
			return
		}

		eval, _ := h.fetchEvaluation(r.Context(), id)
		respondJSON(w, http.StatusCreated, eval)
		return
	}

	topicID := r.URL.Query().Get("topicId")
	status := r.URL.Query().Get("status")
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
	if topicID != "" {
		where = append(where, "topic_id = $"+itoa(argIdx))
		args = append(args, topicID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM graduation_project_evaluations WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, topic_id, user_id, advisor_score, enterprise_score, defense_score,
			comprehensive_grade, is_excellent, status, evaluated_at
		FROM graduation_project_evaluations
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY evaluated_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list graduation evaluations")
		return
	}
	defer rows.Close()

	items := make([]domain.GraduationProjectEvaluation, 0)
	for rows.Next() {
		var e domain.GraduationProjectEvaluation
		var advisorScore, enterpriseScore, defenseScore *float64
		var comprehensiveGrade *string
		if err := rows.Scan(&e.ID, &e.TopicID, &e.UserID, &advisorScore, &enterpriseScore, &defenseScore,
			&comprehensiveGrade, &e.IsExcellent, &e.Status, &e.EvaluatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to scan graduation evaluations")
			return
		}
		e.AdvisorScore = advisorScore
		e.EnterpriseScore = enterpriseScore
		e.DefenseScore = defenseScore
		e.ComprehensiveGrade = comprehensiveGrade
		items = append(items, e)
	}
	respondJSON(w, http.StatusOK, GraduationEvaluationListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) QueryResults(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

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

	countQuery := "SELECT COUNT(*) FROM graduation_query_results gr"
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery).Scan(&total)

	query := `
		SELECT gr.id, gr.user_id, gr.class_name, COALESCE(m.name, '') AS major_name, gr.credit_completed, gr.credit_required,
			gr.scene_passed, gr.scene_required, gr.project_grade, gr.graduation_status, gr.ability_cert_status, gr.rectification_count, gr.updated_at
		FROM graduation_query_results gr
		LEFT JOIN majors m ON m.id = gr.major_id
		ORDER BY gr.updated_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := h.DB.Query(r.Context(), query, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list graduation query results")
		return
	}
	defer rows.Close()

	items := make([]domain.GraduationQueryResult, 0)
	for rows.Next() {
		var q domain.GraduationQueryResult
		var className, majorName, projectGrade *string
		if err := rows.Scan(&q.ID, &q.UserID, &className, &majorName, &q.CreditCompleted, &q.CreditRequired,
			&q.ScenePassed, &q.SceneRequired, &projectGrade, &q.GraduationStatus, &q.AbilityCertStatus, &q.RectificationCount, &q.UpdatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to scan graduation query results")
			return
		}
		q.ClassName = className
		q.MajorName = majorName
		q.ProjectGrade = projectGrade
		items = append(items, q)
	}
	respondJSON(w, http.StatusOK, GraduationQueryListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) fetchTopic(ctx context.Context, id string) (domain.GraduationProjectTopic, error) {
	var t domain.GraduationProjectTopic
	var college, advisorID, enterpriseMentorID, description *string
	var startDate, endDate *time.Time
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at
		FROM graduation_project_topics WHERE id = $1
	`, id).Scan(
		&t.ID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
		&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
	)
	if err != nil {
		return t, err
	}
	t.College = college
	t.AdvisorID = advisorID
	t.EnterpriseMentorID = enterpriseMentorID
	if startDate != nil {
		s := startDate.Format("2006-01-02")
		t.StartDate = &s
	}
	if endDate != nil {
		s := endDate.Format("2006-01-02")
		t.EndDate = &s
	}
	t.Description = description
	return t, nil
}

func (h *GraduationHandler) scanTopicRows(rows pgx.Rows) ([]domain.GraduationProjectTopic, error) {
	items := make([]domain.GraduationProjectTopic, 0)
	for rows.Next() {
		var t domain.GraduationProjectTopic
		var college, advisorID, enterpriseMentorID, description *string
		var startDate, endDate *time.Time
		if err := rows.Scan(
			&t.ID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
			&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.College = college
		t.AdvisorID = advisorID
		t.EnterpriseMentorID = enterpriseMentorID
		if startDate != nil {
			s := startDate.Format("2006-01-02")
			t.StartDate = &s
		}
		if endDate != nil {
			s := endDate.Format("2006-01-02")
			t.EndDate = &s
		}
		t.Description = description
		items = append(items, t)
	}
	return items, nil
}

func (h *GraduationHandler) fetchArchive(ctx context.Context, id string) (domain.GraduationProjectArchive, error) {
	var a domain.GraduationProjectArchive
	err := h.DB.QueryRow(ctx, `
		SELECT id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification
		FROM graduation_project_archives WHERE id = $1
	`, id).Scan(
		&a.ID, &a.TopicID, &a.UserID,
		&a.Phase, &a.DocStatus, &a.DocCount, &a.LastUpdated, &a.HasRectification,
	)
	if err != nil {
		return a, err
	}
	return a, nil
}

func (h *GraduationHandler) fetchEvaluation(ctx context.Context, id string) (domain.GraduationProjectEvaluation, error) {
	var e domain.GraduationProjectEvaluation
	var advisorScore, enterpriseScore, defenseScore *float64
	var comprehensiveGrade *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, topic_id, user_id, advisor_score, enterprise_score, defense_score,
			comprehensive_grade, is_excellent, status, evaluated_at
		FROM graduation_project_evaluations WHERE id = $1
	`, id).Scan(
		&e.ID, &e.TopicID, &e.UserID, &advisorScore, &enterpriseScore, &defenseScore,
		&comprehensiveGrade, &e.IsExcellent, &e.Status, &e.EvaluatedAt,
	)
	if err != nil {
		return e, err
	}
	e.AdvisorScore = advisorScore
	e.EnterpriseScore = enterpriseScore
	e.DefenseScore = defenseScore
	e.ComprehensiveGrade = comprehensiveGrade
	return e, nil
}
