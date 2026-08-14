package service

// ScenarioImportService ScenarioImportHandler 业务编排下沉（原 scenario_import_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ScenarioImportService 业务编排服务。
type ScenarioImportService struct {
	s *Service
}

func NewScenarioImportService(s *Service) *ScenarioImportService {
	return &ScenarioImportService{s: s}
}

type ScenarioImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	ScenarioCreated   int
	TaskCreated       int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

// ImportFile 单文件导入/预览编排（场景 + 任务两级）。
func (s *ScenarioImportService) ImportFile(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) *ScenarioImportResult {
	result := &ScenarioImportResult{}
	scenarioMap := make(map[string]string)
	s.ImportScenarios(ctx, xlsx, tenantID, userID, preview, overwrite, rename, scenarioMap, result)
	if preview || len(scenarioMap) > 0 {
		s.ImportTasks(ctx, xlsx, tenantID, userID, preview, overwrite, rename, scenarioMap, result)
	}
	return result
}

func (s *ScenarioImportService) ImportScenarios(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, scenarioMap map[string]string, result *ScenarioImportResult) {
	rows, err := xlsx.GetRows("场景基本信息")
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
		positionName := Col(row, 1)
		industryNames := SplitTrim(Col(row, 2), ",")
		professionNames := SplitTrim(Col(row, 3), ",")
		difficulty := parseDifficulty(Col(row, 4))
		background := NullableStr(Col(row, 5))
		batchName := Col(row, 6)

		careerPositionID := s.lookupCareerPosition(ctx, tenantID, positionName)
		industryIDs := s.lookupIndustries(ctx, tenantID, industryNames)
		professionIDs := s.lookupProfessions(ctx, tenantID, professionNames)
		batchID := LookupBatchID(ctx, s.s.Store().Q(), "scene_batches", tenantID, batchName)

		existingID, existingCreator, existingBuilders, err := store.LookupScenarioImport(ctx, s.s.Store().Q(), tenantID, name)
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
				if !CanOverwriteContent(existingCreator, existingBuilders, userID) {
					result.PermissionSkipped++
					continue
				}
				if err := store.UpdateScenarioImport(ctx, s.s.Store().Q(), existingID, tenantID, name, careerPositionID, industryIDs, professionIDs, batchID, difficulty, background); err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("场景[%s]更新失败: %v", name, err))
					continue
				}
				// 覆盖时清空原有任务及任务相关数据，随后根据新文件内容重新写入；
				// 清空失败计入失败行，避免旧任务残留与后续 INSERT 产生重复 task code
				if err := store.ClearScenarioImportTasks(ctx, s.s.Store().Q(), existingID); err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("场景[%s]清空旧任务失败: %v", name, err))
					continue
				}
				scenarioMap[name] = existingID
				continue
			}
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = UniqueSuffixed(name, func(c string) bool {
				return store.ScenarioImportNameTaken(ctx, s.s.Store().Q(), tenantID, c)
			})
		}

		if preview {
			result.Created++
			continue
		}

		code := store.GenerateEntityCode("CJ")
		scenarioID := uuid.NewString()
		err = store.CreateScenarioImport(ctx, s.s.Store().Q(), scenarioID, tenantID, name, code, careerPositionID, industryIDs, professionIDs, batchID, difficulty, background, userID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("场景[%s]创建失败: %v", name, err))
			continue
		}
		scenarioMap[name] = scenarioID
		if origName != "" {
			scenarioMap[origName] = scenarioID
		}
		result.ScenarioCreated++
		result.Created++
	}
}

