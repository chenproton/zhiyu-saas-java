package handler

import (
	"context"
	"fmt"
	"log"
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
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	previewRes, _ := h.importBanks(r.Context(), xlsx, tenantID, userID, true, false)
	respondJSON(w, http.StatusOK, previewRes)
}

func (h *QuestionBankImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	overwrite := importOverwriteParam(r)
	_, result := h.importBanks(r.Context(), xlsx, tenantID, userID, false, overwrite)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"skipped": result.Skipped,
		"entity":  "题库",
		"errors":  result.Errors,
	})
}

func (h *QuestionBankImportHandler) importBanks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool) (ImportPreviewResult, ImportExecuteResult) {
	var previewRes ImportPreviewResult
	var execRes ImportExecuteResult

	rows, err := xlsx.GetRows("题库基本信息")
	if err != nil {
		log.Printf("[import/question-banks] sheet '题库基本信息' not found: %v", err)
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
					log.Printf("[import/question-banks] %s", msg)
					continue
				}
				execRes.Created++
				log.Printf("[import/question-banks] updated bank %s (id=%s)", name, existingID)
			} else {
				execRes.Skipped++
			}
			continue
		}

		bankID := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id,
				batch_id, version, owner_type, is_draft_pool)
			VALUES ($1,$2,$3,$4,'draft',0,$5,$6,'v1.0','mine',false)
		`, bankID, tenantID, name, description, userID, batchID)
		if err != nil {
			execRes.Failed++
			msg := fmt.Sprintf("题库[%s]创建失败: %v", name, err)
			execRes.Errors = append(execRes.Errors, msg)
			log.Printf("[import/question-banks] %s", msg)
			continue
		}

		execRes.Created++
		log.Printf("[import/question-banks] created bank %s (id=%s)", name, bankID)
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
