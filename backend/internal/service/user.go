package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// UserService 用户管理业务编排：创建/批量创建/角色绑定走事务。
type UserService struct {
	*Service
	st *store.Store
}

// NewUserService 创建用户服务。
func NewUserService(s *Service) *UserService {
	return &UserService{Service: s, st: s.Store()}
}

// List 查询用户列表。
func (s *UserService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.User]) ([]domain.User, int, error) {
	items, total, err := s.st.Users().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	s.st.Users().AttachUserRoles(ctx, items)
	return items, total, nil
}

// Get 查询单个用户。
func (s *UserService) Get(ctx context.Context, id string) (*domain.User, error) {
	return s.st.Users().Get(ctx, id)
}

// Create 创建用户（事务内）。
func (s *UserService) Create(ctx context.Context, p *store.UserCreateParams) (*domain.User, error) {
	var user *domain.User
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		u, err := txStore.Users().Create(ctx, txStore.Q(), p)
		if err != nil {
			return err
		}
		user = u
		return nil
	})
	return user, err
}

// BatchCreate 批量创建用户（事务内，跳过缺字段与重复项）。
func (s *UserService) BatchCreate(ctx context.Context, params []*store.UserCreateParams) ([]domain.User, error) {
	created := make([]domain.User, 0, len(params))
	seen := make(map[string]bool, len(params))
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		for _, p := range params {
			if p.TenantID == "" || p.Username == "" || p.Password == "" || p.Name == "" {
				continue
			}
			dedupKey := p.TenantID + ":" + p.Platform + ":" + p.Username
			if seen[dedupKey] {
				continue
			}
			seen[dedupKey] = true
			u, err := txStore.Users().Create(ctx, txStore.Q(), p)
			if err != nil {
				return err
			}
			created = append(created, *u)
		}
		return nil
	})
	return created, err
}

// Update 更新用户基础信息与可选角色重绑（事务内）。
func (s *UserService) Update(ctx context.Context, id, tenantID string, p *store.UserUpdateParams, roleID string) error {
	existing, err := s.st.Users().Get(ctx, id)
	if err != nil {
		return err
	}
	if existing.TenantID == nil {
		return fmt.Errorf("用户缺少租户信息")
	}
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Users().ValidateOrgMajor(ctx, txStore.Q(), *existing.TenantID, p.OrgNodeID, p.MajorID); err != nil {
			return err
		}
		if err := txStore.Users().Update(ctx, p); err != nil {
			return err
		}
		if roleID != "" {
			if err := txStore.Users().RebindUserRole(ctx, id, roleID, tenantID); err != nil {
				return err
			}
		}
		return nil
	})
}

// Delete 删除用户。
func (s *UserService) Delete(ctx context.Context, id string) error {
	return s.st.Users().Delete(ctx, id)
}

// UpdateStatus 更新用户状态。
func (s *UserService) UpdateStatus(ctx context.Context, id, status string) error {
	return s.st.Users().UpdateStatus(ctx, id, status)
}

// UpdateSelfName 用户自助修改本人姓名。
func (s *UserService) UpdateSelfName(ctx context.Context, id, name string) error {
	return s.st.Users().UpdateSelfName(ctx, id, name)
}

// ResetPassword 重置密码。
func (s *UserService) ResetPassword(ctx context.Context, id, plainPassword string) error {
	return s.st.Users().ResetPassword(ctx, id, plainPassword)
}

// BatchGraduate 批量毕业。
func (s *UserService) BatchGraduate(ctx context.Context, tenantID string, userIDs []string, graduateYear int) error {
	return s.st.Users().BatchGraduate(ctx, tenantID, userIDs, graduateYear)
}

// BatchDelete 批量删除。
func (s *UserService) BatchDelete(ctx context.Context, tenantID string, userIDs []string) (int64, error) {
	return s.st.Users().BatchDelete(ctx, tenantID, userIDs)
}

// BatchUpdateOrgNode 批量更新组织节点（先校验节点归属）。
func (s *UserService) BatchUpdateOrgNode(ctx context.Context, tenantID string, userIDs []string, orgNodeID *string) (int64, error) {
	if orgNodeID != nil && *orgNodeID != "" {
		ok, err := s.st.Users().OrgNodeExists(ctx, *orgNodeID, tenantID)
		if err != nil {
			return 0, err
		}
		if !ok {
			return 0, ErrOrgNodeInvalid
		}
	}
	return s.st.Users().BatchUpdateOrgNode(ctx, tenantID, userIDs, orgNodeID)
}

// BindRoles 校验并替换用户角色绑定（事务内）。
func (s *UserService) BindRoles(ctx context.Context, userID string, roleIDs []string, tenantID string) error {
	ok, err := s.st.Users().ValidateRolesInTenant(ctx, roleIDs, tenantID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidRoles
	}
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Users().BindRoles(ctx, txStore.Q(), userID, roleIDs)
	})
}

// AttachRoles 为单个用户补充角色信息（就地修改）。
func (s *UserService) AttachRoles(ctx context.Context, user *domain.User) {
	items := []domain.User{*user}
	s.st.Users().AttachUserRoles(ctx, items)
	*user = items[0]
}

// ErrOrgNodeInvalid 机构节点无效。
var ErrOrgNodeInvalid = errors.New("无效机构节点ID")

// ErrInvalidRoles 存在无效角色。
var ErrInvalidRoles = errors.New("存在无效角色或角色不属于当前租户")
