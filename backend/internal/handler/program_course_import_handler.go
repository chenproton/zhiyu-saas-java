package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ProgramCourseImportHandler struct {
	DB *pgxpool.Pool
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
	if !ok { return }

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil { respondError(w, http.StatusBadRequest, "无法解析上传文件"); return }
	defer xlsx.Close()

	courses, errors := h.parseCourses(r, xlsx)
	result := &pcImportResult{Created: len(courses), Errors: errors}
	respondJSON(w, http.StatusOK, result)
}

// ImportExcel POST /import/program-courses/excel — 导入方案课程 Excel，全量替换。
func (h *ProgramCourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	_, ok := h.checkAuth(w, r)
	if !ok { return }

	programID := getProgramID(r)
	if programID == "" { respondError(w, http.StatusBadRequest, "缺少方案ID programId"); return }

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil { respondError(w, http.StatusBadRequest, "无法解析上传文件"); return }
	defer xlsx.Close()

	courses, errors := h.parseCourses(r, xlsx)
	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "未解析到任何有效课程数据")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil { respondError(w, http.StatusInternalServerError, "导入失败"); return }
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `DELETE FROM training_program_courses WHERE program_id = $1`, programID); err != nil {
		respondError(w, http.StatusInternalServerError, "清理旧数据失败"); return
	}
	for i, c := range courses {
		var code *string
		if c.Code != "" { code = &c.Code }
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, nature, scenario_id, course_id, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			c.ID, programID, c.Name, code, c.Credits, c.Hours, c.Nature, c.ScenarioID, c.CourseID, i); err != nil {
			respondError(w, http.StatusInternalServerError, "保存课程失败"); return
		}
	}
	if err := tx.Commit(r.Context()); err != nil { respondError(w, http.StatusInternalServerError, "提交失败"); return }

	respondJSON(w, http.StatusOK, map[string]interface{}{"created": len(courses), "failed": len(errors), "entity": "方案课程", "errors": errors})
}

func (h *ProgramCourseImportHandler) checkAuth(w http.ResponseWriter, r *http.Request) (string, bool) {
	tenantID, ok := requireTenant(w, r)
	if !ok { return "", false }
	claims := middleware.CurrentUser(r)
	if claims == nil { respondError(w, http.StatusForbidden, "权限不足"); return "", false }
	return tenantID, true
}

type pcCourse struct {
	ID         string
	Name       string
	Code       string
	Credits    float64
	Hours      int
	Nature     string
	ScenarioID *string
	CourseID   *string
}

func (h *ProgramCourseImportHandler) parseCourses(r *http.Request, xlsx *excelize.File) ([]pcCourse, []string) {
	rows, err := xlsx.GetRows(pcImportSheet)
	if err != nil { return nil, []string{"请使用名为「导入」的 Sheet"} }

	courses := make([]pcCourse, 0)
	errs := make([]string, 0)

	for i, row := range rows {
		if i < 2 { continue }
		rowNum := i + 1
		if len(row) == 0 || strings.TrimSpace(col(row, 0)) == "" { continue }
		name := strings.TrimSpace(col(row, 0))
		code := strings.TrimSpace(col(row, 1))
		creditsStr := strings.TrimSpace(col(row, 2))
		hoursStr := strings.TrimSpace(col(row, 3))
		nature := strings.TrimSpace(col(row, 4))
		scenarioName := strings.TrimSpace(col(row, 5))
		courseName := strings.TrimSpace(col(row, 6))

		if name == "" { errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：课程名称不能为空"); continue }
		credits, _ := strconv.ParseFloat(creditsStr, 64)
		hours, _ := strconv.Atoi(hoursStr)
		if nature == "" { nature = "必修" }

		c := pcCourse{ID: uuid.NewString(), Name: name, Code: code, Credits: credits, Hours: hours, Nature: nature}

		if scenarioName != "" {
			var id string
			if err := h.DB.QueryRow(r.Context(), `SELECT id FROM scenarios WHERE name=$2 LIMIT 1`, scenarioName).Scan(&id); err == nil {
				c.ScenarioID = &id
			}
		}
		if courseName != "" {
			var id string
			if err := h.DB.QueryRow(r.Context(), `SELECT id FROM courses WHERE name=$1 AND type='system' LIMIT 1`, courseName).Scan(&id); err == nil {
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

	headers := []string{"课程名称 *", "编码", "学分", "总学时", "性质", "关联场景名称", "关联体系课名称"}
	widths := []float64{24, 14, 8, 10, 10, 20, 24}
	s1, _ := f.NewSheet(pcImportSheet)
	f.SetActiveSheet(s1)

	note := "填写说明：\n* 必填列。\n课程名称：填写课程名称。\n性质：默认为「必修」，可选：必修、选修、实践。\n关联场景：填写已发布场景名称，或留空。\n关联体系课：填写已发布体系课名称，或留空。\n场景和体系课二选一，都填时以场景为准。"
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
