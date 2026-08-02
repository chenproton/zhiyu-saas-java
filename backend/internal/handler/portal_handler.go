package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PortalHandler struct {
	Service *service.PositionService
}

func (h *PortalHandler) WorkspaceDashboard(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	// 当前角色由前端传入（角色切换后端无状态），未传时取用户绑定的第一个角色
	role := r.URL.Query().Get("role")
	if role == "" && len(claims.RoleCodes) > 0 {
		role = claims.RoleCodes[0]
	}
	if role == "" {
		role = "student"
	}

	isTeacher := role == "teacher" || role == "school" || role == "school_admin"
	isSchoolAdmin := role == "school_admin"

	dash := domain.WorkspaceDashboard{
		Role:           role,
		Announcements:  h.listAnnouncements(r.Context(), role, claims.TenantID),
		Todos:          h.listTodos(r.Context(), claims.UserID, claims.TenantID, role),
		Schedule:       h.listSchedule(r.Context(), claims.UserID, claims.TenantID, role),
		Courses:        []domain.WorkspaceCourse{},
		SceneTasks:     []domain.WorkspaceSceneTask{},
		Exams:          []domain.WorkspaceExam{},
		LearningPath:   []domain.WorkspaceLearningPath{},
		TeacherCourses: []domain.WorkspaceTeacherCourse{},
		ClassPlans:     []domain.WorkspaceClassPlan{},
		ClassSessions:  []domain.WorkspaceClassSession{},
	}

	if isSchoolAdmin {
		var wg sync.WaitGroup
		wg.Add(5)
		goAsync(&wg, func() { dash.Stats = h.schoolAdminStats(r.Context(), claims.TenantID) })
		goAsync(&wg, func() { dash.ResourceStats = h.schoolAdminResourceStats(r.Context(), claims.TenantID) })
		goAsync(&wg, func() { dash.PersonnelStats = h.schoolAdminPersonnelStats(r.Context(), claims.TenantID) })
		goAsync(&wg, func() { dash.ResourceGrowth = h.schoolAdminResourceGrowth(r.Context(), claims.TenantID, 12) })
		goAsync(&wg, func() { dash.Todos = h.schoolAdminTodos(r.Context(), claims.TenantID) })
		wg.Wait()
		dash.Schedule = []domain.WorkspaceScheduleEvent{}
		respondJSON(w, http.StatusOK, dash)
		return
	}

	var wg sync.WaitGroup
	wg.Add(4)
	goAsync(&wg, func() { dash.Announcements = h.listAnnouncements(r.Context(), role, claims.TenantID) })
	goAsync(&wg, func() { dash.Todos = h.listTodos(r.Context(), claims.UserID, claims.TenantID, role) })
	goAsync(&wg, func() { dash.Schedule = h.listSchedule(r.Context(), claims.UserID, claims.TenantID, role) })
	goAsync(&wg, func() { dash.Stats = h.stats(r.Context(), claims.UserID, claims.TenantID, isTeacher) })

	if isTeacher {
		wg.Add(2)
		goAsync(&wg, func() { dash.TeacherCourses = h.listTeacherCourses(r.Context(), claims.UserID, claims.TenantID) })
		goAsync(&wg, func() {
			dash.ClassPlans, dash.ClassSessions = h.listTeacherClassPlansAndSessions(r.Context(), claims.UserID, claims.TenantID)
		})
	} else {
		wg.Add(3)
		goAsync(&wg, func() { dash.Courses = h.listStudentCourses(r.Context(), claims.UserID, claims.TenantID) })
		goAsync(&wg, func() { dash.SceneTasks = h.listStudentSceneTasks(r.Context(), claims.UserID, claims.TenantID) })
		goAsync(&wg, func() { dash.Exams = h.listStudentExams(r.Context(), claims.UserID, claims.TenantID) })
	}
	wg.Wait()
	dash.LearningPath = []domain.WorkspaceLearningPath{}

	respondJSON(w, http.StatusOK, dash)
}

func (h *PortalHandler) listAnnouncements(ctx context.Context, role string, tenantID *string) []domain.WorkspaceAnnouncement {
	rows, _ := h.Service.ListAnnouncements(ctx, role, tenantID)
	var items []domain.WorkspaceAnnouncement
	for _, a := range rows {
		items = append(items, domain.WorkspaceAnnouncement{
			ID: a.ID, Title: a.Title, Type: a.Type, IsNew: a.IsNew,
			Date: a.CreatedAt.Format("2006-01-02"), CreatedAt: a.CreatedAt,
		})
	}
	return items
}

