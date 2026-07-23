package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioExportHandler struct {
	DB *pgxpool.Pool
}

func (h *ScenarioExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "missing scenario ids")
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generateScenarioTemplate(ctx, tenantID)

	if err := h.fillScenariosData(ctx, f, tenantID, req.IDs); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fill export data")
		return
	}

	writeExcel(w, f, "场景导出.xlsx")
}

func (h *ScenarioExportHandler) fillScenariosData(ctx context.Context, f *excelize.File, tenantID string, scenarioIDs []string) error {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	// Fill Sheet 1: 场景基本信息
	type sRow struct {
		name, position, industries, professions, difficulty, background, batch string
	}
	var sRows []sRow

	for _, sid := range scenarioIDs {
		var name, diff, bg, batchName string
		var careerPositionID, batchID *string
		var industryIDs, professionIDs []string
		err := h.DB.QueryRow(ctx, `
			SELECT name, career_position_id, industry_ids, profession_ids, batch_id, difficulty, COALESCE(background,'')
			FROM scenarios WHERE id=$1 AND tenant_id=$2
		`, sid, tenantID).Scan(&name, &careerPositionID, &industryIDs, &professionIDs, &batchID, &diff, &bg)
		if err != nil {
			continue
		}

		positionName := ""
		if careerPositionID != nil && *careerPositionID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1`, *careerPositionID).Scan(&positionName)
		}
		if batchID != nil && *batchID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM scene_batches WHERE id=$1`, *batchID).Scan(&batchName)
		}

		industryNames := h.lookupNames(ctx, "industries", industryIDs)
		professionNames := h.lookupNames(ctx, "majors", professionIDs)

		sRows = append(sRows, sRow{
			name, positionName,
			strings.Join(industryNames, ","),
			strings.Join(professionNames, ","),
			diff, bg, batchName,
		})
	}

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}
	for ri, row := range sRows {
		r := 3 + ri
		setCell("场景基本信息", fmt.Sprintf("A%d", r), row.name)
		setCell("场景基本信息", fmt.Sprintf("B%d", r), row.position)
		setCell("场景基本信息", fmt.Sprintf("C%d", r), row.industries)
		setCell("场景基本信息", fmt.Sprintf("D%d", r), row.professions)
		setCell("场景基本信息", fmt.Sprintf("E%d", r), row.difficulty)
		setCell("场景基本信息", fmt.Sprintf("F%d", r), row.background)
		setCell("场景基本信息", fmt.Sprintf("G%d", r), row.batch)
		f.SetRowHeight("场景基本信息", r, 24)
	}

	// Fill Sheet 2: 任务配置
	taskRow := 3
	for _, sid := range scenarioIDs {
		var scenarioName string
		h.DB.QueryRow(ctx, `SELECT name FROM scenarios WHERE id=$1`, sid).Scan(&scenarioName)

		taskRows, err := h.DB.Query(ctx, `
			SELECT name, task_type, difficulty, estimated_hours,
				COALESCE(description,''), COALESCE(detailed_description,''),
				knowledge_point_ids, ability_point_ids, resource_ids
			FROM scenario_tasks WHERE scenario_id=$1 AND tenant_id=$2 ORDER BY sort_order
		`, sid, tenantID)
		if err != nil {
			continue
		}
		for taskRows.Next() {
			var tname, ttype, tdesc, tdetail string
			var tdiff int
			var thours float64
			var kpIDs, apIDs, resIDs []string
			taskRows.Scan(&tname, &ttype, &tdiff, &thours, &tdesc, &tdetail, &kpIDs, &apIDs, &resIDs)

			kpNames := h.lookupKnowledgePointNames(ctx, kpIDs)
			apNames := h.lookupAbilityPointNames(ctx, apIDs)
			resNames := h.lookupResourceNames(ctx, resIDs)

			// Get eval methods
			evalMethods := h.lookupEvalMethods(ctx, sid) // placeholder - need task-level query
			_ = evalMethods

			setCell("任务配置", fmt.Sprintf("A%d", taskRow), scenarioName)
			setCell("任务配置", fmt.Sprintf("B%d", taskRow), tname)
			setCell("任务配置", fmt.Sprintf("C%d", taskRow), mapTaskTypeToChinese(ttype))
			setCell("任务配置", fmt.Sprintf("D%d", taskRow), fmt.Sprintf("%d", tdiff))
			setCell("任务配置", fmt.Sprintf("E%d", taskRow), fmt.Sprintf("%.1f", thours))
			setCell("任务配置", fmt.Sprintf("F%d", taskRow), tdesc)
			setCell("任务配置", fmt.Sprintf("G%d", taskRow), tdetail)
			setCell("任务配置", fmt.Sprintf("H%d", taskRow), strings.Join(kpNames, ","))
			setCell("任务配置", fmt.Sprintf("I%d", taskRow), strings.Join(apNames, ","))
			setCell("任务配置", fmt.Sprintf("J%d", taskRow), strings.Join(resNames, ","))

			// Query eval methods per task
			evalRows, _ := h.DB.Query(ctx, `SELECT method_key FROM task_evaluation_configs WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id=$1 AND name=$2)`, sid, tname)
			var methods []string
			for evalRows.Next() {
				var mk string
				evalRows.Scan(&mk)
				methods = append(methods, mapEvalMethodToChinese(mk))
			}
			evalRows.Close()
			setCell("任务配置", fmt.Sprintf("K%d", taskRow), strings.Join(methods, ","))

			f.SetRowHeight("任务配置", taskRow, 24)
			taskRow++
		}
		taskRows.Close()
	}

	return nil
}

func (h *ScenarioExportHandler) lookupNames(ctx context.Context, table string, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		err := h.DB.QueryRow(ctx, fmt.Sprintf(`SELECT name FROM %s WHERE id=$1`, table), id).Scan(&name)
		if err == nil {
			names = append(names, name)
		}
	}
	return names
}

func (h *ScenarioExportHandler) lookupKnowledgePointNames(ctx context.Context, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		h.DB.QueryRow(ctx, `SELECT name FROM knowledge_points WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func (h *ScenarioExportHandler) lookupAbilityPointNames(ctx context.Context, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		h.DB.QueryRow(ctx, `SELECT name FROM ability_points WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func (h *ScenarioExportHandler) lookupResourceNames(ctx context.Context, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		h.DB.QueryRow(ctx, `SELECT name FROM task_resources WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func (h *ScenarioExportHandler) lookupEvalMethods(ctx context.Context, _ string) []string {
	return nil
}

func mapTaskTypeToChinese(t string) string {
	switch t {
	case "assessment":
		return "考核"
	case "training":
		return "训练"
	default:
		return t
	}
}

func mapEvalMethodToChinese(mk string) string {
	switch mk {
	case "question_bank":
		return "题库"
	case "exam":
		return "试卷"
	case "quiz":
		return "随堂测"
	case "live_qa":
		return "现场问答"
	case "live_review":
		return "现场评审"
	case "outcome_eval":
		return "成果评价"
	case "homework":
		return "作业"
	default:
		return mk
	}
}

func generateExportID() string {
	return uuid.NewString()[:8]
}
