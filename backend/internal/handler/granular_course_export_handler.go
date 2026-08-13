package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type GranularCourseExportHandler struct {
	Store *store.Store
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

	ids, ok := decodeIDList(w, r, "缺少课程ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generateGranularCourseTemplate(ctx, tenantID)

	if err := h.fillCoursesData(ctx, f, tenantID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "颗粒课导出.xlsx")
}

func (h *GranularCourseExportHandler) fillCoursesData(ctx context.Context, f *excelize.File, tenantID string, courseIDs []string) error {
	setCell := newSetCell(f)

	for ri, cid := range courseIDs {
		course, err := h.Store.Courses().Get(ctx, cid, tenantID)
		if err != nil || course.Type != "granular" {
			slog.Warn("导出颗粒课行跳过", "courseId", cid, "error", err)
			continue
		}
		name := course.Name
		desc := ""
		if course.Description != nil {
			desc = *course.Description
		}
		majorID := course.MajorID
		batchID := course.BatchID
		difficulty := course.Difficulty
		duration := course.OnlineHours

		majorName := ""
		if majorID != nil && *majorID != "" {
			majorName, err = h.Store.Majors().GetNameByID(ctx, h.Store.Q(), *majorID)
			if err != nil {
				slog.Warn("导出颗粒课专业名查询失败", "majorId", *majorID, "error", err)
				majorName = ""
			}
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			batchName, err = h.Store.Batches().GetNameByTable(ctx, h.Store.Q(), "lesson_batches", *batchID)
			if err != nil {
				slog.Warn("导出颗粒课批次名查询失败", "batchId", *batchID, "error", err)
				batchName = ""
			}
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
	names, err := store.GranularImportListCourseKnowledgePointNamesForExport(ctx, h.Store.Q(), courseID, tenantID)
	if err != nil {
		return nil
	}
	return names
}

func (h *GranularCourseExportHandler) lookupCourseResourceNames(ctx context.Context, tenantID, courseID string) []string {
	names, err := store.GranularImportListCourseResourceNamesForExport(ctx, h.Store.Q(), courseID, tenantID)
	if err != nil {
		return nil
	}
	return names
}
