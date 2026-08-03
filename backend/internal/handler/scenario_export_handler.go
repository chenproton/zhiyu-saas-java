package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少场景方案ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generateScenarioTemplate(ctx, tenantID)

	if err := h.fillScenariosData(ctx, f, tenantID, ids); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "场景导出.xlsx")
}

func (h *ScenarioExportHandler) fillScenariosData(ctx context.Context, f *excelize.File, tenantID string, scenarioIDs []string) error {

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
			slog.Warn("导出场景行跳过", "scenarioId", sid, "error", err)
			continue
		}

		positionName := ""
		if careerPositionID != nil && *careerPositionID != "" {
			if err := h.DB.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1`, *careerPositionID).Scan(&positionName); err != nil {
				slog.Warn("导出场景岗位名查询失败", "positionId", *careerPositionID, "error", err)
			}
		}
		if batchID != nil && *batchID != "" {
			if err := h.DB.QueryRow(ctx, `SELECT name FROM scene_batches WHERE id=$1`, *batchID).Scan(&batchName); err != nil {
				slog.Warn("导出场景批次名查询失败", "batchId", *batchID, "error", err)
			}
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

	setCell := newSetCell(f)
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
		if err := h.DB.QueryRow(ctx, `SELECT name FROM scenarios WHERE id=$1`, sid).Scan(&scenarioName); err != nil {
			slog.Warn("导出场景任务名称查询失败", "scenarioId", sid, "error", err)
		}

		taskRows, err := h.DB.Query(ctx, `
			SELECT id, name, task_type, difficulty, estimated_hours,
				COALESCE(background,''), COALESCE(detailed_description,''),
				knowledge_point_ids, ability_point_ids, resource_ids
			FROM scenario_tasks WHERE scenario_id=$1 AND tenant_id=$2 ORDER BY sort_order
		`, sid, tenantID)
		if err != nil {
			slog.Warn("导出场景任务查询失败", "scenarioId", sid, "error", err)
			continue
		}
		for taskRows.Next() {
			var taskID, tname, ttype, tdesc, tdetail string
			var tdiff int
			var thours float64
			var kpIDs, apIDs, resIDs []string
			if err := taskRows.Scan(&taskID, &tname, &ttype, &tdiff, &thours, &tdesc, &tdetail, &kpIDs, &apIDs, &resIDs); err != nil {
				slog.Warn("导出场景任务行扫描失败", "scenarioId", sid, "error", err)
				continue
			}

			kpNames := h.lookupKnowledgePointNames(ctx, kpIDs)
			apNames := h.lookupAbilityPointNames(ctx, apIDs)
			resNames := h.lookupResourceNames(ctx, resIDs)

			evalMethods := h.lookupTaskEvalMethods(ctx, tenantID, taskID)

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
			setCell("任务配置", fmt.Sprintf("K%d", taskRow), strings.Join(evalMethods, ","))

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
		h.DB.QueryRow(ctx, `SELECT name FROM resource_library WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func (h *ScenarioExportHandler) lookupTaskEvalMethods(ctx context.Context, tenantID, taskID string) []string {
	var methods []string
	rows, err := h.DB.Query(ctx, `
		SELECT method_key FROM task_evaluation_methods
		WHERE task_id=$1 AND tenant_id=$2 AND is_enabled=true
		ORDER BY created_at
	`, taskID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	for rows.Next() {
		var mk string
		rows.Scan(&mk)
		if ch := mapEvalMethodToChinese(mk); ch != "" {
			methods = append(methods, ch)
		}
	}
	return methods
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
	case "exam", "paper":
		return "试卷"
	case "quiz":
		return "随堂测"
	case "review":
		return "现场评审"
	case "outcome":
		return "成果评价"
	case "homework":
		return "作业"
	case "random_draw":
		return "随堂测"
	default:
		return mk
	}
}
