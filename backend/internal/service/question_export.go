package service

// QuestionExportService QuestionExportHandler 业务编排下沉（原 question_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// QuestionExportService 业务编排服务。
type QuestionExportService struct {
	s *Service
}

func NewQuestionExportService(s *Service) *QuestionExportService {
	return &QuestionExportService{s: s}
}

func (s *QuestionExportService) FillQuestionsData(ctx context.Context, f *excelize.File, tenantID, bankID string, questionIDs []string) error {
	dataStyle := MakeDataStyle(f)
	wrapAlign := MakeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	failed := 0
	for ri, qid := range questionIDs {
		question, err := s.s.Store().Questions().Get(ctx, qid, tenantID)
		if err != nil {
			failed++
			slog.Warn("导出题目行跳过", "questionId", qid, "error", err)
			continue
		}
		qType := string(question.Type)
		content := question.Content
		analysis := ""
		if question.Analysis != nil {
			analysis = *question.Analysis
		}
		difficulty := ""
		if question.Difficulty != nil {
			difficulty = *question.Difficulty
		}
		source := ""
		if question.Source != nil {
			source = *question.Source
		}
		score := question.Score
		knowledgePointIDs := question.KnowledgePoints
		options := question.Options

		var answers []string
		for _, a := range question.Answer {
			if s, ok := a.(string); ok {
				answers = append(answers, s)
			}
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
		// 第 5-8 个选项（UI 上限 8）写入 M 列之后，避免覆盖答案/解析等固定列导致选项丢失
		for i := 4; i < len(options); i++ {
			setCell("题目明细", fmt.Sprintf("%c%d", 'M'+(i-4), r), options[i])
		}
		setCell("题目明细", fmt.Sprintf("G%d", r), formatAnswerForExport(qType, answers, options))
		setCell("题目明细", fmt.Sprintf("H%d", r), analysis)
		setCell("题目明细", fmt.Sprintf("I%d", r), mapDifficultyToChinese(difficulty))
		setCell("题目明细", fmt.Sprintf("J%d", r), strings.Join(s.lookupKnowledgePointNames(ctx, tenantID, knowledgePointIDs), ","))
		setCell("题目明细", fmt.Sprintf("K%d", r), fmt.Sprintf("%.2f", score))
		setCell("题目明细", fmt.Sprintf("L%d", r), source)
		f.SetRowHeight("题目明细", r, 24)
	}

	if failed > 0 {
		return fmt.Errorf("%d 个题目数据导出失败", failed)
	}
	return nil
}

func (s *QuestionExportService) lookupKnowledgePointNames(ctx context.Context, tenantID string, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		if id == "" {
			continue
		}
		name, err := store.GetKnowledgePointNameByID(ctx, s.s.Store().Q(), id, tenantID)
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
