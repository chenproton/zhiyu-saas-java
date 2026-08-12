package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// industryDictSeedSQL 默认行业字典（GB/T 4754 一级目录，与迁移 131 种子数据一致），新建租户时按需插入。
const industryDictSeedSQL = `
	INSERT INTO industries (id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at)
	SELECT gen_random_uuid(), $1, d.code, d.name, NULL, TRUE, d.sort_order, NOW(), NOW()
	FROM (VALUES
		('1', '农业', 1),
		('2', '林业', 2),
		('3', '畜牧业', 3),
		('4', '渔业', 4),
		('5', '农、林、牧、渔专业及辅助性活动', 5),
		('6', '煤炭开采和洗选业', 6),
		('7', '石油和天然气开采业', 7),
		('8', '黑色金属矿采选业', 8),
		('9', '有色金属矿采选业', 9),
		('10', '非金属矿采选业', 10),
		('11', '开采专业及辅助性活动', 11),
		('12', '其他采矿业', 12),
		('13', '农副食品加工业', 13),
		('14', '食品制造业', 14),
		('15', '酒、饮料和精制茶制造业', 15),
		('16', '烟草制品业', 16),
		('17', '纺织业', 17),
		('18', '纺织服装、服饰业', 18),
		('19', '皮革、毛皮、羽毛及其制品和制鞋业', 19),
		('20', '木材加工和木、竹、藤、棕、草制品业', 20),
		('21', '家具制造业', 21),
		('22', '造纸和纸制品业', 22),
		('23', '印刷和记录媒介复制业', 23),
		('24', '文教、工美、体育和娱乐用品制造业', 24),
		('25', '石油、煤炭及其他燃料加工业', 25),
		('26', '化学原料和化学制品制造业', 26),
		('27', '医药制造业', 27),
		('28', '化学纤维制造业', 28),
		('29', '橡胶和塑料制品业', 29),
		('30', '非金属矿物制品业', 30),
		('31', '黑色金属冶炼和压延加工业', 31),
		('32', '有色金属冶炼和压延加工业', 32),
		('33', '金属制品业', 33),
		('34', '通用设备制造业', 34),
		('35', '专用设备制造业', 35),
		('36', '汽车制造业', 36),
		('37', '铁路、船舶、航空航天和其他运输设备制', 37),
		('38', '电气机械和器材制造业', 38),
		('39', '计算机、通信和其他电子设备制造业', 39),
		('40', '仪器仪表制造业', 40),
		('41', '其他制造业', 41),
		('42', '废弃资源综合利用业', 42),
		('43', '金属制品、机械和设备修理业', 43),
		('44', '电力、热力生产和供应业', 44),
		('45', '燃气生产和供应业', 45),
		('46', '水的生产和供应业', 46),
		('47', '房屋建筑业', 47),
		('48', '土木工程建筑业', 48),
		('49', '建筑安装业', 49),
		('50', '建筑装饰、装修和其他建筑业', 50),
		('51', '批发业', 51),
		('52', '零售业', 52),
		('53', '铁路运输业', 53),
		('54', '道路运输业', 54),
		('55', '水上运输业', 55),
		('56', '航空运输业', 56),
		('57', '管道运输业', 57),
		('58', '多式联运和运输代理业', 58),
		('59', '装卸搬运和仓储业', 59),
		('60', '邮政业', 60),
		('61', '住宿业', 61),
		('62', '餐饮业', 62),
		('63', '电信、广播电视和卫星传输服务', 63),
		('64', '互联网和相关服务', 64),
		('65', '软件和信息技术服务业', 65),
		('66', '货币金融服务', 66),
		('67', '资本市场服务', 67),
		('68', '保险业', 68),
		('69', '其他金融业', 69),
		('70', '房地产业', 70),
		('71', '租赁业', 71),
		('72', '商务服务业', 72),
		('73', '研究和试验发展', 73),
		('74', '专业技术服务业', 74),
		('75', '科技推广和应用服务业', 75),
		('76', '水利管理业', 76),
		('77', '生态保护和环境治理业', 77),
		('78', '公共设施管理业', 78),
		('79', '土地管理业', 79),
		('80', '居民服务业', 80),
		('81', '机动车、电子产品和日用产品修理业', 81),
		('82', '其他服务业', 82),
		('83', '教育', 83),
		('84', '卫生', 84),
		('85', '社会工作', 85),
		('86', '新闻和出版业', 86),
		('87', '广播、电视、电影和录音制作业', 87),
		('88', '文化艺术业', 88),
		('89', '体育', 89),
		('90', '娱乐业', 90),
		('91', '中国共产党机关', 91),
		('92', '国家机构', 92),
		('93', '人民政协、民主党派', 93),
		('94', '社会保障', 94),
		('95', '群众团体、社会团体和其他成员组织', 95),
		('96', '基层群众自治组织及其他组织', 96),
		('97', '国际组织', 97)
	) AS d(code, name, sort_order)
	ON CONFLICT (tenant_id, code) DO NOTHING`

