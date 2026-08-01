package service

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AuthService 认证业务编排。
type AuthService struct {
	*Service
	st *store.Store
}

// NewAuthService 创建认证服务。
func NewAuthService(s *Service) *AuthService {
	return &AuthService{Service: s, st: s.Store()}
}

// FindUsersByUsername 登录查询。
func (s *AuthService) FindUsersByUsername(ctx context.Context, username string, platform domain.UserPlatform) ([]store.LoginUserRow, error) {
	return s.st.Auth().FindUsersByUsername(ctx, username, platform)
}

// UpdateLastLogin 更新最后登录。
func (s *AuthService) UpdateLastLogin(ctx context.Context, userID string, t time.Time) {
	s.st.Auth().UpdateLastLogin(ctx, userID, t)
}

// RecordLoginLog 登录日志。
func (s *AuthService) RecordLoginLog(ctx context.Context, tenantID, userID, userName, ip, device, status string) {
	s.st.Auth().RecordLoginLog(ctx, tenantID, userID, userName, ip, device, status)
}

// GetUserByID 用户详情。
func (s *AuthService) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	return s.st.Auth().GetUserByID(ctx, id)
}

// GetInstitution 机构详情。
func (s *AuthService) GetInstitution(ctx context.Context, id string) (*domain.Institution, error) {
	return s.st.Auth().GetInstitution(ctx, id)
}

// GetTenantByID 租户详情。
func (s *AuthService) GetTenantByID(ctx context.Context, id string) *domain.Tenant {
	return s.st.Auth().GetTenantByID(ctx, id)
}

// GetOrganizationByID 组织详情。
func (s *AuthService) GetOrganizationByID(ctx context.Context, id string) *domain.Organization {
	return s.st.Auth().GetOrganizationByID(ctx, id)
}

// GetMajorByID 专业详情。
func (s *AuthService) GetMajorByID(ctx context.Context, id string) *domain.Major {
	return s.st.Auth().GetMajorByID(ctx, id)
}

// ListUserRoles 用户角色。
func (s *AuthService) ListUserRoles(ctx context.Context, userID string) []domain.Role {
	return s.st.Auth().ListUserRoles(ctx, userID)
}

// ListUserRoleCodes 用户角色编码。
func (s *AuthService) ListUserRoleCodes(ctx context.Context, userID string) []string {
	return s.st.Auth().ListUserRoleCodes(ctx, userID)
}
