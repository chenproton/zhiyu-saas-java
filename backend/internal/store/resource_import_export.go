package store

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 资源导入/导出 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====
// 全部方法接受 Queryer（*pgxpool.Pool / pgx.Tx），供导入事务复用；
// SQL 与原 handler 直查完全一致（参数化、租户条件、错误语义不变）。

// ----- 导出（Excel） -----

// ExportOrganizationRow 组织导出行。
type ExportOrganizationRow struct {
	ID       string
	Name     string
	TypeID   string
	ParentID *string
	Sort     int
}

// ListExportOrganizations 导出组织：按租户（可选 ID 集合过滤）返回组织行。
func ListExportOrganizations(ctx context.Context, q Queryer, tenantID string, ids []string) ([]ExportOrganizationRow, error) {
	var query string
	var args []interface{}
	if len(ids) > 0 {
		placeholders := make([]string, len(ids))
		for i := range ids {
			placeholders[i] = fmt.Sprintf("$%d", i+2)
			args = append(args, ids[i])
		}
		query = fmt.Sprintf(`
			SELECT id, name, type_id, parent_id, sort_order
			FROM organizations
			WHERE tenant_id=$1 AND id IN (%s)
			ORDER BY sort_order, name
		`, strings.Join(placeholders, ","))
	} else {
		query = `
			SELECT id, name, type_id, parent_id, sort_order
			FROM organizations
			WHERE tenant_id=$1
			ORDER BY sort_order, name
		`
	}
	args = append([]interface{}{tenantID}, args...)

	rows, err := q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orgs []ExportOrganizationRow
	for rows.Next() {
		var r ExportOrganizationRow
		if err := rows.Scan(&r.ID, &r.Name, &r.TypeID, &r.ParentID, &r.Sort); err != nil {
			slog.Warn("导出组织行扫描失败", "error", err)
			continue
		}
		orgs = append(orgs, r)
	}
	return orgs, nil
}

// GetOrgTypeName 按 ID 查询组织类型名（原 handler 直查语义：无租户条件）。
func GetOrgTypeName(ctx context.Context, q Queryer, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM org_types WHERE id=$1`, id).Scan(&name)
	return name, err
}

// GetOrganizationName 按 ID 查询组织名称（原 handler 直查语义：无租户条件）。
func GetOrganizationName(ctx context.Context, q Queryer, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM organizations WHERE id=$1`, id).Scan(&name)
	return name, err
}

// ExportUserRow 用户导出行（学生/教师共用）。
type ExportUserRow struct {
	ID        string
	Username  string
	Name      string
	Status    string
	OrgNodeID *string
	TitleIDs  []string
}

// ListExportUsers 导出用户：按租户+角色 code（可选 ID 集合过滤）返回用户行。
func ListExportUsers(ctx context.Context, q Queryer, tenantID, roleCode string, ids []string) ([]ExportUserRow, error) {
	var idFilter string
	var args []interface{}
	args = append(args, tenantID, roleCode)
	if len(ids) > 0 {
		placeholders := make([]string, len(ids))
		for i := range ids {
			placeholders[i] = fmt.Sprintf("$%d", i+3)
			args = append(args, ids[i])
		}
		idFilter = fmt.Sprintf("AND u.id IN (%s)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`
		SELECT u.id, u.username, u.name, u.status, u.org_node_id, u.title_ids
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id=$1 AND r.code=$2 AND r.tenant_id=$1 %s
		ORDER BY u.name, u.username
	`, idFilter)

	rows, err := q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []ExportUserRow
	for rows.Next() {
		var u ExportUserRow
		if err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Status, &u.OrgNodeID, &u.TitleIDs); err != nil {
			slog.Warn("导出用户行扫描失败", "error", err)
			continue
		}
		users = append(users, u)
	}
	return users, nil
}

// GetOrgNodeNameAndParent 按租户+节点 ID 查询组织节点名称与上级 ID。
func GetOrgNodeNameAndParent(ctx context.Context, q Queryer, tenantID, nodeID string) (string, *string, error) {
	var name string
	var parentID *string
	err := q.QueryRow(ctx, `
		SELECT name, parent_id FROM organizations WHERE tenant_id=$1 AND id=$2
	`, tenantID, nodeID).Scan(&name, &parentID)
	return name, parentID, err
}

// GetStaffTitleName 按租户+ID 查询职称名称。
func GetStaffTitleName(ctx context.Context, q Queryer, tenantID, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM staff_titles WHERE tenant_id=$1 AND id=$2`, tenantID, id).Scan(&name)
	return name, err
}

// ----- 导入：行业 -----

// GetIndustryIDByCode 按租户+行业代码查询行业 ID（未命中/出错返回空串，与原 handler 语义一致）。
func GetIndustryIDByCode(ctx context.Context, q Queryer, tenantID, code string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&id)
	return id
}

