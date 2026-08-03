package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
	"time"
)

// DraftCourseCount 待提交课程数。
func (s *PositionService) DraftCourseCount(ctx context.Context, userID string, tenantID *string) int {
	return s.st.Portal().DraftCourseCount(ctx, userID, tenantID)
}

// UpcomingExamCount 待参加考试数。
func (s *PositionService) UpcomingExamCount(ctx context.Context, tenantID *string, now time.Time) int {
	return s.st.Portal().UpcomingExamCount(ctx, tenantID, now)
}

// ListTeacherSchedules 教师排课事件。
func (s *PositionService) ListTeacherSchedules(ctx context.Context, userID string, tenantID *string) ([]store.TeacherScheduleRow, error) {
	return s.st.Portal().ListTeacherSchedules(ctx, userID, tenantID)
}

// UserClassNodeID 用户班级节点。
func (s *PositionService) UserClassNodeID(ctx context.Context, userID string, tenantID *string) string {
	return s.st.Portal().UserClassNodeID(ctx, userID, tenantID)
}

// ListStudentSchedules 学生排课事件。
func (s *PositionService) ListStudentSchedules(ctx context.Context, classNodeID string, tenantID *string) ([]store.StudentScheduleRow, error) {
	return s.st.Portal().ListStudentSchedules(ctx, classNodeID, tenantID)
}

// ListExamEvents 考试事件。
func (s *PositionService) ListExamEvents(ctx context.Context, tenantID *string) ([]store.ExamEventRow, error) {
	return s.st.Portal().ListExamEvents(ctx, tenantID)
}

// TeacherStats 教师统计。
func (s *PositionService) TeacherStats(ctx context.Context, userID string, tenantID *string) (int, int) {
	return s.st.Portal().TeacherStats(ctx, userID, tenantID)
}

// StudentStats 学生统计。
func (s *PositionService) StudentStats(ctx context.Context, tenantID *string) (int, int) {
	return s.st.Portal().StudentStats(ctx, tenantID)
}

// SchoolAdminStats 管理员统计。
func (s *PositionService) SchoolAdminStats(ctx context.Context, tenantID *string) (int, int) {
	return s.st.Portal().SchoolAdminStats(ctx, tenantID)
}

// SchoolAdminResourceStats 管理员资源统计。
func (s *PositionService) SchoolAdminResourceStats(ctx context.Context, tenantID *string) (int, int, int, int, int, int) {
	return s.st.Portal().SchoolAdminResourceStats(ctx, tenantID)
}

// SchoolAdminResourceGrowth 管理员资源增长趋势（最近 months 个月）。
func (s *PositionService) SchoolAdminResourceGrowth(ctx context.Context, tenantID *string, months int) []domain.WorkspaceResourceGrowth {
	return s.st.Portal().SchoolAdminResourceGrowth(ctx, tenantID, months)
}

// PersonnelStats 人员统计。
func (s *PositionService) PersonnelStats(ctx context.Context, tenantID *string) ([]store.PersonnelStatRow, error) {
	return s.st.Portal().PersonnelStats(ctx, tenantID)
}

// SchoolAdminTodos 管理员待办。
func (s *PositionService) SchoolAdminTodos(ctx context.Context, tenantID *string) ([]store.SchoolAdminTodoRow, error) {
	return s.st.Portal().SchoolAdminTodos(ctx, tenantID)
}

// ListStudentCourses 学生课程。
func (s *PositionService) ListStudentCourses(ctx context.Context, tenantID *string) ([]store.StudentCourseRow, error) {
	return s.st.Portal().ListStudentCourses(ctx, tenantID)
}

// ListSceneTasks 场景任务。
func (s *PositionService) ListSceneTasks(ctx context.Context, tenantID *string) ([]store.SceneTaskRow, error) {
	return s.st.Portal().ListSceneTasks(ctx, tenantID)
}

// ListStudentExams 学生考试。
func (s *PositionService) ListStudentExams(ctx context.Context, userID string, tenantID *string) ([]store.ExamRow, error) {
	return s.st.Portal().ListStudentExams(ctx, userID, tenantID)
}

// ListTeacherCourses 教师课程。
func (s *PositionService) ListTeacherCourses(ctx context.Context, userID string, tenantID *string) ([]store.TeacherCourseRow, error) {
	return s.st.Portal().ListTeacherCourses(ctx, userID, tenantID)
}

// ListClassPlans 班级计划。
func (s *PositionService) ListClassPlans(ctx context.Context, userID string, tenantID *string) ([]store.ClassPlanRow, error) {
	return s.st.Portal().ListClassPlans(ctx, userID, tenantID)
}

// CreditHoursRatio 学分学时比。
func (s *PositionService) CreditHoursRatio(ctx context.Context) float64 {
	return s.st.Portal().CreditHoursRatio(ctx)
}

// PeriodLabelMap 节次标签。
func (s *PositionService) PeriodLabelMap(ctx context.Context, tenantID *string) map[string]string {
	return s.st.Portal().PeriodLabelMap(ctx, tenantID)
}

// PendingApprovalCount 待审批数（工作台统计）。
func (s *PositionService) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	return s.st.Portal().PendingApprovalCount(ctx, tenantID)
}
