package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/store"
)

// UserRelationService 用户关系业务编排。
type UserRelationService struct {
	*Service
	st *store.Store
}

// NewUserRelationService 创建用户关系服务。
func NewUserRelationService(s *Service) *UserRelationService {
	return &UserRelationService{Service: s, st: s.Store()}
}

// List 查询用户关系。
func (s *UserRelationService) List(ctx context.Context, tenantID, search string, limit, offset int) ([]store.UserRelationItem, int, error) {
	return s.st.UserRelations().List(ctx, tenantID, search, limit, offset)
}

// Create 创建用户关系（校验双方同租户）。
func (s *UserRelationService) Create(ctx context.Context, tenantID string, p *store.UserRelationCreateParams) (string, error) {
	ok, err := s.st.UserRelations().UsersExist(ctx, tenantID, []string{p.InitiatorID, p.TargetID})
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrRelationUsersNotInTenant
	}
	return s.st.UserRelations().Create(ctx, tenantID, p)
}

// Delete 删除用户关系。
func (s *UserRelationService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.st.UserRelations().Delete(ctx, id, tenantID)
}

// ErrRelationUsersNotInTenant 发起者或目标不在租户中。
var ErrRelationUsersNotInTenant = errors.New("users not in tenant")

// UserRelationCreateParams 创建用户关系参数（handler 层透传）。
type UserRelationCreateParams = store.UserRelationCreateParams
