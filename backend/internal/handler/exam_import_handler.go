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

type ExamImportHandler struct {
	Store *store.Store
}

type examImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

func (h *ExamImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := ImportPreviewResult{}
	mfu.ForEach(func(xlsx *excelize.File) {
		result := &examImportResult{}
		h.importExams(ctx, h.Store.Q(), xlsx, tenantID, claims.UserID, true, false, false, nil, result)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Duplicates += len(result.DuplicateItems)
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, result.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, result.Errors...)
	})

	respondJSON(w, http.StatusOK, aggregated)
}

func (h *ExamImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := &examImportResult{}
	// 覆盖导入整体包在事务内：overwrite 清空旧题目后按新文件重建，
	// 任一步失败整体回滚，防止"题目已清空、新题未写入"的中间态。
	if err := h.Store.WithTx(ctx, func(txStore *store.Store) error {
		mfu.ForEach(func(xlsx *excelize.File) {
			examMap := make(map[string]string)
			h.importExams(ctx, txStore.Q(), xlsx, tenantID, claims.UserID, false, overwrite, rename, examMap, aggregated)
			if len(examMap) > 0 {
				h.importExamQuestions(ctx, txStore.Q(), xlsx, tenantID, examMap, aggregated)
			}
		})
		return nil
	}); err != nil {
		slog.Error("[exam-import] 事务提交失败", "error", err)
		respondServerError(w, r, err, "导入提交失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "试卷",
		"errors":            aggregated.Errors,
	})
}

func (h *ExamImportHandler) importExams(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, examMap map[string]string, result *examImportResult) {
	rows, err := xlsx.GetRows("试卷基本信息")
	if err != nil {
		slog.Info(fmt.Sprintf("[import/exams] sheet '试卷基本信息' not found: %v", err))
		return
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

		batchID := lookupBatchID(ctx, q, "evaluation_batches", tenantID, batchName)

		if seen[name] {
			result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
				RowNum: i + 1,
				Key:    name,
				Name:   name,
			})
			if !preview {
				result.Skipped++
			}
			continue
		}
		seen[name] = true

		existingID, existingCreator, existingCollaborators, exists := store.GranularImportFindExamByName(ctx, q, tenantID, name)

		if preview {
			if exists {
				result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
					RowNum: i + 1,
					Key:    name,
					Name:   name,
				})
			} else {
				result.Created++
			}
			continue
		}

		origName := ""
		if exists {
			if overwrite {
				if !canOverwriteContent(existingCreator, existingCollaborators, userID) {
					result.PermissionSkipped++
					continue
				}
				err := store.GranularImportUpdateExamByImport(ctx, q, name, description, batchID, existingID, tenantID)
				if err != nil {
					result.Failed++
					msg := fmt.Sprintf("试卷[%s]更新失败: %v", name, err)
					result.Errors = append(result.Errors, msg)
					slog.Info(fmt.Sprintf("[import/exams] %s", msg))
					continue
				}
				// 覆盖时清空原有题目关联，随后根据新文件内容重新写入
				if err := store.GranularImportDeleteExamQuestions(ctx, q, existingID); err != nil {
					msg := fmt.Sprintf("试卷[%s]清空旧题目失败: %v", name, err)
					result.Errors = append(result.Errors, msg)
					slog.Error(fmt.Sprintf("[import/exams] %s", msg))
					continue
				}
				if examMap != nil {
					examMap[name] = existingID
				}
				result.Created++
				slog.Info(fmt.Sprintf("[import/exams] updated exam %s (id=%s)", name, existingID))
				continue
			}
			if rename {
				// rename 模式：追加随机后缀生成新名称，按新对象导入
				origName = name
				name = uniqueSuffixed(name, func(c string) bool {
					_, found := store.GranularImportFindExamIDByName(ctx, q, tenantID, c)
					return found
				})
			} else {
				result.Skipped++
				continue
			}
		}

		examID := uuid.NewString()
		code := generateEntityCode("SJ")
		err = store.GranularImportInsertExamByImport(ctx, q, examID, tenantID, code, name, description, batchID, userID)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("试卷[%s]创建失败: %v", name, err)
			result.Errors = append(result.Errors, msg)
			slog.Info(fmt.Sprintf("[import/exams] %s", msg))
			continue
		}

		if examMap != nil {
			examMap[name] = examID
			if origName != "" {
				examMap[origName] = examID
			}
		}
		result.Created++
		slog.Info(fmt.Sprintf("[import/exams] created exam %s (id=%s)", name, examID))
	}
}

func (h *ExamImportHandler) importExamQuestions(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID string, examMap map[string]string, result *examImportResult) {
	rows, err := xlsx.GetRows("试卷题目")
	if err != nil {
		return
	}

	sortCounter := make(map[string]int)
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 3 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		examName := strings.TrimSpace(row[0])
		questionContent := strings.TrimSpace(row[1])
		score := parseFloatDefault(col(row, 2), 0)

		examID, ok := examMap[examName]
		if !ok {
			result.Errors = append(result.Errors, fmt.Sprintf("试卷题目行[%s/%s]找不到试卷", examName, questionContent))
			continue
		}

		question, err := store.GranularImportFindQuestionByContent(ctx, q, tenantID, questionContent)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("试卷[%s]题目[%s]未找到", examName, questionContent))
			continue
		}

		sortCounter[examID]++
		err = store.GranularImportInsertExamQuestionByImport(ctx, q, uuid.NewString(), examID, question.ID, question.Type, question.Content, question.Options, question.Answer, question.Analysis, score, sortCounter[examID])
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("试卷[%s]题目[%s]关联失败: %v", examName, questionContent, err))
			continue
		}
	}
}
