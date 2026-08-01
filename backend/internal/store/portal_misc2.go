package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// SubscriptionStore 订阅持久化。
type SubscriptionStore struct {
	q Queryer
}

// NewSubscriptionStore 创建订阅 store。
func NewSubscriptionStore(q Queryer) *SubscriptionStore {
	return &SubscriptionStore{q: q}
}

// Get 查询单个订阅。
func (s *SubscriptionStore) Get(ctx context.Context, id string) (*domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE id = $1
	`, id).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return &sub, nil
}

// GetByTenant 查询租户订阅（最新）。
func (s *SubscriptionStore) GetByTenant(ctx context.Context, tenantID string) (*domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return &sub, nil
}

// Create 创建订阅。
func (s *SubscriptionStore) Create(ctx context.Context, p *SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO subscription_packages (id, tenant_id, name, valid_until, modules, status)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, p.TenantID, p.Name, p.ValidUntil, p.Modules, p.Status).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新订阅。
func (s *SubscriptionStore) Update(ctx context.Context, id string, p *SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE subscription_packages SET name = $1, valid_until = $2, modules = $3, status = $4, updated_at = NOW()
		WHERE id = $5
	`, p.Name, p.ValidUntil, p.Modules, p.Status, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// SubscriptionUpdateParams 订阅更新参数。
type SubscriptionUpdateParams struct {
	TenantID   string
	Name       string
	ValidUntil *string
	Modules    domain.JSONMap
	Status     string
}

// ===== 资源码 =====

// ResourceCodeStore 资源码持久化。
type ResourceCodeStore struct {
	q Queryer
}

// NewResourceCodeStore 创建资源码 store。
func NewResourceCodeStore(q Queryer) *ResourceCodeStore {
	return &ResourceCodeStore{q: q}
}

// List 查询资源码列表。
func (s *ResourceCodeStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ResourceCode]) ([]domain.ResourceCode, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanResourceCodeRows)
}

// Get 查询单个资源码。
func (s *ResourceCodeStore) Get(ctx context.Context, id string) (*domain.ResourceCode, error) {
	rc, err := s.fetchResourceCode(ctx, id)
	if err != nil {
		return nil, err
	}
	return rc, nil
}

// Create 创建资源码。
func (s *ResourceCodeStore) Create(ctx context.Context, p *ResourceCodeParams) (*domain.ResourceCode, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO resource_codes (id, tenant_id, code, name, description, type)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, p.TenantID, p.Code, p.Name, p.Description, p.Type).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新资源码。
func (s *ResourceCodeStore) Update(ctx context.Context, id string, p *ResourceCodeParams) (*domain.ResourceCode, error) {
	if _, err := s.fetchResourceCode(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE resource_codes SET name = $1, description = $2, type = $3
		WHERE id = $4
	`, p.Name, p.Description, p.Type, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除资源码。
func (s *ResourceCodeStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM resource_codes WHERE id = $1`, id)
	return err
}

// ResourceCodeParams 资源码参数。
type ResourceCodeParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Type        string
}

func (s *ResourceCodeStore) fetchResourceCode(ctx context.Context, id string) (*domain.ResourceCode, error) {
	var rc domain.ResourceCode
	var description *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes WHERE id = $1
	`, id).Scan(&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt)
	if err != nil {
		return nil, err
	}
	rc.Description = description
	return &rc, nil
}

// ScanResourceCodeRows 扫描资源码行。
func ScanResourceCodeRows(rows pgx.Rows) ([]domain.ResourceCode, error) {
	items := make([]domain.ResourceCode, 0)
	for rows.Next() {
		var rc domain.ResourceCode
		var description *string
		if err := rows.Scan(&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt); err != nil {
			return nil, err
		}
		rc.Description = description
		items = append(items, rc)
	}
	return items, nil
}

// ===== 推荐位 =====

// RecommendStore 推荐位持久化。
type RecommendStore struct {
	q Queryer
}

// NewRecommendStore 创建推荐位 store。
func NewRecommendStore(q Queryer) *RecommendStore {
	return &RecommendStore{q: q}
}

// List 查询推荐位列表。
func (s *RecommendStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.PositionRecommendation]) ([]domain.PositionRecommendation, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanRecommendRows)
}

// Get 查询单个推荐位。
func (s *RecommendStore) Get(ctx context.Context, id string) (*domain.PositionRecommendation, error) {
	rec, err := s.fetchRecommend(ctx, id)
	if err != nil {
		return nil, err
	}
	return rec, nil
}

// Create 创建推荐位。
func (s *RecommendStore) Create(ctx context.Context, tenantID string, p *RecommendParams) (*domain.PositionRecommendation, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO position_recommendations (
			id, tenant_id, major_id, career_position_id, position_type, reason, sort_order, is_enabled, created_by
		) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, tenantID, p.MajorID, p.CareerPositionID, p.PositionType, p.Reason, p.SortOrder, p.IsEnabled, p.CreatedBy).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新推荐位。
func (s *RecommendStore) Update(ctx context.Context, id string, p *RecommendParams) (*domain.PositionRecommendation, error) {
	if _, err := s.fetchRecommend(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE position_recommendations SET
			major_id = $1, career_position_id = $2, position_type = $3, reason = $4,
			sort_order = $5, is_enabled = $6, updated_at = NOW()
		WHERE id = $7
	`, p.MajorID, p.CareerPositionID, p.PositionType, p.Reason, p.SortOrder, p.IsEnabled, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除推荐位。
func (s *RecommendStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM position_recommendations WHERE id = $1`, id)
	return err
}

// RecommendParams 推荐位参数。
type RecommendParams struct {
	MajorID          *string
	CareerPositionID string
	PositionType     string
	Reason           *string
	SortOrder        int
	IsEnabled        bool
	CreatedBy        string
}

func (s *RecommendStore) fetchRecommend(ctx context.Context, id string) (*domain.PositionRecommendation, error) {
	var rec domain.PositionRecommendation
	var reason *string
	err := s.q.QueryRow(ctx, `
		SELECT pr.id, pr.major_id, COALESCE(m.name, '') AS major_name,
			pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
			pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
		FROM position_recommendations pr
		LEFT JOIN majors m ON m.id = pr.major_id
		WHERE pr.id = $1
	`, id).Scan(&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
		&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return nil, err
	}
	rec.Reason = reason
	return &rec, nil
}

// ScanRecommendRows 扫描推荐位行。
func ScanRecommendRows(rows pgx.Rows) ([]domain.PositionRecommendation, error) {
	items := make([]domain.PositionRecommendation, 0)
	for rows.Next() {
		var rec domain.PositionRecommendation
		var reason *string
		if err := rows.Scan(&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
			&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
			return nil, err
		}
		rec.Reason = reason
		items = append(items, rec)
	}
	return items, nil
}
