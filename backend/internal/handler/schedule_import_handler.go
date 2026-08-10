package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScheduleImportHandler struct {
	Store *store.Store
}

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

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	if !hasSheet(sheets, "课程列表") {
		respondError(w, http.StatusBadRequest, "文件缺少「课程列表」Sheet，请使用排课导入模板")
		return
	}

	result := h.previewCourseList(r.Context(), xlsx, tenantID)
	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

// previewCourseList 按整周矩阵解析统计可导入的排课条数，不写库。
func (h *ScheduleImportHandler) previewCourseList(ctx context.Context, xlsx *excelize.File, tenantID string) *scheduleImportResult {
	result := &scheduleImportResult{}
	rows, err := xlsx.GetRows("课程列表")
	if err != nil {
		result.Errors = append(result.Errors, "读取「课程列表」Sheet 失败")
		result.Failed++
		return result
	}
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) == 0 || strings.TrimSpace(col(row, 0)) == "" {
			continue
		}
		classes := strings.TrimSpace(col(row, 8))
		if classes == "" {
			continue
		}
		slots := parseWeekMatrix(col(row, 5))
		result.Created += len(slots)
	}
	return result
}

// ImportExcel POST /import/schedules/excel?termId= — 按「课程列表」Sheet 清空重排导入。
// termId 为目标学期，缺省时从第一个有效课程的教学计划推断。
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
	termID := strings.TrimSpace(r.URL.Query().Get("termId"))

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	if !hasSheet(sheets, "课程列表") {
		respondError(w, http.StatusBadRequest, "文件缺少「课程列表」Sheet，请使用排课导入模板")
		return
	}

	result := h.importFromCourseList(r.Context(), xlsx, tenantID, termID, overwrite)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created, "failed": result.Failed, "skipped": result.Skipped,
		"entity": "排课", "errors": result.Errors, "sheets": sheets,
	})
}

func hasSheet(sheets []string, name string) bool {
	for _, s := range sheets {
		if s == name {
			return true
		}
	}
	return false
}

// weekSlot 一门课程在某天的一个排课时段。
type weekSlot struct {
	day     int
	periods []string
}

// parseWeekMatrix 解析整周矩阵文本（每行「周X:节次1、节次2」，空节次的天跳过），
// 节次简写（上午1/下午3 等）映射为节次表正式名称。
func parseWeekMatrix(s string) []weekSlot {
	var slots []weekSlot
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		day := parseDayOfWeek(strings.TrimSpace(parts[0]))
		if day == 0 {
			continue
		}
		periods := normalizePeriods(splitTrim(strings.ReplaceAll(parts[1], "、", ","), ","))
		if len(periods) == 0 {
			continue
		}
		slots = append(slots, weekSlot{day: day, periods: periods})
	}
	return slots
}

// periodAliases 节次简写 → 节次表正式名称。
var periodAliases = map[string]string{
	"上午1": "上午第一节课", "上午2": "上午第二节课", "上午3": "上午第三节课", "上午4": "上午第四节课",
	"下午1": "下午第一节课", "下午2": "下午第二节课", "下午3": "下午第三节课", "下午4": "下午第四节课",
	"晚上1": "晚上第一节课", "晚上2": "晚上第二节课",
}

// normalizePeriods 将节次简写映射为节次表正式名称，未识别名称原样保留。
func normalizePeriods(periods []string) []string {
	out := make([]string, 0, len(periods))
	for _, p := range periods {
		if alias, ok := periodAliases[p]; ok {
			out = append(out, alias)
		} else {
			out = append(out, p)
		}
	}
	return out
}

