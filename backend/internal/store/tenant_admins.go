package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// TenantAdminItem 学校管理员信息。
type TenantAdminItem struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenantId"`
	Username    string     `json:"username"`
	LoginName   string     `json:"loginName"`
	Name        string     `json:"name"`
	Status      string     `json:"status"`
	NewPassword string     `json:"newPassword,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
}

// TenantAdminStore 提供租户管理员（school_admin / enterprise_admin）的持久化访问。
type TenantAdminStore struct {
	q Queryer
}

// NewTenantAdminStore 创建管理员 store。
func NewTenantAdminStore(q Queryer) *TenantAdminStore {
	return &TenantAdminStore{q: q}
}

// List 查询租户下指定角色的管理员（school_admin / enterprise_admin）。
func (s *TenantAdminStore) List(ctx context.Context, tenantID, roleCode string) ([]TenantAdminItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id = $1 AND r.code = $2
		ORDER BY u.created_at DESC
	`, tenantID, roleCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTenantAdmins(rows)
}

// Get 查询单个租户管理员（按角色）。
func (s *TenantAdminStore) Get(ctx context.Context, tenantID, adminID, roleCode string) (*TenantAdminItem, error) {
	item, err := s.fetchAdmin(ctx, tenantID, adminID, roleCode)
	if err != nil {
		return nil, err
	}
	return item, nil
}

// Create 在事务内创建租户管理员并绑定指定角色（school_admin / enterprise_admin）。
func (s *TenantAdminStore) Create(ctx context.Context, tx Queryer, tenantID, roleCode, role, platform, username, name, plainPassword string) (*TenantAdminItem, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	adminID := uuid.NewString()
	loginName := tenantID + "_" + username

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, NULL, NULL, NULL, $3, $4, $5, $6, $7, $8, NULL, NULL, NULL,
			NULL, NULL, NULL, '{}', '{}', 'active')
	`, adminID, tenantID, role, platform, loginName, username, string(hash), name); err != nil {
		return nil, err
	}
	roleTag, err := tx.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id)
		SELECT $1, $2, id FROM roles WHERE tenant_id = $3 AND code = $4 LIMIT 1
	`, uuid.NewString(), adminID, tenantID, roleCode)
	if err != nil {
		return nil, err
	}
	// 租户内不存在该角色时明确报错，避免管理员创建成功但无角色绑定的静默降级
	if roleTag.RowsAffected() == 0 {
		return nil, fmt.Errorf("租户内不存在角色: %s", roleCode)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE roles SET user_count = user_count + 1
		WHERE tenant_id = $1 AND code = $2
	`, tenantID, roleCode); err != nil {
		return nil, err
	}
	return s.fetchAdmin(ctx, tenantID, adminID, roleCode)
}

// Update 更新管理员用户名与姓名。
func (s *TenantAdminStore) Update(ctx context.Context, tenantID, adminID, username, name string) error {
	newLoginName := tenantID + "_" + username
	_, err := s.q.Exec(ctx, `
		UPDATE users SET username = $1, login_name = $2, name = $3, updated_at = NOW()
		WHERE id = $4 AND tenant_id = $5
	`, username, newLoginName, name, adminID, tenantID)
	return err
}

// Delete 在事务内删除管理员及其角色绑定，并更新角色计数与租户 admin_ids。
func (s *TenantAdminStore) Delete(ctx context.Context, tx Queryer, tenantID, adminID string) error {
	if _, err := tx.Exec(ctx, `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, adminID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, adminID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE tenants SET admin_ids = array_remove(admin_ids, $1::UUID)
		WHERE id = $2
	`, adminID, tenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1 AND tenant_id = $2`, adminID, tenantID); err != nil {
		return err
	}
	return nil
}

// ResetPassword 重置管理员密码，返回新密码。
func (s *TenantAdminStore) ResetPassword(ctx context.Context, adminID, plainPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.q.Exec(ctx, `
		UPDATE users SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(hash), adminID)
	return err
}

func (s *TenantAdminStore) fetchAdmin(ctx context.Context, tenantID, adminID, roleCode string) (*TenantAdminItem, error) {
	var admin TenantAdminItem
	var loginName *string
	var lastLoginAt *time.Time
	err := s.q.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1 AND u.tenant_id = $2 AND r.code = $3
	`, adminID, tenantID, roleCode).Scan(
		&admin.ID, &admin.TenantID, &admin.Username, &loginName, &admin.Name, &admin.Status, &lastLoginAt, &admin.CreatedAt, &admin.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if loginName != nil {
		admin.LoginName = *loginName
	}
	admin.LastLoginAt = lastLoginAt
	return &admin, nil
}

func scanTenantAdmins(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}) ([]TenantAdminItem, error) {
	items := make([]TenantAdminItem, 0)
	for rows.Next() {
		var a TenantAdminItem
		var loginName *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Username, &loginName, &a.Name, &a.Status, &a.LastLoginAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		if loginName != nil {
			a.LoginName = *loginName
		}
		items = append(items, a)
	}
	return items, rows.Err()
}
