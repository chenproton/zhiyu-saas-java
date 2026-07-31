package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type PortalHandler struct {
	DB *pgxpool.Pool
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

	isTeacher := role == "teacher" || role == "school_admin" || role == "school"

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

	dash.Stats = h.stats(r.Context(), claims.UserID, claims.TenantID, isTeacher)

	if isTeacher {
		dash.TeacherCourses = h.listTeacherCourses(r.Context(), claims.UserID, claims.TenantID)
		dash.ClassPlans, dash.ClassSessions = h.listTeacherClassPlansAndSessions(r.Context(), claims.UserID, claims.TenantID)
	} else {
		dash.Courses = h.listStudentCourses(r.Context(), claims.UserID, claims.TenantID)
		dash.SceneTasks = h.listStudentSceneTasks(r.Context(), claims.UserID, claims.TenantID)
		dash.Exams = h.listStudentExams(r.Context(), claims.UserID, claims.TenantID)
		dash.LearningPath = []domain.WorkspaceLearningPath{}
	}

	respondJSON(w, http.StatusOK, dash)
}

func (h *PortalHandler) listAnnouncements(ctx context.Context, role string, tenantID *string) []domain.WorkspaceAnnouncement {
	rows, err := h.DB.Query(ctx, `
		SELECT id, title, type, is_new, created_at
		FROM announcements
		WHERE (array_length(target_roles, 1) IS NULL OR target_roles @> ARRAY[$1::varchar])
			AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
		ORDER BY created_at DESC
		LIMIT 10
	`, role, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []domain.WorkspaceAnnouncement
	for rows.Next() {
		var a domain.WorkspaceAnnouncement
		var t time.Time
		if err := rows.Scan(&a.ID, &a.Title, &a.Type, &a.IsNew, &t); err != nil {
			continue
		}
		a.Date = t.Format("2006-01-02")
		a.CreatedAt = t
		items = append(items, a)
	}
	return items
}

func (h *PortalHandler) listTodos(ctx context.Context, userID string, tenantID *string, role string) []domain.WorkspaceTodo {
	var todos []domain.WorkspaceTodo
	now := time.Now()
	if role == "teacher" || role == "school_admin" || role == "school" {
		var pendingApprovals int
		approvalQuery := `SELECT COUNT(*) FROM approval_records WHERE status = 'pending'`
		approvalArgs := []interface{}{}
		if tenantID != nil {
			approvalQuery += ` AND tenant_id = $1`
			approvalArgs = append(approvalArgs, *tenantID)
		}
		_ = h.DB.QueryRow(ctx, approvalQuery, approvalArgs...).Scan(&pendingApprovals)
		if pendingApprovals > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID:     "pending-approvals",
				Title:  "待审批事项",
				Type:   "approve",
				Count:  pendingApprovals,
				Urgent: true,
			})
		}
		var draftCourses int
		draftQuery := `
			SELECT COUNT(*) FROM courses c
			JOIN users u ON u.id = c.creator_id
			WHERE c.status = 'draft' AND (c.teacher_id = $1::uuid OR c.creator_id = $1::uuid)`
		draftArgs := []interface{}{userID}
		if tenantID != nil {
			draftQuery += ` AND u.tenant_id = $2`
			draftArgs = append(draftArgs, *tenantID)
		}
		_ = h.DB.QueryRow(ctx, draftQuery, draftArgs...).Scan(&draftCourses)
		if draftCourses > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID:     "draft-courses",
				Title:  "待提交课程",
				Type:   "review",
				Count:  draftCourses,
				Urgent: false,
			})
		}
	} else {
		var upcomingExams int
		examQuery := `
			SELECT COUNT(*) FROM exam_usages eu
			JOIN users u ON u.id = eu.creator_id
			WHERE eu.status = 'published' AND (eu.start_time IS NULL OR eu.start_time >= $1)`
		examArgs := []interface{}{now}
		if tenantID != nil {
			examQuery += ` AND u.tenant_id = $2`
			examArgs = append(examArgs, *tenantID)
		}
		_ = h.DB.QueryRow(ctx, examQuery, examArgs...).Scan(&upcomingExams)
		if upcomingExams > 0 {
			todos = append(todos, domain.WorkspaceTodo{
				ID:     "upcoming-exams",
				Title:  "待参加考试",
				Type:   "exam",
				Count:  upcomingExams,
				Urgent: false,
			})
		}
	}
	return todos
}

