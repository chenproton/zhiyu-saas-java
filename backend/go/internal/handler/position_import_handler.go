package handler

// 岗位 Excel 导入 HTTP 适配：鉴权/租户/文件解析/响应映射，
// 业务编排在 service.PositionImportService（refactor-layering.md 分层契约）。

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/service"
)

type PositionImportHandler struct {
	Svc *service.PositionImportService
}

// importResult 别名（唯一出处：service.PositionImportService）。
type importResult = service.PositionImportResult

func (h *PositionImportHandler) processImport(r *http.Request, w http.ResponseWriter, preview bool) {
	irc := parseMultiImportRequest(w, r, false)
	if irc == nil {
		return
	}

	ctx := r.Context()
	aggregated := &importResult{}

	irc.MFU.ForEach(func(xlsx *excelize.File) {
		result := h.Svc.ImportPositions(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Skipped += result.Skipped
		aggregated.PermissionSkipped += result.PermissionSkipped
		aggregated.PositionCreated += result.PositionCreated
		aggregated.RespCreated += result.RespCreated
		aggregated.BindingCreated += result.BindingCreated
		aggregated.DuplicateItems = append(aggregated.DuplicateItems, result.DuplicateItems...)
		aggregated.Errors = append(aggregated.Errors, result.Errors...)
	})

	if preview {
		previewRes := ImportPreviewResult{
			Created:        aggregated.Created,
			Failed:         aggregated.Failed,
			Duplicates:     len(aggregated.DuplicateItems),
			DuplicateItems: aggregated.DuplicateItems,
			Errors:         aggregated.Errors,
		}
		slog.Info(fmt.Sprintf("[import/preview/positions] result: created=%d duplicates=%d failed=%d errors=%d",
			previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.Errors)))
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/positions] result: created=%d failed=%d skipped=%d positions=%d responsibilities=%d bindings=%d errors=%d",
		aggregated.Created, aggregated.Failed, aggregated.Skipped, aggregated.PositionCreated, aggregated.RespCreated, aggregated.BindingCreated, len(aggregated.Errors)))
	for _, e := range aggregated.Errors {
		slog.Info(fmt.Sprintf("[import/positions] error: %s", e))
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "岗位",
		"positionCreated":   aggregated.PositionCreated,
		"responsibilities":  aggregated.RespCreated,
		"abilityBindings":   aggregated.BindingCreated,
		"errors":            aggregated.Errors,
		"sheets":            irc.MFU.FirstSheets(),
	})
}

func (h *PositionImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, true)
}

func (h *PositionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, false)
}
