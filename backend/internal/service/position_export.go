package service

// PositionExportService PositionExportHandler 业务编排下沉（原 position_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionExportService 业务编排服务。
type PositionExportService struct {
	s *Service
}

func NewPositionExportService(s *Service) *PositionExportService {
	return &PositionExportService{s: s}
}

func (s *PositionExportService) FillPositionsData(ctx context.Context, f *excelize.File, tenantID string, positionIDs []string) error {
	setCell := NewSetCell(f)

	type posRow struct {
		name, shortName, positionType, industry, majors, salaryRange, description, requirements, careerPath, certs, batch string
	}
	var posRows []posRow

	for _, pid := range positionIDs {
		info, err := store.GetPositionExportInfo(ctx, s.s.Store().Q(), tenantID, pid)
		if err != nil {
			slog.Warn("导出岗位行跳过", "positionId", pid, "error", err)
			continue
		}
		name := info.Name
		shortName := info.ShortName
		positionType := info.PositionType
		desc := info.Description
		careerPath := info.CareerPath
		salaryMin := info.SalaryMin
		salaryMax := info.SalaryMax
		industryID := info.IndustryID
		requirements := info.Requirements
		batchID := info.BatchID

		industryName := ""
		if industryID != nil && *industryID != "" {
			if n, err := store.FindIndustryNameByID(ctx, s.s.Store().Q(), tenantID, *industryID); err != nil {
				slog.Warn("导出岗位行业名查询失败", "industryId", *industryID, "error", err)
			} else {
				industryName = n
			}
		}

		majorNames, err := store.ListPositionMajorNames(ctx, s.s.Store().Q(), tenantID, pid)
		if err != nil {
			slog.Warn("导出岗位专业列表查询失败", "positionId", pid, "error", err)
		}

		certNames, err := store.ListPositionCertNames(ctx, s.s.Store().Q(), tenantID, pid)
		if err != nil {
			slog.Warn("导出岗位证书列表查询失败", "positionId", pid, "error", err)
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			if n, err := store.FindBatchNameByID(ctx, s.s.Store().Q(), tenantID, *batchID); err != nil {
				slog.Warn("导出岗位批次名查询失败", "batchId", *batchID, "error", err)
			} else {
				batchName = n
			}
		}

		salaryStr := ""
		if salaryMin != nil && salaryMax != nil {
			salaryStr = fmt.Sprintf("%d-%d", *salaryMin, *salaryMax)
		}

		posTypeChinese := mapPositionTypeToChinese(positionType)

		posRows = append(posRows, posRow{
			name, shortName, posTypeChinese, industryName,
			strings.Join(majorNames, ","),
			salaryStr, desc,
			strings.Join(requirements, "\n"),
			careerPath,
			strings.Join(certNames, ","),
			batchName,
		})
	}

	slog.Info(fmt.Sprintf("[export/positions] collected %d basic info rows for %d position IDs", len(posRows), len(positionIDs)))

	for ri, row := range posRows {
		r := 3 + ri
		setCell("岗位基本信息", fmt.Sprintf("A%d", r), row.name)
		setCell("岗位基本信息", fmt.Sprintf("B%d", r), row.shortName)
		setCell("岗位基本信息", fmt.Sprintf("C%d", r), row.positionType)
		setCell("岗位基本信息", fmt.Sprintf("D%d", r), row.industry)
		setCell("岗位基本信息", fmt.Sprintf("E%d", r), row.majors)
		if row.salaryRange != "" {
			parts := strings.SplitN(row.salaryRange, "-", 2)
			if len(parts) == 2 {
				setCell("岗位基本信息", fmt.Sprintf("F%d", r), parts[0])
				setCell("岗位基本信息", fmt.Sprintf("G%d", r), parts[1])
			}
		}
		setCell("岗位基本信息", fmt.Sprintf("H%d", r), row.description)
		setCell("岗位基本信息", fmt.Sprintf("I%d", r), row.requirements)
		setCell("岗位基本信息", fmt.Sprintf("J%d", r), row.careerPath)
		setCell("岗位基本信息", fmt.Sprintf("K%d", r), row.certs)
		setCell("岗位基本信息", fmt.Sprintf("L%d", r), row.batch)
		f.SetRowHeight("岗位基本信息", r, 24)
	}

	bindRow := 3
	for _, pid := range positionIDs {
		positionName := ""
		if n, err := store.FindPositionNameByID(ctx, s.s.Store().Q(), tenantID, pid); err != nil {
			slog.Warn("导出岗位绑定名称查询失败", "positionId", pid, "error", err)
		} else {
			positionName = n
		}

		bindRows, err := store.ListPositionAbilityBindings(ctx, s.s.Store().Q(), tenantID, pid)
		if err != nil {
			slog.Warn("导出岗位能力绑定查询失败", "positionId", pid, "error", err)
			continue
		}
		for _, b := range bindRows {
			respName := b.ResponsibilityName
			abilityName := b.AbilityName
			attributes := b.BindingAttributes
			abilityAttrs := b.AbilityAttributes
			domain := b.Domain
			level := b.RequiredLevel
			rubricDesc := b.RubricDescription

			attrStr := strings.Join(attributes, ",")
			if attrStr == "" {
				attrStr = strings.Join(abilityAttrs, ",")
			}

			setCell("工作职责与能力点", fmt.Sprintf("A%d", bindRow), positionName)
			setCell("工作职责与能力点", fmt.Sprintf("B%d", bindRow), respName)
			setCell("工作职责与能力点", fmt.Sprintf("C%d", bindRow), abilityName)
			setCell("工作职责与能力点", fmt.Sprintf("D%d", bindRow), attrStr)
			setCell("工作职责与能力点", fmt.Sprintf("E%d", bindRow), domain)
			setCell("工作职责与能力点", fmt.Sprintf("F%d", bindRow), mapRequiredLevelToChinese(level))
			setCell("工作职责与能力点", fmt.Sprintf("G%d", bindRow), rubricDesc)
			f.SetRowHeight("工作职责与能力点", bindRow, 24)
			bindRow++
		}
	}

	return nil
}

func mapPositionTypeToChinese(t string) string {
	switch t {
	case "enterprise":
		return "企业岗位"
	case "teaching":
		return "教学岗位"
	default:
		return "其他"
	}
}

func mapRequiredLevelToChinese(l string) string {
	switch strings.ToLower(strings.TrimSpace(l)) {
	case "understand", "了解", "l1":
		return "了解"
	case "comprehend", "理解", "l2":
		return "理解"
	case "master", "掌握", "l3":
		return "掌握"
	case "proficient", "熟练":
		return "熟练"
	case "expert", "精通":
		return "精通"
	default:
		return l
	}
}
