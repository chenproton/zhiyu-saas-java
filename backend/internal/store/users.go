package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// UserStore 提供用户管理的持久化访问，SQL 全部收敛于此。
type UserStore struct {
	q        Queryer
	beginner txBeginner
}

// NewUserStore 创建用户 store。
func NewUserStore(q Queryer, beginner txBeginner) *UserStore {
	return &UserStore{q: q, beginner: beginner}
}

// List 按租户范围分页查询用户。
func (s *UserStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.User]) ([]domain.User, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanUserRows)
}

// ListConfig 返回用户列表查询配置（含角色过滤 EXISTS 与组织子树递归 CTE），SQL 片段沉淀在 store 层。
func (s *UserStore) ListConfig() ListQueryConfig[domain.User] {
	return ListQueryConfig[domain.User]{
		Table:         "users",
		SelectColumns: "id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name, username, name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"username", "name", "email"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if institutionID := p.Values["institutionId"]; institutionID != "" {
				qb.AddCondition("institution_id = " + qb.NextArg(institutionID))
			}
			if roleID := p.Values["roleId"]; roleID != "" {
				qb.AddCondition("EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role_id = " + qb.NextArg(roleID) + ")")
			}
			if roleCode := p.Values["roleCode"]; roleCode != "" {
				qb.AddCondition("EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = users.id AND r2.code = " + qb.NextArg(roleCode) + ")")
			}
			if orgNodeID := p.Values["orgNodeId"]; orgNodeID != "" {
				qb.AddCondition("org_node_id IN (WITH RECURSIVE org_subtree AS (SELECT id FROM organizations WHERE id = " + qb.NextArg(orgNodeID) + " UNION ALL SELECT o.id FROM organizations o JOIN org_subtree st ON o.parent_id = st.id) SELECT id FROM org_subtree)")
			}
			if titleID := p.Values["titleId"]; titleID != "" {
				qb.AddCondition("title_ids @> ARRAY[" + qb.NextArg(titleID) + "]::uuid[]")
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
}

// Get 按 ID 查询用户（含平台字段）。
func (s *UserStore) Get(ctx context.Context, id string) (*domain.User, error) {
	u, err := s.fetchUser(ctx, s.q, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// Create 在事务内创建用户并绑定角色。
func (s *UserStore) Create(ctx context.Context, tx Queryer, p *UserCreateParams) (*domain.User, error) {
	id := uuid.NewString()
	hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	role := p.Role
	if role == "" {
		role = string(domain.UserRoleSchool)
	}
	platform := p.Platform
	if platform == "" {
		platform = string(domain.UserPlatformSaas)
	}
	rawLoginName := p.Username
	if p.LoginName != "" {
		rawLoginName = p.LoginName
	}
	globalLoginName := p.TenantID + "_" + rawLoginName

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, COALESCE($18::uuid[], '{}'::uuid[]), $19, 'active')
	`, id, p.TenantID, p.InstitutionID, p.OrgNodeID, p.MajorID,
		role, platform, globalLoginName, rawLoginName, string(hash), p.Name, p.Email, p.Phone, p.AvatarURL,
		p.StudentNo, p.WorkID, p.IDCard, p.TitleIDs, domain.JSONMap{}); err != nil {
		return nil, err
	}

	if err := s.ValidateOrgMajor(ctx, tx, p.TenantID, p.OrgNodeID, p.MajorID); err != nil {
		return nil, err
	}

	if p.RoleID != "" {
		var validRole bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1 AND tenant_id = $2)`, p.RoleID, p.TenantID).Scan(&validRole)
		if !validRole {
			return nil, fmt.Errorf("invalid roleId: role not in tenant")
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), id, p.RoleID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, p.RoleID); err != nil {
				return nil, err
			}
		}
	}

	return s.fetchUser(ctx, tx, id)
}

// Update 更新用户基础信息。
func (s *UserStore) Update(ctx context.Context, p *UserUpdateParams) error {
	// 部分更新兜底：指针字段未携带时保留原值（COALESCE），避免 PUT 全列覆盖清空
	_, err := s.q.Exec(ctx, `
		UPDATE users SET institution_id = COALESCE($1, institution_id), org_node_id = COALESCE($2, org_node_id), major_id = COALESCE($3, major_id),
			role = $4, login_name = $5, username = $6, name = $7, email = COALESCE($8, email), phone = COALESCE($9, phone), avatar_url = COALESCE($10, avatar_url),
			student_no = COALESCE($11, student_no), work_id = COALESCE($12, work_id), id_card = COALESCE($13, id_card), title_ids = COALESCE($14::uuid[], '{}'::uuid[]), updated_at = NOW()
		WHERE id = $15
	`, p.InstitutionID, p.OrgNodeID, p.MajorID,
		p.Role, p.GlobalLoginName, p.Username, p.Name, p.Email, p.Phone, p.AvatarURL,
		p.StudentNo, p.WorkID, p.IDCard, p.TitleIDs, p.ID)
	return err
}

