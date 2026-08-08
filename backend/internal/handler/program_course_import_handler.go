package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ProgramCourseImportHandler struct {
	Store *store.Store
}

const pcImportSheet = "导入"

func getProgramID(r *http.Request) string {
	if v := r.URL.Query().Get("programId"); v != "" {
		return v
	}
	return r.FormValue("programId")
}

type pcImportResult struct {
	Created        int
	Duplicates     int
	Failed         int
	DuplicateItems []ImportPreviewItem
	Errors         []string
}

// PreviewExcel POST /import/program-courses/preview — 解析校验，不写库。
func (h *ProgramCourseImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	_, ok := h.checkAuth(w, r)
	if !ok {
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "无法解析上传文件")
		return
	}
	defer xlsx.Close()

	courses, errors := h.parseCourses(r, xlsx)
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
	var tenantOf string
	if err := h.Store.Q().QueryRow(r.Context(), `SELECT tenant_id FROM training_programs WHERE id=$1`, programID).Scan(&tenantOf); err != nil {
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

	courses, errors := h.parseCourses(r, xlsx)
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "未解析到任何有效课程数据")
		return
	}

	tx, err := h.Store.WithTxRaw(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "导入失败")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `DELETE FROM training_program_courses WHERE program_id = $1`, programID); err != nil {
		respondError(w, http.StatusInternalServerError, "清理旧数据失败")
		return
	}
	for i, c := range courses {
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO training_program_courses (id, program_id, name, credits, hours, semester, nature, position_id, course_id, sort_order) VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9)`,
			c.ID, programID, c.Name, c.Credits, c.Hours, c.Nature, c.PositionID, c.CourseID, i); err != nil {
			respondError(w, http.StatusInternalServerError, "保存课程失败")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"created": len(courses), "failed": len(errors), "entity": "方案课程", "errors": errors})
}

// currentTenant 读取当前请求租户（checkAuth 已保证存在）。
func (h *ProgramCourseImportHandler) currentTenant(r *http.Request) string {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil {
		return ""
	}
	return *claims.TenantID
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

type pcCourse struct {
	ID         string
	Name       string
	Credits    float64
	Hours      int
	Nature     string
	PositionID *string
	CourseID   *string
}

func (h *ProgramCourseImportHandler) parseCourses(r *http.Request, xlsx *excelize.File) ([]pcCourse, []string) {
	rows, err := xlsx.GetRows(pcImportSheet)
	if err != nil {
		return nil, []string{"请使用名为「导入」的 Sheet"}
	}

	courses := make([]pcCourse, 0)
	errs := make([]string, 0)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		positionName := strings.TrimSpace(col(row, 0))
		courseName := strings.TrimSpace(col(row, 1))
		creditsStr := strings.TrimSpace(col(row, 2))
		hoursStr := strings.TrimSpace(col(row, 3))
		nature := strings.TrimSpace(col(row, 4))

		if positionName == "" && courseName == "" {
			errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：关联岗位和关联体系课至少填写一项")
			continue
		}
		credits, _ := strconv.ParseFloat(creditsStr, 64)
		hours, _ := strconv.Atoi(hoursStr)
		if nature == "" {
			nature = "必修"
		}

		c := pcCourse{ID: uuid.NewString(), Credits: credits, Hours: hours, Nature: nature}

		if positionName != "" {
			var pid string
			if err := h.Store.Q().QueryRow(r.Context(), `SELECT id FROM career_positions WHERE name=$1 AND tenant_id=$2 LIMIT 1`, positionName, h.currentTenant(r)).Scan(&pid); err == nil {
				c.PositionID = &pid
				c.Name = positionName
			}
		}
		if c.PositionID == nil && courseName != "" {
			var id, n string
			if err := h.Store.Q().QueryRow(r.Context(), `SELECT id, name FROM courses WHERE name=$1 AND type='system' AND tenant_id=$2 LIMIT 1`, courseName, h.currentTenant(r)).Scan(&id, &n); err == nil {
				c.Name = n
				if c.Name == "" {
					c.Name = courseName
				}
				c.CourseID = &id
			}
		}

		courses = append(courses, c)
	}
	return courses, errs
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
	s1, _ := f.NewSheet(pcImportSheet)
	f.SetActiveSheet(s1)

	note := "填写说明：\n* 二选一必填列。\n关联岗位名称：填写已发布岗位名称，导入时会关联该岗位下所有场景。\n关联体系课名称：填写已发布体系课名称。\n岗位和体系课二选一填写，都填时以岗位为准。\n学分：数字，如 3.5。\n总学时：整数。\n性质：默认为「必修」，可选：必修、选修、实践。"
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	f.MergeCell(pcImportSheet, start, end)
	f.SetCellValue(pcImportSheet, start, note)
	f.SetCellStyle(pcImportSheet, start, end, noteStyle)
	f.SetCellStyle(pcImportSheet, start, end, wrapAlign)
	f.SetRowHeight(pcImportSheet, 1, 80)

	for ci, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(pcImportSheet, cell, hdr)
		f.SetCellStyle(pcImportSheet, cell, cell, hdrStyle)
		f.SetColWidth(pcImportSheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(pcImportSheet, 2, 28)
	f.SetPanes(pcImportSheet, &excelize.Panes{Freeze: true, YSplit: 2})

	writeExcel(w, f, "方案课程批量导入模板.xlsx")
}
