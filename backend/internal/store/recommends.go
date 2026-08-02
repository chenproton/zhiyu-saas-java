package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

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
func (s *RecommendStore) Get(ctx context.Context, id, tenantID string) (*domain.PositionRecommendation, error) {
	rec, err := s.fetchRecommend(ctx, id, tenantID)
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
	return s.Get(ctx, id, tenantID)
}

// Update 更新推荐位。
func (s *RecommendStore) Update(ctx context.Context, id, tenantID string, p *RecommendParams) (*domain.PositionRecommendation, error) {
	if _, err := s.fetchRecommend(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE position_recommendations SET
			major_id = $1, career_position_id = $2, position_type = $3, reason = $4,
			sort_order = $5, is_enabled = $6, updated_at = NOW()
		WHERE id = $7 AND tenant_id = $8
	`, p.MajorID, p.CareerPositionID, p.PositionType, p.Reason, p.SortOrder, p.IsEnabled, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除推荐位。
func (s *RecommendStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM position_recommendations WHERE id = $1 AND tenant_id = $2`, id, tenantID)
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

func (s *RecommendStore) fetchRecommend(ctx context.Context, id, tenantID string) (*domain.PositionRecommendation, error) {
	var rec domain.PositionRecommendation
	var reason *string
	err := s.q.QueryRow(ctx, `
		SELECT pr.id, pr.major_id, COALESCE(m.name, '') AS major_name,
			pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
			pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
		FROM position_recommendations pr
		LEFT JOIN majors m ON m.id = pr.major_id
		WHERE pr.id = $1 AND pr.tenant_id = $2
	`, id, tenantID).Scan(&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
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

// ListConfig 返回推荐位列表查询配置，SQL 片段沉淀在 store 层。
func (s *RecommendStore) ListConfig() ListQueryConfig[domain.PositionRecommendation] {
	return ListQueryConfig[domain.PositionRecommendation]{
		Table:         "position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		SelectColumns: "pr.id, pr.major_id, COALESCE(m.name, '') AS major_name, pr.career_position_id, pr.position_type, pr.reason, pr.sort_order, pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at",
		TenantScoped:  true,
		TenantColumn:  "pr.tenant_id",
		OrderBy:       "pr.sort_order ASC, pr.created_at DESC",
		ScanRows:      ScanRecommendRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if majorID := p.Values["majorId"]; majorID != "" {
				qb.AddCondition("pr.major_id = " + qb.NextArg(majorID))
			}
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("pr.career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
}