// UpdateSelfName 用户自助修改本人姓名。
func (s *UserStore) UpdateSelfName(ctx context.Context, id, name string) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`, name, id)
	return err
}

// UpdateStatus 更新用户状态。
func (s *UserStore) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

// ResetPassword 重置用户密码。
func (s *UserStore) ResetPassword(ctx context.Context, id, plainPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.q.Exec(ctx, `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, string(hash), id)
	return err
}

// Delete 删除用户并递减其角色计数。
func (s *UserStore) Delete(ctx context.Context, id string) error {
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
			WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
		`, id); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
		return err
	})
}

// BatchGraduate 批量毕业（仅 active 用户）。
func (s *UserStore) BatchGraduate(ctx context.Context, tenantID string, userIDs []string, graduateYear int) error {
	uuids := parseUUIDs(userIDs)
	_, err := s.q.Exec(ctx,
		`UPDATE users SET status = 'graduated', graduate_year = $1, updated_at = NOW()
		 WHERE id = ANY($2::uuid[]) AND tenant_id = $3 AND status = 'active'`,
		graduateYear, uuids, tenantID)
	return err
}

// BatchDelete 批量删除用户（限定租户），返回删除计数。
func (s *UserStore) BatchDelete(ctx context.Context, tenantID string, userIDs []string) (int64, error) {
	uuids := parseUUIDs(userIDs)
	var deleted int64
	err := withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`DELETE FROM user_roles WHERE user_id = ANY($1::uuid[]) AND user_id IN (
				SELECT id FROM users WHERE tenant_id = $2 AND id = ANY($1::uuid[])
			)`, uuids, tenantID)
		if err != nil {
			return err
		}
		result, err := tx.Exec(ctx,
			`DELETE FROM users WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
			uuids, tenantID)
		if err != nil {
			return err
		}
		deleted = result.RowsAffected() + tag.RowsAffected()
		return nil
	})
	return deleted, err
}

// BatchUpdateOrgNode 批量更新/清空用户组织节点。
func (s *UserStore) BatchUpdateOrgNode(ctx context.Context, tenantID string, userIDs []string, orgNodeID *string) (int64, error) {
	uuids := parseUUIDs(userIDs)
	result, err := s.q.Exec(ctx,
		`UPDATE users SET org_node_id = $1, updated_at = NOW()
		 WHERE id = ANY($2::uuid[]) AND tenant_id = $3`,
		orgNodeID, uuids, tenantID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// OrgNodeExists 校验组织节点归属。
func (s *UserStore) OrgNodeExists(ctx context.Context, orgNodeID, tenantID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND tenant_id = $2)`,
		orgNodeID, tenantID).Scan(&exists)
	return exists, err
}

// ValidateRolesInTenant 校验角色是否都属于租户。
func (s *UserStore) ValidateRolesInTenant(ctx context.Context, roleIDs []string, tenantID string) (bool, error) {
	var validCount int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM roles WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
		roleIDs, tenantID).Scan(&validCount)
	return validCount == len(roleIDs), err
}

// BindRoles 在事务内替换用户的全部角色绑定。
func (s *UserStore) BindRoles(ctx context.Context, tx Queryer, userID string, roleIDs []string) error {
	if _, err := tx.Exec(ctx, `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return err
	}
	inserted := make([]string, 0, len(roleIDs))
	for _, roleID := range roleIDs {
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), userID, roleID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() > 0 {
			inserted = append(inserted, roleID)
		}
	}
	if len(inserted) > 0 {
		if _, err := tx.Exec(ctx,
			`UPDATE roles SET user_count = user_count + 1 WHERE id = ANY($1::uuid[])`,
			inserted); err != nil {
			return err
		}
	}
	return nil
}

// RebindUserRole 替换为单个角色（用于 Update 时的 roleId 变更）。
func (s *UserStore) RebindUserRole(ctx context.Context, userID, roleID string, tenantID string) error {
	var validRole bool
	_ = s.q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1 AND tenant_id = $2)`, roleID, tenantID).Scan(&validRole)
	if !validRole {
		return fmt.Errorf("角色 ID 无效：该角色不属于当前租户")
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, userID); err != nil {
		return err
	}
	if _, err := s.q.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := s.q.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, role_id) DO NOTHING
	`, uuid.NewString(), userID, roleID); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, roleID)
	return err
}

