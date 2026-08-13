package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionBankImportHandler struct {
	Store *store.Store
}

func (h *QuestionBankImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := ImportPreviewResult{}
	mfu.ForEach(func(xlsx *excelize.File) {
		previewRes, _ := h.importBanks(ctx, xlsx, tenantID, userID, true, false, false)
		aggregated.Created += previewRes.Created
		aggregated.Failed += previewRes.Failed
		aggregated.Duplicates += previewRes.Duplicates
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, previewRes.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, previewRes.Errors...)
	})
	respondJSON(w, http.StatusOK, aggregated)
}

func (h *QuestionBankImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	ctx := r.Context()
	aggregated := ImportExecuteResult{Entity: "题库"}
	mfu.ForEach(func(xlsx *excelize.File) {
		_, res := h.importBanks(ctx, xlsx, tenantID, userID, false, overwrite, rename)
		aggregated.Created += res.Created
		aggregated.Failed += res.Failed
		aggregated.Skipped += res.Skipped
		aggregated.PermissionSkipped += res.PermissionSkipped
		aggregated.Errors = append(aggregated.Errors, res.Errors...)
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "题库",
		"errors":            aggregated.Errors,
	})
}

func (h *QuestionBankImportHandler) importBanks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (ImportPreviewResult, ImportExecuteResult) {
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
		description := nullableStr(col(row, 1))
		batchName := col(row, 2)

		batchID := lookupBatchID(ctx, h.Store.Q(), "evaluation_batches", tenantID, batchName)

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

		existingID, existingCreator, existingCollaborators, err := store.FindQuestionBankByTenantName(ctx, h.Store.Q(), tenantID, name)
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
				if !canOverwriteContent(existingCreator, existingCollaborators, userID) {
					execRes.PermissionSkipped++
					continue
				}
				err = store.UpdateQuestionBankImport(ctx, h.Store.Q(), name, description, batchID, existingID)
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
				name = uniqueSuffixed(name, func(c string) bool {
					eid, _ := store.GetQuestionBankIDByTenantName(ctx, h.Store.Q(), tenantID, c)
					return eid != ""
				})
			} else {
				execRes.Skipped++
				continue
			}
		}

		bankID := uuid.NewString()
		code := generateEntityCode("TK")
		err = store.InsertQuestionBankImport(ctx, h.Store.Q(), bankID, tenantID, code, name, description, userID, batchID)
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
