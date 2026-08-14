package service

// QuestionImportService QuestionImportHandler 业务编排下沉（原 question_import_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// QuestionImportService 业务编排服务。
type QuestionImportService struct {
	s *Service
}

func NewQuestionImportService(s *Service) *QuestionImportService {
	return &QuestionImportService{s: s}
}

func (s *QuestionImportService) ImportQuestions(ctx context.Context, xlsx *excelize.File, tenantID, userID, bankID string, preview, overwrite, rename bool) (ImportPreviewResult, ImportExecuteResult) {
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
		if qType == "" {
			msg := fmt.Sprintf("第%d行题型无法识别: %q", i+1, strings.TrimSpace(row[0]))
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
		content := strings.TrimSpace(row[1])
		options := []string{}
		for idx := 2; idx <= 5 && idx < len(row); idx++ {
			opt := strings.TrimSpace(row[idx])
			if opt != "" {
				options = append(options, opt)
			}
		}
		// 扩展选项列：M-P（列索引 12-15，对应导出端第 5-8 个选项）
		for idx := 12; idx <= 15 && idx < len(row); idx++ {
			opt := strings.TrimSpace(row[idx])
			if opt != "" {
				options = append(options, opt)
			}
		}
		answerRaw := Col(row, 6)
		analysis := NullableStr(Col(row, 7))
		difficulty := mapDifficulty(Col(row, 8))
		knowledgeNames := SplitTrim(Col(row, 9), ",")
		score := ParseFloatDefault(Col(row, 10), 0)
		source := Col(row, 11)
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

		existingID, existingCreator, err := store.FindQuestionByTenantBankContent(ctx, s.s.Store().Q(), tenantID, bankID, content)
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
				if !CanOverwriteContent(existingCreator, nil, userID) {
					execRes.PermissionSkipped++
					continue
				}
				knowledgeIDs := FindOrCreateKnowledgePoints(ctx, s.s.Store().Q(), tenantID, knowledgeNames)
				err = store.UpdateQuestionImport(ctx, s.s.Store().Q(), qType, string(optionsJSON), string(answerJSON), analysis, score, difficulty, knowledgeIDs, existingID)
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
				content = UniqueSuffixed(content, func(c string) bool {
					eid, _ := store.GetQuestionIDByTenantBankContent(ctx, s.s.Store().Q(), tenantID, bankID, c)
					return eid != ""
				})
			} else {
				execRes.Skipped++
				continue
			}
		}

		knowledgeIDs := FindOrCreateKnowledgePoints(ctx, s.s.Store().Q(), tenantID, knowledgeNames)
		questionID := uuid.NewString()
		code := store.GenerateEntityCode("TM")
		err = store.InsertQuestionImport(ctx, s.s.Store().Q(), questionID, tenantID, code, bankID, qType, content, string(optionsJSON), string(answerJSON), analysis, score, difficulty, knowledgeIDs, userID, source)
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
		// 未知题型返回空串，由调用方计入失败行，避免静默按单选题导入
		return ""
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
		parts := SplitTrim(answerRaw, ",")
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
		return SplitTrim(answerRaw, ","), nil
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