// UpdateIndustry 覆盖更新行业（导入）。
func UpdateIndustry(ctx context.Context, q Queryer, id, tenantID, name string, enabled bool, sortOrder int) error {
	_, err := q.Exec(ctx, `
		UPDATE industries SET name=$1, enabled=$2, sort_order=$3, updated_at=NOW()
		WHERE id=$4 AND tenant_id=$5
	`, name, enabled, sortOrder, id, tenantID)
	return err
}

// InsertIndustry 导入创建行业。
func InsertIndustry(ctx context.Context, q Queryer, id, tenantID, code, name string, enabled bool, sortOrder int) error {
	_, err := q.Exec(ctx, `
		INSERT INTO industries (id, tenant_id, code, name, enabled, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, code, name, enabled, sortOrder)
	return err
}

// UpdateIndustryParent 导入回填行业上级关联。
func UpdateIndustryParent(ctx context.Context, q Queryer, parentID, id, tenantID string) error {
	_, err := q.Exec(ctx, `UPDATE industries SET parent_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, parentID, id, tenantID)
	return err
}

// ----- 导入：专业 -----

// GetMajorIDByCode 按租户+专业代码查询专业 ID（未命中/出错返回空串）。
func GetMajorIDByCode(ctx context.Context, q Queryer, tenantID, code string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&id)
	return id
}

// UpdateMajor 覆盖更新专业（导入）。
func UpdateMajor(ctx context.Context, q Queryer, id, tenantID, name string, alias *string, enabled bool) error {
	_, err := q.Exec(ctx, `
		UPDATE majors SET name=$1, alias=$2, enabled=$3, updated_at=NOW()
		WHERE id=$4 AND tenant_id=$5
	`, name, alias, enabled, id, tenantID)
	return err
}

// InsertMajor 导入创建专业。
func InsertMajor(ctx context.Context, q Queryer, id, tenantID, code, name string, alias *string, enabled bool) error {
	_, err := q.Exec(ctx, `
		INSERT INTO majors (id, tenant_id, code, name, alias, enabled)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, code, name, alias, enabled)
	return err
}

// ----- 导入：组织 -----

// LoadOrgTypeNameToID 加载租户组织类型（名称→ID 映射），查询失败返回空映射。
func LoadOrgTypeNameToID(ctx context.Context, q Queryer, tenantID string) map[string]string {
	m := make(map[string]string)
	rows, err := q.Query(ctx, `SELECT id, name FROM org_types WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		_ = rows.Scan(&id, &name)
		m[name] = id
	}
	return m
}

// GetOrganizationIDByNameAndType 按租户+名称+类型查询组织 ID（未命中/出错返回空串）。
func GetOrganizationIDByNameAndType(ctx context.Context, q Queryer, tenantID, name, typeID string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 AND type_id=$3`, tenantID, name, typeID).Scan(&id)
	return id
}

// UpdateOrganization 覆盖更新组织（导入）。
func UpdateOrganization(ctx context.Context, q Queryer, id, tenantID, name, typeID string, parentID *string, sortOrder int) error {
	_, err := q.Exec(ctx, `
		UPDATE organizations SET name=$1, type_id=$2, parent_id=$3, sort_order=$4, updated_at=NOW()
		WHERE id=$5 AND tenant_id=$6
	`, name, typeID, parentID, sortOrder, id, tenantID)
	return err
}

// InsertOrganization 导入创建组织（member_count 固定 0）。
func InsertOrganization(ctx context.Context, q Queryer, id, tenantID, name, typeID string, parentID *string, sortOrder int) error {
	_, err := q.Exec(ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
		VALUES ($1, $2, $3, $4, $5, $6, 0)
	`, id, tenantID, name, typeID, parentID, sortOrder)
	return err
}

// OrgNodeCandidate 组织节点候选（findOrgNodeByPath 用）。
type OrgNodeCandidate struct {
	ID       string
	ParentID *string
}

