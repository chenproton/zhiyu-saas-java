package handler

import (
	"context"
	"errors"
	"log/slog"
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

type CourseHandler struct {
	Service *service.LessonContentService
	DB      *pgxpool.Pool
}

type CourseListResponse struct {
	Items []domain.Course `json:"items"`
	Total int             `json:"total"`
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

	cfg := store.ListQueryConfig[domain.Course]{
		Table: "courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id",
		SelectColumns: `c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version, c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name, c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description, c.knowledge_point_ids::text[] AS knowledge_point_ids, c.ability_point_ids::text[] AS ability_point_ids, c.resource_ids::text[] AS resource_ids, c.eval_data, c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name, c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count, COALESCE(vc.cnt, 0) AS view_count, c.study_count, c.created_at, c.updated_at`,
		TenantScoped:  true,
		TenantColumn:  "c.tenant_id",
		SearchColumns: []string{"c.name", "c.code"},
		SearchParam:   "search",
		OrderBy:       "c.created_at DESC",
		DefaultLimit:  50,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			courseType := p.Values["type"]
			category := p.Values["category"]
			status := p.Values["status"]
			batchID := p.Values["batchId"]
			if courseType != "" {
				qb.AddCondition("c.type = " + qb.NextArg(courseType))
			}
			if category != "" {
				qb.AddCondition("c.category = " + qb.NextArg(category))
			}
			if status != "" {
				qb.AddCondition("c.status = " + qb.NextArg(status))
			}
			if batchID != "" {
				qb.AddCondition("c.batch_id = " + qb.NextArg(batchID))
			}
		},
		ScanRows: store.ScanCourseRows,
	}

	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListCourses(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询课程列表失败")
		return
	}

	respondJSON(w, http.StatusOK, CourseListResponse{Items: items, Total: total})
}

