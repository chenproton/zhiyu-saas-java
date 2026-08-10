package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ExamHandler struct {
	Service     *service.EvaluationService
	RedisClient *redis.Client
}

type CreateExamRequest struct {
	Name                string   `json:"name"`
	Description         string   `json:"description"`
	Duration            int      `json:"duration"`
	CoverImage          *string  `json:"coverImage"`
	CollaboratorIDs     []string `json:"collaboratorIds"`
	CollaboratorDeptIDs []string `json:"collaboratorDeptIds"`
	BatchID             *string  `json:"batchId"`
	IsTemp              bool     `json:"isTemp"`
}

type AddExamQuestionRequest struct {
	QuestionID string  `json:"questionId"`
	Score      float64 `json:"score"`
}

func (h *ExamHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Exams().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListExams(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询考试失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Exam]{Items: items, Total: total})
}

func (h *ExamHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	exam, err := h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if exam.TenantID != nil && (claims.TenantID == nil || *exam.TenantID != *claims.TenantID) {
		respondError(w, http.StatusNotFound, "考试不存在")
		return
	}
	// 学生作答由服务端判分，不返回答案与解析
	if middleware.HasRole(claims, domain.RoleStudent) {
		for i := range exam.Questions {
			exam.Questions[i].Answer = nil
			exam.Questions[i].Analysis = nil
		}
	}
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateExamRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}
	var duration *int
	if req.Duration > 0 {
		duration = &req.Duration
	}

	code, err := h.Service.GenerateEntityCode(r.Context(), "SJ", "exams", tenantID)
	if err != nil {
		respondServerError(w, r, err, "生成考试编码失败")
		return
	}

	exam, err := h.Service.CreateExam(r.Context(), tenantID, &store.ExamCreateParams{
		Code:                code,
		Name:                req.Name,
		Description:         description,
		Duration:            duration,
		CoverImage:          req.CoverImage,
		CollaboratorIDs:     coalesceStringSlice(req.CollaboratorIDs),
		CollaboratorDeptIDs: coalesceStringSlice(req.CollaboratorDeptIDs),
		BatchID:             emptyStrToNil(req.BatchID),
		CreatorID:           claims.UserID,
		IsTemp:              req.IsTemp,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "考试名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "创建考试失败")
		return
	}
	h.clearLandingExamsCache(r, tenantID)
	respondJSON(w, http.StatusCreated, exam)
}

