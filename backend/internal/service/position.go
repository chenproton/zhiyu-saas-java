package service

import (
	"context"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionService 岗位业务编排。
type PositionService struct {
	*Service
	st *store.Store
}

// NewPositionService 创建岗位服务。
func NewPositionService(s *Service) *PositionService {
	return &PositionService{Service: s, st: s.Store()}
}

// List 查询岗位列表。
func (s *PositionService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.CareerPosition]) ([]domain.CareerPosition, int, error) {
	return s.st.Positions().List(ctx, p, cfg)
}

// Get 查询单个岗位。
func (s *PositionService) Get(ctx context.Context, id string) (*domain.CareerPosition, error) {
	return s.st.Positions().Get(ctx, id)
}

// TenantID 查询岗位租户。
func (s *PositionService) TenantID(ctx context.Context, id string) (string, error) {
	return s.st.Positions().TenantID(ctx, id)
}

// Create 创建岗位（事务内绑定专业）。
func (s *PositionService) Create(ctx context.Context, tenantID string, p *store.PositionCreateParams) (*domain.CareerPosition, error) {
	var pos *domain.CareerPosition
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		code, err := store.GenerateUniqueEntityCode(ctx, txStore.Q(), "GW", "career_positions", tenantID)
		if err != nil {
			return err
		}
		p.Code = code
		pos, err = txStore.Positions().Create(ctx, txStore.Q(), tenantID, p)
		return err
	})
	if err != nil {
		return nil, err
	}
	return pos, nil
}

// Update 更新岗位（事务内重绑专业）。
func (s *PositionService) Update(ctx context.Context, id string, p *store.PositionUpdateParams) (*domain.CareerPosition, error) {
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		_, err := txStore.Positions().Update(ctx, txStore.Q(), id, p)
		return err
	})
	if err != nil {
		return nil, err
	}
	pos, err := s.st.Positions().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	return pos, nil
}

// Delete 删除岗位。
func (s *PositionService) Delete(ctx context.Context, id string) error {
	return s.st.Positions().Delete(ctx, id)
}

// IncrementView 记录浏览。
func (s *PositionService) IncrementView(ctx context.Context, targetID string, userID, tenantID any) error {
	return s.st.Positions().IncrementView(ctx, targetID, userID, tenantID)
}

// SaveFull 完整保存岗位（事务内职责/绑定/能力域/证书重写）。
func (s *PositionService) SaveFull(ctx context.Context, tenantID, positionID string, p *store.FullPositionSaveParams) error {
	abilityPointMap := make(map[string]string)
	for _, b := range p.AbilityBindings {
		if b.Source == "public" {
			if b.PublicAbilityID != "" {
				abilityPointMap[b.ID] = b.PublicAbilityID
			} else if b.AbilityPointID != "" {
				abilityPointMap[b.ID] = b.AbilityPointID
			}
			continue
		}
		if b.Source != "custom" {
			continue
		}
		if strings.TrimSpace(b.Name) == "" {
			continue
		}
		pointID, err := s.st.Positions().PrepareAbilityPoint(ctx, tenantID, b.Name, b.Description, b.Attributes)
		if err != nil {
			continue
		}
		if pointID != "" {
			abilityPointMap[b.ID] = pointID
		}
	}
	certificateMap := make(map[string]string)
	for _, c := range p.Certificates {
		if c.Name == "" {
			continue
		}
		libID, err := s.st.Positions().PrepareCertificate(ctx, tenantID, c.Name, c.URL, c.Description, c.Image)
		if err != nil {
			continue
		}
		if libID != "" {
			certificateMap[c.Name] = libID
		}
	}

	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Positions().SaveFull(ctx, txStore.Q(), tenantID, positionID, p, abilityPointMap, certificateMap)
	})
}

// GetFavorite 查询收藏状态。
func (s *PositionService) GetFavorite(ctx context.Context, userID, positionID string) (bool, error) {
	return s.st.Positions().GetFavorite(ctx, userID, positionID)
}

// FavoriteCount 查询岗位收藏数。
func (s *PositionService) FavoriteCount(ctx context.Context, positionID string) (int, error) {
	return s.st.Positions().FavoriteCount(ctx, positionID)
}

// ToggleFavorite 切换收藏。
func (s *PositionService) ToggleFavorite(ctx context.Context, userID, positionID string) (bool, error) {
	return s.st.Positions().ToggleFavorite(ctx, userID, positionID)
}

// ListFavorites 查询收藏岗位。
func (s *PositionService) ListFavorites(ctx context.Context, userID string, p store.ListParams, cfg store.ListQueryConfig[domain.CareerPosition]) ([]domain.CareerPosition, int, error) {
	return s.st.Positions().ListFavorites(ctx, userID, p, cfg)
}
