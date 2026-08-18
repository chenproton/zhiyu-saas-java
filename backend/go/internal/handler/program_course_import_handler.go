package handler

// 方案课程导入 HTTP 适配：鉴权/租户/文件解析/响应映射，
// 业务编排与事务在 service.ProgramCourseImportService（refactor-layering.md 分层契约）。

import (
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ProgramCourseImportHandler struct {
	Store *store.Store
	Svc   *service.ProgramCourseImportService
}

// pcImportResult 别名（唯一出处：service.ProgramCourseImportService）。
type pcImportResult = service.PCImportResult

// pcCourse 别名（唯一出处：service.ProgramCourseImportService）。
type pcCourse = service.PCCourse

// PreviewExcel POST /import/program-courses/preview — 解析校验，不写库。
func (h *ProgramCourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := h.checkAuth(w, r)
	if !ok {
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "无法解析上传文件")
		return
	}
	defer xlsx.Close()

	courses, errors := h.Svc.ParseCourses(r.Context(), tenantID, xlsx)
	result := &pcImportResult{Created: len(courses), Errors: errors}
	respondJSON(w, http.StatusOK, result)
}

// ImportExcel POST /import/program-courses/excel — 导入方案课程 Excel，全量替换。
func (h *ProgramCourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := h.checkAuth(w, r)
	if !ok {
		return
	}

	programID := getProgramID(r)
	if programID == "" {
		respondError(w, http.StatusBadRequest, "缺少方案ID programId")
		return
	}

	// 校验方案归属当前租户，防跨租户清空/替换他人方案课程
	tenantOf, err := store.CourseImportTrainingProgramTenantID(r.Context(), h.Store.Q(), programID)
	if err != nil {
		respondError(w, http.StatusNotFound, "方案不存在")
		return
	}
	if tenantOf != tenantID {
		respondError(w, http.StatusForbidden, "无权操作该方案")
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "无法解析上传文件")
		return
	}
	defer xlsx.Close()

	courses, errors := h.Svc.ParseCourses(r.Context(), tenantID, xlsx)
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "未解析到任何有效课程数据")
		return
	}
	if err := h.Svc.Replace(r.Context(), programID, courses); err != nil {
		respondServerError(w, r, err, "导入失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"created": len(courses), "failed": len(errors), "entity": "方案课程", "errors": errors})
}

// ServeTemplate GET /templates/program-courses — 下载方案课程导入模板。
func (h *ProgramCourseImportHandler) ServeTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if _, ok := requireTenant(w, r); !ok {
		return
	}

	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	headers := []string{"关联岗位名称（二选一）", "关联体系课名称（二选一）", "学分", "总学时", "性质"}
	widths := []float64{24, 24, 10, 10, 12}
	s1, _ := f.NewSheet(service.PCImportSheet)
	f.SetActiveSheet(s1)

	note := "填写说明：\n* 二选一必填列。\n关联岗位名称：填写已发布岗位名称，导入时会关联该岗位下所有场景。\n关联体系课名称：填写已发布体系课名称。\n岗位和体系课二选一填写，都填时以岗位为准。\n学分：数字，如 3.5。\n总学时：整数。\n性质：默认为「必修」，可选：必修、选修、实践。"
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	f.MergeCell(service.PCImportSheet, start, end)
	f.SetCellValue(service.PCImportSheet, start, note)
	f.SetCellStyle(service.PCImportSheet, start, end, noteStyle)
	f.SetCellStyle(service.PCImportSheet, start, end, wrapAlign)
	f.SetRowHeight(service.PCImportSheet, 1, 80)

	for ci, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(service.PCImportSheet, cell, hdr)
		f.SetCellStyle(service.PCImportSheet, cell, cell, hdrStyle)
		f.SetColWidth(service.PCImportSheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(service.PCImportSheet, 2, 28)
	f.SetPanes(service.PCImportSheet, &excelize.Panes{Freeze: true, YSplit: 2})

	writeExcel(w, r, f, "方案课程批量导入模板.xlsx")
}

func (h *ProgramCourseImportHandler) checkAuth(w http.ResponseWriter, r *http.Request) (string, bool) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return "", false
	}
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return "", false
	}
	return tenantID, true
}

// getProgramID 读取方案 ID（URL 参数或表单值）。
func getProgramID(r *http.Request) string {
	if v := r.URL.Query().Get("programId"); v != "" {
		return v
	}
	return r.FormValue("programId")
}
