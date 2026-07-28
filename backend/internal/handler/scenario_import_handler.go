package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioImportHandler struct {
	DB *pgxpool.Pool
}

type scenarioImportResult struct {
	Created         int
	Failed          int
	Skipped         int
	ScenarioCreated int
	TaskCreated     int
	Errors          []string
	DuplicateItems  []ImportPreviewItem
}

func (h *ScenarioImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer xlsx.Close()

	result := &scenarioImportResult{}
	scenarioMap := make(map[string]string)

	ctx := r.Context()
	h.importScenarios(ctx, xlsx, tenantID, claims.UserID, true, false, scenarioMap, result)
	h.importTasks(ctx, xlsx, tenantID, claims.UserID, true, false, scenarioMap, result)

	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

func (h *ScenarioImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer xlsx.Close()

	result := &scenarioImportResult{}
	ctx := r.Context()
	scenarioMap := make(map[string]string)

	h.importScenarios(ctx, xlsx, tenantID, userID, false, overwrite, scenarioMap, result)
	if len(scenarioMap) == 0 && result.Failed == 0 {
		respondError(w, http.StatusBadRequest, "Sheet1中未找到有效场景方案数据")
		return
	}

	h.importTasks(ctx, xlsx, tenantID, userID, false, overwrite, scenarioMap, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":         result.Created,
		"failed":          result.Failed,
		"skipped":         result.Skipped,
		"entity":          "场景",
		"scenarioCreated": result.ScenarioCreated,
		"taskCreated":     result.TaskCreated,
		"errors":          result.Errors,
		"sheets":          sheets,
	})
}

func (h *ScenarioImportHandler) importScenarios(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, scenarioMap map[string]string, result *scenarioImportResult) {
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
		batchID := h.lookupBatch(ctx, tenantID, batchName, "scene_batches")

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existingID)
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
			h.DB.Exec(ctx, `DELETE FROM task_evaluation_methods WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id=$1)`, existingID)
			h.DB.Exec(ctx, `DELETE FROM scenario_tasks WHERE scenario_id=$1`, existingID)
			scenarioMap[name] = existingID
			continue
		}

		if preview {
			result.Created++
			continue
		}

		code := generateEntityCode("CJ")
		scenarioID := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO scenarios (id, tenant_id, name, code, career_position_id, industry_ids, profession_ids,
				batch_id, difficulty, version, status, background, creator_id, co_builder_ids)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'v1.0','draft',$10,$11,'{}')
		`, scenarioID, tenantID, name, code, careerPositionID, industryIDs, professionIDs,
			batchID, difficulty, background, userID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("场景[%s]创建失败: %v", name, err))
			continue
		}
		scenarioMap[name] = scenarioID
		result.ScenarioCreated++
		result.Created++
	}
}

func (h *ScenarioImportHandler) importTasks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, scenarioMap map[string]string, result *scenarioImportResult) {
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

		knowledgePointIDs := h.findOrCreateKnowledgePoints(ctx, tenantID, knowledgePointNames)
		abilityPointIDs := h.lookupAbilityPoints(ctx, tenantID, abilityPointNames)
		resourceIDs := h.findOrCreateResources(ctx, tenantID, resourceNames, userID)

		_, err := h.DB.Exec(ctx, `
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
			for _, evalName := range evalMethodNames {
				mk := mapEvalMethod(evalName)
				if mk == "" {
					continue
				}
				_, err := h.DB.Exec(ctx, `
					INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)
					VALUES ($1,$2,$3,$4,0,'individual',NULL,'[]'::jsonb,NULL,'{}'::jsonb,1,true)
					ON CONFLICT (task_id, method_key) DO UPDATE SET
						weight = EXCLUDED.weight,
						eval_object = EXCLUDED.eval_object,
						score_type = EXCLUDED.score_type,
						eval_subjects = EXCLUDED.eval_subjects,
						rubric_template_id = EXCLUDED.rubric_template_id,
						resource_config = EXCLUDED.resource_config,
						version = EXCLUDED.version,
						is_enabled = EXCLUDED.is_enabled
				`, uuid.NewString(), tenantID, taskID, mk)
				if err != nil {
					msg := fmt.Sprintf("任务[%s/%s]测评方式[%s]写入失败: %v", scenarioName, taskName, evalName, err)
					result.Errors = append(result.Errors, msg)
					slog.Info(fmt.Sprintf("[import/scenarios] %s", msg))
				}
			}
		}
	}
}

func (h *ScenarioImportHandler) generateScenarioCode(ctx context.Context, tenantID string) string {
	year := time.Now().Format("2006")
	var maxNum int
	// 提取 SC-YYYY-NNNN 中的序号，忽略 -clone 等后缀
	err := h.DB.QueryRow(ctx, `SELECT COALESCE(MAX(substring(code from '^SC-[0-9]{4}-([0-9]+)')::int), 0) FROM scenarios WHERE tenant_id=$1 AND code LIKE 'SC-'||$2||'-%'`, tenantID, year).Scan(&maxNum)
	if err != nil {
		maxNum = 0
	}
	return fmt.Sprintf("SC-%s-%04d", year, maxNum+1)
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
	err := h.DB.QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
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
		err := h.DB.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
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
		err := h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *ScenarioImportHandler) lookupBatch(ctx context.Context, tenantID, name, table string) *string {
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

func (h *ScenarioImportHandler) findOrCreateKnowledgePoints(ctx context.Context, tenantID string, names []string) []string {
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
		h.DB.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
		var existing string
		h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
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
		err := h.DB.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *ScenarioImportHandler) findOrCreateResources(ctx context.Context, tenantID string, names []string, userID string) []string {
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
		h.DB.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,'document'::resource_type,$4) ON CONFLICT DO NOTHING`,
			id, tenantID, name, userID)
		var existing string
		h.DB.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
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
