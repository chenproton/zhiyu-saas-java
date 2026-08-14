package handler

import (
	"log/slog"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionBankImportHandler struct {
	Store *store.Store
	Svc   *service.QuestionBankImportService
}

func (h *QuestionBankImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
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

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}

	ctx := r.Context()
	aggregated := ImportPreviewResult{}
	mfu.ForEach(func(xlsx *excelize.File) {
		previewRes, _ := h.Svc.ImportBanks(ctx, xlsx, tenantID, userID, true, false, false)
		aggregated.Created += previewRes.Created
		aggregated.Failed += previewRes.Failed
		aggregated.Duplicates += previewRes.Duplicates
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, previewRes.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, previewRes.Errors...)
	})
	respondJSON(w, http.StatusOK, aggregated)
}

func (h *QuestionBankImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
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

	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	ctx := r.Context()
	aggregated := ImportExecuteResult{Entity: "题库"}
	mfu.ForEach(func(xlsx *excelize.File) {
		_, res := h.Svc.ImportBanks(ctx, xlsx, tenantID, userID, false, overwrite, rename)
		aggregated.Created += res.Created
		aggregated.Failed += res.Failed
		aggregated.Skipped += res.Skipped
		aggregated.PermissionSkipped += res.PermissionSkipped
		aggregated.Errors = append(aggregated.Errors, res.Errors...)
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "题库",
		"errors":            aggregated.Errors,
	})
}
