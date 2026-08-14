package handler

// 排课 Excel 导入 HTTP 适配：鉴权/租户/文件解析/响应映射，
// 业务编排与事务边界在 service.ScheduleImportService（refactor-layering.md 分层契约）。

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type ScheduleImportHandler struct {
	Svc *service.ScheduleImportService
}

// scheduleImportResult 别名（唯一出处：service.ScheduleImportService）。
type scheduleImportResult = service.ScheduleImportResult

// PreviewExcel POST /import/schedules/preview — 解析并校验，不写库。
func (h *ScheduleImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	if !hasSheet(sheets, "课程列表") {
		respondError(w, http.StatusBadRequest, "文件缺少「课程列表」Sheet，请使用排课导入模板")
		return
	}

	result := h.Svc.Preview(r.Context(), xlsx, tenantID)
	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

// ImportExcel POST /import/schedules/excel?termId= — 按「课程列表」Sheet 清空重排导入。
// termId 为目标学期，缺省时从第一个有效课程的教学计划推断。
func (h *ScheduleImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	termID := strings.TrimSpace(r.URL.Query().Get("termId"))

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	if !hasSheet(sheets, "课程列表") {
		respondError(w, http.StatusBadRequest, "文件缺少「课程列表」Sheet，请使用排课导入模板")
		return
	}

	result := h.Svc.ImportFromCourseList(r.Context(), xlsx, tenantID, termID)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created, "failed": result.Failed, "skipped": result.Skipped,
		"entity": "排课", "errors": result.Errors, "sheets": sheets,
	})
}

func hasSheet(sheets []string, name string) bool {
	for _, s := range sheets {
		if s == name {
			return true
		}
	}
	return false
}
