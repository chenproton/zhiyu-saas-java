package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
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
	EnterpriseName          string
	Username                string
	Password                string
	ContactName             string // 管理员姓名（可选，默认"企业名+管理员"）
	UnifiedSocialCreditCode string // 统一社会信用代码（可选）
	ContactPerson           string // 联系人（可选）
	ContactPhone            string // 联系电话（可选）
	ContactEmail            string // 联系邮箱（可选）
	ValidFrom               *string
	ValidUntil              *string
}

// PartnerRegisterResult 注册结果（handler 据此签发 token）。
type PartnerRegisterResult struct {
	User         *domain.User
	TenantID     string
	EnterpriseID string
}

// Register 企业自助注册：事务内创建「企业租户 + 企业主体 + 管理员账号 + 角色种子」。
// 用户名按租户内唯一（login_name = tenantID_username 由 DB 唯一约束兜底）；
// 同一用户名可在多个企业注册（同一个人加入多个企业，登录时选择企业）。
func (s *PartnerService) Register(ctx context.Context, p *PartnerRegisterParams) (*PartnerRegisterResult, error) {
	contactName := p.ContactName
	if contactName == "" {
		contactName = p.EnterpriseName + "管理员"
	}

	var result PartnerRegisterResult
	err := s.st.WithTx(ctx, func(txStore *store.Store) error {
		// 企业租户（type=enterprise）+ 角色种子
		tenantCode := "ent-" + uuid.NewString()[:8]
		tenantRes, err := txStore.Tenants().CreateEnterpriseTenant(ctx, txStore.Q(), &store.TenantCreateParams{
			Name:       p.EnterpriseName,
			Code:       tenantCode,
			ValidFrom:  p.ValidFrom,
			ValidUntil: p.ValidUntil,
		})
		if err != nil {
			return err
		}

		// 企业主体（全局唯一，name 冲突由 DB 唯一约束兜底）；默认开启"愿意对外展示"
		enterpriseID, err := txStore.Alliance().CreateEnterprise(ctx, &store.AllianceEnterpriseCreateParams{
			TenantID:                tenantRes.TenantID,
			Name:                    p.EnterpriseName,
			UnifiedSocialCreditCode: store.StrPtrIfNonEmpty(p.UnifiedSocialCreditCode),
			ContactPerson:           store.StrPtrIfNonEmpty(p.ContactPerson),
			ContactPhone:            store.StrPtrIfNonEmpty(p.ContactPhone),
			ContactEmail:            store.StrPtrIfNonEmpty(p.ContactEmail),
			EnablePublic:            true,
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

// ErrPartnerInvalidStatus 合作状态确认请求携带了未知 status。
var ErrPartnerInvalidStatus = errors.New("无效合作状态")

// ErrPartnerInvalidTransition 合作状态流转不合法（terminated 为终态）。
var ErrPartnerInvalidTransition = errors.New("非法合作状态流转")

// partnerLinkTransitions 合作状态合法流转表：negotiating→active（确认）、
// active↔paused（暂停/恢复）、任意非 terminated→terminated（终止）；terminated 是终态。
var partnerLinkTransitions = map[string]map[string]bool{
	"negotiating": {"active": true, "terminated": true},
	"active":      {"paused": true, "terminated": true},
	"paused":      {"active": true, "terminated": true},
	"terminated":  {},
}

// UpdateSchoolStatus 合作关系状态确认：校验流转合法性后更新 link.status，
// 返回更新后的合作学校视图（与 ListSchools 单项同构）；link 不存在时透传 pgx.ErrNoRows。
func (s *PartnerService) UpdateSchoolStatus(ctx context.Context, tenantID, schoolTenantID, status string) (*domain.AlliancePartnerSchool, error) {
	switch status {
	case "active", "paused", "terminated":
	default:
		return nil, fmt.Errorf("%w: %s（仅支持 active/paused/terminated）", ErrPartnerInvalidStatus, status)
	}
	view, err := s.st.Partner().GetPartnerSchool(ctx, tenantID, schoolTenantID)
	if err != nil {
		return nil, err
	}
	if !partnerLinkTransitions[view.Status][status] {
		return nil, fmt.Errorf("%w: 不允许从 %s 变更为 %s", ErrPartnerInvalidTransition, view.Status, status)
	}
	if err := s.st.Partner().UpdatePartnerSchoolStatus(ctx, tenantID, schoolTenantID, status); err != nil {
		return nil, err
	}
	return s.st.Partner().GetPartnerSchool(ctx, tenantID, schoolTenantID)
}

// ListCooperation 本企业被各合作学校关联的内容只读视图（项目/成果/协议）。
func (s *PartnerService) ListCooperation(ctx context.Context, tenantID string) ([]domain.AlliancePartnerCooperationSchool, error) {
	enterprise, err := s.st.Alliance().GetEnterpriseByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.st.Partner().ListCooperation(ctx, enterprise.ID)
}

// ListMentorTasks 本企业专家被学校指派的测评任务只读列表。
func (s *PartnerService) ListMentorTasks(ctx context.Context, tenantID string) ([]domain.AlliancePartnerMentorTask, error) {
	enterprise, err := s.st.Alliance().GetEnterpriseByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.st.Partner().ListMentorTasks(ctx, enterprise.ID)
}

// CreateMember 管理员添加成员账号（绑定 enterprise_admin 或 enterprise_member）。
// 用户名按租户内唯一（login_name 唯一约束兜底），同一用户名可在多个企业存在。
func (s *PartnerService) CreateMember(ctx context.Context, tenantID, username, password, name, roleCode string, phone, email *string) (*domain.User, error) {
	if roleCode != domain.RoleEnterpriseAdmin && roleCode != domain.RoleEnterpriseMember {
		return nil, fmt.Errorf("无效角色: %s", roleCode)
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
		Phone:    phone,
		Email:    email,
	})
}

// ErrInvalidOldPassword 修改密码时旧密码校验失败。
var ErrInvalidOldPassword = errors.New("invalid old password")

// CreateExpertWithAccount 创建专家档案 + 自动生成专家账号（enterprise_member）并绑定 user_id。
// 返回明文密码（管理员填写，创建时回显确认）；用户名租户内唯一（login_name 唯一约束兜底）。
func (s *PartnerService) CreateExpertWithAccount(ctx context.Context, tenantID, enterpriseID string, e *domain.AllianceExpert, username, password string) (*domain.AllianceExpert, string, error) {
	roleID, err := s.st.Partner().GetRoleIDByCode(ctx, tenantID, domain.RoleEnterpriseMember)
	if err != nil {
		return nil, "", err
	}
	var expert *domain.AllianceExpert
	err = s.st.WithTx(ctx, func(txStore *store.Store) error {
		user, err := txStore.Users().Create(ctx, txStore.Q(), &store.UserCreateParams{
			TenantID: tenantID,
			Role:     string(domain.UserRoleEnterprise),
			RoleID:   roleID,
			Platform: string(domain.UserPlatformPartner),
			Username: username,
			Password: password,
			Name:     e.Name,
		})
		if err != nil {
			return err
		}
		e.UserID = &user.ID
		id, err := txStore.Alliance().CreateExpert(ctx, e)
		if err != nil {
			return err
		}
		expert, err = txStore.Alliance().GetExpertByID(ctx, id, tenantID)
		return err
	})
	if err != nil {
		return nil, "", err
	}
	return expert, password, nil
}

// ResetExpertPassword 重置专家账号密码（admin 编辑专家时可选）。
func (s *PartnerService) ResetExpertPassword(ctx context.Context, expertUserID, plainPassword string) error {
	return s.st.Users().ResetPassword(ctx, expertUserID, plainPassword)
}

// DeleteExpertWithAccount 删除专家档案及其绑定账号（事务）。
func (s *PartnerService) DeleteExpertWithAccount(ctx context.Context, tenantID, expertID string) error {
	return s.st.WithTx(ctx, func(txStore *store.Store) error {
		expert, err := txStore.Alliance().GetExpertByID(ctx, expertID, tenantID)
		if err != nil {
			return err
		}
		if expert.UserID != nil {
			if _, err := txStore.Q().Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, *expert.UserID); err != nil {
				return err
			}
			if _, err := txStore.Q().Exec(ctx, `DELETE FROM users WHERE id = $1`, *expert.UserID); err != nil {
				return err
			}
		}
		return txStore.Alliance().DeleteExpert(ctx, expertID, tenantID)
	})
}

// GetMyExpert 专家本人的档案（按绑定账号 user_id 查询）。
func (s *PartnerService) GetMyExpert(ctx context.Context, tenantID, userID string) (*domain.AllianceExpert, error) {
	return s.st.Alliance().GetExpertByUserID(ctx, tenantID, userID)
}

// ChangeMyPassword 修改本人密码（先校验旧密码，与登录同用 bcrypt 比对）。
func (s *PartnerService) ChangeMyPassword(ctx context.Context, tenantID, userID, oldPassword, newPassword string) error {
	user, err := s.st.Users().Get(ctx, tenantID, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)) != nil {
		return ErrInvalidOldPassword
	}
	return s.st.Users().ResetPassword(ctx, userID, newPassword)
}
