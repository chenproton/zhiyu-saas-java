package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// OrgService 组织业务编排：删除组织走事务（解绑用户 + 删除子树）。
type OrgService struct {
	*Service
	st *store.Store
}

// NewOrgService 创建组织服务。
func NewOrgService(s *Service) *OrgService {
	return &OrgService{Service: s, st: s.Store()}
}

// List 查询组织列表。
func (s *OrgService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Organization]) ([]domain.Organization, int, error) {
	return s.st.Organizations().List(ctx, p, cfg)
}

// Tree 查询租户组织全量（含成员统计）。
func (s *OrgService) Tree(ctx context.Context, tenantID string) ([]domain.Organization, error) {
	return s.st.Organizations().Tree(ctx, tenantID)
}

// MemberCounts 统计组织成员数。
func (s *OrgService) MemberCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	return s.st.Organizations().MemberCounts(ctx, tenantID)
}

// Get 查询单个组织。
func (s *OrgService) Get(ctx context.Context, id string) (*domain.Organization, error) {
	return s.st.Organizations().Get(ctx, id)
}

// Create 创建组织。
func (s *OrgService) Create(ctx context.Context, tenantID string, p *store.OrgCreateParams) (*domain.Organization, error) {
	return s.st.Organizations().Create(ctx, tenantID, p)
}

// Update 更新组织（含类型/父级校验与防环校验）。
func (s *OrgService) Update(ctx context.Context, id string, p *store.OrgUpdateParams) error {
	existing, err := s.st.Organizations().Get(ctx, id)
	if err != nil {
		return err
	}
	if err := s.ValidateOrgRefs(ctx, existing.TenantID, p.TypeID, p.ParentID); err != nil {
		return err
	}
	if p.ParentID != nil && *p.ParentID == id {
		return ErrOrgSelfParent
	}
	if p.ParentID != nil && *p.ParentID != "" {
		isDesc, err := s.st.Organizations().IsDescendant(ctx, id, *p.ParentID)
		if err != nil {
			return err
		}
		if isDesc {
			return ErrOrgDescendantParent
		}
	}
	_, err = s.st.Organizations().Update(ctx, id, p)
	return err
}

// Delete 在事务内删除组织及其后代，并解绑用户。
func (s *OrgService) Delete(ctx context.Context, id, tenantID string) error {
	ids, err := s.st.Organizations().SubtreeIDs(ctx, id, tenantID)
	if err != nil {
		return err
	}
	all := append([]string{id}, ids...)
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Organizations().DeleteSubtree(ctx, txStore.Q(), id, tenantID, all)
	})
}

// ValidateOrgRefs 校验组织类型与上级组织归属。
func (s *OrgService) ValidateOrgRefs(ctx context.Context, tenantID, typeID string, parentID *string) error {
	ok, err := s.st.Organizations().OrgTypeExists(ctx, typeID, tenantID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrOrgTypeInvalid
	}
	if parentID != nil && *parentID != "" {
		parent, err := s.st.Organizations().Get(ctx, *parentID)
		if err != nil || parent.TenantID != tenantID {
			return ErrOrgParentInvalid
		}
	}
	return nil
}

// 组织业务错误。
var (
	ErrOrgSelfParent       = errors.New("不能将父节点设置为自己")
	ErrOrgDescendantParent = errors.New("不能将子节点设置为父节点")
	ErrOrgTypeInvalid      = errors.New("组织类型 ID 无效")
	ErrOrgParentInvalid    = errors.New("上级组织 ID 无效")
)
