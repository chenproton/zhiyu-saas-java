package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type GranularCourseImportHandler struct {
	Store *store.Store
}

type granularCourseImportResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
}

func (h *GranularCourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
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
		result := &granularCourseImportResult{}
		h.importCourses(ctx, xlsx, tenantID, claims.UserID, true, false, false, result)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Duplicates += len(result.DuplicateItems)
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, result.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, result.Errors...)
	})

	respondJSON(w, http.StatusOK, aggregated)
}

func (h *GranularCourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := &granularCourseImportResult{}
	mfu.ForEach(func(xlsx *excelize.File) {
		h.importCourses(ctx, xlsx, tenantID, userID, false, overwrite, rename, aggregated)
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "颗粒课",
		"errors":            aggregated.Errors,
		"sheets":            mfu.FirstSheets(),
	})
}

func (h *GranularCourseImportHandler) importCourses(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, result *granularCourseImportResult) {
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
		majorName := col(row, 1)
		difficulty := parseIntDefault(col(row, 2), 0)
		duration := parseFloatDefault(col(row, 3), 0)
		learningGoal := col(row, 4)
		knowledgeNames := splitTrim(col(row, 5), ",")
		resourceNames := splitTrim(col(row, 6), ",")
		batchName := col(row, 7)

		majorID := lookupMajorID(ctx, h.Store.Q(), tenantID, majorName)
		batchID := lookupBatchID(ctx, h.Store.Q(), "lesson_batches", tenantID, batchName)

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

		existingID, existingCreator, existingCoCreators, exists := store.GranularImportFindGranularCourseIdentity(ctx, h.Store.Q(), tenantID, name)

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
			if !canOverwriteContent(existingCreator, existingCoCreators, userID) {
				result.PermissionSkipped++
				continue
			}
		}

		// 覆盖权限判定通过后才创建知识点与资源（preview 与权限不足路径均无写副作用）
		knowledgePointIDs := findOrCreateKnowledgePoints(ctx, h.Store.Q(), tenantID, knowledgeNames)
		resourceIDs := findOrCreateResources(ctx, h.Store.Q(), tenantID, resourceNames, userID)

		if exists && overwrite {
			err := store.GranularImportUpdateGranularCourseByImport(ctx, h.Store.Q(), existingID, tenantID, majorID, batchID, diffPtr, descPtr, durPtr, knowledgePointIDs, resourceIDs)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]更新失败: %v", name, err))
				continue
			}
			if err := h.replaceCourseBindings(ctx, existingID, tenantID, knowledgePointIDs, resourceIDs); err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]关联更新失败: %v", name, err))
				continue
			}
			continue
		}
		if exists {
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			name = uniqueSuffixed(name, func(c string) bool {
				_, found := store.GranularImportFindGranularCourseIDByName(ctx, h.Store.Q(), tenantID, c)
				return found
			})
		}

		if preview {
			result.Created++
			continue
		}

		courseID := uuid.NewString()
		code := h.generateGranularCourseCode(ctx, tenantID)
		err = store.GranularImportInsertGranularCourseByImport(ctx, h.Store.Q(), courseID, tenantID, code, name, majorID, durPtr, diffPtr, descPtr, userID, batchID, knowledgePointIDs, resourceIDs)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]创建失败: %v", name, err))
			continue
		}
		if err := h.replaceCourseBindings(ctx, courseID, tenantID, knowledgePointIDs, resourceIDs); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("颗粒课[%s]关联写入失败: %v", name, err))
			continue
		}
		result.Created++
	}
}

func (h *GranularCourseImportHandler) replaceCourseBindings(ctx context.Context, courseID, tenantID string, knowledgePointIDs, resourceIDs []string) error {
	if err := store.GranularImportDeleteCourseKnowledgeBindings(ctx, h.Store.Q(), courseID); err != nil {
		return fmt.Errorf("清空课程知识点绑定失败: %w", err)
	}
	if err := store.GranularImportDeleteCourseResourceBindings(ctx, h.Store.Q(), courseID); err != nil {
		return fmt.Errorf("清空课程资源绑定失败: %w", err)
	}

	for _, kpID := range knowledgePointIDs {
		if err := store.GranularImportInsertCourseKnowledgeBinding(ctx, h.Store.Q(), uuid.NewString(), tenantID, courseID, kpID); err != nil {
			return fmt.Errorf("写入课程知识点绑定失败: %w", err)
		}
	}

	for _, resID := range resourceIDs {
		if err := store.GranularImportInsertCourseResourceBinding(ctx, h.Store.Q(), uuid.NewString(), tenantID, courseID, resID); err != nil {
			return fmt.Errorf("写入课程资源绑定失败: %w", err)
		}
	}
	return nil
}

func (h *GranularCourseImportHandler) generateGranularCourseCode(ctx context.Context, tenantID string) string {
	year := time.Now().Format("2006")
	maxNum := store.GranularImportMaxGranularCourseCodeNum(ctx, h.Store.Q(), tenantID, year)
	return fmt.Sprintf("GRA-%s-%04d", year, maxNum+1)
}