// FindOrgNodeCandidates 按租户+名称查询组织节点候选（ID+上级）。
func FindOrgNodeCandidates(ctx context.Context, q Queryer, tenantID, name string) ([]OrgNodeCandidate, error) {
	rows, err := q.Query(ctx, `
		SELECT id, parent_id FROM organizations WHERE tenant_id=$1 AND name=$2
	`, tenantID, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []OrgNodeCandidate
	for rows.Next() {
		var n OrgNodeCandidate
		if err := rows.Scan(&n.ID, &n.ParentID); err != nil {
			continue
		}
		candidates = append(candidates, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return candidates, nil
}

// ----- 导入：用户/角色 -----

// GetInstitutionID 按租户查询机构 ID（未命中/出错返回空串）。
func GetInstitutionID(ctx context.Context, q Queryer, tenantID string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM institutions WHERE tenant_id=$1 LIMIT 1`, tenantID).Scan(&id)
	return id
}

// GetRoleIDByTenantAndCode 按租户+角色代码查询角色 ID（未命中/出错返回空串）。
func GetRoleIDByTenantAndCode(ctx context.Context, q Queryer, tenantID, code string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM roles WHERE tenant_id=$1 AND code=$2 LIMIT 1`, tenantID, code).Scan(&id)
	return id
}

// GetUserIDByUsername 按租户+登录账号查询用户 ID（未命中/出错返回空串）。
func GetUserIDByUsername(ctx context.Context, q Queryer, tenantID, username string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND username=$2 LIMIT 1`, tenantID, username).Scan(&id)
	return id
}

// UpdateImportUser 覆盖更新导入学生（不改 title_ids；orgNodeID 为路径解析出的节点 ID）。
func UpdateImportUser(ctx context.Context, q Queryer, id, tenantID, name, passwordHash, status, orgNodeID string) error {
	_, err := q.Exec(ctx, `
		UPDATE users SET name=$1, password_hash=$2, status=$3, org_node_id=$4, updated_at=NOW()
		WHERE id=$5 AND tenant_id=$6
	`, name, passwordHash, status, orgNodeID, id, tenantID)
	return err
}

// UpdateImportTeacher 覆盖更新导入教师（含 title_ids）。
func UpdateImportTeacher(ctx context.Context, q Queryer, id, tenantID, name, passwordHash, status string, orgNodeID *string, titleIDs []string) error {
	_, err := q.Exec(ctx, `
		UPDATE users SET name=$1, password_hash=$2, status=$3, org_node_id=$4, title_ids=$5, updated_at=NOW()
		WHERE id=$6 AND tenant_id=$7
	`, name, passwordHash, status, orgNodeID, titleIDs, id, tenantID)
	return err
}

// UpdateUserTitleIDs 更新用户职称 ID 列表（原 handler 直查语义：无租户条件）。
func UpdateUserTitleIDs(ctx context.Context, q Queryer, userID string, titleIDs []string) error {
	_, err := q.Exec(ctx, `UPDATE users SET title_ids=$1 WHERE id=$2`, titleIDs, userID)
	return err
}

// ImportUserParams 导入创建用户参数（与 createUser 的 INSERT 列一一对应）。
type ImportUserParams struct {
	ID            string
	TenantID      string
	InstitutionID *string
	OrgNodeID     *string
	MajorID       *string
	Role          domain.UserRole
	Platform      string
	LoginName     string
	Username      string
	PasswordHash  string
	Name          string
	Email         string
	Phone         any
	AvatarURL     any
	StudentNo     any
	WorkID        any
	IDCard        any
	TitleIDs      []string
	OAuth         domain.JSONMap
	Status        string
}

// InsertImportUser 导入创建用户（角色绑定与角色计数更新由调用方另行执行）。
func InsertImportUser(ctx context.Context, q Queryer, p ImportUserParams) error {
	_, err := q.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
	`, p.ID, p.TenantID, p.InstitutionID, p.OrgNodeID, p.MajorID,
		p.Role, p.Platform, p.LoginName, p.Username, p.PasswordHash, p.Name, p.Email, p.Phone, p.AvatarURL,
		p.StudentNo, p.WorkID, p.IDCard, p.TitleIDs, p.OAuth, p.Status)
	return err
}

// InsertUserRole 导入用户角色绑定（冲突忽略）。
func InsertUserRole(ctx context.Context, q Queryer, id, userID, roleID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, role_id) DO NOTHING
	`, id, userID, roleID)
	return err
}

// IncrementRoleUserCount 角色用户计数 +1。
func IncrementRoleUserCount(ctx context.Context, q Queryer, roleID string) error {
	_, err := q.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id=$1`, roleID)
	return err
}

