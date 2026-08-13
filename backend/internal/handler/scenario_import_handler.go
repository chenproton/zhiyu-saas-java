package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioImportHandler struct {
	Store       *store.Store
	RedisClient *redis.Client
}

type scenarioImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	ScenarioCreated   int
	TaskCreated       int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

func (h *ScenarioImportHandler) processImport(r *http.Request, w http.ResponseWriter, preview bool) {
	irc := parseMultiImportRequest(w, r, false)
	if irc == nil {
		return
	}

	ctx := r.Context()
	aggregated := &scenarioImportResult{}

	irc.MFU.ForEach(func(xlsx *excelize.File) {
		scenarioMap := make(map[string]string)
		h.importScenarios(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename, scenarioMap, aggregated)
		if preview || len(scenarioMap) > 0 {
			h.importTasks(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename, scenarioMap, aggregated)
		}
	})

	if preview {
		previewRes := ImportPreviewResult{
			Created:        aggregated.Created,
			Failed:         aggregated.Failed,
			Duplicates:     len(aggregated.DuplicateItems),
			DuplicateItems: aggregated.DuplicateItems,
			Errors:         aggregated.Errors,
		}
		slog.Info(fmt.Sprintf("[import/preview/scenarios] result: created=%d duplicates=%d failed=%d errors=%d",
			previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.Errors)))
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/scenarios] result: created=%d failed=%d skipped=%d scenarios=%d tasks=%d errors=%d",
		aggregated.Created, aggregated.Failed, aggregated.Skipped, aggregated.ScenarioCreated, aggregated.TaskCreated, len(aggregated.Errors)))
	for _, e := range aggregated.Errors {
		slog.Info(fmt.Sprintf("[import/scenarios] error: %s", e))
	}

	// 导入写库后失效场景列表缓存，避免用户导入后仍看到 2 分钟前的空列表
	if aggregated.Created > 0 {
		cache.InvalidatePrefix(ctx, h.RedisClient, "zhiyu:"+irc.TenantID+":public:scenarios")
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "场景",
		"scenarioCreated":   aggregated.ScenarioCreated,
		"taskCreated":       aggregated.TaskCreated,
		"errors":            aggregated.Errors,
		"sheets":            irc.MFU.FirstSheets(),
	})
}

func (h *ScenarioImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, true)
}

func (h *ScenarioImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, false)
}

