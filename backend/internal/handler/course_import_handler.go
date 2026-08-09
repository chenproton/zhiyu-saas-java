package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// importDB 覆盖导入所需的最小查询接口（Queryer 满足）。
type importDB interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type CourseImportHandler struct {
	Store *store.Store
}

type courseImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	CourseCreated     int
	NodeCreated       int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

type nodeRow struct {
	rowNum              int
	courseName          string
	nodeName            string
	parentName          string
	refType             string
	sortOrder           int
	manualTeachingGoals *string
	manualDuration      float64
	manualDifficulty    int
	knowledgeNames      []string
	resourceNames       []string
	evalMethodNames     []string
	courseID            string
}

func (h *CourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := ImportPreviewResult{}
	mfu.ForEach(func(xlsx *excelize.File) {
		result := &courseImportResult{}
		courseMap := make(map[string]string)
		h.importCourses(ctx, h.Store.Q(), xlsx, tenantID, claims.UserID, true, false, false, courseMap, result)
		h.importNodes(ctx, h.Store.Q(), xlsx, tenantID, claims.UserID, true, false, false, courseMap, result)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Duplicates += len(result.DuplicateItems)
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, result.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, result.Errors...)
	})

	respondJSON(w, http.StatusOK, aggregated)
}

func (h *CourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := &courseImportResult{}
	// 覆盖导入整体包在事务内：overwrite 会清空旧课程节点再重建，
	// 任一步失败整体回滚，防止"旧数据已清空、新数据未写入"的不可恢复中间态。
	tx, err := h.Store.WithTxRaw(ctx)
	if err != nil {
		respondServerError(w, r, err, "开启导入事务失败")
		return
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && err != pgx.ErrTxClosed {
			slog.Error("[course-import] 事务回滚失败", "error", err)
		}
	}()

	mfu.ForEach(func(xlsx *excelize.File) {
		courseMap := make(map[string]string)
		h.importCourses(ctx, tx, xlsx, tenantID, userID, false, overwrite, rename, courseMap, aggregated)
		if len(courseMap) > 0 {
			h.importNodes(ctx, tx, xlsx, tenantID, userID, false, overwrite, rename, courseMap, aggregated)
		}
	})

	if err := tx.Commit(ctx); err != nil {
		slog.Error("[course-import] 事务提交失败", "error", err)
		respondServerError(w, r, err, "导入提交失败")
		return
	}

	if len(aggregated.Errors) > 0 {
		slog.Info(fmt.Sprintf("[course-import] tenant=%s created=%d failed=%d skipped=%d errors:\n", tenantID, aggregated.Created, aggregated.Failed, aggregated.Skipped))
		for _, e := range aggregated.Errors {
			slog.Info(fmt.Sprintf("[course-import]   %s\n", e))
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "体系课",
		"courseCreated":     aggregated.CourseCreated,
		"nodeCreated":       aggregated.NodeCreated,
		"errors":            aggregated.Errors,
		"sheets":            mfu.FirstSheets(),
	})
}