func (h *PortalHandler) listSchedule(ctx context.Context, userID string, tenantID *string, role string) []domain.WorkspaceScheduleEvent {
	var events []domain.WorkspaceScheduleEvent
	if role == "teacher" || role == "school_admin" || role == "school" {
		// 教师：取该教师已发布的排课（含课程与场景），展示到周课表网格
		periodLabel := h.periodLabelMap(ctx, tenantID)
		query := `
			SELECT se.id::text, se.course_name, se.type, se.day_of_week, se.periods,
				COALESCE(v.name, '') AS venue_name,
				COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names,
				COALESCE(u.name, '')
			FROM schedule_entries se
			LEFT JOIN venues v ON v.id = se.venue_id
			LEFT JOIN users u ON u.id = se.teacher_id
			WHERE se.status = 'published' AND se.teacher_id = $1::uuid`
		args := []interface{}{userID}
		if tenantID != nil {
			query += ` AND se.tenant_id = $2`
			args = append(args, *tenantID)
		}
		query += ` ORDER BY se.day_of_week, se.start_week LIMIT 50`
		rows, err := h.DB.Query(ctx, query, args...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id, courseName, entryType, venueName, teacherName string
				var dayOfWeek int
				var periods domain.JSONSlice
				var classNames []string
				if err := rows.Scan(&id, &courseName, &entryType, &dayOfWeek, &periods, &venueName, &classNames, &teacherName); err != nil {
					continue
				}
				eventType := "course"
				if entryType == "scene" {
					eventType = "scene"
				}
				periodNames := jsonSliceToStrings(periods)
				if len(periodNames) == 0 {
					continue
				}
				period := periodNames[0]
				if label, ok := periodLabel[period]; ok {
					period = label
				}
				events = append(events, domain.WorkspaceScheduleEvent{
					ID:        id,
					Title:     courseName,
					Type:      eventType,
					DayOfWeek: dayOfWeek,
					Period:    period,
					Location:  venueName,
					ClassName: strings.Join(classNames, "、"),
					Teacher:   teacherName,
					Status:    "进行中",
				})
			}
		}
	} else if role == "student" {
		// 学生：取该学生所在班级已发布的排课，展示到周课表网格
		var classNodeID string
		_ = h.DB.QueryRow(ctx, `
			SELECT org_node_id FROM users WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
		`, userID, tenantID).Scan(&classNodeID)
		if classNodeID != "" {
			periodLabel := h.periodLabelMap(ctx, tenantID)
			query := `
				SELECT se.id::text, se.course_name, se.type, se.day_of_week, se.periods,
					COALESCE(v.name, '') AS venue_name,
					COALESCE(u.name, '')
				FROM schedule_entries se
				LEFT JOIN venues v ON v.id = se.venue_id
				LEFT JOIN users u ON u.id = se.teacher_id
				WHERE se.status = 'published'
				  AND (se.class_node_id = $1::uuid OR $1::uuid = ANY(se.class_node_ids))`
			args := []interface{}{classNodeID}
			if tenantID != nil {
				query += ` AND se.tenant_id = $2`
				args = append(args, *tenantID)
			}
			query += ` ORDER BY se.day_of_week, se.start_week LIMIT 50`
			rows, err := h.DB.Query(ctx, query, args...)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var id, courseName, entryType, venueName, teacherName string
					var dayOfWeek int
					var periods domain.JSONSlice
					if err := rows.Scan(&id, &courseName, &entryType, &dayOfWeek, &periods, &venueName, &teacherName); err != nil {
						continue
					}
					eventType := "course"
					if entryType == "scene" {
						eventType = "scene"
					}
					periodNames := jsonSliceToStrings(periods)
					if len(periodNames) == 0 {
						continue
					}
					period := periodNames[0]
					if label, ok := periodLabel[period]; ok {
						period = label
					}
					events = append(events, domain.WorkspaceScheduleEvent{
						ID:        id,
						Title:     courseName,
						Type:      eventType,
						DayOfWeek: dayOfWeek,
						Period:    period,
						Location:  venueName,
						Teacher:   teacherName,
						Status:    "进行中",
					})
				}
			}
		}
	}
	rows, err := h.DB.Query(ctx, `
		SELECT eu.id, eu.name, eu.start_time, eu.status
		FROM exam_usages eu
		JOIN users u ON u.id = eu.creator_id
		WHERE eu.status IN ('published', 'in_progress')
			AND ($1::uuid IS NULL OR u.tenant_id = $1::uuid)
		ORDER BY eu.start_time ASC NULLS LAST
		LIMIT 20
	`, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, name, status string
			var start *time.Time
			if err := rows.Scan(&id, &name, &start, &status); err != nil {
				continue
			}
			dayOfWeek := 1
			if start != nil {
				dayOfWeek = int(start.Weekday())
				if dayOfWeek == 0 {
					dayOfWeek = 7
				}
			}
			events = append(events, domain.WorkspaceScheduleEvent{
				ID:        id,
				Title:     name,
				Type:      "exam",
				DayOfWeek: dayOfWeek,
				Period:    "上午 1",
				Status:    status,
			})
		}
	}
	return events
}

