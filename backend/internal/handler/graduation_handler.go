package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.GraduationProjectTopic]{
		Table:         "graduation_project_topics",
		SelectColumns: "id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count, advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.scanTopicRows)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
		} else {
			respondError(w, http.StatusInternalServerError, "查询毕业设计课题失败")
		}
		return
	}

	respondJSON(w, http.StatusOK, GraduationTopicListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) GetTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	topic, err := h.fetchTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "毕业设计课题不存在")
		return
	}
	if topic.TenantID != nil && !verifyTenantOwnership(w, r, *topic.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateGraduationTopicRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

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
		respondError(w, http.StatusInternalServerError, "创建毕业设计课题失败")
		return
	}

	topic, _ := h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusCreated, topic)
}

func (h *GraduationHandler) UpdateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	topic, err := h.fetchTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "毕业设计课题不存在")
		return
	}
	if topic.TenantID != nil && !verifyTenantOwnership(w, r, *topic.TenantID) {
		return
	}

	var req CreateGraduationTopicRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	startDate, _ := time.Parse(time.RFC3339, req.StartDate)
	endDate, _ := time.Parse(time.RFC3339, req.EndDate)

	_, err = h.DB.Exec(r.Context(), `
		UPDATE graduation_project_topics SET name = $1, career_position_id = $2, college = $3, source = $4,
			capacity = $5, advisor_id = $6, enterprise_mentor_id = $7, start_date = $8, end_date = $9, description = $10
		WHERE id = $11
	`, req.Name, req.CareerPositionID, req.College, req.Source, req.Capacity, req.AdvisorID, req.EnterpriseMentorID, startDate, endDate, req.Description, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "毕业设计题目名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新毕业设计课题失败")
		return
	}

	topic, _ = h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) DeleteTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	topic, err := h.fetchTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "毕业设计课题不存在")
		return
	}
	if topic.TenantID != nil && !verifyTenantOwnership(w, r, *topic.TenantID) {
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_evaluations WHERE topic_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除课题评价失败")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_archives WHERE topic_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除课题档案失败")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM graduation_project_topics WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除毕业设计课题失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *GraduationHandler) ApplyTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	topic, err := h.fetchTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "毕业设计课题不存在")
		return
	}
	if topic.TenantID != nil && !verifyTenantOwnership(w, r, *topic.TenantID) {
		return
	}
	if topic.AppliedCount >= topic.Capacity {
		respondError(w, http.StatusBadRequest, "课题已满员")
		return
	}

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE graduation_project_topics SET applied_count = applied_count + 1 
		WHERE id = $1 AND applied_count < capacity
	`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "申请课题失败")
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(w, http.StatusBadRequest, "课题不存在或已满员")
		return
	}

	topic, _ = h.fetchTopic(r.Context(), id)
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) ArchivesCRUD(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateGraduationArchiveRequest
		if !decodeBody(w, r, &req) {
			return
		}
		if req.TopicID == "" || req.UserID == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}

		tenantID, ok := requireTenant(w, r)
		if !ok {
			return
		}

		id := uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO graduation_project_archives (id, tenant_id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification)
			VALUES ($1, $2, $3, $4, $5, 'making', 0, NOW(), false)
		`, id, tenantID, req.TopicID, req.UserID, req.Phase)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建毕业档案失败")
			return
		}

		archive, _ := h.fetchArchive(r.Context(), id)
		respondJSON(w, http.StatusCreated, archive)
		return
	}

	items, total, err := executeListQuery[domain.GraduationProjectArchive](r.Context(), h.DB, r, store.ListQueryConfig[domain.GraduationProjectArchive]{
		Table:         "graduation_project_archives",
		SelectColumns: "id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification",
		OrderBy:       "last_updated DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if topicID := p.Values["topicId"]; topicID != "" {
				qb.AddCondition("topic_id = " + qb.NextArg(topicID))
			}
		},
		ScanRows: scanGraduationArchiveRows,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询毕业档案失败")
		return
	}
	respondJSON(w, http.StatusOK, GraduationArchiveListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) EvaluationsCRUD(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateGraduationEvaluationRequest
		if !decodeBody(w, r, &req) {
			return
		}
		if req.TopicID == "" || req.UserID == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}

		tenantID, ok := requireTenant(w, r)
		if !ok {
			return
		}

		id := uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO graduation_project_evaluations (id, tenant_id, topic_id, user_id, advisor_score,
				enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
		`, id, tenantID, req.TopicID, req.UserID, req.AdvisorScore, req.EnterpriseScore, req.DefenseScore, req.ComprehensiveGrade, req.IsExcellent)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建毕业评价失败")
			return
		}

		eval, _ := h.fetchEvaluation(r.Context(), id)
		respondJSON(w, http.StatusCreated, eval)
		return
	}

	items, total, err := executeListQuery[domain.GraduationProjectEvaluation](r.Context(), h.DB, r, store.ListQueryConfig[domain.GraduationProjectEvaluation]{
		Table:         "graduation_project_evaluations",
		SelectColumns: "id, topic_id, user_id, advisor_score, enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at",
		OrderBy:       "evaluated_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if topicID := p.Values["topicId"]; topicID != "" {
				qb.AddCondition("topic_id = " + qb.NextArg(topicID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: scanGraduationEvaluationRows,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询毕业评价失败")
		return
	}
	respondJSON(w, http.StatusOK, GraduationEvaluationListResponse{Items: items, Total: total})
}

func (h *GraduationHandler) QueryResults(w http.ResponseWriter, r *http.Request) {
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
		respondError(w, http.StatusInternalServerError, "查询毕业查询结果失败")
		return
	}
	defer rows.Close()

	items := make([]domain.GraduationQueryResult, 0)
	for rows.Next() {
		var q domain.GraduationQueryResult
		var className, majorName, projectGrade *string
		if err := rows.Scan(&q.ID, &q.UserID, &className, &majorName, &q.CreditCompleted, &q.CreditRequired,
			&q.ScenePassed, &q.SceneRequired, &projectGrade, &q.GraduationStatus, &q.AbilityCertStatus, &q.RectificationCount, &q.UpdatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "读取毕业查询结果失败")
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
	var tenantID, college, advisorID, enterpriseMentorID, description *string
	var startDate, endDate *time.Time
	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at
		FROM graduation_project_topics WHERE id = $1
	`, id).Scan(
		&t.ID, &tenantID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
		&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
	)
	if err != nil {
		return t, err
	}
	t.TenantID = tenantID
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
		var tenantID, college, advisorID, enterpriseMentorID, description *string
		var startDate, endDate *time.Time
		if err := rows.Scan(
			&t.ID, &tenantID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
			&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.TenantID = tenantID
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

func scanGraduationArchiveRows(rows pgx.Rows) ([]domain.GraduationProjectArchive, error) {
	items := make([]domain.GraduationProjectArchive, 0)
	for rows.Next() {
		var a domain.GraduationProjectArchive
		if err := rows.Scan(&a.ID, &a.TopicID, &a.UserID,
			&a.Phase, &a.DocStatus, &a.DocCount, &a.LastUpdated, &a.HasRectification); err != nil {
			return nil, err
		}
		items = append(items, a)
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

func scanGraduationEvaluationRows(rows pgx.Rows) ([]domain.GraduationProjectEvaluation, error) {
	items := make([]domain.GraduationProjectEvaluation, 0)
	for rows.Next() {
		var e domain.GraduationProjectEvaluation
		var advisorScore, enterpriseScore, defenseScore *float64
		var comprehensiveGrade *string
		if err := rows.Scan(&e.ID, &e.TopicID, &e.UserID, &advisorScore, &enterpriseScore, &defenseScore,
			&comprehensiveGrade, &e.IsExcellent, &e.Status, &e.EvaluatedAt); err != nil {
			return nil, err
		}
		e.AdvisorScore = advisorScore
		e.EnterpriseScore = enterpriseScore
		e.DefenseScore = defenseScore
		e.ComprehensiveGrade = comprehensiveGrade
		items = append(items, e)
	}
	return items, nil
}
