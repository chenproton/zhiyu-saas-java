package service

// CourseImportService 体系课导入业务编排：事务边界、跨 store 组合、
// 颗粒课回退合并与节点树构建全部收敛在此（原 course_import_handler.go 内联逻辑下沉）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CourseImportService 体系课 Excel 导入编排服务。
type CourseImportService struct {
	s *Service
}

func NewCourseImportService(s *Service) *CourseImportService {
	return &CourseImportService{s: s}
}

// CourseImportResult 体系课导入结果聚合。
type CourseImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	CourseCreated     int
	NodeCreated       int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

type courseNodeRow struct {
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

// Preview 预览单个文件：统计将创建/跳过/重复的条目，不写库。
func (s *CourseImportService) Preview(ctx context.Context, tenantID, userID string, xlsx *excelize.File) *CourseImportResult {
	result := &CourseImportResult{}
	courseMap := make(map[string]string)
	s.importCourses(ctx, s.s.Store().Q(), xlsx, tenantID, userID, true, false, false, courseMap, result)
	s.importNodes(ctx, s.s.Store().Q(), xlsx, tenantID, userID, true, false, false, courseMap, result)
	return result
}

// Import 导入全部文件：覆盖导入整体包在事务内（overwrite 会清空旧课程节点再重建，
// 任一步失败整体回滚，防止"旧数据已清空、新数据未写入"的不可恢复中间态）。
func (s *CourseImportService) Import(ctx context.Context, tenantID, userID string, overwrite, rename bool, files []*excelize.File) *CourseImportResult {
	aggregated := &CourseImportResult{}
	if err := s.s.WithTx(ctx, func(txStore *store.Store) error {
		for _, xlsx := range files {
			courseMap := make(map[string]string)
			s.importCourses(ctx, txStore.Q(), xlsx, tenantID, userID, false, overwrite, rename, courseMap, aggregated)
			if len(courseMap) > 0 {
				s.importNodes(ctx, txStore.Q(), xlsx, tenantID, userID, false, overwrite, rename, courseMap, aggregated)
			}
		}
		return nil
	}); err != nil {
		slog.Error("[course-import] 事务提交失败", "error", err)
		aggregated.Errors = append(aggregated.Errors, fmt.Sprintf("事务提交失败: %v", err))
	}
	return aggregated
}

func (s *CourseImportService) importCourses(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, courseMap map[string]string, result *CourseImportResult) {
	rows, err := xlsx.GetRows("课程基本信息")
	if err != nil {
		return
	}
	// Sheet 内按名称缓存专业/批次/能力点查找，避免每行 3 次查询的 N+1（AGENTS.md 性能自检①）
	majorCache := map[string]*string{}
	batchCache := map[string]*string{}
	abilityCache := map[string]string{}
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		majorName := Col(row, 1)
		courseIntro := Col(row, 2)
		batchName := Col(row, 3)
		abilityPointNames := SplitTrim(Col(row, 4), ",")

		// 统一走传入的 Queryer：事务内查询需在同一连接内参与回滚
		majorID, ok := majorCache[majorName]
		if !ok {
			majorID = LookupMajorID(ctx, q, tenantID, majorName)
			majorCache[majorName] = majorID
		}
		batchID, ok := batchCache[batchName]
		if !ok {
			batchID = LookupBatchID(ctx, q, "lesson_batches", tenantID, batchName)
			batchCache[batchName] = batchID
		}
		abilityPointIDs := s.lookupAbilityPointsCached(ctx, q, tenantID, abilityPointNames, abilityCache)

		var descPtr *string
		if courseIntro != "" {
			descPtr = &courseIntro
		}

		ident, err := store.CourseImportFindSystemCourseIdentity(ctx, q, tenantID, name)
		exists := err == nil && ident.ID != ""

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
				if !CanOverwriteContent(ident.CreatorID, ident.CoCreatorIDs, userID) {
					result.PermissionSkipped++
					continue
				}
				if err := store.CourseImportUpdateSystemCourseOverwrite(ctx, q, ident.ID, tenantID, majorID, batchID, descPtr, abilityPointIDs); err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]更新失败: %v", name, err))
					continue
				}
				if err := s.clearCourseNodes(ctx, q, ident.ID); err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]清理旧节点失败: %v", name, err))
					continue
				}
				courseMap[name] = ident.ID
				continue
			}
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = UniqueSuffixed(name, func(c string) bool {
				return store.CourseImportSystemCourseIDByName(ctx, q, tenantID, c) != ""
			})
		}

		if preview {
			result.Created++
			continue
		}

		courseID, err := store.CourseImportCreateImportedSystemCourse(ctx, q, store.CourseImportCourseParams{
			TenantID:        tenantID,
			Name:            name,
			MajorID:         majorID,
			BatchID:         batchID,
			Description:     descPtr,
			AbilityPointIDs: abilityPointIDs,
			CreatorID:       userID,
		})
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

