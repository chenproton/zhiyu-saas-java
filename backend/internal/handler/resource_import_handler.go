package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// ResourceImportHandler handles Excel import for portal resources:
// industries, majors, organizations, students and teachers.
type ResourceImportHandler struct {
	Store *store.Store
}

type resourceImportResult struct {
	Created         int
	Failed          int
	Skipped         int
	IndustryCreated int
	MajorCreated    int
	OrgCreated      int
	StudentCreated  int
	TeacherCreated  int
	Errors          []string
}

func (h *ResourceImportHandler) PreviewIndustries(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "industries", h.doImportIndustries, true)
}

func (h *ResourceImportHandler) PreviewMajors(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "majors", h.doImportMajors, true)
}

func (h *ResourceImportHandler) PreviewOrganizations(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "organizations", h.doImportOrganizations, true)
}

func (h *ResourceImportHandler) PreviewStudents(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "students", h.doImportStudents, true)
}

func (h *ResourceImportHandler) PreviewTeachers(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "teachers", h.doImportTeachers, true)
}

func (h *ResourceImportHandler) ImportIndustries(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "industries", h.doImportIndustries, false)
}

func (h *ResourceImportHandler) ImportMajors(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "majors", h.doImportMajors, false)
}

func (h *ResourceImportHandler) ImportOrganizations(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "organizations", h.doImportOrganizations, false)
}

func (h *ResourceImportHandler) ImportStudents(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "students", h.doImportStudents, false)
}

func (h *ResourceImportHandler) ImportTeachers(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "teachers", h.doImportTeachers, false)
}

type importFunc func(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult)

func (h *ResourceImportHandler) importExcel(w http.ResponseWriter, r *http.Request, entity string, fn importFunc, preview bool) {
	claims := middleware.CurrentUser(r)
	// alliance-* 导入面向业务角色（教师等，与 alliance 模块权限一致），
	// 组织架构/师生/专业行业等基础数据导入仍限门户系统管理员
	permit := canManageAlliance(claims)
	if !strings.HasPrefix(entity, "alliance-") {
		permit = canManagePortal(claims)
	}
	if claims == nil || !permit {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "解析Excel文件失败")
		return
	}
	defer xlsx.Close()

	previewRes, execRes := fn(r.Context(), xlsx, tenantID, userID, preview, overwrite, rename)

	if preview {
		slog.Info(fmt.Sprintf("[import/preview/%s] result: created=%d duplicates=%d failed=%d duplicateItems=%d errors=%d",
			entity, previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.DuplicateItems), len(previewRes.Errors)))
		for _, e := range previewRes.Errors {
			slog.Info(fmt.Sprintf("[import/preview/%s] error: %s", entity, e))
		}
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/%s] result: created=%d failed=%d skipped=%d errors=%d",
		entity, execRes.Created, execRes.Failed, execRes.Skipped, len(execRes.Errors)))
	for _, e := range execRes.Errors {
		slog.Info(fmt.Sprintf("[import/%s] error: %s", entity, e))
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":         execRes.Created,
		"failed":          execRes.Failed,
		"skipped":         execRes.Skipped,
		"entity":          entity,
		"industryCreated": execRes.IndustryCreated,
		"majorCreated":    execRes.MajorCreated,
		"orgCreated":      execRes.OrgCreated,
		"studentCreated":  execRes.StudentCreated,
		"teacherCreated":  execRes.TeacherCreated,
		"errors":          execRes.Errors,
	})
}

func appendDuplicate(previewRes *ImportPreviewResult, rowNum int, key, name string) {
	if len(previewRes.DuplicateItems) < 100 {
		previewRes.DuplicateItems = append(previewRes.DuplicateItems, ImportPreviewItem{
			RowNum: rowNum,
			Key:    key,
			Name:   name,
		})
	}
}

