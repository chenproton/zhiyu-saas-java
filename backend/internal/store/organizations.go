package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// OrganizationStore 提供组织机构的持久化访问。
type OrganizationStore struct {
	q Queryer
}

// NewOrganizationStore 创建组织 store。
func NewOrganizationStore(q Queryer) *OrganizationStore {
	return &OrganizationStore{q: q}
}

// List 按租户范围分页查询组织。
func (s *OrganizationStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Organization]) ([]domain.Organization, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanOrgRows)
}

// ListConfig 返回组织列表查询配置，SQL 片段沉淀在 store 层。
func (s *OrganizationStore) ListConfig() ListQueryConfig[domain.Organization] {
	return ListQueryConfig[domain.Organization]{
		Table:         "organizations",
		SelectColumns: "id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at ASC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if typeID := p.Values["typeId"]; typeID != "" {
				qb.AddCondition("type_id = " + qb.NextArg(typeID))
			}
			if parentID := p.Values["parentId"]; parentID != "" {
				qb.AddCondition("parent_id = " + qb.NextArg(parentID))
			} else if p.Values["rootOnly"] == "true" {
				qb.AddCondition("parent_id IS NULL")
			}
		},
	}
}

// Tree 查询租户下全部组织（用于构建树）。
func (s *OrganizationStore) Tree(ctx context.Context, tenantID string) ([]domain.Organization, error) {
	query := `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations
	`
	args := []any{}
	if tenantID != "" {
		query += " WHERE tenant_id = $1"
		args = append(args, tenantID)
	} else {
		// 纵深防御：无租户时不返回全库组织树
		query += " WHERE 1=0"
	}
	query += " ORDER BY sort_order ASC, created_at ASC"
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrgRows(rows)
}

// MemberCounts 统计每个组织的直接成员数。
func (s *OrganizationStore) MemberCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	query := `SELECT org_node_id, COUNT(*) FROM users WHERE org_node_id IS NOT NULL`
	args := []any{}
	if tenantID != "" {
		query += ` AND tenant_id = $1`
		args = append(args, tenantID)
	}
	query += ` GROUP BY org_node_id`

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var orgID string
		var count int
		if err := rows.Scan(&orgID, &count); err != nil {
			return nil, err
		}
		counts[orgID] = count
	}
	return counts, rows.Err()
}

// Get 按 ID 查询组织。
func (s *OrganizationStore) Get(ctx context.Context, id string) (*domain.Organization, error) {
	o, err := s.fetchOrg(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return o, nil
}

// Create 新建组织。
func (s *OrganizationStore) Create(ctx context.Context, tenantID string, p *OrgCreateParams) (*domain.Organization, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
		VALUES ($1, $2, $3, $4, $5, $6, 0)
	`, id, tenantID, p.Name, p.TypeID, p.ParentID, p.SortOrder)
	if err != nil {
		return nil, err
	}
	return s.fetchOrg(ctx, id)
}

// Update 更新组织。
func (s *OrganizationStore) Update(ctx context.Context, id string, p *OrgUpdateParams) (*domain.Organization, error) {
	if _, err := s.fetchOrg(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE organizations SET name = $1, type_id = $2, parent_id = $3, sort_order = $4, updated_at = NOW()
		WHERE id = $5
	`, p.Name, p.TypeID, p.ParentID, p.SortOrder, id)
	if err != nil {
		return nil, err
	}
	return s.fetchOrg(ctx, id)
}

// IsDescendant 判断 candidateID 是否是 id 的后代（防环）。
func (s *OrganizationStore) IsDescendant(ctx context.Context, id, candidateID string) (bool, error) {
	var isDesc bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(
			WITH RECURSIVE subtree AS (
				SELECT id, parent_id FROM organizations WHERE id = $1
				UNION ALL
				SELECT o.id, o.parent_id FROM organizations o JOIN subtree s ON o.parent_id = s.id
			)
			SELECT 1 FROM subtree WHERE id = $2
		)`, id, candidateID).Scan(&isDesc)
	return isDesc, err
}

// OrgTypeExists 校验组织类型归属。
func (s *OrganizationStore) OrgTypeExists(ctx context.Context, typeID, tenantID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM org_types WHERE id = $1 AND tenant_id = $2)`,
		typeID, tenantID).Scan(&exists)
	return exists, err
}

// DeleteSubtree 在事务内删除组织及其后代，并解绑用户。
func (s *OrganizationStore) DeleteSubtree(ctx context.Context, tx Queryer, id, tenantID string, subtreeIDs []string) error {
	uuids := make([]any, 0, len(subtreeIDs))
	args := make([]any, 0, len(subtreeIDs)+1)
	for _, sid := range subtreeIDs {
		uid, err := uuid.Parse(sid)
		if err != nil {
			return err
		}
		args = append(args, uid)
		uuids = append(uuids, uid)
	}
	// 生成 $1..$N 占位符 + 租户参数
	ph := make([]byte, 0, len(args)*4)
	for i := range args {
		if i > 0 {
			ph = append(ph, ',')
		}
		ph = append(ph, []byte("$"+Itoa(i+1))...)
	}
	tenantPh := "$" + Itoa(len(args)+1)
	args = append(args, tenantID)

	if _, err := tx.Exec(ctx, `
		UPDATE users SET org_node_id = NULL, updated_at = NOW()
		WHERE org_node_id = ANY(ARRAY[`+string(ph)+`]::uuid[]) AND tenant_id = `+tenantPh,
		args...); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM organizations WHERE id = ANY(ARRAY[`+string(ph)+`]::uuid[]) AND tenant_id = `+tenantPh,
		args...); err != nil {
		return err
	}
	return nil
}

// SubtreeIDs 收集组织及其全部后代 ID（限定租户）。
func (s *OrganizationStore) SubtreeIDs(ctx context.Context, id, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		WITH RECURSIVE subtree AS (
			SELECT id, parent_id FROM organizations WHERE id = $1 AND tenant_id = $2
			UNION ALL
			SELECT o.id, o.parent_id FROM organizations o
			JOIN subtree s ON o.parent_id = s.id
			WHERE o.tenant_id = $2
		)
		SELECT id FROM subtree
	`, id, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var subID string
		if err := rows.Scan(&subID); err != nil {
			return nil, err
		}
		ids = append(ids, subID)
	}
	return ids, rows.Err()
}

// OrgCreateParams 创建组织参数。
type OrgCreateParams struct {
	Name      string
	TypeID    string
	ParentID  *string
	SortOrder int
}

// OrgUpdateParams 更新组织参数。
type OrgUpdateParams struct {
	Name      string
	TypeID    string
	ParentID  *string
	SortOrder int
}

func (s *OrganizationStore) fetchOrg(ctx context.Context, id string) (*domain.Organization, error) {
	var o domain.Organization
	var parentID *string

	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations WHERE id = $1
	`, id).Scan(
		&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	o.ParentID = parentID
	return &o, nil
}

func scanOrgRows(rows pgx.Rows) ([]domain.Organization, error) {
	items := make([]domain.Organization, 0)
	for rows.Next() {
		var o domain.Organization
		var parentID *string
		if err := rows.Scan(
			&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, err
		}
		o.ParentID = parentID
		items = append(items, o)
	}
	return items, rows.Err()
}
