package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CourseHandler struct {
	Service *service.LessonContentService
}

type CreateCourseRequest struct {
	Code              string           `json:"code"`
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	Category          string           `json:"category"`
	MajorID           *string          `json:"majorId"`
	TeacherID         *string          `json:"teacherId"`
	IndustryID        *string          `json:"industryId"`
	Version           *string          `json:"version"`
	OnlineHours       *float64         `json:"onlineHours"`
	OfflineHours      *float64         `json:"offlineHours"`
	OnlineWeight      *float64         `json:"onlineWeight"`
	OfflineWeight     *float64         `json:"offlineWeight"`
	Semester          *string          `json:"semester"`
	ClassName         *string          `json:"className"`
	CoverColor        *string          `json:"coverColor"`
	CoverImage        *string          `json:"coverImage"`
	CourseTag         *string          `json:"courseTag"`
	Difficulty        *int             `json:"difficulty"`
	Description       *string          `json:"description"`
	KnowledgePointIds domain.JSONSlice `json:"knowledgePointIds"`
	AbilityPointIds   domain.JSONSlice `json:"abilityPointIds"`
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	CoCreatorIds      domain.JSONSlice `json:"coCreatorIds"`
	BatchID           *string          `json:"batchId"`
	EvalData          domain.JSONMap   `json:"evalData"`
}

type UpdateCourseRequest struct {
	Code              string           `json:"code"`
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	Category          string           `json:"category"`
	MajorID           *string          `json:"majorId"`
	TeacherID         *string          `json:"teacherId"`
	IndustryID        *string          `json:"industryId"`
	Version           *string          `json:"version"`
	OnlineHours       *float64         `json:"onlineHours"`
	OfflineHours      *float64         `json:"offlineHours"`
	OnlineWeight      *float64         `json:"onlineWeight"`
	OfflineWeight     *float64         `json:"offlineWeight"`
	Semester          *string          `json:"semester"`
	ClassName         *string          `json:"className"`
	CoverColor        *string          `json:"coverColor"`
	CoverImage        *string          `json:"coverImage"`
	CourseTag         *string          `json:"courseTag"`
	Difficulty        *int             `json:"difficulty"`
	Description       *string          `json:"description"`
	KnowledgePointIds domain.JSONSlice `json:"knowledgePointIds"`
	AbilityPointIds   domain.JSONSlice `json:"abilityPointIds"`
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	CoCreatorIds      domain.JSONSlice `json:"coCreatorIds"`
	BatchID           *string          `json:"batchId"`
	EvalData          domain.JSONMap   `json:"evalData"`
}

func (h *CourseHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().Courses().ListConfig()

	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	// 学生列表仅见已发布课程（越权加固 A3）；教师/管理员列表语义不变
	if middleware.HasRole(middleware.CurrentUser(r), domain.RoleStudent) {
		params.Values["status"] = string(domain.StatusPublished)
	}
	items, total, err := h.Service.ListCourses(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询课程列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.Course]{Items: items, Total: total})
}

func (h *CourseHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	course, err := h.Service.GetCourseDetailInTenant(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "课程不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	// 学生仅可读已发布课程（决策 7：draft 对学生不可见）
	if middleware.HasRole(middleware.CurrentUser(r), domain.RoleStudent) && course.Status != domain.StatusPublished {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}
	respondJSON(w, http.StatusOK, course)
}

func (h *CourseHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateCourseRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if req.Version == nil || *req.Version == "" {
		v := "V1.0"
		req.Version = &v
	}

	prefix := "XT"
	if req.Type == "granular" {
		prefix = "KL"
	}
	if req.CoCreatorIds == nil {
		req.CoCreatorIds = domain.JSONSlice{}
	}
	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	apIDs := jsonSliceToUUIDSlice(req.AbilityPointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	coIDs := jsonSliceToUUIDSlice(req.CoCreatorIds)
	if req.EvalData == nil {
		req.EvalData = domain.JSONMap{}
	}

	code, err := h.Service.GenerateEntityCode(r.Context(), prefix, "courses", tenantID)
	if err != nil {
		respondServerError(w, r, err, "生成课程代码失败")
		return
	}

	course, err := h.Service.CreateCourse(r.Context(), tenantID, &store.CourseCreateParams{
		Code:              code,
		Name:              req.Name,
		Type:              req.Type,
		Category:          req.Category,
		MajorID:           req.MajorID,
		TeacherID:         req.TeacherID,
		IndustryID:        req.IndustryID,
		Version:           req.Version,
		OnlineHours:       req.OnlineHours,
		OfflineHours:      req.OfflineHours,
		OnlineWeight:      req.OnlineWeight,
		OfflineWeight:     req.OfflineWeight,
		Semester:          req.Semester,
		ClassName:         req.ClassName,
		CoverColor:        req.CoverColor,
		CoverImage:        req.CoverImage,
		CourseTag:         req.CourseTag,
		Difficulty:        req.Difficulty,
		Description:       req.Description,
		CreatorID:         claims.UserID,
		CoCreatorIds:      coIDs,
		BatchID:           emptyStrToNil(req.BatchID),
		KnowledgePointIds: kpIDs,
		AbilityPointIds:   apIDs,
		ResourceIds:       resIDs,
		EvalData:          req.EvalData,
	})
	if err != nil {
		slog.Error("创建课程失败", "error", err)
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "课程代码已存在，请使用其他代码")
			return
		}
		respondServerError(w, r, err, "创建课程失败")
		return
	}
	respondJSON(w, http.StatusCreated, course)
}

