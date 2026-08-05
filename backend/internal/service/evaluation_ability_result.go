package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListJobAbilityResults 查询岗位能力结果。
func (s *EvaluationService) ListJobAbilityResults(ctx context.Context, f store.JobAbilityResultFilter, limit, offset int) ([]store.JobAbilityResultRow, int, error) {
	return s.st.JobAbilityResults().ListJobAbilityResults(ctx, f, limit, offset)
}

// GetJobAbilityResult 查询单个岗位能力结果。
func (s *EvaluationService) GetJobAbilityResult(ctx context.Context, id, tenantID string) (*store.JobAbilityResultRow, *domain.JSONSlice, *domain.JSONSlice, error) {
	return s.st.JobAbilityResults().GetJobAbilityResult(ctx, id, tenantID)
}

// SummaryJobAbilityResults 岗位能力汇总。
func (s *EvaluationService) SummaryJobAbilityResults(ctx context.Context, tenantID string) ([]store.JobAbilitySummaryRow, error) {
	return s.st.JobAbilityResults().Summary(ctx, tenantID)
}

// ListStudentCourseScores 查询学生在体系课中的成绩与排名。
func (s *EvaluationService) ListStudentCourseScores(ctx context.Context, tenantID, userID string) ([]store.CourseScoreRow, error) {
	return s.st.JobAbilityResults().ListStudentCourseScores(ctx, tenantID, userID)
}

// CountStudentScenes 学生有已评评分记录的去重场景数。
func (s *EvaluationService) CountStudentScenes(ctx context.Context, tenantID, userID string) (int, error) {
	return s.st.Portal().CountStudentScenes(ctx, tenantID, userID)
}

// ListScenePositions 已发布场景关联的岗位（去重）。
func (s *EvaluationService) ListScenePositions(ctx context.Context, tenantID string) ([]store.ScenePositionRow, error) {
	return s.st.Portal().ListScenePositions(ctx, tenantID)
}

// ListStudentCourses 学生班级已排课的已发布课程（与"我的学习"tab 同源）。
func (s *EvaluationService) ListStudentCourses(ctx context.Context, userID, tenantID string) ([]store.StudentCourseRow, error) {
	return s.st.Portal().ListStudentCourses(ctx, userID, &tenantID)
}

// GetAggregateLog 查询汇聚日志（租户限定）。
func (s *EvaluationService) GetAggregateLog(ctx context.Context, logID, tenantID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetAggregateLogByID(ctx, logID, tenantID)
}

// GetRecentAggregateLog 查询最近汇聚日志。
func (s *EvaluationService) GetRecentAggregateLog(ctx context.Context, tenantID, positionID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetRecentAggregateLog(ctx, tenantID, positionID)
}
