package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type JobAbilityResultHandler struct {
	Service *service.EvaluationService
	Agg     *service.JobAbilityAggregator
}

func NewJobAbilityResultHandler(db *pgxpool.Pool) *JobAbilityResultHandler {
	return &JobAbilityResultHandler{Service: service.NewEvaluationService(service.New(store.New(db))), Agg: service.NewJobAbilityAggregator(db)}
}

type JobAbilityResultItem struct {
	ID                    string           `json:"id"`
	CareerPositionID      string           `json:"positionId"`
	PositionName          string           `json:"positionName"`
	UserID                string           `json:"userId"`
	UserName              string           `json:"studentName"`
	StudentNo             *string          `json:"studentId,omitempty"`
	ClassName             *string          `json:"className,omitempty"`
	MajorID               *string          `json:"majorId,omitempty"`
	MajorName             *string          `json:"majorName,omitempty"`
	TotalAbilityPoints    int              `json:"totalAbilityPoints"`
	AchievedAbilityPoints int              `json:"achievedAbilityPoints"`
	AchievementRate       float64          `json:"achievementRate"`
	Grade                 *string          `json:"grade,omitempty"`
	AbilityPointDetails   domain.JSONSlice `json:"abilityPointDetails,omitempty"`
	GradeHistory          domain.JSONSlice `json:"gradeHistory,omitempty"`
	EvaluatedAt           time.Time        `json:"evaluationTime"`
}

type JobAbilityResultListResponse struct {
	Items []JobAbilityResultItem `json:"items"`
	Total int                    `json:"total"`
}

type JobAbilitySummaryItem struct {
	PositionID   string  `json:"positionId"`
	PositionName string  `json:"positionName"`
	StudentCount int     `json:"studentCount"`
	AvgRate      float64 `json:"avgRate"`
}

type JobAbilityAggregateRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	UserIDs          []string `json:"userIds"`
}

type JobAbilityAggregateLog struct {
	ID               string     `json:"id"`
	CareerPositionID *string    `json:"careerPositionId,omitempty"`
	Status           string     `json:"status"`
	StudentCount     int        `json:"studentCount"`
	UpdatedCount     int        `json:"updatedCount"`
	ErrorMessage     *string    `json:"errorMessage,omitempty"`
	StartedAt        time.Time  `json:"startedAt"`
	FinishedAt       *time.Time `json:"finishedAt,omitempty"`
}

func (h *JobAbilityResultHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	f := store.JobAbilityResultFilter{
		TenantID:         tenantID,
		CareerPositionID: r.URL.Query().Get("careerPositionId"),
		UserID:           r.URL.Query().Get("userId"),
		Grade:            r.URL.Query().Get("grade"),
		Search:           r.URL.Query().Get("search"),
	}
	page, _ := parseInt(r.URL.Query().Get("page"), 1)
	if page < 1 {
		page = 1
	}
	limit, _ := parseInt(r.URL.Query().Get("limit"), 50)
	if limit < 1 {
		limit = 50
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}

	rows, total, err := h.Service.ListJobAbilityResults(r.Context(), f, limit, (page-1)*limit)
	if err != nil {
		respondServerError(w, r, err, "查询岗位能力结果失败")
		return
	}
	items := make([]JobAbilityResultItem, 0, len(rows))
	for _, r2 := range rows {
		items = append(items, JobAbilityResultItem{
			ID: r2.ID, CareerPositionID: r2.CareerPositionID, PositionName: r2.PositionName,
			UserID: r2.UserID, UserName: r2.UserName, StudentNo: r2.StudentNo,
			ClassName: r2.ClassName, MajorID: r2.MajorID, MajorName: r2.MajorName,
			TotalAbilityPoints: r2.TotalAbilityPoints, AchievedAbilityPoints: r2.AchievedAbilityPoints,
			AchievementRate: r2.AchievementRate, Grade: r2.Grade, EvaluatedAt: r2.EvaluatedAt,
		})
	}
	respondJSON(w, http.StatusOK, JobAbilityResultListResponse{Items: items, Total: total})
}

func (h *JobAbilityResultHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	row, details, history, err := h.Service.GetJobAbilityResult(r.Context(), id, tenantID)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, "岗位能力结果不存在")
		return
	}
	if err != nil {
		respondServerError(w, r, err, "查询岗位能力结果详情失败")
		return
	}
	item := JobAbilityResultItem{
		ID: row.ID, CareerPositionID: row.CareerPositionID, PositionName: row.PositionName,
		UserID: row.UserID, UserName: row.UserName, StudentNo: row.StudentNo,
		ClassName: row.ClassName, MajorID: row.MajorID, MajorName: row.MajorName,
		TotalAbilityPoints: row.TotalAbilityPoints, AchievedAbilityPoints: row.AchievedAbilityPoints,
		AchievementRate: row.AchievementRate, Grade: row.Grade, EvaluatedAt: row.EvaluatedAt,
	}
	if details != nil {
		item.AbilityPointDetails = *details
	}
	if history != nil {
		item.GradeHistory = *history
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *JobAbilityResultHandler) Summary(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	rows, err := h.Service.SummaryJobAbilityResults(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询岗位能力汇总失败")
		return
	}
	items := make([]JobAbilitySummaryItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, JobAbilitySummaryItem{
			PositionID: row.PositionID, PositionName: row.PositionName,
			StudentCount: row.StudentCount, AvgRate: row.AvgRate,
		})
	}
	respondJSON(w, http.StatusOK, items)
}

func (h *JobAbilityResultHandler) Aggregate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req JobAbilityAggregateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	logID, err := h.Agg.CreateLog(r.Context(), tenantID, req.CareerPositionID)
	if err != nil {
		respondServerError(w, r, err, "触发汇聚失败")
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		_ = h.Agg.RunAggregate(ctx, logID, tenantID, req.CareerPositionID, req.UserIDs)
	}()
	respondJSON(w, http.StatusAccepted, map[string]string{"logId": logID, "status": "running"})
}

func (h *JobAbilityResultHandler) AggregateStatus(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	positionID := r.URL.Query().Get("careerPositionId")
	if positionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填参数")
		return
	}
	logID := r.URL.Query().Get("logId")

	var log *store.JobAbilityAggregateLog
	var err error
	if logID != "" {
		log, err = h.Service.GetAggregateLog(r.Context(), logID)
	} else {
		log, err = h.Service.GetRecentAggregateLog(r.Context(), tenantID, positionID)
	}
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, "暂无汇聚记录")
		return
	}
	if err != nil {
		respondServerError(w, r, err, "查询汇聚状态失败")
		return
	}
	respondJSON(w, http.StatusOK, JobAbilityAggregateLog{
		ID: log.ID, CareerPositionID: log.CareerPositionID, Status: log.Status,
		StudentCount: log.StudentCount, UpdatedCount: log.UpdatedCount,
		ErrorMessage: log.ErrorMessage, StartedAt: log.StartedAt, FinishedAt: log.FinishedAt,
	})
}