// ----- 导入：合作项目/成果/协议/权限/品牌 -----

// UpdateAllianceProjectImport 覆盖更新合作项目（导入）。
func UpdateAllianceProjectImport(ctx context.Context, q Queryer, id, tenantID string, projType *string, phase string, startDate, endDate, description, budget *string, enterpriseIDs, secondaryColleges []byte, isPublic bool) error {
	_, err := q.Exec(ctx, `
		UPDATE alliance_projects SET type=$1, phase=$2, start_date=$3, end_date=$4,
			description=$5, budget=$6, enterprise_ids=$7, secondary_colleges=$8, is_public=$9, updated_at=NOW()
		WHERE id=$10 AND tenant_id=$11
	`, projType, phase, startDate, endDate, description, budget, enterpriseIDs, secondaryColleges, isPublic, id, tenantID)
	return err
}

// InsertAllianceProjectImport 导入创建合作项目（publish_status 固定 draft、agreement_ids 固定 []）。
func InsertAllianceProjectImport(ctx context.Context, q Queryer, id, tenantID, name string, projType, description *string, phase string, startDate, endDate, budget *string, enterpriseIDs, agreementIDs, secondaryColleges []byte, isPublic bool) error {
	_, err := q.Exec(ctx, `
		INSERT INTO alliance_projects (id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, enterprise_ids, agreement_ids, secondary_colleges, is_public,
			created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
	`, id, tenantID, name, projType, description, phase, "draft",
		startDate, endDate, budget, enterpriseIDs, agreementIDs, secondaryColleges, isPublic)
	return err
}

// GetAchievementIDByTitle 按租户+标题查询合作成果 ID（未命中/出错返回空串）。
func GetAchievementIDByTitle(ctx context.Context, q Queryer, tenantID, title string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM alliance_achievements WHERE tenant_id=$1 AND title=$2 LIMIT 1`, tenantID, title).Scan(&id)
	return id
}

// UpdateAllianceAchievementImport 覆盖更新合作成果（导入）。
func UpdateAllianceAchievementImport(ctx context.Context, q Queryer, id, tenantID string, achType string, description, achievementDate *string, projectIDs, enterpriseIDs, secondaryColleges []byte, isPublic bool) error {
	_, err := q.Exec(ctx, `
		UPDATE alliance_achievements SET type=$1, description=$2, achievement_date=$3,
			project_ids=$4, enterprise_ids=$5, secondary_colleges=$6, is_public=$7, updated_at=NOW()
		WHERE id=$8 AND tenant_id=$9
	`, achType, description, achievementDate, projectIDs, enterpriseIDs, secondaryColleges, isPublic, id, tenantID)
	return err
}

// InsertAllianceAchievementImport 导入创建合作成果（附件/图片/归属人等固定 []、status 固定 draft）。
func InsertAllianceAchievementImport(ctx context.Context, q Queryer, id, tenantID, title, achType string, description, achievementDate *string, enterpriseIDs, projectIDs, secondaryColleges []byte, isPublic bool) error {
	_, err := q.Exec(ctx, `
		INSERT INTO alliance_achievements (id, tenant_id, title, type, description, achievement_date,
			attachments, images, owner_persons, co_builders, enterprise_ids, project_ids,
			related_positions, related_scenes, related_courses, status, view_count,
			secondary_colleges, is_public, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())
	`, id, tenantID, title, achType, description, achievementDate,
		[]byte("[]"), []byte("[]"), []byte("[]"), []byte("[]"),
		enterpriseIDs, projectIDs,
		[]byte("[]"), []byte("[]"), []byte("[]"), "draft", 0,
		secondaryColleges, isPublic)
	return err
}

// UpdateAllianceAgreementImport 覆盖更新合作协议（导入）。
func UpdateAllianceAgreementImport(ctx context.Context, q Queryer, id, tenantID string, agmtType, startDate, endDate *string, status string, content *string, projectIDs, enterpriseIDs []byte) error {
	_, err := q.Exec(ctx, `
		UPDATE alliance_agreements SET type=$1, start_date=$2, end_date=$3,
			status=$4, content=$5, project_ids=$6, enterprise_ids=$7, updated_at=NOW()
		WHERE id=$8 AND tenant_id=$9
	`, agmtType, startDate, endDate, status, content, projectIDs, enterpriseIDs, id, tenantID)
	return err
}

// InsertAllianceAgreementImport 导入创建合作协议（attachments 固定 []、is_public 固定 false）。
func InsertAllianceAgreementImport(ctx context.Context, q Queryer, id, tenantID, name string, agmtType, content, startDate, endDate *string, status string, enterpriseIDs, projectIDs []byte) error {
	_, err := q.Exec(ctx, `
		INSERT INTO alliance_agreements (id, tenant_id, name, type, content, start_date,
			end_date, status, enterprise_ids, project_ids, attachments, is_public, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,NOW(),NOW())
	`, id, tenantID, name, agmtType, content, startDate, endDate,
		status, enterpriseIDs, projectIDs, []byte("[]"))
	return err
}

// GetPermissionIDByAccountName 按租户+账号名称查询合作权限 ID（未命中/出错返回空串）。
func GetPermissionIDByAccountName(ctx context.Context, q Queryer, tenantID, accountName string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM alliance_permissions WHERE tenant_id=$1 AND account_name=$2 LIMIT 1`, tenantID, accountName).Scan(&id)
	return id
}

