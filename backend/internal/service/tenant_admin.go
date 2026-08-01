package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/store"
)

// TenantAdminService 学校管理员业务编排。
type TenantAdminService struct {
	*Service
	st *store.Store
}

// NewTenantAdminService 创建管理员服务。
func NewTenantAdminService(s *Service) *TenantAdminService {
	return &TenantAdminService{Service: s, st: s.Store()}
}

// List 查询租户管理员列表。
func (s *TenantAdminService) List(ctx context.Context, tenantID string) ([]store.TenantAdminItem, error) {
	return s.st.TenantAdmins().List(ctx, tenantID)
}

// Get 查询单个管理员。
func (s *TenantAdminService) Get(ctx context.Context, tenantID, adminID string) (*store.TenantAdminItem, error) {
	return s.st.TenantAdmins().Get(ctx, tenantID, adminID)
}

// Create 在事务内创建管理员，返回明文密码（仅创建时返回一次）。
func (s *TenantAdminService) Create(ctx context.Context, tenantID, username, name string) (*store.TenantAdminItem, string, error) {
	plain, err := store.GenerateSecurePassword(12)
	if err != nil {
		return nil, "", err
	}
	var admin *store.TenantAdminItem
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		a, err := txStore.TenantAdmins().Create(ctx, txStore.Q(), tenantID, username, name, plain)
		if err != nil {
			return err
		}
		admin = a
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	return admin, plain, nil
}

// Update 更新管理员信息。
func (s *TenantAdminService) Update(ctx context.Context, tenantID, adminID, username, name string) error {
	return s.st.TenantAdmins().Update(ctx, tenantID, adminID, username, name)
}

// Delete 在事务内删除管理员。
func (s *TenantAdminService) Delete(ctx context.Context, tenantID, adminID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.TenantAdmins().Delete(ctx, txStore.Q(), tenantID, adminID)
	})
}

// ResetPassword 重置管理员密码，返回新明文密码。
func (s *TenantAdminService) ResetPassword(ctx context.Context, adminID string) (string, error) {
	plain, err := store.GenerateSecurePassword(12)
	if err != nil {
		return "", err
	}
	if err := s.st.TenantAdmins().ResetPassword(ctx, adminID, plain); err != nil {
		return "", err
	}
	return plain, nil
}
