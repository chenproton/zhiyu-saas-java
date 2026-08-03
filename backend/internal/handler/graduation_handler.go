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

type CreateGraduationArchiveRequest struct {
	TopicID string `json:"topicId"`
	UserID  string `json:"userId"`
	Phase   string `json:"phase"`
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

func (h *GraduationHandler) ListTopics(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Graduations().ListTopicsConfig()
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
	respondJSON(w, http.StatusOK, ListResponse[domain.GraduationProjectTopic]{Items: items, Total: total})
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
		respondServerError(w, r, err, "创建毕业设计课题失败")
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
		respondServerError(w, r, err, "更新毕业设计课题失败")
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
		respondServerError(w, r, err, "删除毕业设计课题失败")
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
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	isNew, applied, err := h.Service.ApplyGraduationTopic(r.Context(), tenantID, id, claims.UserID, "initial")
	if err != nil {
		respondServerError(w, r, err, "申请课题失败")
		return
	}
	if !isNew {
		respondError(w, http.StatusBadRequest, "已申请过该课题")
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

	cfg := h.Service.Store().Graduations().ListArchivesConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGraduationArchives(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询毕业档案失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.GraduationProjectArchive]{Items: items, Total: total})
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

	cfg := h.Service.Store().Graduations().ListEvaluationsConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGraduationEvaluations(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询毕业评价失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.GraduationProjectEvaluation]{Items: items, Total: total})
}

func (h *GraduationHandler) QueryResults(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
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
	items, total, err := h.Service.QueryGraduationResults(r.Context(), *claims.TenantID, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询毕业查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.GraduationQueryResult]{Items: items, Total: total})
}
