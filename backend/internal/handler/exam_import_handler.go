package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ExamImportHandler struct {
	DB *pgxpool.Pool
}

type examImportResult struct {
	Created        int
	Failed         int
	Skipped        int
	Errors         []string
	DuplicateItems []ImportPreviewItem
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

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "解析Excel文件失败")
		return
	}
	defer xlsx.Close()

	result := &examImportResult{}
	h.importExams(r.Context(), xlsx, tenantID, claims.UserID, true, false, nil, result)

	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
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

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "解析Excel文件失败")
		return
	}
	defer xlsx.Close()

	result := &examImportResult{}
	examMap := make(map[string]string)
	h.importExams(r.Context(), xlsx, tenantID, claims.UserID, false, overwrite, examMap, result)
	if len(examMap) > 0 {
		h.importExamQuestions(r.Context(), xlsx, tenantID, examMap, result)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"skipped": result.Skipped,
		"entity":  "试卷",
		"errors":  result.Errors,
	})
}

func (h *ExamImportHandler) importExams(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, examMap map[string]string, result *examImportResult) {
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

		batchID := h.lookupEvaluationBatch(ctx, tenantID, batchName)

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

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM exams WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existingID)
		exists := err == nil && existingID != ""

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

		if exists {
			if overwrite {
				_, err := h.DB.Exec(ctx, `
					UPDATE exams SET name=$1, description=$2, batch_id=$3, updated_at=NOW()
					WHERE id=$4 AND tenant_id=$5
				`, name, description, batchID, existingID, tenantID)
				if err != nil {
					result.Failed++
					msg := fmt.Sprintf("试卷[%s]更新失败: %v", name, err)
					result.Errors = append(result.Errors, msg)
					slog.Info(fmt.Sprintf("[import/exams] %s", msg))
					continue
				}
				// 覆盖时清空原有题目关联，随后根据新文件内容重新写入
				_, _ = h.DB.Exec(ctx, `DELETE FROM exam_questions WHERE exam_id=$1`, existingID)
				if examMap != nil {
					examMap[name] = existingID
				}
				result.Created++
				slog.Info(fmt.Sprintf("[import/exams] updated exam %s (id=%s)", name, existingID))
			} else {
				result.Skipped++
			}
			continue
		}

		examID := uuid.NewString()
		code := generateEntityCode("SJ")
		_, err = h.DB.Exec(ctx, `
			INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration,
				batch_id, version, owner_type, creator_id, is_temp)
			VALUES ($1,$2,$3,$4,$5,'draft',0,60,$6,'v1.0','mine',$7,false)
		`, examID, tenantID, code, name, description, batchID, userID)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("试卷[%s]创建失败: %v", name, err)
			result.Errors = append(result.Errors, msg)
			slog.Info(fmt.Sprintf("[import/exams] %s", msg))
			continue
		}

		if examMap != nil {
			examMap[name] = examID
		}
		result.Created++
		slog.Info(fmt.Sprintf("[import/exams] created exam %s (id=%s)", name, examID))
	}
}

func (h *ExamImportHandler) importExamQuestions(ctx context.Context, xlsx *excelize.File, tenantID string, examMap map[string]string, result *examImportResult) {
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

		var qID, qType, qContent, qAnswer, qAnalysis string
		var qOptions []byte
		err := h.DB.QueryRow(ctx, `
			SELECT id, type, content, options, answer, analysis
			FROM questions WHERE tenant_id=$1 AND content=$2 LIMIT 1
		`, tenantID, questionContent).Scan(&qID, &qType, &qContent, &qOptions, &qAnswer, &qAnalysis)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("试卷[%s]题目[%s]未找到", examName, questionContent))
			continue
		}

		sortCounter[examID]++
		_, err = h.DB.Exec(ctx, `
			INSERT INTO exam_questions (id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, uuid.NewString(), examID, qID, qType, qContent, qOptions, qAnswer, qAnalysis, score, sortCounter[examID])
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("试卷[%s]题目[%s]关联失败: %v", examName, questionContent, err))
			continue
		}
	}
}

func (h *ExamImportHandler) lookupEvaluationBatch(ctx context.Context, tenantID, name string) *string {
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

func parseIntDefault(s string, defaultVal int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}
