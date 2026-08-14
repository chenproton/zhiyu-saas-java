package service

// ResourceImportService 门户基础数据 + 联盟业务 Excel 导入编排：
// 行业/专业/组织/学生/教师 + 项目/成果/协议/权限/品牌 各实体的导入逻辑
// 全部收敛在此（原 resource_import_handler.go 内联逻辑下沉）。SQL 唯一所在地仍在 store 包。

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// brandRefItem 品牌引用项（ID+名称）。
type brandRefItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// boolPtr 返回布尔指针。
func boolPtr(b bool) *bool { return &b }

// ResourceImportService 资源导入编排服务。

// importTeacherProfile 校本师资资料补充字段（对齐「编辑资料」弹窗）。
type importTeacherProfile struct {
	gender          *string
	age             *int
	city            *string
	title           *string
	position        *string
	experienceYears *int
	education       *string
	industry        *string
	specialties     []string
	introduction    *string
	workExperience  *string
	avatarURL       *string
}

// brandImportRow 品牌导入行（单元格是否填写标记用于覆盖导入保留原值）。
type brandImportRow struct {
	name        string
	description *string
	status      string
	isPublic    bool
	isFeatured  bool
	// 单元格是否填写（覆盖导入时空单元格保留原值，防把已公开/已推荐品牌静默下架）
	isPublicFilled   bool
	isFeaturedFilled bool
	statusFilled     bool
	coverImage       *string
	studentID        *string
	enterpriseID     *string
	positionID       *string
	majorID          *string
	teacherID        *string
	expertID         *string
	data             json.RawMessage
	enterprisePos    *store.ImportEnterprisePositionParams // job 企业岗位
	teacherProfile   *importTeacherProfile                 // teacher 校本师资资料补充
}

type ResourceImportService struct {
	s *Service
}

func NewResourceImportService(s *Service) *ResourceImportService {
	return &ResourceImportService{s: s}
}

