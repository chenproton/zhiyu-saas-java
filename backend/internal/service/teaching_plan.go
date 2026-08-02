package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListTeachingPlans 查询教学计划列表。
func (s *PositionService) ListTeachingPlans(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.TeachingPlan]) ([]domain.TeachingPlan, int, error) {
	return s.st.TeachingPlans().List(ctx, p, cfg)
}

// GetTeachingPlan 查询单个教学计划。
func (s *PositionService) GetTeachingPlan(ctx context.Context, id, tenantID string) (*domain.TeachingPlan, error) {
	return s.st.TeachingPlans().Get(ctx, id, tenantID)
}

// ListTeachingPlanEntries 查询计划条目。
func (s *PositionService) ListTeachingPlanEntries(ctx context.Context, planID, tenantID string) ([]domain.TeachingPlanEntry, error) {
	return s.st.TeachingPlans().ListPlanEntries(ctx, planID, tenantID)
}

// GetTeachingPlanEntry 查询单个计划条目。
func (s *PositionService) GetTeachingPlanEntry(ctx context.Context, id, tenantID string) (*domain.TeachingPlanEntry, error) {
	return s.st.TeachingPlans().GetPlanEntry(ctx, id, tenantID)
}

// UpdateTeachingPlanEntry 更新计划条目。
func (s *PositionService) UpdateTeachingPlanEntry(ctx context.Context, id, tenantID string, e *domain.TeachingPlanEntry, credits *float64, totalHours *int, classNodeIDs *[]string) error {
	return s.st.TeachingPlans().UpdatePlanEntry(ctx, id, tenantID, e, credits, totalHours, classNodeIDs)
}

// DeleteTeachingPlanEntry 删除计划条目。
func (s *PositionService) DeleteTeachingPlanEntry(ctx context.Context, id, tenantID string) error {
	return s.st.TeachingPlans().DeletePlanEntry(ctx, id, tenantID)
}

// ConfirmTeachingPlan 确认计划。
func (s *PositionService) ConfirmTeachingPlan(ctx context.Context, id, tenantID string) error {
	return s.st.TeachingPlans().ConfirmPlan(ctx, id, tenantID)
}

// GenerateTeachingPlan 生成教学计划（事务）。
func (s *PositionService) GenerateTeachingPlan(ctx context.Context, p *store.GeneratePlanParams, courses []store.PlanCourse, posScenMap map[string][]store.ScenarioBrief, weeksCount int) (string, error) {
	var planID string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		id, err := txStore.TeachingPlans().GeneratePlan(ctx, txStore.Q(), p, courses, posScenMap, weeksCount)
		if err != nil {
			return err
		}
		planID = id
		return nil
	})
	return planID, err
}

// FetchTeachingPlanProgramBrief 查询人培方案简要。
func (s *PositionService) FetchTeachingPlanProgramBrief(ctx context.Context, id, tenantID string) (*store.ProgramBrief, error) {
	return s.st.TeachingPlans().FetchProgramBrief(ctx, id, tenantID)
}

// FetchTeachingPlanCourses 查询方案课程。
func (s *PositionService) FetchTeachingPlanCourses(ctx context.Context, programID string) ([]store.PlanCourse, error) {
	return s.st.TeachingPlans().FetchProgramCourses(ctx, programID)
}

// FetchPositionScenarios 查询岗位场景。
func (s *PositionService) FetchPositionScenarios(ctx context.Context, positionID string) ([]store.ScenarioBrief, error) {
	return s.st.TeachingPlans().FetchPositionScenarios(ctx, positionID)
}

// FindTeachingPlanExisting 查询已有计划。
func (s *PositionService) FindTeachingPlanExisting(ctx context.Context, programID, termID, tenantID string) (string, error) {
	return s.st.TeachingPlans().FindExistingPlan(ctx, programID, termID, tenantID)
}

// TeachingPlanScheduledCount 查询已排课条目数。
func (s *PositionService) TeachingPlanScheduledCount(ctx context.Context, planID string) (int, error) {
	return s.st.TeachingPlans().ScheduledEntryCount(ctx, planID)
}