// UpdateAlliancePermissionImport 覆盖更新合作权限（导入）。
func UpdateAlliancePermissionImport(ctx context.Context, q Queryer, id, tenantID, accountType string, isEnabled bool) error {
	_, err := q.Exec(ctx, `
		UPDATE alliance_permissions SET account_type=$1, is_enabled=$2, updated_at=NOW()
		WHERE id=$3 AND tenant_id=$4
	`, accountType, isEnabled, id, tenantID)
	return err
}

// InsertAlliancePermissionImport 导入创建合作权限（resource/platform 权限固定 []）。
func InsertAlliancePermissionImport(ctx context.Context, q Queryer, id, tenantID, accountName, accountType string, isEnabled bool, resourcePerms, platformPerms []byte) error {
	_, err := q.Exec(ctx, `
		INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type,
			is_enabled, resource_permissions, platform_permissions, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
	`, id, tenantID, accountName, accountType, isEnabled, resourcePerms, platformPerms)
	return err
}

// GetBrandIDByTypeAndName 按租户+品牌类型+名称查询品牌 ID（未命中/出错返回空串）。
func GetBrandIDByTypeAndName(ctx context.Context, q Queryer, tenantID, brandType, name string) string {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM alliance_brands WHERE tenant_id=$1 AND brand_type=$2 AND name=$3 LIMIT 1`, tenantID, brandType, name).Scan(&id)
	return id
}

// UpdateAllianceBrandImport 覆盖更新品牌（导入，通用模板路径）。
func UpdateAllianceBrandImport(ctx context.Context, q Queryer, id, tenantID string, description *string, status string, isPublic, isFeatured bool, coverImage *string, studentID, enterpriseID, positionID, majorID, teacherID, expertID *string) error {
	_, err := q.Exec(ctx, `
		UPDATE alliance_brands SET description=$1, status=$2, is_public=$3, is_featured=$4,
			cover_image=$5, student_id=$6, enterprise_id=$7, position_id=$8, major_id=$9,
			teacher_id=$10, expert_id=$11, updated_at=NOW()
		WHERE id=$12 AND tenant_id=$13
	`, description, status, isPublic, isFeatured, coverImage,
		studentID, enterpriseID, positionID, majorID, teacherID, expertID,
		id, tenantID)
	return err
}

// InsertAllianceBrandImport 导入创建品牌（通用模板路径：sort_order/view_count 固定 0）。
func InsertAllianceBrandImport(ctx context.Context, q Queryer, id, tenantID, brandType, name, status string, isPublic, isFeatured bool, coverImage *string, description *string, studentID, enterpriseID, positionID, majorID, teacherID, expertID *string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public,
			is_featured, cover_image, description, student_id, enterprise_id, position_id,
			major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
	`, id, tenantID, brandType, name, status, isPublic, isFeatured, coverImage, description,
		studentID, enterpriseID, positionID, majorID, teacherID, expertID, 0, 0)
	return err
}