// allianceDictSeedSQL 默认联盟字典（与迁移 108/151 种子数据一致），新建租户时按需插入。
const allianceDictSeedSQL = `
	INSERT INTO alliance_dictionaries (id, tenant_id, dict_type, code, name, sort_order, created_at)
	SELECT gen_random_uuid(), $1, d.dict_type, d.code, d.name, d.sort_order, NOW()
	FROM (VALUES
		('cooperation_type', '人才培养', '人才培养', 1),
		('cooperation_type', '实习实训', '实习实训', 2),
		('cooperation_type', '技术研发', '技术研发', 3),
		('cooperation_type', '课程共建', '课程共建', 4),
		('cooperation_type', '师资培训', '师资培训', 5),
		('cooperation_type', '就业合作', '就业合作', 6),
		('cooperation_rating', 'strategic', '战略合作', 1),
		('cooperation_rating', 'deep', '深度合作', 2),
		('cooperation_rating', 'general', '一般合作', 3),
		('enterprise_status', 'negotiating', '洽谈中', 1),
		('enterprise_status', 'active', '合作中', 2),
		('enterprise_status', 'paused', '已暂停', 3),
		('enterprise_status', 'terminated', '已终止', 4),
		('achievement_type', 'job', '岗位成果', 1),
		('achievement_type', 'scene', '场景成果', 2),
		('achievement_type', 'course', '课程成果', 3),
		('achievement_type', 'custom', '自定义成果', 4),
		('agreement_type', '战略合作协议', '战略合作协议', 1),
		('agreement_type', '产学研合作协议', '产学研合作协议', 2),
		('agreement_type', '实习实训协议', '实习实训协议', 3),
		('agreement_type', '人才培养协议', '人才培养协议', 4),
		('agreement_type', '就业合作协议', '就业合作协议', 5),
		('agreement_type', '课程共建协议', '课程共建协议', 6),
		('agreement_type', '技术服务协议', '技术服务协议', 7),
		('agreement_status', 'draft', '草稿', 1),
		('agreement_status', 'active', '生效中', 2),
		('agreement_status', 'expired', '已失效', 3),
		('agreement_status', 'renewed', '已续签', 4),
		('agreement_status', 'terminated', '已终止', 5),
		('expert_rating', 'gold', '金牌专家', 1),
		('expert_rating', 'silver', '银牌专家', 2),
		('expert_rating', 'copper', '铜牌专家', 3),
		('project_type', '人才培养项目', '人才培养项目', 1),
		('project_type', '技术研发项目', '技术研发项目', 2),
		('project_type', '基地建设项目', '基地建设项目', 3),
		('project_type', '技能竞赛项目', '技能竞赛项目', 4),
		('project_type', '创新创业项目', '创新创业项目', 5),
		('project_type', '师资培训项目', '师资培训项目', 6),
		('project_type', '课程开发项目', '课程开发项目', 7),
		('project_type', '专业共建项目', '专业共建项目', 8)
	) AS d(dict_type, code, name, sort_order)
	ON CONFLICT (tenant_id, dict_type, code) DO NOTHING`