// Sheet: 行业列表
// Columns: 行业代码*, 行业名称*, 上级行业代码, 排序, 是否启用
func (h *ResourceImportHandler) doImportIndustries(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("行业列表")
	if err != nil {
		msg := fmt.Sprintf("读取「行业列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	codeToID := make(map[string]string)
	// First pass: process all industries by code
	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		code := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		sortOrder := parseIntDefault(col(row, 3), 0)
		enabled := parseBoolDefault(col(row, 4), true)

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&existingID)

		origCode := ""
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, code, name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE industries SET name=$1, enabled=$2, sort_order=$3, updated_at=NOW()
						WHERE id=$4 AND tenant_id=$5
					`, name, enabled, sortOrder, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]更新失败: %v", code, err))
						continue
					}
				}
				codeToID[code] = existingID
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新代码，按新对象导入
			origCode = code
			code = uniqueSuffixed(code, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		id := uuid.NewString()
		if !preview {
			_, err = h.Store.Q().Exec(ctx, `
				INSERT INTO industries (id, tenant_id, code, name, enabled, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, id, tenantID, code, name, enabled, sortOrder)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]创建失败: %v", code, err))
				continue
			}
			result.IndustryCreated++
		}
		codeToID[code] = id
		if origCode != "" {
			codeToID[origCode] = id
		}
		result.Created++
		previewRes.Created++
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
			_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND code=$2`, tenantID, parentCode).Scan(&parentID)
			if parentID == "" {
				msg := fmt.Sprintf("行业[%s]的上级行业[%s]未找到", code, parentCode)
				result.Errors = append(result.Errors, msg)
				previewRes.Errors = append(previewRes.Errors, msg)
				previewRes.Failed++
				continue
			}
		}
		if parentID == id {
			msg := fmt.Sprintf("行业[%s]不能将自己设为上级", code)
			result.Errors = append(result.Errors, msg)
			previewRes.Errors = append(previewRes.Errors, msg)
			previewRes.Failed++
			continue
		}
		if !preview {
			if _, err := h.Store.Q().Exec(ctx, `UPDATE industries SET parent_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, parentID, id, tenantID); err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("行业[%s]父级关联更新失败: %v", code, err))
				continue
			}
		}
	}

	return previewRes, result
}

