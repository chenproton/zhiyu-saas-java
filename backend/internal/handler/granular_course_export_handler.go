package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type GranularCourseExportHandler struct {
	DB *pgxpool.Pool
}

func (h *GranularCourseExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少课程ID")
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generateGranularCourseTemplate(ctx, tenantID)

	if err := h.fillCoursesData(ctx, f, tenantID, req.IDs); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "颗粒课导出.xlsx")
}

func (h *GranularCourseExportHandler) fillCoursesData(ctx context.Context, f *excelize.File, tenantID string, courseIDs []string) error {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	for ri, cid := range courseIDs {
		var name, desc string
		var majorID, batchID *string
		var difficulty *int
		var duration *float64
		err := h.DB.QueryRow(ctx, `
			SELECT name, COALESCE(description,''), major_id, batch_id, difficulty, online_hours
			FROM courses WHERE id=$1 AND tenant_id=$2 AND type='granular'
		`, cid, tenantID).Scan(&name, &desc, &majorID, &batchID, &difficulty, &duration)
		if err != nil {
			continue
		}

		majorName := ""
		if majorID != nil && *majorID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM majors WHERE id=$1`, *majorID).Scan(&majorName)
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM lesson_batches WHERE id=$1`, *batchID).Scan(&batchName)
		}

		diffStr := ""
		if difficulty != nil && *difficulty > 0 {
			diffStr = fmt.Sprintf("%d", *difficulty)
		}

		durationStr := ""
		if duration != nil && *duration > 0 {
			durationStr = fmt.Sprintf("%.1f", *duration)
		}

		knowledgeNames := h.lookupCourseKnowledgePointNames(ctx, tenantID, cid)
		resourceNames := h.lookupCourseResourceNames(ctx, tenantID, cid)

		r := 3 + ri
		setCell("课程基本信息", fmt.Sprintf("A%d", r), name)
		setCell("课程基本信息", fmt.Sprintf("B%d", r), majorName)
		setCell("课程基本信息", fmt.Sprintf("C%d", r), diffStr)
		setCell("课程基本信息", fmt.Sprintf("D%d", r), durationStr)
		setCell("课程基本信息", fmt.Sprintf("E%d", r), desc)
		setCell("课程基本信息", fmt.Sprintf("F%d", r), strings.Join(knowledgeNames, ","))
		setCell("课程基本信息", fmt.Sprintf("G%d", r), strings.Join(resourceNames, ","))
		setCell("课程基本信息", fmt.Sprintf("H%d", r), batchName)
		f.SetRowHeight("课程基本信息", r, 24)
	}

	return nil
}

func (h *GranularCourseExportHandler) lookupCourseKnowledgePointNames(ctx context.Context, tenantID, courseID string) []string {
	rows, err := h.DB.Query(ctx, `
		SELECT kp.name FROM knowledge_points kp
		JOIN course_knowledge_bindings cb ON cb.knowledge_point_id = kp.id
		WHERE cb.course_id=$1 AND cb.bind_type='course' AND cb.tenant_id=$2
		ORDER BY kp.name
	`, courseID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		if n != "" {
			names = append(names, n)
		}
	}
	return names
}

func (h *GranularCourseExportHandler) lookupCourseResourceNames(ctx context.Context, tenantID, courseID string) []string {
	rows, err := h.DB.Query(ctx, `
		SELECT r.name FROM resource_library r
		JOIN course_resource_bindings cb ON cb.resource_id = r.id
		WHERE cb.course_id=$1 AND cb.tenant_id=$2
		ORDER BY r.name
	`, courseID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		if n != "" {
			names = append(names, n)
		}
	}
	return names
}