// TenantStore 提供租户的持久化访问。
type TenantStore struct {
	q Queryer
}

// NewTenantStore 创建租户 store。
func NewTenantStore(q Queryer) *TenantStore {
	return &TenantStore{q: q}
}

// List 按租户范围分页查询租户（平台管理员视角）。
func (s *TenantStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Tenant]) ([]domain.Tenant, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanTenantRows)
}

// ListConfig 返回租户列表查询配置，SQL 片段沉淀在 store 层。
func (s *TenantStore) ListConfig() ListQueryConfig[domain.Tenant] {
	return ListQueryConfig[domain.Tenant]{
		Table:         "tenants",
		SelectColumns: "id, name, code, type, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, valid_from::text, valid_until::text, admin_ids, status, created_at, updated_at",
		TenantScoped:  true,
		TenantColumn:  "id",
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if typ := p.Values["type"]; typ != "" {
				qb.AddCondition("type = " + qb.NextArg(typ))
			}
		},
	}
}

// AdminListConfig 返回超管控制台租户列表查询配置（跨租户、无租户隔离）。
func (s *TenantStore) AdminListConfig() ListQueryConfig[domain.Tenant] {
	return ListQueryConfig[domain.Tenant]{
		Table:         "tenants",
		SelectColumns: "id, name, code, type, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, valid_from::text, valid_until::text, admin_ids, status, created_at, updated_at",
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if typ := p.Values["type"]; typ != "" {
				qb.AddCondition("type = " + qb.NextArg(typ))
			}
			// 运营方租户不出现在超管控制台列表（避免误删导致平台管理员丢失）
			qb.AddCondition("id <> " + qb.NextArg(domain.OperatorTenantID))
		},
	}
}