func (h *PortalHandler) stats(ctx context.Context, userID string, tenantID *string, isTeacher bool) *domain.WorkspaceStats {
	if isTeacher {
		var courseCount, studentCount int
		_ = h.DB.QueryRow(ctx, `
			WITH teacher_courses AS (
				SELECT c.id
				FROM courses c
				JOIN users u ON u.id = c.creator_id
				WHERE c.status = 'published'
				  AND (c.teacher_id = $1::uuid OR c.creator_id = $1::uuid)
				  AND ($2::uuid IS NULL OR u.tenant_id = $2::uuid)
			)
			SELECT
				(SELECT COUNT(*) FROM teacher_courses),
				COALESCE((SELECT COUNT(DISTINCT r.student_user_id)
						  FROM lesson_behavior_records r
						  WHERE r.course_id IN (SELECT id FROM teacher_courses)), 0)
		`, userID, tenantID).Scan(&courseCount, &studentCount)
		return &domain.WorkspaceStats{Label1: "授课课程", Value1: courseCount, Label2: "学生人数", Value2: studentCount}
	}
	var courseCount, examCount int
	_ = h.DB.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM courses c
			 JOIN users u ON u.id = c.creator_id
			 WHERE c.status = 'published' AND ($1::uuid IS NULL OR u.tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM exam_usages eu
			 JOIN users u ON u.id = eu.creator_id
			 WHERE eu.status = 'published' AND ($1::uuid IS NULL OR u.tenant_id = $1::uuid))
	`, tenantID).Scan(&courseCount, &examCount)
	return &domain.WorkspaceStats{Label1: "可选课程", Value1: courseCount, Label2: "待考测评", Value2: examCount}
}

func (h *PortalHandler) listStudentCourses(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceCourse {
	ratio := h.creditHoursRatio(ctx)

	query := `
		SELECT c.id, c.code, c.name, c.type, c.category, c.online_hours, c.offline_hours,
			c.semester, c.class_name, c.status, c.cover_color, c.cover_image, u.name
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.status = 'published'`
	args := []interface{}{}
	if tenantID != nil {
		query += ` AND (u.tenant_id = $1 OR c.creator_id IN (SELECT id FROM users WHERE tenant_id = $1))`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY c.updated_at DESC LIMIT 50`
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []domain.WorkspaceCourse
	courseIDs := make([]string, 0, 50)
	for rows.Next() {
		var c domain.WorkspaceCourse
		var onlineHours, offlineHours *float64
		var category, semester, className, coverColor, coverImage, teacher, status string
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.Type, &category, &onlineHours, &offlineHours,
			&semester, &className, &status, &coverColor, &coverImage, &teacher); err != nil {
			continue
		}
		c.Teacher = teacher
		c.Status = publishedStatusLabel(status)
		c.Hours = totalHours(onlineHours, offlineHours)
		c.Credit = int(float64(c.Hours) / ratio)
		c.Cover = coverText(c.Name)
		items = append(items, c)
		courseIDs = append(courseIDs, c.ID)
	}

	progressMap := h.batchCourseProgress(ctx, courseIDs, userID)
	for i := range items {
		items[i].Progress = progressMap[items[i].ID]
	}
	return items
}

