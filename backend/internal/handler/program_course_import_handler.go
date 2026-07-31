package handler

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ProgramCourseImportHandler struct {
	DB *pgxpool.Pool
}

const pcImportSheet = "导入"

// ImportExcel POST /import/program-courses/{programId} — 导入方案课程 Excel，全量替换保存。
func (h *ProgramCourseImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	programID := chi.URLParam(r, "id")
	if programID == "" {
		respondError(w, http.StatusBadRequest, "缺少方案ID")
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "无法解析上传文件")
		return
	}
	defer xlsx.Close()

	rows, err := xlsx.GetRows(pcImportSheet)
	if err != nil {
		respondError(w, http.StatusBadRequest, "请使用名为「导入」的 Sheet")
		return
	}

	type course struct {
		Name        string
		Code        string
		Credits     float64
		Hours       int
		Nature      string
		ScenarioID  string
		CourseID    string
	}
	courses := make([]course, 0)
	errors := make([]string, 0)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) == 0 || strings.TrimSpace(col(row, 0)) == "" {
			continue
		}
		name := strings.TrimSpace(col(row, 0))
		code := strings.TrimSpace(col(row, 1))
		creditsStr := strings.TrimSpace(col(row, 2))
		hoursStr := strings.TrimSpace(col(row, 3))
		nature := strings.TrimSpace(col(row, 4))
		scenarioName := strings.TrimSpace(col(row, 5))
		courseName := strings.TrimSpace(col(row, 6))

		if name == "" {
			errors = append(errors, "第"+strconv.Itoa(rowNum)+"行：课程名称不能为空")
			continue
		}
		credits, _ := strconv.ParseFloat(creditsStr, 64)
		hours, _ := strconv.Atoi(hoursStr)
		if nature == "" {
			nature = "必修"
		}

		var scenarioID, courseID string
		if scenarioName != "" {
			_ = h.DB.QueryRow(r.Context(), `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, scenarioName).Scan(&scenarioID)
		}
		if courseName != "" {
			_ = h.DB.QueryRow(r.Context(), `SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1`, tenantID, courseName).Scan(&courseID)
		}

		courses = append(courses, course{
			Name: name, Code: code, Credits: credits, Hours: hours,
			Nature: nature, ScenarioID: scenarioID, CourseID: courseID,
		})
	}

	if len(courses) == 0 {
		respondError(w, http.StatusBadRequest, "未解析到任何有效课程数据")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		slog.Error("导入方案课程事务失败", "error", err)
		respondError(w, http.StatusInternalServerError, "导入失败")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `DELETE FROM training_program_courses WHERE program_id = $1`, programID); err != nil {
		respondError(w, http.StatusInternalServerError, "清理旧数据失败")
		return
	}
	for i, c := range courses {
		var scid, cid *string
		if c.ScenarioID != "" {
			scid = &c.ScenarioID
		}
		if c.CourseID != "" {
			cid = &c.CourseID
		}
		var code *string
		if c.Code != "" {
			code = &c.Code
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, nature, scenario_id, course_id, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, uuid.NewString(), programID, c.Name, code, c.Credits, c.Hours, c.Nature, scid, cid, i); err != nil {
			slog.Error("插入方案课程失败", "error", err)
			respondError(w, http.StatusInternalServerError, "保存课程失败")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": len(courses),
		"errors":  errors,
	})
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
