package handler

import (
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
		insertSQL: `
			INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id, version, owner_type, is_draft_pool)
			VALUES ($1, $2, $3, $4, 'draft', 0, $5, 'v1.0', 'tenant', FALSE)
		`,
		defaultCols: []string{"id", "name", "description", "status", "created_at"},
	},
	"exams": {
		displayName: "试卷",
		insertSQL: `
			INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, creator_id, version, owner_type)
			VALUES ($1, $2, $3, $4, 'draft', 0, 60, $5, 'v1.0', 'tenant')
		`,
		defaultCols: []string{"id", "name", "description", "status", "created_at"},
	},
	"courses": {
		displayName: "课程",
		insertSQL: `
			INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, co_creator_ids, node_count, resource_count, study_count)
			VALUES ($1, $2, $3, $4, 'system', '导入', 'draft', $5, '{}', 0, 0, 0)
		`,
		defaultCols: []string{"id", "code", "name", "status", "created_at"},
	},
	"career_positions": {
		displayName: "岗位",
		insertSQL: `
			INSERT INTO career_positions (id, tenant_id, name, short_name, position_type, status, creator_id)
			VALUES ($1, $2, $3, $4, 'other', 'draft', $5)
		`,
		defaultCols: []string{"id", "name", "short_name", "status", "created_at"},
	},
	"scenarios": {
		displayName: "场景",
		insertSQL: `
			INSERT INTO scenarios (id, tenant_id, name, code, status, creator_id, co_builder_ids, version)
			VALUES ($1, $2, $3, $4, 'draft', $5, '{}', 'v1.0')
		`,
		defaultCols: []string{"id", "name", "code", "status", "created_at"},
	},
}

type importExportEntity struct {
	displayName string
	insertSQL   string
	defaultCols []string
}

func (h *ImportExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	entity := chi.URLParam(r, "entity")
	meta, ok := importExportEntities[entity]
	if !ok {
		respondError(w, http.StatusBadRequest, "unsupported entity")
		return
	}

	cols := strings.Join(meta.defaultCols, ", ")
	rows, err := h.DB.Query(r.Context(), fmt.Sprintf(`SELECT %s FROM %s ORDER BY created_at DESC LIMIT 1000`, cols, entity))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to export")
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

func (h *ImportExportHandler) Import(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	entity := chi.URLParam(r, "entity")
	meta, ok := importExportEntities[entity]
	if !ok {
		respondError(w, http.StatusBadRequest, "unsupported entity")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		respondError(w, http.StatusBadRequest, "empty or invalid csv")
		return
	}

	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[strings.TrimSpace(h)] = i
	}

	created := 0
	failed := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			failed++
			continue
		}
		if len(record) == 0 {
			continue
		}

		id := uuid.NewString()
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
			failed++
			continue
		}
		if code == "" {
			code = fmt.Sprintf("IMP-%s", uuid.NewString()[:8])
		}

		_, execErr := h.DB.Exec(r.Context(), meta.insertSQL, id, tenantID, name, code, claims.UserID)
		if execErr != nil {
			failed++
			continue
		}
		created++
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": created,
		"failed":  failed,
		"entity":  meta.displayName,
	})
}

func getCol(record []string, idx map[string]int, col string) string {
	i, ok := idx[col]
	if !ok || i >= len(record) {
		return ""
	}
	return record[i]
}
