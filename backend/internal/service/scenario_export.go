package service

// ScenarioExportService ScenarioExportHandler 业务编排下沉（原 scenario_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ScenarioExportService 业务编排服务。
type ScenarioExportService struct {
	s *Service
}

func NewScenarioExportService(s *Service) *ScenarioExportService {
	return &ScenarioExportService{s: s}
}

func (s *ScenarioExportService) FillScenariosData(ctx context.Context, f *excelize.File, tenantID string, scenarioIDs []string) error {

	// Fill Sheet 1: 场景基本信息
	type sRow struct {
		name, position, industries, professions, difficulty, background, batch string
	}
	var sRows []sRow

	for _, sid := range scenarioIDs {
		scn, err := s.s.Store().Scenarios().Get(ctx, sid)
		if err != nil {
			slog.Warn("导出场景行跳过", "scenarioId", sid, "error", err)
			continue
		}
		// 跨租户场景禁止导出（Get 仅按 id 查询，无租户条件）
		if scn.TenantID == nil || *scn.TenantID != tenantID {
			slog.Warn("导出场景行跳过（跨租户）", "scenarioId", sid, "tenantID", scn.TenantID)
			continue
		}
		name := scn.Name
		diff := fmt.Sprintf("%d", scn.Difficulty)
		bg := ""
		if scn.Background != nil {
			bg = *scn.Background
		}
		batchName := ""
		careerPositionID := scn.CareerPositionID
		industryIDs := scn.IndustryIDs
		professionIDs := scn.ProfessionIDs
		batchID := scn.BatchID

		positionName := ""
		if careerPositionID != nil && *careerPositionID != "" {
			if pn, err := store.LookupCareerPositionNameByID(ctx, s.s.Store().Q(), *careerPositionID); err != nil {
				slog.Warn("导出场景岗位名查询失败", "positionId", *careerPositionID, "error", err)
			} else {
				positionName = pn
			}
		}
		if batchID != nil && *batchID != "" {
			if bn, err := store.LookupSceneBatchNameByID(ctx, s.s.Store().Q(), *batchID); err != nil {
				slog.Warn("导出场景批次名查询失败", "batchId", *batchID, "error", err)
			} else {
				batchName = bn
			}
		}

		industryNames := store.LookupNamesByTable(ctx, s.s.Store().Q(), "industries", industryIDs)
		professionNames := store.LookupNamesByTable(ctx, s.s.Store().Q(), "majors", professionIDs)

		sRows = append(sRows, sRow{
			name, positionName,
			strings.Join(industryNames, ","),
			strings.Join(professionNames, ","),
			diff, bg, batchName,
		})
	}

	setCell := NewSetCell(f)
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
		scenarioName, err := store.LookupScenarioNameByID(ctx, s.s.Store().Q(), sid)
		if err != nil {
			slog.Warn("导出场景任务名称查询失败", "scenarioId", sid, "error", err)
		}

		taskRows, err := s.s.Store().ScenarioTasks().ListByScenarioID(ctx, s.s.Store().Q(), tenantID, sid)
		if err != nil {
			slog.Warn("导出场景任务查询失败", "scenarioId", sid, "error", err)
			continue
		}
		for _, t := range taskRows {
			kpNames := store.LookupKnowledgePointNamesByIDs(ctx, s.s.Store().Q(), t.KnowledgePointIDs)
			apNames := store.LookupAbilityPointNamesByIDs(ctx, s.s.Store().Q(), t.AbilityPointIDs)
			resNames := store.LookupResourceNamesByIDs(ctx, s.s.Store().Q(), t.ResourceIDs)

			evalMethods := s.lookupTaskEvalMethods(ctx, tenantID, t.ID)

			setCell("任务配置", fmt.Sprintf("A%d", taskRow), scenarioName)
			setCell("任务配置", fmt.Sprintf("B%d", taskRow), t.Name)
			setCell("任务配置", fmt.Sprintf("C%d", taskRow), mapTaskTypeToChinese(t.TaskType))
			setCell("任务配置", fmt.Sprintf("D%d", taskRow), fmt.Sprintf("%d", t.Difficulty))
			setCell("任务配置", fmt.Sprintf("E%d", taskRow), fmt.Sprintf("%.1f", t.EstimatedHours))
			setCell("任务配置", fmt.Sprintf("F%d", taskRow), t.Background)
			setCell("任务配置", fmt.Sprintf("G%d", taskRow), t.DetailedDesc)
			setCell("任务配置", fmt.Sprintf("H%d", taskRow), strings.Join(kpNames, ","))
			setCell("任务配置", fmt.Sprintf("I%d", taskRow), strings.Join(apNames, ","))
			setCell("任务配置", fmt.Sprintf("J%d", taskRow), strings.Join(resNames, ","))
			setCell("任务配置", fmt.Sprintf("K%d", taskRow), strings.Join(evalMethods, ","))

			f.SetRowHeight("任务配置", taskRow, 24)
			taskRow++
		}
	}

	return nil
}

func (s *ScenarioExportService) lookupTaskEvalMethods(ctx context.Context, tenantID, taskID string) []string {
	return s.s.Store().TaskEval().ListEnabledMethodKeys(ctx, s.s.Store().Q(), tenantID, taskID)
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