func (h *CourseImportHandler) importCourses(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, courseMap map[string]string, result *courseImportResult) {
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
		courseIntro := col(row, 2)
		batchName := col(row, 3)
		abilityPointNames := splitTrim(col(row, 4), ",")

		majorID := lookupMajorID(ctx, h.Store.Q(), tenantID, majorName)
		batchID := lookupBatchID(ctx, h.Store.Q(), "lesson_batches", tenantID, batchName)
		abilityPointIDs := h.lookupAbilityPoints(ctx, q, tenantID, abilityPointNames)

		var descPtr *string
		if courseIntro != "" {
			descPtr = &courseIntro
		}

		var existingID, existingCreator string
		var existingCoCreators []string
		err := q.QueryRow(ctx, `SELECT id, creator_id, co_creator_ids FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1`, tenantID, name).Scan(&existingID, &existingCreator, &existingCoCreators)
		exists := err == nil && existingID != ""

		origName := ""
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
			if !overwrite && !rename {
				result.Skipped++
				continue
			}
			if overwrite {
				if !canOverwriteContent(existingCreator, existingCoCreators, userID) {
					result.PermissionSkipped++
					continue
				}
				_, err := q.Exec(ctx, `
					UPDATE courses
					SET major_id=$3, batch_id=$4, description=$5, ability_point_ids=$6, updated_at=NOW()
					WHERE id=$1 AND tenant_id=$2
				`, existingID, tenantID, majorID, batchID, descPtr, abilityPointIDs)
				if err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]更新失败: %v", name, err))
					continue
				}
				if err := h.clearCourseNodes(ctx, q, existingID); err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]清理旧节点失败: %v", name, err))
					continue
				}
				courseMap[name] = existingID
				continue
			}
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = uniqueSuffixed(name, func(c string) bool {
				var eid string
				_ = q.QueryRow(ctx, `SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		if preview {
			result.Created++
			continue
		}

		courseID := uuid.NewString()
		code := generateEntityCode("XT")
		_, err = q.Exec(ctx, `
			INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
				online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
				status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
				ability_point_ids, node_count, resource_count, study_count)
			VALUES ($1,$2,$3,$4,'system','system',$5,NULL,NULL,'V1.0',0,0,0,0,NULL,NULL,
				'draft',NULL,NULL,NULL,NULL,$8,$6,'{}',$7,$9,0,0,0)
		`, courseID, tenantID, code, name, majorID, userID, batchID, descPtr, abilityPointIDs)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]创建失败: %v", name, err))
			continue
		}
		courseMap[name] = courseID
		if origName != "" {
			courseMap[origName] = courseID
		}
		result.CourseCreated++
		result.Created++
	}
}

func (h *CourseImportHandler) importNodes(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, courseMap map[string]string, result *courseImportResult) {
	if preview {
		return
	}

	rows, err := xlsx.GetRows("节点配置")
	if err != nil {
		return
	}

	pending := make([]nodeRow, 0)
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		courseName := strings.TrimSpace(row[0])
		nodeName := strings.TrimSpace(row[1])
		courseID, ok := courseMap[courseName]
		if !ok {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]找不到课程,已跳过", courseName, nodeName))
			continue
		}
		pending = append(pending, nodeRow{
			rowNum:              i + 1,
			courseName:          courseName,
			nodeName:            nodeName,
			parentName:          col(row, 2),
			refType:             mapCourseRefType(col(row, 3)),
			sortOrder:           parseIntDefault(col(row, 4), 0),
			manualTeachingGoals: nullableStr(col(row, 5)),
			manualDuration:      parseFloatDefault(col(row, 6), 0),
			manualDifficulty:    parseIntDefault(col(row, 7), 0),
			knowledgeNames:      splitTrim(col(row, 8), ","),
			resourceNames:       splitTrim(col(row, 9), ","),
			evalMethodNames:     splitTrim(strings.ReplaceAll(col(row, 10), "，", ","), ","),
			courseID:            courseID,
		})
	}

	// courseName -> nodeName -> nodeID
	nodeNameMap := make(map[string]map[string]string)

	for len(pending) > 0 {
		progressed := false
		remaining := make([]nodeRow, 0)

		for _, nr := range pending {
			if nodeNameMap[nr.courseName] == nil {
				nodeNameMap[nr.courseName] = make(map[string]string)
			}

			var parentID *string
			if nr.parentName != "" {
				if pid, ok := nodeNameMap[nr.courseName][nr.parentName]; ok {
					parentID = &pid
				} else {
					remaining = append(remaining, nr)
					continue
				}
			}

			if err := h.createSystemCourseNode(ctx, q, tenantID, userID, nr, parentID, nodeNameMap, result); err == nil {
				progressed = true
			}
		}

		if !progressed {
			for _, nr := range remaining {
				result.Skipped++
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]父节点[%s]未找到或存在循环依赖,已跳过", nr.courseName, nr.nodeName, nr.parentName))
			}
			break
		}
		pending = remaining
	}
}

func (h *CourseImportHandler) createSystemCourseNode(ctx context.Context, q store.Queryer, tenantID, userID string, nr nodeRow, parentID *string, nodeNameMap map[string]map[string]string, result *courseImportResult) error {
	var sourceID, sourceName *string
	var teachingGoals *string
	var duration float64
	var difficulty int
	var baseKnowledgeIDs []string
	var baseResourceIDs []string

	if nr.refType == "original" {
		g := h.lookupGranularCourse(ctx, q, tenantID, nr.nodeName)
		if g == nil {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]未找到同名颗粒课,已跳过", nr.courseName, nr.nodeName))
			return fmt.Errorf("未找到颗粒课")
		}
		sourceID = &g.ID
		sn := g.Name
		sourceName = &sn
		// 优先使用 Excel 中填写的学习目标，未填写时回退到颗粒课描述
		teachingGoals = nr.manualTeachingGoals
		if teachingGoals == nil || *teachingGoals == "" {
			teachingGoals = g.Description
		}
		// 优先使用 Excel 中填写的课时，未填写时回退到颗粒课课时
		duration = nr.manualDuration
		if duration == 0 && g.OnlineHours != nil {
			duration = *g.OnlineHours
		}
		// 优先使用 Excel 中填写的难度，未填写时回退到颗粒课难度
		difficulty = nr.manualDifficulty
		if difficulty == 0 && g.Difficulty != nil {
			difficulty = *g.Difficulty
		}
		// 回退到颗粒课关联的知识点和资源（以绑定表为准，避免 courses 表数组字段为空）
		baseKnowledgeIDs = h.lookupGranularCourseKnowledgePointIDs(ctx, q, g.ID)
		baseResourceIDs = h.lookupGranularCourseResourceIDs(ctx, q, g.ID)
	} else {
		teachingGoals = nr.manualTeachingGoals
		duration = nr.manualDuration
		difficulty = nr.manualDifficulty
	}

	nodeID := uuid.NewString()
	_, err := q.Exec(ctx, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type, source_id, source_name,
			teaching_goals, duration, difficulty, knowledge_point_ids, resource_ids, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
	`, nodeID, tenantID, nr.courseID, parentID, nr.nodeName, nr.sortOrder, nr.refType, sourceID, sourceName, teachingGoals, int(duration), difficulty, []string{}, []string{}, "draft")
	if err != nil {
		result.Failed++
		result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]创建失败: %v", nr.courseName, nr.nodeName, err))
		return err
	}
	nodeNameMap[nr.courseName][nr.nodeName] = nodeID
	result.NodeCreated++
	result.Created++

	// 合并 Excel 中填写的知识点/资源与颗粒课自带的知识点/资源
	knowledgePointIDs := h.mergeIDs(findOrCreateKnowledgePoints(ctx, h.Store.Q(), tenantID, nr.knowledgeNames), baseKnowledgeIDs)
	for _, kpID := range knowledgePointIDs {
		_, _ = q.Exec(ctx, `
			INSERT INTO node_knowledge_point_bindings (id, tenant_id, node_id, knowledge_point_id, created_at)
			VALUES ($1,$2,$3,$4,NOW())
			ON CONFLICT (node_id, knowledge_point_id) DO NOTHING
		`, uuid.NewString(), tenantID, nodeID, kpID)
	}

	resourceIDs := h.mergeIDs(findOrCreateResources(ctx, h.Store.Q(), tenantID, nr.resourceNames, userID), baseResourceIDs)
	for _, resID := range resourceIDs {
		_, _ = q.Exec(ctx, `
			INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id, created_at)
			VALUES ($1,$2,$3,$4,NOW())
			ON CONFLICT (node_id, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, nodeID, resID)
	}

	// 同时写入节点字段，与 scenario_tasks 保持一致
	_, _ = q.Exec(ctx, `
		UPDATE system_course_nodes
		SET knowledge_point_ids = $2, resource_ids = $3
		WHERE id = $1
	`, nodeID, knowledgePointIDs, resourceIDs)

	for _, evalName := range nr.evalMethodNames {
		methodKey := mapCourseEvalMethod(evalName)
		if methodKey == "" {
			continue
		}
		switch methodKey {
		case "homework":
			_, err := q.Exec(ctx, `
				INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment)
				VALUES ($1,$2,$3,$4,'',false)
			`, uuid.NewString(), tenantID, nodeID, "作业测评")
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]作业测评创建失败: %v", nr.courseName, nr.nodeName, err))
			}
		default:
			title := "题库测验"
			if methodKey == "paper" {
				title = "试卷测验"
			} else if methodKey == "quiz" {
				title = "随堂测"
			}
			_, err := q.Exec(ctx, `
				INSERT INTO node_quizzes (id, tenant_id, node_id, title, type)
				VALUES ($1,$2,$3,$4,$5)
			`, uuid.NewString(), tenantID, nodeID, title, methodKey)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]测评[%s]创建失败: %v", nr.courseName, nr.nodeName, evalName, err))
			}
		}
	}

	return nil
}

func (h *CourseImportHandler) mergeIDs(manual []string, base []string) []string {
	seen := make(map[string]bool)
	var merged []string
	for _, id := range manual {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		merged = append(merged, id)
	}
	for _, id := range base {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		merged = append(merged, id)
	}
	return merged
}

func (h *CourseImportHandler) clearCourseNodes(ctx context.Context, q store.Queryer, courseID string) error {
	if _, err := q.Exec(ctx, `DELETE FROM node_quizzes WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id=$1)`, courseID); err != nil {
		return err
	}
	if _, err := q.Exec(ctx, `DELETE FROM node_homeworks WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id=$1)`, courseID); err != nil {
		return err
	}
	if _, err := q.Exec(ctx, `DELETE FROM system_course_nodes WHERE course_id=$1`, courseID); err != nil {
		return err
	}
	return nil
}

func (h *CourseImportHandler) lookupAbilityPoints(ctx context.Context, q store.Queryer, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *CourseImportHandler) lookupGranularCourse(ctx context.Context, q store.Queryer, tenantID, name string) *domain.Course {
	if name == "" {
		return nil
	}
	var c domain.Course
	err := q.QueryRow(ctx, `
		SELECT id, name, online_hours, description, difficulty
		FROM courses
		WHERE tenant_id=$1 AND name=$2 AND type='granular'
		LIMIT 1
	`, tenantID, name).Scan(&c.ID, &c.Name, &c.OnlineHours, &c.Description, &c.Difficulty)
	if err != nil {
		return nil
	}
	return &c
}

func (h *CourseImportHandler) lookupGranularCourseKnowledgePointIDs(ctx context.Context, q store.Queryer, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT knowledge_point_id FROM course_knowledge_bindings
		WHERE course_id=$1 AND bind_type='course'
	`, courseID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func (h *CourseImportHandler) lookupGranularCourseResourceIDs(ctx context.Context, q store.Queryer, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT resource_id FROM course_resource_bindings
		WHERE course_id=$1
	`, courseID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
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
