package store

import (
	"context"
	"strconv"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// PortalStore 工作台聚合查询持久化（只读）。
type PortalStore struct {
	q Queryer
}

// NewPortalStore 创建工作台 store。
func NewPortalStore(q Queryer) *PortalStore {
	return &PortalStore{q: q}
}

// AnnouncementRow 公告行。
type AnnouncementRow struct {
	ID        string
	Title     string
	Type      string
	IsNew     bool
	CreatedAt time.Time
}

// ListAnnouncements 查询公告。
func (s *PortalStore) ListAnnouncements(ctx context.Context, role string, tenantID *string) ([]AnnouncementRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, title, type, is_new, created_at
		FROM announcements
		WHERE (array_length(target_roles, 1) IS NULL OR target_roles @> ARRAY[$1::varchar])
			AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
		ORDER BY created_at DESC
		LIMIT 10
	`, role, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AnnouncementRow
	for rows.Next() {
		var a AnnouncementRow
		if err := rows.Scan(&a.ID, &a.Title, &a.Type, &a.IsNew, &a.CreatedAt); err != nil {
			continue
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

// PendingApprovalCount 待审批数。
func (s *PortalStore) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	var count int
	query := `SELECT COUNT(*) FROM approval_records WHERE status = 'pending'`
	args := []any{}
	if tenantID != nil {
		query += ` AND tenant_id = $1`
		args = append(args, *tenantID)
	}
	_ = s.q.QueryRow(ctx, query, args...).Scan(&count)
	return count
}

// DraftCourseCount 待提交课程数。
func (s *PortalStore) DraftCourseCount(ctx context.Context, userID string, tenantID *string) int {
	var count int
	query := `
		SELECT COUNT(*) FROM courses c
		JOIN users u ON u.id = c.creator_id
		WHERE c.status = 'draft' AND (c.teacher_id = $1::uuid OR c.creator_id = $1::uuid)`
	args := []any{userID}
	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	}
	_ = s.q.QueryRow(ctx, query, args...).Scan(&count)
	return count
}

// UpcomingExamCount 待参加考试数。
func (s *PortalStore) UpcomingExamCount(ctx context.Context, tenantID *string, now time.Time, classNodeID string) int {
	var count int
	query := `
		SELECT COUNT(*) FROM exam_usages eu
		JOIN users u ON u.id = eu.creator_id
		WHERE eu.status = 'published' AND (eu.start_time IS NULL OR eu.start_time >= $1)
		  AND eu.target_type IN (` + manualExamUsageTargetTypesSQL + `)`
	args := []any{now}
	if classNodeID != "" {
		query += ` AND (eu.target_type <> 'class' OR $2::uuid = ANY(eu.target_ids))`
		args = append(args, classNodeID)
	} else {
		query += ` AND eu.target_type <> 'class'`
	}
	if tenantID != nil {
		query += ` AND u.tenant_id = $` + strconv.Itoa(len(args)+1)
		args = append(args, *tenantID)
	}
	_ = s.q.QueryRow(ctx, query, args...).Scan(&count)
	return count
}

// TeacherScheduleRow 教师排课行。
type TeacherScheduleRow struct {
	ID          string
	CourseName  string
	EntryType   string
	DayOfWeek   int
	Periods     domain.JSONSlice
	VenueName   string
	ClassNames  []string
	TeacherName string
	ScenarioID  string
	CourseID    string
}

// ListTeacherSchedules 教师排课事件。
func (s *PortalStore) ListTeacherSchedules(ctx context.Context, userID string, tenantID *string) ([]TeacherScheduleRow, error) {
	query := `
		SELECT se.id::text, se.course_name, se.type, se.day_of_week, se.periods,
			COALESCE(v.name, '') AS venue_name,
			COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names,
			COALESCE(u.name, ''), COALESCE(se.scenario_id::text, ''), COALESCE(se.course_id::text, '')
		FROM schedule_entries se
		LEFT JOIN venues v ON v.id = se.venue_id
		LEFT JOIN users u ON u.id = se.teacher_id
		WHERE se.status = 'published' AND se.teacher_id = $1::uuid`
	args := []any{userID}
	if tenantID != nil {
		query += ` AND se.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY se.day_of_week, se.start_week LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []TeacherScheduleRow
	for rows.Next() {
		var r TeacherScheduleRow
		if err := rows.Scan(&r.ID, &r.CourseName, &r.EntryType, &r.DayOfWeek, &r.Periods, &r.VenueName, &r.ClassNames, &r.TeacherName, &r.ScenarioID, &r.CourseID); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// UserClassNodeID 查询用户班级节点。
func (s *PortalStore) UserClassNodeID(ctx context.Context, userID string, tenantID *string) string {
	var classNodeID string
	_ = s.q.QueryRow(ctx, `
		SELECT org_node_id FROM users WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2::uuid)
	`, userID, tenantID).Scan(&classNodeID)
	return classNodeID
}

// StudentScheduleRow 学生排课行。
type StudentScheduleRow struct {
	ID          string
	CourseName  string
	EntryType   string
	DayOfWeek   int
	Periods     domain.JSONSlice
	VenueName   string
	TeacherName string
	ScenarioID  string
	CourseID    string
}

// ListStudentSchedules 学生班级排课事件。
func (s *PortalStore) ListStudentSchedules(ctx context.Context, classNodeID string, tenantID *string) ([]StudentScheduleRow, error) {
	query := `
		SELECT se.id::text, se.course_name, se.type, se.day_of_week, se.periods,
			COALESCE(v.name, '') AS venue_name,
			COALESCE(u.name, ''), COALESCE(se.scenario_id::text, ''), COALESCE(se.course_id::text, '')
		FROM schedule_entries se
		LEFT JOIN venues v ON v.id = se.venue_id
		LEFT JOIN users u ON u.id = se.teacher_id
		WHERE se.status = 'published'
		  AND (se.class_node_id = $1::uuid OR $1::uuid = ANY(se.class_node_ids))`
	args := []any{classNodeID}
	if tenantID != nil {
		query += ` AND se.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY se.day_of_week, se.start_week LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StudentScheduleRow
	for rows.Next() {
		var r StudentScheduleRow
		if err := rows.Scan(&r.ID, &r.CourseName, &r.EntryType, &r.DayOfWeek, &r.Periods, &r.VenueName, &r.TeacherName, &r.ScenarioID, &r.CourseID); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// ExamEventRow 考试事件行。
type ExamEventRow struct {
	ID     string
	Name   string
	Start  *time.Time
	Status string
}

// ListExamEvents 全局考试事件。classNodeID 非空时（学生），班级类考试仅返回本人班级命中的安排。
func (s *PortalStore) ListExamEvents(ctx context.Context, tenantID *string, classNodeID string) ([]ExamEventRow, error) {
	query := `
		SELECT eu.id, eu.name, eu.start_time, eu.status
		FROM exam_usages eu
		JOIN users u ON u.id = eu.creator_id
		WHERE eu.status IN ('published', 'in_progress')
			AND eu.target_type IN (` + manualExamUsageTargetTypesSQL + `)`
	args := []any{}
	if classNodeID != "" {
		query += ` AND (eu.target_type <> 'class' OR $1::uuid = ANY(eu.target_ids))`
		args = append(args, classNodeID)
	} else {
		query += ` AND eu.target_type <> 'class'`
	}
	if tenantID != nil {
		query += ` AND u.tenant_id = $` + strconv.Itoa(len(args)+1)
		args = append(args, *tenantID)
	}
	query += ` ORDER BY eu.start_time ASC NULLS LAST LIMIT 20`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ExamEventRow
	for rows.Next() {
		var r ExamEventRow
		if err := rows.Scan(&r.ID, &r.Name, &r.Start, &r.Status); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// TeacherStats 教师统计。
func (s *PortalStore) TeacherStats(ctx context.Context, userID string, tenantID *string) (int, int) {
	var courseCount, studentCount int
	_ = s.q.QueryRow(ctx, `
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
	return courseCount, studentCount
}

// StudentStats 学生统计。
func (s *PortalStore) StudentStats(ctx context.Context, tenantID *string) (int, int) {
	var courseCount, examCount int
	_ = s.q.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM courses c
			 JOIN users u ON u.id = c.creator_id
			 WHERE c.status = 'published' AND ($1::uuid IS NULL OR u.tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM exam_usages eu
			 JOIN users u ON u.id = eu.creator_id
			 WHERE eu.status = 'published' AND ($1::uuid IS NULL OR u.tenant_id = $1::uuid))
	`, tenantID).Scan(&courseCount, &examCount)
	return courseCount, examCount
}

// SchoolAdminStats 学校管理员统计。
func (s *PortalStore) SchoolAdminStats(ctx context.Context, tenantID *string) (int, int) {
	var courseCount, pendingApprovalCount int
	courseQuery := `SELECT COUNT(*) FROM courses WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)`
	approvalQuery := `SELECT COUNT(*) FROM approval_records WHERE status = 'pending' AND ($1::uuid IS NULL OR tenant_id = $1::uuid)`
	_ = s.q.QueryRow(ctx, courseQuery, tenantID).Scan(&courseCount)
	_ = s.q.QueryRow(ctx, approvalQuery, tenantID).Scan(&pendingApprovalCount)
	return courseCount, pendingApprovalCount
}

// SchoolAdminResourceStats 学校管理员资源统计。
func (s *PortalStore) SchoolAdminResourceStats(ctx context.Context, tenantID *string) (int, int, int, int, int, int) {
	var courseCount, scenarioCount, positionCount, questionBankCount, examCount, examUsageCount int
	_ = s.q.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM courses WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM scenarios WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM career_positions WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM question_banks WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM exams WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)),
			(SELECT COUNT(*) FROM exam_usages WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid))
	`, tenantID).Scan(&courseCount, &scenarioCount, &positionCount, &questionBankCount, &examCount, &examUsageCount)
	return courseCount, scenarioCount, positionCount, questionBankCount, examCount, examUsageCount
}

// PersonnelStatRow 人员统计行。
type PersonnelStatRow struct {
	Code  string
	Count int
}

// PersonnelStats 人员统计。
func (s *PortalStore) PersonnelStats(ctx context.Context, tenantID *string) ([]PersonnelStatRow, error) {
	query := `
		SELECT r.code, COUNT(DISTINCT ur.user_id)
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ($1::uuid IS NULL OR r.tenant_id = $1::uuid)
		  AND r.code IN ('student', 'teacher', 'enterprise_mentor', 'school_admin')
		GROUP BY r.code
	`
	rows, err := s.q.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PersonnelStatRow
	for rows.Next() {
		var r PersonnelStatRow
		if err := rows.Scan(&r.Code, &r.Count); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// SchoolAdminTodoRow 待办行。
type SchoolAdminTodoRow struct {
	TargetType string
	Count      int
}

// SchoolAdminTodos 学校管理员待办。
func (s *PortalStore) SchoolAdminTodos(ctx context.Context, tenantID *string) ([]SchoolAdminTodoRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT target_type, COUNT(*)
		FROM approval_records
		WHERE status = 'pending' AND ($1::uuid IS NULL OR tenant_id = $1::uuid)
		GROUP BY target_type
		ORDER BY COUNT(*) DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SchoolAdminTodoRow
	for rows.Next() {
		var r SchoolAdminTodoRow
		if err := rows.Scan(&r.TargetType, &r.Count); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// StudentCourseRow 学生课程行。
type StudentCourseRow struct {
	ID           string
	Code         string
	Name         string
	Type         string
	Category     string
	OnlineHours  *float64
	OfflineHours *float64
	Semester     string
	ClassName    string
	Status       string
	CoverColor   string
	CoverImage   string
	Teacher      string
}

// ScenePositionRow 场景关联岗位行。
type ScenePositionRow struct {
	PositionID string
	Name       string
}

// ListScenePositions 学生班级已排课场景关联的岗位（去重，与"我的实践场景"同一批排课场景口径）。
func (s *PortalStore) ListScenePositions(ctx context.Context, tenantID, userID string) ([]ScenePositionRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT DISTINCT s.career_position_id, COALESCE(cp.name, '')
		FROM scenarios s
		JOIN users u ON u.id = s.creator_id
		JOIN users st ON st.id = $2
		LEFT JOIN career_positions cp ON cp.id = s.career_position_id
		WHERE s.status = 'published' AND s.career_position_id IS NOT NULL AND u.tenant_id = $1
			AND EXISTS (
				SELECT 1 FROM schedule_entries se
				WHERE se.scenario_id = s.id AND se.status = 'published' AND se.type = 'scene'
					AND (se.class_node_id = st.org_node_id OR st.org_node_id = ANY(se.class_node_ids))
			)
		ORDER BY COALESCE(cp.name, '')
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ScenePositionRow
	for rows.Next() {
		var r ScenePositionRow
		if err := rows.Scan(&r.PositionID, &r.Name); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// CountStudentScenes 学生有已评评分记录且班级已排课（published）的去重场景数。
func (s *PortalStore) CountStudentScenes(ctx context.Context, tenantID, userID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx, `
		SELECT COUNT(DISTINCT t.scenario_id)
		FROM scene_evaluation_results r
		JOIN scenario_tasks t ON t.id = r.task_id
		JOIN users st ON st.id = $2
		WHERE r.tenant_id = $1 AND r.evaluatee_id = $2 AND r.status = 'evaluated' AND r.total_score IS NOT NULL
			AND EXISTS (
				SELECT 1 FROM schedule_entries se
				WHERE se.scenario_id = t.scenario_id AND se.status = 'published' AND se.type = 'scene'
					AND (se.class_node_id = st.org_node_id OR st.org_node_id = ANY(se.class_node_ids))
			)
	`, tenantID, userID).Scan(&n)
	if err != nil {
		return 0, err
	}
	return n, nil
}

// ListStudentCourses 学生课程（仅返回排课表中已发布且属于学生班级的课程）。
func (s *PortalStore) ListStudentCourses(ctx context.Context, userID string, tenantID *string) ([]StudentCourseRow, error) {
	query := `
		SELECT c.id, c.code, c.name, c.type, COALESCE(c.category, ''), c.online_hours, c.offline_hours,
			COALESCE(c.semester, ''), COALESCE(c.class_name, ''), c.status,
			COALESCE(c.cover_color, ''), COALESCE(c.cover_image, ''), COALESCE(t.name, '')
		FROM courses c
		JOIN users st ON st.id = $1
		LEFT JOIN users t ON t.id = c.teacher_id
		WHERE c.status = 'published'`
	args := []any{userID}
	if tenantID != nil {
		query += ` AND (t.tenant_id = $2 OR c.creator_id IN (SELECT id FROM users WHERE tenant_id = $2))`
		args = append(args, *tenantID)
	}
	query += ` AND EXISTS (
		SELECT 1 FROM schedule_entries se
		WHERE se.course_id = c.id AND se.status = 'published'
			AND (se.class_node_id = st.org_node_id OR st.org_node_id = ANY(se.class_node_ids))
	)
	ORDER BY c.updated_at DESC LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StudentCourseRow
	for rows.Next() {
		var r StudentCourseRow
		if err := rows.Scan(&r.ID, &r.Code, &r.Name, &r.Type, &r.Category, &r.OnlineHours, &r.OfflineHours,
			&r.Semester, &r.ClassName, &r.Status, &r.CoverColor, &r.CoverImage, &r.Teacher); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// SceneTaskRow 场景任务行。
type SceneTaskRow struct {
	ID         string
	ScenarioID string
	SceneName  string
	TaskName   string
	Difficulty int
}

// ListSceneTasks 场景任务（仅返回排课表中已发布且属于学生班级的场景）。
func (s *PortalStore) ListSceneTasks(ctx context.Context, userID string, tenantID *string) ([]SceneTaskRow, error) {
	query := `
		SELECT t.id, t.scenario_id, s.name, t.name, t.difficulty
		FROM scenario_tasks t
		JOIN scenarios s ON s.id = t.scenario_id
		JOIN users st ON st.id = $1
		JOIN users u ON u.id = s.creator_id
		WHERE s.status = 'published'`
	args := []any{userID}
	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` AND EXISTS (
		SELECT 1 FROM schedule_entries se
		WHERE se.scenario_id = s.id AND se.status = 'published' AND se.type = 'scene'
			AND (se.class_node_id = st.org_node_id OR st.org_node_id = ANY(se.class_node_ids))
	)
	ORDER BY s.updated_at DESC LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SceneTaskRow
	for rows.Next() {
		var r SceneTaskRow
		if err := rows.Scan(&r.ID, &r.ScenarioID, &r.SceneName, &r.TaskName, &r.Difficulty); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// ExamRow 考试行。
type ExamRow struct {
	ID         string
	ExamID     string
	Name       string
	Start      *time.Time
	End        *time.Time
	Duration   *int
	Status     string
	TotalScore float64
	Score      *float64
}

// ListStudentExams 学生考试。classNodeID 非空时（学生有班级），班级类考试仅返回本人班级命中的安排。
func (s *PortalStore) ListStudentExams(ctx context.Context, userID string, tenantID *string, classNodeID string) ([]ExamRow, error) {
	query := `
		SELECT eu.id, eu.exam_id, eu.name, eu.start_time, eu.end_time, eu.duration, eu.status, e.total_score,
			er.score
		FROM exam_usages eu
		JOIN exams e ON e.id = eu.exam_id
		JOIN users u ON u.id = eu.creator_id
		LEFT JOIN exam_results er ON er.exam_usage_id = eu.id AND er.user_id = $1::uuid
		WHERE eu.status IN ('published', 'in_progress', 'finished')
		  AND eu.target_type IN (` + manualExamUsageTargetTypesSQL + `)`
	args := []any{userID}
	if classNodeID != "" {
		query += ` AND (eu.target_type <> 'class' OR $2::uuid = ANY(eu.target_ids))`
		args = append(args, classNodeID)
	} else {
		query += ` AND eu.target_type <> 'class'`
	}
	if tenantID != nil {
		query += ` AND u.tenant_id = $` + strconv.Itoa(len(args)+1)
		args = append(args, *tenantID)
	}
	query += ` ORDER BY eu.start_time ASC NULLS LAST LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ExamRow
	for rows.Next() {
		var r ExamRow
		if err := rows.Scan(&r.ID, &r.ExamID, &r.Name, &r.Start, &r.End, &r.Duration, &r.Status, &r.TotalScore, &r.Score); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// TeacherCourseRow 教师课程行。
type TeacherCourseRow struct {
	ID           string
	Code         string
	Name         string
	Type         string
	Category     string
	OnlineHours  *float64
	OfflineHours *float64
	Semester     string
	ClassName    string
	Status       string
	CoverColor   string
	CoverImage   string
}

// ListTeacherCourses 教师课程。
func (s *PortalStore) ListTeacherCourses(ctx context.Context, userID string, tenantID *string) ([]TeacherCourseRow, error) {
	query := `
		SELECT c.id, c.code, c.name, c.type, COALESCE(c.category, ''), c.online_hours, c.offline_hours,
			COALESCE(c.semester, ''), COALESCE(c.class_name, ''), c.status,
			COALESCE(c.cover_color, ''), COALESCE(c.cover_image, '')
		FROM courses c
		JOIN users u ON u.id = c.creator_id
		WHERE c.status = 'published' AND (c.teacher_id = $1::uuid OR c.creator_id = $1::uuid)`
	args := []any{userID}
	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	}
	query += ` ORDER BY c.updated_at DESC LIMIT 50`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []TeacherCourseRow
	for rows.Next() {
		var r TeacherCourseRow
		if err := rows.Scan(&r.ID, &r.Code, &r.Name, &r.Type, &r.Category, &r.OnlineHours, &r.OfflineHours,
			&r.Semester, &r.ClassName, &r.Status, &r.CoverColor, &r.CoverImage); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// ClassPlanRow 班级计划行。
type ClassPlanRow struct {
	ID          string
	PlanEntryID string
	CourseName  string
	Type        string
	DayOfWeek   int
	Periods     domain.JSONSlice
	StartWeek   int
	EndWeek     int
	WeekPattern string
	Status      string
	TermName    string
	TeacherName string
	VenueName   string
	ClassNames  []string
	ScenarioID  string
	CourseID    string
}

// ListClassPlans 教师班级计划。
func (s *PortalStore) ListClassPlans(ctx context.Context, userID string, tenantID *string) ([]ClassPlanRow, error) {
	query := `
		SELECT se.id::text, COALESCE(se.plan_entry_id::text, ''), se.course_name, se.type, se.day_of_week,
			se.periods, se.start_week, se.end_week, se.week_pattern, se.status,
			COALESCE(t.name, ''), COALESCE(u.name, ''), COALESCE(v.name, ''),
			COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names,
			COALESCE(se.scenario_id::text, ''), COALESCE(se.course_id::text, '')
		FROM schedule_entries se
		JOIN terms t ON t.id = se.term_id
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		WHERE se.teacher_id = $1::uuid AND se.tenant_id = $2::uuid
		ORDER BY t.start_date DESC, se.day_of_week, se.start_week, se.course_name
	`
	rows, err := s.q.Query(ctx, query, userID, *tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ClassPlanRow
	for rows.Next() {
		var r ClassPlanRow
		if err := rows.Scan(&r.ID, &r.PlanEntryID, &r.CourseName, &r.Type, &r.DayOfWeek, &r.Periods,
			&r.StartWeek, &r.EndWeek, &r.WeekPattern, &r.Status,
			&r.TermName, &r.TeacherName, &r.VenueName, &r.ClassNames, &r.ScenarioID, &r.CourseID); err != nil {
			continue
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// CreditHoursRatio 查询学分学时比。
func (s *PortalStore) CreditHoursRatio(ctx context.Context) float64 {
	var ratio float64
	_ = s.q.QueryRow(ctx, `SELECT COALESCE(value::float, 16) FROM platform_configs WHERE key = 'credit_hours_ratio'`).Scan(&ratio)
	if ratio <= 0 {
		ratio = 16
	}
	return ratio
}

// BatchCourseProgress 课程出勤进度。
func (s *PortalStore) BatchCourseProgress(ctx context.Context, courseIDs []string, userID string) map[string]int {
	result := make(map[string]int)
	if len(courseIDs) == 0 {
		return result
	}
	rows, err := s.q.Query(ctx, `
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

// BatchCourseStudentCounts 课程学生数。
func (s *PortalStore) BatchCourseStudentCounts(ctx context.Context, courseIDs []string) map[string]int {
	result := make(map[string]int)
	if len(courseIDs) == 0 {
		return result
	}
	rows, err := s.q.Query(ctx, `
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

// BatchSceneTaskStatus 场景任务状态。
func (s *PortalStore) BatchSceneTaskStatus(ctx context.Context, taskIDs []string, userID string) map[string]string {
	result := make(map[string]string)
	if len(taskIDs) == 0 {
		return result
	}
	rows, err := s.q.Query(ctx, `
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

// PeriodLabelMap 节次名称→网格标签（按 sort_order 索引分割）。
func (s *PortalStore) PeriodLabelMap(ctx context.Context, tenantID *string) map[string]string {
	m := map[string]string{}
	if tenantID == nil {
		return m
	}
	rows, err := s.q.Query(ctx, `
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
			m[n] = "上午 " + Itoa(i+1)
		case i < 8:
			m[n] = "下午 " + Itoa(i-3)
		default:
			m[n] = "晚自习 " + Itoa(i-7)
		}
	}
	return m
}

// SchoolAdminResourceGrowth 学校管理员资源增长趋势（按月）。
func (s *PortalStore) SchoolAdminResourceGrowth(ctx context.Context, tenantID *string, months int) []domain.WorkspaceResourceGrowth {
	if months <= 0 {
		months = 12
	}

	now := time.Now()
	monthKeys := make([]string, 0, months)
	monthIndex := map[string]int{}
	for i := months - 1; i >= 0; i-- {
		d := now.AddDate(0, -i, 0)
		key := d.Format("2006-01")
		monthKeys = append(monthKeys, key)
		monthIndex[key] = len(monthKeys) - 1
	}

	result := make([]domain.WorkspaceResourceGrowth, months)
	for i, key := range monthKeys {
		result[i].Month = key
	}

	queries := []struct {
		table   string
		dateCol string
		setter  func(idx int, val int)
	}{
		{"courses", "created_at", func(idx int, val int) { result[idx].Courses = val }},
		{"scenarios", "created_at", func(idx int, val int) { result[idx].Scenarios = val }},
		{"career_positions", "created_at", func(idx int, val int) { result[idx].CareerPositions = val }},
		{"question_banks", "created_at", func(idx int, val int) { result[idx].QuestionBanks = val }},
		{"exams", "created_at", func(idx int, val int) { result[idx].Exams = val }},
		{"exam_usages", "created_at", func(idx int, val int) { result[idx].ExamUsages = val }},
	}

	for _, q := range queries {
		rows, err := s.q.Query(ctx, `
			SELECT TO_CHAR(DATE_TRUNC('month', `+q.dateCol+`), 'YYYY-MM') AS month, COUNT(*)
			FROM `+q.table+`
			WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
			  AND `+q.dateCol+` >= $2
			GROUP BY DATE_TRUNC('month', `+q.dateCol+`)
			ORDER BY month
		`, tenantID, now.AddDate(0, -months, 0))
		if err != nil {
			continue
		}
		for rows.Next() {
			var month string
			var count int
			if err := rows.Scan(&month, &count); err != nil {
				continue
			}
			if idx, ok := monthIndex[month]; ok {
				q.setter(idx, count)
			}
		}
		rows.Close()
	}

	return result
}