func (h *ScenarioImportHandler) importScenarios(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, scenarioMap map[string]string, result *scenarioImportResult) {
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
		positionName := col(row, 1)
		industryNames := splitTrim(col(row, 2), ",")
		professionNames := splitTrim(col(row, 3), ",")
		difficulty := parseDifficulty(col(row, 4))
		background := nullableStr(col(row, 5))
		batchName := col(row, 6)

		careerPositionID := h.lookupCareerPosition(ctx, tenantID, positionName)
		industryIDs := h.lookupIndustries(ctx, tenantID, industryNames)
		professionIDs := h.lookupProfessions(ctx, tenantID, professionNames)
		batchID := lookupBatchID(ctx, h.Store.Q(), "scene_batches", tenantID, batchName)

		var existingID, existingCreator string
		var existingBuilders []string
		err := h.Store.Q().QueryRow(ctx, `SELECT id, COALESCE(creator_id, '') AS creator_id, co_builder_ids FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existingID, &existingCreator, &existingBuilders)
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
				if !canOverwriteContent(existingCreator, existingBuilders, userID) {
					result.PermissionSkipped++
					continue
				}
				_, err := h.Store.Q().Exec(ctx, `
					UPDATE scenarios
					SET name=$3, career_position_id=$4, industry_ids=$5, profession_ids=$6,
					    batch_id=$7, difficulty=$8, background=$9
					WHERE id=$1 AND tenant_id=$2
				`, existingID, tenantID, name, careerPositionID, industryIDs, professionIDs,
					batchID, difficulty, background)
				if err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("场景[%s]更新失败: %v", name, err))
					continue
				}
				// 覆盖时清空原有任务及任务相关数据，随后根据新文件内容重新写入
				h.Store.Q().Exec(ctx, `DELETE FROM task_evaluation_methods WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id=$1)`, existingID)
				h.Store.Q().Exec(ctx, `DELETE FROM scenario_tasks WHERE scenario_id=$1`, existingID)
				scenarioMap[name] = existingID
				continue
			}
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = uniqueSuffixed(name, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		if preview {
			result.Created++
			continue
		}

		code := generateEntityCode("CJ")
		scenarioID := uuid.NewString()
		_, err = h.Store.Q().Exec(ctx, `
			INSERT INTO scenarios (id, tenant_id, name, code, career_position_id, industry_ids, profession_ids,
				batch_id, difficulty, version, status, background, creator_id, co_builder_ids)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'V1.0','draft',$10,$11,'{}')
		`, scenarioID, tenantID, name, code, careerPositionID, industryIDs, professionIDs,
			batchID, difficulty, background, userID)
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

func (h *ScenarioImportHandler) importTasks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, scenarioMap map[string]string, result *scenarioImportResult) {
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
		taskType := mapTaskType(col(row, 2))
		difficulty := parseDifficulty(col(row, 3))
		estimatedHours := parseFloatDefault(col(row, 4), 0)
		bgDescription := nullableStr(col(row, 5))
		detailedDescription := nullableStr(col(row, 6))
		knowledgePointNames := splitTrim(col(row, 7), ",")
		abilityPointNames := splitTrim(col(row, 8), ",")
		resourceNames := splitTrim(col(row, 9), ",")
		evalMethodNames := splitTrim(col(row, 10), ",")

		scenarioID, ok := scenarioMap[scenarioName]
		if !ok {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("任务[%s/%s]找不到场景,已跳过", scenarioName, taskName))
			continue
		}

		taskCode := h.generateTaskCode(ctx, tenantID, scenarioID, seenTaskCode)
		taskID := uuid.NewString()

		knowledgePointIDs := findOrCreateKnowledgePoints(ctx, h.Store.Q(), tenantID, knowledgePointNames)
		abilityPointIDs := h.lookupAbilityPoints(ctx, tenantID, abilityPointNames)
		resourceIDs := findOrCreateResources(ctx, h.Store.Q(), tenantID, resourceNames, userID)

		_, err := h.Store.Q().Exec(ctx, `
			INSERT INTO scenario_tasks (id, tenant_id, scenario_id, name, code, sort_order,
				background, detailed_description, estimated_hours, task_type, difficulty,
				knowledge_point_ids, ability_point_ids, resource_ids, eval_data, dependency_ids, is_referenced)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'{}','{}',false)
		`, taskID, tenantID, scenarioID, taskName, taskCode, seenTaskCode[scenarioID],
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
				if mk := mapEvalMethod(evalName); mk != "" {
					validMethods = append(validMethods, mk)
				}
			}
			// 未配置权重时按等分写入（如 4 种方式各 25），避免权重恒为 0 导致均分/综合分恒为 0
			weight := 100.0 / float64(len(validMethods))
			for _, mk := range validMethods {
				_, err := h.Store.Q().Exec(ctx, `
					INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)
					VALUES ($1,$2,$3,$4,$5,'individual',NULL,'[]'::jsonb,NULL,'{}'::jsonb,1,true)
					ON CONFLICT (task_id, method_key) DO UPDATE SET
						weight = EXCLUDED.weight,
						eval_object = EXCLUDED.eval_object,
						score_type = EXCLUDED.score_type,
						eval_subjects = EXCLUDED.eval_subjects,
						rubric_template_id = EXCLUDED.rubric_template_id,
						resource_config = EXCLUDED.resource_config,
						version = EXCLUDED.version,
						is_enabled = EXCLUDED.is_enabled
				`, uuid.NewString(), tenantID, taskID, mk, weight)
				if err != nil {
					msg := fmt.Sprintf("任务[%s/%s]测评方式[%s]写入失败: %v", scenarioName, taskName, mk, err)
					result.Errors = append(result.Errors, msg)
					slog.Info(fmt.Sprintf("[import/scenarios] %s", msg))
				}
			}
		}
	}
}

func (h *ScenarioImportHandler) generateTaskCode(ctx context.Context, tenantID, scenarioID string, counter map[string]int) string {
	counter[scenarioID]++
	seq := counter[scenarioID]
	return fmt.Sprintf("TSK-%s-%03d", scenarioID[:8], seq)
}

func (h *ScenarioImportHandler) lookupCareerPosition(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.Store.Q().QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *ScenarioImportHandler) lookupIndustries(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := make([]string, 0, len(names))
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.Store.Q().QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *ScenarioImportHandler) lookupProfessions(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := make([]string, 0, len(names))
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.Store.Q().QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *ScenarioImportHandler) lookupAbilityPoints(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.Store.Q().QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
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

func mapEvalMethod(t string) string {
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

func parseFloatDefault(s string, defaultVal float64) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal
	}
	return v
}
