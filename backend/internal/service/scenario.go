package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
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
func (s *ScenarioService) CloneScenario(ctx context.Context, tenantID, oldScenarioID, newName, creatorID string) (string, string, error) {
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
		id, code, err := txStore.ScenarioClone().CloneScenario(ctx, txStore.Q(), tenantID, oldScenarioID, newName, creatorID, src)
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

// ListTasks 查询任务列表。
func (s *ScenarioService) ListTasks(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ScenarioTask]) ([]domain.ScenarioTask, int, error) {
	items, total, err := s.st.ScenarioTasks().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	s.st.ScenarioTasks().PopulateEvalData(ctx, items)
	return items, total, nil
}

// GetTask 查询单个任务。
func (s *ScenarioService) GetTask(ctx context.Context, id string) (*domain.ScenarioTask, error) {
	t, err := s.st.ScenarioTasks().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	s.st.ScenarioTasks().PopulateEvalData(ctx, []domain.ScenarioTask{*t})
	return t, nil
}

// ScenarioTenantID 查询场景租户。
func (s *ScenarioService) ScenarioTenantID(ctx context.Context, scenarioID string) (*string, error) {
	return s.st.ScenarioTasks().ScenarioTenantID(ctx, scenarioID)
}

// CreateTask 创建任务。
func (s *ScenarioService) CreateTask(ctx context.Context, p *store.ScenarioTaskParams) (*domain.ScenarioTask, error) {
	return s.st.ScenarioTasks().Create(ctx, p)
}

// UpdateTask 更新任务。
func (s *ScenarioService) UpdateTask(ctx context.Context, id, tenantID string, p *store.ScenarioTaskParams) (*domain.ScenarioTask, error) {
	return s.st.ScenarioTasks().Update(ctx, id, tenantID, p)
}

// DeleteTask 删除任务。
func (s *ScenarioService) DeleteTask(ctx context.Context, id, tenantID string) error {
	return s.st.ScenarioTasks().Delete(ctx, id, tenantID)
}

// ReorderTasks 批量重排任务（事务内）。
func (s *ScenarioService) ReorderTasks(ctx context.Context, scenarioID string, taskIDs []string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.ScenarioTasks().Reorder(ctx, txStore.Q(), scenarioID, taskIDs)
	})
}

// BatchQueryer 暴露批次查询器。
func (s *ScenarioService) BatchQueryer() store.Queryer { return s.st.Q() }

// BatchTenantOf 查询批次租户。
func (s *ScenarioService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return s.st.Batches().TenantOf(ctx, table, id)
}

// BatchCreate 创建批次。
func (s *ScenarioService) BatchCreate(ctx context.Context, table string, cols []string, vals []any) error {
	return s.st.Batches().Create(ctx, table, cols, vals)
}

// BatchUpdate 更新批次。
func (s *ScenarioService) BatchUpdate(ctx context.Context, table string, setClauses []string, args []any) error {
	return s.st.Batches().Update(ctx, table, setClauses, args)
}

// BatchDelete 删除批次。
func (s *ScenarioService) BatchDelete(ctx context.Context, table, id string) error {
	return s.st.Batches().Delete(ctx, table, id)
}

// BatchUpdateStatus 更新批次状态。
func (s *ScenarioService) BatchUpdateStatus(ctx context.Context, table, id, status string) error {
	return s.st.Batches().UpdateStatus(ctx, table, id, status)
}

// BatchGetByTable 按表查询批次单行。
func (s *ScenarioService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return s.st.Batches().GetByTable(ctx, s.st.Q(), table, selectColumns, id)
}