func (h *PortalHandler) listStudentSceneTasks(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceSceneTask {
	query := `
		SELECT t.id, t.scenario_id, s.name, t.name, t.difficulty
		FROM scenario_tasks t
		JOIN scenarios s ON s.id = t.scenario_id
		JOIN users u ON u.id = s.creator_id
		WHERE s.status = 'published'`
	args := []interface{}{}
	if tenantID != nil {
		query += ` AND u.tenant_id = $1`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY s.updated_at DESC LIMIT 50`
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []domain.WorkspaceSceneTask
	taskIDs := make([]string, 0, 50)
	for rows.Next() {
		var task domain.WorkspaceSceneTask
		var difficulty int
		if err := rows.Scan(&task.ID, &task.ScenarioID, &task.SceneName, &task.TaskName, &difficulty); err != nil {
			continue
		}
		task.Position = task.SceneName
		task.AbilityTags = []string{}
		task.Difficulty = difficultyLabel(difficulty)
		task.Deadline = ""
		task.TotalScore = 100
		items = append(items, task)
		taskIDs = append(taskIDs, task.ID)
	}

	statusMap := h.batchSceneTaskStatus(ctx, taskIDs, userID)
	for i := range items {
		items[i].Status = statusMap[items[i].ID]
		if items[i].Status == "" {
			items[i].Status = "未开始"
		}
	}
	return items
}

func (h *PortalHandler) listStudentExams(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceExam {
	query := `
		SELECT eu.id, eu.name, eu.start_time, eu.end_time, eu.duration, eu.status, e.total_score,
			er.score
		FROM exam_usages eu
		JOIN exams e ON e.id = eu.exam_id
		JOIN users u ON u.id = eu.creator_id
		LEFT JOIN exam_results er ON er.exam_usage_id = eu.id AND er.user_id = $1::uuid
		WHERE eu.status IN ('published', 'in_progress', 'finished')`
	args := []interface{}{userID}
	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY eu.start_time ASC NULLS LAST LIMIT 50`
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []domain.WorkspaceExam
	for rows.Next() {
		var exam domain.WorkspaceExam
		var start, end *time.Time
		var score *float64
		var totalScore float64
		if err := rows.Scan(&exam.ID, &exam.Name, &start, &end, &exam.Duration, &exam.Status, &totalScore, &score); err != nil {
			continue
		}
		exam.Type = "在线测评"
		exam.TotalScore = int(totalScore)
		if score != nil {
			s := int(*score)
			exam.Score = &s
		}
		exam.Status = examStatusLabel(exam.Status)
		if start != nil {
			exam.StartTime = start.Format("2006-01-02 15:04")
		}
		if end != nil {
			exam.EndTime = end.Format("2006-01-02 15:04")
		}
		items = append(items, exam)
	}
	return items
}

func (h *PortalHandler) listTeacherCourses(ctx context.Context, userID string, tenantID *string) []domain.WorkspaceTeacherCourse {
	query := `
		SELECT c.id, c.code, c.name, c.type, c.category, c.online_hours, c.offline_hours,
			c.semester, c.class_name, c.status, c.cover_color, c.cover_image
		FROM courses c
		JOIN users u ON u.id = c.creator_id
		WHERE c.status = 'published' AND (c.teacher_id = $1::uuid OR c.creator_id = $1::uuid)`
	args := []interface{}{userID}
	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY c.updated_at DESC LIMIT 50`
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []domain.WorkspaceTeacherCourse
	courseIDs := make([]string, 0, 50)
	for rows.Next() {
		var c domain.WorkspaceTeacherCourse
		var onlineHours, offlineHours *float64
		var category, semester, className, coverColor, coverImage, status string
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.Type, &category, &onlineHours, &offlineHours,
			&semester, &className, &status, &coverColor, &coverImage); err != nil {
			continue
		}
		c.ClassName = className
		c.Term = semester
		c.Status = publishedStatusLabel(status)
		c.Hours = totalHours(onlineHours, offlineHours)
		c.Cover = coverText(c.Name)
		c.Progress = 0
		items = append(items, c)
		courseIDs = append(courseIDs, c.ID)
	}

	countMap := h.batchCourseStudentCounts(ctx, courseIDs)
	for i := range items {
		items[i].Students = countMap[items[i].ID]
	}
	return items
}

// listTeacherClassPlansAndSessions 从 schedule_entries 构建教师的课程/场景计划与节次。
// 一个教学计划条目（plan_entry_id）对应一个 ClassPlan，其下的排课节次展开为每周的 ClassSession。
func (h *PortalHandler) listTeacherClassPlansAndSessions(ctx context.Context, userID string, tenantID *string) ([]domain.WorkspaceClassPlan, []domain.WorkspaceClassSession) {
	var plans []domain.WorkspaceClassPlan
	var sessions []domain.WorkspaceClassSession
	if tenantID == nil {
		return plans, sessions
	}

	periodLabel := h.periodLabelMap(ctx, tenantID)

	query := `
		SELECT se.id::text, COALESCE(se.plan_entry_id::text, ''), se.course_name, se.type, se.day_of_week,
			se.periods, se.start_week, se.end_week, se.week_pattern, se.status,
			COALESCE(t.name, ''), COALESCE(u.name, ''), COALESCE(v.name, ''),
			COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names
		FROM schedule_entries se
		JOIN terms t ON t.id = se.term_id
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		WHERE se.teacher_id = $1::uuid AND se.tenant_id = $2::uuid
		ORDER BY t.start_date DESC, se.day_of_week, se.start_week, se.course_name`
	rows, err := h.DB.Query(ctx, query, userID, *tenantID)
	if err != nil {
		return plans, sessions
	}
	defer rows.Close()

	type planKey struct{ planEntryID, course, term string }
	planIndex := map[planKey]int{}
	dayNames := map[int]string{1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}

	for rows.Next() {
		var seID, planEntryID, courseName, entryType, status, termName, teacherName, venueName string
		var dayOfWeek, startWeek, endWeek int
		var weekPattern string
		var periods domain.JSONSlice
		var classNames []string
		if err := rows.Scan(&seID, &planEntryID, &courseName, &entryType, &dayOfWeek, &periods,
			&startWeek, &endWeek, &weekPattern, &status, &termName, &teacherName, &venueName, &classNames); err != nil {
			continue
		}
		if planEntryID == "" {
			planEntryID = seID
		}

		// 按 计划条目+课程名+学期 归并为一个 ClassPlan（同一计划条目多条排课共享）
		key := planKey{planEntryID, courseName, termName}
		idx, ok := planIndex[key]
		if !ok {
			statusVal := "pending"
			if status == "published" {
				statusVal = "active"
			}
			plans = append(plans, domain.WorkspaceClassPlan{
				ID:       planEntryID,
				Name:     strings.Join(classNames, "、"),
				Course:   courseName,
				Term:     termName,
				Students: 0,
				Teacher:  teacherName,
				Status:   statusVal,
			})
			idx = len(plans) - 1
			planIndex[key] = idx
		}
		planID := plans[idx].ID

		// 节次展开：按周次模式生成该排课覆盖的周
		periodNames := jsonSliceToStrings(periods)
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

func (h *PortalHandler) creditHoursRatio(ctx context.Context) float64 {
	var ratio float64
	_ = h.DB.QueryRow(ctx, `SELECT COALESCE(value::float, 16) FROM platform_configs WHERE key = 'credit_hours_ratio'`).Scan(&ratio)
	if ratio <= 0 {
		ratio = 16
	}
	return ratio
}

func (h *PortalHandler) batchCourseProgress(ctx context.Context, courseIDs []string, userID string) map[string]int {
	result := make(map[string]int)
	if len(courseIDs) == 0 {
		return result
	}
	rows, err := h.DB.Query(ctx, `
		SELECT course_id, COUNT(*), COUNT(*) FILTER (WHERE attendance = 'present')
		FROM lesson_behavior_records
		WHERE course_id = ANY($1::uuid[]) AND student_user_id = $2::uuid
		GROUP BY course_id
	`, courseIDs, userID)
	if err != nil {
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var courseID string
		var total, present int
		if err := rows.Scan(&courseID, &total, &present); err != nil {
			continue
		}
		if total == 0 {
			result[courseID] = 0
		} else {
			result[courseID] = present * 100 / total
		}
	}
	return result
}

func (h *PortalHandler) batchCourseStudentCounts(ctx context.Context, courseIDs []string) map[string]int {
	result := make(map[string]int)
	if len(courseIDs) == 0 {
		return result
	}
	rows, err := h.DB.Query(ctx, `
		SELECT course_id, COUNT(DISTINCT student_user_id)
		FROM lesson_behavior_records
		WHERE course_id = ANY($1::uuid[])
		GROUP BY course_id
	`, courseIDs)
	if err != nil {
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var courseID string
		var count int
		if err := rows.Scan(&courseID, &count); err != nil {
			continue
		}
		result[courseID] = count
	}
	return result
}

func (h *PortalHandler) batchSceneTaskStatus(ctx context.Context, taskIDs []string, userID string) map[string]string {
	result := make(map[string]string)
	if len(taskIDs) == 0 {
		return result
	}
	rows, err := h.DB.Query(ctx, `
		SELECT DISTINCT ON (task_id) task_id, status, total_score
		FROM scene_evaluation_results
		WHERE task_id = ANY($1::uuid[]) AND evaluatee_id = $2::uuid
		ORDER BY task_id, created_at DESC
	`, taskIDs, userID)
	if err != nil {
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var taskID, status string
		var score *float64
		if err := rows.Scan(&taskID, &status, &score); err != nil {
			continue
		}
		switch {
		case status == "":
			result[taskID] = "未开始"
		case status == "evaluated" || score != nil:
			result[taskID] = "已完成"
		default:
			result[taskID] = "进行中"
		}
	}
	return result
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

// periodLabelMap 构建 节次名称 → 周课表网格标签 的映射。
// 教师工作台课表网格使用「上午 1/下午 2/晚自习 1」风格的固定列，而排课存的是节次名称，
// 因此按 sort_order 顺序将前 4 节映射为 上午 1-4、中间 4 节映射为 下午 1-4、其余映射为 晚自习 N。
func (h *PortalHandler) periodLabelMap(ctx context.Context, tenantID *string) map[string]string {
	m := map[string]string{}
	if tenantID == nil {
		return m
	}
	rows, err := h.DB.Query(ctx, `
		SELECT name FROM period_slots WHERE tenant_id = $1 ORDER BY sort_order ASC
	`, *tenantID)
	if err != nil {
		return m
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			continue
		}
		names = append(names, n)
	}
	for i, n := range names {
		switch {
		case i < 4:
			m[n] = "上午 " + strconv.Itoa(i+1)
		case i < 8:
			m[n] = "下午 " + strconv.Itoa(i-3)
		default:
			m[n] = "晚自习 " + strconv.Itoa(i-7)
		}
	}
	return m
}
