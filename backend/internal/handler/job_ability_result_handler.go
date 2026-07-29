package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type JobAbilityResultHandler struct {
	DB  *pgxpool.Pool
	Agg *service.JobAbilityAggregator
}

func NewJobAbilityResultHandler(db *pgxpool.Pool) *JobAbilityResultHandler {
	return &JobAbilityResultHandler{DB: db, Agg: service.NewJobAbilityAggregator(db)}
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

const jobAbilityResultColumns = `
	r.id, r.career_position_id, COALESCE(cp.name, ''), r.user_id, COALESCE(u.name, ''), u.student_no,
	r.class_name, r.major_id, r.major_name,
	r.total_ability_points, r.achieved_ability_points, r.achievement_rate, r.grade, r.evaluated_at`

func scanJobAbilityResultRow(rows pgx.Rows) (JobAbilityResultItem, error) {
	var item JobAbilityResultItem
	err := rows.Scan(&item.ID, &item.CareerPositionID, &item.PositionName, &item.UserID, &item.UserName, &item.StudentNo,
		&item.ClassName, &item.MajorID, &item.MajorName,
		&item.TotalAbilityPoints, &item.AchievedAbilityPoints, &item.AchievementRate, &item.Grade, &item.EvaluatedAt)
	return item, err
}

// List GET /evaluation/job-ability/results
func (h *JobAbilityResultHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	qb := &listQueryBuilder{idx: 1}
	qb.addCondition("r.tenant_id = " + qb.nextArg(tenantID))
	if v := r.URL.Query().Get("careerPositionId"); v != "" {
		qb.addCondition("r.career_position_id = " + qb.nextArg(v))
	}
	if v := r.URL.Query().Get("grade"); v != "" {
		qb.addCondition("r.grade = " + qb.nextArg(v))
	}
	if v := r.URL.Query().Get("search"); v != "" {
		qb.addCondition("(u.name ILIKE " + qb.nextArg("%"+v+"%") + " OR u.student_no ILIKE " + qb.nextArg("%"+v+"%") + ")")
	}
	where := qb.whereClause()

	var total int
	if err := h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE `+where, qb.args...).Scan(&total); err != nil {
		slog.Error("查询岗位能力结果失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询岗位能力结果失败")
		return
	}

	page, err := parseInt(r.URL.Query().Get("page"), 1)
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := parseInt(r.URL.Query().Get("limit"), 50)
	if err != nil || limit < 1 {
		limit = 50
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT `+jobAbilityResultColumns+`
		FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE `+where+`
		ORDER BY r.evaluated_at DESC
		LIMIT `+itoa(limit)+` OFFSET `+itoa((page-1)*limit), qb.args...)
	if err != nil {
		slog.Error("查询岗位能力结果失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询岗位能力结果失败")
		return
	}
	defer rows.Close()

	items := make([]JobAbilityResultItem, 0)
	for rows.Next() {
		item, err := scanJobAbilityResultRow(rows)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "读取岗位能力结果失败")
			return
		}
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, JobAbilityResultListResponse{Items: items, Total: total})
}

// Get GET /evaluation/job-ability/results/{id}
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

	var item JobAbilityResultItem
	err := h.DB.QueryRow(r.Context(), `
		SELECT `+jobAbilityResultColumns+`, r.ability_point_details, r.grade_history
		FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.id = $1 AND r.tenant_id = $2
	`, id, tenantID).Scan(&item.ID, &item.CareerPositionID, &item.PositionName, &item.UserID, &item.UserName, &item.StudentNo,
		&item.ClassName, &item.MajorID, &item.MajorName,
		&item.TotalAbilityPoints, &item.AchievedAbilityPoints, &item.AchievementRate, &item.Grade, &item.EvaluatedAt,
		&item.AbilityPointDetails, &item.GradeHistory)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, "岗位能力结果不存在")
		return
	}
	if err != nil {
		slog.Error("查询岗位能力结果详情失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询岗位能力结果详情失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// Summary GET /evaluation/job-ability/results/summary
func (h *JobAbilityResultHandler) Summary(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT r.career_position_id, COALESCE(cp.name, ''), COUNT(*), COALESCE(AVG(r.achievement_rate), 0)
		FROM job_ability_results r
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.tenant_id = $1
		GROUP BY r.career_position_id, cp.name
		ORDER BY COUNT(*) DESC
	`, tenantID)
	if err != nil {
		slog.Error("查询岗位能力汇总失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询岗位能力汇总失败")
		return
	}
	defer rows.Close()

	items := make([]JobAbilitySummaryItem, 0)
	for rows.Next() {
		var item JobAbilitySummaryItem
		if err := rows.Scan(&item.PositionID, &item.PositionName, &item.StudentCount, &item.AvgRate); err != nil {
			respondError(w, http.StatusInternalServerError, "读取岗位能力汇总失败")
			return
		}
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, items)
}

// Aggregate POST /evaluation/job-ability/aggregate — 异步执行汇聚，立即返回 202 + logId。
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	logID, err := h.Agg.CreateLog(r.Context(), tenantID, req.CareerPositionID)
	if err != nil {
		slog.Error("创建汇聚日志失败", "error", err)
		respondError(w, http.StatusInternalServerError, "触发汇聚失败")
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		_ = h.Agg.RunAggregate(ctx, logID, tenantID, req.CareerPositionID, req.UserIDs)
	}()

	respondJSON(w, http.StatusAccepted, map[string]string{"logId": logID, "status": "running"})
}

// AggregateStatus GET /evaluation/job-ability/aggregate/status?careerPositionId=
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

	var log JobAbilityAggregateLog
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, career_position_id, status, student_count, updated_count, error_message, started_at, finished_at
		FROM job_ability_aggregate_logs
		WHERE tenant_id = $1 AND career_position_id = $2
		ORDER BY started_at DESC LIMIT 1
	`, tenantID, positionID).Scan(&log.ID, &log.CareerPositionID, &log.Status, &log.StudentCount, &log.UpdatedCount, &log.ErrorMessage, &log.StartedAt, &log.FinishedAt)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, "暂无汇聚记录")
		return
	}
	if err != nil {
		slog.Error("查询汇聚状态失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询汇聚状态失败")
		return
	}
	respondJSON(w, http.StatusOK, log)
}
