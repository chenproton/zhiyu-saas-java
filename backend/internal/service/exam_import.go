package service

// ExamImportService 试卷 Excel 导入业务编排：事务边界、试卷/题目两级导入、
// 覆盖/改名策略全部收敛在此（原 exam_import_handler.go 内联逻辑下沉）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ExamImportService 试卷 Excel 导入编排服务。
type ExamImportService struct {
	s *Service
}

func NewExamImportService(s *Service) *ExamImportService {
	return &ExamImportService{s: s}
}

// ExamImportResult 试卷导入结果聚合。
type ExamImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

// Preview 预览单个文件：统计将创建/重复的试卷条目，不写库。
func (s *ExamImportService) Preview(ctx context.Context, tenantID, userID string, xlsx *excelize.File) *ExamImportResult {
	result := &ExamImportResult{}
	s.importExams(ctx, s.s.Store().Q(), xlsx, tenantID, userID, true, false, false, nil, result)
	return result
}

// Import 导入全部文件：覆盖导入整体包在事务内（overwrite 清空旧题目后按新文件重建，
// 任一步失败整体回滚，防止"题目已清空、新题未写入"的中间态）。
func (s *ExamImportService) Import(ctx context.Context, tenantID, userID string, overwrite, rename bool, files []*excelize.File) *ExamImportResult {
	aggregated := &ExamImportResult{}
	if err := s.s.WithTx(ctx, func(txStore *store.Store) error {
		for _, xlsx := range files {
			examMap := make(map[string]string)
			s.importExams(ctx, txStore.Q(), xlsx, tenantID, userID, false, overwrite, rename, examMap, aggregated)
			if len(examMap) > 0 {
				s.importExamQuestions(ctx, txStore.Q(), xlsx, tenantID, examMap, aggregated)
			}
		}
		return nil
	}); err != nil {
		slog.Error("[exam-import] 事务提交失败", "error", err)
		aggregated.Errors = append(aggregated.Errors, fmt.Sprintf("事务提交失败: %v", err))
	}
	return aggregated
}

func (s *ExamImportService) importExams(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, examMap map[string]string, result *ExamImportResult) {
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
		description := NullableStr(Col(row, 1))
		batchName := Col(row, 2)

		batchID := LookupBatchID(ctx, q, "evaluation_batches", tenantID, batchName)

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
				if !CanOverwriteContent(existingCreator, existingCollaborators, userID) {
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
				name = UniqueSuffixed(name, func(c string) bool {
					_, found := store.GranularImportFindExamIDByName(ctx, q, tenantID, c)
					return found
				})
			} else {
				result.Skipped++
				continue
			}
		}

		examID := uuid.NewString()
		code := store.GenerateEntityCode("SJ")
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

func (s *ExamImportService) importExamQuestions(ctx context.Context, q store.Queryer, xlsx *excelize.File, tenantID string, examMap map[string]string, result *ExamImportResult) {
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
		score := ParseFloatDefault(Col(row, 2), 0)

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
