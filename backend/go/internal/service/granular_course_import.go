package service

// GranularCourseImportService GranularCourseImportHandler 业务编排下沉（原 granular_course_import_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// GranularCourseImportService 业务编排服务。
type GranularCourseImportService struct {
	s *Service
}

func NewGranularCourseImportService(s *Service) *GranularCourseImportService {
	return &GranularCourseImportService{s: s}
}

type GranularCourseImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

func (s *GranularCourseImportService) ImportCourses(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, result *GranularCourseImportResult) {
	rows, err := xlsx.GetRows("课程基本信息")
	if err != nil {
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
		majorName := Col(row, 1)
		difficulty := ParseIntDefault(Col(row, 2), 0)
		duration := ParseFloatDefault(Col(row, 3), 0)
		learningGoal := Col(row, 4)
		knowledgeNames := SplitTrim(Col(row, 5), ",")
		resourceNames := SplitTrim(Col(row, 6), ",")
		batchName := Col(row, 7)

		majorID := LookupMajorID(ctx, s.s.Store().Q(), tenantID, majorName)
		batchID := LookupBatchID(ctx, s.s.Store().Q(), "lesson_batches", tenantID, batchName)

		var descPtr *string
		if learningGoal != "" {
			descPtr = &learningGoal
		}
		var diffPtr *int
		if difficulty > 0 {
			diffPtr = &difficulty
		}
		var durPtr *float64
		if duration > 0 {
			durPtr = &duration
		}

		existingID, existingCreator, existingCoCreators, exists := store.GranularImportFindGranularCourseIdentity(ctx, s.s.Store().Q(), tenantID, name)

		if exists && preview {
			if len(result.DuplicateItems) < 100 {
				result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
					RowNum: i + 1,
					Key:    name,
					Name:   name,
				})
			}
			result.Skipped++
			continue
		}
		if exists && !overwrite && !rename {
			result.Skipped++
			continue
		}

		if exists && overwrite {
			if !CanOverwriteContent(existingCreator, existingCoCreators, userID) {
				result.PermissionSkipped++
				continue
			}
		}

		// 覆盖权限判定通过后才创建知识点与资源（preview 与权限不足路径均无写副作用）
		knowledgePointIDs := FindOrCreateKnowledgePoints(ctx, s.s.Store().Q(), tenantID, knowledgeNames)
		resourceIDs := FindOrCreateResources(ctx, s.s.Store().Q(), tenantID, resourceNames, userID)

		if exists && overwrite {
			err := store.GranularImportUpdateGranularCourseByImport(ctx, s.s.Store().Q(), existingID, tenantID, majorID, batchID, diffPtr, descPtr, durPtr, knowledgePointIDs, resourceIDs)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]更新失败: %v", name, err))
				continue
			}
			if err := s.replaceCourseBindings(ctx, existingID, tenantID, knowledgePointIDs, resourceIDs); err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]关联更新失败: %v", name, err))
				continue
			}
			continue
		}
		if exists {
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			name = UniqueSuffixed(name, func(c string) bool {
				_, found := store.GranularImportFindGranularCourseIDByName(ctx, s.s.Store().Q(), tenantID, c)
				return found
			})
		}

		if preview {
			result.Created++
			continue
		}

		courseID := uuid.NewString()
		code := s.generateGranularCourseCode(ctx, tenantID)
		err = store.GranularImportInsertGranularCourseByImport(ctx, s.s.Store().Q(), courseID, tenantID, code, name, majorID, durPtr, diffPtr, descPtr, userID, batchID, knowledgePointIDs, resourceIDs)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]创建失败: %v", name, err))
			continue
		}
		if err := s.replaceCourseBindings(ctx, courseID, tenantID, knowledgePointIDs, resourceIDs); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]关联写入失败: %v", name, err))
			continue
		}
		result.Created++
	}
}

func (s *GranularCourseImportService) replaceCourseBindings(ctx context.Context, courseID, tenantID string, knowledgePointIDs, resourceIDs []string) error {
	if err := store.GranularImportDeleteCourseKnowledgeBindings(ctx, s.s.Store().Q(), courseID); err != nil {
		return fmt.Errorf("清空课程知识点绑定失败: %w", err)
	}
	if err := store.GranularImportDeleteCourseResourceBindings(ctx, s.s.Store().Q(), courseID); err != nil {
		return fmt.Errorf("清空课程资源绑定失败: %w", err)
	}

	for _, kpID := range knowledgePointIDs {
		if err := store.GranularImportInsertCourseKnowledgeBinding(ctx, s.s.Store().Q(), uuid.NewString(), tenantID, courseID, kpID); err != nil {
			return fmt.Errorf("写入课程知识点绑定失败: %w", err)
		}
	}

	for _, resID := range resourceIDs {
		if err := store.GranularImportInsertCourseResourceBinding(ctx, s.s.Store().Q(), uuid.NewString(), tenantID, courseID, resID); err != nil {
			return fmt.Errorf("写入课程资源绑定失败: %w", err)
		}
	}
	return nil
}

func (s *GranularCourseImportService) generateGranularCourseCode(ctx context.Context, tenantID string) string {
	year := time.Now().Format("2006")
	maxNum := store.GranularImportMaxGranularCourseCodeNum(ctx, s.s.Store().Q(), tenantID, year)
	return fmt.Sprintf("GRA-%s-%04d", year, maxNum+1)
}