// Sheet: 专业列表
// Columns: 专业代码*, 专业名称*, 别名, 是否启用
func (h *ResourceImportHandler) doImportMajors(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("专业列表")
	if err != nil {
		msg := fmt.Sprintf("读取「专业列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		code := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		alias := nullableStr(col(row, 2))
		enabled := parseBoolDefault(col(row, 3), true)

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND code=$2`, tenantID, code).Scan(&existingID)

		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, code, name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE majors SET name=$1, alias=$2, enabled=$3, updated_at=NOW()
						WHERE id=$4 AND tenant_id=$5
					`, name, alias, enabled, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("专业[%s]更新失败: %v", code, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新代码，按新对象导入
			code = uniqueSuffixed(code, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND code=$2`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err = h.Store.Q().Exec(ctx, `
				INSERT INTO majors (id, tenant_id, code, name, alias, enabled)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, id, tenantID, code, name, alias, enabled)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("专业[%s]创建失败: %v", code, err))
				continue
			}
			result.MajorCreated++
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 组织架构
// Columns: 组织名称*, 组织类型*, 父组织名称, 排序
func (h *ResourceImportHandler) doImportOrganizations(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("组织架构")
	if err != nil {
		msg := fmt.Sprintf("读取「组织架构」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	typeNameToID := make(map[string]string)
	nameToID := make(map[string]string)

	// Load org types
	typeRows, typeErr := h.Store.Q().Query(ctx, `SELECT id, name FROM org_types WHERE tenant_id=$1`, tenantID)
	if typeErr == nil {
		for typeRows.Next() {
			var id, name string
			_ = typeRows.Scan(&id, &name)
			typeNameToID[name] = id
		}
		typeRows.Close()
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		typeName := strings.TrimSpace(row[1])
		parentName := col(row, 2)
		sortOrder := parseIntDefault(col(row, 3), 0)

		typeID, ok := typeNameToID[typeName]
		if !ok {
			msg := fmt.Sprintf("组织[%s]的类型[%s]不存在", name, typeName)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		var parentID *string
		if parentName != "" {
			if pid, ok := nameToID[parentName]; ok {
				parentID = &pid
			} else {
				pid, _ := lookupIDByName(ctx, h.Store.Q(), "organizations", tenantID, parentName)
				if pid != "" {
					parentID = &pid
				}
			}
		}

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 AND type_id=$3`, tenantID, name, typeID).Scan(&existingID)
		origName := ""
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, fmt.Sprintf("%s|%s", name, typeName), name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE organizations SET name=$1, type_id=$2, parent_id=$3, sort_order=$4, updated_at=NOW()
						WHERE id=$5 AND tenant_id=$6
					`, name, typeID, parentID, sortOrder, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("组织[%s]更新失败: %v", name, err))
						continue
					}
				}
				nameToID[name] = existingID
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = uniqueSuffixed(name, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM organizations WHERE tenant_id=$1 AND name=$2 AND type_id=$3`, tenantID, c, typeID).Scan(&eid)
				return eid != ""
			})
		}

		id := uuid.NewString()
		if !preview {
			_, err = h.Store.Q().Exec(ctx, `
				INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
				VALUES ($1, $2, $3, $4, $5, $6, 0)
			`, id, tenantID, name, typeID, parentID, sortOrder)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("组织[%s]创建失败: %v", name, err))
				continue
			}
			result.OrgCreated++
		}
		nameToID[name] = id
		if origName != "" {
			nameToID[origName] = id
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 学生列表
// Columns: 登录账号(学号)*, 姓名*, 密码*, 班级(组织节点路径)*, 状态
// 班级路径示例：学校-学院-班级 或 学校/学院/班级
func (h *ResourceImportHandler) doImportStudents(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("学生列表")
	if err != nil {
		msg := fmt.Sprintf("读取「学生列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	institutionID := h.getInstitutionID(ctx, tenantID)
	roleID := h.getRoleIDByCode(ctx, tenantID, domain.RoleStudent)
	if roleID == "" {
		msg := "未找到学生角色(student)，请先在角色管理中创建"
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 4 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" || strings.TrimSpace(row[2]) == "" || strings.TrimSpace(row[3]) == "" {
			continue
		}
		username := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		password := strings.TrimSpace(row[2])
		classPath := strings.TrimSpace(row[3])
		status := mapUserStatus(col(row, 4), "active")

		if !isStrongPassword(password) {
			msg := fmt.Sprintf("学生[%s]密码强度不足，需至少8位且含字母和数字", username)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		orgNodeID, err := h.findOrgNodeByPath(ctx, tenantID, classPath)
		if err != nil {
			msg := fmt.Sprintf("学生[%s]的班级[%s]解析失败: %v", username, classPath, err)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		existingID := h.getUserID(ctx, tenantID, username)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, username, name)
				continue
			}
			if overwrite {
				if !preview {
					hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]密码加密失败: %v", username, err))
						continue
					}
					_, err = h.Store.Q().Exec(ctx, `
						UPDATE users SET name=$1, password_hash=$2, status=$3, org_node_id=$4, updated_at=NOW()
						WHERE id=$5 AND tenant_id=$6
					`, name, string(hash), status, orgNodeID, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]更新失败: %v", username, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新登录账号，按新对象导入
			username = uniqueSuffixed(username, func(c string) bool {
				return h.getUserID(ctx, tenantID, c) != ""
			})
		}

		if !preview {
			err = h.createUser(ctx, tenantID, institutionID, roleID, &orgNodeID, nil, username, password, name, status)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("学生[%s]创建失败: %v", username, err))
				continue
			}
			result.StudentCreated++
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 教师列表
// Columns: 登录账号(工号)*, 姓名*, 密码*, 所属组织节点(路径), 职位(逗号分隔), 状态
// 组织节点路径示例：学校-学院 或 学校/学院
func (h *ResourceImportHandler) doImportTeachers(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("教师列表")
	if err != nil {
		msg := fmt.Sprintf("读取「教师列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	institutionID := h.getInstitutionID(ctx, tenantID)
	roleID := h.getRoleIDByCode(ctx, tenantID, domain.RoleTeacher)
	if roleID == "" {
		msg := "未找到教师角色(teacher)，请先在角色管理中创建"
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 3 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" || strings.TrimSpace(row[2]) == "" {
			continue
		}
		username := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		password := strings.TrimSpace(row[2])
		orgPath := col(row, 3)
		titleNames := splitTrim(col(row, 4), ",")
		status := mapUserStatus(col(row, 5), "active")

		if !isStrongPassword(password) {
			msg := fmt.Sprintf("教师[%s]密码强度不足，需至少8位且含字母和数字", username)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		var orgNodeID *string
		if orgPath != "" {
			oid, err := h.findOrgNodeByPath(ctx, tenantID, orgPath)
			if err != nil {
				msg := fmt.Sprintf("教师[%s]的组织节点[%s]解析失败: %v", username, orgPath, err)
				result.Errors = append(result.Errors, msg)
				if preview {
					previewRes.Errors = append(previewRes.Errors, msg)
				}
				// Continue without orgNodeID instead of failing the whole row
			} else {
				orgNodeID = &oid
			}
		}

		titleIDs := []string{}
		for _, tname := range titleNames {
			if tname == "" {
				continue
			}
			tid, _ := lookupIDByName(ctx, h.Store.Q(), "staff_titles", tenantID, tname)
			if tid != "" {
				titleIDs = append(titleIDs, tid)
			}
		}

		existingID := h.getUserID(ctx, tenantID, username)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, username, name)
				continue
			}
			if overwrite {
				if !preview {
					hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]密码加密失败: %v", username, err))
						continue
					}
					_, err = h.Store.Q().Exec(ctx, `
						UPDATE users SET name=$1, password_hash=$2, status=$3, org_node_id=$4, title_ids=$5, updated_at=NOW()
						WHERE id=$6 AND tenant_id=$7
					`, name, string(hash), status, orgNodeID, titleIDs, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]更新失败: %v", username, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新登录账号，按新对象导入
			username = uniqueSuffixed(username, func(c string) bool {
				return h.getUserID(ctx, tenantID, c) != ""
			})
		}

		if !preview {
			err = h.createUser(ctx, tenantID, institutionID, roleID, orgNodeID, nil, username, password, name, status)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]创建失败: %v", username, err))
				continue
			}
			if len(titleIDs) > 0 {
				var uid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND username=$2 LIMIT 1`, tenantID, username).Scan(&uid)
				if uid != "" {
					if _, err := h.Store.Q().Exec(ctx, `UPDATE users SET title_ids=$1 WHERE id=$2`, titleIDs, uid); err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]职称绑定失败: %v", username, err))
						continue
					}
				}
			}
			result.TeacherCreated++
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

func (h *ResourceImportHandler) getInstitutionID(ctx context.Context, tenantID string) *string {
	var id string
	_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM institutions WHERE tenant_id=$1 LIMIT 1`, tenantID).Scan(&id)
	if id == "" {
		return nil
	}
	return &id
}

func (h *ResourceImportHandler) getRoleIDByCode(ctx context.Context, tenantID, code string) string {
	var id string
	_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM roles WHERE tenant_id=$1 AND code=$2 LIMIT 1`, tenantID, code).Scan(&id)
	return id
}

