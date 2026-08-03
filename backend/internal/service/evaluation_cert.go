package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListCertificationRules 查询认证规则列表。
func (s *EvaluationService) ListCertificationRules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.CertificationRule]) ([]domain.CertificationRule, int, error) {
	return s.st.Certifications().ListRules(ctx, p, cfg)
}

// GetCertificationRule 查询单个规则。
func (s *EvaluationService) GetCertificationRule(ctx context.Context, id string) (*domain.CertificationRule, error) {
	return s.st.Certifications().GetRule(ctx, id)
}

// GetCertificationRuleByTenant 查询单个规则（租户限定）。
func (s *EvaluationService) GetCertificationRuleByTenant(ctx context.Context, id, tenantID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().GetRuleByTenant(ctx, id, tenantID)
}

// CreateCertificationRule 创建规则。
func (s *EvaluationService) CreateCertificationRule(ctx context.Context, tenantID, positionID, ruleSource string) (*domain.CertificationRule, error) {
	return s.st.Certifications().CreateRule(ctx, tenantID, positionID, ruleSource)
}

// UpdateCertificationRuleStatus 更新规则状态。
func (s *EvaluationService) UpdateCertificationRuleStatus(ctx context.Context, id, tenantID, status string) (*domain.CertificationRule, error) {
	return s.st.Certifications().UpdateRuleStatus(ctx, id, tenantID, status)
}

// UpdateCertificationRule 更新规则（限定租户）。
func (s *EvaluationService) UpdateCertificationRule(ctx context.Context, id, tenantID, positionID, ruleSource string) (*domain.CertificationRule, error) {
	return s.st.Certifications().UpdateRule(ctx, id, tenantID, positionID, ruleSource)
}

// DeleteCertificationRule 删除规则（限定租户）。
func (s *EvaluationService) DeleteCertificationRule(ctx context.Context, id, tenantID string) error {
	return s.st.Certifications().DeleteRule(ctx, id, tenantID)
}

// ListCertificationItems 查询规则下能力项。
func (s *EvaluationService) ListCertificationItems(ctx context.Context, ruleID string) ([]domain.CertificationAbilityItem, error) {
	return s.st.Certifications().ListItems(ctx, ruleID)
}

// GetCertificationItemByTenant 查询单个能力项（租户限定）。
func (s *EvaluationService) GetCertificationItemByTenant(ctx context.Context, id, tenantID string) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().GetItem(ctx, id, tenantID)
}

// CreateCertificationItem 创建能力项。
func (s *EvaluationService) CreateCertificationItem(ctx context.Context, tenantID, ruleID, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().CreateItem(ctx, tenantID, ruleID, name, sortOrder)
}

// UpdateCertificationItem 更新能力项（限定租户）。
func (s *EvaluationService) UpdateCertificationItem(ctx context.Context, id, tenantID, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().UpdateItem(ctx, id, tenantID, name, sortOrder)
}

// DeleteCertificationItem 删除能力项（限定租户）。
func (s *EvaluationService) DeleteCertificationItem(ctx context.Context, id, tenantID string) error {
	return s.st.Certifications().DeleteItem(ctx, id, tenantID)
}

// ListCertificationPoints 查询项下能力点。
func (s *EvaluationService) ListCertificationPoints(ctx context.Context, itemID string) ([]domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().ListPoints(ctx, itemID)
}

// GetCertificationPointByTenant 查询单个能力点（租户限定）。
func (s *EvaluationService) GetCertificationPointByTenant(ctx context.Context, id, tenantID string) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().GetPoint(ctx, id, tenantID)
}

// CreateCertificationPoint 创建能力点。
func (s *EvaluationService) CreateCertificationPoint(ctx context.Context, p *store.CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().CreatePoint(ctx, p)
}

// UpdateCertificationPoint 更新能力点。
func (s *EvaluationService) UpdateCertificationPoint(ctx context.Context, id, tenantID string, p *store.CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().UpdatePoint(ctx, id, tenantID, p)
}

// DeleteCertificationPoint 删除能力点（限定租户）。
func (s *EvaluationService) DeleteCertificationPoint(ctx context.Context, id, tenantID string) error {
	return s.st.Certifications().DeletePoint(ctx, id, tenantID)
}

// CreateCertificationTask 创建关联任务。
func (s *EvaluationService) CreateCertificationTask(ctx context.Context, tenantID, certPointID, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	return s.st.Certifications().CreateTask(ctx, tenantID, certPointID, taskID, maxScore, weight)
}

// UpdateCertificationTask 更新关联任务。
func (s *EvaluationService) UpdateCertificationTask(ctx context.Context, id, tenantID, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	return s.st.Certifications().UpdateTask(ctx, id, tenantID, taskID, maxScore, weight)
}

// DeleteCertificationTask 删除关联任务。
func (s *EvaluationService) DeleteCertificationTask(ctx context.Context, id, tenantID string) error {
	return s.st.Certifications().DeleteTask(ctx, id, tenantID)
}

// GetCertificationFull 查询完整规则（items+points+tasks 聚合）。
func (s *EvaluationService) GetCertificationFull(ctx context.Context, ruleID string) ([]store.FullItem, []store.FullPoint, []domain.CertificationRelatedTask, error) {
	items, err := s.st.Certifications().ListFullItems(ctx, ruleID)
	if err != nil {
		return nil, nil, nil, err
	}
	itemIDs := make([]string, 0, len(items))
	for _, it := range items {
		itemIDs = append(itemIDs, it.ID)
	}
	if len(itemIDs) == 0 {
		return items, nil, nil, nil
	}
	points, err := s.st.Certifications().ListFullPoints(ctx, itemIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	pointIDs := make([]string, 0, len(points))
	for _, p := range points {
		pointIDs = append(pointIDs, p.ID)
	}
	if len(pointIDs) == 0 {
		return items, points, nil, nil
	}
	tasks, err := s.st.Certifications().ListTasksByPointIDs(ctx, pointIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	return items, points, tasks, nil
}

// PutCertificationFull 全量保存规则（事务）。
func (s *EvaluationService) PutCertificationFull(ctx context.Context, tenantID, ruleID, positionID, ruleSource string, levelMapping domain.JSONSlice, items []store.PutFullRuleItem) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Certifications().PutFullRule(ctx, txStore.Q(), tenantID, ruleID, positionID, ruleSource, levelMapping, items)
	})
}

// FindPositionRule 查询岗位最新认证规则。
func (s *EvaluationService) FindPositionRule(ctx context.Context, positionID, tenantID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().FindPositionRule(ctx, s.st.Q(), positionID, tenantID)
}

// LoadCertificationModel 组装岗位能力认定模型。
func (s *EvaluationService) LoadCertificationModel(ctx context.Context, tenantID, positionID, ruleID string) ([]domain.CertificationModelDomain, error) {
	return s.st.Certifications().LoadModel(ctx, tenantID, positionID, ruleID)
}

// PutCertificationWeights 保存岗位权重（事务）。
func (s *EvaluationService) PutCertificationWeights(ctx context.Context, tenantID, positionID string, pointWeights, taskWeights []store.CertificationWeightItem) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		_, err := txStore.Certifications().PutWeights(ctx, txStore.Q(), tenantID, positionID, pointWeights, taskWeights)
		return err
	})
}

// FindRuleByPosition 按岗位查规则。
func (s *EvaluationService) FindRuleByPosition(ctx context.Context, tenantID, positionID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().FindRuleByPosition(ctx, tenantID, positionID)
}
