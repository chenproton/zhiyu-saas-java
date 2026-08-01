package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type GraduationHandler struct {
	Service *service.EvaluationService
}

type GraduationTopicListResponse struct {
	Items []domain.GraduationProjectTopic `json:"items"`
	Total int                             `json:"total"`
}

type CreateGraduationTopicRequest struct {
	Name               string  `json:"name"`
	CareerPositionID   string  `json:"careerPositionId"`
	College            *string `json:"college"`
	Source             *string `json:"source"`
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
		ScanRows:      store.ScanGraduationTopicRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGraduationTopics(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询毕业设计课题失败")
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
	topic, err := h.Service.GetGraduationTopic(r.Context(), id)
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

	topic, err := h.Service.CreateGraduationTopic(r.Context(), &store.GraduationTopicParams{
		TenantID: tenantID, Name: req.Name, CareerPositionID: req.CareerPositionID,
		College: req.College, Source: req.Source, Capacity: req.Capacity,
		AdvisorID: req.AdvisorID, EnterpriseMentorID: req.EnterpriseMentorID,
		StartDate: &startDate, EndDate: &endDate, Description: req.Description,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "毕业设计题目名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建毕业设计课题失败")
		return
	}
	respondJSON(w, http.StatusCreated, topic)
}

func (h *GraduationHandler) UpdateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	topic, err := h.Service.GetGraduationTopic(r.Context(), id)
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

	topic, err = h.Service.UpdateGraduationTopic(r.Context(), id, &store.GraduationTopicParams{
		Name: req.Name, CareerPositionID: req.CareerPositionID,
		College: req.College, Source: req.Source, Capacity: req.Capacity,
		AdvisorID: req.AdvisorID, EnterpriseMentorID: req.EnterpriseMentorID,
		StartDate: &startDate, EndDate: &endDate, Description: req.Description,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "毕业设计题目名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新毕业设计课题失败")
		return
	}
	respondJSON(w, http.StatusOK, topic)
}

func (h *GraduationHandler) DeleteTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	topic, err := h.Service.GetGraduationTopic(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "毕业设计课题不存在")
		return
	}
	if topic.TenantID != nil && !verifyTenantOwnership(w, r, *topic.TenantID) {
		return
	}
	if err := h.Service.DeleteGraduationTopic(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除毕业设计课题失败")
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
	topic, err := h.Service.GetGraduationTopic(r.Context(), id)
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
	applied, err := h.Service.ApplyGraduationTopic(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "申请课题失败")
		return
	}
	if !applied {
		respondError(w, http.StatusBadRequest, "课题不存在或已满员")
		return
	}
	topic, _ = h.Service.GetGraduationTopic(r.Context(), id)
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
		archive, err := h.Service.CreateGraduationArchive(r.Context(), tenantID, req.TopicID, req.UserID, req.Phase)
		if err != nil {
		respondServerError(w, r, err, "创建毕业档案失败")
		return
	}
		respondJSON(w, http.StatusCreated, archive)
		return
	}

	cfg := store.ListQueryConfig[domain.GraduationProjectArchive]{
		Table:         "graduation_project_archives",
		SelectColumns: "id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification",
		OrderBy:       "last_updated DESC",
		ScanRows:      store.ScanGraduationArchiveRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if topicID := p.Values["topicId"]; topicID != "" {
				qb.AddCondition("topic_id = " + qb.NextArg(topicID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, false)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGraduationArchives(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询毕业档案失败")
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
		eval, err := h.Service.CreateGraduationEvaluation(r.Context(), &store.GraduationEvaluationParams{
			TenantID: tenantID, TopicID: req.TopicID, UserID: req.UserID,
			AdvisorScore: req.AdvisorScore, EnterpriseScore: req.EnterpriseScore, DefenseScore: req.DefenseScore,
			ComprehensiveGrade: req.ComprehensiveGrade, IsExcellent: req.IsExcellent,
		})
		if err != nil {
		respondServerError(w, r, err, "创建毕业评价失败")
		return
	}
		respondJSON(w, http.StatusCreated, eval)
		return
	}

	cfg := store.ListQueryConfig[domain.GraduationProjectEvaluation]{
		Table:         "graduation_project_evaluations",
		SelectColumns: "id, topic_id, user_id, advisor_score, enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at",
		OrderBy:       "evaluated_at DESC",
		ScanRows:      store.ScanGraduationEvaluationRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if topicID := p.Values["topicId"]; topicID != "" {
				qb.AddCondition("topic_id = " + qb.NextArg(topicID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, false)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGraduationEvaluations(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询毕业评价失败")
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
	limit := 50
	offset := 0
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	items, total, err := h.Service.QueryGraduationResults(r.Context(), limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询毕业查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, GraduationQueryListResponse{Items: items, Total: total})
}
