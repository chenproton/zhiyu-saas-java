package store

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ErrDuplicateTagName 标签名称已存在（租户内唯一）。
var ErrDuplicateTagName = errors.New("duplicate tag name")

// isUniqueViolation 判断是否为唯一键冲突（store 层独立实现，不依赖 handler 包）。
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// TagStore 标签持久化：标签 CRUD、资源绑定关系维护、绑定批量查询。
// SQL 全部收敛于此。
type TagStore struct {
	q        Queryer
	beginner txBeginner
}

// NewTagStore 创建标签 store。
func NewTagStore(q Queryer, beginner txBeginner) *TagStore {
	return &TagStore{q: q, beginner: beginner}
}

// List 查询租户全部标签，附带各自绑定的资源数量。
func (s *TagStore) List(ctx context.Context, tenantID string) ([]domain.TagItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT t.id, t.tenant_id, t.name, t.color, t.created_at, t.updated_at,
		       COALESCE(cnt.cnt, 0) AS resource_count
		FROM tags t
		LEFT JOIN (
			SELECT tag_id, COUNT(*) AS cnt
			FROM resource_tag_relations
			WHERE tenant_id = $1
			GROUP BY tag_id
		) cnt ON cnt.tag_id = t.id
		WHERE t.tenant_id = $1
		ORDER BY t.created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.TagItem, 0)
	for rows.Next() {
		var t domain.TagItem
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt, &t.ResourceCount); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

// Create 创建标签，返回完整记录；名称重复返回 ErrDuplicateTagName。
func (s *TagStore) Create(ctx context.Context, tenantID, name, color string) (*domain.TagItem, error) {
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO tags (id, tenant_id, name, color)
		VALUES ($1, $2, $3, $4)
	`, id, tenantID, name, color); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicateTagName
		}
		return nil, err
	}
	return s.get(ctx, id)
}

// Update 更新标签名称/颜色；名称重复返回 ErrDuplicateTagName。
func (s *TagStore) Update(ctx context.Context, tenantID, id, name, color string) (*domain.TagItem, error) {
	if _, err := s.q.Exec(ctx, `
		UPDATE tags SET name = $1, color = $2, updated_at = NOW()
		WHERE id = $3 AND tenant_id = $4
	`, name, color, id, tenantID); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicateTagName
		}
		return nil, err
	}
	return s.get(ctx, id)
}

// Delete 删除标签，绑定关系由 FK ON DELETE CASCADE 自动清理。
func (s *TagStore) Delete(ctx context.Context, tenantID, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM tags WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// SetResourceTags 全量替换某资源的标签绑定（事务：先删后插，幂等）。
func (s *TagStore) SetResourceTags(ctx context.Context, tenantID, resourceType, resourceID string, tagIDs []string) error {
	if s.beginner == nil {
		return errors.New("tag store requires transaction beginner")
	}
	dedup := make(map[string]struct{}, len(tagIDs))
	for _, id := range tagIDs {
		if id != "" {
			dedup[id] = struct{}{}
		}
	}
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			DELETE FROM resource_tag_relations
			WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
		`, tenantID, resourceType, resourceID); err != nil {
			return err
		}
		for id := range dedup {
			if _, err := tx.Exec(ctx, `
				INSERT INTO resource_tag_relations (id, tenant_id, tag_id, resource_type, resource_id)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (tenant_id, resource_type, resource_id, tag_id) DO NOTHING
			`, uuid.NewString(), tenantID, id, resourceType, resourceID); err != nil {
				return err
			}
		}
		return nil
	})
}

// QueryBindings 批量查询资源绑定关系（一页资源一次 IN 查询，供列表页标签展示）。
func (s *TagStore) QueryBindings(ctx context.Context, tenantID, resourceType string, resourceIDs []string) ([]domain.ResourceTagRelation, error) {
	ids := make([]string, 0, len(resourceIDs))
	seen := make(map[string]struct{}, len(resourceIDs))
	for _, id := range resourceIDs {
		if id != "" {
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				ids = append(ids, id)
			}
		}
	}
	out := make([]domain.ResourceTagRelation, 0, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT rtr.resource_id, t.id, t.tenant_id, t.name, t.color, t.created_at, t.updated_at
		FROM resource_tag_relations rtr
		JOIN tags t ON t.id = rtr.tag_id
		WHERE rtr.tenant_id = $1 AND rtr.resource_type = $2 AND rtr.resource_id = ANY($3)
		ORDER BY t.created_at DESC
	`, tenantID, resourceType, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	bucket := make(map[string][]domain.TagItem, len(ids))
	for rows.Next() {
		var resourceID string
		var t domain.TagItem
		if err := rows.Scan(&resourceID, &t.ID, &t.TenantID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		bucket[resourceID] = append(bucket[resourceID], t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, id := range ids {
		if tags, ok := bucket[id]; ok {
			out = append(out, domain.ResourceTagRelation{ResourceID: id, Tags: tags})
		}
	}
	return out, nil
}

func (s *TagStore) get(ctx context.Context, id string) (*domain.TagItem, error) {
	var t domain.TagItem
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, color, created_at, updated_at
		FROM tags WHERE id = $1
	`, id).Scan(&t.ID, &t.TenantID, &t.Name, &t.Color, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// DeleteResourceTags 清理某资源（多态）的全部标签绑定。
// 供各资源 store 的 Delete 复用：resource_id 为全局唯一 uuid，无需 tenant 条件。
func DeleteResourceTags(ctx context.Context, q Queryer, resourceType, resourceID string) error {
	_, err := q.Exec(ctx, `
		DELETE FROM resource_tag_relations
		WHERE resource_type = $1 AND resource_id = $2
	`, resourceType, resourceID)
	return err
}

// SplitTagIDs 解析逗号分隔的 tagIds 查询参数为去重后的 id 列表。
func SplitTagIDs(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			if _, ok := seen[p]; !ok {
				seen[p] = struct{}{}
				out = append(out, p)
			}
		}
	}
	return out
}

// AddTagFilter 向列表查询追加"资源绑定了任一选中标签"的条件（多选 OR 语义）。
// resourceIDCol 为主查询表中资源 ID 列的限定引用（无别名表传 "id"）。
// 供各列表 store 的 ExtraFilter 复用，SQL 片段沉淀于本文件。
func AddTagFilter(qb *ListQueryBuilder, tenantID, resourceType, resourceIDCol string, tagIDs []string) {
	if len(tagIDs) == 0 {
		return
	}
	ph := qb.NextArg(tenantID, resourceType, tagIDs)
	parts := strings.Split(ph, ",")
	qb.AddCondition("EXISTS (SELECT 1 FROM resource_tag_relations rtr WHERE rtr.tenant_id = " + parts[0] +
		" AND rtr.resource_type = " + parts[1] +
		" AND rtr.resource_id = " + resourceIDCol +
		" AND rtr.tag_id = ANY(" + parts[2] + "))")
}