func (h *PortalHandler) listTodos(ctx context.Context, userID string, tenantID *string, role string) []domain.WorkspaceTodo {
	var todos []domain.WorkspaceTodo
	if role == "teacher" || role == "school_admin" || role == "school" {
		if pendingApprovals := h.Service.PendingApprovalCount(ctx, tenantID); pendingApprovals > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID: "pending-approvals", Title: "待审批事项", Type: "approve", Count: pendingApprovals, Urgent: true,
			})
		}
		if draftCourses := h.Service.DraftCourseCount(ctx, userID, tenantID); draftCourses > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID: "draft-courses", Title: "待提交课程", Type: "review", Count: draftCourses, Urgent: false,
			})
		}
	} else {
		if upcomingExams := h.Service.UpcomingExamCount(ctx, tenantID, time.Now()); upcomingExams > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID: "upcoming-exams", Title: "待参加考试", Type: "exam", Count: upcomingExams, Urgent: false,
			})
		}
	}
	return todos
}

func (h *PortalHandler) listSchedule(ctx context.Context, userID string, tenantID *string, role string) []domain.WorkspaceScheduleEvent {
	var events []domain.WorkspaceScheduleEvent
	if role == "teacher" || role == "school_admin" || role == "school" {
		periodLabel := h.Service.PeriodLabelMap(ctx, tenantID)
		rows, _ := h.Service.ListTeacherSchedules(ctx, userID, tenantID)
		for _, se := range rows {
			eventType := "course"
			if se.EntryType == "scene" {
				eventType = "scene"
			}
			periodNames := jsonSliceToStrings(se.Periods)
			if len(periodNames) == 0 {
				continue
			}
			period := periodNames[0]
			if label, ok := periodLabel[period]; ok {
				period = label
			}
			events = append(events, domain.WorkspaceScheduleEvent{
				ID: se.ID, Title: se.CourseName, Type: eventType, DayOfWeek: se.DayOfWeek,
				Period: period, Location: se.VenueName,
				ClassName: strings.Join(se.ClassNames, "、"), Teacher: se.TeacherName, Status: "进行中",
			})
		}
	} else if role == "student" {
		classNodeID := h.Service.UserClassNodeID(ctx, userID, tenantID)
		if classNodeID != "" {
			periodLabel := h.Service.PeriodLabelMap(ctx, tenantID)
			rows, _ := h.Service.ListStudentSchedules(ctx, classNodeID, tenantID)
			for _, se := range rows {
				eventType := "course"
				if se.EntryType == "scene" {
					eventType = "scene"
				}
				periodNames := jsonSliceToStrings(se.Periods)
				if len(periodNames) == 0 {
					continue
				}
				period := periodNames[0]
				if label, ok := periodLabel[period]; ok {
					period = label
				}
				events = append(events, domain.WorkspaceScheduleEvent{
					ID: se.ID, Title: se.CourseName, Type: eventType, DayOfWeek: se.DayOfWeek,
					Period: period, Location: se.VenueName, Teacher: se.TeacherName, Status: "进行中",
				})
			}
		}
	}
	examEvents, _ := h.Service.ListExamEvents(ctx, tenantID)
	for _, e := range examEvents {
		dayOfWeek := 1
		if e.Start != nil {
			dayOfWeek = int(e.Start.Weekday())
			if dayOfWeek == 0 {
				dayOfWeek = 7
			}
		}
		events = append(events, domain.WorkspaceScheduleEvent{
			ID: e.ID, Title: e.Name, Type: "exam", DayOfWeek: dayOfWeek, Period: "上午 1", Status: e.Status,
		})
	}
	return events
}

func (h *PortalHandler) stats(ctx context.Context, userID string, tenantID *string, isTeacher bool) *domain.WorkspaceStats {
	if isTeacher {
		courseCount, studentCount := h.Service.TeacherStats(ctx, userID, tenantID)
		return &domain.WorkspaceStats{Label1: "授课课程", Value1: courseCount, Label2: "学生人数", Value2: studentCount}
	}
	courseCount, examCount := h.Service.StudentStats(ctx, tenantID)
	return &domain.WorkspaceStats{Label1: "可选课程", Value1: courseCount, Label2: "待考测评", Value2: examCount}
}

func (h *PortalHandler) schoolAdminStats(ctx context.Context, tenantID *string) *domain.WorkspaceStats {
	courseCount, pendingApprovalCount := h.Service.SchoolAdminStats(ctx, tenantID)
	return &domain.WorkspaceStats{
		Label1: "课程资源", Value1: courseCount, Label2: "待审批资源", Value2: pendingApprovalCount,
	}
}

