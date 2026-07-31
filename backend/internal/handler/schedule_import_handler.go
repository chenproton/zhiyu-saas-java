package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScheduleImportHandler struct {
	DB *pgxpool.Pool
}

const scheduleImportSheet = "排课导入"

type scheduleImportResult struct {
	Created        int
	Failed         int
	Skipped        int
	Errors         []string
	DuplicateItems []ImportPreviewItem
}

// PreviewExcel POST /import/schedules/preview — 解析并校验，不写库。
func (h *ScheduleImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	result := h.processRows(r.Context(), xlsx, tenantID, true, false)
	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

// ImportExcel POST /import/schedules/excel — 导入排课（source=imported，status=draft）。
func (h *ScheduleImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	overwrite := importOverwriteParam(r)

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	result := h.processRows(r.Context(), xlsx, tenantID, false, overwrite)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"skipped": result.Skipped,
		"entity":  "排课",
		"errors":  result.Errors,
		"sheets":  sheets,
	})
}

// ServeTemplate GET /templates/schedules — 下载排课导入模板。
func (h *ScheduleImportHandler) ServeTemplate(w http.ResponseWriter, r *http.Request) {
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

	headers := []string{"学期 *", "课程名称 *", "班级 *", "星期 *", "节次 *", "起始周 *", "结束周 *", "周次模式", "教师", "场地", "课程编码", "类型", "场景名称"}
	widths := []float64{16, 24, 20, 8, 16, 10, 10, 10, 14, 16, 14, 10, 20}
	s1, _ := f.NewSheet(scheduleImportSheet)
	f.SetActiveSheet(s1)

	note := "填写说明：\n* 必填列。\n学期：填写学期名称（如 2025-2026-1），需已在学期管理中创建。\n班级：填写班级组织节点名称，存在同名班级时使用完整路径（如 学校-学院-班级）。\n星期：1-7 或 周一~周日。\n节次：填写节次名称（如 上午1-2），连续多节用逗号分隔。\n周次模式：全部/单周/双周，默认全部。\n教师：教师姓名或登录账号，需已存在。\n场地：场地名称，需已在场地管理中创建。\n类型：普通/场景，默认普通；类型为场景时场景名称必填，需与已有场景名称一致。\n同一学期+班级+星期+课程且节次重叠视为重复数据，默认跳过，可用 overwrite=true 覆盖。"
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(len(headers), 1)
	f.MergeCell(scheduleImportSheet, start, end)
	f.SetCellValue(scheduleImportSheet, start, note)
	f.SetCellStyle(scheduleImportSheet, start, end, noteStyle)
	f.SetCellStyle(scheduleImportSheet, start, end, wrapAlign)
	f.SetRowHeight(scheduleImportSheet, 1, float64(strings.Count(note, "\n")+2)*16)

	for ci, hdr := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(scheduleImportSheet, cell, hdr)
		f.SetCellStyle(scheduleImportSheet, cell, cell, hdrStyle)
		f.SetColWidth(scheduleImportSheet, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(scheduleImportSheet, 2, 28)
	f.SetPanes(scheduleImportSheet, &excelize.Panes{Freeze: true, YSplit: 2})

	writeExcel(w, f, "排课批量导入模板.xlsx")
}

type scheduleRow struct {
	rowNum      int
	termName    string
	courseName  string
	className   string
	dayOfWeek   int
	periods     []string
	startWeek   int
	endWeek     int
	weekPattern string
	teacherName string
	venueName   string
	courseCode  string
	entryType   string
	sceneName   string
}

func (h *ScheduleImportHandler) processRows(ctx context.Context, xlsx *excelize.File, tenantID string, preview, overwrite bool) *scheduleImportResult {
	result := &scheduleImportResult{}
	rows, err := xlsx.GetRows(scheduleImportSheet)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「%s」Sheet 失败: %v", scheduleImportSheet, err))
		result.Failed++
		return result
	}

	sched := &SchedulingHandler{DB: h.DB}
	// 记录需要同步为 scheduled 的教学计划条目
	planEntryIDs := make(map[string]struct{})

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) == 0 || strings.TrimSpace(col(row, 0)) == "" && strings.TrimSpace(col(row, 1)) == "" {
			continue
		}
		sr, errMsg := parseScheduleRow(row, rowNum)
		if errMsg != "" {
			result.Failed++
			result.Errors = append(result.Errors, errMsg)
			continue
		}

		// 引用解析
		termID, err := lookupIDByName(ctx, h.DB, "terms", tenantID, sr.termName)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行学期[%s]查询失败", rowNum, sr.termName))
			continue
		}
		if termID == "" {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行学期[%s]不存在，请先创建", rowNum, sr.termName))
			continue
		}

		classNodeID, err := h.lookupOrgNode(ctx, tenantID, sr.className)
		if err != nil || classNodeID == "" {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行班级[%s]未找到对应组织节点", rowNum, sr.className))
			continue
		}

		var teacherID *string
		if sr.teacherName != "" {
			var id string
			err := h.DB.QueryRow(ctx, `
				SELECT id FROM users WHERE tenant_id=$1 AND (name=$2 OR username=$2 OR login_name=$2) LIMIT 1
			`, tenantID, sr.teacherName).Scan(&id)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行教师[%s]不存在", rowNum, sr.teacherName))
				continue
			}
			teacherID = &id
		}

		var venueID *string
		if sr.venueName != "" {
			var id string
			err := h.DB.QueryRow(ctx, `SELECT id FROM venues WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, sr.venueName).Scan(&id)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行场地[%s]不存在，请先在场地管理中创建", rowNum, sr.venueName))
				continue
			}
			venueID = &id
		}

		var scenarioID *string
		if sr.entryType == "scene" {
			var id string
			err := h.DB.QueryRow(ctx, `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, sr.sceneName).Scan(&id)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行场景[%s]不存在", rowNum, sr.sceneName))
				continue
			}
			scenarioID = &id
		}

		// 尝试匹配教学计划条目（用于覆盖已有排课并同步待排区状态）
		var planEntryID *string
		_ = h.DB.QueryRow(ctx, `
			SELECT e.id::text FROM teaching_plan_entries e
			JOIN teaching_plans p ON p.id = e.plan_id
			WHERE p.tenant_id = $1 AND p.term_id = $2 AND e.class_node_id = $3 AND e.course_name = $4
			LIMIT 1
		`, tenantID, termID, classNodeID, sr.courseName).Scan(&planEntryID)

		// 重复判定：优先按 plan_entry_id，其次按同学期+班级+星期+课程+节次交集
		var existingID string
		if planEntryID != nil && *planEntryID != "" {
			_ = h.DB.QueryRow(ctx, `
				SELECT id::text FROM schedule_entries
				WHERE tenant_id=$1 AND plan_entry_id=$2
				LIMIT 1
			`, tenantID, *planEntryID).Scan(&existingID)
		}
		if existingID == "" {
			_ = h.DB.QueryRow(ctx, `
				SELECT id::text FROM schedule_entries
				WHERE tenant_id=$1 AND term_id=$2 AND class_node_id=$3 AND day_of_week=$4 AND course_name=$5 AND periods ?| $6
				LIMIT 1
			`, tenantID, termID, classNodeID, sr.dayOfWeek, sr.courseName, sr.periods).Scan(&existingID)
		}

		if existingID != "" {
			if preview {
				if len(result.DuplicateItems) < 100 {
					result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{RowNum: rowNum, Key: sr.courseName, Name: sr.courseName})
				}
				result.Skipped++
				continue
			}
			if !overwrite {
				result.Skipped++
				continue
			}
		}

		req := &ScheduleEntryRequest{
			TermID:      termID,
			PlanEntryID: planEntryID,
			CourseName:  sr.courseName,
			ClassNodeID: classNodeID,
			TeacherID:   teacherID,
			DayOfWeek:   sr.dayOfWeek,
			StartWeek:   sr.startWeek,
			EndWeek:     sr.endWeek,
			WeekPattern: sr.weekPattern,
			VenueID:     venueID,
		}
		periods := make(domain.JSONSlice, 0, len(sr.periods))
		for _, p := range sr.periods {
			periods = append(periods, p)
		}
		req.Periods = periods

		// 冲突校验（教师/班级/场地时间重叠），更新已有记录时排除自身
		conflicts, err := sched.checkScheduleConflicts(ctx, tenantID, req, existingID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行冲突校验失败: %v", rowNum, err))
			continue
		}
		if len(conflicts) > 0 {
			c := conflicts[0]
			kindName := map[string]string{"teacher": "教师", "class": "班级", "venue": "场地"}[c.Kind]
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行课程[%s]%s冲突：与[%s]星期%d 第%d-%d周节次重叠", rowNum, sr.courseName, kindName, c.CourseName, c.DayOfWeek, c.StartWeek, c.EndWeek))
			continue
		}

		if preview {
			result.Created++
			continue
		}

		courseCode := nullableStr(sr.courseCode)
		courseID := resolveCourseIDByCode(ctx, h.DB, tenantID, courseCode)

		if existingID != "" {
			_, err := h.DB.Exec(ctx, `
				UPDATE schedule_entries
				SET plan_entry_id=$1, course_code=$2, course_id=$3, type=$4, teacher_id=$5, periods=$6, start_week=$7, end_week=$8,
					week_pattern=$9, venue_id=$10, scenario_id=$11, source='imported', updated_at=NOW()
				WHERE id=$12 AND tenant_id=$13
			`, planEntryID, courseCode, courseID, sr.entryType, teacherID, periods, sr.startWeek, sr.endWeek,
				sr.weekPattern, venueID, scenarioID, existingID, tenantID)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行课程[%s]更新失败: %v", rowNum, sr.courseName, err))
				continue
			}
			if planEntryID != nil && *planEntryID != "" {
				planEntryIDs[*planEntryID] = struct{}{}
			}
			result.Created++
			continue
		}

		_, err = h.DB.Exec(ctx, `
			INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
				class_node_id, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
				venue_id, scenario_id, source, status, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'imported', 'draft', 1)
		`, uuid.NewString(), tenantID, termID, planEntryID, sr.courseName, courseCode, courseID, sr.entryType,
			classNodeID, teacherID, sr.dayOfWeek, periods, sr.startWeek, sr.endWeek, sr.weekPattern,
			venueID, scenarioID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行课程[%s]创建失败: %v", rowNum, sr.courseName, err))
			continue
		}
		if planEntryID != nil && *planEntryID != "" {
			planEntryIDs[*planEntryID] = struct{}{}
		}
		result.Created++
	}

	// 将本次涉及的教学计划条目同步标记为已排
	if !preview && len(planEntryIDs) > 0 {
		ids := make([]string, 0, len(planEntryIDs))
		for id := range planEntryIDs {
			ids = append(ids, id)
		}
		_, _ = h.DB.Exec(ctx, `
			UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = ANY($1)
		`, ids)
	}

	return result
}

