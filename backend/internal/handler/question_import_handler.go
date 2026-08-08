package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionImportHandler struct {
	Store *store.Store
}

func (h *QuestionImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
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
	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}

	var existingBank string
	err := h.Store.Q().QueryRow(r.Context(), `SELECT id FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&existingBank)
	if err != nil {
		respondError(w, http.StatusBadRequest, "题库不存在")
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
		previewRes, _ := h.importQuestions(ctx, xlsx, tenantID, userID, bankID, true, false, false)
		aggregated.Created += previewRes.Created
		aggregated.Failed += previewRes.Failed
		aggregated.Duplicates += previewRes.Duplicates
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, previewRes.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, previewRes.Errors...)
	})
	respondJSON(w, http.StatusOK, aggregated)
}

func (h *QuestionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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
	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}

	var existingBank string
	err := h.Store.Q().QueryRow(r.Context(), `SELECT id FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&existingBank)
	if err != nil {
		respondError(w, http.StatusBadRequest, "题库不存在")
		return
	}

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	ctx := r.Context()
	aggregated := ImportExecuteResult{Entity: "题目"}
	mfu.ForEach(func(xlsx *excelize.File) {
		_, res := h.importQuestions(ctx, xlsx, tenantID, userID, bankID, false, overwrite, rename)
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
		"entity":            "题目",
		"errors":            aggregated.Errors,
	})
}