// Get 按 ID 查询租户。
func (s *TenantStore) Get(ctx context.Context, id string) (*domain.Tenant, error) {
	t, err := s.fetchTenant(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// Update 更新租户基础信息与教育字段。
func (s *TenantStore) Update(ctx context.Context, id string, p *TenantUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE tenants SET name = $1, logo_url = $2, domain = $3, enterprise_code = $4, contact = $5,
			phone = $6, address = $7, description = $8,
			short_name = $9, school_type = $10, province = COALESCE(NULLIF($11,''), province), city = COALESCE(NULLIF($12,''), city),
			website = $13, contact_phone = $14, scale_data = $15, secondary_colleges = $16,
			education_level = $17, education_nature = $18, valid_from = $19, valid_until = $20,
			updated_at = NOW()
		WHERE id = $21
	`, p.Name, p.LogoURL, p.Domain, p.EnterpriseCode, p.Contact, p.Phone, p.Address, p.Description,
		p.ShortName, p.SchoolType, p.Province, p.City,
		p.Website, p.ContactPhone, p.ScaleData, p.SecondaryColleges,
		p.EducationLevel, p.EducationNature, p.ValidFrom, p.ValidUntil, id)
	return err
}

// UpdateStatus 更新租户状态。
func (s *TenantStore) UpdateStatus(ctx context.Context, id string, status domain.TenantStatus) error {
	_, err := s.q.Exec(ctx, `UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

// SyncEnterpriseProfileFields 企业服务台端更新主体后回写租户同名同值字段
// （名称/联系人/电话/企业代码），与超管端 AdminUpdateEnterprise 的双写语义保持一致，
// 保证 /superadmin 与 /partner/enterprise 看到同一份数据；nil 字段保留租户原值
// （支持仅携带部分字段的请求，如展示开关切换）。
func (s *TenantStore) SyncEnterpriseProfileFields(ctx context.Context, tenantID string, name *string, contact, phone, enterpriseCode *string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE tenants SET
			name = COALESCE($1, name),
			contact = COALESCE($2, contact),
			phone = COALESCE($3, phone),
			enterprise_code = COALESCE($4, enterprise_code),
			updated_at = NOW()
		WHERE id = $5
	`, name, contact, phone, enterpriseCode, tenantID)
	return err
}

// TenantUpdateParams 更新租户参数。
type TenantUpdateParams struct {
	Name              string
	LogoURL           *string
	Domain            *string
	EnterpriseCode    *string
	Contact           *string
	Phone             *string
	Address           *string
	Description       *string
	ShortName         *string
	SchoolType        *string
	Province          *string
	City              *string
	Website           *string
	ContactPhone      *string
	ScaleData         json.RawMessage
	SecondaryColleges json.RawMessage
	EducationLevel    *string
	EducationNature   *string
	ValidFrom         *string
	ValidUntil        *string
}

func (s *TenantStore) fetchTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	var t domain.Tenant
	var logo, domainVal, enterpriseCode, contact, phone, address, description *string
	var shortName, schoolType, province, city, website, contactPhone *string
	var scaleData, secondaryColleges json.RawMessage
	var edLevel, edNature, validFrom, validUntil *string

	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, type, logo_url, domain, enterprise_code, contact, phone, address, description,
			short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges,
			education_level, education_nature, valid_from::text, valid_until::text,
			admin_ids, status, created_at, updated_at
		FROM tenants WHERE id = $1
	`, id).Scan(
		&t.ID, &t.Name, &t.Code, &t.Type, &logo, &domainVal, &enterpriseCode, &contact, &phone, &address, &description,
		&shortName, &schoolType, &province, &city, &website, &contactPhone, &scaleData, &secondaryColleges,
		&edLevel, &edNature, &validFrom, &validUntil,
		&t.AdminIDs, &t.Status, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.LogoURL = logo
	t.Domain = domainVal
	t.EnterpriseCode = enterpriseCode
	t.Contact = contact
	t.Phone = phone
	t.Address = address
	t.Description = description
	t.ShortName = shortName
	t.SchoolType = schoolType
	t.Province = province
	t.City = city
	t.Website = website
	t.ContactPhone = contactPhone
	t.ScaleData = scaleData
	t.SecondaryColleges = secondaryColleges
	t.EducationLevel = edLevel
	t.EducationNature = edNature
	t.ValidFrom = validFrom
	t.ValidUntil = validUntil
	return &t, nil
}

func scanTenantRows(rows pgx.Rows) ([]domain.Tenant, error) {
	items := make([]domain.Tenant, 0)
	for rows.Next() {
		var t domain.Tenant
		var logo, domainVal, enterpriseCode, contact, phone, address, description *string
		var shortName, schoolType, province, city, website, contactPhone *string
		var scaleData, secondaryColleges json.RawMessage
		var edLevel, edNature, validFrom, validUntil *string
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Code, &t.Type, &logo, &domainVal, &enterpriseCode, &contact, &phone, &address, &description,
			&shortName, &schoolType, &province, &city, &website, &contactPhone, &scaleData, &secondaryColleges,
			&edLevel, &edNature, &validFrom, &validUntil,
			&t.AdminIDs, &t.Status, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		t.LogoURL = logo
		t.Domain = domainVal
		t.EnterpriseCode = enterpriseCode
		t.Contact = contact
		t.Phone = phone
		t.Address = address
		t.Description = description
		t.ShortName = shortName
		t.SchoolType = schoolType
		t.Province = province
		t.City = city
		t.Website = website
		t.ContactPhone = contactPhone
		t.ScaleData = scaleData
		t.SecondaryColleges = secondaryColleges
		t.EducationLevel = edLevel
		t.EducationNature = edNature
		t.ValidFrom = validFrom
		t.ValidUntil = validUntil
		items = append(items, t)
	}
	return items, rows.Err()
}

// CreateTenantResult 新租户初始化结果。
type CreateTenantResult struct {
	TenantID    string
	AdminUserID string
	AdminUser   string // login name
	AdminPass   string
}

// CreateWithDefaults 在事务内创建租户及默认资源（套餐/组织类型/角色/管理员）。
func (s *TenantStore) CreateWithDefaults(ctx context.Context, tx Queryer, p *TenantCreateParams) (*CreateTenantResult, error) {
	id := uuid.NewString()
	adminUsername := "admin-" + p.Code
	adminPassword, pwdErr := GenerateSecurePassword(12)
	if pwdErr != nil {
		return nil, pwdErr
	}

	var codeExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE code = $1)`, p.Code).Scan(&codeExists); err != nil {
		return nil, err
	}
	if codeExists {
		return nil, ErrCodeExists
	}

	var loginNameExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE login_name = $1)`, adminUsername).Scan(&loginNameExists); err != nil {
		return nil, err
	}
	if loginNameExists {
		return nil, ErrLoginNameExists
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO tenants (id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, valid_from, valid_until, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
	`, id, p.Name, p.Code, p.LogoURL, p.Domain, p.EnterpriseCode, p.Contact, p.Phone, p.Address, p.Description, p.ValidFrom, p.ValidUntil); err != nil {
		return nil, err
	}

	// 默认套餐：开启全部平台模块，后续可在 /superadmin 中按租户删减
	if _, err := tx.Exec(ctx, `
		INSERT INTO subscription_packages (tenant_id, name, valid_until, modules, status)
		VALUES ($1, '默认全功能套餐', NULL, $2, 'active')
	`, id, domain.JSONMap{
		"system": true, "career": true, "course": true, "scene": true,
		"ability": true, "resource": true, "alliance": true, "affairs": true,
		"ai": true, "opc": true, "decision": true, "research": true,
	}); err != nil {
		return nil, err
	}

	// 默认组织类型
	if _, err := tx.Exec(ctx, `
		INSERT INTO org_types (tenant_id, name, category, description, is_default)
		VALUES
			($1, '学校', 'internal', '学校根节点', TRUE),
			($1, '二级学院', 'internal', '二级学院/系', TRUE),
			($1, '专业', 'internal', '专业节点', TRUE),
			($1, '班级', 'internal', '班级节点', TRUE),
			($1, '行政职能部门', 'internal', '行政职能部门', TRUE)
		ON CONFLICT DO NOTHING
	`, id); err != nil {
		return nil, err
	}

	// 默认行业字典（GB/T 4754 一级目录，与迁移 131 种子数据一致）
	if _, err := tx.Exec(ctx, industryDictSeedSQL, id); err != nil {
		return nil, err
	}

	// 默认联盟字典（与迁移 108/151 种子数据一致）：合作类型/状态/评级等业务字典
	if _, err := tx.Exec(ctx, allianceDictSeedSQL, id); err != nil {
		return nil, err
	}

	// 默认角色（platform_admin 仅存在于运营方租户，不在此生成）
	if err := s.insertDefaultRoles(ctx, tx, id); err != nil {
		return nil, err
	}

	// 默认管理员用户 + school_admin 绑定
	adminID := uuid.NewString()
	hash, hashErr := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if hashErr != nil {
		return nil, hashErr
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, NULL, NULL, NULL, 'school', 'portal', $3, $4, $5, $6, NULL, NULL, NULL, NULL, NULL, NULL, $7, '{}', 'active')
	`, adminID, id, adminUsername, adminUsername, string(hash), p.Name+"管理员", "{}"); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO user_roles (id, user_id, role_id)
		 SELECT $1, $2, id FROM roles WHERE tenant_id = $3 AND code = 'school_admin' LIMIT 1`,
		uuid.NewString(), adminID, id); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE roles SET user_count = user_count + 1
		 WHERE tenant_id = $1 AND code = 'school_admin'`,
		id); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE tenants SET admin_ids = ARRAY[$1::UUID] WHERE id = $2`,
		adminID, id); err != nil {
		return nil, err
	}

	return &CreateTenantResult{
		TenantID:    id,
		AdminUserID: adminID,
		AdminUser:   adminUsername,
		AdminPass:   adminPassword,
	}, nil
}

func (s *TenantStore) insertDefaultRoles(ctx context.Context, tx Queryer, tenantID string) error {
	teacherMenus := domain.JSONMap{
		// 产业岗位学习平台
		"/job/positions": true, "/job/batches": true, "/job/workflows": true,
		"/job/approvals": true, "/job/learn-roads": true, "/job/recommend": true,
		"/job/landing": true,
		// 数字课程服务平台
		"/lesson/admin/system": true, "/lesson/admin/granular": true, "/lesson/admin/hybrid": true,
		"/lesson/admin/batches": true, "/lesson/admin/workflows": true,
		"/lesson/admin/approvals": true, "/lesson/landing": true,
		// 实践场景学习平台
		"/scene/": true, "/scene/batches": true, "/scene/workflows": true,
		"/scene/approvals": true, "/scene/landing": true,
		// 能力评价与测评资源管理平台
		"/evaluation/question-banks": true, "/evaluation/exams": true, "/evaluation/exam-usage": true,
		"/evaluation/batches": true, "/evaluation/workflows": true, "/evaluation/approvals": true,
		"/evaluation/scene-results": true, "/evaluation/lesson-results": true,
		"/evaluation/job-ability/results": true, "/evaluation/landing": true,
		// 教学资源共享服务平台
		"/library/knowledge": true, "/library/ability": true, "/library/certificates": true,
		"/library/resources/document": true, "/library/resources/spreadsheet": true,
		"/library/resources/image": true, "/library/resources/link": true,
		"/library/resources/audio": true, "/library/resources/video": true,
		"/library/resources/archive": true, "/library/resources/venue": true,
		"/library/resources/facility": true, "/library/resources/software": true,
		"/library/resources/other": true, "/library/questions": true,
		"/library/my-resources": true, "/library/landing": true,
		// 产教融合与就业服务平台
		"/portal/apps/alliance/school": true, "/portal/alliance/landing": true,
		"/portal/apps/alliance/enterprises": true, "/portal/apps/alliance/projects": true,
		"/portal/apps/alliance/achievements": true, "/portal/apps/alliance/experts": true,
		"/portal/apps/alliance/agreements": true, "/portal/apps/alliance/permissions": true,
		"/portal/apps/alliance/dictionaries": true, "/portal/apps/alliance/brands": true,
		"/portal/apps/alliance/brands/talent": true, "/portal/apps/alliance/brands/employer": true,
		"/portal/apps/alliance/brands/job": true, "/portal/apps/alliance/brands/major": true,
		"/portal/apps/alliance/brands/teacher": true, "/portal/apps/alliance/brands/culture": true,
		// 我的服务台
		"/portal/workspace": true,
	}
	adminActions := []string{"submit_approval", "withdraw_approval", "publish", "unpublish", "delete", "review", "reject"}
	modPerms := func(actions []string) domain.JSONMap {
		return domain.JSONMap{"scenarios": actions}
	}

	defaultRoles := []struct {
		code        string
		name        string
		permissions domain.JSONMap
	}{
		{domain.RoleSchoolAdmin, "学校管理员", domain.JSONMap{
			"scene":      modPerms(adminActions),
			"lesson":     domain.JSONMap{"courses": adminActions},
			"evaluation": domain.JSONMap{"exams": adminActions, "question-banks": adminActions},
			"job":        domain.JSONMap{"positions": adminActions},
		}},
		{domain.RoleTeacher, "教师", domain.JSONMap{
			"menus":      teacherMenus,
			"scene":      modPerms(adminActions),
			"lesson":     domain.JSONMap{"courses": adminActions},
			"evaluation": domain.JSONMap{"exams": adminActions, "question-banks": adminActions},
			"job":        domain.JSONMap{"positions": adminActions},
		}},
		{domain.RoleStudent, "学生", domain.JSONMap{
			"menus": domain.JSONMap{
				"/job/landing": true, "/lesson/landing": true,
				"/scene/landing": true, "/evaluation/landing": true, "/library/landing": true,
				"/portal/workspace": true,
			},
		}},
		{domain.RoleEnterpriseMentor, "企业导师", domain.JSONMap{
			"menus": domain.JSONMap{
				"/job/positions": true, "/job/landing": true,
				"/scene/": true, "/scene/landing": true,
				"/evaluation/scene-results": true,
			},
			"scene": modPerms(adminActions),
			"job":   domain.JSONMap{"positions": adminActions},
		}},
	}
	for _, role := range defaultRoles {
		if _, err := tx.Exec(ctx, `
			INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status, created_at)
			VALUES ($1, $2, $3, $4, '', $5, 0, 'active', NOW())
		`, uuid.NewString(), tenantID, role.code, role.name, role.permissions); err != nil {
			return err
		}
	}
	return nil
}

// CreateEnterpriseTenantResult 企业租户初始化结果。
type CreateEnterpriseTenantResult struct {
	TenantID     string
	AdminRoleID  string
	MemberRoleID string
}

// CreateEnterpriseTenant 在事务内创建企业租户（type=enterprise）并种子企业角色：
// enterprise_admin（全部企业权限）/ enterprise_member（只读，无成员管理菜单）。
// 不创建学校套餐/组织类型/行业字典/学校菜单——企业租户与学校租户逻辑完全分离。
func (s *TenantStore) CreateEnterpriseTenant(ctx context.Context, tx Queryer, p *TenantCreateParams) (*CreateEnterpriseTenantResult, error) {
	id := uuid.NewString()

	var codeExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenants WHERE code = $1)`, p.Code).Scan(&codeExists); err != nil {
		return nil, err
	}
	if codeExists {
		return nil, ErrCodeExists
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO tenants (id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, valid_from, valid_until, status, type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', 'enterprise')
	`, id, p.Name, p.Code, p.LogoURL, p.Domain, p.EnterpriseCode, p.Contact, p.Phone, p.Address, p.Description, p.ValidFrom, p.ValidUntil); err != nil {
		return nil, err
	}

	// partner 平台菜单权限标识（partner 侧导航按菜单权限显现）
	adminMenus := domain.JSONMap{
		"/partner/workspace":  true,
		"/partner/enterprise": true,
		"/partner/experts":    true,
		"/partner/members":    true,
		"/partner/schools":    true,
		"/partner/settings":   true,
	}
	memberMenus := domain.JSONMap{
		"/partner/workspace":  true,
		"/partner/enterprise": true,
		"/partner/experts":    true,
		"/partner/schools":    true,
		"/partner/settings":   true,
	}
	roles := []struct {
		code        string
		name        string
		permissions domain.JSONMap
	}{
		{domain.RoleEnterpriseAdmin, "企业管理员", domain.JSONMap{"menus": adminMenus}},
		{domain.RoleEnterpriseMember, "企业成员", domain.JSONMap{"menus": memberMenus}},
	}
	result := &CreateEnterpriseTenantResult{TenantID: id}
	for _, role := range roles {
		roleID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status, created_at)
			VALUES ($1, $2, $3, $4, '', $5, 0, 'active', NOW())
		`, roleID, id, role.code, role.name, role.permissions); err != nil {
			return nil, err
		}
		switch role.code {
		case domain.RoleEnterpriseAdmin:
			result.AdminRoleID = roleID
		case domain.RoleEnterpriseMember:
			result.MemberRoleID = roleID
		}
	}
	return result, nil
}

// TenantCreateParams 创建租户参数。
type TenantCreateParams struct {
	Name           string
	Code           string
	LogoURL        *string
	Domain         *string
	EnterpriseCode *string
	Contact        *string
	Phone          *string
	Address        *string
	Description    *string
	ValidFrom      *string
	ValidUntil     *string
}

// ErrCodeExists 租户标识已存在。
var ErrCodeExists = errors.New("tenant code exists")

// ErrLoginNameExists 管理员用户名已存在。
var ErrLoginNameExists = errors.New("login name exists")

func GenerateSecurePassword(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// DeleteTenant 在事务内删除租户及其用户（避免 tenant_id SET NULL 后留下孤儿账户）。
func (s *TenantStore) DeleteTenant(ctx context.Context, tx Queryer, tenantID string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE tenant_id = $1`, tenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, tenantID); err != nil {
		return err
	}
	return nil
}
