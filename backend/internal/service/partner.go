package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PartnerService 企业平台（Partner）业务编排。
type PartnerService struct {
	*Service
	st *store.Store
}

// NewPartnerService 创建企业平台服务。
func NewPartnerService(s *Service) *PartnerService {
	return &PartnerService{Service: s, st: s.Store()}
}

// PartnerRegisterParams 企业自助注册参数。
type PartnerRegisterParams struct {
	EnterpriseName string
	Username       string
	Password       string
	ContactName    string // 管理员姓名（可选，默认"企业名+管理员"）
}

// PartnerRegisterResult 注册结果（handler 据此签发 token）。
type PartnerRegisterResult struct {
	User         *domain.User
	TenantID     string
	EnterpriseID string
}

// Register 企业自助注册：事务内创建「企业租户 + 企业主体 + 管理员账号 + 角色种子」。
// partner 平台内 username 全局唯一（注册前置应用层校验）。
func (s *PartnerService) Register(ctx context.Context, p *PartnerRegisterParams) (*PartnerRegisterResult, error) {
	exists, err := s.st.Partner().PartnerUsernameExists(ctx, p.Username)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, store.ErrPartnerUsernameExists
	}

	contactName := p.ContactName
	if contactName == "" {
		contactName = p.EnterpriseName + "管理员"
	}

	var result PartnerRegisterResult
	err = s.st.WithTx(ctx, func(txStore *store.Store) error {
		// 企业租户（type=enterprise）+ 角色种子
		tenantCode := "ent-" + uuid.NewString()[:8]
		tenantRes, err := txStore.Tenants().CreateEnterpriseTenant(ctx, txStore.Q(), &store.TenantCreateParams{
			Name: p.EnterpriseName,
			Code: tenantCode,
		})
		if err != nil {
			return err
		}

		// 企业主体（全局唯一，name 冲突由 DB 唯一约束兜底）
		enterpriseID, err := txStore.Alliance().CreateEnterprise(ctx, &store.AllianceEnterpriseCreateParams{
			TenantID: tenantRes.TenantID,
			Name:     p.EnterpriseName,
		})
		if err != nil {
			return err
		}

		// 管理员账号（platform=partner，role=enterprise）+ enterprise_admin 绑定
		user, err := txStore.Users().Create(ctx, txStore.Q(), &store.UserCreateParams{
			TenantID: tenantRes.TenantID,
			Role:     string(domain.UserRoleEnterprise),
			RoleID:   tenantRes.AdminRoleID,
			Platform: string(domain.UserPlatformPartner),
			Username: p.Username,
			Password: p.Password,
			Name:     contactName,
		})
		if err != nil {
			return err
		}

		result = PartnerRegisterResult{User: user, TenantID: tenantRes.TenantID, EnterpriseID: enterpriseID}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetProfile 企业主体信息（按企业租户）。
func (s *PartnerService) GetProfile(ctx context.Context, tenantID string) (*domain.AllianceEnterprise, error) {
	return s.st.Alliance().GetEnterpriseByTenant(ctx, tenantID)
}

// UpdateProfile 更新企业主体信息（含 enable_public 展示开关）。
func (s *PartnerService) UpdateProfile(ctx context.Context, tenantID string, p *store.AllianceEnterpriseProfileUpdateParams) (*domain.AllianceEnterprise, error) {
	enterprise, err := s.st.Alliance().GetEnterpriseByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if err := s.st.Alliance().UpdateEnterpriseProfile(ctx, enterprise.ID, tenantID, p); err != nil {
		return nil, err
	}
	return s.st.Alliance().GetEnterpriseByTenant(ctx, tenantID)
}

// PartnerDashboard 服务台统计。
type PartnerDashboard struct {
	ExpertCount int `json:"expertCount"`
	SchoolCount int `json:"schoolCount"`
	MemberCount int `json:"memberCount"`
}

func (s *PartnerService) Dashboard(ctx context.Context, tenantID string) (*PartnerDashboard, error) {
	var d PartnerDashboard
	var err error
	if d.ExpertCount, err = s.st.Partner().CountExpertsByTenant(ctx, tenantID); err != nil {
		return nil, err
	}
	if d.SchoolCount, err = s.st.AllianceEnterpriseLinks().CountByEnterpriseTenant(ctx, tenantID); err != nil {
		return nil, err
	}
	if d.MemberCount, err = s.st.Partner().CountMembersByTenant(ctx, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

// ListSchools 合作学校列表（link 反向视图）。
func (s *PartnerService) ListSchools(ctx context.Context, tenantID string) ([]domain.AlliancePartnerSchool, error) {
	return s.st.AllianceEnterpriseLinks().ListByEnterpriseTenant(ctx, tenantID)
}

// CreateMember 管理员添加成员账号（绑定 enterprise_admin 或 enterprise_member）。
func (s *PartnerService) CreateMember(ctx context.Context, tenantID, username, password, name, roleCode string) (*domain.User, error) {
	if roleCode != domain.RoleEnterpriseAdmin && roleCode != domain.RoleEnterpriseMember {
		return nil, fmt.Errorf("无效角色: %s", roleCode)
	}
	exists, err := s.st.Partner().PartnerUsernameExists(ctx, username)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, store.ErrPartnerUsernameExists
	}
	roleID, err := s.st.Partner().GetRoleIDByCode(ctx, tenantID, roleCode)
	if err != nil {
		return nil, err
	}
	return s.st.Users().Create(ctx, s.st.Q(), &store.UserCreateParams{
		TenantID: tenantID,
		Role:     string(domain.UserRoleEnterprise),
		RoleID:   roleID,
		Platform: string(domain.UserPlatformPartner),
		Username: username,
		Password: password,
		Name:     name,
	})
}

// ResetMyPassword 修改本人密码。
func (s *PartnerService) ResetMyPassword(ctx context.Context, userID, newPassword string) error {
	return s.st.Users().ResetPassword(ctx, userID, newPassword)
}
