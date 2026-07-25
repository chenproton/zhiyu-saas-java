package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

// ResourceImportHandler handles Excel import for portal resources:
// industries, majors, organizations, students and teachers.
type ResourceImportHandler struct {
	DB *pgxpool.Pool
}

type resourceImportResult struct {
	Created          int
	Failed           int
	Skipped          int
	IndustryCreated  int
	MajorCreated     int
	OrgCreated       int
	StudentCreated   int
	TeacherCreated   int
	Errors           []string
}

func (h *ResourceImportHandler) ImportIndustries(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "industries", h.doImportIndustries)
}

func (h *ResourceImportHandler) ImportMajors(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "majors", h.doImportMajors)
}

func (h *ResourceImportHandler) ImportOrganizations(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "organizations", h.doImportOrganizations)
}

func (h *ResourceImportHandler) ImportStudents(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "students", h.doImportStudents)
}

func (h *ResourceImportHandler) ImportTeachers(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "teachers", h.doImportTeachers)
}

type importFunc func(ctx context.Context, xlsx *excelize.File, tenantID, userID string, result *resourceImportResult)

func (h *ResourceImportHandler) importExcel(w http.ResponseWriter, r *http.Request, entity string, fn importFunc) {
	claims := middleware.CurrentUser(r)
	if claims == nil || !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	result := &resourceImportResult{}
	fn(r.Context(), xlsx, tenantID, userID, result)

	log.Printf("[import/%s] result: created=%d failed=%d skipped=%d errors=%d",
		entity, result.Created, result.Failed, result.Skipped, len(result.Errors))
	for _, e := range result.Errors {
		log.Printf("[import/%s] error: %s", entity, e)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":         result.Created,
		"failed":          result.Failed,
		"skipped":         result.Skipped,
		"entity":          entity,
		"industryCreated": result.IndustryCreated,
		"majorCreated":    result.MajorCreated,
		"orgCreated":      result.OrgCreated,
		"studentCreated":  result.StudentCreated,
		"teacherCreated":  result.TeacherCreated,
		"errors":          result.Errors,
	})
}

