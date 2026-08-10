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

type GeneratePortraitRequest struct {
	UserID           string `json:"userId"`
	CareerPositionID string `json:"careerPositionId"`
}

// PortraitCourseItem 画像课程成绩项（无成绩课程 score/rank 为 null）。
type PortraitCourseItem struct {
	CourseID   string   `json:"courseId"`
	CourseName string   `json:"courseName"`
	Score      *float64 `json:"score"`
	Rank       *int     `json:"rank"`
	Total      *int     `json:"total"`
}

// PortraitPositionItem 画像推荐岗位项（来自已发布场景关联岗位）。
type PortraitPositionItem struct {
	PositionID string `json:"positionId"`
	Name       string `json:"positionName"`
}

// StudentDashboardResponse 画像页辅助数据：实践场景数/推荐岗位/课程成绩表。
type StudentDashboardResponse struct {
	SceneCount int                    `json:"sceneCount"`
	Positions  []PortraitPositionItem `json:"positions"`
	Courses    []PortraitCourseItem   `json:"courses"`
}

// StudentDashboard 画像页聚合数据：学生有评分场景数、场景关联岗位（推荐就业方向）、
// 租户课程+学生成绩合并（课程成绩表）。
func (h *StudentPortraitHandler) StudentDashboard(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := r.URL.Query().Get("userId")
	// 学生仅可查看本人数据
	if middleware.HasRole(claims, domain.RoleStudent) {
		userID = claims.UserID
	}
	if userID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}

	resp := StudentDashboardResponse{Positions: []PortraitPositionItem{}, Courses: []PortraitCourseItem{}}

	sceneCount, err := h.Service.CountStudentScenes(r.Context(), tenantID, userID)
	if err != nil {
		respondServerError(w, r, err, "查询实践场景数失败")
		return
	}
	resp.SceneCount = sceneCount

	positions, err := h.Service.ListScenePositions(r.Context(), tenantID, userID)
	if err != nil {
		respondServerError(w, r, err, "查询推荐岗位失败")
		return
	}
	for _, p := range positions {
		resp.Positions = append(resp.Positions, PortraitPositionItem{PositionID: p.PositionID, Name: p.Name})
	}

	courses, err := h.Service.ListStudentCourses(r.Context(), userID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询课程失败")
		return
	}
	scores, err := h.Service.ListStudentCourseScores(r.Context(), tenantID, userID)
	if err != nil {
		respondServerError(w, r, err, "查询课程成绩失败")
		return
	}
	scoreMap := make(map[string]store.CourseScoreRow, len(scores))
	for _, sc := range scores {
		scoreMap[sc.CourseID] = sc
	}
	for _, c := range courses {
		item := PortraitCourseItem{CourseID: c.ID, CourseName: c.Name}
		if sc, ok := scoreMap[c.ID]; ok {
			s := sc.Score
			r2, t := sc.Rank, sc.Total
			item.Score = &s
			item.Rank = &r2
			item.Total = &t
		}
		resp.Courses = append(resp.Courses, item)
	}

	respondJSON(w, http.StatusOK, resp)
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

	cfg := h.Service.Store().StudentPortraits().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if middleware.HasRole(claims, domain.RoleStudent) {
		params.Values["userId"] = claims.UserID
	}
	items, total, err := h.Service.ListStudentPortraits(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询学生画像失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.StudentAbilityPortrait]{Items: items, Total: total})
}

func (h *StudentPortraitHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	portrait, err := h.Service.GetStudentPortrait(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "学生画像不存在")
		return
	}
	if middleware.HasRole(claims, domain.RoleStudent) && portrait.UserID != claims.UserID {
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

	// 学生本人只能生成自己的画像；请求体中的 userId 必须属于当前租户
	if middleware.HasRole(claims, domain.RoleStudent) && req.UserID != claims.UserID {
		respondError(w, http.StatusForbidden, "仅可生成本人的画像")
		return
	}
	user, err := h.Service.Store().Users().Get(r.Context(), tenantID, req.UserID)
	if err != nil || user.TenantID == nil || *user.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "无权操作：用户不属于您的租户")
		return
	}

	// 先对该 (user, careerPosition) 执行岗位能力汇聚，同步生成/更新画像
	aggCtx, aggCancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer aggCancel()
	if err := h.Agg.AggregatePosition(aggCtx, tenantID, req.CareerPositionID, []string{req.UserID}); err != nil {
		respondServerError(w, r, err, "生成画像失败")
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

	cfg := h.Service.Store().StudentPortraits().ArchivesListConfig()
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
	respondJSON(w, http.StatusOK, ListResponse[domain.StudentAbilityArchive]{Items: items, Total: total})
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
		MaterialType: store.StrPtrIfNonEmpty(req.MaterialType),
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
