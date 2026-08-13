package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/domain"

	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionCloneService 岗位克隆业务编排（事务内多表复制）。
type PositionCloneService struct {
	*Service
	st *store.Store
}

// NewPositionCloneService 创建岗位克隆服务。
func NewPositionCloneService(s *Service) *PositionCloneService {
	return &PositionCloneService{Service: s, st: s.Store()}
}

// Clone 克隆岗位及全部关联（专业/职责/能力绑定/能力域/证书）。
// 返回新岗位 ID。
func (s *PositionCloneService) Clone(ctx context.Context, tenantID, oldPositionID, newName, createdBy string) (string, error) {
	src, err := s.st.PositionClone().FetchSource(ctx, oldPositionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return "", store.ErrNotFound
		}
		return "", err
	}
	// 源岗位租户缺失时同样拒绝，避免跨租户克隆
	if src.TenantID == nil || *src.TenantID != tenantID {
		return "", ErrPositionNotInTenant
	}
	if newName == "" {
		if src.Name != nil {
			newName = *src.Name + " (克隆)"
		} else {
			newName = "克隆岗位"
		}
	}
	var newID string
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		code, err := store.GenerateUniqueEntityCode(ctx, txStore.Q(), "GW", "career_positions", tenantID)
		if err != nil {
			return err
		}
		newID, err = txStore.PositionClone().ClonePosition(ctx, txStore.Q(), tenantID, oldPositionID, newName, src, createdBy, code)
		return err
	})
	if err != nil {
		return "", err
	}
	return newID, nil
}

// IsNotFound 判断是否不存在错误。
func IsNotFound(err error) bool {
	return errors.Is(err, store.ErrNotFound)
}

// ErrPositionNotInTenant 岗位不属于当前租户。
var ErrPositionNotInTenant = errors.New("position not in tenant")

// FetchPosition 查询完整岗位（含专业/计数/协作者名称）。
func (s *PositionCloneService) FetchPosition(ctx context.Context, id string) (domain.CareerPosition, error) {
	return s.st.PositionClone().FetchPosition(ctx, id)
}