func (h *CourseHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	existing, err := h.Service.GetCourseDetailInTenant(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "课程不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}

	var req UpdateCourseRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Type == "" {
		req.Type = existing.Type
	}
	if req.Category == "" {
		req.Category = existing.Category
	}

	if req.MajorID == nil {
		req.MajorID = existing.MajorID
	}
	if req.TeacherID == nil {
		req.TeacherID = existing.TeacherID
	}
	if req.IndustryID == nil {
		req.IndustryID = existing.IndustryID
	}
	if req.Version == nil || *req.Version == "" {
		req.Version = existing.Version
	}
	if req.OnlineHours == nil {
		req.OnlineHours = existing.OnlineHours
	}
	if req.OfflineHours == nil {
		req.OfflineHours = existing.OfflineHours
	}
	if req.OnlineWeight == nil {
		req.OnlineWeight = existing.OnlineWeight
	}
	if req.OfflineWeight == nil {
		req.OfflineWeight = existing.OfflineWeight
	}
	if req.Semester == nil {
		req.Semester = existing.Semester
	}
	if req.ClassName == nil {
		req.ClassName = existing.ClassName
	}
	if req.CoverColor == nil {
		req.CoverColor = existing.CoverColor
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	if req.CourseTag == nil {
		req.CourseTag = existing.CourseTag
	}
	if req.Difficulty == nil {
		req.Difficulty = existing.Difficulty
	}
	if req.Description == nil {
		req.Description = existing.Description
	}
	batchID := req.BatchID
	if batchID == nil {
		batchID = existing.BatchID
	}

	if req.CoCreatorIds == nil {
		req.CoCreatorIds = existing.CoCreatorIds
	}

	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	apIDs := jsonSliceToUUIDSlice(req.AbilityPointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	if req.KnowledgePointIds == nil {
		kpIDs = jsonSliceToUUIDSlice(existing.KnowledgePointIds)
	}
	if req.AbilityPointIds == nil {
		apIDs = jsonSliceToUUIDSlice(existing.AbilityPointIds)
	}
	if req.ResourceIds == nil {
		resIDs = jsonSliceToUUIDSlice(existing.ResourceIds)
	}
	if req.EvalData == nil {
		req.EvalData = existing.EvalData
	}

	replaceBindings := req.KnowledgePointIds != nil || req.ResourceIds != nil
	course, err := h.Service.UpdateCourse(r.Context(), id, tenantID, claims.UserID, &store.CourseUpdateParams{
		Name:              req.Name,
		Type:              req.Type,
		Category:          req.Category,
		MajorID:           req.MajorID,
		TeacherID:         req.TeacherID,
		IndustryID:        req.IndustryID,
		Version:           req.Version,
		OnlineHours:       req.OnlineHours,
		OfflineHours:      req.OfflineHours,
		OnlineWeight:      req.OnlineWeight,
		OfflineWeight:     req.OfflineWeight,
		Semester:          req.Semester,
		ClassName:         req.ClassName,
		CoverColor:        req.CoverColor,
		CoverImage:        req.CoverImage,
		CourseTag:         req.CourseTag,
		Difficulty:        req.Difficulty,
		Description:       req.Description,
		CoCreatorIds:      jsonSliceToUUIDSlice(req.CoCreatorIds),
		BatchID:           emptyStrToNil(batchID),
		KnowledgePointIds: kpIDs,
		AbilityPointIds:   apIDs,
		ResourceIds:       resIDs,
		EvalData:          req.EvalData,
	}, replaceBindings, kpIDs, resIDs)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "课程代码已存在，请使用其他代码")
			return
		}
		respondServerError(w, r, err, "更新课程失败")
		return
	}
	respondJSON(w, http.StatusOK, course)
}

func (h *CourseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCourseDetailInTenant(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	if err := h.Service.DeleteCourse(r.Context(), id, tenantID); err != nil {
		if errors.Is(err, store.ErrResourceInUse) {
			respondError(w, http.StatusConflict, "该课程已存在测评成绩，无法删除")
			return
		}
		respondServerError(w, r, err, "删除课程失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.Store(),
		table:      "courses",
		entityName: "course",
		targetType: "course",
		inviteCol:  "co_creator_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchCourse(ctx, id)
		},
	}
}

func (h *CourseHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *CourseHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *CourseHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *CourseHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transitionWithHook(w, r, domain.StatusPublished, func(txStore *store.Store, id string) error {
		return h.Service.GenerateCourseAssessments(r.Context(), txStore, id)
	})
}

func (h *CourseHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *CourseHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *CourseHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *CourseHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *CourseHandler) fetchCourse(ctx context.Context, id string) (*domain.Course, error) {
	return h.Service.GetCourseDetail(ctx, id)
}
