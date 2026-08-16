package service

// QuestionBankImportService QuestionBankImportHandler 业务编排下沉（原 question_bank_import_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// QuestionBankImportService 业务编排服务。
type QuestionBankImportService struct {
	s *Service
}

func NewQuestionBankImportService(s *Service) *QuestionBankImportService {
	return &QuestionBankImportService{s: s}
}

func (s *QuestionBankImportService) ImportBanks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (ImportPreviewResult, ImportExecuteResult) {
	var previewRes ImportPreviewResult
	var execRes ImportExecuteResult

	rows, err := xlsx.GetRows("题库基本信息")
	if err != nil {
		slog.Info(fmt.Sprintf("[import/question-banks] sheet '题库基本信息' not found: %v", err))
		return previewRes, execRes
	}

	seen := make(map[string]bool)
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}

		name := strings.TrimSpace(row[0])
		description := NullableStr(Col(row, 1))
		batchName := Col(row, 2)

		batchID := LookupBatchID(ctx, s.s.Store().Q(), "evaluation_batches", tenantID, batchName)

		if seen[name] {
			previewRes.Duplicates++
			if len(previewRes.DuplicateItems) < 100 {
				previewRes.DuplicateItems = append(previewRes.DuplicateItems, ImportPreviewItem{
					RowNum: i + 1,
					Key:    name,
					Name:   name,
				})
			}
			if !preview {
				execRes.Skipped++
			}
			continue
		}
		seen[name] = true

		existingID, existingCreator, existingCollaborators, err := store.FindQuestionBankByTenantName(ctx, s.s.Store().Q(), tenantID, name)
		found := err == nil && existingID != ""

		if preview {
			if found {
				previewRes.Duplicates++
				if len(previewRes.DuplicateItems) < 100 {
					previewRes.DuplicateItems = append(previewRes.DuplicateItems, ImportPreviewItem{
						RowNum: i + 1,
						Key:    name,
						Name:   name,
					})
				}
			} else {
				previewRes.Created++
			}
			continue
		}

		if found {
			if overwrite {
				if !CanOverwriteContent(existingCreator, existingCollaborators, userID) {
					execRes.PermissionSkipped++
					continue
				}
				err = store.UpdateQuestionBankImport(ctx, s.s.Store().Q(), tenantID, name, description, batchID, existingID)
				if err != nil {
					execRes.Failed++
					msg := fmt.Sprintf("题库[%s]更新失败: %v", name, err)
					execRes.Errors = append(execRes.Errors, msg)
					slog.Info(fmt.Sprintf("[import/question-banks] %s", msg))
					continue
				}
				execRes.Created++
				slog.Info(fmt.Sprintf("[import/question-banks] updated bank %s (id=%s)", name, existingID))
				continue
			}
			if rename {
				// rename 模式：追加随机后缀生成新名称，按新对象导入
				name = UniqueSuffixed(name, func(c string) bool {
					eid, _ := store.GetQuestionBankIDByTenantName(ctx, s.s.Store().Q(), tenantID, c)
					return eid != ""
				})
			} else {
				execRes.Skipped++
				continue
			}
		}

		bankID := uuid.NewString()
		code := store.GenerateEntityCode("TK")
		err = store.InsertQuestionBankImport(ctx, s.s.Store().Q(), bankID, tenantID, code, name, description, userID, batchID)
		if err != nil {
			execRes.Failed++
			msg := fmt.Sprintf("题库[%s]创建失败: %v", name, err)
			execRes.Errors = append(execRes.Errors, msg)
			slog.Info(fmt.Sprintf("[import/question-banks] %s", msg))
			continue
		}

		execRes.Created++
		slog.Info(fmt.Sprintf("[import/question-banks] created bank %s (id=%s)", name, bankID))
	}

	return previewRes, execRes
}