func parseScheduleRow(row []string, rowNum int) (*scheduleRow, string) {
	sr := &scheduleRow{rowNum: rowNum}
	sr.termName = col(row, 0)
	sr.courseName = col(row, 1)
	sr.className = col(row, 2)
	if sr.termName == "" || sr.courseName == "" || sr.className == "" {
		return nil, fmt.Sprintf("第%d行缺少必填字段（学期/课程名称/班级）", rowNum)
	}

	sr.dayOfWeek = parseDayOfWeek(col(row, 3))
	if sr.dayOfWeek < 1 || sr.dayOfWeek > 7 {
		return nil, fmt.Sprintf("第%d行星期[%s]无效，需为 1-7 或 周一~周日", rowNum, col(row, 3))
	}

	sr.periods = splitTrim(strings.ReplaceAll(col(row, 4), "，", ","), ",")
	if len(sr.periods) == 0 {
		return nil, fmt.Sprintf("第%d行节次不能为空", rowNum)
	}

	sr.startWeek = parseIntDefault(col(row, 5), 0)
	sr.endWeek = parseIntDefault(col(row, 6), 0)
	if sr.startWeek <= 0 || sr.endWeek <= 0 || sr.startWeek > sr.endWeek {
		return nil, fmt.Sprintf("第%d行周次区间无效", rowNum)
	}

	switch col(row, 7) {
	case "", "全部":
		sr.weekPattern = "all"
	case "单周":
		sr.weekPattern = "odd"
	case "双周":
		sr.weekPattern = "even"
	default:
		return nil, fmt.Sprintf("第%d行周次模式[%s]无效，需为 全部/单周/双周", rowNum, col(row, 7))
	}

	sr.teacherName = col(row, 8)
	sr.venueName = col(row, 9)
	sr.courseCode = col(row, 10)

	switch col(row, 11) {
	case "", "普通":
		sr.entryType = "traditional"
	case "场景":
		sr.entryType = "scene"
	default:
		return nil, fmt.Sprintf("第%d行类型[%s]无效，需为 普通/场景", rowNum, col(row, 11))
	}
	sr.sceneName = col(row, 12)
	if sr.entryType == "scene" && sr.sceneName == "" {
		return nil, fmt.Sprintf("第%d行场景课程缺少场景名称", rowNum)
	}

	return sr, ""
}

func parseDayOfWeek(s string) int {
	s = strings.TrimSpace(s)
	switch s {
	case "周一", "星期一", "1":
		return 1
	case "周二", "星期二", "2":
		return 2
	case "周三", "星期三", "3":
		return 3
	case "周四", "星期四", "4":
		return 4
	case "周五", "星期五", "5":
		return 5
	case "周六", "星期六", "6":
		return 6
	case "周日", "星期日", "周天", "7":
		return 7
	}
	return 0
}

// lookupOrgNode 按名称（或 学校-学院-班级 路径的最后一段）查找组织节点。
func (h *ScheduleImportHandler) lookupOrgNode(ctx context.Context, tenantID, name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", nil
	}
	for _, sep := range []string{"-", "/", "\\"} {
		if idx := strings.LastIndex(name, sep); idx >= 0 {
			name = strings.TrimSpace(name[idx+len(sep):])
			break
		}
	}
	return lookupIDByName(ctx, h.DB, "organizations", tenantID, name)
}
