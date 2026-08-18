package handler

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type JobAbilityResultHandler struct {
	Service *service.EvaluationService
	Agg     *service.JobAbilityAggregator

	aggMu       sync.Mutex
	aggInFlight map[string]struct{}
}

func NewJobAbilityResultHandler(st *store.Store) *JobAbilityResultHandler {
	svc := service.New(st)
	return &JobAbilityResultHandler{
		Service:     service.NewEvaluationService(svc),
		Agg:         service.NewJobAbilityAggregator(st),
		aggInFlight: make(map[string]struct{}),
	}
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
	DepartmentName        string           `json:"department"`
	TotalAbilityPoints    int              `json:"totalAbilityPoints"`
	AchievedAbilityPoints int              `json:"achievedAbilityPoints"`
	AchievementRate       float64          `json:"achievementRate"`
	Grade                 *string          `json:"grade,omitempty"`
	AbilityPointDetails   domain.JSONSlice `json:"abilityPointDetails,omitempty"`
	GradeHistory          domain.JSONSlice `json:"gradeHistory,omitempty"`
	EvaluatedAt           time.Time        `json:"evaluationTime"`
	// 岗位胜任度（%）：能力点胜任度加权平均，胜任度=(得分-岗位所需得分)/岗位所需得分，负值归零
	PositionCompetency float64 `json:"positionCompetency"`
	// 岗位胜任度（新，%）：能力点胜任度（新）加权平均（等级距离法）
	PositionCompetencyV2 float64 `json:"positionCompetencyV2"`
	// 能力认知得分（0-100）：能力点得分加权平均
	AbilityCognitionScore float64 `json:"abilityCognitionScore"`
}

// needScoreByLevel 系统五档掌握程度代码→对应分数阈值（level_mapping 为空时的岗位所需得分）。
var needScoreByLevel = map[string]float64{
	"understand": 0,
	"comprehend": 60,
	"master":     70,
	"proficient": 80,
	"expert":     90,
}

// storedIndicators 返回岗位胜任度与能力认知得分：优先用落库值；
// 存量行未落库（NULL）时对空列回退 computeAbilityIndicators 实时计算。
func storedIndicators(storedCompetency, storedCognition *float64, details domain.JSONSlice) (competency, cognition float64) {
	if storedCompetency != nil {
		competency = *storedCompetency
	} else {
		competency, _ = computeAbilityIndicators(details)
	}
	if storedCognition != nil {
		cognition = *storedCognition
	} else {
		_, cognition = computeAbilityIndicators(details)
	}
	return competency, cognition
}

// storedCompetencyV2 岗位胜任度（新）：优先用落库值，存量行 NULL 时回退实时计算。
func storedCompetencyV2(stored *float64, details domain.JSONSlice) float64 {
	if stored != nil {
		return *stored
	}
	return computeCompetencyV2(details)
}

// v2LevelRankByCode 掌握程度代码→等效等级基准值（understand=1 … expert=5），未知回退 2（60 分线）。
func v2LevelRankByCode(code string) float64 {
	switch code {
	case "understand":
		return 1
	case "comprehend":
		return 2
	case "master":
		return 3
	case "proficient":
		return 4
	case "expert":
		return 5
	}
	return 2
}

// v2DefaultLevelValue 系统默认档位下的得分→等效等级值（了解[0,59]/理解[60,69]/掌握[70,79]/熟练[80,89]/精通[90,100]）。
func v2DefaultLevelValue(score float64) float64 {
	bounds := []float64{0, 60, 70, 80, 90, 100}
	for i := 0; i < 5; i++ {
		min := bounds[i]
		max := bounds[i+1] - 1
		if i == 4 {
			max = 100
		}
		if score >= min && score <= max {
			return float64(i+1) + (score-min)/(max-min+1)
		}
	}
	return 0
}

// computeCompetencyV2 由能力点明细计算岗位胜任度（新，%）：等级距离法。
// 用于存量行回退；明细无自定义分档信息，按系统默认档位映射，与存量数据生成时的配置相符。
func computeCompetencyV2(details domain.JSONSlice) float64 {
	var weightedSum, weightSum float64
	for _, raw := range details {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		score, _ := m["score"].(float64)
		weight, _ := m["weight"].(float64)
		requiredLevel, _ := m["requiredLevel"].(string)
		if weight <= 0 {
			continue
		}
		weightSum += weight
		comp := 100 + (v2DefaultLevelValue(score)-v2LevelRankByCode(requiredLevel))*50
		if comp < 0 {
			comp = 0
		}
		weightedSum += comp * weight
	}
	if weightSum <= 0 {
		return 0
	}
	return weightedSum / weightSum
}

