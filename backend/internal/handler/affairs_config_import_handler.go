package handler

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AffairsConfigImportHandler struct {
	Store *store.Store
}

// parseSlotTypeName 将「时段类型」列中文值映射为 slot_type，无法识别时返回空串。
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
func (h *AffairsConfigImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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
		respondError(w, http.StatusBadRequest, "无法解析上传文件")
		return
	}
	defer xlsx.Close()

	ctx := r.Context()
	result := map[string]interface{}{}
	// 三 Sheet 导入包在同一事务：任一步骤失败整体回滚，防止中途失败留部分数据
	tx, err := h.Store.WithTxRaw(ctx)
	if err != nil {
		respondServerError(w, r, err, "开启导入事务失败")
		return
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && err != pgx.ErrTxClosed {
			slog.Error("[affairs-config-import] 事务回滚失败", "error", err)
		}
	}()

	if rows, _ := xlsx.GetRows("学期"); len(rows) > 2 {
		created, skipped, failed := 0, 0, 0
		for i, row := range rows {
			if i < 2 {
				continue
			}
			name := strings.TrimSpace(col(row, 0))
			startDate := strings.TrimSpace(col(row, 1))
			endDate := strings.TrimSpace(col(row, 2))
			weeksStr := strings.TrimSpace(col(row, 3))
			if name == "" || startDate == "" || endDate == "" {
				skipped++
				continue
			}
			weeks, _ := strconv.Atoi(weeksStr)
			if weeks <= 0 {
				weeks = 16
			}
			var exists string
			if err := tx.QueryRow(ctx, `SELECT id FROM terms WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err != nil && err != pgx.ErrNoRows {
				slog.Error("[affairs-config-import] 学期查重失败", "name", name, "error", err)
				failed++
				continue
			}
			if exists != "" {
				skipped++
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count) VALUES ($1,$2,$3,$4::date,$5::date,$6)`,
				uuid.NewString(), tenantID, name, startDate, endDate, weeks); err != nil {
				slog.Error("[affairs-config-import] 学期插入失败", "name", name, "error", err)
				failed++
				continue
			}
			created++
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
			name := strings.TrimSpace(col(row, 0))
			vtype := strings.TrimSpace(col(row, 1))
			capacityStr := strings.TrimSpace(col(row, 2))
			if name == "" || vtype == "" {
				skipped++
				continue
			}
			capacity, _ := strconv.Atoi(capacityStr)
			var cap *int
			if capacity > 0 {
				cap = &capacity
			}
			var exists string
			if err := tx.QueryRow(ctx, `SELECT id FROM venues WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err != nil && err != pgx.ErrNoRows {
				slog.Error("[affairs-config-import] 场地查重失败", "name", name, "error", err)
				failed++
				continue
			}
			if exists != "" {
				skipped++
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO venues (id, tenant_id, name, type, capacity) VALUES ($1,$2,$3,$4,$5)`,
				uuid.NewString(), tenantID, name, vtype, cap); err != nil {
				slog.Error("[affairs-config-import] 场地插入失败", "name", name, "error", err)
				failed++
				continue
			}
			created++
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
			name := strings.TrimSpace(col(row, 0))
			startTime := strings.TrimSpace(col(row, 1))
			endTime := strings.TrimSpace(col(row, 2))
			sortStr := strings.TrimSpace(col(row, 3))
			if name == "" {
				skipped++
				continue
			}
			sortOrder, _ := strconv.Atoi(sortStr)
			// 时段类型优先读「时段类型」列；为空时按排序位置推断（0-3 上午、4-7 下午、8+ 晚自习）
			slotType := parseSlotTypeName(col(row, 4))
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
			var exists string
			if err := tx.QueryRow(ctx, `SELECT id FROM period_slots WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err != nil && err != pgx.ErrNoRows {
				slog.Error("[affairs-config-import] 节次查重失败", "name", name, "error", err)
				failed++
				continue
			}
			if exists != "" {
				skipped++
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO period_slots (id, tenant_id, name, slot_type, start_time, end_time, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
				uuid.NewString(), tenantID, name, slotType, st, et, sortOrder); err != nil {
				slog.Error("[affairs-config-import] 节次插入失败", "name", name, "error", err)
				failed++
				continue
			}
			created++
		}
		result["periodSlotsCreated"] = created
		result["periodSlotsSkipped"] = skipped
		result["periodSlotsFailed"] = failed
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("[affairs-config-import] 事务提交失败", "error", err)
		respondServerError(w, r, err, "导入提交失败")
		return
	}
	respondJSON(w, http.StatusOK, result)
}

// ServeTemplate GET /templates/affairs-config — 下载教务配置导入模板。
func (h *AffairsConfigImportHandler) ServeTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if _, ok := requireTenant(w, r); !ok {
		return
	}

	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	makeSheet := func(sheetName string, headers []string, widths []float64, note string) {
		f.NewSheet(sheetName)
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(len(headers), 1)
		f.MergeCell(sheetName, start, end)
		f.SetCellValue(sheetName, start, note)
		f.SetCellStyle(sheetName, start, end, noteStyle)
		f.SetCellStyle(sheetName, start, end, wrapAlign)
		f.SetRowHeight(sheetName, 1, 48)
		for ci, hdr := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
			f.SetCellValue(sheetName, cell, hdr)
			f.SetCellStyle(sheetName, cell, cell, hdrStyle)
			f.SetColWidth(sheetName, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheetName, 2, 28)
		f.SetPanes(sheetName, &excelize.Panes{Freeze: true, YSplit: 2})
	}

	makeSheet("学期", []string{"名称 *", "开始日期 *", "结束日期 *", "周数"},
		[]float64{18, 14, 14, 8},
		"填写说明：\n名称：如 2025-2026-1\n开始/结束日期：YYYY-MM-DD\n周数：整数，默认 16")
	makeSheet("场地", []string{"名称 *", "类型 *", "容量"},
		[]float64{20, 14, 8},
		"填写说明：\n类型：教室/机房/实训室/实验室/校外基地\n容量：整数，选填")
	makeSheet("节次", []string{"名称 *", "开始时间", "结束时间", "排序", "时段类型"},
		[]float64{16, 10, 10, 8, 10},
		"填写说明：\n名称：如 上午1-2\n时间：HH:MM 格式\n排序：整数，用于课表行顺序\n时段类型：早自习/上午/下午/晚自习，选填；不填时按排序自动识别（0-3 上午、4-7 下午、8+ 晚自习）")

	if _, err := f.NewSheet("Sheet1"); err == nil {
		f.DeleteSheet("Sheet1")
	}
	idx, _ := f.GetSheetIndex("学期")
	f.SetActiveSheet(idx)

	writeExcel(w, f, "教务配置批量导入模板.xlsx")
}
