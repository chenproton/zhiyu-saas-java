package handler

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ImportExportHandler struct {
	DB *pgxpool.Pool
}

var importExportEntities = map[string]importExportEntity{
	"question_banks": {
		displayName: "题库",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id, version, owner_type, is_draft_pool)
			VALUES ($1, $2, $3, $4, 'draft', 0, $5, 'v1.0', 'tenant', FALSE)
		`,
		updateSQL:   `UPDATE question_banks SET name=$1, description=$2, updated_at=NOW() WHERE id=$3`,
		defaultCols: []string{"id", "name", "description", "status", "created_at"},
	},
	"exams": {
		displayName: "试卷",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, creator_id, version, owner_type)
			VALUES ($1, $2, $3, $4, 'draft', 0, 60, $5, 'v1.0', 'tenant')
		`,
		updateSQL:   `UPDATE exams SET name=$1, description=$2, updated_at=NOW() WHERE id=$3`,
		defaultCols: []string{"id", "name", "description", "status", "created_at"},
	},
	"courses": {
		displayName: "课程",
		keyCol:      "code",
		insertSQL: `
			INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, co_creator_ids, node_count, resource_count, study_count)
			VALUES ($1, $2, $3, $4, 'system', '导入', 'draft', $5, '{}', 0, 0, 0)
		`,
		updateSQL:   `UPDATE courses SET code=$1, name=$2, updated_at=NOW() WHERE id=$3`,
		defaultCols: []string{"id", "code", "name", "status", "created_at"},
	},
	"career_positions": {
		displayName: "岗位",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO career_positions (id, tenant_id, name, short_name, position_type, status, creator_id)
			VALUES ($1, $2, $3, $4, 'other', 'draft', $5)
		`,
		updateSQL:   `UPDATE career_positions SET name=$1, short_name=$2, updated_at=NOW() WHERE id=$3`,
		defaultCols: []string{"id", "name", "short_name", "status", "created_at"},
	},
	"scenarios": {
		displayName: "场景",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO scenarios (id, tenant_id, name, code, status, creator_id, co_builder_ids, version)
			VALUES ($1, $2, $3, $4, 'draft', $5, '{}', 'v1.0')
		`,
		updateSQL:   `UPDATE scenarios SET name=$1, code=$2, updated_at=NOW() WHERE id=$3`,
		defaultCols: []string{"id", "name", "code", "status", "created_at"},
	},
}

type importExportEntity struct {
	displayName string
	keyCol      string
	insertSQL   string
	updateSQL   string
	defaultCols []string
}

func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
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

	cols := strings.Join(meta.defaultCols, ", ")
	rows, err := h.DB.Query(r.Context(), fmt.Sprintf(`SELECT %s FROM %s ORDER BY created_at DESC LIMIT 1000`, cols, entity))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "导出失败")
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

func parseImportCSV(r *http.Request) ([]importRow, []string, error) {
	reader := csv.NewReader(r.Body)
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("empty or invalid csv")
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

	rows, parseErrors, err := parseImportCSV(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
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

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	overwrite := importOverwriteParam(r)

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

	rows, parseErrors, err := parseImportCSV(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	created := 0
	skipped := 0
	failed := len(parseErrors)
	for _, row := range rows {
		key := row.name
		if meta.keyCol == "code" {
			key = row.code
		}
		existingID, exists := h.findExistingByKey(r.Context(), entity, tenantID, meta.keyCol, key)
		if exists {
			if overwrite {
				_, execErr := h.DB.Exec(r.Context(), meta.updateSQL, row.name, row.code, existingID)
				if execErr != nil {
					failed++
					continue
				}
				created++
			} else {
				skipped++
			}
			continue
		}

		id := uuid.NewString()
		_, execErr := h.DB.Exec(r.Context(), meta.insertSQL, id, tenantID, row.name, row.code, claims.UserID)
		if execErr != nil {
			failed++
			continue
		}
		created++
	}

	respondJSON(w, http.StatusOK, ImportExecuteResult{
		Created: created,
		Failed:  failed,
		Skipped: skipped,
		Entity:  meta.displayName,
		Errors:  parseErrors,
	})
}

func (h *ImportExportHandler) findExistingByKey(ctx context.Context, entity, tenantID, keyCol, key string) (string, bool) {
	var id string
	query := fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND %s=$2 LIMIT 1", entity, keyCol)
	err := h.DB.QueryRow(ctx, query, tenantID, key).Scan(&id)
	return id, err == nil && id != ""
}

func getCol(record []string, idx map[string]int, col string) string {
	i, ok := idx[col]
	if !ok || i >= len(record) {
		return ""
	}
	return record[i]
}
