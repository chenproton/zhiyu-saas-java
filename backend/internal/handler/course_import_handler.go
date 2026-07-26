package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseImportHandler struct {
	DB *pgxpool.Pool
}

type courseImportResult struct {
	Created        int
	Failed         int
	Skipped        int
	CourseCreated  int
	NodeCreated    int
	Errors         []string
	DuplicateItems []ImportPreviewItem
}

func (h *CourseImportHandler) parseUploadedExcel(r *http.Request) (*excelize.File, []string, error) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		return nil, nil, fmt.Errorf("invalid form")
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		return nil, nil, fmt.Errorf("missing file")
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse Excel file")
	}
	sheets := xlsx.GetSheetList()
	return xlsx, sheets, nil
}

func (h *CourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	xlsx, _, err := h.parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer xlsx.Close()

	result := &courseImportResult{}
	courseMap := make(map[string]string)
	h.importCourses(r.Context(), xlsx, tenantID, claims.UserID, true, false, courseMap, result)
	h.importNodes(r.Context(), xlsx, tenantID, claims.UserID, true, false, courseMap, result)

	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

func (h *CourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID
	overwrite := importOverwriteParam(r)

	xlsx, sheets, err := h.parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer xlsx.Close()

	result := &courseImportResult{}
	ctx := r.Context()
	courseMap := make(map[string]string)

	h.importCourses(ctx, xlsx, tenantID, userID, false, overwrite, courseMap, result)
	if len(courseMap) == 0 && result.Failed == 0 {
		respondError(w, http.StatusBadRequest, "no valid course data found in 课程基本信息")
		return
	}

	h.importNodes(ctx, xlsx, tenantID, userID, false, overwrite, courseMap, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":        result.Created,
		"failed":         result.Failed,
		"skipped":        result.Skipped,
		"entity":         "体系课",
		"courseCreated":  result.CourseCreated,
		"nodeCreated":    result.NodeCreated,
		"errors":         result.Errors,
		"sheets":         sheets,
	})
}

func (h *CourseImportHandler) importCourses(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, courseMap map[string]string, result *courseImportResult) {
	rows, err := xlsx.GetRows("课程基本信息")
	if err != nil {
		return
	}
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		majorName := col(row, 1)
		batchName := col(row, 3)

		majorID := h.lookupMajor(ctx, tenantID, majorName)
		batchID := h.lookupBatch(ctx, tenantID, batchName, "lesson_batches")

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1`, tenantID, name).Scan(&existingID)
		exists := err == nil && existingID != ""

		if exists {
			if preview {
				if len(result.DuplicateItems) < 100 {
					result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
						RowNum: i + 1,
						Key:    name,
						Name:   name,
					})
				}
				result.Skipped++
				continue
			}
			if !overwrite {
				result.Skipped++
				continue
			}
			_, err := h.DB.Exec(ctx, `
				UPDATE courses
				SET major_id=$3, batch_id=$4, updated_at=NOW()
				WHERE id=$1 AND tenant_id=$2
			`, existingID, tenantID, majorID, batchID)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]更新失败: %v", name, err))
				continue
			}
			h.clearCourseNodes(ctx, existingID)
			courseMap[name] = existingID
			continue
		}

		if preview {
			result.Created++
			continue
		}

		courseID := uuid.NewString()
		code := generateEntityCode("XT")
		_, err = h.DB.Exec(ctx, `
			INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
				online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
				status, cover_color, cover_image, course_tag, creator_id, co_creator_ids, batch_id,
				node_count, resource_count, study_count)
			VALUES ($1,$2,$3,$4,'system','system',$5,NULL,NULL,'V1.0',0,0,0,0,NULL,NULL,
				'draft',NULL,NULL,NULL,$6,'{}',$7,0,0,0)
		`, courseID, tenantID, code, name, majorID, userID, batchID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]创建失败: %v", name, err))
			continue
		}
		courseMap[name] = courseID
		result.CourseCreated++
		result.Created++
	}
}

func (h *CourseImportHandler) importNodes(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, courseMap map[string]string, result *courseImportResult) {
	if preview {
		return
	}

	rows, err := xlsx.GetRows("节点配置")
	if err != nil {
		return
	}

	// courseName -> nodeName -> nodeID
	nodeNameMap := make(map[string]map[string]string)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		courseName := strings.TrimSpace(row[0])
		nodeName := strings.TrimSpace(row[1])
		parentName := col(row, 2)
		refType := mapCourseRefType(col(row, 3))
		sortOrder := parseIntDefault(col(row, 4), 0)
		manualTeachingGoals := nullableStr(col(row, 5))
		manualDuration := parseFloatDefault(col(row, 6), 0)
		knowledgeNames := splitTrim(col(row, 8), ",")
		resourceNames := splitTrim(col(row, 9), ",")
		evalMethodNames := splitTrim(col(row, 10), ",")

		courseID, ok := courseMap[courseName]
		if !ok {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]找不到课程,已跳过", courseName, nodeName))
			continue
		}

		if nodeNameMap[courseName] == nil {
			nodeNameMap[courseName] = make(map[string]string)
		}

		var parentID *string
		if parentName != "" {
			if pid, ok := nodeNameMap[courseName][parentName]; ok {
				parentID = &pid
			} else {
				result.Skipped++
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]父节点[%s]未找到,已跳过", courseName, nodeName, parentName))
				continue
			}
		}

		var sourceID, sourceName *string
		var teachingGoals *string
		var duration float64

		if refType == "original" {
			g := h.lookupGranularCourse(ctx, tenantID, nodeName)
			if g == nil {
				result.Skipped++
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]未找到同名颗粒课,已跳过", courseName, nodeName))
				continue
			}
			sourceID = &g.ID
			sn := g.Name
			sourceName = &sn
			teachingGoals = nil
			duration = 0
			if g.OnlineHours != nil {
				duration = *g.OnlineHours
			}
		} else {
			teachingGoals = manualTeachingGoals
			duration = manualDuration
		}

		nodeID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type, source_id, source_name,
				teaching_goals, duration, status)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
		`, nodeID, tenantID, courseID, parentID, nodeName, sortOrder, refType, sourceID, sourceName, teachingGoals, duration)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]创建失败: %v", courseName, nodeName, err))
			continue
		}
		nodeNameMap[courseName][nodeName] = nodeID
		result.NodeCreated++
		result.Created++

		// 颗粒课节点自带颗粒课内容，不额外绑定知识点和资源
		if refType != "original" {
			knowledgePointIDs := h.findOrCreateKnowledgePoints(ctx, tenantID, knowledgeNames)
			for _, kpID := range knowledgePointIDs {
				_, _ = h.DB.Exec(ctx, `
					INSERT INTO node_knowledge_point_bindings (id, tenant_id, node_id, knowledge_point_id, created_at)
					VALUES ($1,$2,$3,$4,NOW())
					ON CONFLICT (node_id, knowledge_point_id) DO NOTHING
				`, uuid.NewString(), tenantID, nodeID, kpID)
			}

			resourceIDs := h.findOrCreateResources(ctx, tenantID, resourceNames, userID)
			for _, resID := range resourceIDs {
				_, _ = h.DB.Exec(ctx, `
					INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id, created_at)
					VALUES ($1,$2,$3,$4,NOW())
					ON CONFLICT (node_id, resource_id) DO NOTHING
				`, uuid.NewString(), tenantID, nodeID, resID)
			}
		}

		for _, evalName := range evalMethodNames {
			methodKey := mapCourseEvalMethod(evalName)
			if methodKey == "" {
				continue
			}
			switch methodKey {
			case "homework":
				_, _ = h.DB.Exec(ctx, `
					INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment)
					VALUES ($1,$2,$3,$4,'',false)
				`, uuid.NewString(), tenantID, nodeID, "作业测评")
			default:
				title := "题库测验"
				if methodKey == "paper" {
					title = "试卷测验"
				} else if methodKey == "quiz" {
					title = "随堂测"
				}
				_, _ = h.DB.Exec(ctx, `
					INSERT INTO node_quizzes (id, tenant_id, node_id, title, type)
					VALUES ($1,$2,$3,$4,$5)
				`, uuid.NewString(), tenantID, nodeID, title, methodKey)
			}
		}
	}
}

