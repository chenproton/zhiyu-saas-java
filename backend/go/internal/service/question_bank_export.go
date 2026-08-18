package service

// QuestionBankExportService QuestionBankExportHandler 业务编排下沉（原 question_bank_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// QuestionBankExportService 业务编排服务。
type QuestionBankExportService struct {
	s *Service
}

func NewQuestionBankExportService(s *Service) *QuestionBankExportService {
	return &QuestionBankExportService{s: s}
}

func (s *QuestionBankExportService) FillBanksData(ctx context.Context, f *excelize.File, tenantID string, bankIDs []string) error {
	dataStyle := MakeDataStyle(f)
	wrapAlign := MakeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	failed := 0
	for ri, bid := range bankIDs {
		name, desc, batchID, err := store.GetQuestionBankForExport(ctx, s.s.Store().Q(), bid, tenantID)
		if err != nil {
			failed++
			slog.Warn("导出题库行跳过", "bankId", bid, "error", err)
			continue
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			var err error
			batchName, err = store.GetEvaluationBatchNameByID(ctx, s.s.Store().Q(), *batchID)
			if err != nil {
				slog.Warn("导出题库批次名查询失败", "batchId", *batchID, "error", err)
			}
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