// Sheet: 行业列表
// Columns: 行业代码*, 行业名称*, 上级行业代码, 排序, 是否启用
func (h *ResourceImportHandler) doImportIndustries(ctx context.Context, xlsx *excelize.File, tenantID, _ string, result *resourceImportResult) {
	rows, err := xlsx.GetRows("行业列表")
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「行业列表」Sheet 失败: %v", err))
		return
	}

	codeToID := make(map[string]string)
	// First pass: create/update all industries by code
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		code := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		sortOrder := parseIntDefault(col(row, 3), 0)
		enabled := parseBoolDefault(col(row, 4), true)

		var existingID string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&existingID)

		if existingID != "" {
			_, err := h.DB.Exec(ctx, `
				UPDATE industries SET name=$1, enabled=$2, sort_order=$3, updated_at=NOW()
				WHERE id=$4 AND tenant_id=$5
			`, name, enabled, sortOrder, existingID, tenantID)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]更新失败: %v", code, err))
				continue
			}
			codeToID[code] = existingID
			result.Created++
			continue
		}

		id := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO industries (id, tenant_id, code, name, enabled, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, id, tenantID, code, name, enabled, sortOrder)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]创建失败: %v", code, err))
			continue
		}
		codeToID[code] = id
		result.IndustryCreated++
		result.Created++
	}

	// Second pass: resolve parent_id by parent code
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 3 {
			continue
		}
		code := strings.TrimSpace(row[0])
		parentCode := strings.TrimSpace(row[2])
		if parentCode == "" {
			continue
		}
		id, ok := codeToID[code]
		if !ok {
			continue
		}
		parentID, ok := codeToID[parentCode]
		if !ok {
			// Try database in case parent existed before import
			_ = h.DB.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, parentCode).Scan(&parentID)
			if parentID == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]的上级行业[%s]未找到", code, parentCode))
				continue
			}
		}
		if parentID == id {
			result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]不能将自己设为上级", code))
			continue
		}
		_, _ = h.DB.Exec(ctx, `UPDATE industries SET parent_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, parentID, id, tenantID)
	}
}

// Sheet: 专业列表
// Columns: 专业代码*, 专业名称*, 别名, 所属组织节点, 是否启用
func (h *ResourceImportHandler) doImportMajors(ctx context.Context, xlsx *excelize.File, tenantID, _ string, result *resourceImportResult) {
	rows, err := xlsx.GetRows("专业列表")
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「专业列表」Sheet 失败: %v", err))
		return
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		code := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		alias := nullableStr(col(row, 2))
		orgNodeName := col(row, 3)
		enabled := parseBoolDefault(col(row, 4), true)

		var orgNodeID *string
		if orgNodeName != "" {
			var oid string
			_ = h.DB.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, orgNodeName).Scan(&oid)
			if oid != "" {
				orgNodeID = &oid
			}
		}

		var existingID string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&existingID)

		if existingID != "" {
			_, err := h.DB.Exec(ctx, `
				UPDATE majors SET name=$1, alias=$2, org_node_id=$3, enabled=$4, updated_at=NOW()
				WHERE id=$5 AND tenant_id=$6
			`, name, alias, orgNodeID, enabled, existingID, tenantID)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("专业[%s]更新失败: %v", code, err))
				continue
			}
			result.Created++
			continue
		}

		id := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO majors (id, tenant_id, org_node_id, code, name, alias, enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, id, tenantID, orgNodeID, code, name, alias, enabled)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("专业[%s]创建失败: %v", code, err))
			continue
		}
		result.MajorCreated++
		result.Created++
	}
}

// Sheet: 组织架构
// Columns: 组织名称*, 组织类型*, 父组织名称, 排序
func (h *ResourceImportHandler) doImportOrganizations(ctx context.Context, xlsx *excelize.File, tenantID, _ string, result *resourceImportResult) {
	rows, err := xlsx.GetRows("组织架构")
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「组织架构」Sheet 失败: %v", err))
		return
	}

	typeNameToID := make(map[string]string)
	nameToID := make(map[string]string)

	// Load org types
	typeRows, _ := h.DB.Query(ctx, `SELECT id, name FROM org_types WHERE tenant_id=$1`, tenantID)
	for typeRows.Next() {
		var id, name string
		_ = typeRows.Scan(&id, &name)
		typeNameToID[name] = id
	}
	typeRows.Close()

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		typeName := strings.TrimSpace(row[1])
		parentName := col(row, 2)
		sortOrder := parseIntDefault(col(row, 3), 0)

		typeID, ok := typeNameToID[typeName]
		if !ok {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("组织[%s]的类型[%s]不存在", name, typeName))
			continue
		}

		var parentID *string
		if parentName != "" {
			if pid, ok := nameToID[parentName]; ok {
				parentID = &pid
			} else {
				var pid string
				_ = h.DB.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, parentName).Scan(&pid)
				if pid != "" {
					parentID = &pid
				}
			}
		}

		var existingID string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 AND type_id=$3`, tenantID, name, typeID).Scan(&existingID)
		if existingID != "" {
			// Update parent/sort only
			_, _ = h.DB.Exec(ctx, `
				UPDATE organizations SET parent_id=$1, sort_order=$2, updated_at=NOW()
				WHERE id=$3 AND tenant_id=$4
			`, parentID, sortOrder, existingID, tenantID)
			nameToID[name] = existingID
			result.Created++
			continue
		}

		id := uuid.NewString()
		_, err = h.DB.Exec(ctx, `
			INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
			VALUES ($1, $2, $3, $4, $5, $6, 0)
		`, id, tenantID, name, typeID, parentID, sortOrder)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("组织[%s]创建失败: %v", name, err))
			continue
		}
		nameToID[name] = id
		result.OrgCreated++
		result.Created++
	}
}

