package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AllianceMentorService 校企互动：专家影子账号（共建导师）启用/停用/选择器数据源。
type AllianceMentorService struct {
	*Service
	st *store.Store
}

// NewAllianceMentorService 创建共建导师服务。
func NewAllianceMentorService(s *Service) *AllianceMentorService {
	return &AllianceMentorService{Service: s, st: s.Store()}
}

// ErrExpertNotFound 专家档案不存在。
var ErrExpertNotFound = errors.New("expert not found")

// ErrExpertNotLinkedToSchool 专家所属企业未引入本校（越权防线）。
var ErrExpertNotLinkedToSchool = errors.New("expert enterprise not linked to school")

// EnableMentorResult 启用结果；InitialPassword/Username 仅新建影子账号时有值（初始密码仅返回一次）。
type EnableMentorResult struct {
	Link            *domain.AllianceExpertMentorLink
	Username        string
	InitialPassword string
	Created         bool
}

// EnableMentor 启用专家为共建导师（幂等）：
// 已有绑定 → 直接返回（停用状态则重新启用）；无绑定 → 事务内创建影子账号
// （platform=portal/role=school + enterprise_mentor 角色）并登记 mentor_links。
// 越权防线：专家所属企业必须 ∈ 本校 links。
func (s *AllianceMentorService) EnableMentor(ctx context.Context, tenantID, expertID, operatorID string) (*EnableMentorResult, error) {
	expert, err := s.st.Alliance().GetExpertByIDGlobal(ctx, expertID)
	if err != nil {
		return nil, ErrExpertNotFound
	}
	if expert.EnterpriseID == nil {
		return nil, ErrExpertNotLinkedToSchool
	}
	if _, err := s.st.AllianceEnterpriseLinks().GetLinkByEnterprise(ctx, *expert.EnterpriseID, tenantID); err != nil {
		return nil, ErrExpertNotLinkedToSchool
	}
	enterpriseID := *expert.EnterpriseID

	var result EnableMentorResult
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		// 幂等：已有绑定直接返回（停用状态重新启用，不重建账号、不再返回密码）
		if existing, err := txStore.AllianceExpertMentorLinks().GetByExpert(ctx, tenantID, expertID); err == nil {
			if !existing.Enabled {
				if err := txStore.AllianceExpertMentorLinks().SetEnabled(ctx, txStore.Q(), tenantID, expertID, true); err != nil {
					return err
				}
				existing.Enabled = true
			}
			result.Link = existing
			return nil
		} else if !errors.Is(err, store.ErrNotFound) {
			return err
		}

		roleID, err := txStore.Partner().GetRoleIDByCode(ctx, tenantID, domain.RoleEnterpriseMentor)
		if err != nil {
			return err
		}
		password, err := store.GenerateSecurePassword(12)
		if err != nil {
			return err
		}
		username := fmt.Sprintf("em_%s_%s", enterpriseID[:8], expertID[:8])
		user, err := txStore.Users().Create(ctx, txStore.Q(), &store.UserCreateParams{
			TenantID: tenantID,
			Role:     string(domain.UserRoleSchool),
			RoleID:   roleID,
			Platform: string(domain.UserPlatformPortal),
			Username: username,
			Password: password,
			Name:     expert.Name,
		})
		if err != nil {
			return err
		}
		linkID, err := txStore.AllianceExpertMentorLinks().CreateLink(ctx, txStore.Q(), tenantID, expertID, user.ID, &operatorID)
		if err != nil {
			return err
		}
		result = EnableMentorResult{
			Link: &domain.AllianceExpertMentorLink{
				ID:        linkID,
				TenantID:  tenantID,
				ExpertID:  expertID,
				UserID:    user.ID,
				Enabled:   true,
				CreatedBy: &operatorID,
			},
			Username:        username,
			InitialPassword: password,
			Created:         true,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// DisableMentor 停用导师绑定（enabled=false，不删 users 影子账号，避免业务引用悬空）。
func (s *AllianceMentorService) DisableMentor(ctx context.Context, tenantID, expertID string) (*domain.AllianceExpertMentorLink, error) {
	link, err := s.st.AllianceExpertMentorLinks().GetByExpert(ctx, tenantID, expertID)
	if err != nil {
		return nil, err
	}
	if link.Enabled {
		if err := s.st.AllianceExpertMentorLinks().SetEnabled(ctx, s.st.Q(), tenantID, expertID, false); err != nil {
			return nil, err
		}
		link.Enabled = false
	}
	return link, nil
}

// ListMentorOptions 共建导师选择器数据源（本校已引入企业的全部专家 + 启用状态）。
func (s *AllianceMentorService) ListMentorOptions(ctx context.Context, tenantID string) ([]domain.AllianceMentorOption, error) {
	return s.st.AllianceExpertMentorLinks().ListOptionsBySchoolTenant(ctx, tenantID)
}

// IsEnabledMentorUser 校验账号是否为本校已启用导师的影子账号（毕业设计导师绑定校验）。
func (s *AllianceMentorService) IsEnabledMentorUser(ctx context.Context, tenantID, userID string) (bool, error) {
	return s.st.AllianceExpertMentorLinks().IsEnabledMentorUser(ctx, tenantID, userID)
}
