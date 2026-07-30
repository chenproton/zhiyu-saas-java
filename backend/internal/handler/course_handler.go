package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseHandler struct {
	DB *pgxpool.Pool
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

	cfg := listQueryConfig[domain.Course]{
		Table: "courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id",
		SelectColumns: `c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version, c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name, c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description, c.knowledge_point_ids::text[] AS knowledge_point_ids, c.ability_point_ids::text[] AS ability_point_ids, c.resource_ids::text[] AS resource_ids, c.eval_data, c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name, c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count, COALESCE(vc.cnt, 0) AS view_count, c.study_count, c.created_at, c.updated_at`,
		TenantScoped:  true,
		TenantColumn:  "c.tenant_id",
		SearchColumns: []string{"c.name", "c.code"},
		SearchParam:   "search",
		OrderBy:       "c.created_at DESC",
		DefaultLimit:  50,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			courseType := r.URL.Query().Get("type")
			category := r.URL.Query().Get("category")
			status := r.URL.Query().Get("status")
			batchID := r.URL.Query().Get("batchId")
			if courseType != "" {
				qb.addCondition("c.type = " + qb.nextArg(courseType))
			}
			if category != "" {
				qb.addCondition("c.category = " + qb.nextArg(category))
			}
			if status != "" {
				qb.addCondition("c.status = " + qb.nextArg(status))
			}
			if batchID != "" {
				qb.addCondition("c.batch_id = " + qb.nextArg(batchID))
			}
		},
		ScanRows: h.scanCourseRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询课程列表失败")
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
	course, err := h.fetchCourse(r.Context(), id)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
	code, err := generateUniqueEntityCode(r.Context(), h.DB, prefix, "courses", tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成课程代码失败")
		return
	}

	id := uuid.NewString()
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
	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18, $19, $20, $21, $22, $23::uuid[], $24, $25::uuid[], $26::uuid[], $27::uuid[], $28, 0, 0, 0)
	`, id, tenantID, code, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, req.Difficulty, req.Description, claims.UserID, coIDs, emptyStrToNil(req.BatchID),
		kpIDs, apIDs, resIDs, req.EvalData)
	if err != nil {
		slog.Error("创建课程失败", "error", err)
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "课程代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建课程失败")
		return
	}

	h.replaceCourseBindings(r.Context(), id, tenantID, claims.UserID, kpIDs, resIDs)

	course, _ := h.fetchCourse(r.Context(), id)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	_, err = h.DB.Exec(r.Context(), `
		UPDATE courses SET name = $1, type = $2, category = $3, major_id = $4, teacher_id = $5,
			industry_id = $6, version = $7, online_hours = $8, offline_hours = $9, online_weight = $10,
			offline_weight = $11, semester = $12, class_name = $13, cover_color = $14, cover_image = $15,
			course_tag = $16, difficulty = $17, description = $18, co_creator_ids = $19, batch_id = $20,
			knowledge_point_ids = $21, ability_point_ids = $22, resource_ids = $23, eval_data = $24,
			resource_count = COALESCE(array_length($23::uuid[], 1), 0), updated_at = NOW()
		WHERE id = $25
	`, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, req.Difficulty, req.Description, req.CoCreatorIds, emptyStrToNil(batchID),
		kpIDs, apIDs, resIDs, req.EvalData, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "课程代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新课程失败")
		return
	}

	if req.KnowledgePointIds != nil || req.ResourceIds != nil {
		h.replaceCourseBindings(r.Context(), id, tenantID, claims.UserID, kpIDs, resIDs)
	}

	course, _ := h.fetchCourse(r.Context(), id)
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

	_, err := h.DB.Exec(r.Context(), `DELETE FROM courses WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除课程失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
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
		return h.generateCourseAssessments(r.Context(), tx, id)
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

	exams, err := h.listCourseExamUsages(r.Context(), courseID, *claims.TenantID)
	if err != nil {
		slog.Error("查询课程考试安排失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询课程测评失败")
		return
	}

	homeworks, err := h.listCourseHomeworks(r.Context(), courseID, *claims.TenantID)
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

