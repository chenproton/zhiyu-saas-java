package store

import (
	"context"

	"github.com/google/uuid"
)

// UserRelationItem 用户关系列表项。
type UserRelationItem struct {
	ID            string `json:"id"`
	InitiatorID   string `json:"initiatorId"`
	InitiatorName string `json:"initiatorName"`
	InitiatorDept string `json:"initiatorDept"`
	TargetID      string `json:"targetId"`
	TargetName    string `json:"targetName"`
	TargetDept    string `json:"targetDept"`
	RelationType  string `json:"relationType"`
	CreatedAt     string `json:"createdAt"`
}

// UserRelationStore 提供用户关系的持久化访问。
type UserRelationStore struct {
	q Queryer
}

// NewUserRelationStore 创建用户关系 store。
func NewUserRelationStore(q Queryer) *UserRelationStore {
	return &UserRelationStore{q: q}
}

// List 按租户分页查询用户关系。
func (s *UserRelationStore) List(ctx context.Context, tenantID, search string, limit, offset int) ([]UserRelationItem, int, error) {
	where := []string{"1=1"}
	args := []any{}
	argIdx := 1
	if tenantID != "" {
		where = append(where, "r.tenant_id = $"+Itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	} else {
		// 纵深防御：无租户时不返回全库关系
		where = append(where, "1=0")
	}
	if search != "" {
		where = append(where, "(init_u.name ILIKE $"+Itoa(argIdx)+" OR tgt_u.name ILIKE $"+Itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	cond := joinSQL(where, " AND ")

	countQuery := `SELECT COUNT(*) FROM user_relations r
		LEFT JOIN users init_u ON init_u.id = r.initiator_id
		LEFT JOIN users tgt_u ON tgt_u.id = r.target_id
		WHERE ` + cond
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit, offset = ClampLimitOffset(limit, offset, 50)
	args = append(args, limit, offset)
	query := `
		SELECT r.id, r.initiator_id, init_u.name, COALESCE(init_org.name, ''),
			r.target_id, tgt_u.name, COALESCE(tgt_org.name, ''),
			r.relation_type, r.created_at
		FROM user_relations r
		LEFT JOIN users init_u ON init_u.id = r.initiator_id
		LEFT JOIN organizations init_org ON init_org.id = COALESCE(r.initiator_org_node_id, init_u.org_node_id)
		LEFT JOIN users tgt_u ON tgt_u.id = r.target_id
		LEFT JOIN organizations tgt_org ON tgt_org.id = COALESCE(r.target_org_node_id, tgt_u.org_node_id)
		WHERE ` + cond + `
		ORDER BY r.created_at DESC
		LIMIT $` + Itoa(argIdx) + ` OFFSET $` + Itoa(argIdx+1)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []UserRelationItem{}
	for rows.Next() {
		var item UserRelationItem
		var createdAt any
		if err := rows.Scan(&item.ID, &item.InitiatorID, &item.InitiatorName, &item.InitiatorDept,
			&item.TargetID, &item.TargetName, &item.TargetDept,
			&item.RelationType, &createdAt); err != nil {
			return nil, 0, err
		}
		item.CreatedAt = fmtTime(createdAt)
		items = append(items, item)
	}
	return items, total, rows.Err()
}

// Get 查询单条用户关系（删除前归属校验用），返回发起者/目标用户 ID。
func (s *UserRelationStore) Get(ctx context.Context, id, tenantID string) (initiatorID, targetID string, err error) {
	err = s.q.QueryRow(ctx, `SELECT initiator_id, target_id FROM user_relations WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(&initiatorID, &targetID)
	return
}

// UsersExist 校验两个用户是否都属于租户。
func (s *UserRelationStore) UsersExist(ctx context.Context, tenantID string, userIDs []string) (bool, error) {
	var validUsers int
	err := s.q.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])
	`, tenantID, userIDs).Scan(&validUsers)
	return validUsers == len(userIDs), err
}

// Create 新建用户关系。
func (s *UserRelationStore) Create(ctx context.Context, tenantID string, p *UserRelationCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO user_relations (id, tenant_id, initiator_id, target_id, relation_type, description)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, p.InitiatorID, p.TargetID, p.RelationType, p.Description)
	if err != nil {
		return "", err
	}
	return id, nil
}

// Delete 删除用户关系，返回是否命中。
func (s *UserRelationStore) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := s.q.Exec(ctx,
		`DELETE FROM user_relations WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

// UserRelationCreateParams 创建用户关系参数。
type UserRelationCreateParams struct {
	InitiatorID  string
	TargetID     string
	RelationType string
	Description  *string
}

func fmtTime(v any) string {
	if t, ok := v.(interface{ Format(string) string }); ok {
		return t.Format("2006-01-02 15:04:05")
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return ""
}
