package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionBankExportHandler struct {
	Store *store.Store
}

func (h *QuestionBankExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少题库ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generateQuestionBankTemplate(ctx, tenantID)

	if err := h.fillBanksData(ctx, f, tenantID, ids); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "题库导出.xlsx")
}

func (h *QuestionBankExportHandler) fillBanksData(ctx context.Context, f *excelize.File, tenantID string, bankIDs []string) error {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	failed := 0
	for ri, bid := range bankIDs {
		var name, desc string
		var batchID *string
		err := h.Store.Q().QueryRow(ctx, `
			SELECT name, COALESCE(description,''), batch_id
			FROM question_banks WHERE id=$1 AND tenant_id=$2
		`, bid, tenantID).Scan(&name, &desc, &batchID)
		if err != nil {
			failed++
			slog.Warn("导出题库行跳过", "bankId", bid, "error", err)
			continue
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			h.Store.Q().QueryRow(ctx, `SELECT name FROM evaluation_batches WHERE id=$1`, *batchID).Scan(&batchName)
		}

		r := 3 + ri
		setCell("题库基本信息", fmt.Sprintf("A%d", r), name)
		setCell("题库基本信息", fmt.Sprintf("B%d", r), desc)
		setCell("题库基本信息", fmt.Sprintf("C%d", r), batchName)
		f.SetRowHeight("题库基本信息", r, 24)
	}

	if failed > 0 {
		return fmt.Errorf("%d 个题库数据导出失败", failed)
	}
	return nil
}
