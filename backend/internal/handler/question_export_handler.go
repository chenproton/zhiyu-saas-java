package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionExportHandler struct {
	Store *store.Store
}

func (h *QuestionExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}

	ctx := r.Context()
	var existingBank string
	err := h.Store.Q().QueryRow(ctx, `SELECT id FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&existingBank)
	if err != nil {
		respondError(w, http.StatusBadRequest, "题库不存在")
		return
	}

	ids, ok := decodeIDList(w, r, "缺少题目ID")
	if !ok {
		return
	}

	th := &TemplateHandler{Store: h.Store}
	f := th.generateQuestionTemplate(ctx, tenantID, bankID)

	if err := h.fillQuestionsData(ctx, f, tenantID, bankID, ids); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "题目导出.xlsx")
}

func (h *QuestionExportHandler) fillQuestionsData(ctx context.Context, f *excelize.File, tenantID, bankID string, questionIDs []string) error {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	failed := 0
	for ri, qid := range questionIDs {
		var qType, content, answerJSON, analysis, difficulty, source string
		var score float64
		var optionsJSON []byte
		var knowledgePointIDs []string
		err := h.Store.Q().QueryRow(ctx, `
			SELECT type, content, options, answer, analysis, score, difficulty,
			       knowledge_point_ids, COALESCE(source,'')
			FROM questions
			WHERE id=$1 AND bank_id=$2 AND tenant_id=$3
		`, qid, bankID, tenantID).Scan(&qType, &content, &optionsJSON, &answerJSON, &analysis, &score, &difficulty, &knowledgePointIDs, &source)
		if err != nil {
			failed++
			slog.Warn("导出题目行跳过", "questionId", qid, "error", err)
			continue
		}

		var options []string
		if len(optionsJSON) > 0 {
			_ = json.Unmarshal(optionsJSON, &options)
		}

		var answers []string
		if answerJSON != "" {
			_ = json.Unmarshal([]byte(answerJSON), &answers)
		}

		r := 3 + ri
		setCell("题目明细", fmt.Sprintf("A%d", r), mapQuestionTypeToChinese(qType))
		setCell("题目明细", fmt.Sprintf("B%d", r), content)
		for i := 0; i < 4; i++ {
			opt := ""
			if i < len(options) {
				opt = options[i]
			}
			setCell("题目明细", fmt.Sprintf("%c%d", 'C'+i, r), opt)
		}
		setCell("题目明细", fmt.Sprintf("G%d", r), formatAnswerForExport(qType, answers, options))
		setCell("题目明细", fmt.Sprintf("H%d", r), analysis)
		setCell("题目明细", fmt.Sprintf("I%d", r), mapDifficultyToChinese(difficulty))
		setCell("题目明细", fmt.Sprintf("J%d", r), strings.Join(h.lookupKnowledgePointNames(ctx, tenantID, knowledgePointIDs), ","))
		setCell("题目明细", fmt.Sprintf("K%d", r), fmt.Sprintf("%.2f", score))
		setCell("题目明细", fmt.Sprintf("L%d", r), source)
		f.SetRowHeight("题目明细", r, 24)
	}

	if failed > 0 {
		return fmt.Errorf("%d 个题目数据导出失败", failed)
	}
	return nil
}

func (h *QuestionExportHandler) lookupKnowledgePointNames(ctx context.Context, tenantID string, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		if id == "" {
			continue
		}
		var name string
		err := h.Store.Q().QueryRow(ctx, `SELECT name FROM knowledge_points WHERE id=$1 AND tenant_id=$2`, id, tenantID).Scan(&name)
		if err == nil && name != "" {
			names = append(names, name)
		}
	}
	return names
}

func mapQuestionTypeToChinese(t string) string {
	switch t {
	case "single":
		return "单选题"
	case "multiple":
		return "多选题"
	case "judge":
		return "判断题"
	case "fill":
		return "填空题"
	case "essay":
		return "问答题"
	case "short_answer":
		return "简答题"
	default:
		return t
	}
}

func mapDifficultyToChinese(d string) string {
	switch d {
	case "easy":
		return "简单"
	case "medium":
		return "中等"
	case "hard":
		return "困难"
	default:
		return d
	}
}

func formatAnswerForExport(qType string, answers, options []string) string {
	switch qType {
	case "single":
		if len(answers) == 0 {
			return ""
		}
		if letter := mapOptionToLetter(answers[0], options); letter != "" {
			return letter
		}
		return answers[0]
	case "multiple":
		var parts []string
		for _, ans := range answers {
			if letter := mapOptionToLetter(ans, options); letter != "" {
				parts = append(parts, letter)
			} else {
				parts = append(parts, ans)
			}
		}
		return strings.Join(parts, ",")
	case "judge":
		if len(answers) == 0 {
			return ""
		}
		switch strings.ToLower(answers[0]) {
		case "true", "1", "是", "正确", "对":
			return "正确"
		case "false", "0", "否", "错误", "错":
			return "错误"
		default:
			return answers[0]
		}
	case "fill":
		return strings.Join(answers, ",")
	case "essay", "short_answer":
		if len(answers) == 0 {
			return ""
		}
		return answers[0]
	default:
		return strings.Join(answers, ",")
	}
}

func mapOptionToLetter(val string, options []string) string {
	for i, opt := range options {
		if strings.TrimSpace(opt) == strings.TrimSpace(val) {
			switch i {
			case 0:
				return "A"
			case 1:
				return "B"
			case 2:
				return "C"
			case 3:
				return "D"
			}
		}
	}
	return ""
}