func (h *ExamHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	existing, err := h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if existing.TenantID != nil && !verifyTenantOwnership(w, r, *existing.TenantID) {
		return
	}

	var req CreateExamRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Description == "" {
		req.Description = existing.Description
	}
	if req.Duration == 0 {
		req.Duration = existing.Duration
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	if req.BatchID == nil {
		req.BatchID = existing.BatchID
	}
	collaboratorIDs := req.CollaboratorIDs
	if collaboratorIDs == nil {
		collaboratorIDs = existing.CollaboratorIDs
	}
	collaboratorDeptIDs := req.CollaboratorDeptIDs
	if collaboratorDeptIDs == nil {
		collaboratorDeptIDs = existing.CollaboratorDeptIDs
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}
	var duration *int
	if req.Duration > 0 {
		duration = &req.Duration
	}

	exam, err := h.Service.UpdateExam(r.Context(), tenantID, id, &store.ExamUpdateParams{
		Name:                req.Name,
		Description:         description,
		Duration:            duration,
		CoverImage:          req.CoverImage,
		CollaboratorIDs:     collaboratorIDs,
		CollaboratorDeptIDs: collaboratorDeptIDs,
		BatchID:             emptyStrToNil(req.BatchID),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "考试名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "更新考试失败")
		return
	}
	if existing.TenantID != nil {
		h.clearLandingExamsCache(r, *existing.TenantID)
	}
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	tenantID, err := h.Service.ExamTenantID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if !verifyTenantOwnership(w, r, tenantID) {
		return
	}
	if err := h.Service.DeleteExam(r.Context(), tenantID, id); err != nil {
		respondServerError(w, r, err, "删除考试失败")
		return
	}
	h.clearLandingExamsCache(r, tenantID)
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ExamHandler) AddQuestion(w http.ResponseWriter, r *http.Request) {
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
	exam, err := h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if exam.TenantID != nil && !verifyTenantOwnership(w, r, *exam.TenantID) {
		return
	}

	var req AddExamQuestionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.QuestionID == "" {
		respondError(w, http.StatusBadRequest, "缺少题目ID")
		return
	}

	q, err := h.Service.FetchExamQuestion(r.Context(), tenantID, req.QuestionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "题目不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}

	score := req.Score
	if score == 0 {
		score = q.Score
	}

	if err := h.Service.AddExamQuestion(r.Context(), tenantID, id, q, score); err != nil {
		respondServerError(w, r, err, "添加题目失败")
		return
	}
	exam, err = h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "操作成功但查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, exam)
}

func (h *ExamHandler) RemoveQuestion(w http.ResponseWriter, r *http.Request) {
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
	questionID := chi.URLParam(r, "questionId")
	exam, err := h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if exam.TenantID != nil && !verifyTenantOwnership(w, r, *exam.TenantID) {
		return
	}
	if err := h.Service.RemoveExamQuestion(r.Context(), id, questionID); err != nil {
		respondServerError(w, r, err, "移除题目失败")
		return
	}
	exam, err = h.Service.GetExam(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "操作成功但查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, exam)
}

type UpdateExamQuestionScoreRequest struct {
	Score float64 `json:"score"`
}

func (h *ExamHandler) UpdateQuestionScore(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID := ""
	if claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	examID := chi.URLParam(r, "id")
	questionID := chi.URLParam(r, "questionId")

	var req UpdateExamQuestionScoreRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Score <= 0 {
		respondError(w, http.StatusBadRequest, "分数必须为正数")
		return
	}

	exam, err := h.Service.GetExam(r.Context(), tenantID, examID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if exam.TenantID != nil && !verifyTenantOwnership(w, r, *exam.TenantID) {
		return
	}

	err = h.Service.UpdateExamQuestionScore(r.Context(), examID, questionID, req.Score)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "考试中未找到该题目")
			return
		}
		respondServerError(w, r, err, "更新question score失败")
		return
	}
	exam, err = h.Service.GetExam(r.Context(), tenantID, examID)
	if err != nil {
		respondServerError(w, r, err, "操作成功但查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, exam)
}

type BulkUpdateScoresRequest map[string]float64

func (h *ExamHandler) BulkUpdateScores(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID := ""
	if claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	examID := chi.URLParam(r, "id")
	var req BulkUpdateScoresRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req) == 0 {
		respondError(w, http.StatusBadRequest, "分数映射不能为空")
		return
	}
	for _, score := range req {
		if score <= 0 {
			respondError(w, http.StatusBadRequest, "分数必须为正数")
			return
		}
	}
	exam, err := h.Service.GetExam(r.Context(), tenantID, examID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if exam.TenantID != nil && !verifyTenantOwnership(w, r, *exam.TenantID) {
		return
	}
	if err := h.Service.BulkUpdateExamScores(r.Context(), examID, req); err != nil {
		respondServerError(w, r, err, "批量更新分数失败")
		return
	}
	exam, err = h.Service.GetExam(r.Context(), tenantID, examID)
	if err != nil {
		respondServerError(w, r, err, "操作成功但查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, exam)
}

// ===== Cache =====

func (h *ExamHandler) clearLandingExamsCache(r *http.Request, tenantID string) {
	cache.InvalidatePrefix(r.Context(), h.RedisClient, "zhiyu:"+tenantID+":landing:exams")
}

// actions 与状态流转
func (h *ExamHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.Store(),
		table:      "exams",
		entityName: "exam",
		targetType: "exam",
		inviteCol:  "collaborator_ids",
		invalidate: h.clearLandingExamsCache,
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			// 状态流转前的 checkTenantAccess 已完成租户归属校验，
			// 回读时从上下文 claims 取租户保持 SQL 级租户限定
			claims, _ := ctx.Value(middleware.ContextKeyUser).(*middleware.Claims)
			return h.Service.GetExam(ctx, tenantIDOf(claims), id)
		},
	}
}

func (h *ExamHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *ExamHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *ExamHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *ExamHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *ExamHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ExamHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ExamHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *ExamHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}
