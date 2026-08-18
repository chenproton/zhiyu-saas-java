package handler

// 体系课 Excel 导入 HTTP 适配：鉴权/租户/文件解析/响应映射，
// 业务编排与事务边界在 service.CourseImportService（refactor-layering.md 分层契约）。

import (
	"log/slog"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type CourseImportHandler struct {
	Svc *service.CourseImportService
}

// CourseImportResult 别名（唯一出处：service.CourseImportService）。
type CourseImportResult = service.CourseImportResult

func (h *CourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
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
		result := h.Svc.Preview(ctx, tenantID, claims.UserID, xlsx)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Duplicates += len(result.DuplicateItems)
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, result.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, result.Errors...)
	})

	respondJSON(w, http.StatusOK, aggregated)
}

func (h *CourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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

	defer func() {
		for _, f := range mfu.Files {
			f.Close()
		}
	}()
	aggregated := h.Svc.Import(r.Context(), tenantID, userID, overwrite, rename, mfu.Files)

	if len(aggregated.Errors) > 0 {
		slog.Info("[course-import] 存在错误条目", "created", aggregated.Created, "failed", aggregated.Failed, "errors", aggregated.Errors)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "体系课",
		"courseCreated":     aggregated.CourseCreated,
		"nodeCreated":       aggregated.NodeCreated,
		"errors":            aggregated.Errors,
		"sheets":            mfu.FirstSheets(),
	})
}