func (h *PortalHandler) schoolAdminResourceStats(ctx context.Context, tenantID *string) []domain.WorkspaceResourceStat {
	courseCount, scenarioCount, positionCount, questionBankCount, examCount, examUsageCount := h.Service.SchoolAdminResourceStats(ctx, tenantID)
	return []domain.WorkspaceResourceStat{
		{Label: "课程资源", Value: courseCount, Icon: "book-open", Href: "/lesson/admin/system"},
		{Label: "实践场景", Value: scenarioCount, Icon: "layers", Href: "/scene/"},
		{Label: "产业岗位", Value: positionCount, Icon: "briefcase", Href: "/job/positions"},
		{Label: "题库", Value: questionBankCount, Icon: "book-open", Href: "/evaluation/question-banks"},
		{Label: "试卷", Value: examCount, Icon: "file-text", Href: "/evaluation/exams"},
		{Label: "考试", Value: examUsageCount, Icon: "check-circle", Href: "/evaluation/exam-usage"},
	}
}

func (h *PortalHandler) schoolAdminResourceGrowth(ctx context.Context, tenantID *string, months int) []domain.WorkspaceResourceGrowth {
	return h.Service.SchoolAdminResourceGrowth(ctx, tenantID, months)
}

func (h *PortalHandler) schoolAdminPersonnelStats(ctx context.Context, tenantID *string) []domain.WorkspacePersonnelStat {
	rows, _ := h.Service.PersonnelStats(ctx, tenantID)
	counts := map[string]int{}
	for _, r := range rows {
		counts[r.Code] = r.Count
	}
	return []domain.WorkspacePersonnelStat{
		{Label: "学生", Value: counts["student"]},
		{Label: "教职工", Value: counts["teacher"]},
		{Label: "企业导师", Value: counts["enterprise_mentor"]},
		{Label: "学校管理员", Value: counts["school_admin"]},
	}
}

func (h *PortalHandler) schoolAdminTodos(ctx context.Context, tenantID *string) []domain.WorkspaceTodo {
	rows, _ := h.Service.SchoolAdminTodos(ctx, tenantID)
	typeLabels := map[string]string{
		"course":           "待审批课程",
		"scenario":         "待审批场景",
		"career_position":  "待审批岗位",
		"question_bank":    "待审批题库",
		"exam":             "待审批试卷",
		"training_program": "待审批培养方案",
	}
	var todos []domain.WorkspaceTodo
	for _, r := range rows {
		label, ok := typeLabels[r.TargetType]
		if !ok {
			label = "待审批" + r.TargetType
		}
		todos = append(todos, domain.WorkspaceTodo{
			ID: "pending-" + r.TargetType, Title: label, Type: "approve", Count: r.Count, Urgent: true,
		})
	}
	return todos
}

