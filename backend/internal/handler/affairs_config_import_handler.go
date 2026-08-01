package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type AffairsConfigImportHandler struct {
	DB *pgxpool.Pool
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

	if rows, _ := xlsx.GetRows("学期"); len(rows) > 2 {
		created, skipped := 0, 0
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
			h.DB.QueryRow(ctx, `SELECT id FROM terms WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists)
			if exists != "" {
				skipped++
				continue
			}
			h.DB.Exec(ctx, `INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count) VALUES ($1,$2,$3,$4::date,$5::date,$6)`,
				uuid.NewString(), tenantID, name, startDate, endDate, weeks)
			created++
		}
		result["termsCreated"] = created
		result["termsSkipped"] = skipped
	}

	if rows, _ := xlsx.GetRows("场地"); len(rows) > 2 {
		created, skipped := 0, 0
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
			h.DB.QueryRow(ctx, `SELECT id FROM venues WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists)
			if exists != "" {
				skipped++
				continue
			}
			h.DB.Exec(ctx, `INSERT INTO venues (id, tenant_id, name, type, capacity) VALUES ($1,$2,$3,$4,$5)`,
				uuid.NewString(), tenantID, name, vtype, cap)
			created++
		}
		result["venuesCreated"] = created
		result["venuesSkipped"] = skipped
	}

	if rows, _ := xlsx.GetRows("节次"); len(rows) > 2 {
		created, skipped := 0, 0
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
			var st, et *string
			if startTime != "" {
				st = &startTime
			}
			if endTime != "" {
				et = &endTime
			}
			var exists string
			h.DB.QueryRow(ctx, `SELECT id FROM period_slots WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists)
			if exists != "" {
				skipped++
				continue
			}
			h.DB.Exec(ctx, `INSERT INTO period_slots (id, tenant_id, name, start_time, end_time, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
				uuid.NewString(), tenantID, name, st, et, sortOrder)
			created++
		}
		result["periodSlotsCreated"] = created
		result["periodSlotsSkipped"] = skipped
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
	makeSheet("节次", []string{"名称 *", "开始时间", "结束时间", "排序"},
		[]float64{16, 10, 10, 8},
		"填写说明：\n名称：如 上午1-2\n时间：HH:MM 格式\n排序：整数，用于课表行顺序")

	if _, err := f.NewSheet("Sheet1"); err == nil {
		f.DeleteSheet("Sheet1")
	}
	idx, _ := f.GetSheetIndex("学期")
	f.SetActiveSheet(idx)

	writeExcel(w, f, "教务配置批量导入模板.xlsx")
}
