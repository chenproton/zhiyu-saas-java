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
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type GranularCourseImportHandler struct {
	DB *pgxpool.Pool
}

type granularCourseImportResult struct {
	Created       int
	Failed        int
	Skipped       int
	Errors        []string
	DuplicateItems []ImportPreviewItem
}

func (h *GranularCourseImportHandler) parseUploadedExcel(r *http.Request) (*excelize.File, []string, error) {
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

func (h *GranularCourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
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

	result := &granularCourseImportResult{}
	h.importCourses(r.Context(), xlsx, tenantID, claims.UserID, true, false, result)

	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

func (h *GranularCourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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

	result := &granularCourseImportResult{}
	h.importCourses(r.Context(), xlsx, tenantID, userID, false, overwrite, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"skipped": result.Skipped,
		"entity":  "颗粒课",
		"errors":  result.Errors,
		"sheets":  sheets,
	})
}

func (h *GranularCourseImportHandler) importCourses(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, result *granularCourseImportResult) {
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
		difficulty := parseIntDefault(col(row, 2), 0)
		duration := parseFloatDefault(col(row, 3), 0)
		learningGoal := col(row, 4)
		knowledgeNames := splitTrim(col(row, 5), ",")
		resourceNames := splitTrim(col(row, 6), ",")
		batchName := col(row, 7)

		majorID := h.lookupMajor(ctx, tenantID, majorName)
		batchID := h.lookupBatch(ctx, tenantID, batchName, "lesson_batches")

		var descPtr *string
		if learningGoal != "" {
			descPtr = &learningGoal
		}
		var diffPtr *int
		if difficulty > 0 {
			diffPtr = &difficulty
		}
		var durPtr *float64
		if duration > 0 {
			durPtr = &duration
		}

		knowledgePointIDs := h.findOrCreateKnowledgePoints(ctx, tenantID, knowledgeNames)
		resourceIDs := h.findOrCreateResources(ctx, tenantID, resourceNames, userID)

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='granular' LIMIT 1`, tenantID, name).Scan(&existingID)
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
				SET major_id=$3, batch_id=$4, difficulty=$5, description=$6, online_hours=$7,
				    knowledge_point_ids=$8, resource_ids=$9, resource_count=COALESCE(array_length($9::uuid[], 1), 0), updated_at=NOW()
				WHERE id=$1 AND tenant_id=$2
			`, existingID, tenantID, majorID, batchID, diffPtr, descPtr, durPtr, knowledgePointIDs, resourceIDs)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]更新失败: %v", name, err))
				continue
			}
			h.replaceCourseBindings(ctx, existingID, tenantID, userID, knowledgePointIDs, resourceIDs)
			continue
		}

		if preview {
			result.Created++
			continue
		}

		courseID := uuid.NewString()
		code := h.generateGranularCourseCode(ctx, tenantID)
		_, err = h.DB.Exec(ctx, `
			INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
				online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
				status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
				knowledge_point_ids, resource_ids, node_count, resource_count, study_count)
			VALUES ($1,$2,$3,$4,'granular','granular',$5,NULL,NULL,'V1.0',$6,0,0,0,NULL,NULL,
				'draft',NULL,NULL,NULL,$7,$8,$9,'{}',$10,$11,$12,0,COALESCE(array_length($12::uuid[], 1), 0),0)
		`, courseID, tenantID, code, name, majorID, durPtr, diffPtr, descPtr, userID, batchID, knowledgePointIDs, resourceIDs)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]创建失败: %v", name, err))
			continue
		}
		h.replaceCourseBindings(ctx, courseID, tenantID, userID, knowledgePointIDs, resourceIDs)
		result.Created++
	}
}

func (h *GranularCourseImportHandler) lookupMajor(ctx context.Context, tenantID, name string) *string {
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

func (h *GranularCourseImportHandler) lookupBatch(ctx context.Context, tenantID, name, table string) *string {
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

func (h *GranularCourseImportHandler) findOrCreateKnowledgePoints(ctx context.Context, tenantID string, names []string) []string {
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

func (h *GranularCourseImportHandler) findOrCreateResources(ctx context.Context, tenantID string, names []string, userID string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, _ = h.DB.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,'document'::resource_type,$4) ON CONFLICT DO NOTHING`,
			id, tenantID, name, userID)
		var existing string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

func (h *GranularCourseImportHandler) replaceCourseBindings(ctx context.Context, courseID, tenantID, userID string, knowledgePointIDs, resourceIDs []string) {
	_, _ = h.DB.Exec(ctx, `DELETE FROM course_knowledge_bindings WHERE course_id=$1 AND bind_type='course'`, courseID)
	_, _ = h.DB.Exec(ctx, `DELETE FROM course_resource_bindings WHERE course_id=$1`, courseID)

	for _, kpID := range knowledgePointIDs {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1,$2,$3,$4,'course',NULL)
			ON CONFLICT (course_id, knowledge_point_id, bind_type, source_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, kpID)
	}

	for _, resID := range resourceIDs {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (course_id, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, resID)
	}
}

func (h *GranularCourseImportHandler) generateGranularCourseCode(ctx context.Context, tenantID string) string {
	year := time.Now().Format("2006")
	var maxNum int
	err := h.DB.QueryRow(ctx, `SELECT COALESCE(MAX(substring(code from '^GRA-[0-9]{4}-([0-9]+)')::int), 0) FROM courses WHERE tenant_id=$1 AND code LIKE 'GRA-'||$2||'-%'`, tenantID, year).Scan(&maxNum)
	if err != nil {
		maxNum = 0
	}
	return fmt.Sprintf("GRA-%s-%04d", year, maxNum+1)
}
