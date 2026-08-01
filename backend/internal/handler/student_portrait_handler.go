package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type StudentPortraitHandler struct {
	Service *service.EvaluationService
	Agg     *service.JobAbilityAggregator
}

func NewStudentPortraitHandler(st *store.Store) *StudentPortraitHandler {
	svc := service.New(st)
	return &StudentPortraitHandler{Service: service.NewEvaluationService(svc), Agg: service.NewJobAbilityAggregator(st)}
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

	cfg := store.ListQueryConfig[domain.StudentAbilityPortrait]{
		Table:         "student_ability_portraits",
		SelectColumns: `id, user_id, career_position_id, overall_grade, domain_scores, class_rank, class_total, major_rank, major_total, recommend_positions, updated_at, completed_courses, completed_scenes, total_credits, archive_count, course_records, graduation_qualified, attendance_rate, diploma_badge, dual_badge`,
		TenantScoped:  true,
		OrderBy:       "updated_at DESC",
		ScanRows:      store.ScanStudentPortraitRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if middleware.HasRole(claims, "student") {
				qb.AddCondition("user_id = " + qb.NextArg(claims.UserID))
				return
			}
			if userID := p.Values["userId"]; userID != "" {
				qb.AddCondition("user_id = " + qb.NextArg(userID))
			}
			if positionID := p.Values["careerPositionId"]; positionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(positionID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListStudentPortraits(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询学生画像失败")
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
	portrait, err := h.Service.GetStudentPortrait(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "学生画像不存在")
		return
	}
	if middleware.HasRole(claims, "student") && portrait.UserID != claims.UserID {
		respondError(w, http.StatusForbidden, "权限不足")
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
	if !decodeBody(w, r, &req) {
		return
	}
	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少岗位ID")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	// 先对该 (user, careerPosition) 执行岗位能力汇聚，同步生成/更新画像
	aggCtx, aggCancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer aggCancel()
	if err := h.Agg.AggregatePosition(aggCtx, tenantID, req.CareerPositionID, []string{req.UserID}); err != nil {
		respondError(w, http.StatusInternalServerError, "生成画像失败")
		return
	}

	portrait, err := h.Service.GetStudentPortraitByUserPosition(r.Context(), req.UserID, req.CareerPositionID)
	if err != nil {
		portrait = &domain.StudentAbilityPortrait{
			UserID:             req.UserID,
			CareerPositionID:   req.CareerPositionID,
			DomainScores:       domain.JSONSlice{},
			CourseRecords:      domain.JSONSlice{},
			RecommendPositions: domain.JSONSlice{},
		}
	}
	respondJSON(w, http.StatusOK, portrait)
}

func (h *StudentPortraitHandler) ListArchives(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.StudentAbilityArchive]{
		Table:         "student_ability_archives",
		SelectColumns: `id, user_id, material_type, material_name, issuing_org, obtain_date, level, audit_status, audit_remark, converted_credit, direction, is_enabled, created_at`,
		TenantScoped:  true,
		ScanRows:      store.ScanStudentArchiveRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if userID := p.Values["userId"]; userID != "" {
				qb.AddCondition("user_id = " + qb.NextArg(userID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListStudentArchives(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询学生档案列表失败")
		return
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
	if !decodeBody(w, r, &req) {
		return
	}
	if req.UserID == "" || req.MaterialName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	direction := req.Direction
	if direction == nil || *direction == "" {
		d := "positive"
		direction = &d
	}
	archive, err := h.Service.CreateStudentArchive(r.Context(), &store.StudentArchiveCreateParams{
		TenantID:     tenantID,
		UserID:       req.UserID,
		MaterialType: strPtr(req.MaterialType),
		MaterialName: req.MaterialName,
		IssuingOrg:   req.IssuingOrg,
		ObtainDate:   req.ObtainDate,
		Direction:    direction,
	})
	if err != nil {
		respondServerError(w, r, err, "创建学生档案失败")
		return
	}
	respondJSON(w, http.StatusCreated, archive)
}

func (h *StudentPortraitHandler) DeleteArchive(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	deleted, err := h.Service.DeleteStudentArchive(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "删除学生档案失败")
		return
	}
	if !deleted {
		respondError(w, http.StatusNotFound, "学生档案不存在")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