func (h *ResourceImportHandler) getUserID(ctx context.Context, tenantID, username string) string {
	var id string
	_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND username=$2 LIMIT 1`, tenantID, username).Scan(&id)
	return id
}

func (h *ResourceImportHandler) createUser(ctx context.Context, tenantID string, institutionID *string, roleID string, orgNodeID, majorID *string, username, password, name, status string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	id := uuid.NewString()
	globalLoginName := tenantID + "_" + username

	// users.role 是平台分区枚举（school/enterprise/operator），不是角色代码。
	// portal 下的学生和教师统一使用 school。
	_, err = h.Store.Q().Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
	`, id, tenantID, institutionID, orgNodeID, majorID,
		domain.UserRoleSchool, "portal", globalLoginName, username, string(hash), name, "", nil, nil,
		nil, nil, nil, []string{}, domain.JSONMap{}, status)
	if err != nil {
		return err
	}

	if roleID != "" {
		_, _ = h.Store.Q().Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), id, roleID)
		_, _ = h.Store.Q().Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id=$1`, roleID)
	}
	return nil
}

// findOrgNodeByPath tries to find an organization node by its hierarchical path.
// Path segments can be separated by '-' or '/'.
// If the path has only one segment, it matches by name directly (when unique).
// For multi-segment paths, it verifies the ancestor chain.
func (h *ResourceImportHandler) findOrgNodeByPath(ctx context.Context, tenantID, path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("empty path")
	}

	var separators = []string{"-", "/", "\\", "->", "_"}
	var segments []string
	for _, sep := range separators {
		if strings.Contains(path, sep) {
			parts := strings.Split(path, sep)
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					segments = append(segments, p)
				}
			}
			break
		}
	}
	if len(segments) == 0 {
		segments = []string{path}
	}

	className := segments[len(segments)-1]

	// Query all candidate nodes with the target name
	rows, err := h.Store.Q().Query(ctx, `
		SELECT id, parent_id FROM organizations WHERE tenant_id=$1 AND name=$2
	`, tenantID, className)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	type node struct {
		id       string
		parentID *string
	}
	var candidates []node
	for rows.Next() {
		var n node
		if err := rows.Scan(&n.id, &n.parentID); err != nil {
			continue
		}
		candidates = append(candidates, n)
	}
	if err := rows.Err(); err != nil {
		return "", err
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("未找到组织节点: %s", className)
	}
	if len(candidates) == 1 && len(segments) == 1 {
		return candidates[0].id, nil
	}

	// Build ancestor chain for each candidate and match against segments
	for _, c := range candidates {
		chain, err := h.buildAncestorChain(ctx, tenantID, c.id)
		if err != nil {
			continue
		}
		if matchSegments(chain, segments) {
			return c.id, nil
		}
	}

	// If no path match, fall back to the unique name match if only one candidate
	if len(candidates) == 1 {
		return candidates[0].id, nil
	}

	return "", fmt.Errorf("找到多个名为[%s]的组织节点，请使用完整路径（如：学校-学院-班级）", className)
}

func (h *ResourceImportHandler) buildAncestorChain(ctx context.Context, tenantID, nodeID string) ([]string, error) {
	var chain []string
	currentID := nodeID
	seen := make(map[string]bool)
	for currentID != "" {
		if seen[currentID] {
			break
		}
		seen[currentID] = true
		var name string
		var parentID *string
		err := h.Store.Q().QueryRow(ctx, `
			SELECT name, parent_id FROM organizations WHERE tenant_id=$1 AND id=$2
		`, tenantID, currentID).Scan(&name, &parentID)
		if err != nil {
			return nil, err
		}
		chain = append([]string{name}, chain...)
		currentID = ""
		if parentID != nil {
			currentID = *parentID
		}
	}
	return chain, nil
}

func matchSegments(chain, segments []string) bool {
	if len(chain) < len(segments) {
		return false
	}
	// Match the last N segments of the chain against the provided segments
	offset := len(chain) - len(segments)
	for i, seg := range segments {
		if chain[offset+i] != seg {
			return false
		}
	}
	return true
}

func mapUserStatus(s, defaultVal string) string {
	s = strings.TrimSpace(s)
	switch s {
	case "active", "正常", "在籍", "在职":
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

// ===== Alliance Import Handlers =====

func (h *ResourceImportHandler) PreviewProjects(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-projects", h.doImportProjects, true)
}

func (h *ResourceImportHandler) ImportProjects(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-projects", h.doImportProjects, false)
}

func (h *ResourceImportHandler) PreviewAchievements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-achievements", h.doImportAchievements, true)
}

func (h *ResourceImportHandler) ImportAchievements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-achievements", h.doImportAchievements, false)
}

func (h *ResourceImportHandler) PreviewAgreements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-agreements", h.doImportAgreements, true)
}

func (h *ResourceImportHandler) ImportAgreements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-agreements", h.doImportAgreements, false)
}

func (h *ResourceImportHandler) PreviewPermissions(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-permissions", h.doImportPermissions, true)
}

func (h *ResourceImportHandler) ImportPermissions(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-permissions", h.doImportPermissions, false)
}

func (h *ResourceImportHandler) PreviewBrands(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-brands", h.doImportBrands, true)
}

func (h *ResourceImportHandler) ImportBrands(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-brands", h.doImportBrands, false)
}

// ===== Alliance doImport functions =====

// Sheet: 合作项目
// Sheet: 合作项目（与新建页字段一一对应，图片/附件除外）
// Columns: 项目名称*, 项目类型, 项目阶段, 开始日期, 结束日期, 描述, 预算, 关联合作企业, 关联二级学院, 公开显示
func (h *ResourceImportHandler) doImportProjects(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("合作项目")
	if err != nil {
		msg := fmt.Sprintf("读取「合作项目」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		projType := nullableStr(col(row, 1))
		phase := mapProjectPhase(col(row, 2))
		if phase == "" {
			phase = "initiation"
		}
		startDate := nullableStr(col(row, 3))
		endDate := nullableStr(col(row, 4))
		description := nullableStr(col(row, 5))
		budget := nullableStr(col(row, 6))
		enterpriseIDs := lookupIDsByNames(ctx, h.Store.Q(), "partner_enterprises", tenantID, col(row, 7))
		secondaryColleges := splitNames(col(row, 8))
		isPublic := parseImportBool(col(row, 9))

		existingID, _ := lookupIDByName(ctx, h.Store.Q(), "alliance_projects", tenantID, name)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, name, name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE alliance_projects SET type=$1, phase=$2, start_date=$3, end_date=$4,
							description=$5, budget=$6, enterprise_ids=$7, secondary_colleges=$8, is_public=$9, updated_at=NOW()
						WHERE id=$10 AND tenant_id=$11
					`, projType, phase, startDate, endDate, description, budget, jsonBytes(enterpriseIDs), jsonBytes(secondaryColleges), isPublic, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("项目[%s]更新失败: %v", name, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
			name = uniqueSuffixed(name, func(c string) bool {
				eid, _ := lookupIDByName(ctx, h.Store.Q(), "alliance_projects", tenantID, c)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err := h.Store.Q().Exec(ctx, `
				INSERT INTO alliance_projects (id, tenant_id, name, type, description, phase, publish_status,
					start_date, end_date, budget, enterprise_ids, agreement_ids, secondary_colleges, is_public,
					created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
			`, id, tenantID, name, projType, description, phase, "draft",
				startDate, endDate, budget, jsonBytes(enterpriseIDs),
				[]byte("[]"), jsonBytes(secondaryColleges), isPublic)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("项目[%s]创建失败: %v", name, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 合作成果（与新建页字段一一对应，图片/附件除外）
// Columns: 成果名称*, 成果类型, 描述, 成果日期, 关联归属项目, 关联合作企业, 关联二级学院, 公开显示
func (h *ResourceImportHandler) doImportAchievements(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("合作成果")
	if err != nil {
		msg := fmt.Sprintf("读取「合作成果」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		title := strings.TrimSpace(row[0])
		achType := mapAchievementType(col(row, 1))
		if achType == "" {
			achType = "custom"
		}
		description := nullableStr(col(row, 2))
		achievementDate := nullableStr(col(row, 3))
		projectIDs := lookupIDsByNames(ctx, h.Store.Q(), "alliance_projects", tenantID, col(row, 4))
		enterpriseIDs := lookupIDsByNames(ctx, h.Store.Q(), "partner_enterprises", tenantID, col(row, 5))
		secondaryColleges := splitNames(col(row, 6))
		isPublic := parseImportBool(col(row, 7))

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_achievements WHERE tenant_id=$1 AND title=$2 LIMIT 1`, tenantID, title).Scan(&existingID)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, title, title)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE alliance_achievements SET type=$1, description=$2, achievement_date=$3,
							project_ids=$4, enterprise_ids=$5, secondary_colleges=$6, is_public=$7, updated_at=NOW()
						WHERE id=$8 AND tenant_id=$9
					`, achType, description, achievementDate, jsonBytes(projectIDs), jsonBytes(enterpriseIDs), jsonBytes(secondaryColleges), isPublic, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("成果[%s]更新失败: %v", title, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新标题，按新对象导入
			title = uniqueSuffixed(title, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_achievements WHERE tenant_id=$1 AND title=$2 LIMIT 1`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err := h.Store.Q().Exec(ctx, `
				INSERT INTO alliance_achievements (id, tenant_id, title, type, description, achievement_date,
					attachments, images, owner_persons, co_builders, enterprise_ids, project_ids,
					related_positions, related_scenes, related_courses, status, view_count,
					secondary_colleges, is_public, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())
			`, id, tenantID, title, achType, description, achievementDate,
				[]byte("[]"), []byte("[]"), []byte("[]"), []byte("[]"),
				jsonBytes(enterpriseIDs), jsonBytes(projectIDs),
				[]byte("[]"), []byte("[]"), []byte("[]"), "draft", 0,
				jsonBytes(secondaryColleges), isPublic)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("成果[%s]创建失败: %v", title, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 合作协议（与新建页字段一一对应，图片/附件除外）
// Columns: 协议名称*, 协议类型, 开始日期, 结束日期, 状态, 内容, 关联归属项目, 关联合作企业, 公开显示
func (h *ResourceImportHandler) doImportAgreements(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("合作协议")
	if err != nil {
		msg := fmt.Sprintf("读取「合作协议」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		agmtType := nullableStr(col(row, 1))
		startDate := nullableStr(col(row, 2))
		endDate := nullableStr(col(row, 3))
		status := mapAgreementStatus(col(row, 4))
		if status == "" {
			status = "draft"
		}
		content := nullableStr(col(row, 5))
		projectIDs := lookupIDsByNames(ctx, h.Store.Q(), "alliance_projects", tenantID, col(row, 6))
		enterpriseIDs := lookupIDsByNames(ctx, h.Store.Q(), "partner_enterprises", tenantID, col(row, 7))
		isPublic := parseImportBool(col(row, 8))

		existingID, _ := lookupIDByName(ctx, h.Store.Q(), "alliance_agreements", tenantID, name)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, name, name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE alliance_agreements SET type=$1, start_date=$2, end_date=$3,
							status=$4, content=$5, project_ids=$6, enterprise_ids=$7, is_public=$8, updated_at=NOW()
						WHERE id=$9 AND tenant_id=$10
					`, agmtType, startDate, endDate, status, content, jsonBytes(projectIDs), jsonBytes(enterpriseIDs), isPublic, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("协议[%s]更新失败: %v", name, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
			name = uniqueSuffixed(name, func(c string) bool {
				eid, _ := lookupIDByName(ctx, h.Store.Q(), "alliance_agreements", tenantID, c)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err := h.Store.Q().Exec(ctx, `
				INSERT INTO alliance_agreements (id, tenant_id, name, type, content, start_date,
					end_date, status, enterprise_ids, project_ids, attachments, is_public, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
			`, id, tenantID, name, agmtType, content, startDate, endDate,
				status, jsonBytes(enterpriseIDs), jsonBytes(projectIDs), []byte("[]"), isPublic)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("协议[%s]创建失败: %v", name, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 合作权限
// Columns: 账号名称*, 账号类型, 是否启用
func (h *ResourceImportHandler) doImportPermissions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("合作权限")
	if err != nil {
		msg := fmt.Sprintf("读取「合作权限」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		accountName := strings.TrimSpace(row[0])
		accountType := mapAccountType(col(row, 1))
		if accountType == "" {
			accountType = "enterprise"
		}
		isEnabled := parseBoolDefault(col(row, 2), true)

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_permissions WHERE tenant_id=$1 AND account_name=$2 LIMIT 1`, tenantID, accountName).Scan(&existingID)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, accountName, accountName)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE alliance_permissions SET account_type=$1, is_enabled=$2, updated_at=NOW()
						WHERE id=$3 AND tenant_id=$4
					`, accountType, isEnabled, existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("权限[%s]更新失败: %v", accountName, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新账号名，按新对象导入
			accountName = uniqueSuffixed(accountName, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_permissions WHERE tenant_id=$1 AND account_name=$2 LIMIT 1`, tenantID, c).Scan(&eid)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err := h.Store.Q().Exec(ctx, `
				INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type,
					is_enabled, resource_permissions, platform_permissions, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
			`, id, tenantID, accountName, accountType, isEnabled, []byte("[]"), []byte("[]"))
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("权限[%s]创建失败: %v", accountName, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// Sheet: 品牌内容
// Columns: 品牌类型*, 名称*, 描述, 状态, 是否公开, 是否推荐, 封面图URL,
//
//	关联学生名称, 关联企业名称, 关联岗位名称, 关联专业名称, 关联教师名称, 关联专家名称
func (h *ResourceImportHandler) doImportBrands(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &resourceImportResult{}

	rows, err := xlsx.GetRows("品牌内容")
	if err != nil {
		msg := fmt.Sprintf("读取「品牌内容」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		brandType := mapBrandType(row[0])
		if brandType == "" {
			result.Failed++
			previewRes.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行品牌类型无法识别: %s", rowNum, row[0]))
			continue
		}
		name := strings.TrimSpace(row[1])
		description := nullableStr(col(row, 2))
		status := mapPublishStatus(col(row, 3))
		if status == "" {
			status = "draft"
		}
		isPublic := parseBoolDefault(col(row, 4), false)
		isFeatured := parseBoolDefault(col(row, 5), false)
		coverImage := nullableStr(col(row, 6))
		studentID := lookupSingleIDByName(ctx, h.Store.Q(), "users", tenantID, col(row, 7))
		enterpriseID := lookupSingleIDByName(ctx, h.Store.Q(), "partner_enterprises", tenantID, col(row, 8))
		positionID := lookupSingleIDByName(ctx, h.Store.Q(), "career_positions", tenantID, col(row, 9))
		majorID := lookupSingleIDByName(ctx, h.Store.Q(), "majors", tenantID, col(row, 10))
		teacherID := lookupSingleIDByName(ctx, h.Store.Q(), "users", tenantID, col(row, 11))
		expertID := lookupSingleIDByName(ctx, h.Store.Q(), "alliance_experts", tenantID, col(row, 12))

		var existingID string
		_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_brands WHERE tenant_id=$1 AND brand_type=$2 AND name=$3 LIMIT 1`, tenantID, brandType, name).Scan(&existingID)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, brandType+"|"+name, name)
				continue
			}
			if overwrite {
				if !preview {
					_, err := h.Store.Q().Exec(ctx, `
						UPDATE alliance_brands SET description=$1, status=$2, is_public=$3, is_featured=$4,
							cover_image=$5, student_id=$6, enterprise_id=$7, position_id=$8, major_id=$9,
							teacher_id=$10, expert_id=$11, updated_at=NOW()
						WHERE id=$12 AND tenant_id=$13
					`, description, status, isPublic, isFeatured, coverImage,
						studentID, enterpriseID, positionID, majorID, teacherID, expertID,
						existingID, tenantID)
					if err != nil {
						result.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("品牌[%s/%s]更新失败: %v", brandType, name, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
			name = uniqueSuffixed(name, func(c string) bool {
				var eid string
				_ = h.Store.Q().QueryRow(ctx, `SELECT id FROM alliance_brands WHERE tenant_id=$1 AND brand_type=$2 AND name=$3 LIMIT 1`, tenantID, brandType, c).Scan(&eid)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			_, err := h.Store.Q().Exec(ctx, `
				INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public,
					is_featured, cover_image, description, student_id, enterprise_id, position_id,
					major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
			`, id, tenantID, brandType, name, status, isPublic, isFeatured, coverImage, description,
				studentID, enterpriseID, positionID, majorID, teacherID, expertID, 0, 0)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("品牌[%s/%s]创建失败: %v", brandType, name, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}