// importFromCourseList 从「课程列表」Sheet 清空重排。
// 模板列：课程名称 | 类型 | 起始周 | 结束周 | 周次模式 | 节次(整周矩阵) | 教师 | 场地 | 班级。
// termID 为目标学期（可为空）：为空时从第一个有效课程匹配教学计划推断；
// 非空时校验租户拥有该学期，并按该学期匹配教学计划条目。
func (h *ScheduleImportHandler) importFromCourseList(ctx context.Context, xlsx *excelize.File, tenantID, termID string, overwrite bool) *scheduleImportResult {
	result := &scheduleImportResult{}
	rows, err := xlsx.GetRows("课程列表")
	if err != nil {
		result.Errors = append(result.Errors, "读取「课程列表」Sheet 失败")
		result.Failed++
		return result
	}

	// 收集有排课信息的行（一个课程行可能按天拆成多条）
	type rowData struct {
		courseName, entryType           string
		startWeek, endWeek              int
		weekPattern                     string
		day                             int
		periods                         []string
		teacherName, venueName, classes string
	}
	var items []rowData

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) == 0 || strings.TrimSpace(col(row, 0)) == "" {
			continue
		}
		courseName := strings.TrimSpace(col(row, 0))
		entryType := strings.TrimSpace(col(row, 1))
		switch entryType {
		case "场景":
			entryType = "scene"
		case "课程", "":
			entryType = "traditional"
		}
		startWeek, _ := strconv.Atoi(strings.TrimSpace(col(row, 2)))
		endWeek, _ := strconv.Atoi(strings.TrimSpace(col(row, 3)))
		weekPattern := strings.TrimSpace(col(row, 4))
		if weekPattern == "" {
			weekPattern = "all"
		}
		switch weekPattern {
		case "全部":
			weekPattern = "all"
		case "单周":
			weekPattern = "odd"
		case "双周":
			weekPattern = "even"
		}
		teacherName := strings.TrimSpace(col(row, 6))
		venueName := strings.TrimSpace(col(row, 7))
		classes := strings.TrimSpace(col(row, 8))

		// 整周矩阵：每行「周X:节次1、节次2」，按天拆分为多条排课
		slots := parseWeekMatrix(col(row, 5))
		if len(slots) == 0 {
			result.Skipped++
			continue
		}
		for _, slot := range slots {
			items = append(items, rowData{
				courseName: courseName, entryType: entryType, startWeek: startWeek, endWeek: endWeek,
				weekPattern: weekPattern, day: slot.day, periods: slot.periods,
				teacherName: teacherName, venueName: venueName, classes: classes,
			})
		}
	}

	if len(items) == 0 {
		result.Errors = append(result.Errors, "课程列表无有效的排课数据（节次列需填写整周矩阵，如 周一:上午1、上午2）")
		result.Failed++
		return result
	}

	// 确定目标学期：优先使用请求携带的 termId，其次从第一个有效课程匹配教学计划推断
	if termID != "" {
		if _, err := h.Store.Terms().Get(ctx, termID, tenantID); err != nil {
			result.Errors = append(result.Errors, "学期不存在或不属于当前租户")
			result.Failed++
			return result
		}
	} else {
		termID, _ = store.InferTermByCourseName(ctx, h.Store.Q(), tenantID, items[0].courseName)
	}
	if termID == "" {
		result.Errors = append(result.Errors, "无法识别所属学期，请先选择目标学期再导入")
		result.Failed++
		return result
	}

	// 课程列表格式为「清空重排」：回传文件代表该学期完整草稿排课，清空草稿区后重建，不触碰已发布版本
	err = h.Store.WithTx(ctx, func(txStore *store.Store) error {
		if err := store.ClearDraftScheduleEntries(ctx, txStore.Q(), tenantID, termID); err != nil {
			result.Errors = append(result.Errors, "清空旧排课失败")
			result.Failed++
			return err
		}
		// 教学计划条目全部恢复为待排
		if err := store.ResetPlanEntriesToPlanned(ctx, txStore.Q(), tenantID, termID); err != nil {
			result.Errors = append(result.Errors, "恢复待排状态失败")
			result.Failed++
			return err
		}

		// 课程/班级/教师/场地查询缓存，避免同课程多天重复查询
		planEntryCache := map[string]store.SchedulePlanEntry{}
		classCache := map[string]string{}
		teacherCache := map[string]string{}
		venueCache := map[string]string{}

		for _, it := range items {
			// 匹配教学计划条目（按课程名）
			pe, ok := planEntryCache[it.courseName]
			if !ok {
				pe, err = store.FindPlanEntryByCourse(ctx, txStore.Q(), tenantID, termID, it.courseName)
				if err != nil || pe.ID == "" {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]未匹配到教学计划条目", it.courseName))
					continue
				}
				planEntryCache[it.courseName] = pe
			}

			// 解析班级（逗号分隔）
			var classIDs []string
			parseOK := true
			for _, cn := range strings.Split(strings.ReplaceAll(it.classes, ",", "，"), "，") {
				cn = strings.TrimSpace(cn)
				if cn == "" {
					continue
				}
				cid, ok := classCache[cn]
				if !ok {
					cid, err = store.FindOrgIDByName(ctx, txStore.Q(), tenantID, cn)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]班级[%s]不存在", it.courseName, cn))
						parseOK = false
						break
					}
					classCache[cn] = cid
				}
				classIDs = append(classIDs, cid)
			}
			if !parseOK || len(classIDs) == 0 {
				continue
			}

			// 解析教师
			var teacherID *string
			if it.teacherName != "" {
				tid, ok := teacherCache[it.teacherName]
				if !ok {
					tid, err = store.FindTeacherIDByName(ctx, txStore.Q(), tenantID, it.teacherName)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]教师[%s]不存在", it.courseName, it.teacherName))
						continue
					}
					teacherCache[it.teacherName] = tid
				}
				teacherID = &tid
			}

			// 解析场地
			var venueID *string
			if it.venueName != "" {
				vid, ok := venueCache[it.venueName]
				if !ok {
					vid, err = store.FindVenueIDByName(ctx, txStore.Q(), tenantID, it.venueName)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]场地[%s]不存在", it.courseName, it.venueName))
						continue
					}
					venueCache[it.venueName] = vid
				}
				venueID = &vid
			}

			if err := store.InsertScheduleEntry(ctx, txStore.Q(), store.ScheduleEntryInsertParams{
				ID: uuid.NewString(), TenantID: tenantID, TermID: termID, PlanEntryID: pe.ID,
				CourseName: it.courseName, CourseCode: pe.CourseCode, CourseID: pe.CourseID, EntryType: it.entryType,
				ClassIDs: classIDs, TeacherID: teacherID, Day: it.day, Periods: it.periods,
				StartWeek: it.startWeek, EndWeek: it.endWeek, WeekPattern: it.weekPattern,
				VenueID: venueID, ScenarioID: pe.ScenarioID,
			}); err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]导入失败: %v", it.courseName, err))
				continue
			}
			// 标记已排（失败计入错误，避免计划条目状态与排课不一致）
			if err := store.MarkPlanEntryScheduled(ctx, txStore.Q(), pe.ID); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("课程[%s]计划条目标记失败: %v", it.courseName, err))
			}
		}
		return nil
	})
	if err != nil {
		result.Errors = append(result.Errors, "提交事务失败")
		result.Failed++
		return result
	}
	return result
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
	case "周日", "星期日", "周天", "星期天", "7":
		return 7
	}
	return 0
}
