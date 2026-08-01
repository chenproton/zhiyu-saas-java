package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TenantService 租户业务编排：创建租户走事务（租户+套餐+组织类型+角色+管理员）。
type TenantService struct {
	*Service
	st *store.Store
}

// NewTenantService 创建租户服务。
func NewTenantService(s *Service) *TenantService {
	return &TenantService{Service: s, st: s.Store()}
}

// List 查询租户列表。
func (s *TenantService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Tenant]) ([]domain.Tenant, int, error) {
	return s.st.Tenants().List(ctx, p, cfg)
}

// Get 查询单个租户。
func (s *TenantService) Get(ctx context.Context, id string) (*domain.Tenant, error) {
	return s.st.Tenants().Get(ctx, id)
}

// CreateWithDefaults 在事务内创建租户及默认资源。
func (s *TenantService) CreateWithDefaults(ctx context.Context, p *store.TenantCreateParams) (*store.CreateTenantResult, error) {
	var result *store.CreateTenantResult
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		r, err := txStore.Tenants().CreateWithDefaults(ctx, txStore.Q(), p)
		if err != nil {
			return err
		}
		result = r
		return nil
	})
	return result, err
}

// Update 更新租户。
func (s *TenantService) Update(ctx context.Context, id string, p *store.TenantUpdateParams) error {
	return s.st.Tenants().Update(ctx, id, p)
}

// UpdateStatus 更新租户状态。
func (s *TenantService) UpdateStatus(ctx context.Context, id string, status domain.TenantStatus) error {
	return s.st.Tenants().UpdateStatus(ctx, id, status)
}

// IsCodeExists 判断租户标识冲突。
func (s *TenantService) IsCodeExists(ctx context.Context, code string) bool {
	exists, _ := s.st.Tenants().CodeExists(ctx, code)
	return exists
}

// IsConflict 判断是否业务冲突错误（租户代码/管理员用户名已存在）。
func IsConflict(err error) bool {
	return errors.Is(err, store.ErrCodeExists) || errors.Is(err, store.ErrLoginNameExists)
}

// DeleteTenant 在事务内删除租户及其用户。
func (s *TenantService) DeleteTenant(ctx context.Context, tenantID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Tenants().DeleteTenant(ctx, txStore.Q(), tenantID)
	})
}
