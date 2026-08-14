package handler

// 教务配置导入 HTTP 适配：鉴权/租户/文件解析/模板生成/响应映射，
// 三 Sheet 事务导入在 service.AffairsConfigImportService（refactor-layering.md 分层契约）。

import (
	"log/slog"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AffairsConfigImportHandler struct {
	Store *store.Store
	Svc   *service.AffairsConfigImportService
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

	result, err := h.Svc.ImportSheets(r.Context(), tenantID, xlsx)
	if err != nil {
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

	writeExcel(w, r, f, "教务配置批量导入模板.xlsx")
}