func (s *CourseImportService) importNodes(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, courseMap map[string]string, result *CourseImportResult) {
	if preview {
		return
	}

	rows, err := xlsx.GetRows("节点配置")
	if err != nil {
		return
	}

	pending := make([]courseNodeRow, 0)
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
		pending = append(pending, courseNodeRow{
			rowNum:              i + 1,
			courseName:          courseName,
			nodeName:            nodeName,
			parentName:          Col(row, 2),
			refType:             mapCourseRefType(Col(row, 3)),
			sortOrder:           ParseIntDefault(Col(row, 4), 0),
			manualTeachingGoals: NullableStr(Col(row, 5)),
			manualDuration:      ParseFloatDefault(Col(row, 6), 0),
			manualDifficulty:    ParseIntDefault(Col(row, 7), 0),
			knowledgeNames:      SplitTrim(Col(row, 8), ","),
			resourceNames:       SplitTrim(Col(row, 9), ","),
			evalMethodNames:     SplitTrim(strings.ReplaceAll(Col(row, 10), "，", ","), ","),
			courseID:            courseID,
		})
	}

	// courseName -> nodeName -> nodeID
	nodeNameMap := make(map[string]map[string]string)

	for len(pending) > 0 {
		progressed := false
		remaining := make([]courseNodeRow, 0)

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

			if err := s.createSystemCourseNode(ctx, q, tenantID, userID, nr, parentID, nodeNameMap, result); err == nil {
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

func (s *CourseImportService) createSystemCourseNode(ctx context.Context, q store.Queryer, tenantID, userID string, nr courseNodeRow, parentID *string, nodeNameMap map[string]map[string]string, result *CourseImportResult) error {
	var sourceID, sourceName *string
	var teachingGoals *string
	var duration float64
	var difficulty int
	var baseKnowledgeIDs []string
	var baseResourceIDs []string

	if nr.refType == "original" {
		g := s.lookupGranularCourse(ctx, q, tenantID, nr.nodeName)
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
		baseKnowledgeIDs = s.lookupGranularCourseKnowledgePointIDs(ctx, q, g.ID)
		baseResourceIDs = s.lookupGranularCourseResourceIDs(ctx, q, g.ID)
	} else {
		teachingGoals = nr.manualTeachingGoals
		duration = nr.manualDuration
		difficulty = nr.manualDifficulty
	}

	nodeID, err := store.CourseImportCreateImportedCourseNode(ctx, q, store.CourseImportCourseNodeParams{
		TenantID:      tenantID,
		CourseID:      nr.courseID,
		ParentID:      parentID,
		Name:          nr.nodeName,
		SortOrder:     nr.sortOrder,
		RefType:       nr.refType,
		SourceID:      sourceID,
		SourceName:    sourceName,
		TeachingGoals: teachingGoals,
		Duration:      int(duration),
		Difficulty:    difficulty,
	})
	if err != nil {
		result.Failed++
		result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]创建失败: %v", nr.courseName, nr.nodeName, err))
		return err
	}
	nodeNameMap[nr.courseName][nr.nodeName] = nodeID
	result.NodeCreated++
	result.Created++

	// 合并 Excel 中填写的知识点/资源与颗粒课自带的知识点/资源
	knowledgePointIDs := s.mergeIDs(FindOrCreateKnowledgePoints(ctx, q, tenantID, nr.knowledgeNames), baseKnowledgeIDs)
	for _, kpID := range knowledgePointIDs {
		store.CourseImportInsertNodeKnowledgeBinding(ctx, q, nodeID, kpID)
	}

	resourceIDs := s.mergeIDs(FindOrCreateResources(ctx, q, tenantID, nr.resourceNames, userID), baseResourceIDs)
	for _, resID := range resourceIDs {
		store.CourseImportInsertNodeResourceBinding(ctx, q, tenantID, nodeID, resID)
	}

	// 同时写入节点字段，与 scenario_tasks 保持一致
	store.CourseImportUpdateNodeBindingArrays(ctx, q, nodeID, knowledgePointIDs, resourceIDs)

	for _, evalName := range nr.evalMethodNames {
		methodKey := mapCourseEvalMethod(evalName)
		if methodKey == "" {
			continue
		}
		switch methodKey {
		case "homework":
			// 节点作业功能已下线，导入时跳过
			continue
		default:
			title := "题库测验"
			if methodKey == "paper" {
				title = "试卷测验"
			} else if methodKey == "quiz" {
				title = "随堂测"
			}
			if err := store.CourseImportInsertNodeQuiz(ctx, q, tenantID, nodeID, title, methodKey); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("节点[%s/%s]测评[%s]创建失败: %v", nr.courseName, nr.nodeName, evalName, err))
			}
		}
	}

	return nil
}

func (s *CourseImportService) mergeIDs(manual []string, base []string) []string {
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

func (s *CourseImportService) clearCourseNodes(ctx context.Context, q store.Queryer, courseID string) error {
	return store.CourseImportClearImportedCourseNodes(ctx, q, courseID)
}

func (s *CourseImportService) lookupAbilityPoints(ctx context.Context, q store.Queryer, tenantID string, names []string) []string {
	return s.lookupAbilityPointsCached(ctx, q, tenantID, names, map[string]string{})
}

// lookupAbilityPointsCached 按名称缓存查找能力点 ID（Sheet 内跨行复用）。
func (s *CourseImportService) lookupAbilityPointsCached(ctx context.Context, q store.Queryer, tenantID string, names []string, cache map[string]string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		if id, ok := cache[name]; ok {
			if id != "" {
				ids = append(ids, id)
			}
			continue
		}
		id, err := store.CourseImportFindAbilityPointIDByName(ctx, q, tenantID, name)
		if err != nil {
			cache[name] = ""
			continue
		}
		cache[name] = id
		ids = append(ids, id)
	}
	return ids
}

func (s *CourseImportService) lookupGranularCourse(ctx context.Context, q store.Queryer, tenantID, name string) *domain.Course {
	if name == "" {
		return nil
	}
	c, err := store.CourseImportFindGranularCourseByName(ctx, q, tenantID, name)
	if err != nil {
		return nil
	}
	return c
}

func (s *CourseImportService) lookupGranularCourseKnowledgePointIDs(ctx context.Context, q store.Queryer, courseID string) []string {
	return store.CourseImportCourseKnowledgePointIDs(ctx, q, courseID)
}

func (s *CourseImportService) lookupGranularCourseResourceIDs(ctx context.Context, q store.Queryer, courseID string) []string {
	return store.CourseImportCourseResourceIDs(ctx, q, courseID)
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
