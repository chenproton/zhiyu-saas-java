package handler

import (
	"errors"
	"context"
	"encoding/json"
	"net/http"
	"strings"

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
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	CoCreatorIds      domain.JSONSlice `json:"coCreatorIds"`
	BatchID           *string          `json:"batchId"`
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
	ResourceIds       domain.JSONSlice `json:"resourceIds"`
	CoCreatorIds      domain.JSONSlice `json:"coCreatorIds"`
	BatchID           *string          `json:"batchId"`
}

func (h *CourseHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.Course]{
		Table: "courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id",
		SelectColumns: `c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description,
			c.knowledge_point_ids::text[] AS knowledge_point_ids,
			c.resource_ids::text[] AS resource_ids,
			c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'course' AND target_id = c.id) AS view_count,
			c.study_count, c.created_at, c.updated_at`,
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
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, resource_ids, node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, 0, 0, 0)
	`, id, tenantID, code, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, req.Difficulty, req.Description, claims.UserID, req.CoCreatorIds, req.BatchID,
		kpIDs, resIDs)
	if err != nil {
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
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	if req.KnowledgePointIds == nil {
		kpIDs = jsonSliceToUUIDSlice(existing.KnowledgePointIds)
	}
	if req.ResourceIds == nil {
		resIDs = jsonSliceToUUIDSlice(existing.ResourceIds)
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE courses SET name = $1, type = $2, category = $3, major_id = $4, teacher_id = $5,
			industry_id = $6, version = $7, online_hours = $8, offline_hours = $9, online_weight = $10,
			offline_weight = $11, semester = $12, class_name = $13, cover_color = $14, cover_image = $15,
			course_tag = $16, difficulty = $17, description = $18, co_creator_ids = $19, batch_id = $20,
			knowledge_point_ids = $21, resource_ids = $22, resource_count = COALESCE(array_length($22::uuid[], 1), 0), updated_at = NOW()
		WHERE id = $23
	`, req.Name, req.Type, req.Category, req.MajorID, req.TeacherID, req.IndustryID, req.Version,
		req.OnlineHours, req.OfflineHours, req.OnlineWeight, req.OfflineWeight, req.Semester, req.ClassName,
		req.CoverColor, req.CoverImage, req.CourseTag, req.Difficulty, req.Description, req.CoCreatorIds, batchID,
		kpIDs, resIDs, id)
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
	h.actions().transition(w, r, domain.StatusPublished)
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
			c.resource_ids::text[] AS resource_ids,
			c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'course' AND target_id = c.id) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
		&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
		&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
		&c.KnowledgePointIds, &c.ResourceIds, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
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
			&c.KnowledgePointIds, &c.ResourceIds, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
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