func (h *QuestionImportHandler) importQuestions(ctx context.Context, xlsx *excelize.File, tenantID, userID, bankID string, preview, overwrite, rename bool) (ImportPreviewResult, ImportExecuteResult) {
	var previewRes ImportPreviewResult
	var execRes ImportExecuteResult

	rows, err := xlsx.GetRows("题目明细")
	if err != nil {
		slog.Info(fmt.Sprintf("[import/questions] sheet '题目明细' not found: %v", err))
		return previewRes, execRes
	}

	seen := make(map[string]bool)
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}

		qType := mapQuestionType(strings.TrimSpace(row[0]))
		content := strings.TrimSpace(row[1])
		options := []string{}
		for idx := 2; idx <= 5 && idx < len(row); idx++ {
			opt := strings.TrimSpace(row[idx])
			if opt != "" {
				options = append(options, opt)
			}
		}
		answerRaw := col(row, 6)
		analysis := nullableStr(col(row, 7))
		difficulty := mapDifficulty(col(row, 8))
		knowledgeNames := splitTrim(col(row, 9), ",")
		score := parseFloatDefault(col(row, 10), 0)
		source := col(row, 11)
		if source == "" {
			source = "Excel导入"
		}

		answer, err := buildAnswer(qType, answerRaw, options)
		if err != nil {
			msg := fmt.Sprintf("第%d行题目答案解析失败: %v", i+1, err)
			if preview {
				previewRes.Failed++
				previewRes.Errors = append(previewRes.Errors, msg)
			} else {
				execRes.Failed++
				execRes.Errors = append(execRes.Errors, msg)
			}
			slog.Info(fmt.Sprintf("[import/questions] %s", msg))
			continue
		}

		answerJSON, _ := json.Marshal(answer)
		optionsJSON, _ := json.Marshal(options)

		key := bankID + "|" + content
		if seen[key] {
			previewRes.Duplicates++
			if len(previewRes.DuplicateItems) < 100 {
				previewRes.DuplicateItems = append(previewRes.DuplicateItems, ImportPreviewItem{
					RowNum: i + 1,
					Key:    content,
					Name:   content,
				})
			}
			if !preview {
				execRes.Skipped++
			}
			continue
		}
		seen[key] = true

		var existingID, existingCreator string
		err = h.Store.Q().QueryRow(ctx, `SELECT id, creator_id FROM questions WHERE tenant_id=$1 AND bank_id=$2 AND content=$3 LIMIT 1`, tenantID, bankID, content).Scan(&existingID, &existingCreator)
		found := err == nil && existingID != ""

		if preview {
			if found {
				previewRes.Duplicates++
				if len(previewRes.DuplicateItems) < 100 {
					previewRes.DuplicateItems = append(previewRes.DuplicateItems, ImportPreviewItem{
						RowNum: i + 1,
						Key:    content,
						Name:   content,
					})
				}
			} else {
				previewRes.Created++
			}
			continue
		}

		if found {
			if overwrite {
				if !canOverwriteContent(existingCreator, nil, userID) {
					execRes.PermissionSkipped++
					continue
				}
				knowledgeIDs := findOrCreateKnowledgePoints(ctx, h.Store.Q(), tenantID, knowledgeNames)
				_, err = h.Store.Q().Exec(ctx, `
					UPDATE questions SET type=$1, options=$2, answer=$3, analysis=$4, score=$5, difficulty=$6, knowledge_point_ids=$7
					WHERE id=$8
				`, qType, string(optionsJSON), string(answerJSON), analysis, score, difficulty, knowledgeIDs, existingID)
				if err != nil {
					execRes.Failed++
					msg := fmt.Sprintf("第%d行题目更新失败: %v", i+1, err)
					execRes.Errors = append(execRes.Errors, msg)
					slog.Info(fmt.Sprintf("[import/questions] %s", msg))
					continue
				}
				execRes.Created++
				continue
			}
			if rename {
				// rename 模式：追加随机后缀生成新题干，按新对象导入
				content = uniqueSuffixed(content, func(c string) bool {
					var eid string
					_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM questions WHERE tenant_id=$1 AND bank_id=$2 AND content=$3 LIMIT 1`, tenantID, bankID, c).Scan(&eid)
					return eid != ""
				})
			} else {
				execRes.Skipped++
				continue
			}
		}

		knowledgeIDs := findOrCreateKnowledgePoints(ctx, h.Store.Q(), tenantID, knowledgeNames)
		questionID := uuid.NewString()
		code := generateEntityCode("TM")
		_, err = h.Store.Q().Exec(ctx, `
			INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
		`, questionID, tenantID, code, bankID, qType, content, string(optionsJSON), string(answerJSON), analysis, score, difficulty, knowledgeIDs, userID, source)
		if err != nil {
			execRes.Failed++
			msg := fmt.Sprintf("第%d行题目创建失败: %v", i+1, err)
			execRes.Errors = append(execRes.Errors, msg)
			slog.Info(fmt.Sprintf("[import/questions] %s", msg))
			continue
		}

		execRes.Created++
	}

	return previewRes, execRes
}

func mapQuestionType(t string) string {
	switch strings.TrimSpace(t) {
	case "单选题":
		return "single"
	case "多选题":
		return "multiple"
	case "判断题":
		return "judge"
	case "填空题":
		return "fill"
	case "问答题":
		return "essay"
	case "简答题":
		return "short_answer"
	default:
		t = strings.ToLower(strings.TrimSpace(t))
		switch t {
		case "single", "multiple", "judge", "fill", "essay", "short_answer":
			return t
		}
		return "single"
	}
}

func mapDifficulty(d string) *string {
	switch strings.TrimSpace(d) {
	case "简单", "easy":
		s := "easy"
		return &s
	case "中等", "medium":
		s := "medium"
		return &s
	case "困难", "hard":
		s := "hard"
		return &s
	default:
		return nil
	}
}

func buildAnswer(qType, answerRaw string, options []string) ([]string, error) {
	answerRaw = strings.TrimSpace(answerRaw)
	if answerRaw == "" {
		return []string{}, nil
	}

	switch qType {
	case "single":
		ans := mapOptionLetter(answerRaw, options)
		if ans == "" {
			ans = answerRaw
		}
		return []string{ans}, nil
	case "multiple":
		parts := splitTrim(answerRaw, ",")
		var result []string
		for _, p := range parts {
			mapped := mapOptionLetter(p, options)
			if mapped == "" {
				mapped = p
			}
			result = append(result, mapped)
		}
		if len(result) == 0 {
			return []string{answerRaw}, nil
		}
		return result, nil
	case "judge":
		switch strings.ToLower(answerRaw) {
		case "正确", "对", "true", "1", "是":
			return []string{"true"}, nil
		case "错误", "错", "false", "0", "否":
			return []string{"false"}, nil
		default:
			return []string{answerRaw}, nil
		}
	case "fill":
		return splitTrim(answerRaw, ","), nil
	case "essay", "short_answer":
		return []string{answerRaw}, nil
	default:
		return []string{answerRaw}, nil
	}
}

func mapOptionLetter(val string, options []string) string {
	val = strings.TrimSpace(val)
	if len(val) != 1 {
		return ""
	}
	idx := -1
	switch val {
	case "A", "a":
		idx = 0
	case "B", "b":
		idx = 1
	case "C", "c":
		idx = 2
	case "D", "d":
		idx = 3
	}
	if idx >= 0 && idx < len(options) {
		return options[idx]
	}
	return ""
}