// AttachUserRoles 为批量用户填充角色信息。
func (s *UserStore) AttachUserRoles(ctx context.Context, items []domain.User) {
	if len(items) == 0 {
		return
	}
	ids := make([]string, 0, len(items))
	index := make(map[string]int, len(items))
	for i, u := range items {
		ids = append(ids, u.ID)
		index[u.ID] = i
	}
	rows, err := s.q.Query(ctx, `
		SELECT ur.user_id, r.id, r.code, r.name
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = ANY($1::uuid[])
		ORDER BY r.created_at
	`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var userID, roleID, code, name string
		if err := rows.Scan(&userID, &roleID, &code, &name); err != nil {
			continue
		}
		if i, ok := index[userID]; ok {
			items[i].RoleIDs = append(items[i].RoleIDs, roleID)
			items[i].RoleCodes = append(items[i].RoleCodes, code)
			items[i].RoleNames = append(items[i].RoleNames, name)
		}
	}
}

// ValidateOrgMajor 校验组织与专业归属（在事务内执行）。
func (s *UserStore) ValidateOrgMajor(ctx context.Context, q Queryer, tenantID string, orgNodeID, majorID *string) error {
	if tenantID == "" {
		return nil
	}
	if orgNodeID != nil && *orgNodeID != "" {
		var exists bool
		err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND tenant_id = $2)`, *orgNodeID, tenantID).Scan(&exists)
		if err != nil || !exists {
			return fmt.Errorf("无效机构节点ID")
		}
	}
	if majorID != nil && *majorID != "" {
		var exists bool
		err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM majors WHERE id = $1 AND tenant_id = $2)`, *majorID, tenantID).Scan(&exists)
		if err != nil || !exists {
			return fmt.Errorf("专业 ID 无效")
		}
	}
	return nil
}

// UserCreateParams 创建用户参数。
type UserCreateParams struct {
	TenantID      string
	InstitutionID *string
	OrgNodeID     *string
	MajorID       *string
	Role          string
	RoleID        string
	Platform      string
	Username      string
	LoginName     string
	Password      string
	Name          string
	Email         *string
	Phone         *string
	AvatarURL     *string
	StudentNo     *string
	WorkID        *string
	IDCard        *string
	TitleIDs      []string
}

// UserUpdateParams 更新用户参数。
type UserUpdateParams struct {
	ID              string
	InstitutionID   *string
	OrgNodeID       *string
	MajorID         *string
	Role            string
	GlobalLoginName string
	Username        string
	Name            string
	Email           *string
	Phone           *string
	AvatarURL       *string
	StudentNo       *string
	WorkID          *string
	IDCard          *string
	TitleIDs        []string
}

// rowScanner 抽象 pgx.Row 与 pgx.Rows 共有的 Scan 能力。
type rowScanner interface {
	Scan(dest ...any) error
}

// scanUser 将 users 表一行扫描为 domain.User；withPasswordHash 表示查询结果包含
// password_hash 列。返回的 passwordHash 仅在 withPasswordHash 时有值。
func scanUser(s rowScanner, withPasswordHash bool) (domain.User, string, error) {
	var user domain.User
	var tenantID, institutionID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
	var titleIDs []string
	var oauth domain.JSONMap
	var passwordHash string
	targets := []any{
		&user.ID, &tenantID, &institutionID, &orgNodeID, &majorID,
		&user.Role, &user.Platform, &loginName, &user.Username,
	}
	if withPasswordHash {
		targets = append(targets, &passwordHash)
	}
	targets = append(targets,
		&user.Name, &user.Email, &phone, &avatarURL, &studentNo, &workID, &idCard,
		&titleIDs, &oauth, &user.Status, &user.GraduateYear, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err := s.Scan(targets...); err != nil {
		return user, "", err
	}
	user.TenantID = tenantID
	user.InstitutionID = institutionID
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
	return user, passwordHash, nil
}

func (s *UserStore) fetchUser(ctx context.Context, q Queryer, id string) (*domain.User, error) {
	user, passwordHash, err := scanUser(q.QueryRow(ctx, `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id), true)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = passwordHash
	return &user, nil
}

func scanUserRows(rows pgx.Rows) ([]domain.User, error) {
	items := make([]domain.User, 0)
	for rows.Next() {
		user, _, err := scanUser(rows, false)
		if err != nil {
			return nil, err
		}
		items = append(items, user)
	}
	return items, nil
}

func parseUUIDs(ids []string) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uid, err := uuid.Parse(id)
		if err == nil {
			out = append(out, uid)
		}
	}
	return out
}

// ListProfiles 批量查询学生班级/专业信息。
func (s *UserStore) ListProfiles(ctx context.Context, userIDs []string) (map[string]UserProfile, error) {
	rows, err := s.q.Query(ctx, `
		SELECT u.id, COALESCE(o.name, ''), u.major_id, COALESCE(m.name, '')
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = ANY($1)
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	profiles := make(map[string]UserProfile)
	for rows.Next() {
		var id string
		var p UserProfile
		if err := rows.Scan(&id, &p.ClassName, &p.MajorID, &p.MajorName); err != nil {
			return nil, err
		}
		profiles[id] = p
	}
	return profiles, rows.Err()
}