func (h *PortalHandler) listStudentCourses(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceCourse {
	ratio := h.Service.CreditHoursRatio(ctx)
	rows, _ := h.Service.ListStudentCourses(ctx, tenantID)

	var items []domain.WorkspaceCourse
	courseIDs := make([]string, 0, 50)
	for _, c2 := range rows {
		item := domain.WorkspaceCourse{
			ID: c2.ID, Code: c2.Code, Name: c2.Name, Type: c2.Type,
			Teacher: c2.Teacher, Status: publishedStatusLabel(c2.Status),
			Hours: totalHours(c2.OnlineHours, c2.OfflineHours), Cover: coverText(c2.Name),
		}
		item.Credit = int(float64(item.Hours) / ratio)
		items = append(items, item)
		courseIDs = append(courseIDs, c2.ID)
	}
	progressMap := h.Service.BatchCourseProgress(ctx, courseIDs, userID)
	for i := range items {
		items[i].Progress = progressMap[items[i].ID]
	}
	return items
}

func (h *PortalHandler) listStudentSceneTasks(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceSceneTask {
	rows, _ := h.Service.ListSceneTasks(ctx, tenantID)

	var items []domain.WorkspaceSceneTask
	taskIDs := make([]string, 0, 50)
	for _, t := range rows {
		items = append(items, domain.WorkspaceSceneTask{
			ID: t.ID, ScenarioID: t.ScenarioID, SceneName: t.SceneName, TaskName: t.TaskName,
			Position: t.SceneName, AbilityTags: []string{}, Difficulty: difficultyLabel(t.Difficulty),
			Deadline: "", TotalScore: 100,
		})
		taskIDs = append(taskIDs, t.ID)
	}
	statusMap := h.Service.BatchSceneTaskStatus(ctx, taskIDs, userID)
	for i := range items {
		items[i].Status = statusMap[items[i].ID]
		if items[i].Status == "" {
			items[i].Status = "未开始"
		}
	}
	return items
}

func (h *PortalHandler) listStudentExams(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceExam {
	rows, _ := h.Service.ListStudentExams(ctx, userID, tenantID)
	var items []domain.WorkspaceExam
	for _, e := range rows {
		duration := 0
		if e.Duration != nil {
			duration = *e.Duration
		}
		exam := domain.WorkspaceExam{
			ID: e.ID, Name: e.Name, Type: "在线测评", Duration: duration,
			TotalScore: int(e.TotalScore), Status: examStatusLabel(e.Status),
		}
		if e.Score != nil {
			s := int(*e.Score)
			exam.Score = &s
		}
		if e.Start != nil {
			exam.StartTime = store.FormatDateTime(*e.Start)
		}
		if e.End != nil {
			exam.EndTime = store.FormatDateTime(*e.End)
		}
		items = append(items, exam)
	}
	return items
}

func (h *PortalHandler) listTeacherCourses(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceTeacherCourse {
	rows, _ := h.Service.ListTeacherCourses(ctx, userID, tenantID)

	var items []domain.WorkspaceTeacherCourse
	courseIDs := make([]string, 0, 50)
	for _, c2 := range rows {
		items = append(items, domain.WorkspaceTeacherCourse{
			ID: c2.ID, Code: c2.Code, Name: c2.Name, Type: c2.Type,
			ClassName: c2.ClassName, Term: c2.Semester, Status: publishedStatusLabel(c2.Status),
			Hours: totalHours(c2.OnlineHours, c2.OfflineHours), Cover: coverText(c2.Name), Progress: 0,
		})
		courseIDs = append(courseIDs, c2.ID)
	}
	countMap := h.Service.BatchCourseStudentCounts(ctx, courseIDs)
	for i := range items {
		items[i].Students = countMap[items[i].ID]
	}
	return items
}

func (h *PortalHandler) listTeacherClassPlansAndSessions(ctx context.Context, userID string, tenantID *string) ([]domain.WorkspaceClassPlan, []domain.WorkspaceClassSession) {
	var plans []domain.WorkspaceClassPlan
	var sessions []domain.WorkspaceClassSession
	if tenantID == nil {
		return plans, sessions
	}

	periodLabel := h.Service.PeriodLabelMap(ctx, tenantID)
	rows, _ := h.Service.ListClassPlans(ctx, userID, tenantID)

	type planKey struct{ planEntryID, course, term string }
	planIndex := map[planKey]int{}
	dayNames := map[int]string{1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}

	for _, se := range rows {
		seID, planEntryID, courseName, dayOfWeek := se.ID, se.PlanEntryID, se.CourseName, se.DayOfWeek
		startWeek, endWeek, status, termName, teacherName, venueName := se.StartWeek, se.EndWeek, se.Status, se.TermName, se.TeacherName, se.VenueName
		weekPattern, classNames := se.WeekPattern, se.ClassNames
		if planEntryID == "" {
			planEntryID = seID
		}

		key := planKey{planEntryID, courseName, termName}
		idx, ok := planIndex[key]
		if !ok {
			statusVal := "pending"
			if status == "published" {
				statusVal = "active"
			}
			plans = append(plans, domain.WorkspaceClassPlan{
				ID: planEntryID, Name: strings.Join(classNames, "、"), Course: courseName,
				Term: termName, Students: 0, Teacher: teacherName, Status: statusVal,
			})
			idx = len(plans) - 1
			planIndex[key] = idx
		}
		planID := plans[idx].ID

		periodNames := jsonSliceToStrings(se.Periods)
		if len(periodNames) == 0 {
			continue
		}
		periodName := strings.Join(periodNames, "，")
		for w := startWeek; w <= endWeek; w++ {
			if weekPattern == "odd" && w%2 == 0 {
				continue
			}
			if weekPattern == "even" && w%2 != 0 {
				continue
			}
			sessionStatus := "pending"
			if status == "published" {
				sessionStatus = "associated"
			}
			displayPeriod := periodName
			if label, ok := periodLabel[periodName]; ok {
				displayPeriod = label
			}
			sessions = append(sessions, domain.WorkspaceClassSession{
				ID:       seID + "-w" + strconv.Itoa(w),
				CourseID: planID,
				Venue:    venueName,
				Week:     w,
				Weekday:  dayNames[dayOfWeek],
				Period:   displayPeriod,
				Status:   sessionStatus,
			})
		}
	}
	return plans, sessions
}

func totalHours(online, offline *float64) int {
	total := 0.0
	if online != nil {
		total += *online
	}
	if offline != nil {
		total += *offline
	}
	return int(total)
}

func coverText(name string) string {
	if name == "" {
		return "?"
	}
	return string([]rune(name)[0])
}

func publishedStatusLabel(status string) string {
	switch status {
	case "published":
		return "进行中"
	case "archived":
		return "已完成"
	default:
		return "未开始"
	}
}

func difficultyLabel(difficulty int) string {
	switch difficulty {
	case 1, 2:
		return "简单"
	case 3:
		return "中等"
	default:
		return "困难"
	}
}

func examStatusLabel(status string) string {
	switch status {
	case "published":
		return "待考"
	case "in_progress":
		return "进行中"
	case "finished":
		return "已完成"
	default:
		return status
	}
}
