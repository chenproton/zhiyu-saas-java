package handler

// 场景导入 HTTP 适配：鉴权/租户/文件解析/响应映射/缓存失效，
// 业务编排在 service.ScenarioImportService（refactor-layering.md 分层契约）。

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/redis/go-redis/v9"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioImportHandler struct {
	Store       *store.Store
	RedisClient *redis.Client
	Svc         *service.ScenarioImportService
}

// scenarioImportResult 别名（唯一出处：service.ScenarioImportService）。
type scenarioImportResult = service.ScenarioImportResult

func (h *ScenarioImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, true)
}

func (h *ScenarioImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, false)
}

func (h *ScenarioImportHandler) processImport(r *http.Request, w http.ResponseWriter, preview bool) {
	irc := parseMultiImportRequest(w, r, false)
	if irc == nil {
		return
	}

	ctx := r.Context()
	aggregated := &scenarioImportResult{}

	irc.MFU.ForEach(func(xlsx *excelize.File) {
		result := h.Svc.ImportFile(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename)
		aggregated.Created += result.Created
		aggregated.Failed += result.Failed
		aggregated.Skipped += result.Skipped
		aggregated.PermissionSkipped += result.PermissionSkipped
		aggregated.ScenarioCreated += result.ScenarioCreated
		aggregated.TaskCreated += result.TaskCreated
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
		slog.Info(fmt.Sprintf("[import/preview/scenarios] result: created=%d duplicates=%d failed=%d errors=%d",
			previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.Errors)))
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/scenarios] result: created=%d failed=%d skipped=%d scenarios=%d tasks=%d errors=%d",
		aggregated.Created, aggregated.Failed, aggregated.Skipped, aggregated.ScenarioCreated, aggregated.TaskCreated, len(aggregated.Errors)))
	for _, e := range aggregated.Errors {
		slog.Info(fmt.Sprintf("[import/scenarios] error: %s", e))
	}

	// 导入写库后失效场景列表缓存，避免用户导入后仍看到 2 分钟前的空列表
	if aggregated.Created > 0 && h.RedisClient != nil {
		cache.InvalidatePrefix(ctx, h.RedisClient, "zhiyu:"+irc.TenantID+":public:scenarios")
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "场景",
		"scenarioCreated":   aggregated.ScenarioCreated,
		"taskCreated":       aggregated.TaskCreated,
		"errors":            aggregated.Errors,
		"sheets":            irc.MFU.FirstSheets(),
	})
}
