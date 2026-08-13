package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// AbilityStore 能力点持久化。
type AbilityStore struct {
	q Queryer
}

// NewAbilityStore 创建能力点 store。
func NewAbilityStore(q Queryer) *AbilityStore {
	return &AbilityStore{q: q}
}

// List 查询能力点列表。
func (s *AbilityStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAbilityPointRows)
}

// FindByNames 按名称精确匹配查询已有能力点（AI 推荐引用优先用）。
func (s *AbilityStore) FindByNames(ctx context.Context, tenantID string, names []string) ([]domain.AbilityPoint, error) {
	if len(names) == 0 {
		return nil, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT id, name, code, description, attributes, is_public, creator_id, created_at
		FROM ability_points WHERE tenant_id = $1 AND name = ANY($2)
	`, tenantID, names)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return ScanAbilityPointRows(rows)
}

// Get 查询单个能力点。
func (s *AbilityStore) Get(ctx context.Context, id, tenantID string) (*domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var description, code *string
	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, description, attributes, is_public, creator_id, created_at
		FROM ability_points WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&a.ID, &a.Name, &code, &description, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	a.Description = description
	a.Code = code
	return &a, nil
}

// Create 创建能力点。
func (s *AbilityStore) Create(ctx context.Context, tenantID string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	code, err := GenerateUniqueEntityCode(ctx, s.q, "NL", "ability_points", tenantID)
	if err != nil {
		code = GenerateEntityCode("NL")
	}
	var id string
	err = s.q.QueryRow(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, code, description, attributes, is_public, creator_id)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, tenantID, p.Name, code, p.Description, p.Attributes, p.IsPublic, p.CreatorID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新能力点。
func (s *AbilityStore) Update(ctx context.Context, id, tenantID string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	if _, err := s.Get(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_points SET name = $1, description = $2, attributes = $3, is_public = $4
		WHERE id = $5 AND tenant_id = $6
	`, p.Name, p.Description, p.Attributes, p.IsPublic, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除能力点。
func (s *AbilityStore) Delete(ctx context.Context, id, tenantID string) error {
	if err := DeleteResourceTags(ctx, s.q, domain.TagResourceTypeAbilityPoint, id); err != nil {
		return err
	}
	tag, err := s.q.Exec(ctx, `DELETE FROM ability_points WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AbilityPointParams 能力点参数。
type AbilityPointParams struct {
	Name        string
	Description *string
	Attributes  []string
	IsPublic    bool
	CreatorID   string
}

// ScanAbilityPointRows 扫描能力点行。
func ScanAbilityPointRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var description, code *string
		if err := rows.Scan(&a.ID, &a.Name, &code, &description, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Description = description
		a.Code = code
		items = append(items, a)
	}
	return items, rows.Err()
}

// ListConfig 返回能力点列表查询配置，SQL 片段沉淀在 store 层。
func (s *AbilityStore) ListConfig() ListQueryConfig[domain.AbilityPoint] {
	return ListQueryConfig[domain.AbilityPoint]{
		Table:         "ability_points",
		SelectColumns: "id, name, code, description, attributes, is_public, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ScanRows:      ScanAbilityPointRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if p.Values["isPublic"] == "true" {
				qb.AddCondition("is_public = " + qb.NextArg(true))
			}
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
			AddTagFilter(qb, p.TenantID, domain.TagResourceTypeAbilityPoint, "ability_points.id", SplitTagIDs(p.Values["tagIds"]))
		},
	}
}

// CitationStats 能力点引用次数分布（引用源：岗位职责/节点/场景任务/认证绑定）。
func (s *AbilityStore) CitationStats(ctx context.Context, tenantID string) (CitationStats, error) {
	rows, err := s.q.Query(ctx, `
		SELECT `+citationBucketCase+`, COUNT(*) AS cnt
		FROM (
			SELECT ap.id,
				COALESCE((SELECT COUNT(*) FROM position_ability_bindings pab WHERE pab.ability_point_id = ap.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM node_ability_point_bindings nab WHERE nab.ability_point_id = ap.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM task_ability_bindings tab WHERE tab.ability_point_id = ap.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM certification_ability_points cap WHERE cap.ability_point_id = ap.id), 0) AS ref_count
			FROM ability_points ap
			WHERE ap.tenant_id = $1
		) refs
		GROUP BY bucket
	`, tenantID)
	if err != nil {
		return CitationStats{}, err
	}
	defer rows.Close()
	return scanCitationStats(rows)
}

// ListUncited 零引用能力点列表（弹窗：创建时段筛选 + 分页）。
func (s *AbilityStore) ListUncited(ctx context.Context, tenantID string, from, to *time.Time, limit, offset int) ([]UncitedItem, int, error) {
	where := "ap.tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2
	if from != nil {
		where += " AND ap.created_at >= $" + Itoa(argIdx)
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		where += " AND ap.created_at < $" + Itoa(argIdx)
		args = append(args, *to)
		argIdx++
	}
	uncited := `
		AND NOT EXISTS (SELECT 1 FROM position_ability_bindings pab WHERE pab.ability_point_id = ap.id)
		AND NOT EXISTS (SELECT 1 FROM node_ability_point_bindings nab WHERE nab.ability_point_id = ap.id)
		AND NOT EXISTS (SELECT 1 FROM task_ability_bindings tab WHERE tab.ability_point_id = ap.id)
		AND NOT EXISTS (SELECT 1 FROM certification_ability_points cap WHERE cap.ability_point_id = ap.id)`

	var total int
	if err := s.q.QueryRow(ctx, "SELECT COUNT(*) FROM ability_points ap WHERE "+where+uncited, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limit, offset = ClampLimitOffset(limit, offset, 50)
	args = append(args, limit, offset)
	rows, err := s.q.Query(ctx, `
		SELECT ap.id, ap.name, ap.created_at
		FROM ability_points ap
		WHERE `+where+uncited+`
		ORDER BY ap.created_at DESC
		LIMIT $`+Itoa(argIdx)+` OFFSET $`+Itoa(argIdx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]UncitedItem, 0, limit)
	for rows.Next() {
		var it UncitedItem
		if err := rows.Scan(&it.ID, &it.Name, &it.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

// ===== 能力域 =====
