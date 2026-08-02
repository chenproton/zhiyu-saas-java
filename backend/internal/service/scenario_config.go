package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ScenarioConfigService 场景权重/等级映射/任务绑定业务编排。
type ScenarioConfigService struct {
	*Service
	st *store.Store
}

// NewScenarioConfigService 创建场景配置服务。
func NewScenarioConfigService(s *Service) *ScenarioConfigService {
	return &ScenarioConfigService{Service: s, st: s.Store()}
}

// ListWeights 查询权重列表。
func (s *ScenarioConfigService) ListWeights(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ScenarioWeightConfig]) ([]domain.ScenarioWeightConfig, int, error) {
	return s.st.ScenarioWeights().List(ctx, p, cfg)
}

// UpsertWeight 更新或创建权重。
func (s *ScenarioConfigService) UpsertWeight(ctx context.Context, tenantID string, p *store.ScenarioWeightUpsertParams) (domain.ScenarioWeightConfig, error) {
	return s.st.ScenarioWeights().Upsert(ctx, tenantID, p)
}

// ListGradeMappings 查询等级映射列表。
func (s *ScenarioConfigService) ListGradeMappings(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ScenarioGradeMapping]) ([]domain.ScenarioGradeMapping, int, error) {
	return s.st.ScenarioGrades().List(ctx, p, cfg)
}

// UpsertGradeMapping 更新或创建等级映射。
func (s *ScenarioConfigService) UpsertGradeMapping(ctx context.Context, tenantID string, p *store.ScenarioGradeUpsertParams) (domain.ScenarioGradeMapping, error) {
	return s.st.ScenarioGrades().Upsert(ctx, tenantID, p)
}

// BindKnowledge 绑定知识点。
func (s *ScenarioConfigService) BindKnowledge(ctx context.Context, tenantID, taskID, knowledgePointID string) (domain.TaskKnowledgeBinding, error) {
	return s.st.TaskBindings().BindKnowledge(ctx, tenantID, taskID, knowledgePointID)
}

// UnbindKnowledge 解绑知识点。
func (s *ScenarioConfigService) UnbindKnowledge(ctx context.Context, id string) error {
	return s.st.TaskBindings().UnbindKnowledge(ctx, id)
}

// BindAbility 绑定能力点。
func (s *ScenarioConfigService) BindAbility(ctx context.Context, tenantID, taskID, abilityPointID string) (domain.TaskAbilityBinding, error) {
	return s.st.TaskBindings().BindAbility(ctx, tenantID, taskID, abilityPointID)
}

// UnbindAbility 解绑能力点。
func (s *ScenarioConfigService) UnbindAbility(ctx context.Context, id string) error {
	return s.st.TaskBindings().UnbindAbility(ctx, id)
}
