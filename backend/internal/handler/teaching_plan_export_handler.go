package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// ExportExcel 导出教学计划全部内容（计划信息 + 教学计划条目）为 Excel。
func (h *TeachingPlanHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	plan, err := h.Service.GetTeachingPlan(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "教学计划不存在")
		return
	}
	entries, err := h.Service.ListTeachingPlanEntries(r.Context(), id, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询教学计划条目失败")
		return
	}

	f := buildTeachingPlanExcel(plan, entries)
	writeExcel(w, f, fmt.Sprintf("教学计划_%s.xlsx", plan.TermName))
}

func buildTeachingPlanExcel(plan *domain.TeachingPlan, entries []domain.TeachingPlanEntry) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	dataStyle := makeDataStyle(f)

	// Sheet 1: 计划信息
	infoSheet := "计划信息"
	f.SetSheetName("Sheet1", infoSheet)
	f.SetColWidth(infoSheet, "A", "A", 14)
	f.SetColWidth(infoSheet, "B", "B", 42)

	confirmedAt := "-"
	if plan.ConfirmedAt != nil {
		confirmedAt = plan.ConfirmedAt.Format("2006-01-02 15:04")
	}
	info := [][2]string{
		{"人培方案", plan.ProgramName},
		{"学期", plan.TermName},
		{"专业", plan.MajorName},
		{"年级", fmt.Sprintf("%d 级", plan.EntryYear)},
		{"状态", teachingPlanStatusLabel(plan.Status)},
		{"条目数", fmt.Sprintf("%d", plan.EntryCount)},
		{"生成时间", plan.GeneratedAt.Format("2006-01-02 15:04")},
		{"确认时间", confirmedAt},
	}
	for ri, kv := range info {
		r := ri + 1
		cellA := fmt.Sprintf("A%d", r)
		cellB := fmt.Sprintf("B%d", r)
		f.SetCellValue(infoSheet, cellA, kv[0])
		f.SetCellStyle(infoSheet, cellA, cellA, hdrStyle)
		f.SetCellValue(infoSheet, cellB, kv[1])
		f.SetCellStyle(infoSheet, cellB, cellB, dataStyle)
		f.SetRowHeight(infoSheet, r, 24)
	}

	// Sheet 2: 教学计划条目
	entrySheet := "教学计划条目"
	s2, _ := f.NewSheet(entrySheet)
	f.SetActiveSheet(s2)
	headers := []string{"序号", "课程", "课程编码", "类型", "学分", "总学时", "周学时", "起止周", "周次模式", "班级", "教师", "场地类型", "场景名称", "目标岗位", "状态"}
	widths := []float64{6, 26, 14, 8, 8, 8, 8, 12, 10, 28, 16, 12, 20, 18, 10}
	for ci, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 1)
		f.SetCellValue(entrySheet, cell, h)
		f.SetCellStyle(entrySheet, cell, cell, hdrStyle)
		f.SetColWidth(entrySheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(entrySheet, 1, 28)
	f.SetPanes(entrySheet, &excelize.Panes{Freeze: true, YSplit: 1})

	setCell := newSetCell(f)
	for ri, e := range entries {
		r := ri + 2
		className := e.ClassName
		if len(e.ClassNames) > 0 {
			className = strings.Join(e.ClassNames, "、")
		}
		courseCode := ""
		if e.CourseCode != nil {
			courseCode = *e.CourseCode
		}
		venueType := ""
		if e.VenueType != nil {
			venueType = *e.VenueType
		}
		vals := []interface{}{
			ri + 1,
			e.CourseName,
			courseCode,
			teachingPlanTypeLabel(e.Type),
			e.Credits,
			e.TotalHours,
			e.WeekHours,
			fmt.Sprintf("%d-%d周", e.StartWeek, e.EndWeek),
			teachingPlanWeekPatternLabel(e.WeekPattern),
			className,
			e.TeacherName,
			venueType,
			e.ScenarioName,
			e.PositionName,
			teachingPlanStatusLabel(e.Status),
		}
		for ci, v := range vals {
			setCell(entrySheet, fmt.Sprintf("%s%d", colName(ci+1), r), fmt.Sprintf("%v", v))
		}
		f.SetRowHeight(entrySheet, r, 24)
	}

	return f
}

func teachingPlanTypeLabel(t string) string {
	switch t {
	case "scene":
		return "场景"
	case "practice":
		return "实践"
	default: // theory / traditional
		return "课程"
	}
}

func teachingPlanWeekPatternLabel(p string) string {
	switch p {
	case "odd":
		return "单周"
	case "even":
		return "双周"
	default: // all
		return "每周"
	}
}

func teachingPlanStatusLabel(s string) string {
	switch s {
	case "draft":
		return "草稿"
	case "pending":
		return "审批中"
	case "approved":
		return "已通过"
	case "rejected":
		return "已驳回"
	case "published":
		return "已发布"
	case "archived":
		return "已归档"
	case "planned":
		return "待排课"
	case "scheduled":
		return "已排课"
	default:
		return s
	}
}
