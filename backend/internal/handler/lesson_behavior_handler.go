package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// LessonBehaviorAggregate 别名（唯一出处：service.LessonBehaviorService）。
type LessonBehaviorAggregate = service.LessonBehaviorAggregate

// SignInSummary 别名（唯一出处：service.LessonBehaviorService）。
type SignInSummary = service.SignInSummary

// CreateLessonBehaviorRequest 别名（唯一出处：service.LessonBehaviorService）。
type CreateLessonBehaviorRequest = service.CreateLessonBehaviorRequest

type LessonBehaviorHandler struct {
	Service *service.LessonContentService
	Svc     *service.LessonBehaviorService
}

func (h *LessonBehaviorHandler) Aggregate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	courseID := r.URL.Query().Get("courseId")
	if courseID == "" {
		respondJSON(w, http.StatusOK, LessonBehaviorAggregate{
			SignIn: SignInSummary{},
		})
		return
	}
	if _, err := h.Service.Store().Courses().Get(r.Context(), courseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")

	records, err := h.Service.ListLessonBehaviorRecords(r.Context(), tenantID, courseID, startDate, endDate)
	if err != nil {
		respondServerError(w, r, err, "加载behavior records失败")
		return
	}

	respondJSON(w, http.StatusOK, h.Svc.BuildAggregate(records))
}

func (h *LessonBehaviorHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateLessonBehaviorRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || req.StudentUserID == "" {
		respondError(w, http.StatusBadRequest, "缺少课程ID或学生用户ID")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if _, err := h.Service.Store().Courses().Get(r.Context(), req.CourseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}
	student, err := h.Service.Store().Users().Get(r.Context(), tenantID, req.StudentUserID)
	if err != nil || student.TenantID == nil || *student.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "学生不存在")
		return
	}

	record, err := h.Service.UpsertLessonBehavior(r.Context(), tenantID, &store.LessonBehaviorUpsertParams{
		CourseID: req.CourseID, StudentUserID: req.StudentUserID, RecordDate: req.RecordDate,
		Attendance: req.Attendance, QuizScore: req.QuizScore, InteractionCount: req.InteractionCount,
		PraiseCount: req.PraiseCount, RushCorrectCount: req.RushCorrectCount, RushAvgTimeSec: req.RushAvgTimeSec,
	})
	if err != nil {
		respondServerError(w, r, err, "保存behavior record失败")
		return
	}
	respondJSON(w, http.StatusCreated, record)
}
