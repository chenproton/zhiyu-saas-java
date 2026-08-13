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

type ImportExportHandler struct {
	Store *store.Store
}

var importExportEntities = map[string]importExportEntity{
	"question_banks": {
		displayName: "题库",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id, version, owner_type, is_draft_pool)
			VALUES ($1, $2, $3, $4, 'draft', 0, $5, 'V1.0', 'tenant', FALSE)
		`,
		updateSQL:     `UPDATE question_banks SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT creator_id, '{}'::uuid[] FROM question_banks WHERE id=$1`,
		defaultCols:   []string{"id", "name", "description", "status", "created_at"},
	},
	"exams": {
		displayName: "试卷",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, creator_id, version, owner_type)
			VALUES ($1, $2, $3, $4, 'draft', 0, 60, $5, 'V1.0', 'tenant')
		`,
		updateSQL:     `UPDATE exams SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT creator_id, '{}'::uuid[] FROM exams WHERE id=$1`,
		defaultCols:   []string{"id", "name", "description", "status", "created_at"},
	},
	"courses": {
		displayName: "课程",
		keyCol:      "code",
		insertSQL: `
			INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, co_creator_ids, node_count, resource_count, study_count)
			VALUES ($1, $2, $3, $4, 'system', '导入', 'draft', $5, '{}', 0, 0, 0)
		`,
		updateSQL:     `UPDATE courses SET name=$1, code=$2, updated_at=NOW() WHERE id=$3`,
		ownerCheckSQL: `SELECT creator_id, co_creator_ids FROM courses WHERE id=$1`,
		defaultCols:   []string{"id", "code", "name", "status", "created_at"},
	},
	"career_positions": {
		displayName: "岗位",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO career_positions (id, tenant_id, name, short_name, position_type, status, created_by)
			VALUES ($1, $2, $3, $4, 'other', 'draft', $5)
		`,
		updateSQL:     `UPDATE career_positions SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT created_by, collaborators FROM career_positions WHERE id=$1`,
		defaultCols:   []string{"id", "name", "short_name", "status", "created_at"},
	},
	"scenarios": {
		displayName: "场景",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO scenarios (id, tenant_id, name, code, status, created_by, collaborators, version)
			VALUES ($1, $2, $3, $4, 'draft', $5, '{}', 'V1.0')
		`,
		updateSQL:     `UPDATE scenarios SET name=$1, code=$2, updated_at=NOW() WHERE id=$3`,
		ownerCheckSQL: `SELECT created_by, collaborators FROM scenarios WHERE id=$1`,
		defaultCols:   []string{"id", "name", "code", "status", "created_at"},
	},
}

type importExportEntity struct {
	displayName string
	keyCol      string
	insertSQL   string
	updateSQL   string
	// ownerCheckSQL 覆盖时归属检查（返回 creator_id/created_by + 共建人数组列）
	ownerCheckSQL string
	defaultCols   []string
}

func importExportEntityNames() []string {
	names := make([]string, 0, len(importExportEntities))
	for k := range importExportEntities {
		names = append(names, k)
	}
	return names
}

func importExportKeyColumns() []string {
	cols := make([]string, 0, len(importExportEntities))
	seen := make(map[string]bool)
	for _, meta := range importExportEntities {
		if !seen[meta.keyCol] {
			seen[meta.keyCol] = true
			cols = append(cols, meta.keyCol)
		}
	}
	return cols
}

func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	entity := chi.URLParam(r, "entity")
	entity, err := store.SanitizeIdentifier(entity, importExportEntityNames())
	if err != nil {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}
	meta := importExportEntities[entity]

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	cols := strings.Join(meta.defaultCols, ", ")
	rows, err := h.Store.Q().Query(r.Context(), fmt.Sprintf(`SELECT %s FROM %s WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000`, cols, entity), tenantID)
	if err != nil {
		respondServerError(w, r, err, "导出失败")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-export-%s.csv", entity, time.Now().Format("20060102")))
	cw := csv.NewWriter(w)
	defer cw.Flush()

	_ = cw.Write(meta.defaultCols)
	fieldDescs := rows.FieldDescriptions()
	values := make([]interface{}, len(fieldDescs))
	scanArgs := make([]interface{}, len(fieldDescs))
	for i := range values {
		scanArgs[i] = &values[i]
	}
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			continue
		}
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
	meta, ok := importExportEntities[entity]
	if !ok {
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

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
		if meta.keyCol == "code" {
			key = row.code
		}
		_, exists := h.findExistingByKey(r.Context(), entity, tenantID, meta.keyCol, key)
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
	meta, ok := importExportEntities[entity]
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
		if meta.keyCol == "code" {
			key = row.code
		}
		existingID, exists := h.findExistingByKey(r.Context(), entity, tenantID, meta.keyCol, key)
		if exists {
			if overwrite {
				// 归属检查：非本人创建且未参与共建的资源跳过覆盖（与 Excel 导入路径一致）
				if meta.ownerCheckSQL != "" {
					var creatorID *string
					var coCreatorIDs []string
					if err := h.Store.Q().QueryRow(r.Context(), meta.ownerCheckSQL, existingID).Scan(&creatorID, &coCreatorIDs); err == nil {
						creator := ""
						if creatorID != nil {
							creator = *creatorID
						}
						if !canOverwriteContent(creator, coCreatorIDs, claims.UserID) {
							permissionSkipped++
							continue
						}
					}
				}
				// 按 updateSQL 占位符数传参：2 参（仅 name）/ 3 参（name, code）
				updateArgs := []any{row.name}
				if strings.Count(meta.updateSQL, "$") == 3 {
					updateArgs = append(updateArgs, row.code)
				}
				updateArgs = append(updateArgs, existingID)
				_, execErr := h.Store.Q().Exec(r.Context(), meta.updateSQL, updateArgs...)
				if execErr != nil {
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
					if meta.keyCol == "code" {
						code = suffixedName(row.code)
						if _, again := h.findExistingByKey(r.Context(), entity, tenantID, meta.keyCol, code); !again {
							break
						}
					} else {
						name = suffixedName(row.name)
						if _, again := h.findExistingByKey(r.Context(), entity, tenantID, meta.keyCol, name); !again {
							break
						}
					}
				}
				id := uuid.NewString()
				_, execErr := h.Store.Q().Exec(r.Context(), meta.insertSQL, id, tenantID, name, code, claims.UserID)
				if execErr != nil {
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
		_, execErr := h.Store.Q().Exec(r.Context(), meta.insertSQL, id, tenantID, row.name, row.code, claims.UserID)
		if execErr != nil {
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
		Entity:            meta.displayName,
		Errors:            parseErrors,
	})
}

func (h *ImportExportHandler) findExistingByKey(ctx context.Context, entity, tenantID, keyCol, key string) (string, bool) {
	entity, err := store.SanitizeIdentifier(entity, importExportEntityNames())
	if err != nil {
		return "", false
	}
	keyCol, err = store.SanitizeIdentifier(keyCol, importExportKeyColumns())
	if err != nil {
		return "", false
	}
	var id string
	query := fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND %s=$2 LIMIT 1", entity, keyCol)
	err = h.Store.Q().QueryRow(ctx, query, tenantID, key).Scan(&id)
	return id, err == nil && id != ""
}

func getCol(record []string, idx map[string]int, col string) string {
	i, ok := idx[col]
	if !ok || i >= len(record) {
		return ""
	}
	return record[i]
}
