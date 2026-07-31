package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type QuestionBankImportHandler struct {
	DB *pgxpool.Pool
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
		previewRes, _ := h.importBanks(ctx, xlsx, tenantID, userID, true, false)
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

	ctx := r.Context()
	aggregated := ImportExecuteResult{Entity: "题库"}
	mfu.ForEach(func(xlsx *excelize.File) {
		_, res := h.importBanks(ctx, xlsx, tenantID, userID, false, overwrite)
		aggregated.Created += res.Created
		aggregated.Failed += res.Failed
		aggregated.Skipped += res.Skipped
		aggregated.Errors = append(aggregated.Errors, res.Errors...)
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": aggregated.Created,
		"failed":  aggregated.Failed,
		"skipped": aggregated.Skipped,
		"entity":  "题库",
		"errors":  aggregated.Errors,
	})
}

func (h *QuestionBankImportHandler) importBanks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool) (ImportPreviewResult, ImportExecuteResult) {
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

		batchID := h.lookupEvaluationBatch(ctx, tenantID, batchName)

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

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM question_banks WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existingID)
		found := err == nil

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
				_, err := h.DB.Exec(ctx, `
					UPDATE question_banks SET name=$1, description=$2, batch_id=$3 WHERE id=$4
				`, name, description, batchID, existingID)
				if err != nil {
					execRes.Failed++
					msg := fmt.Sprintf("题库[%s]更新失败: %v", name, err)
					execRes.Errors = append(execRes.Errors, msg)
					slog.Info(fmt.Sprintf("[import/question-banks] %s", msg))
					continue
				}
				execRes.Created++
				slog.Info(fmt.Sprintf("[import/question-banks] updated bank %s (id=%s)", name, existingID))
			} else {
				execRes.Skipped++
			}
			continue
		}

		bankID := uuid.NewString()
		code := generateEntityCode("TK")
		_, err = h.DB.Exec(ctx, `
			INSERT INTO question_banks (id, tenant_id, code, name, description, status, question_count, creator_id,
				batch_id, version, owner_type, is_draft_pool)
			VALUES ($1,$2,$3,$4,$5,'draft',0,$6,$7,'v1.0','mine',false)
		`, bankID, tenantID, code, name, description, userID, batchID)
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

func (h *QuestionBankImportHandler) lookupEvaluationBatch(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM evaluation_batches WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}