func (h *CourseImportHandler) clearCourseNodes(ctx context.Context, courseID string) {
	_, _ = h.DB.Exec(ctx, `DELETE FROM node_quizzes WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id=$1)`, courseID)
	_, _ = h.DB.Exec(ctx, `DELETE FROM node_homeworks WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id=$1)`, courseID)
	_, _ = h.DB.Exec(ctx, `DELETE FROM system_course_nodes WHERE course_id=$1`, courseID)
}

func (h *CourseImportHandler) lookupMajor(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *CourseImportHandler) lookupBatch(ctx context.Context, tenantID, name, table string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, fmt.Sprintf(`SELECT id FROM %s WHERE tenant_id=$1 AND name=$2 LIMIT 1`, table), tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *CourseImportHandler) lookupGranularCourse(ctx context.Context, tenantID, name string) *domain.Course {
	if name == "" {
		return nil
	}
	var c domain.Course
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, online_hours
		FROM courses
		WHERE tenant_id=$1 AND name=$2 AND type='granular'
		LIMIT 1
	`, tenantID, name).Scan(&c.ID, &c.Name, &c.OnlineHours)
	if err != nil {
		return nil
	}
	return &c
}

func (h *CourseImportHandler) findOrCreateKnowledgePoints(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, _ = h.DB.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
		var existing string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

func (h *CourseImportHandler) findOrCreateResources(ctx context.Context, tenantID string, names []string, userID string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM task_resources WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, _ = h.DB.Exec(ctx, `INSERT INTO task_resources (id, tenant_id, name, type, uploaded_by) VALUES ($1,$2,$3,'document',$4) ON CONFLICT DO NOTHING`,
			id, tenantID, name, userID)
		var existing string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM task_resources WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

func (h *CourseImportHandler) generateSystemCourseCode(ctx context.Context, tenantID string) string {
	year := time.Now().Format("2006")
	var maxNum int
	err := h.DB.QueryRow(ctx, `SELECT COALESCE(MAX(substring(code from '^SYS-[0-9]{4}-([0-9]+)')::int), 0) FROM courses WHERE tenant_id=$1 AND code LIKE 'SYS-'||$2||'-%'`, tenantID, year).Scan(&maxNum)
	if err != nil {
		maxNum = 0
	}
	return fmt.Sprintf("SYS-%s-%04d", year, maxNum+1)
}

func mapCourseRefType(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "颗粒课":
		return "original"
	default:
		return "normal"
	}
}

func mapCourseEvalMethod(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "题库":
		return "question_bank"
	case "试卷":
		return "paper"
	case "随堂测":
		return "quiz"
	case "作业":
		return "homework"
	default:
		return ""
	}
}