// computeAbilityIndicators 由能力点明细计算岗位胜任度（%）与能力认知得分（0-100）。
func computeAbilityIndicators(details domain.JSONSlice) (competency, cognition float64) {
	var weightSum float64
	for _, raw := range details {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		score, _ := m["score"].(float64)
		weight, _ := m["weight"].(float64)
		requiredLevel, _ := m["requiredLevel"].(string)
		if weight <= 0 {
			continue
		}
		weightSum += weight
		need := needScoreByLevel[requiredLevel]
		competencyI := 0.0
		if need > 0 {
			competencyI = (score - need) / need
			if competencyI < 0 {
				competencyI = 0
			}
		}
		competency += competencyI * weight
		cognition += score * weight
	}
	if weightSum <= 0 {
		return 0, 0
	}
	return competency / weightSum * 100, cognition / weightSum
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
	claims := middleware.CurrentUser(r)
	if claims == nil {
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
	// 学生仅可查看本人的能力汇聚结果
	if middleware.HasRole(claims, domain.RoleStudent) {
		f.UserID = claims.UserID
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
		competency, cognition := storedIndicators(r2.PositionCompetency, r2.AbilityCognitionScore, r2.AbilityPointDetails)
		competencyV2 := storedCompetencyV2(r2.PositionCompetencyV2, r2.AbilityPointDetails)
		items = append(items, JobAbilityResultItem{
			ID: r2.ID, CareerPositionID: r2.CareerPositionID, PositionName: r2.PositionName,
			UserID: r2.UserID, UserName: r2.UserName, StudentNo: r2.StudentNo,
			ClassName: r2.ClassName, MajorID: r2.MajorID, MajorName: r2.MajorName,
			DepartmentName:     r2.DepartmentName,
			TotalAbilityPoints: r2.TotalAbilityPoints, AchievedAbilityPoints: r2.AchievedAbilityPoints,
			AchievementRate: r2.AchievementRate, Grade: r2.Grade, EvaluatedAt: r2.EvaluatedAt,
			AbilityPointDetails: r2.AbilityPointDetails, GradeHistory: r2.GradeHistory,
			PositionCompetency: competency, AbilityCognitionScore: cognition,
			PositionCompetencyV2: competencyV2,
		})
	}
	respondJSON(w, http.StatusOK, ListResponse[JobAbilityResultItem]{Items: items, Total: total})
}

func (h *JobAbilityResultHandler) Get(w http.ResponseWriter, r *http.Request) {
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

	row, details, history, err := h.Service.GetJobAbilityResult(r.Context(), id, tenantID)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, "岗位能力结果不存在")
		return
	}
	if err != nil {
		respondServerError(w, r, err, "查询岗位能力结果详情失败")
		return
	}
	// 学生仅可查看本人的能力汇聚结果（与 List 强制本人一致）
	if middleware.HasRole(claims, domain.RoleStudent) && row.UserID != claims.UserID {
		respondError(w, http.StatusNotFound, "岗位能力结果不存在")
		return
	}
	item := JobAbilityResultItem{
		ID: row.ID, CareerPositionID: row.CareerPositionID, PositionName: row.PositionName,
		UserID: row.UserID, UserName: row.UserName, StudentNo: row.StudentNo,
		ClassName: row.ClassName, MajorID: row.MajorID, MajorName: row.MajorName,
		DepartmentName:     row.DepartmentName,
		TotalAbilityPoints: row.TotalAbilityPoints, AchievedAbilityPoints: row.AchievedAbilityPoints,
		AchievementRate: row.AchievementRate, Grade: row.Grade, EvaluatedAt: row.EvaluatedAt,
	}
	if details != nil {
		item.AbilityPointDetails = *details
		item.PositionCompetency, item.AbilityCognitionScore = storedIndicators(row.PositionCompetency, row.AbilityCognitionScore, *details)
		item.PositionCompetencyV2 = storedCompetencyV2(row.PositionCompetencyV2, *details)
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

// CourseScoreItem 学生课程成绩项。
type CourseScoreItem struct {
	CourseID   string  `json:"courseId"`
	CourseName string  `json:"courseName"`
	Score      float64 `json:"score"`
	Rank       int     `json:"rank"`
	Total      int     `json:"total"`
}

// CourseScores 查询学生在体系课中的成绩与排名（学生强制查本人）。
func (h *JobAbilityResultHandler) CourseScores(w http.ResponseWriter, r *http.Request) {
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
	// 学生仅可查看本人的课程成绩
	if middleware.HasRole(claims, domain.RoleStudent) {
		userID = claims.UserID
	}
	if userID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}
	rows, err := h.Service.ListStudentCourseScores(r.Context(), tenantID, userID)
	if err != nil {
		respondServerError(w, r, err, "查询课程成绩失败")
		return
	}
	items := make([]CourseScoreItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, CourseScoreItem{
			CourseID: row.CourseID, CourseName: row.CourseName,
			Score: row.Score, Rank: row.Rank, Total: row.Total,
		})
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
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
	// 岗位归属校验：仅允许对本租户岗位触发汇聚（与绑定创建一致）
	posTenantID, err := h.Service.PositionTenantID(r.Context(), req.CareerPositionID)
	if err != nil || posTenantID != tenantID {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}

	h.aggMu.Lock()
	if _, running := h.aggInFlight[req.CareerPositionID]; running {
		h.aggMu.Unlock()
		slog.Warn("job ability aggregate skipped: already running", "positionId", req.CareerPositionID)
		respondJSON(w, http.StatusAccepted, map[string]string{"status": "running"})
		return
	}
	h.aggInFlight[req.CareerPositionID] = struct{}{}
	h.aggMu.Unlock()

	logID, err := h.Agg.CreateLog(r.Context(), tenantID, req.CareerPositionID)
	if err != nil {
		h.aggMu.Lock()
		delete(h.aggInFlight, req.CareerPositionID)
		h.aggMu.Unlock()
		respondServerError(w, r, err, "触发汇聚失败")
		return
	}
	go func() {
		defer func() {
			h.aggMu.Lock()
			delete(h.aggInFlight, req.CareerPositionID)
			h.aggMu.Unlock()
		}()
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("job ability aggregate panic", "logId", logID, "panic", rec)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if err := h.Agg.RunAggregate(ctx, logID, tenantID, req.CareerPositionID, req.UserIDs); err != nil {
			slog.Error("job ability aggregate failed", "logId", logID, "error", err)
		}
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
		log, err = h.Service.GetAggregateLog(r.Context(), logID, tenantID)
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
