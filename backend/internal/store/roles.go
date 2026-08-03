package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type RolesStore struct {
	beginner txBeginner
	*DictStore[domain.Role]
}

func NewRolesStore(q Queryer, beginner txBeginner) *RolesStore {
	return &RolesStore{
		beginner: beginner,
		DictStore: NewDictStore(q, DictConfig[domain.Role]{
			Table:         "roles",
			SelectColumns: "id, tenant_id, code, name, description, permissions, user_count, status, created_at",
			CreateSQL:     `INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status) VALUES ($1,$2,$3,$4,$5,$6,0,'active')`,
			UpdateSQL:     `UPDATE roles SET name=$1, description=$2, permissions=$3 WHERE id=$4`,
			GetByIDSQL:    `SELECT id, tenant_id, code, name, description, permissions, user_count, status, created_at FROM roles WHERE id = $1`,
			DeleteSQL:     `DELETE FROM roles WHERE id = $1`,
			TenantScoped:  true,
			SearchColumns: []string{"name", "code"},
			ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
				if status := p.Values["status"]; status != "" {
					qb.AddCondition("status = " + qb.NextArg(status))
				}
			},
		}),
	}
}

type RoleCreateParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Permissions domain.JSONMap
}

func (p RoleCreateParams) Tenant() string { return p.TenantID }

func (p RoleCreateParams) Args() []any {
	return []any{p.Code, p.Name, p.Description, p.Permissions}
}

type RoleUpdateParams struct {
	Name        string
	Description *string
	Permissions domain.JSONMap
}

func (p RoleUpdateParams) Args() []any {
	return []any{p.Name, p.Description, p.Permissions}
}

// Delete 事务级联删除：先删 user_roles 引用，再删角色本体。
func (s *RolesStore) Delete(ctx context.Context, id string) error {
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE role_id = $1`, id); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM roles WHERE id = $1`, id); err != nil {
			return err
		}
		return nil
	})
}

// UserTenantID 查询用户所属租户（分配角色前的归属校验用）。
func (s *RolesStore) UserTenantID(ctx context.Context, userID string) (string, error) {
	var tenantID string
	err := s.Q().QueryRow(ctx, `SELECT tenant_id FROM users WHERE id = $1`, userID).Scan(&tenantID)
	return tenantID, err
}

// Assign 为用户分配角色，维护 user_count 计数。
func (s *RolesStore) Assign(ctx context.Context, tenantID, roleID, userID string) error {
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`INSERT INTO user_roles (role_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
			roleID, userID,
		)
		if err != nil {
			return err
		}
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(ctx,
				`UPDATE roles SET user_count = user_count + 1 WHERE id = $1 AND tenant_id = $2`,
				roleID, tenantID,
			); err != nil {
				return err
			}
		}
		return nil
	})
}
