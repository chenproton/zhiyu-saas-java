package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ScenarioService 场景方案业务编排。
type ScenarioService struct {
	*Service
	st *store.Store
}

// NewScenarioService 创建场景服务。
func NewScenarioService(s *Service) *ScenarioService {
	return &ScenarioService{Service: s, st: s.Store()}
}

// List 查询场景列表。
func (s *ScenarioService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Scenario]) ([]domain.Scenario, int, error) {
	return s.st.Scenarios().List(ctx, p, cfg)
}

// Get 查询单个场景。
func (s *ScenarioService) Get(ctx context.Context, id string) (*domain.Scenario, error) {
	return s.st.Scenarios().Get(ctx, id)
}

// Create 创建场景。
func (s *ScenarioService) Create(ctx context.Context, tenantID string, p *store.ScenarioCreateParams) (*domain.Scenario, error) {
	return s.st.Scenarios().Create(ctx, tenantID, p)
}

// Update 更新场景。
func (s *ScenarioService) Update(ctx context.Context, id string, p *store.ScenarioUpdateParams) (*domain.Scenario, error) {
	return s.st.Scenarios().Update(ctx, id, p)
}

// Delete 删除场景。
func (s *ScenarioService) Delete(ctx context.Context, id string) error {
	return s.st.Scenarios().Delete(ctx, id)
}

// IncrementView 记录浏览。
func (s *ScenarioService) IncrementView(ctx context.Context, targetID string, userID, tenantID any) error {
	return s.st.Scenarios().IncrementView(ctx, targetID, userID, tenantID)
}

// Queryer 暴露底层查询器（供 contentActions 使用）。
func (s *ScenarioService) Queryer() store.Queryer {
	return s.st.Q()
}

// CloneScenario 克隆场景及全部关联，返回新场景 ID 与 code。
func (s *ScenarioService) CloneScenario(ctx context.Context, tenantID, oldScenarioID, newName string) (string, string, error) {
	src, err := s.st.ScenarioClone().FetchSource(ctx, oldScenarioID)
	if err != nil {
		return "", "", err
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		return "", "", ErrScenarioNotInTenant
	}
	if newName == "" {
		newName = src.Name + " (克隆)"
	}
	var newID, newCode string
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		id, code, err := txStore.ScenarioClone().CloneScenario(ctx, txStore.Q(), tenantID, oldScenarioID, newName, src)
		if err != nil {
			return err
		}
		newID, newCode = id, code
		return nil
	})
	if err != nil {
		return "", "", err
	}
	return newID, newCode, nil
}

// ErrScenarioNotInTenant 场景不属于当前租户。
var ErrScenarioNotInTenant = errors.New("scenario not in tenant")
