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

// GetAggregateLog 查询汇聚日志（租户限定）。
func (s *EvaluationService) GetAggregateLog(ctx context.Context, logID, tenantID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetAggregateLogByID(ctx, logID, tenantID)
}

// GetRecentAggregateLog 查询最近汇聚日志。
func (s *EvaluationService) GetRecentAggregateLog(ctx context.Context, tenantID, positionID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetRecentAggregateLog(ctx, tenantID, positionID)
}