// Sheet: 学生列表
// Columns: 登录账号(学号)*, 姓名*, 密码*, 班级(组织节点名称)*, 专业代码, 状态
func (h *ResourceImportHandler) doImportStudents(ctx context.Context, xlsx *excelize.File, tenantID, _ string, result *resourceImportResult) {
	rows, err := xlsx.GetRows("学生列表")
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「学生列表」Sheet 失败: %v", err))
		return
	}

	institutionID := h.getInstitutionID(ctx, tenantID)
	roleID := h.getRoleIDByCode(ctx, tenantID, "student")
	if roleID == "" {
		result.Errors = append(result.Errors, "未找到学生角色(student)，请先在角色管理中创建")
		return
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 4 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" || strings.TrimSpace(row[2]) == "" || strings.TrimSpace(row[3]) == "" {
			continue
		}
		username := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		password := strings.TrimSpace(row[2])
		className := strings.TrimSpace(row[3])
		majorCode := col(row, 4)
		status := mapUserStatus(col(row, 5), "active")

		if !isStrongPassword(password) {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]密码强度不足，需至少8位且含字母和数字", username))
			continue
		}

		var orgNodeID *string
		var oid string
		_ = h.DB.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, className).Scan(&oid)
		if oid == "" {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]的班级[%s]不存在", username, className))
			continue
		}
		orgNodeID = &oid

		var majorID *string
		if majorCode != "" {
			var mid string
			_ = h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND code=$2 LIMIT 1`, tenantID, majorCode).Scan(&mid)
			if mid != "" {
				majorID = &mid
			}
		}

		if h.userExists(ctx, tenantID, username) {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]已存在，已跳过", username))
			continue
		}

		err := h.createUser(ctx, tenantID, institutionID, roleID, orgNodeID, majorID, username, password, name, status, "student")
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]创建失败: %v", username, err))
			continue
		}
		result.StudentCreated++
		result.Created++
	}
}

// Sheet: 教师列表
// Columns: 登录账号(工号)*, 姓名*, 密码*, 所属组织节点(名称), 职位(逗号分隔), 状态
func (h *ResourceImportHandler) doImportTeachers(ctx context.Context, xlsx *excelize.File, tenantID, _ string, result *resourceImportResult) {
	rows, err := xlsx.GetRows("教师列表")
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("读取「教师列表」Sheet 失败: %v", err))
		return
	}

	institutionID := h.getInstitutionID(ctx, tenantID)
	roleID := h.getRoleIDByCode(ctx, tenantID, "teacher")
	if roleID == "" {
		result.Errors = append(result.Errors, "未找到教师角色(teacher)，请先在角色管理中创建")
		return
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 3 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" || strings.TrimSpace(row[2]) == "" {
			continue
		}
		username := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		password := strings.TrimSpace(row[2])
		orgName := col(row, 3)
		titleNames := splitTrim(col(row, 4), ",")
		status := mapUserStatus(col(row, 5), "active")

		if !isStrongPassword(password) {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]密码强度不足，需至少8位且含字母和数字", username))
			continue
		}

		var orgNodeID *string
		if orgName != "" {
			var oid string
			_ = h.DB.QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, orgName).Scan(&oid)
			if oid != "" {
				orgNodeID = &oid
			}
		}

		var titleIDs []string
		for _, tname := range titleNames {
			if tname == "" {
				continue
			}
			var tid string
			_ = h.DB.QueryRow(ctx, `SELECT id FROM staff_titles WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, tname).Scan(&tid)
			if tid != "" {
				titleIDs = append(titleIDs, tid)
			}
		}

		if h.userExists(ctx, tenantID, username) {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]已存在，已跳过", username))
			continue
		}

		err := h.createUser(ctx, tenantID, institutionID, roleID, orgNodeID, nil, username, password, name, status, "teacher")
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]创建失败: %v", username, err))
			continue
		}
		if len(titleIDs) > 0 {
			// Titles were not set during createUser; update them now
			var uid string
			_ = h.DB.QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND username=$2 LIMIT 1`, tenantID, username).Scan(&uid)
			if uid != "" {
				_, _ = h.DB.Exec(ctx, `UPDATE users SET title_ids=$1 WHERE id=$2`, titleIDs, uid)
			}
		}
		result.TeacherCreated++
		result.Created++
	}
}

func (h *ResourceImportHandler) getInstitutionID(ctx context.Context, tenantID string) *string {
	var id string
	_ = h.DB.QueryRow(ctx, `SELECT id FROM institutions WHERE tenant_id=$1 LIMIT 1`, tenantID).Scan(&id)
	if id == "" {
		return nil
	}
	return &id
}

func (h *ResourceImportHandler) getRoleIDByCode(ctx context.Context, tenantID, code string) string {
	var id string
	_ = h.DB.QueryRow(ctx, `SELECT id FROM roles WHERE tenant_id=$1 AND code=$2 LIMIT 1`, tenantID, code).Scan(&id)
	return id
}

func (h *ResourceImportHandler) userExists(ctx context.Context, tenantID, username string) bool {
	var id string
	_ = h.DB.QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND username=$2 LIMIT 1`, tenantID, username).Scan(&id)
	return id != ""
}

func (h *ResourceImportHandler) createUser(ctx context.Context, tenantID string, institutionID *string, roleID string, orgNodeID, majorID *string, username, password, name, status, role string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	id := uuid.NewString()
	globalLoginName := tenantID + "_" + username

	_, err = h.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
	`, id, tenantID, institutionID, orgNodeID, majorID,
		role, "portal", globalLoginName, username, string(hash), name, "", nil, nil,
		nil, nil, nil, []string{}, domain.JSONMap{}, status)
	if err != nil {
		return err
	}

	if roleID != "" {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), id, roleID)
		_, _ = h.DB.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id=$1`, roleID)
	}
	return nil
}

func mapUserStatus(s, defaultVal string) string {
	s = strings.TrimSpace(s)
	switch s {
	case "active", "在籍", "在职":
		return "active"
	case "inactive", "休学", "离职":
		return "inactive"
	case "disabled", "退学", "禁用":
		return "disabled"
	case "graduated", "毕业":
		return "graduated"
	case "completed", "结业":
		return "completed"
	case "外聘":
		return "active"
	default:
		return defaultVal
	}
}

func parseBoolDefault(s string, defaultVal bool) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	switch strings.ToLower(s) {
	case "true", "是", "1", "yes", "启用":
		return true
	case "false", "否", "0", "no", "禁用", "关闭":
		return false
	default:
		return defaultVal
	}
}
