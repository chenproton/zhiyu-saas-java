package handler

// 基础实体 CSV 模板导入/导出 HTTP 适配：鉴权/租户/文件解析/响应映射，
// 业务编排在 service.CsvImportService（refactor-layering.md 分层契约）。

import (
	"encoding/csv"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ImportExportHandler struct {
	Store *store.Store
	Svc   *service.CsvImportService
}

const (
	// maxCSVImportBodySize CSV 模板导入/预览的总请求体上限（含 multipart 头部余量），
	// 防认证用户超大 multipart 溢出磁盘（配合 10 次/分钟限流，对齐 security-standards §5 思路）。
	maxCSVImportBodySize = 30 << 20
)

// Export GET /import/{entity}/csv — 导出实体现有数据为 CSV 模板。
func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	entity := chi.URLParam(r, "entity")
	entity, err := store.SanitizeIdentifier(entity, store.GranularImportImportExportEntityNames())
	if err != nil {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}
	meta, ok := store.GranularImportImportExportEntity(entity)
	if !ok {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	rows, err := store.GranularImportExportImportExportRows(r.Context(), h.Store.Q(), entity, tenantID)
	if err != nil {
		respondServerError(w, r, err, "导出失败")
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-export-%s.csv", entity, time.Now().Format("20060102")))
	cw := csv.NewWriter(w)
	defer cw.Flush()

	_ = cw.Write(meta.DefaultCols)
	for _, values := range rows {
		record := make([]string, len(values))
		for i, v := range values {
			record[i] = fmt.Sprintf("%v", v)
		}
		_ = cw.Write(record)
	}
}

// Preview POST /import/{entity}/csv/preview — 解析并统计重复条目，不写库。
func (h *ImportExportHandler) Preview(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	entity := chi.URLParam(r, "entity")
	meta, ok := store.GranularImportImportExportEntity(entity)
	if !ok {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxCSVImportBodySize)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	rows, parseErrors, err := service.ParseCSV(file)
	if err != nil {
		slog.Error("解析导入文件失败", "error", err)
		respondError(w, http.StatusBadRequest, "解析导入文件失败")
		return
	}

	out := h.Svc.Preview(r.Context(), entity, tenantID, meta.KeyCol, rows, parseErrors)
	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        out.Created,
		Duplicates:     len(out.DuplicateItems),
		Failed:         out.Failed,
		DuplicateItems: out.DuplicateItems,
		Errors:         out.ParseErrors,
	})
}

// Import POST /import/{entity}/csv — 按 CSV 模板导入基础实体。
func (h *ImportExportHandler) Import(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	entity := chi.URLParam(r, "entity")
	meta, ok := store.GranularImportImportExportEntity(entity)
	if !ok {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}
	// 与 Excel 导入路径一致的权限门槛：基础实体导入限学校管理员（企业导师无导入权）
	if !canManagePortal(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	r.Body = http.MaxBytesReader(w, r.Body, maxCSVImportBodySize)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	rows, parseErrors, err := service.ParseCSV(file)
	if err != nil {
		slog.Error("解析导入文件失败", "error", err)
		respondError(w, http.StatusBadRequest, "解析导入文件失败")
		return
	}

	out := h.Svc.Import(r.Context(), entity, tenantID, meta.KeyCol, claims.UserID, overwrite, rename, rows, parseErrors)
	respondJSON(w, http.StatusOK, ImportExecuteResult{
		Created:           out.Created,
		Failed:            out.Failed,
		Skipped:           out.Skipped,
		PermissionSkipped: out.PermissionSkipped,
		Entity:            meta.DisplayName,
		Errors:            out.ParseErrors,
	})
}