func (s *ScenarioImportService) ImportTasks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, scenarioMap map[string]string, result *ScenarioImportResult) {
	if preview {
		return
	}

	rows, err := xlsx.GetRows("任务配置")
	if err != nil {
		return
	}
	seenTaskCode := make(map[string]int)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		scenarioName := strings.TrimSpace(row[0])
		taskName := strings.TrimSpace(row[1])
		taskType := mapTaskType(Col(row, 2))
		difficulty := parseDifficulty(Col(row, 3))
		estimatedHours := ParseFloatDefault(Col(row, 4), 0)
		bgDescription := NullableStr(Col(row, 5))
		detailedDescription := NullableStr(Col(row, 6))
		knowledgePointNames := SplitTrim(Col(row, 7), ",")
		abilityPointNames := SplitTrim(Col(row, 8), ",")
		resourceNames := SplitTrim(Col(row, 9), ",")
		evalMethodNames := SplitTrim(Col(row, 10), ",")

		scenarioID, ok := scenarioMap[scenarioName]
		if !ok {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("任务[%s/%s]找不到场景,已跳过", scenarioName, taskName))
			continue
		}

		taskCode := s.generateTaskCode(ctx, tenantID, scenarioID, seenTaskCode)
		taskID := uuid.NewString()

		knowledgePointIDs := FindOrCreateKnowledgePoints(ctx, s.s.Store().Q(), tenantID, knowledgePointNames)
		abilityPointIDs := s.lookupAbilityPoints(ctx, tenantID, abilityPointNames)
		resourceIDs := FindOrCreateResources(ctx, s.s.Store().Q(), tenantID, resourceNames, userID)

		err := store.CreateScenarioTaskImport(ctx, s.s.Store().Q(), taskID, tenantID, scenarioID, taskName, taskCode, seenTaskCode[scenarioID],
			bgDescription, detailedDescription, estimatedHours, taskType, difficulty,
			knowledgePointIDs, abilityPointIDs, resourceIDs)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("任务[%s/%s]创建失败: %v", scenarioName, taskName, err))
			continue
		}
		result.TaskCreated++
		result.Created++

		if len(evalMethodNames) > 0 {
			validMethods := make([]string, 0, len(evalMethodNames))
			for _, evalName := range evalMethodNames {
				if mk := MapEvalMethod(evalName); mk != "" {
					validMethods = append(validMethods, mk)
				}
			}
			if len(validMethods) == 0 {
				// 全部测评方式未识别：不写入任何方式（除零会得 +Inf 权重入库）
				msg := fmt.Sprintf("任务[%s/%s]测评方式均未识别，跳过写入", scenarioName, taskName)
				result.Errors = append(result.Errors, msg)
				slog.Info(fmt.Sprintf("[import/scenarios] %s", msg))
				continue
			}
			// 未配置权重时按等分写入（如 4 种方式各 25），避免权重恒为 0 导致均分/综合分恒为 0
			weight := 100.0 / float64(len(validMethods))
			for _, mk := range validMethods {
				if err := store.UpsertScenarioTaskEvalMethodImport(ctx, s.s.Store().Q(), uuid.NewString(), tenantID, taskID, mk, weight); err != nil {
					msg := fmt.Sprintf("任务[%s/%s]测评方式[%s]写入失败: %v", scenarioName, taskName, mk, err)
					result.Errors = append(result.Errors, msg)
					slog.Info(fmt.Sprintf("[import/scenarios] %s", msg))
				}
			}
		}
	}
}

func (s *ScenarioImportService) generateTaskCode(ctx context.Context, tenantID, scenarioID string, counter map[string]int) string {
	counter[scenarioID]++
	seq := counter[scenarioID]
	return fmt.Sprintf("TSK-%s-%03d", scenarioID[:8], seq)
}

func (s *ScenarioImportService) lookupCareerPosition(ctx context.Context, tenantID, name string) *string {
	return store.LookupCareerPositionIDByName(ctx, s.s.Store().Q(), tenantID, name)
}

func (s *ScenarioImportService) lookupIndustries(ctx context.Context, tenantID string, names []string) []string {
	return store.LookupIndustryIDsByNames(ctx, s.s.Store().Q(), tenantID, names)
}

func (s *ScenarioImportService) lookupProfessions(ctx context.Context, tenantID string, names []string) []string {
	return store.LookupProfessionIDsByNames(ctx, s.s.Store().Q(), tenantID, names)
}

func (s *ScenarioImportService) lookupAbilityPoints(ctx context.Context, tenantID string, names []string) []string {
	return store.LookupAbilityPointIDsByNames(ctx, s.s.Store().Q(), tenantID, names)
}

func mapTaskType(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "考核":
		return "assessment"
	case "训练":
		return "training"
	default:
		if t == "assessment" || t == "training" {
			return t
		}
		return "assessment"
	}
}

func MapEvalMethod(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "题库":
		return "question_bank"
	case "试卷":
		return "paper"
	case "随堂测":
		return "quiz"
	case "现场问答":
		return "random_draw"
	case "现场评审":
		return "review"
	case "成果评价":
		return "outcome"
	case "作业":
		return "homework"
	default:
		return ""
	}
}

func parseDifficulty(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 1
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 1
	}
	if v < 1 || v > 5 {
		return 1
	}
	return v
}
