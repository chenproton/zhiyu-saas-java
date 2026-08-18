package service

// AffairsConfigImportService AffairsConfigImportHandler 业务编排下沉（原 affairs_config_import_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AffairsConfigImportService 业务编排服务。
type AffairsConfigImportService struct {
	s *Service
}

func NewAffairsConfigImportService(s *Service) *AffairsConfigImportService {
	return &AffairsConfigImportService{s: s}
}

func parseSlotTypeName(s string) string {
	switch s {
	case "早自习":
		return "morning_self"
	case "上午":
		return "morning"
	case "下午":
		return "afternoon"
	case "晚自习":
		return "evening"
	default:
		return ""
	}
}

// ImportExcel POST /import/affairs-config/excel — 三 Sheet Excel 导入学期/场地/节次。
// ImportSheets 三 Sheet（学期/场地/节次）事务导入；行级错误跳过计入结果，
// 仅系统级错误返回 error 使事务整体回滚。
func (s *AffairsConfigImportService) ImportSheets(ctx context.Context, tenantID string, xlsx *excelize.File) (map[string]interface{}, error) {
	result := map[string]interface{}{}
	err := s.s.WithTx(ctx, func(txStore *store.Store) error {
		if rows, _ := xlsx.GetRows("学期"); len(rows) > 2 {
			created, skipped, failed := 0, 0, 0
			for i, row := range rows {
				if i < 2 {
					continue
				}
				name := strings.TrimSpace(Col(row, 0))
				startDate := strings.TrimSpace(Col(row, 1))
				endDate := strings.TrimSpace(Col(row, 2))
				weeksStr := strings.TrimSpace(Col(row, 3))
				if name == "" || startDate == "" || endDate == "" {
					skipped++
					continue
				}
				weeks, _ := strconv.Atoi(weeksStr)
				if weeks <= 0 {
					weeks = 16
				}
				isNew, err := store.ImportTerm(ctx, txStore.Q(), tenantID, name, startDate, endDate, weeks)
				if err != nil {
					slog.Error("[affairs-config-import] 学期导入失败", "name", name, "error", err)
					failed++
					continue
				}
				if isNew {
					created++
				} else {
					skipped++
				}
			}
			result["termsCreated"] = created
			result["termsSkipped"] = skipped
			result["termsFailed"] = failed
		}

		if rows, _ := xlsx.GetRows("场地"); len(rows) > 2 {
			created, skipped, failed := 0, 0, 0
			for i, row := range rows {
				if i < 2 {
					continue
				}
				name := strings.TrimSpace(Col(row, 0))
				vtype := strings.TrimSpace(Col(row, 1))
				capacityStr := strings.TrimSpace(Col(row, 2))
				if name == "" || vtype == "" {
					skipped++
					continue
				}
				capacity, _ := strconv.Atoi(capacityStr)
				var cap *int
				if capacity > 0 {
					cap = &capacity
				}
				isNew, err := store.ImportVenue(ctx, txStore.Q(), tenantID, name, vtype, cap)
				if err != nil {
					slog.Error("[affairs-config-import] 场地导入失败", "name", name, "error", err)
					failed++
					continue
				}
				if isNew {
					created++
				} else {
					skipped++
				}
			}
			result["venuesCreated"] = created
			result["venuesSkipped"] = skipped
			result["venuesFailed"] = failed
		}

		if rows, _ := xlsx.GetRows("节次"); len(rows) > 2 {
			created, skipped, failed := 0, 0, 0
			for i, row := range rows {
				if i < 2 {
					continue
				}
				name := strings.TrimSpace(Col(row, 0))
				startTime := strings.TrimSpace(Col(row, 1))
				endTime := strings.TrimSpace(Col(row, 2))
				sortStr := strings.TrimSpace(Col(row, 3))
				if name == "" {
					skipped++
					continue
				}
				sortOrder, _ := strconv.Atoi(sortStr)
				// 时段类型优先读「时段类型」列；为空时按排序位置推断（0-3 上午、4-7 下午、8+ 晚自习）
				slotType := parseSlotTypeName(Col(row, 4))
				if slotType == "" {
					slotType = "morning"
					if sortOrder >= 4 && sortOrder < 8 {
						slotType = "afternoon"
					} else if sortOrder >= 8 {
						slotType = "evening"
					}
				}
				var st, et *string
				if startTime != "" {
					st = &startTime
				}
				if endTime != "" {
					et = &endTime
				}
				isNew, err := store.ImportPeriodSlot(ctx, txStore.Q(), tenantID, name, slotType, st, et, sortOrder)
				if err != nil {
					slog.Error("[affairs-config-import] 节次导入失败", "name", name, "error", err)
					failed++
					continue
				}
				if isNew {
					created++
				} else {
					skipped++
				}
			}
			result["periodSlotsCreated"] = created
			result["periodSlotsSkipped"] = skipped
			result["periodSlotsFailed"] = failed
		}
		return nil
	})
	return result, err
}