type ResourceImportResult struct {
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

func (s *ResourceImportService) DoImportIndustries(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		sortOrder := ParseIntDefault(Col(row, 3), 0)
		enabled := parseBoolDefault(Col(row, 4), true)

		existingID := store.GetIndustryIDByCode(ctx, s.s.Store().Q(), tenantID, code)

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
					err := store.UpdateIndustry(ctx, s.s.Store().Q(), existingID, tenantID, name, enabled, sortOrder)
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
			code = UniqueSuffixed(code, func(c string) bool {
				return store.GetIndustryIDByCode(ctx, s.s.Store().Q(), tenantID, c) != ""
			})
		}

		id := uuid.NewString()
		if !preview {
			err = store.InsertIndustry(ctx, s.s.Store().Q(), id, tenantID, code, name, enabled, sortOrder)
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
			parentID = store.GetIndustryIDByCode(ctx, s.s.Store().Q(), tenantID, parentCode)
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
			if err := store.UpdateIndustryParent(ctx, s.s.Store().Q(), parentID, id, tenantID); err != nil {
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

func (s *ResourceImportService) DoImportMajors(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		alias := NullableStr(Col(row, 2))
		enabled := parseBoolDefault(Col(row, 3), true)

		existingID := store.GetMajorIDByCode(ctx, s.s.Store().Q(), tenantID, code)

		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, code, name)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateMajor(ctx, s.s.Store().Q(), existingID, tenantID, name, alias, enabled)
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
			code = UniqueSuffixed(code, func(c string) bool {
				return store.GetMajorIDByCode(ctx, s.s.Store().Q(), tenantID, c) != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err = store.InsertMajor(ctx, s.s.Store().Q(), id, tenantID, code, name, alias, enabled)
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

func (s *ResourceImportService) DoImportOrganizations(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
	typeNameToID = store.LoadOrgTypeNameToID(ctx, s.s.Store().Q(), tenantID)

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
		parentName := Col(row, 2)
		sortOrder := ParseIntDefault(Col(row, 3), 0)

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
				pid, _ := LookupIDByName(ctx, s.s.Store().Q(), "organizations", tenantID, parentName)
				if pid != "" {
					parentID = &pid
				}
			}
		}

		existingID := store.GetOrganizationIDByNameAndType(ctx, s.s.Store().Q(), tenantID, name, typeID)
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
					err := store.UpdateOrganization(ctx, s.s.Store().Q(), existingID, tenantID, name, typeID, parentID, sortOrder)
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
			name = UniqueSuffixed(name, func(c string) bool {
				return store.GetOrganizationIDByNameAndType(ctx, s.s.Store().Q(), tenantID, c, typeID) != ""
			})
		}

		id := uuid.NewString()
		if !preview {
			err = store.InsertOrganization(ctx, s.s.Store().Q(), id, tenantID, name, typeID, parentID, sortOrder)
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

func (s *ResourceImportService) DoImportStudents(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

	rows, err := xlsx.GetRows("学生列表")
	if err != nil {
		msg := fmt.Sprintf("读取「学生列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	institutionID := s.getInstitutionID(ctx, tenantID)
	roleID := s.getRoleIDByCode(ctx, tenantID, domain.RoleStudent)
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
		status := mapUserStatus(Col(row, 4), "active")

		if !IsStrongPassword(password) {
			msg := fmt.Sprintf("学生[%s]密码强度不足，需至少8位且含字母和数字", username)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		orgNodeID, err := s.findOrgNodeByPath(ctx, tenantID, classPath)
		if err != nil {
			msg := fmt.Sprintf("学生[%s]的班级[%s]解析失败: %v", username, classPath, err)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		existingID := s.getUserID(ctx, tenantID, username)
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
					err = store.UpdateImportUser(ctx, s.s.Store().Q(), existingID, tenantID, name, string(hash), status, orgNodeID)
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
			username = UniqueSuffixed(username, func(c string) bool {
				return s.getUserID(ctx, tenantID, c) != ""
			})
		}

		if !preview {
			err = s.createUser(ctx, tenantID, institutionID, roleID, &orgNodeID, nil, username, password, name, status)
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

func (s *ResourceImportService) DoImportTeachers(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

	rows, err := xlsx.GetRows("教师列表")
	if err != nil {
		msg := fmt.Sprintf("读取「教师列表」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}

	institutionID := s.getInstitutionID(ctx, tenantID)
	roleID := s.getRoleIDByCode(ctx, tenantID, domain.RoleTeacher)
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
		orgPath := Col(row, 3)
		titleNames := SplitTrim(Col(row, 4), ",")
		status := mapUserStatus(Col(row, 5), "active")

		if !IsStrongPassword(password) {
			msg := fmt.Sprintf("教师[%s]密码强度不足，需至少8位且含字母和数字", username)
			result.Failed++
			result.Errors = append(result.Errors, msg)
			previewRes.Failed++
			previewRes.Errors = append(previewRes.Errors, msg)
			continue
		}

		var orgNodeID *string
		if orgPath != "" {
			oid, err := s.findOrgNodeByPath(ctx, tenantID, orgPath)
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
			tid, _ := LookupIDByName(ctx, s.s.Store().Q(), "staff_titles", tenantID, tname)
			if tid != "" {
				titleIDs = append(titleIDs, tid)
			}
		}

		existingID := s.getUserID(ctx, tenantID, username)
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
					err = store.UpdateImportTeacher(ctx, s.s.Store().Q(), existingID, tenantID, name, string(hash), status, orgNodeID, titleIDs)
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
			username = UniqueSuffixed(username, func(c string) bool {
				return s.getUserID(ctx, tenantID, c) != ""
			})
		}

		if !preview {
			err = s.createUser(ctx, tenantID, institutionID, roleID, orgNodeID, nil, username, password, name, status)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("教师[%s]创建失败: %v", username, err))
				continue
			}
			if len(titleIDs) > 0 {
				uid := s.getUserID(ctx, tenantID, username)
				if uid != "" {
					if err := store.UpdateUserTitleIDs(ctx, s.s.Store().Q(), uid, titleIDs); err != nil {
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

func (s *ResourceImportService) getInstitutionID(ctx context.Context, tenantID string) *string {
	id := store.GetInstitutionID(ctx, s.s.Store().Q(), tenantID)
	if id == "" {
		return nil
	}
	return &id
}

func (s *ResourceImportService) getRoleIDByCode(ctx context.Context, tenantID, code string) string {
	return store.GetRoleIDByTenantAndCode(ctx, s.s.Store().Q(), tenantID, code)
}

func (s *ResourceImportService) getUserID(ctx context.Context, tenantID, username string) string {
	return store.GetUserIDByUsername(ctx, s.s.Store().Q(), tenantID, username)
}

func (s *ResourceImportService) createUser(ctx context.Context, tenantID string, institutionID *string, roleID string, orgNodeID, majorID *string, username, password, name, status string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	id := uuid.NewString()
	globalLoginName := tenantID + "_" + username

	// users.role 是平台分区枚举（school/enterprise/operator），不是角色代码。
	// portal 下的学生和教师统一使用 school。
	if err := store.InsertImportUser(ctx, s.s.Store().Q(), store.ImportUserParams{
		ID:            id,
		TenantID:      tenantID,
		InstitutionID: institutionID,
		OrgNodeID:     orgNodeID,
		MajorID:       majorID,
		Role:          domain.UserRoleSchool,
		Platform:      "portal",
		LoginName:     globalLoginName,
		Username:      username,
		PasswordHash:  string(hash),
		Name:          name,
		Email:         "",
		Phone:         nil,
		AvatarURL:     nil,
		StudentNo:     nil,
		WorkID:        nil,
		IDCard:        nil,
		TitleIDs:      []string{},
		OAuth:         domain.JSONMap{},
		Status:        status,
	}); err != nil {
		return err
	}

	if roleID != "" {
		// 先判绑定插入错误，失败则不递增计数，避免 user_count 漂移
		if err := store.InsertUserRole(ctx, s.s.Store().Q(), uuid.NewString(), id, roleID); err != nil {
			return err
		}
		if err := store.IncrementRoleUserCount(ctx, s.s.Store().Q(), roleID); err != nil {
			return err
		}
	}
	return nil
}

// findOrgNodeByPath tries to find an organization node by its hierarchical path.
// Path segments can be separated by '-' or '/'.
// If the path has only one segment, it matches by name directly (when unique).
// For multi-segment paths, it verifies the ancestor chain.

func (s *ResourceImportService) findOrgNodeByPath(ctx context.Context, tenantID, path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("empty path")
	}

	// "->" 必须排在 "-" 之前：否则含 "-" 的路径会先按 "-" 拆分产生孤立 ">" 段
	var separators = []string{"->", "-", "/", "\\", "_"}
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

	candidates, err := store.FindOrgNodeCandidates(ctx, s.s.Store().Q(), tenantID, className)
	if err != nil {
		return "", err
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("未找到组织节点: %s", className)
	}
	if len(candidates) == 1 && len(segments) == 1 {
		return candidates[0].ID, nil
	}

	// Build ancestor chain for each candidate and match against segments
	for _, c := range candidates {
		chain, err := s.buildAncestorChain(ctx, tenantID, c.ID)
		if err != nil {
			continue
		}
		if matchSegments(chain, segments) {
			return c.ID, nil
		}
	}

	// If no path match, fall back to the unique name match if only one candidate
	if len(candidates) == 1 {
		return candidates[0].ID, nil
	}

	return "", fmt.Errorf("找到多个名为[%s]的组织节点，请使用完整路径（如：学校-学院-班级）", className)
}

func (s *ResourceImportService) buildAncestorChain(ctx context.Context, tenantID, nodeID string) ([]string, error) {
	var chain []string
	currentID := nodeID
	seen := make(map[string]bool)
	for currentID != "" {
		if seen[currentID] {
			break
		}
		seen[currentID] = true
		name, parentID, err := store.GetOrgNodeNameAndParent(ctx, s.s.Store().Q(), tenantID, currentID)
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

func (s *ResourceImportService) DoImportProjects(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		projType := NullableStr(Col(row, 1))
		phase := MapProjectPhase(Col(row, 2))
		if phase == "" {
			phase = "initiation"
		}
		budget := NullableStr(Col(row, 3))
		startDate := NullableStr(Col(row, 4))
		endDate := NullableStr(Col(row, 5))
		description := NullableStr(Col(row, 6))
		enterpriseIDs := LookupIDsByNames(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, Col(row, 7))
		if !preview && len(enterpriseIDs) > 0 {
			if err := s.s.Store().AllianceEnterpriseLinks().EnsureLinksByEnterpriseIDs(ctx, tenantID, enterpriseIDs, NullableStr(userID)); err != nil {
				slog.Warn("导入项目补建企业合作关联失败", "project", name, "error", err)
			}
		}
		secondaryColleges := SplitNames(Col(row, 8))
		isPublic := ParseImportBool(Col(row, 9))

		existingID, _ := LookupIDByName(ctx, s.s.Store().Q(), "alliance_projects", tenantID, name)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, name, name)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateAllianceProjectImport(ctx, s.s.Store().Q(), existingID, tenantID,
						projType, phase, startDate, endDate, description, budget,
						JsonBytes(enterpriseIDs), JsonBytes(secondaryColleges), isPublic)
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
			name = UniqueSuffixed(name, func(c string) bool {
				eid, _ := LookupIDByName(ctx, s.s.Store().Q(), "alliance_projects", tenantID, c)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err := store.InsertAllianceProjectImport(ctx, s.s.Store().Q(), id, tenantID,
				name, projType, description, phase, startDate, endDate, budget,
				JsonBytes(enterpriseIDs), []byte("[]"), JsonBytes(secondaryColleges), isPublic)
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

// Sheet: 合作成果（与新建页字段一一对应：成果名称*、成果类型、成果日期、成果描述、归属项目、合作企业、二级学院、公开显示；封面图片除外）

func (s *ResourceImportService) DoImportAchievements(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		achType := MapAchievementType(Col(row, 1))
		if achType == "" {
			achType = "custom"
		}
		achievementDate := NullableStr(Col(row, 2))
		description := NullableStr(Col(row, 3))
		projectIDs := LookupIDsByNames(ctx, s.s.Store().Q(), "alliance_projects", tenantID, Col(row, 4))
		enterpriseIDs := LookupIDsByNames(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, Col(row, 5))
		if !preview && len(enterpriseIDs) > 0 {
			if err := s.s.Store().AllianceEnterpriseLinks().EnsureLinksByEnterpriseIDs(ctx, tenantID, enterpriseIDs, NullableStr(userID)); err != nil {
				slog.Warn("导入成果补建企业合作关联失败", "achievement", title, "error", err)
			}
		}
		secondaryColleges := SplitNames(Col(row, 6))
		isPublic := ParseImportBool(Col(row, 7))

		existingID := store.GetAchievementIDByTitle(ctx, s.s.Store().Q(), tenantID, title)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, title, title)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateAllianceAchievementImport(ctx, s.s.Store().Q(), existingID, tenantID,
						achType, description, achievementDate,
						JsonBytes(projectIDs), JsonBytes(enterpriseIDs), JsonBytes(secondaryColleges), isPublic)
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
			title = UniqueSuffixed(title, func(c string) bool {
				return store.GetAchievementIDByTitle(ctx, s.s.Store().Q(), tenantID, c) != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err := store.InsertAllianceAchievementImport(ctx, s.s.Store().Q(), id, tenantID,
				title, achType, description, achievementDate,
				JsonBytes(enterpriseIDs), JsonBytes(projectIDs), JsonBytes(secondaryColleges), isPublic)
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

// Sheet: 合作协议（与新建页字段一一对应：协议名称*、协议类型、协议状态、开始日期、结束日期、内容、合作企业、关联项目；附件图片除外）
// 前台展示无独立开关，跟随关联的合作企业/项目展示，导入不再含"公开显示"列。

func (s *ResourceImportService) DoImportAgreements(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		agmtType := NullableStr(Col(row, 1))
		status := MapAgreementStatus(Col(row, 2))
		if status == "" {
			status = "draft"
		}
		startDate := NullableStr(Col(row, 3))
		endDate := NullableStr(Col(row, 4))
		content := NullableStr(Col(row, 5))
		enterpriseIDs := LookupIDsByNames(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, Col(row, 6))
		if !preview && len(enterpriseIDs) > 0 {
			if err := s.s.Store().AllianceEnterpriseLinks().EnsureLinksByEnterpriseIDs(ctx, tenantID, enterpriseIDs, NullableStr(userID)); err != nil {
				slog.Warn("导入协议补建企业合作关联失败", "agreement", name, "error", err)
			}
		}
		projectIDs := LookupIDsByNames(ctx, s.s.Store().Q(), "alliance_projects", tenantID, Col(row, 7))

		existingID, _ := LookupIDByName(ctx, s.s.Store().Q(), "alliance_agreements", tenantID, name)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, name, name)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateAllianceAgreementImport(ctx, s.s.Store().Q(), existingID, tenantID,
						agmtType, startDate, endDate, status, content,
						JsonBytes(projectIDs), JsonBytes(enterpriseIDs))
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
			name = UniqueSuffixed(name, func(c string) bool {
				eid, _ := LookupIDByName(ctx, s.s.Store().Q(), "alliance_agreements", tenantID, c)
				return eid != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err := store.InsertAllianceAgreementImport(ctx, s.s.Store().Q(), id, tenantID,
				name, agmtType, content, startDate, endDate, status,
				JsonBytes(enterpriseIDs), JsonBytes(projectIDs))
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

func (s *ResourceImportService) DoImportPermissions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		accountType := MapAccountType(Col(row, 1))
		if accountType == "" {
			accountType = "enterprise"
		}
		isEnabled := parseBoolDefault(Col(row, 2), true)

		existingID := store.GetPermissionIDByAccountName(ctx, s.s.Store().Q(), tenantID, accountName)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, accountName, accountName)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateAlliancePermissionImport(ctx, s.s.Store().Q(), existingID, tenantID, accountType, isEnabled)
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
			accountName = UniqueSuffixed(accountName, func(c string) bool {
				return store.GetPermissionIDByAccountName(ctx, s.s.Store().Q(), tenantID, c) != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err := store.InsertAlliancePermissionImport(ctx, s.s.Store().Q(), id, tenantID,
				accountName, accountType, isEnabled, []byte("[]"), []byte("[]"))
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

// DoImportBrands 品牌导入入口：brandType 为空时走通用模板（含品牌类型列，向后兼容），
// 传入 brandType 时按页面类型化解析（模板与 generateBrandTypeTemplate 对齐）。

func (s *ResourceImportService) DoImportBrands(ctx context.Context, xlsx *excelize.File, tenantID, userID, brandType string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	if brandType != "" {
		return s.DoImportBrandsTyped(ctx, xlsx, tenantID, userID, brandType, preview, overwrite, rename)
	}
	return s.DoImportBrandsGeneric(ctx, xlsx, tenantID, userID, preview, overwrite, rename)
}

// Sheet: 品牌内容（通用模板）
// Columns: 品牌类型*, 名称*, 描述, 状态, 是否公开, 是否推荐, 封面图URL,
//
//	关联学生名称, 关联企业名称, 关联岗位名称, 关联专业名称, 关联教师名称, 关联专家名称

func (s *ResourceImportService) DoImportBrandsGeneric(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

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
		brandType := MapBrandType(row[0])
		if brandType == "" {
			result.Failed++
			previewRes.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行品牌类型无法识别: %s", rowNum, row[0]))
			continue
		}
		name := strings.TrimSpace(row[1])
		description := NullableStr(Col(row, 2))
		status := MapPublishStatus(Col(row, 3))
		if status == "" {
			status = "draft"
		}
		isPublic := parseBoolDefault(Col(row, 4), false)
		isFeatured := parseBoolDefault(Col(row, 5), false)
		coverImage := NullableStr(Col(row, 6))
		studentID := LookupSingleIDByName(ctx, s.s.Store().Q(), "users", tenantID, Col(row, 7))
		enterpriseID := LookupSingleIDByName(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, Col(row, 8))
		if !preview && enterpriseID != nil && *enterpriseID != "" {
			if err := s.s.Store().AllianceEnterpriseLinks().EnsureLinksByEnterpriseIDs(ctx, tenantID, []string{*enterpriseID}, NullableStr(userID)); err != nil {
				slog.Warn("导入品牌补建企业合作关联失败", "brand", name, "error", err)
			}
		}
		positionID := LookupSingleIDByName(ctx, s.s.Store().Q(), "career_positions", tenantID, Col(row, 9))
		majorID := LookupSingleIDByName(ctx, s.s.Store().Q(), "majors", tenantID, Col(row, 10))
		teacherID := LookupSingleIDByName(ctx, s.s.Store().Q(), "users", tenantID, Col(row, 11))
		expertID := LookupSingleIDByName(ctx, s.s.Store().Q(), "alliance_experts", tenantID, Col(row, 12))

		existingID := store.GetBrandIDByTypeAndName(ctx, s.s.Store().Q(), tenantID, brandType, name)
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, brandType+"|"+name, name)
				continue
			}
			if overwrite {
				if !preview {
					err := store.UpdateAllianceBrandImport(ctx, s.s.Store().Q(), existingID, tenantID,
						description, status, isPublic, isFeatured, coverImage,
						studentID, enterpriseID, positionID, majorID, teacherID, expertID)
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
			name = UniqueSuffixed(name, func(c string) bool {
				return store.GetBrandIDByTypeAndName(ctx, s.s.Store().Q(), tenantID, brandType, c) != ""
			})
		}

		if !preview {
			id := uuid.NewString()
			err := store.InsertAllianceBrandImport(ctx, s.s.Store().Q(), id, tenantID,
				brandType, name, status, isPublic, isFeatured, coverImage, description,
				studentID, enterpriseID, positionID, majorID, teacherID, expertID)
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

// ===== 品牌导入（按页面类型化模板） =====

// brandImportRow 类型化导入单行解析结果。

func headerIndex(rows [][]string) map[string]int {
	idx := make(map[string]int)
	if len(rows) < 2 {
		return idx
	}
	for i, h := range rows[1] {
		h = strings.TrimSpace(h)
		if h == "" {
			continue
		}
		idx[strings.TrimSpace(strings.TrimSuffix(h, "*"))] = i
	}
	return idx
}

// cell 按表头名读取单元格值。

func cell(row []string, idx map[string]int, key string) string {
	if i, ok := idx[key]; ok {
		return Col(row, i)
	}
	return ""
}

// splitMulti 按中文/英文分号、逗号拆分多值列，空项忽略。

func splitMulti(s string) []string {
	var out []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool {
		return r == ';' || r == '；' || r == ',' || r == '，'
	}) {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// brandRefItem 品牌 data 内引用项（与前端 RefItem 结构一致）。

func (s *ResourceImportService) DoImportBrandsTyped(ctx context.Context, xlsx *excelize.File, tenantID, userID, brandType string, preview, overwrite, rename bool) (*ImportPreviewResult, *ResourceImportResult) {
	previewRes := &ImportPreviewResult{}
	result := &ResourceImportResult{}

	rows, err := xlsx.GetRows("品牌内容")
	if err != nil {
		msg := fmt.Sprintf("读取「品牌内容」Sheet 失败: %v", err)
		result.Errors = append(result.Errors, msg)
		previewRes.Errors = append(previewRes.Errors, msg)
		return previewRes, result
	}
	idx := headerIndex(rows)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		rw, err := s.parseBrandRow(ctx, tenantID, row, idx, brandType)
		if err != nil {
			result.Failed++
			previewRes.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行%s", rowNum, err.Error()))
			continue
		}
		if rw == nil {
			// major 空白行（未开启展示且未填任何内容）跳过，不创建品牌
			continue
		}

		existingID, err := s.s.Store().Alliance().GetBrandByName(ctx, tenantID, brandType, rw.name)
		if err != nil {
			result.Failed++
			previewRes.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行查询品牌失败: %v", rowNum, err))
			continue
		}
		if existingID != "" {
			if !overwrite && !(rename && !preview) {
				result.Skipped++
				previewRes.Duplicates++
				appendDuplicate(previewRes, rowNum, brandType+"|"+rw.name, rw.name)
				continue
			}
			if overwrite {
				existing, err := s.s.Store().Alliance().GetBrandByID(ctx, existingID, tenantID)
				if err != nil {
					result.Failed++
					previewRes.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("第%d行品牌[%s]读取失败: %v", rowNum, rw.name, err))
					continue
				}
				if !preview {
					// 企业岗位覆盖：已有岗位则更新其内容，无则新建
					if rw.enterprisePos != nil {
						pid, err := s.s.Store().ImportSaveEnterprisePosition(ctx, tenantID, userID, strPtrValue(existing.PositionID), rw.enterprisePos)
						if err != nil {
							result.Failed++
							previewRes.Failed++
							result.Errors = append(result.Errors, fmt.Sprintf("第%d行企业岗位保存失败: %v", rowNum, err))
							continue
						}
						rw.positionID = &pid
					}
					if rw.teacherProfile != nil {
						eid, err := s.upsertTeacherProfile(ctx, tenantID, rw)
						if err != nil {
							result.Failed++
							previewRes.Failed++
							result.Errors = append(result.Errors, fmt.Sprintf("第%d行师资资料保存失败: %v", rowNum, err))
							continue
						}
						rw.data = teacherData(eid)
					}
					if err := s.updateBrandFromImport(ctx, tenantID, existing, rw); err != nil {
						result.Failed++
						previewRes.Failed++
						result.Errors = append(result.Errors, fmt.Sprintf("第%d行品牌[%s]更新失败: %v", rowNum, rw.name, err))
						continue
					}
				}
				result.Created++
				previewRes.Created++
				continue
			}
			// rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
			rw.name = UniqueSuffixed(rw.name, func(c string) bool {
				eid, _ := s.s.Store().Alliance().GetBrandByName(ctx, tenantID, brandType, c)
				return eid != ""
			})
		}

		if !preview {
			// 企业岗位 / 校本师资档案：仅执行阶段落库
			if rw.enterprisePos != nil {
				pid, err := s.s.Store().ImportSaveEnterprisePosition(ctx, tenantID, userID, "", rw.enterprisePos)
				if err != nil {
					result.Failed++
					previewRes.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("第%d行企业岗位创建失败: %v", rowNum, err))
					continue
				}
				rw.positionID = &pid
			}
			if rw.teacherProfile != nil {
				eid, err := s.upsertTeacherProfile(ctx, tenantID, rw)
				if err != nil {
					result.Failed++
					previewRes.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("第%d行师资资料创建失败: %v", rowNum, err))
					continue
				}
				rw.data = teacherData(eid)
			}
			if err := s.createBrandFromImport(ctx, tenantID, brandType, rw); err != nil {
				result.Failed++
				previewRes.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行品牌[%s]创建失败: %v", rowNum, rw.name, err))
				continue
			}
		}
		result.Created++
		previewRes.Created++
	}

	return previewRes, result
}

// parseBrandRow 按品牌类型解析一行。

func (s *ResourceImportService) parseBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int, brandType string) (*brandImportRow, error) {
	switch brandType {
	case "talent":
		return s.parseTalentBrandRow(ctx, tenantID, row, idx)
	case "employer":
		return s.parseEmployerBrandRow(ctx, tenantID, row, idx)
	case "job":
		return s.parseJobBrandRow(ctx, tenantID, row, idx)
	case "major":
		return s.parseMajorBrandRow(ctx, tenantID, row, idx)
	case "teacher":
		return s.parseTeacherBrandRow(ctx, tenantID, row, idx)
	case "culture":
		return s.parseCultureBrandRow(ctx, tenantID, row, idx)
	}
	return nil, fmt.Errorf("品牌类型无法识别: %s", brandType)
}

func (s *ResourceImportService) parseTalentBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	name := cell(row, idx, "案例名称")
	if name == "" {
		return nil, fmt.Errorf("案例名称不能为空")
	}
	rw := &brandImportRow{name: name, status: "draft"}
	rw.description = NullableStr(cell(row, idx, "描述"))
	if sv := MapPublishStatus(cell(row, idx, "状态")); sv != "" {
		rw.status = sv
		rw.statusFilled = true
	}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	rw.coverImage = NullableStr(cell(row, idx, "封面图URL"))
	if sv := cell(row, idx, "关联学生名称"); sv != "" {
		id, err := store.LookupUserIDByNameWithRole(ctx, s.s.Store().Q(), tenantID, sv, domain.RoleStudent)
		if err != nil {
			return nil, fmt.Errorf("关联学生匹配失败: %v", err)
		}
		if id == "" {
			return nil, fmt.Errorf("学生「%sv」未找到", sv)
		}
		rw.studentID = &id
	}
	if sv := cell(row, idx, "关联专业名称"); sv != "" {
		id := LookupSingleIDByName(ctx, s.s.Store().Q(), "majors", tenantID, sv)
		if id == nil || *id == "" {
			return nil, fmt.Errorf("专业「%sv」未找到", sv)
		}
		rw.majorID = id
	}
	return rw, nil
}

func (s *ResourceImportService) parseEmployerBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	entType := MapDictValue(cell(row, idx, "企业类型"),
		"合作企业", "enterprise", "合作", "enterprise", "企业", "enterprise", "enterprise", "enterprise",
		"独立雇主企业", "independent", "独立雇主", "independent", "独立", "independent", "independent", "independent")
	name := cell(row, idx, "企业名称")
	if name == "" {
		return nil, fmt.Errorf("企业名称不能为空")
	}
	rw := &brandImportRow{name: name, status: "draft"}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	switch entType {
	case "enterprise":
		id := LookupSingleIDByName(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, name)
		if id == nil || *id == "" {
			return nil, fmt.Errorf("合作企业「%s」未找到（需与「合作企业库」名称一致）", name)
		}
		rw.enterpriseID = id
	case "independent":
		raw, err := json.Marshal(map[string]any{"enterpriseInfo": buildEnterpriseInfo(row, idx, name)})
		if err != nil {
			return nil, fmt.Errorf("独立雇主资料组装失败: %v", err)
		}
		rw.data = raw
	default:
		return nil, fmt.Errorf("企业类型无法识别: %s", cell(row, idx, "企业类型"))
	}
	return rw, nil
}

// buildEnterpriseInfo 组装独立雇主企业资料（字段与前端 EnterpriseInfo 一致）。

func buildEnterpriseInfo(row []string, idx map[string]int, name string) map[string]any {
	info := map[string]any{"name": name, "enterpriseType": "third-party"}
	setStr := func(k, colName string) {
		if v := cell(row, idx, colName); v != "" {
			info[k] = v
		}
	}
	setInt := func(k, colName string) {
		if v := strings.TrimRight(cell(row, idx, colName), "Kk"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				info[k] = n
			}
		}
	}
	setMulti := func(k, colName string) {
		if v := splitMulti(cell(row, idx, colName)); len(v) > 0 {
			info[k] = v
		}
	}
	setStr("unifiedSocialCreditCode", "统一社会信用代码")
	setStr("industry", "所属行业")
	setStr("region", "所在地区")
	setInt("establishedYear", "成立年份")
	setInt("employeeCount", "企业规模（人数）")
	setMulti("secondaryColleges", "关联二级学院")
	setStr("description", "企业简介")
	setStr("contactPerson", "联系人")
	setStr("contactPhone", "联系电话")
	setStr("contactEmail", "联系邮箱")
	setStr("address", "详细地址")
	setStr("logoUrl", "企业Logo URL")
	setStr("coverImage", "企业主页封面 URL")
	setMulti("coverPhotos", "企业风采照片URL")
	setMulti("businessLicensePhotos", "企业营业执照URL")
	setMulti("intellectualPropertyPhotos", "企业知识产权URL")
	setMulti("qualificationPhotos", "企业荣誉资质URL")
	return info
}

func (s *ResourceImportService) parseJobBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	posType := MapDictValue(cell(row, idx, "岗位类型"),
		"教学岗位", "teaching", "教学", "teaching", "teaching", "teaching",
		"企业岗位", "enterprise", "企业", "enterprise", "enterprise", "enterprise")
	name := cell(row, idx, "岗位名称")
	if name == "" {
		return nil, fmt.Errorf("岗位名称不能为空")
	}
	rw := &brandImportRow{name: name, status: "draft"}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	switch posType {
	case "teaching":
		id, err := store.LookupTeachingPositionIDByName(ctx, s.s.Store().Q(), tenantID, name)
		if err != nil {
			return nil, fmt.Errorf("关联岗位匹配失败: %v", err)
		}
		if id == "" {
			return nil, fmt.Errorf("教学岗位「%s」未找到（需与「职业岗位库」名称一致）", name)
		}
		rw.positionID = &id
	case "enterprise":
		pos := &store.ImportEnterprisePositionParams{}
		if v := strings.TrimRight(cell(row, idx, "薪资下限(K)"), "Kk"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				pos.SalaryMin = &n
			}
		}
		if v := strings.TrimRight(cell(row, idx, "薪资上限(K)"), "Kk"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				pos.SalaryMax = &n
			}
		}
		if v := cell(row, idx, "所属行业"); v != "" {
			if id := LookupSingleIDByName(ctx, s.s.Store().Q(), "industries", tenantID, v); id != nil {
				pos.IndustryID = id
			}
		}
		pos.Description = NullableStr(cell(row, idx, "岗位简介"))
		pos.Requirements = splitMulti(cell(row, idx, "任职要求"))
		pos.CareerPath = NullableStr(cell(row, idx, "职业发展路径"))
		for _, n := range splitMulti(cell(row, idx, "面向专业")) {
			if id := LookupSingleIDByName(ctx, s.s.Store().Q(), "majors", tenantID, n); id != nil && *id != "" {
				pos.MajorIDs = append(pos.MajorIDs, *id)
			}
		}
		// 岗位职责：每行一条「职责名|职责描述」，多条用换行分隔
		for _, line := range strings.Split(cell(row, idx, "岗位职责"), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			parts := strings.SplitN(line, "|", 2)
			if len(parts) == 1 {
				parts = strings.SplitN(line, "｜", 2)
			}
			resp := store.ImportPositionResponsibility{Name: strings.TrimSpace(parts[0])}
			if len(parts) == 2 {
				resp.Description = NullableStr(parts[1])
			}
			if resp.Name != "" {
				pos.Responsibilities = append(pos.Responsibilities, resp)
			}
		}
		rw.enterprisePos = pos
	default:
		return nil, fmt.Errorf("岗位类型无法识别: %s", cell(row, idx, "岗位类型"))
	}
	return rw, nil
}

func (s *ResourceImportService) parseMajorBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	name := cell(row, idx, "专业名称")
	if name == "" {
		return nil, fmt.Errorf("专业名称不能为空")
	}
	id := LookupSingleIDByName(ctx, s.s.Store().Q(), "majors", tenantID, name)
	if id == nil || *id == "" {
		return nil, fmt.Errorf("专业「%s」未找到（以系统专业为基础，不会新增专业）", name)
	}
	rw := &brandImportRow{name: name, status: "draft", majorID: id}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	rw.description = NullableStr(cell(row, idx, "品牌介绍"))
	rw.coverImage = NullableStr(cell(row, idx, "封面图URL"))

	refCols := map[string]string{
		"employmentDirections":    "关联岗位品牌名称",
		"cooperationEnterprises":  "关联合作企业名称",
		"cooperationAchievements": "关联合作成果名称",
		"featuredCourses":         "关联特色课程名称",
	}
	data := map[string]any{}
	anyContent := rw.isPublic || rw.isFeatured || rw.description != nil || rw.coverImage != nil
	for key, colName := range refCols {
		var items []brandRefItem
		for _, n := range splitMulti(cell(row, idx, colName)) {
			if rid := s.lookupMajorRefID(ctx, tenantID, key, n); rid != "" {
				items = append(items, brandRefItem{ID: rid, Name: n})
			}
		}
		if len(items) > 0 {
			data[key] = items
			anyContent = true
		}
	}
	if !anyContent {
		return nil, nil
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("关联数据组装失败: %v", err)
	}
	rw.data = raw
	return rw, nil
}

// lookupMajorRefID 专业品牌关联列按名称匹配 ID（未命中返回空串，由调用方忽略并提示）。

func (s *ResourceImportService) lookupMajorRefID(ctx context.Context, tenantID, key, name string) string {
	switch key {
	case "employmentDirections":
		if id, err := store.LookupJobBrandIDByName(ctx, s.s.Store().Q(), tenantID, name); err == nil {
			return id
		}
	case "cooperationEnterprises":
		if id := LookupSingleIDByName(ctx, s.s.Store().Q(), "partner_enterprises", tenantID, name); id != nil {
			return *id
		}
		// 独立雇主品牌兜底匹配
		if id, err := store.LookupIndependentEmployerBrandIDByName(ctx, s.s.Store().Q(), tenantID, name); err == nil {
			return id
		}
	case "cooperationAchievements":
		if id, err := store.LookupAchievementIDByTitle(ctx, s.s.Store().Q(), tenantID, name); err == nil {
			return id
		}
	case "featuredCourses":
		if id, err := store.LookupCourseIDByName(ctx, s.s.Store().Q(), tenantID, name); err == nil {
			return id
		}
	}
	return ""
}

func (s *ResourceImportService) parseTeacherBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	teacherType := MapDictValue(cell(row, idx, "师资类型"),
		"校本师资", "school", "校本", "school", "school", "school",
		"企业专家", "expert", "专家", "expert", "expert", "expert")
	rw := &brandImportRow{status: "draft"}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	switch teacherType {
	case "school":
		teacherName := cell(row, idx, "关联教师名称")
		if teacherName == "" {
			return nil, fmt.Errorf("校本师资需填写「关联教师名称」")
		}
		id, err := store.LookupUserIDByNameWithRole(ctx, s.s.Store().Q(), tenantID, teacherName, domain.RoleTeacher)
		if err != nil {
			return nil, fmt.Errorf("关联教师匹配失败: %v", err)
		}
		if id == "" {
			return nil, fmt.Errorf("教师「%s」未找到", teacherName)
		}
		rw.name = teacherName
		rw.teacherID = &id
		profile := &importTeacherProfile{}
		switch cell(row, idx, "性别") {
		case "男":
			profile.gender = stringPtr("male")
		case "女":
			profile.gender = stringPtr("female")
		}
		profile.age = ParseNullableInt(cell(row, idx, "年龄"))
		profile.city = NullableStr(cell(row, idx, "所在城市"))
		profile.title = NullableStr(cell(row, idx, "职称"))
		profile.position = NullableStr(cell(row, idx, "职务"))
		profile.experienceYears = ParseNullableInt(cell(row, idx, "从业年限"))
		profile.education = NullableStr(cell(row, idx, "学历"))
		profile.industry = NullableStr(cell(row, idx, "所属行业"))
		profile.specialties = splitMulti(cell(row, idx, "擅长领域"))
		profile.introduction = NullableStr(cell(row, idx, "个人简介"))
		profile.workExperience = NullableStr(cell(row, idx, "工作经历"))
		profile.avatarURL = NullableStr(cell(row, idx, "头像URL"))
		rw.teacherProfile = profile
	case "expert":
		expertName := cell(row, idx, "关联专家名称")
		if expertName == "" {
			return nil, fmt.Errorf("企业专家需填写「关联专家名称」")
		}
		id := LookupSingleIDByName(ctx, s.s.Store().Q(), "alliance_experts", tenantID, expertName)
		if id == nil || *id == "" {
			return nil, fmt.Errorf("专家「%s」未找到", expertName)
		}
		rw.name = expertName
		rw.expertID = id
	default:
		return nil, fmt.Errorf("师资类型无法识别: %s", cell(row, idx, "师资类型"))
	}
	return rw, nil
}

func (s *ResourceImportService) parseCultureBrandRow(ctx context.Context, tenantID string, row []string, idx map[string]int) (*brandImportRow, error) {
	name := cell(row, idx, "名称")
	if name == "" {
		return nil, fmt.Errorf("名称不能为空")
	}
	rw := &brandImportRow{name: name, status: "draft"}
	rw.description = NullableStr(cell(row, idx, "描述"))
	if sv := MapPublishStatus(cell(row, idx, "状态")); sv != "" {
		rw.status = sv
		rw.statusFilled = true
	}
	rw.isPublic = parseBoolDefault(cell(row, idx, "是否公开"), false)
	rw.isPublicFilled = cell(row, idx, "是否公开") != ""
	rw.isFeatured = parseBoolDefault(cell(row, idx, "是否推荐"), false)
	rw.isFeaturedFilled = cell(row, idx, "是否推荐") != ""
	rw.coverImage = NullableStr(cell(row, idx, "封面图URL"))
	if sv := cell(row, idx, "关联专业名称"); sv != "" {
		id := LookupSingleIDByName(ctx, s.s.Store().Q(), "majors", tenantID, sv)
		if id == nil || *id == "" {
			return nil, fmt.Errorf("专业「%sv」未找到", sv)
		}
		rw.majorID = id
	}
	return rw, nil
}

// upsertTeacherProfile 校本师资档案创建/更新（与页面「编辑资料」一致：alliance_experts + teacherExpertId 回写）。

func (s *ResourceImportService) upsertTeacherProfile(ctx context.Context, tenantID string, rw *brandImportRow) (string, error) {
	p := rw.teacherProfile
	if p == nil || rw.teacherID == nil {
		return "", nil
	}
	var specialtiesRaw json.RawMessage
	if len(p.specialties) > 0 {
		specialtiesRaw, _ = json.Marshal(p.specialties)
	}
	exp := &domain.AllianceExpert{
		TenantID:        tenantID,
		Name:            rw.name,
		Gender:          p.gender,
		Age:             p.age,
		Title:           p.title,
		Position:        p.position,
		Industry:        p.industry,
		Specialties:     specialtiesRaw,
		ExperienceYears: p.experienceYears,
		Education:       p.education,
		Introduction:    p.introduction,
		WorkExperience:  p.workExperience,
		City:            p.city,
		AvatarURL:       p.avatarURL,
		Status:          "active",
		UserID:          rw.teacherID,
	}
	return s.s.Store().Alliance().UpsertTeacherExpertProfile(ctx, tenantID, exp)
}

// teacherData 师资品牌 data：回写专家档案 ID（与页面 openProfileEdit/saveProfile 一致）。

func teacherData(expertID string) json.RawMessage {
	raw, _ := json.Marshal(map[string]any{"teacherExpertId": expertID})
	return raw
}

// updateBrandFromImport 覆盖更新品牌：未提供的字段保留原值（data 仅在导入提供时替换）。

func (s *ResourceImportService) updateBrandFromImport(ctx context.Context, tenantID string, existing *domain.AllianceBrand, rw *brandImportRow) error {
	upd := *existing
	upd.Name = rw.name
	if rw.description != nil {
		upd.Description = rw.description
	}
	if rw.coverImage != nil {
		upd.CoverImage = rw.coverImage
	}
	if rw.status != "" {
		upd.Status = rw.status
	}
	// 单元格填写才覆盖开关/状态（空单元格保留原值，防覆盖导入静默下架已公开内容）
	if rw.isPublicFilled {
		upd.IsPublic = boolPtr(rw.isPublic)
	}
	if rw.isFeaturedFilled {
		upd.IsFeatured = boolPtr(rw.isFeatured)
	}
	if rw.statusFilled {
		upd.Status = rw.status
	}
	upd.StudentID = rw.studentID
	upd.EnterpriseID = rw.enterpriseID
	upd.PositionID = rw.positionID
	upd.MajorID = rw.majorID
	upd.TeacherID = rw.teacherID
	upd.ExpertID = rw.expertID
	if rw.data != nil {
		upd.Data = rw.data
	}
	return s.s.Store().Alliance().UpdateBrand(ctx, existing.ID, tenantID, &upd)
}

// createBrandFromImport 导入创建品牌（雇主合作企业行补建学校侧企业合作关联）。

func (s *ResourceImportService) createBrandFromImport(ctx context.Context, tenantID, brandType string, rw *brandImportRow) error {
	status := rw.status
	if status == "" {
		status = "draft"
	}
	data := rw.data
	if data == nil {
		data = json.RawMessage("{}")
	}
	_, err := s.s.Store().Alliance().CreateBrand(ctx, &domain.AllianceBrand{
		TenantID:     tenantID,
		BrandType:    brandType,
		Name:         rw.name,
		Status:       status,
		IsPublic:     boolPtr(rw.isPublic),
		IsFeatured:   boolPtr(rw.isFeatured),
		CoverImage:   rw.coverImage,
		Description:  rw.description,
		Data:         data,
		StudentID:    rw.studentID,
		EnterpriseID: rw.enterpriseID,
		PositionID:   rw.positionID,
		MajorID:      rw.majorID,
		TeacherID:    rw.teacherID,
		ExpertID:     rw.expertID,
	})
	if err != nil {
		return err
	}
	if brandType == "employer" && rw.enterpriseID != nil {
		if err := s.s.Store().AllianceEnterpriseLinks().EnsureLinksByEnterpriseIDs(ctx, tenantID, []string{*rw.enterpriseID}, nil); err != nil {
			slog.Warn("导入品牌补建企业合作关联失败", "brand", rw.name, "error", err)
		}
	}
	return nil
}

func stringPtr(s string) *string { return &s }

func strPtrValue(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
