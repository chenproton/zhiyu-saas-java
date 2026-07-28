package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type RolesStore struct {
	DB *pgxpool.Pool
}

func NewRolesStore(db *pgxpool.Pool) *RolesStore {
	return &RolesStore{DB: db}
}

type RoleCreateParams struct {
	TenantID    string
	Code        string
	Name        string
	Description *string
	Permissions domain.JSONMap
}

type RoleUpdateParams struct {
	Name        string
	Description *string
	Permissions domain.JSONMap
}

func (s *RolesStore) GetByID(ctx context.Context, id string) (domain.Role, error) {
	var r domain.Role
	var desc *string
	err := s.DB.QueryRow(ctx,
		`SELECT id, tenant_id, code, name, description, permissions, user_count, status, created_at FROM roles WHERE id = $1`, id,
	).Scan(&r.ID, &r.TenantID, &r.Code, &r.Name, &desc, &r.Permissions, &r.UserCount, &r.Status, &r.CreatedAt)
	if err != nil {
		return r, err
	}
	r.Description = desc
	return r, nil
}

func (s *RolesStore) Create(ctx context.Context, p RoleCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.DB.Exec(ctx,
		`INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status) VALUES ($1,$2,$3,$4,$5,$6,0,'active')`,
		id, p.TenantID, p.Code, p.Name, p.Description, p.Permissions,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *RolesStore) Update(ctx context.Context, id string, p RoleUpdateParams) error {
	_, err := s.DB.Exec(ctx,
		`UPDATE roles SET name=$1, description=$2, permissions=$3 WHERE id=$4`,
		p.Name, p.Description, p.Permissions, id,
	)
	return err
}

func (s *RolesStore) Delete(ctx context.Context, id string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE role_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM roles WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *RolesStore) Assign(ctx context.Context, tenantID, roleID, userID string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO user_roles (role_id, user_id, tenant_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
		roleID, userID, tenantID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE roles SET user_count = user_count + 1 WHERE id = $1 AND tenant_id = $2`,
		roleID, tenantID,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *RolesStore) ScanRows(rows pgx.Rows) ([]domain.Role, error) {
	items := make([]domain.Role, 0)
	for rows.Next() {
		var r domain.Role
		var desc *string
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Code, &r.Name, &desc, &r.Permissions, &r.UserCount, &r.Status, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Description = desc
		items = append(items, r)
	}
	return items, nil
}
