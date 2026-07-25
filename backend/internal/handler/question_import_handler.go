package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type QuestionImportHandler struct {
	DB *pgxpool.Pool
}

func (h *QuestionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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
	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "missing bank id")
		return
	}

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

	// verify bank exists
	var existingBank string
	err = h.DB.QueryRow(r.Context(), `SELECT id FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&existingBank)
	if err != nil {
		respondError(w, http.StatusBadRequest, "题库不存在")
		return
	}

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	result := &questionImportResult{}
	h.importQuestions(r.Context(), xlsx, tenantID, userID, bankID, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"skipped": result.Skipped,
		"entity":  "题目",
		"errors":  result.Errors,
	})
}

type questionImportResult struct {
	Created int
	Failed  int
	Skipped int
	Errors  []string
}

func (h *QuestionImportHandler) importQuestions(ctx context.Context, xlsx *excelize.File, tenantID, userID, bankID string, result *questionImportResult) {
	rows, err := xlsx.GetRows("题目明细")
	if err != nil {
		log.Printf("[import/questions] sheet '题目明细' not found: %v", err)
		return
	}

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
			result.Failed++
			msg := fmt.Sprintf("第%d行题目答案解析失败: %v", i+1, err)
			result.Errors = append(result.Errors, msg)
			log.Printf("[import/questions] %s", msg)
			continue
		}

		answerJSON, _ := json.Marshal(answer)
		optionsJSON, _ := json.Marshal(options)

		knowledgeIDs := h.findOrCreateKnowledgePoints(ctx, tenantID, knowledgeNames)

		questionID := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO questions (id, tenant_id, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft')
		`, questionID, tenantID, bankID, qType, content, string(optionsJSON), string(answerJSON), analysis, score, difficulty, knowledgeIDs, userID, source)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("第%d行题目创建失败: %v", i+1, err)
			result.Errors = append(result.Errors, msg)
			log.Printf("[import/questions] %s", msg)
			continue
		}

		result.Created++
	}
}

func (h *QuestionImportHandler) findOrCreateKnowledgePoints(ctx context.Context, tenantID string, names []string) []string {
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, err = h.DB.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
		if err != nil {
			log.Printf("[import/questions] create knowledge point %s failed: %v", name, err)
		}
		var existing string
		err = h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
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
