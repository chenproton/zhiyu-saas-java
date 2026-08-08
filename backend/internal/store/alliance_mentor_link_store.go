package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 专家 ↔ 学校影子账号（alliance_expert_mentor_links，tenant_id = 学校租户） =====
// 支撑互动流程二/三：学校"启用专家为共建导师"时创建影子账号并登记；
// 停用仅置 enabled=false，不删 users 账号（岗位 collaborators uuid[] 等业务引用不悬空）。

type AllianceExpertMentorLinkStore struct {
	q Queryer
}

func NewAllianceExpertMentorLinkStore(q Queryer) *AllianceExpertMentorLinkStore {
	return &AllianceExpertMentorLinkStore{q: q}
}

// GetByExpert 查询某校对某专家的导师绑定（越权校验/幂等判断的数据基础）。
// 无记录时返回 ErrNotFound。
func (s *AllianceExpertMentorLinkStore) GetByExpert(ctx context.Context, tenantID, expertID string) (*domain.AllianceExpertMentorLink, error) {
	var l domain.AllianceExpertMentorLink
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, expert_id, user_id, enabled, created_by, created_at
		FROM alliance_expert_mentor_links WHERE tenant_id = $1 AND expert_id = $2
	`, tenantID, expertID).Scan(&l.ID, &l.TenantID, &l.ExpertID, &l.UserID, &l.Enabled, &l.CreatedBy, &l.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// CreateLink 登记导师绑定（须在事务内与影子账号创建同事务提交）。
// UNIQUE(tenant_id, expert_id) 冲突由调用方转幂等返回。
func (s *AllianceExpertMentorLinkStore) CreateLink(ctx context.Context, tx Queryer, tenantID, expertID, userID string, createdBy *string) (string, error) {
	id := uuid.NewString()
	_, err := tx.Exec(ctx, `
		INSERT INTO alliance_expert_mentor_links (id, tenant_id, expert_id, user_id, enabled, created_by, created_at)
		VALUES ($1, $2, $3, $4, true, $5, NOW())
	`, id, tenantID, expertID, userID, createdBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

// SetEnabled 启用/停用绑定（停用不删 users 影子账号，避免业务表 uuid[] 引用悬空）。
func (s *AllianceExpertMentorLinkStore) SetEnabled(ctx context.Context, tx Queryer, tenantID, expertID string, enabled bool) error {
	_, err := tx.Exec(ctx, `
		UPDATE alliance_expert_mentor_links SET enabled = $3 WHERE tenant_id = $1 AND expert_id = $2
	`, tenantID, expertID, enabled)
	return err
}

// ListOptionsBySchoolTenant 共建导师选择器数据源：本校已引入企业的全部专家 + 启用状态 + 影子账号 id。
func (s *AllianceExpertMentorLinkStore) ListOptionsBySchoolTenant(ctx context.Context, tenantID string) ([]domain.AllianceMentorOption, error) {
	rows, err := s.q.Query(ctx, `
		SELECT x.id, x.name, x.title, e.id, e.name, COALESCE(m.enabled, false), m.user_id
		FROM alliance_experts x
		JOIN alliance_enterprise_links l ON l.enterprise_id = x.enterprise_id AND l.tenant_id = $1
		JOIN partner_enterprises e ON e.id = x.enterprise_id
		LEFT JOIN alliance_expert_mentor_links m ON m.expert_id = x.id AND m.tenant_id = $1
		ORDER BY e.name, x.created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AllianceMentorOption, 0)
	for rows.Next() {
		var o domain.AllianceMentorOption
		var userID *string
		if err := rows.Scan(&o.ExpertID, &o.Name, &o.Title, &o.EnterpriseID, &o.EnterpriseName, &o.Enabled, &userID); err != nil {
			return nil, err
		}
		if !o.Enabled {
			userID = nil
		}
		o.UserID = userID
		items = append(items, o)
	}
	return items, rows.Err()
}

// ListEnabledMentorUserIDs 本校已启用导师绑定的影子账号 id 集合（任务级分配/毕设导师校验的数据基础）。
func (s *AllianceExpertMentorLinkStore) ListEnabledMentorUserIDs(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT user_id FROM alliance_expert_mentor_links WHERE tenant_id = $1 AND enabled = true
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// IsEnabledMentorUser 校验某账号是否为本校已启用导师绑定的影子账号（毕设导师绑定校验用）。
func (s *AllianceExpertMentorLinkStore) IsEnabledMentorUser(ctx context.Context, tenantID, userID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM alliance_expert_mentor_links WHERE tenant_id = $1 AND user_id = $2 AND enabled = true)
	`, tenantID, userID).Scan(&exists)
	return exists, err
}