func (h *CourseHandler) listCourseExamUsages(ctx context.Context, courseID, tenantID string) ([]map[string]interface{}, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT eu.id, eu.exam_id, e.name AS exam_name, e.is_temp, eu.name, eu.start_time, eu.end_time, eu.duration, eu.status
		FROM exam_usages eu
		JOIN exams e ON e.id = eu.exam_id
		WHERE eu.tenant_id = $1 AND eu.target_type = 'course' AND $2 = ANY(eu.target_ids)
		ORDER BY eu.created_at ASC
	`, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, examID, examName, name, status string
		var isTemp bool
		var startTime, endTime *time.Time
		var duration *int
		if err := rows.Scan(&id, &examID, &examName, &isTemp, &name, &startTime, &endTime, &duration, &status); err != nil {
			return nil, err
		}
		item := map[string]interface{}{
			"id":        id,
			"examId":    examID,
			"examName":  examName,
			"isTemp":    isTemp,
			"name":      name,
			"duration":  duration,
			"status":    status,
			"type":      "exam",
		}
		if startTime != nil {
			item["startTime"] = startTime.Format(time.RFC3339)
		}
		if endTime != nil {
			item["endTime"] = endTime.Format(time.RFC3339)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *CourseHandler) listCourseHomeworks(ctx context.Context, courseID, tenantID string) ([]map[string]interface{}, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, title, requirement, need_attachment, deadline, status
		FROM course_homeworks
		WHERE tenant_id = $1 AND course_id = $2
		ORDER BY created_at ASC
	`, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, title, requirement, status string
		var needAttachment bool
		var deadline *time.Time
		if err := rows.Scan(&id, &title, &requirement, &needAttachment, &deadline, &status); err != nil {
			return nil, err
		}
		item := map[string]interface{}{
			"id":            id,
			"title":         title,
			"requirement":   requirement,
			"needAttachment": needAttachment,
			"status":        status,
			"type":          "homework",
		}
		if deadline != nil {
			item["deadline"] = deadline.Format(time.RFC3339)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// SubmitHomework POST /api/v1/lesson/courses/{id}/homeworks/{homeworkId}/submit
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	var exists bool
	err := h.DB.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM course_homeworks WHERE id = $1 AND course_id = $2 AND tenant_id = $3)
	`, homeworkID, courseID, *claims.TenantID).Scan(&exists)
	if err != nil || !exists {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	var submissionID string
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO course_homework_submissions (tenant_id, course_id, homework_id, student_id, content, attachment_urls, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
		ON CONFLICT (homework_id, student_id)
		DO UPDATE SET content = EXCLUDED.content, attachment_urls = EXCLUDED.attachment_urls, status = 'submitted', updated_at = NOW()
		RETURNING id
	`, *claims.TenantID, courseID, homeworkID, claims.UserID, req.Content, req.AttachmentUrls).Scan(&submissionID)
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

	rows, err := h.DB.Query(r.Context(), `
		SELECT s.id, s.student_id, COALESCE(u.name, ''), s.content, s.attachment_urls, s.status, s.score, s.total_score, s.comment, s.created_at, s.graded_at
		FROM course_homework_submissions s
		JOIN users u ON u.id = s.student_id
		WHERE s.tenant_id = $1 AND s.course_id = $2 AND s.homework_id = $3
		ORDER BY s.created_at DESC
	`, *claims.TenantID, courseID, homeworkID)
	if err != nil {
		slog.Error("查询课程作业提交失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, studentID, studentName, content, status, comment string
		var score, totalScore *float64
		var attachmentUrls []string
		var createdAt, gradedAt *time.Time
		if err := rows.Scan(&id, &studentID, &studentName, &content, &attachmentUrls, &status, &score, &totalScore, &comment, &createdAt, &gradedAt); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id":            id,
			"studentId":     studentID,
			"studentName":   studentName,
			"content":       content,
			"attachmentUrls": attachmentUrls,
			"status":        status,
			"comment":       comment,
		}
		if score != nil {
			item["score"] = *score
		}
		if totalScore != nil {
			item["totalScore"] = *totalScore
		}
		if createdAt != nil {
			item["createdAt"] = createdAt.Format(time.RFC3339)
		}
		if gradedAt != nil {
			item["gradedAt"] = gradedAt.Format(time.RFC3339)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	var studentID string
	var totalScore float64
	err := h.DB.QueryRow(r.Context(), `
		UPDATE course_homework_submissions
		SET score = $1, comment = $2, status = 'graded', graded_at = NOW(), graded_by = $3
		WHERE id = $4 AND tenant_id = $5 AND course_id = $6 AND homework_id = $7
		RETURNING student_id, COALESCE(total_score, 100)
	`, req.Score, req.Comment, claims.UserID, submissionID, *claims.TenantID, courseID, homeworkID).Scan(&studentID, &totalScore)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "提交记录不存在")
			return
		}
		slog.Error("批改课程作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "批改失败")
		return
	}

	// 同步到课程统一评价结果表，参与能力汇聚
	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO course_evaluation_results (tenant_id, course_id, method_key, evaluatee_id, status, total_score, max_score)
		VALUES ($1, $2, 'homework', $3, 'evaluated', $4, $5)
		ON CONFLICT (tenant_id, course_id, evaluatee_id, method_key)
		DO UPDATE SET total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score, status = 'evaluated', graded_at = NOW(), updated_at = NOW()
	`, *claims.TenantID, courseID, studentID, req.Score, totalScore)

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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	var exists bool
	err := h.DB.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE id = $1 AND node_id = $2 AND tenant_id = $3)
	`, homeworkID, nodeID, *claims.TenantID).Scan(&exists)
	if err != nil || !exists {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	var submissionID string
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO node_homework_submissions (tenant_id, node_id, homework_id, student_id, content, attachment_urls, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
		ON CONFLICT (homework_id, student_id)
		DO UPDATE SET content = EXCLUDED.content, attachment_urls = EXCLUDED.attachment_urls, status = 'submitted', updated_at = NOW()
		RETURNING id
	`, *claims.TenantID, nodeID, homeworkID, claims.UserID, req.Content, req.AttachmentUrls).Scan(&submissionID)
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

	rows, err := h.DB.Query(r.Context(), `
		SELECT s.id, s.student_id, COALESCE(u.name, ''), s.content, s.attachment_urls, s.status, s.score, s.total_score, s.comment, s.created_at, s.graded_at
		FROM node_homework_submissions s
		JOIN users u ON u.id = s.student_id
		WHERE s.tenant_id = $1 AND s.node_id = $2 AND s.homework_id = $3
		ORDER BY s.created_at DESC
	`, *claims.TenantID, nodeID, homeworkID)
	if err != nil {
		slog.Error("查询节点作业提交失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询失败")
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, studentID, studentName, content, status, comment string
		var score, totalScore *float64
		var attachmentUrls []string
		var createdAt, gradedAt *time.Time
		if err := rows.Scan(&id, &studentID, &studentName, &content, &attachmentUrls, &status, &score, &totalScore, &comment, &createdAt, &gradedAt); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id":             id,
			"studentId":      studentID,
			"studentName":    studentName,
			"content":        content,
			"attachmentUrls": attachmentUrls,
			"status":         status,
			"comment":        comment,
		}
		if score != nil {
			item["score"] = *score
		}
		if totalScore != nil {
			item["totalScore"] = *totalScore
		}
		if createdAt != nil {
			item["createdAt"] = createdAt.Format(time.RFC3339)
		}
		if gradedAt != nil {
			item["gradedAt"] = gradedAt.Format(time.RFC3339)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	var studentID string
	var totalScore float64
	err := h.DB.QueryRow(r.Context(), `
		UPDATE node_homework_submissions
		SET score = $1, comment = $2, status = 'graded', graded_at = NOW(), graded_by = $3
		WHERE id = $4 AND tenant_id = $5 AND node_id = $6 AND homework_id = $7
		RETURNING student_id, COALESCE(total_score, 100)
	`, req.Score, req.Comment, claims.UserID, submissionID, *claims.TenantID, nodeID, homeworkID).Scan(&studentID, &totalScore)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "提交记录不存在")
			return
		}
		slog.Error("批改节点作业失败", "error", err)
		respondError(w, http.StatusInternalServerError, "批改失败")
		return
	}

	// 同步到节点统一评价结果表
	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score, comment, graded_at, graded_by)
		VALUES ($1, $2, 'homework', $3, 'evaluated', $4, $5, $6, NOW(), $7)
		ON CONFLICT (tenant_id, node_id, evaluatee_id, method_key)
		DO UPDATE SET total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score, status = 'evaluated', comment = EXCLUDED.comment, graded_at = NOW(), graded_by = EXCLUDED.graded_by, updated_at = NOW()
	`, *claims.TenantID, nodeID, studentID, req.Score, totalScore, req.Comment, claims.UserID)

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
	var c domain.Course
	err := h.DB.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description,
			c.knowledge_point_ids::text[] AS knowledge_point_ids,
			c.ability_point_ids::text[] AS ability_point_ids,
			c.resource_ids::text[] AS resource_ids,
			c.eval_data,
			c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			COALESCE(vc.cnt, 0) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
		&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
		&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
		&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
		&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (h *CourseHandler) scanCourseRows(rows pgx.Rows) ([]domain.Course, error) {
	items := make([]domain.Course, 0)
	for rows.Next() {
		var c domain.Course
		if err := rows.Scan(
			&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
			&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
			&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
			&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
			&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, nil
}

func jsonSliceToUUIDSlice(ids domain.JSONSlice) []string {
	out := make([]string, 0, len(ids))
	for _, v := range ids {
		s, ok := v.(string)
		if !ok || s == "" || strings.HasPrefix(s, "kp-custom-") {
			continue
		}
		out = append(out, s)
	}
	return out
}

func (h *CourseHandler) replaceCourseBindings(ctx context.Context, courseID, tenantID, userID string, kpIDs, resIDs []string) {
	_, _ = h.DB.Exec(ctx, `DELETE FROM course_knowledge_bindings WHERE course_id = $1 AND bind_type = 'course'`, courseID)
	_, _ = h.DB.Exec(ctx, `DELETE FROM course_resource_bindings WHERE course_id = $1`, courseID)

	for _, kpID := range kpIDs {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1, $2, $3, $4, 'course', NULL)
			ON CONFLICT (course_id, knowledge_point_id, bind_type, source_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, kpID)
	}

	for _, resID := range resIDs {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (course_id, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, resID)
	}

	h.syncKnowledgePointGranularLessons(ctx, tenantID, courseID, kpIDs)
}

// syncKnowledgePointGranularLessons 维护知识点对当前颗粒课的双向引用：
// 将 courseID 加入所有关联知识点的 granular_lesson_ids，并从已移除关联的知识点中删除。
func (h *CourseHandler) syncKnowledgePointGranularLessons(ctx context.Context, tenantID, courseID string, kpIDs []string) {
	if tenantID == "" {
		return
	}
	// 添加新关联
	_, _ = h.DB.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_append(granular_lesson_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT $1 = ANY(granular_lesson_ids)
	`, courseID, tenantID, kpIDs)
	// 移除旧关联
	_, _ = h.DB.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_remove(granular_lesson_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1 = ANY(granular_lesson_ids)
	`, courseID, tenantID, kpIDs)
}


// generateCourseAssessments 在课程发布时为 system 课程生成测评资源。
// 体系课测评已下放到节点：遍历 system_course_nodes，对每个含 eval_data.evalRuleConfig 的节点生成 exam_usages / node_homeworks。
func (h *CourseHandler) generateCourseAssessments(ctx context.Context, tx pgx.Tx, courseID string) error {
	var courseType, courseName, tenantID, creatorID string
	err := tx.QueryRow(ctx, `
		SELECT c.type, c.name, c.tenant_id, c.creator_id
		FROM courses c
		WHERE c.id = $1
	`, courseID).Scan(&courseType, &courseName, &tenantID, &creatorID)
	if err != nil {
		return fmt.Errorf("读取课程信息失败: %w", err)
	}

	if courseType != "system" {
		return nil
	}

	rows, err := tx.Query(ctx, `
		SELECT id, name, eval_data
		FROM system_course_nodes
		WHERE course_id = $1
		ORDER BY sort_order ASC, id ASC
	`, courseID)
	if err != nil {
		return fmt.Errorf("查询课程节点失败: %w", err)
	}
	defer rows.Close()

	type nodeEval struct {
		id       string
		name     string
		evalData domain.JSONMap
	}
	var nodes []nodeEval
	for rows.Next() {
		var n nodeEval
		if err := rows.Scan(&n.id, &n.name, &n.evalData); err != nil {
			return fmt.Errorf("扫描课程节点失败: %w", err)
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("遍历课程节点失败: %w", err)
	}

	for _, n := range nodes {
		ruleConfig := extractEvalRuleConfig(n.evalData)
		if ruleConfig == nil {
			continue
		}

		methods := getStringSliceFromJSONMap(ruleConfig, "evaluationMethods")
		methodResourceConfigs, _ := ruleConfig["methodResourceConfigs"].(map[string]interface{})
		if methodResourceConfigs == nil {
			methodResourceConfigs = make(map[string]interface{})
		}

		updated := false
		for _, methodKey := range methods {
			rc, _ := methodResourceConfigs[methodKey].(map[string]interface{})
			if rc == nil {
				rc = make(map[string]interface{})
			}

			switch methodKey {
			case "paper":
				newRC, err := h.ensureNodePaperUsage(ctx, tx, n.id, n.name, courseName, tenantID, creatorID, rc, ruleConfig)
				if err != nil {
					return fmt.Errorf("生成节点 %s 试卷测评失败: %w", n.id, err)
				}
				methodResourceConfigs[methodKey] = newRC
				updated = true
			case "question_bank", "quiz":
				newRC, err := h.ensureNodeQuestionExam(ctx, tx, n.id, n.name, courseName, tenantID, creatorID, methodKey, rc, ruleConfig)
				if err != nil {
					return fmt.Errorf("生成节点 %s %s测评失败: %w", n.id, methodKey, err)
				}
				methodResourceConfigs[methodKey] = newRC
				updated = true
			case "homework":
				if err := h.ensureNodeHomework(ctx, tx, n.id, n.name, courseName, tenantID, creatorID); err != nil {
					return fmt.Errorf("生成节点 %s 作业失败: %w", n.id, err)
				}
			}
		}

		if updated {
			ruleConfig["methodResourceConfigs"] = methodResourceConfigs
			n.evalData["evalRuleConfig"] = ruleConfig
			if _, err := tx.Exec(ctx, `UPDATE system_course_nodes SET eval_data = $1, updated_at = NOW() WHERE id = $2`, n.evalData, n.id); err != nil {
				return fmt.Errorf("更新节点 %s 测评配置失败: %w", n.id, err)
			}
		}
	}

	// 兼容旧数据：清理课程级 exam_usages / course_homeworks，避免重复展示。
	// 仅删除无关联结果的记录，防止误删历史数据。
	_, _ = tx.Exec(ctx, `
		DELETE FROM exam_usages eu
		WHERE eu.target_type = 'course' AND $1 = ANY(eu.target_ids)
		  AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = eu.id)
	`, courseID)
	_, _ = tx.Exec(ctx, `
		DELETE FROM course_homeworks ch
		WHERE ch.course_id = $1
		  AND NOT EXISTS (SELECT 1 FROM course_homework_submissions chs WHERE chs.homework_id = ch.id)
	`, courseID)

	return nil
}

func extractEvalRuleConfig(evalData domain.JSONMap) domain.JSONMap {
	if evalData == nil {
		return nil
	}
	if rc, ok := evalData["evalRuleConfig"].(map[string]interface{}); ok {
		return rc
	}
	return nil
}

func (h *CourseHandler) ensureNodePaperUsage(ctx context.Context, tx pgx.Tx, nodeID, nodeName, courseName, tenantID, creatorID string, rc map[string]interface{}, ruleConfig domain.JSONMap) (map[string]interface{}, error) {
	paperIDs := getStringSliceFromJSONMap(ruleConfig, "paperIds")
	if len(paperIDs) == 0 {
		return rc, nil
	}

	for _, paperID := range paperIDs {
		if paperID == "" {
			continue
		}
		var examName string
		err := tx.QueryRow(ctx, `SELECT name FROM exams WHERE id = $1 AND tenant_id = $2`, paperID, tenantID).Scan(&examName)
		if err != nil {
			return rc, fmt.Errorf("查询试卷 %s 失败: %w", paperID, err)
		}

		var usageID string
		err = tx.QueryRow(ctx, `
			SELECT id FROM exam_usages
			WHERE exam_id = $1 AND target_type = 'node' AND $2 = ANY(target_ids)
		`, paperID, nodeID).Scan(&usageID)
		if err != nil && err != pgx.ErrNoRows {
			return rc, err
		}

		if usageID == "" {
			usageID = uuid.NewString()
			var creator interface{}
			if creatorID != "" {
				creator = creatorID
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
				VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, 'node', $5, 'published', $6)
			`, usageID, tenantID, paperID, fmt.Sprintf("%s-%s-%s", courseName, nodeName, examName), []string{nodeID}, creator)
			if err != nil {
				return rc, fmt.Errorf("创建节点试卷安排失败: %w", err)
			}
			rc["usageId"] = usageID
		}
	}
	return rc, nil
}

func (h *CourseHandler) ensureNodeQuestionExam(ctx context.Context, tx pgx.Tx, nodeID, nodeName, courseName, tenantID, creatorID, methodKey string, rc map[string]interface{}, ruleConfig domain.JSONMap) (map[string]interface{}, error) {
	field := map[string]string{
		"question_bank": "questionBankQuestions",
		"quiz":          "quizQuestions",
	}[methodKey]

	questionIDs := getStringSliceFromJSONMap(ruleConfig, field)
	if len(questionIDs) == 0 {
		return rc, nil
	}

	label := map[string]string{
		"question_bank": "题库",
		"quiz":          "随堂测",
	}[methodKey]

	examID, _ := rc["examId"].(string)
	usageID, _ := rc["usageId"].(string)

	if examID == "" {
		duration := 90
		if d, ok := rc["duration"].(float64); ok && d > 0 {
			duration = int(d)
		} else if d, ok := rc["timeLimit"].(float64); ok && d > 0 {
			duration = int(d)
		}
		newID, err := courseCreateTempExam(ctx, tx, tenantID, fmt.Sprintf("%s-%s-%s", courseName, nodeName, label), duration, creatorID)
		if err != nil {
			return rc, err
		}
		examID = newID
		rc["examId"] = examID
	}

	if err := courseEnsureExamQuestions(ctx, tx, tenantID, examID, questionIDs); err != nil {
		return rc, err
	}

	if usageID == "" {
		newID, err := courseCreateExamUsage(ctx, tx, tenantID, examID, "node", nodeID, fmt.Sprintf("%s-%s-%s", courseName, nodeName, label), creatorID)
		if err != nil {
			return rc, err
		}
		usageID = newID
		rc["usageId"] = usageID
	}

	return rc, nil
}

func courseCreateTempExam(ctx context.Context, tx pgx.Tx, tenantID, name string, duration int, creatorID string) (string, error) {
	id := uuid.NewString()
	code, err := generateUniqueEntityCode(ctx, tx, "SJ", "exams", tenantID)
	if err != nil {
		return "", fmt.Errorf("生成考试编码失败: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1, $2, $3, $4, '', 'published', 0, $5, NULL, '{}', '{}', NULL, 'v1.0', 'mine', $6, TRUE)
	`, id, tenantID, code, name, duration, creatorID)
	if err != nil {
		return "", fmt.Errorf("创建临时考试失败: %w", err)
	}
	return id, nil
}

func courseEnsureExamQuestions(ctx context.Context, tx pgx.Tx, tenantID, examID string, questionIDs []string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, type, content, options, answer, analysis, score
		FROM questions
		WHERE id = ANY($1) AND tenant_id = $2
		ORDER BY array_position($1, id)
	`, questionIDs, tenantID)
	if err != nil {
		return fmt.Errorf("查询题目失败: %w", err)
	}
	defer rows.Close()

	type q struct {
		id       string
		qType    string
		content  string
		options  []byte
		answer   []byte
		analysis *string
		score    float64
	}
	var questions []q
	for rows.Next() {
		var qq q
		var optionsStr, answerStr *string
		if err := rows.Scan(&qq.id, &qq.qType, &qq.content, &optionsStr, &answerStr, &qq.analysis, &qq.score); err != nil {
			continue
		}
		if optionsStr != nil {
			qq.options = []byte(*optionsStr)
		} else {
			qq.options = []byte("[]")
		}
		if answerStr != nil {
			qq.answer = []byte(*answerStr)
		} else {
			qq.answer = []byte("[]")
		}
		questions = append(questions, qq)
	}

	for i, qq := range questions {
		var existingID string
		_ = tx.QueryRow(ctx, `SELECT id FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, examID, qq.id).Scan(&existingID)
		if existingID != "" {
			_, err := tx.Exec(ctx, `
				UPDATE exam_questions SET type = $1, content = $2, options = $3, answer = $4, analysis = $5, score = $6, sort_order = $7
				WHERE id = $8
			`, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, qq.score, i+1, existingID)
			if err != nil {
				return fmt.Errorf("更新考试题目失败: %w", err)
			}
		} else {
			_, err := tx.Exec(ctx, `
				INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, uuid.NewString(), tenantID, examID, qq.id, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, qq.score, i+1)
			if err != nil {
				return fmt.Errorf("插入考试题目失败: %w", err)
			}
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID)
	if err != nil {
		return fmt.Errorf("重新计算考试总分失败: %w", err)
	}
	return nil
}

func courseCreateExamUsage(ctx context.Context, tx pgx.Tx, tenantID, examID, targetType, targetID, name, creatorID string) (string, error) {
	id := uuid.NewString()
	var creator interface{}
	if creatorID != "" {
		creator = creatorID
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, $5, $6, 'published', $7)
	`, id, tenantID, examID, name, targetType, []string{targetID}, creator)
	if err != nil {
		return "", fmt.Errorf("创建考试安排失败: %w", err)
	}
	return id, nil
}

func (h *CourseHandler) ensureNodeHomework(ctx context.Context, tx pgx.Tx, nodeID, nodeName, courseName, tenantID, creatorID string) error {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE node_id = $1)`, nodeID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("查询节点作业失败: %w", err)
	}
	if exists {
		return nil
	}

	var creator interface{}
	if creatorID != "" {
		creator = creatorID
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, creator_id)
		VALUES ($1, $2, $3, $4, '', FALSE, $5)
	`, uuid.NewString(), tenantID, nodeID, fmt.Sprintf("%s-%s-节点作业", courseName, nodeName), creator)
	if err != nil {
		return fmt.Errorf("创建节点作业失败: %w", err)
	}
	return nil
}
