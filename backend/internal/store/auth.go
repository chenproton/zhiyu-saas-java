package store

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// AuthStore 认证相关查询持久化。
type AuthStore struct {
	q Queryer
}

// NewAuthStore 创建认证 store。
func NewAuthStore(q Queryer) *AuthStore {
	return &AuthStore{q: q}
}

// LoginUserRow 登录候选行。
type LoginUserRow struct {
	User   domain.User
	Tenant domain.Tenant
}

// FindUsersByUsername 按用户名+平台查询用户（含租户名）。
func (s *AuthStore) FindUsersByUsername(ctx context.Context, username string, platform domain.UserPlatform) ([]LoginUserRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT u.id, u.tenant_id, u.institution_id, u.org_node_id, u.major_id,
		       u.role, u.platform, u.login_name, u.username, u.password_hash, u.name, u.email,
		       u.phone, u.avatar_url, u.student_no, u.work_id, u.id_card, u.title_ids, u.oauth,
		       u.status, u.created_at, u.updated_at,
		       t.name as tenant_name
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE u.username = $1 AND u.platform = $2
	`, username, platform)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LoginUserRow
	for rows.Next() {
		var u LoginUserRow
		var tenantID, orgNodeID, majorID, loginName *string
		var phone, avatarURL, studentNo, workID, idCard *string
		var titleIDs []string
		var oauth domain.JSONMap
		if err := rows.Scan(
			&u.User.ID, &tenantID, &u.User.InstitutionID, &orgNodeID, &majorID,
			&u.User.Role, &u.User.Platform, &loginName, &u.User.Username, &u.User.PasswordHash, &u.User.Name, &u.User.Email,
			&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &u.User.Status,
			&u.User.CreatedAt, &u.User.UpdatedAt, &u.Tenant.Name,
		); err != nil {
			continue
		}
		u.User.TenantID = tenantID
		u.User.OrgNodeID = orgNodeID
		u.User.MajorID = majorID
		u.User.LoginName = loginName
		u.User.Phone = phone
		u.User.AvatarURL = avatarURL
		u.User.StudentNo = studentNo
		u.User.WorkID = workID
		u.User.IDCard = idCard
		u.User.TitleIDs = titleIDs
		u.User.Oauth = oauth
		if tenantID != nil {
			u.Tenant.ID = *tenantID
		}
		items = append(items, u)
	}
	return items, rows.Err()
}

// UpdateLastLogin 更新最后登录时间。
func (s *AuthStore) UpdateLastLogin(ctx context.Context, userID string, t time.Time) {
	_, _ = s.q.Exec(ctx, `UPDATE users SET last_login_at = $1 WHERE id = $2`, t, userID)
}

// RecordLoginLog 记录登录日志。
func (s *AuthStore) RecordLoginLog(ctx context.Context, tenantID, userID, userName, ip, device, status string) {
	_, _ = s.q.Exec(ctx, `
		INSERT INTO login_logs (tenant_id, user_id, user_name, ip, device, status)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, tenantID, userID, userName, ip, device, status)
}

// GetUserByID 查询用户。
func (s *AuthStore) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	var tenantID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
	var titleIDs []string
	var oauth domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
		       role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
		       student_no, work_id, id_card, title_ids, oauth, status, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &tenantID, &user.InstitutionID, &orgNodeID, &majorID,
		&user.Role, &user.Platform, &loginName, &user.Username, &user.PasswordHash, &user.Name, &user.Email,
		&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &user.Status,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	user.TenantID = tenantID
	user.OrgNodeID = orgNodeID
	user.MajorID = majorID
	user.LoginName = loginName
	user.Phone = phone
	user.AvatarURL = avatarURL
	user.StudentNo = studentNo
	user.WorkID = workID
	user.IDCard = idCard
	user.TitleIDs = titleIDs
	user.Oauth = oauth
	return &user, nil
}

// GetInstitution 查询机构（含标签）。
func (s *AuthStore) GetInstitution(ctx context.Context, id string) (*domain.Institution, error) {
	var inst domain.Institution
	err := s.q.QueryRow(ctx, `
		SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email,
		       qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at
		FROM institutions WHERE id = $1
	`, id).Scan(
		&inst.ID, &inst.Type, &inst.Name, &inst.CreditCode, &inst.Logo, &inst.Intro,
		&inst.ContactName, &inst.ContactPhone, &inst.ContactEmail, &inst.QualificationFile,
		&inst.Status, &inst.OrgCode, &inst.Balance, &inst.TotalSpent, &inst.TotalIncome,
		&inst.CreatedAt, &inst.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	tags, _ := s.ListInstitutionTags(ctx, inst.ID)
	inst.ExpertiseTags = tags
	return &inst, nil
}

// ListInstitutionTags 机构标签。
func (s *AuthStore) ListInstitutionTags(ctx context.Context, institutionID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `SELECT tag_value FROM institution_expertise_tags WHERE institution_id = $1 ORDER BY tag_value`, institutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			continue
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

// GetTenantByID 查询租户。
func (s *AuthStore) GetTenantByID(ctx context.Context, id string) *domain.Tenant {
	var t domain.Tenant
	var logo, domainVal, enterpriseCode, contact, phone, address, description *string
	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, admin_ids, status, created_at, updated_at
		FROM tenants WHERE id = $1
	`, id).Scan(
		&t.ID, &t.Name, &t.Code, &logo, &domainVal, &enterpriseCode, &contact, &phone, &address, &description,
		&t.AdminIDs, &t.Status, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil
	}
	t.LogoURL = logo
	t.Domain = domainVal
	t.EnterpriseCode = enterpriseCode
	t.Contact = contact
	t.Phone = phone
	t.Address = address
	t.Description = description
	return &t
}

// GetOrganizationByID 查询组织。
func (s *AuthStore) GetOrganizationByID(ctx context.Context, id string) *domain.Organization {
	var o domain.Organization
	var parentID *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations WHERE id = $1
	`, id).Scan(
		&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil
	}
	o.ParentID = parentID
	return &o
}

// GetMajorByID 查询专业。
func (s *AuthStore) GetMajorByID(ctx context.Context, id string) *domain.Major {
	var m domain.Major
	var alias *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at
		FROM majors WHERE id = $1
	`, id).Scan(&m.ID, &m.TenantID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil
	}
	m.Alias = alias
	return &m
}

// ListUserRoles 用户角色。
func (s *AuthStore) ListUserRoles(ctx context.Context, userID string) []domain.Role {
	rows, err := s.q.Query(ctx, `
		SELECT r.id, r.tenant_id, r.code, r.name, r.description, r.permissions, r.user_count, r.status, r.created_at
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var items []domain.Role
	for rows.Next() {
		var r domain.Role
		var description *string
		var permissions domain.JSONMap
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Code, &r.Name, &description, &permissions, &r.UserCount, &r.Status, &r.CreatedAt); err != nil {
			continue
		}
		r.Description = description
		r.Permissions = permissions
		items = append(items, r)
	}
	return items
}

// ListUserRoleCodes 用户角色编码。
func (s *AuthStore) ListUserRoleCodes(ctx context.Context, userID string) []string {
	rows, err := s.q.Query(ctx, `
		SELECT r.code
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
		ORDER BY r.created_at
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			continue
		}
		items = append(items, code)
	}
	return items
}
