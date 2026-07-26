package handler

import (
	"context"
	"fmt"
	"log"
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

func (h *ExamImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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

	result := &examImportResult{}
	examMap := make(map[string]string)
	h.importExams(r.Context(), xlsx, tenantID, userID, examMap, result)
	if len(examMap) > 0 {
		h.importExamQuestions(r.Context(), xlsx, tenantID, examMap, result)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"entity":  "试卷",
		"errors":  result.Errors,
	})
}

type examImportResult struct {
	Created int
	Failed  int
	Errors  []string
}

func (h *ExamImportHandler) importExams(ctx context.Context, xlsx *excelize.File, tenantID, userID string, examMap map[string]string, result *examImportResult) {
	rows, err := xlsx.GetRows("试卷基本信息")
	if err != nil {
		log.Printf("[import/exams] sheet '试卷基本信息' not found: %v", err)
		return
	}

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

		examID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration,
				batch_id, version, owner_type, creator_id, is_temp)
			VALUES ($1,$2,$3,$4,'draft',0,60,$5,'v1.0','mine',$6,false)
		`, examID, tenantID, name, description, batchID, userID)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("试卷[%s]创建失败: %v", name, err)
			result.Errors = append(result.Errors, msg)
			log.Printf("[import/exams] %s", msg)
			continue
		}

		examMap[name] = examID
		result.Created++
		log.Printf("[import/exams] created exam %s (id=%s)", name, examID)
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

