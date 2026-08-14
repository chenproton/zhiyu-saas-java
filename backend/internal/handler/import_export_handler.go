package handler

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// maxCSVImportBodySize CSV 模板导入/预览的总请求体上限（含 multipart 头部余量），
// 防认证用户超大 multipart 溢出磁盘（配合 10 次/分钟限流，对齐 security-standards §5 思路）。
const maxCSVImportBodySize = 30 << 20

type ImportExportHandler struct {
	Store *store.Store
}

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

type importRow struct {
	rowNum int
	name   string
	code   string
}

// parseImportCSVFile 从已上传的文件句柄解析 CSV（r.Body 已被 ParseMultipartForm 消费，不能再读）。
func parseImportCSVFile(f multipart.File) ([]importRow, []string, error) {
	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("CSV 为空或格式无效")
	}

	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[strings.TrimSpace(h)] = i
	}

	var rows []importRow
	var errors []string
	rowNum := 2
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errors = append(errors, fmt.Sprintf("第%d行读取失败", rowNum))
			rowNum++
			continue
		}
		if len(record) == 0 {
			rowNum++
			continue
		}

		name := strings.TrimSpace(getCol(record, colIdx, "name"))
		code := strings.TrimSpace(getCol(record, colIdx, "code"))
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "试卷名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "题库名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "课程名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "岗位名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "场景名称"))
		}
		if name == "" {
			errors = append(errors, fmt.Sprintf("第%d行名称不能为空", rowNum))
			rowNum++
			continue
		}
		if code == "" {
			code = fmt.Sprintf("IMP-%s", uuid.NewString()[:8])
		}

		rows = append(rows, importRow{rowNum: rowNum, name: name, code: code})
		rowNum++
	}
	return rows, errors, nil
}

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

	rows, parseErrors, err := parseImportCSVFile(file)
	if err != nil {
		slog.Error("解析导入文件失败", "error", err)
		respondError(w, http.StatusBadRequest, "解析导入文件失败")
		return
	}

	result := &ImportPreviewResult{
		Errors: parseErrors,
	}
	for _, row := range rows {
		key := row.name
		if meta.KeyCol == "code" {
			key = row.code
		}
		_, exists := h.findExistingByKey(r.Context(), entity, tenantID, meta.KeyCol, key)
		if exists {
			result.Duplicates++
			if len(result.DuplicateItems) < 100 {
				result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
					RowNum: row.rowNum,
					Key:    key,
					Name:   row.name,
				})
			}
		} else {
			result.Created++
		}
	}

	respondJSON(w, http.StatusOK, result)
}

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
	if !canManagePortal(claims) {
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

	rows, parseErrors, err := parseImportCSVFile(file)
	if err != nil {
		slog.Error("解析导入文件失败", "error", err)
		respondError(w, http.StatusBadRequest, "解析导入文件失败")
		return
	}

	created := 0
	skipped := 0
	failed := len(parseErrors)
	permissionSkipped := 0
	for _, row := range rows {
		key := row.name
		if meta.KeyCol == "code" {
			key = row.code
		}
		existingID, exists := h.findExistingByKey(r.Context(), entity, tenantID, meta.KeyCol, key)
		if exists {
			if overwrite {
				// 归属检查：非本人创建且未参与共建的资源跳过覆盖（与 Excel 导入路径一致）
				if creator, coCreatorIDs, found := store.GranularImportImportExportOwnerCheck(r.Context(), h.Store.Q(), entity, existingID); found {
					if !canOverwriteContent(creator, coCreatorIDs, claims.UserID) {
						permissionSkipped++
						continue
					}
				}
				if err := store.GranularImportImportExportUpdate(r.Context(), h.Store.Q(), entity, row.name, row.code, existingID); err != nil {
					failed++
					continue
				}
				created++
				continue
			}
			if rename {
				// 追加 4 位随机后缀生成新的唯一键，按新对象导入
				name, code := row.name, row.code
				for i := 0; i < 20; i++ {
					if meta.KeyCol == "code" {
						code = suffixedName(row.code)
						if _, again := h.findExistingByKey(r.Context(), entity, tenantID, meta.KeyCol, code); !again {
							break
						}
					} else {
						name = suffixedName(row.name)
						if _, again := h.findExistingByKey(r.Context(), entity, tenantID, meta.KeyCol, name); !again {
							break
						}
					}
				}
				id := uuid.NewString()
				if err := store.GranularImportImportExportInsert(r.Context(), h.Store.Q(), entity, id, tenantID, name, code, claims.UserID); err != nil {
					failed++
					continue
				}
				created++
				continue
			}
			skipped++
			continue
		}

		id := uuid.NewString()
		if err := store.GranularImportImportExportInsert(r.Context(), h.Store.Q(), entity, id, tenantID, row.name, row.code, claims.UserID); err != nil {
			failed++
			continue
		}
		created++
	}

	respondJSON(w, http.StatusOK, ImportExecuteResult{
		Created:           created,
		Failed:            failed,
		Skipped:           skipped,
		PermissionSkipped: permissionSkipped,
		Entity:            meta.DisplayName,
		Errors:            parseErrors,
	})
}

func (h *ImportExportHandler) findExistingByKey(ctx context.Context, entity, tenantID, keyCol, key string) (string, bool) {
	return store.GranularImportFindImportExportByKey(ctx, h.Store.Q(), entity, tenantID, keyCol, key)
}

func getCol(record []string, idx map[string]int, col string) string {
	i, ok := idx[col]
	if !ok || i >= len(record) {
		return ""
	}
	return record[i]
}