func (h *CourseHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	course, err := h.Service.GetCourseDetail(r.Context(), id)
	if err != nil {
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
		v := "v1.0"
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

	code, err := store.GenerateUniqueEntityCode(r.Context(), h.Service.Queryer(), prefix, "courses", tenantID)
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
		respondError(w, http.StatusInternalServerError, "创建课程失败")
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

	id := chi.URLParam(r, "id")
	existing, err := h.fetchCourse(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	var req UpdateCourseRequest
	if !decodeBody(w, r, &req) {
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
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
		respondError(w, http.StatusInternalServerError, "更新课程失败")
		return
	}
	respondJSON(w, http.StatusOK, course)
}

func (h *CourseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCourse(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	if err := h.Service.DeleteCourse(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除课程失败")
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
	h.actions().transitionWithHook(w, r, domain.StatusPublished, func(tx pgx.Tx, id string) error {
		return h.Service.GenerateCourseAssessments(r.Context(), store.NewWithTx(tx), id)
	})
}

// Assessments GET /api/v1/lesson/courses/{id}/assessments
// 返回课程已生成的测评资源列表（考试安排 + 课程作业）。
func (h *CourseHandler) Assessments(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	courseID := chi.URLParam(r, "id")

	_, err := h.fetchCourse(r.Context(), courseID)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}
	if !verifyTenantOwnership(w, r, *claims.TenantID) {
		return
	}

	exams, err := h.Service.ListCourseExamUsages(r.Context(), courseID, *claims.TenantID)
	if err != nil {
		slog.Error("查询课程考试安排失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询课程测评失败")
		return
	}

	homeworks, err := h.Service.ListCourseHomeworks(r.Context(), courseID, *claims.TenantID)
	if err != nil {
		slog.Error("查询课程作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询课程测评失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"exams":     exams,
		"homeworks": homeworks,
	})
}

func (h *CourseHandler) SubmitHomework(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	courseID := chi.URLParam(r, "id")
	homeworkID := chi.URLParam(r, "homeworkId")

	var req struct {
		Content         string   `json:"content"`
		AttachmentUrls  []string `json:"attachmentUrls"`
	}
	if !decodeBody(w, r, &req) {
		return
	}

	exists, err := h.Service.CourseHomeworkExists(r.Context(), homeworkID, courseID, *claims.TenantID)
	if err != nil || !exists {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	submissionID, err := h.Service.SubmitCourseHomework(r.Context(), *claims.TenantID, courseID, homeworkID, claims.UserID, req.Content, req.AttachmentUrls)
	if err != nil {
		slog.Error("提交课程作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "提交作业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": submissionID, "status": "submitted"})
}

// ListHomeworkSubmissions GET /api/v1/lesson/courses/{id}/homeworks/{homeworkId}/submissions
func (h *CourseHandler) ListHomeworkSubmissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	courseID := chi.URLParam(r, "id")
	homeworkID := chi.URLParam(r, "homeworkId")

	subs, err := h.Service.ListCourseHomeworkSubmissions(r.Context(), *claims.TenantID, courseID, homeworkID)
	if err != nil {
		slog.Error("查询课程作业提交失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	items := make([]map[string]any, 0, len(subs))
	for _, s := range subs {
		item := map[string]any{
			"id": s.ID, "studentId": s.StudentID, "studentName": s.StudentName,
			"content": s.Content, "attachmentUrls": s.AttachmentURLs,
			"status": s.Status, "comment": s.Comment,
		}
		if s.Score != nil {
			item["score"] = *s.Score
		}
		if s.TotalScore != nil {
			item["totalScore"] = *s.TotalScore
		}
		if s.CreatedAt != nil {
			item["createdAt"] = s.CreatedAt.Format(time.RFC3339)
		}
		if s.GradedAt != nil {
			item["gradedAt"] = s.GradedAt.Format(time.RFC3339)
		}
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

// GradeHomeworkSubmission POST /api/v1/lesson/courses/{id}/homeworks/{homeworkId}/submissions/{submissionId}/grade
func (h *CourseHandler) GradeHomeworkSubmission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	courseID := chi.URLParam(r, "id")
	homeworkID := chi.URLParam(r, "homeworkId")
	submissionID := chi.URLParam(r, "submissionId")

	var req struct {
		Score   float64 `json:"score"`
		Comment string  `json:"comment"`
	}
	if !decodeBody(w, r, &req) {
		return
	}

	err := h.Service.GradeCourseHomework(r.Context(), claims.UserID, *claims.TenantID, courseID, homeworkID, submissionID, req.Score, req.Comment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "提交记录不存在")
			return
		}
		slog.Error("批改课程作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "批改失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": submissionID, "status": "graded"})
}

// SubmitNodeHomework POST /api/v1/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submit
func (h *CourseHandler) SubmitNodeHomework(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	nodeID := chi.URLParam(r, "nodeId")
	homeworkID := chi.URLParam(r, "homeworkId")

	var req struct {
		Content        string   `json:"content"`
		AttachmentUrls []string `json:"attachmentUrls"`
	}
	if !decodeBody(w, r, &req) {
		return
	}

	exists, err := h.Service.NodeHomeworkExists(r.Context(), homeworkID, nodeID, *claims.TenantID)
	if err != nil || !exists {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	submissionID, err := h.Service.SubmitNodeHomework(r.Context(), *claims.TenantID, nodeID, homeworkID, claims.UserID, req.Content, req.AttachmentUrls)
	if err != nil {
		slog.Error("提交节点作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "提交作业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": submissionID, "status": "submitted"})
}

// ListNodeHomeworkSubmissions GET /api/v1/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submissions
func (h *CourseHandler) ListNodeHomeworkSubmissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	nodeID := chi.URLParam(r, "nodeId")
	homeworkID := chi.URLParam(r, "homeworkId")

	subs, err := h.Service.ListNodeHomeworkSubmissions(r.Context(), *claims.TenantID, nodeID, homeworkID)
	if err != nil {
		slog.Error("查询节点作业提交失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	items := make([]map[string]any, 0, len(subs))
	for _, s := range subs {
		item := map[string]any{
			"id": s.ID, "studentId": s.StudentID, "studentName": s.StudentName,
			"content": s.Content, "attachmentUrls": s.AttachmentURLs,
			"status": s.Status, "comment": s.Comment,
		}
		if s.Score != nil {
			item["score"] = *s.Score
		}
		if s.TotalScore != nil {
			item["totalScore"] = *s.TotalScore
		}
		if s.CreatedAt != nil {
			item["createdAt"] = s.CreatedAt.Format(time.RFC3339)
		}
		if s.GradedAt != nil {
			item["gradedAt"] = s.GradedAt.Format(time.RFC3339)
		}
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

// GradeNodeHomeworkSubmission POST /api/v1/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submissions/{submissionId}/grade
func (h *CourseHandler) GradeNodeHomeworkSubmission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	nodeID := chi.URLParam(r, "nodeId")
	homeworkID := chi.URLParam(r, "homeworkId")
	submissionID := chi.URLParam(r, "submissionId")

	var req struct {
		Score   float64 `json:"score"`
		Comment string  `json:"comment"`
	}
	if !decodeBody(w, r, &req) {
		return
	}

	err := h.Service.GradeNodeHomework(r.Context(), claims.UserID, *claims.TenantID, nodeID, homeworkID, submissionID, req.Score, req.Comment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "提交记录不存在")
			return
		}
		slog.Error("批改节点作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "批改失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": submissionID, "status": "graded"})
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

