package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/config"
	"github.com/zhiyu-saas/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
)

type Institution struct {
	ID                string
	Type              string
	Name              string
	CreditCode        string
	Logo              *string
	Intro             string
	ContactName       string
	ContactPhone      string
	ContactEmail      string
	QualificationFile *string
	ExpertiseTags     []string
	Status            string
	OrgCode           string
	Balance           float64
	TotalSpent        float64
	TotalIncome       float64
	CreatedAt         string
	UpdatedAt         string
}

type Resource struct {
	ID             string
	InstitutionID  string
	Name           string
	Intro          string
	Category       string
	CoverImage     *string
	Attachment     *string
	AttachmentName *string
	Price          float64
	Version        string
	Status         string
	SalesCount     int
	ViewCount      int
	CreatedAt      string
	UpdatedAt      string
	Tags           []ResourceTag
}

type ResourceTag struct {
	ID       string
	TagType  string
	TagValue string
}

type Order struct {
	ID           string
	OrderNo      string
	BuyerID      string
	SellerID     string
	ResourceID   string
	Price        float64
	PlatformFee  float64
	SellerIncome float64
	Status       string
	PaidAt       *string
	CreatedAt    string
}

type Authorization struct {
	ID         string
	OrderID    string
	BuyerID    string
	ResourceID string
	AuthCode   string
	Status     int
	CreatedAt  string
}

type Withdrawal struct {
	ID            string
	InstitutionID string
	Amount        float64
	AccountType   string
	AccountInfo   string
	Status        string
	HandledAt     *string
	CreatedAt     string
}

type Banner struct {
	ID      string
	Title   string
	Image   string
	Link    string
	Sort    int
	Enabled bool
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("config error:", err)
		os.Exit(1)
	}

	database, err := db.New(cfg.DatabaseURL)
	if err != nil {
		fmt.Println("db error:", err)
		os.Exit(1)
	}
	defer database.Close()

	ctx := context.Background()
	tx, err := database.Pool.Begin(ctx)
	if err != nil {
		fmt.Println("begin error:", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	if err := seedUnifiedBase(ctx, tx); err != nil {
		fmt.Println("seed unified base error:", err)
		os.Exit(1)
	}
	if err := seedInstitutions(ctx, tx); err != nil {
		fmt.Println("seed institutions error:", err)
		os.Exit(1)
	}
	if err := seedResources(ctx, tx); err != nil {
		fmt.Println("seed resources error:", err)
		os.Exit(1)
	}
	if err := seedOrders(ctx, tx); err != nil {
		fmt.Println("seed orders error:", err)
		os.Exit(1)
	}
	if err := seedWithdrawals(ctx, tx); err != nil {
		fmt.Println("seed withdrawals error:", err)
		os.Exit(1)
	}
	if err := seedBanners(ctx, tx); err != nil {
		fmt.Println("seed banners error:", err)
		os.Exit(1)
	}
	if err := seedPlatformConfig(ctx, tx); err != nil {
		fmt.Println("seed platform config error:", err)
		os.Exit(1)
	}
	if err := seedUsers(ctx, tx); err != nil {
		fmt.Println("seed users error:", err)
		os.Exit(1)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE roles SET user_count = (SELECT COUNT(*) FROM user_roles WHERE role_id = roles.id)
	`); err != nil {
		fmt.Println("update roles user_count error:", err)
		os.Exit(1)
	}
	if err := seedJobData(ctx, tx); err != nil {
		fmt.Println("seed job data error:", err)
		os.Exit(1)
	}
	if err := seedSceneData(ctx, tx); err != nil {
		fmt.Println("seed scene data error:", err)
		os.Exit(1)
	}
	if err := seedLessonData(ctx, tx); err != nil {
		fmt.Println("seed lesson data error:", err)
		os.Exit(1)
	}
	if err := seedEvaluationData(ctx, tx); err != nil {
		fmt.Println("seed evaluation data error:", err)
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println("commit error:", err)
		os.Exit(1)
	}

	fmt.Println("seed completed")
}

// seedUnifiedBase seeds tenants, org_types, organizations, majors, roles
// required by the unified user system.
func seedUnifiedBase(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	_, err := tx.Exec(ctx, `
		INSERT INTO tenants (id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, admin_ids, status, created_at, updated_at)
		VALUES ($1, '知与未来演示租户', 'zhiyu-demo', '/placeholder-logo.png', 'demo.zhiyu.com', 'DEMO0001', '管理员', '010-12345678', '北京市', '演示用统一租户', '{}', 'active', NOW(), NOW())
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name, code = EXCLUDED.code, logo_url = EXCLUDED.logo_url, domain = EXCLUDED.domain,
			enterprise_code = EXCLUDED.enterprise_code, contact = EXCLUDED.contact, phone = EXCLUDED.phone,
			address = EXCLUDED.address, description = EXCLUDED.description, admin_ids = EXCLUDED.admin_ids,
			status = EXCLUDED.status, updated_at = NOW()
	`, tenantID)
	if err != nil {
		return fmt.Errorf("seed tenant: %w", err)
	}

	orgTypes := []struct {
		id       uuid.UUID
		name     string
		category string
	}{
		{uuid.MustParse("21111111-1111-1111-1111-111111111111"), "学校", "internal"},
		{uuid.MustParse("21111111-1111-1111-1111-111111111112"), "二级学院", "internal"},
		{uuid.MustParse("21111111-1111-1111-1111-111111111113"), "专业", "internal"},
		{uuid.MustParse("21111111-1111-1111-1111-111111111114"), "班级", "internal"},
		{uuid.MustParse("21111111-1111-1111-1111-111111111115"), "企业", "external"},
		{uuid.MustParse("21111111-1111-1111-1111-111111111116"), "职能部门", "business"},
	}
	for _, ot := range orgTypes {
		_, err := tx.Exec(ctx, `
			INSERT INTO org_types (id, tenant_id, name, category, description, created_at)
			VALUES ($1, $2, $3, $4, '', NOW())
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
		`, ot.id, tenantID, ot.name, ot.category)
		if err != nil {
			return fmt.Errorf("seed org type %s: %w", ot.name, err)
		}
	}

	orgs := []struct {
		id       uuid.UUID
		name     string
		typeID   uuid.UUID
		parentID *uuid.UUID
	}{
		{uuid.MustParse("31111111-1111-1111-1111-111111111111"), "北京信息职业技术学院", uuid.MustParse("21111111-1111-1111-1111-111111111111"), nil},
		{uuid.MustParse("31111111-1111-1111-1111-111111111112"), "信息技术学院", uuid.MustParse("21111111-1111-1111-1111-111111111112"), uuidPtr("31111111-1111-1111-1111-111111111111")},
		{uuid.MustParse("31111111-1111-1111-1111-111111111113"), "信息安全专业", uuid.MustParse("21111111-1111-1111-1111-111111111113"), uuidPtr("31111111-1111-1111-1111-111111111112")},
		{uuid.MustParse("31111111-1111-1111-1111-111111111114"), "信息安全23-1班", uuid.MustParse("21111111-1111-1111-1111-111111111114"), uuidPtr("31111111-1111-1111-1111-111111111113")},
	}
	for _, o := range orgs {
		_, err := tx.Exec(ctx, `
			INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 0, 0, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, type_id = EXCLUDED.type_id, parent_id = EXCLUDED.parent_id,
				sort_order = EXCLUDED.sort_order, member_count = EXCLUDED.member_count, updated_at = NOW()
		`, o.id, tenantID, o.name, o.typeID, o.parentID)
		if err != nil {
			return fmt.Errorf("seed organization %s: %w", o.name, err)
		}
	}

	majors := []struct {
		id      uuid.UUID
		orgID   uuid.UUID
		code    string
		name    string
		enabled bool
	}{
		{uuid.MustParse("51111111-1111-1111-1111-111111111111"), uuid.MustParse("31111111-1111-1111-1111-111111111113"), "INFO-SEC", "信息安全技术应用", true},
		{uuid.MustParse("51111111-1111-1111-1111-111111111112"), uuid.MustParse("31111111-1111-1111-1111-111111111113"), "CLOUD-COMP", "云计算技术应用", true},
	}
	for _, m := range majors {
		_, err := tx.Exec(ctx, `
			INSERT INTO majors (id, tenant_id, org_node_id, code, name, enabled, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				org_node_id = EXCLUDED.org_node_id, code = EXCLUDED.code, name = EXCLUDED.name, enabled = EXCLUDED.enabled,
				updated_at = NOW()
		`, m.id, tenantID, m.orgID, m.code, m.name, m.enabled)
		if err != nil {
			return fmt.Errorf("seed major %s: %w", m.name, err)
		}
	}

	roles := []struct {
		id          uuid.UUID
		code        string
		name        string
		permissions map[string]interface{}
	}{
		{uuid.MustParse("61111111-1111-1111-1111-111111111111"), "platform_admin", "平台管理员", map[string]interface{}{"admin": true}},
		{uuid.MustParse("61111111-1111-1111-1111-111111111112"), "school_admin", "学校管理员", map[string]interface{}{"schoolAdmin": true}},
		{uuid.MustParse("61111111-1111-1111-1111-111111111113"), "teacher", "教师", map[string]interface{}{"teacher": true}},
		{uuid.MustParse("61111111-1111-1111-1111-111111111114"), "student", "学生", map[string]interface{}{"student": true}},

		{uuid.MustParse("61111111-1111-1111-1111-111111111116"), "enterprise_mentor", "企业导师", map[string]interface{}{"enterpriseMentor": true}},
	}
	for _, role := range roles {
		_, err := tx.Exec(ctx, `
			INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status, created_at)
			VALUES ($1, $2, $3, $4, '', $5, 0, 'active', NOW())
			ON CONFLICT (id) DO UPDATE SET
				code = EXCLUDED.code, name = EXCLUDED.name, permissions = EXCLUDED.permissions
		`, role.id, tenantID, role.code, role.name, role.permissions)
		if err != nil {
			return fmt.Errorf("seed role %s: %w", role.name, err)
		}
	}

	return nil
}

func seedInstitutions(ctx context.Context, tx pgx.Tx) error {
	institutions := []Institution{
		{
			ID: "inst-001", Type: "enterprise", Name: "网络安全科技股份有限公司",
			CreditCode: "91110108MA01ABCD1X", Logo: str("/placeholder-logo.png"),
			Intro:       "专注于网络安全人才培养与教学资源开发的高新技术企业。",
			ContactName: "张明", ContactPhone: "138****1234", ContactEmail: "zhangming@cybersec.com",
			QualificationFile: str("营业执照.pdf"), ExpertiseTags: []string{"信息安全", "网络安全"},
			Status: "approved", OrgCode: "ORG-ENT001", Balance: 12850, TotalIncome: 23500,
			CreatedAt: "2024-01-10", UpdatedAt: "2024-03-15",
		},
		{
			ID: "inst-002", Type: "school", Name: "北京信息职业技术学院",
			CreditCode: "12110000400999999X", Logo: str("/placeholder-logo.png"),
			Intro:       "北京市示范性高等职业院校，重点建设信息技术类专业群。",
			ContactName: "李华", ContactPhone: "139****5678", ContactEmail: "lihua@bitc.edu.cn",
			QualificationFile: str("办学许可证.pdf"), ExpertiseTags: []string{"计算机网络", "软件技术"},
			Status: "approved", OrgCode: "ORG-SCH001", TotalSpent: 15800,
			CreatedAt: "2024-02-15", UpdatedAt: "2024-03-20",
		},
		{
			ID: "inst-003", Type: "enterprise", Name: "云智教育科技（深圳）有限公司",
			CreditCode: "91440300MA5E6789CD", Logo: str("/placeholder-logo.png"),
			Intro:       "聚焦云计算与大数据领域的职业教育内容服务商。",
			ContactName: "王芳", ContactPhone: "137****9012", ContactEmail: "wangfang@yunzhi.com",
			QualificationFile: str("营业执照.pdf"), ExpertiseTags: []string{"云计算", "大数据技术"},
			Status: "approved", OrgCode: "ORG-ENT002", Balance: 5200, TotalIncome: 9800,
			CreatedAt: "2024-03-05", UpdatedAt: "2024-03-18",
		},
		{
			ID: "inst-004", Type: "school", Name: "上海电子信息职业技术学院",
			CreditCode: "12110000400998888X", Logo: str("/placeholder-logo.png"),
			Intro:       "上海市特色高职院校，电子信息类专业优势明显。",
			ContactName: "陈伟", ContactPhone: "136****3456", ContactEmail: "chenwei@shie.edu.cn",
			QualificationFile: str("办学许可证.pdf"), ExpertiseTags: []string{"物联网", "人工智能"},
			Status: "approved", OrgCode: "ORG-SCH002", TotalSpent: 7600,
			CreatedAt: "2024-01-22", UpdatedAt: "2024-03-10",
		},
		{
			ID: "inst-005", Type: "school", Name: "杭州职业技术学院",
			CreditCode: "12330000470088888X", Logo: str("/placeholder-logo.png"),
			Intro:       "浙江省示范性高职院校，数字媒体专业为省级特色专业。",
			ContactName: "刘洋", ContactPhone: "135****7890", ContactEmail: "liuyang@hzvtc.edu.cn",
			QualificationFile: str("办学许可证.pdf"), ExpertiseTags: []string{"数字媒体", "电子商务"},
			Status: "pending", OrgCode: "ORG-SCH003",
			CreatedAt: "2024-04-01", UpdatedAt: "2024-04-01",
		},
		{
			ID: "inst-006", Type: "enterprise", Name: "智能制造解决方案有限公司",
			CreditCode: "91330106MA2B3456EF", Logo: str("/placeholder-logo.png"),
			Intro:       "面向职业院校提供智能制造实训资源与课程服务。",
			ContactName: "赵静", ContactPhone: "158****2345", ContactEmail: "zhaojing@imfg.com",
			QualificationFile: str("营业执照.pdf"), ExpertiseTags: []string{"智能制造", "物联网"},
			Status: "approved", OrgCode: "ORG-ENT003", Balance: 3200, TotalIncome: 5600,
			CreatedAt: "2024-02-28", UpdatedAt: "2024-03-22",
		},
	}

	for _, i := range institutions {
		_, err := tx.Exec(ctx, `
			INSERT INTO institutions (id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email,
				qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, credit_code = EXCLUDED.credit_code, logo = EXCLUDED.logo, intro = EXCLUDED.intro,
				contact_name = EXCLUDED.contact_name, contact_phone = EXCLUDED.contact_phone, contact_email = EXCLUDED.contact_email,
				qualification_file = EXCLUDED.qualification_file, status = EXCLUDED.status, org_code = EXCLUDED.org_code,
				balance = EXCLUDED.balance, total_spent = EXCLUDED.total_spent, total_income = EXCLUDED.total_income,
				updated_at = EXCLUDED.updated_at, tenant_id = EXCLUDED.tenant_id
		`, i.ID, i.Type, i.Name, i.CreditCode, i.Logo, i.Intro, i.ContactName, i.ContactPhone, i.ContactEmail,
			i.QualificationFile, i.Status, i.OrgCode, i.Balance, i.TotalSpent, i.TotalIncome,
			parseDate(i.CreatedAt), parseDate(i.UpdatedAt), uuid.MustParse("11111111-1111-1111-1111-111111111111"))
		if err != nil {
			return fmt.Errorf("insert institution %s: %w", i.ID, err)
		}

		for _, tag := range i.ExpertiseTags {
			_, err := tx.Exec(ctx, `
				INSERT INTO institution_expertise_tags (id, institution_id, tag_value)
				VALUES ($1, $2, $3) ON CONFLICT (institution_id, tag_value) DO NOTHING
			`, i.ID+"-"+tag, i.ID, tag)
			if err != nil {
				return fmt.Errorf("insert tag %s: %w", tag, err)
			}
		}
	}
	return nil
}

func seedResources(ctx context.Context, tx pgx.Tx) error {
	resources := []Resource{
		{
			ID: "res-001", InstitutionID: "inst-001", Name: "网络安全运维岗位能力包",
			Intro:    "本资源包面向高职信息安全专业，包含网络安全运维岗位能力模型、胜任标准、典型工作任务及评价量规。配套课件、实训指导书及考核题库，支持院校开展岗位导向教学。",
			Category: "post", CoverImage: str("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("网络安全运维岗位能力包_v1.0.zip"), Price: 5800, Version: "v1.0",
			Status: "published", SalesCount: 12, ViewCount: 356,
			CreatedAt: "2024-02-10", UpdatedAt: "2024-03-15",
			Tags: []ResourceTag{
				{ID: "rt-001", TagType: "major", TagValue: "信息安全"},
				{ID: "rt-002", TagType: "industry", TagValue: "网络安全"},
				{ID: "rt-003", TagType: "level", TagValue: "高职"},
				{ID: "rt-004", TagType: "difficulty", TagValue: "中级"},
			},
		},
		{
			ID: "res-002", InstitutionID: "inst-003", Name: "云计算平台搭建与运维课程包",
			Intro:    "涵盖 OpenStack、Docker、Kubernetes 等主流云平台的搭建与运维内容。包含完整课程大纲、PPT课件、实验手册、视频微课及期末试卷，适合高职云计算专业核心课程使用。",
			Category: "course", CoverImage: str("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("云计算课程包_v1.0.zip"), Price: 4200, Version: "v1.0",
			Status: "published", SalesCount: 8, ViewCount: 218,
			CreatedAt: "2024-02-18", UpdatedAt: "2024-03-12",
			Tags: []ResourceTag{
				{ID: "rt-005", TagType: "major", TagValue: "云计算"},
				{ID: "rt-006", TagType: "industry", TagValue: "云计算服务"},
				{ID: "rt-007", TagType: "level", TagValue: "高职"},
				{ID: "rt-008", TagType: "difficulty", TagValue: "中级"},
			},
		},
		{
			ID: "res-003", InstitutionID: "inst-001", Name: "渗透测试实战场景包",
			Intro:    "基于真实企业网络安全事件改编的渗透测试实战场景，包含任务链、漏洞利用说明、防御方案及评价标准。适用于信息安全专业高年级学生综合实训。",
			Category: "scene", CoverImage: str("https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("渗透测试场景包_v1.0.zip"), Price: 3600, Version: "v1.0",
			Status: "published", SalesCount: 5, ViewCount: 189,
			CreatedAt: "2024-03-01", UpdatedAt: "2024-03-18",
			Tags: []ResourceTag{
				{ID: "rt-009", TagType: "major", TagValue: "信息安全"},
				{ID: "rt-010", TagType: "industry", TagValue: "网络安全"},
				{ID: "rt-011", TagType: "level", TagValue: "高职"},
				{ID: "rt-012", TagType: "difficulty", TagValue: "高级"},
			},
		},
		{
			ID: "res-004", InstitutionID: "inst-006", Name: "工业互联网安全测评包",
			Intro:    "针对工业互联网安全领域的测评资源包，包含风险评估量规、测试用例库、安全检查表及报告模板。可用于课程考核、技能竞赛训练等场景。",
			Category: "assessment", CoverImage: str("https://images.unsplash.com/photo-1581092919535-7146ff1a590b?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("工控安全测评包_v1.0.zip"), Price: 2800, Version: "v1.0",
			Status: "published", SalesCount: 3, ViewCount: 96,
			CreatedAt: "2024-03-05", UpdatedAt: "2024-03-20",
			Tags: []ResourceTag{
				{ID: "rt-013", TagType: "major", TagValue: "智能制造"},
				{ID: "rt-014", TagType: "industry", TagValue: "智能硬件"},
				{ID: "rt-015", TagType: "level", TagValue: "高职"},
				{ID: "rt-016", TagType: "difficulty", TagValue: "高级"},
			},
		},
		{
			ID: "res-005", InstitutionID: "inst-003", Name: "Python 数据分析素材包",
			Intro:    "包含数据分析典型案例数据集、Jupyter Notebook 源码、可视化模板及教学视频。适用于大数据技术专业课程辅助教学。",
			Category: "material", CoverImage: str("https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("Python数据分析素材包_v1.0.zip"), Price: 1500, Version: "v1.0",
			Status: "published", SalesCount: 15, ViewCount: 412,
			CreatedAt: "2024-03-08", UpdatedAt: "2024-03-22",
			Tags: []ResourceTag{
				{ID: "rt-017", TagType: "major", TagValue: "大数据技术"},
				{ID: "rt-018", TagType: "industry", TagValue: "数据分析"},
				{ID: "rt-019", TagType: "level", TagValue: "高职"},
				{ID: "rt-020", TagType: "difficulty", TagValue: "初级"},
			},
		},
		{
			ID: "res-006", InstitutionID: "inst-001", Name: "Web 应用安全开发课程包",
			Intro:    "覆盖 OWASP Top 10、安全编码规范、代码审计方法等内容。包含课程课件、案例源码、实验环境配置指南及考核试卷。",
			Category: "course", CoverImage: str("https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("Web安全开发课程包_v1.0.zip"), Price: 4800, Version: "v1.0",
			Status:    "reviewing",
			CreatedAt: "2024-03-25", UpdatedAt: "2024-03-25",
			Tags: []ResourceTag{
				{ID: "rt-021", TagType: "major", TagValue: "信息安全"},
				{ID: "rt-022", TagType: "industry", TagValue: "软件开发"},
				{ID: "rt-023", TagType: "level", TagValue: "高职"},
				{ID: "rt-024", TagType: "difficulty", TagValue: "中级"},
			},
		},
		{
			ID: "res-007", InstitutionID: "inst-006", Name: "智能制造数字孪生场景包",
			Intro:    "基于数字孪生技术的智能制造实训场景，包含产线建模、虚拟调试、数据分析等任务模块及评价标准。",
			Category: "scene", CoverImage: str("https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("数字孪生场景包_v1.0.zip"), Price: 6500, Version: "v1.0",
			Status:    "pending_publish",
			CreatedAt: "2024-03-20", UpdatedAt: "2024-03-28",
			Tags: []ResourceTag{
				{ID: "rt-025", TagType: "major", TagValue: "智能制造"},
				{ID: "rt-026", TagType: "industry", TagValue: "智能制造"},
				{ID: "rt-027", TagType: "level", TagValue: "高职"},
				{ID: "rt-028", TagType: "difficulty", TagValue: "高级"},
			},
		},
		{
			ID: "res-008", InstitutionID: "inst-003", Name: "人工智能基础岗位包",
			Intro:    "面向人工智能应用开发岗位的能力模型与教学资源，包含机器学习基础、深度学习入门、模型部署等内容。",
			Category: "post", CoverImage: str("https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80&auto=format&fit=crop"), Attachment: str("#"),
			AttachmentName: str("AI基础岗位包_v1.0.zip"), Price: 5200, Version: "v1.0",
			Status:    "draft",
			CreatedAt: "2024-03-28", UpdatedAt: "2024-03-28",
			Tags: []ResourceTag{
				{ID: "rt-029", TagType: "major", TagValue: "人工智能"},
				{ID: "rt-030", TagType: "industry", TagValue: "数据分析"},
				{ID: "rt-031", TagType: "level", TagValue: "高职"},
				{ID: "rt-032", TagType: "difficulty", TagValue: "初级"},
			},
		},
	}

	for _, r := range resources {
		_, err := tx.Exec(ctx, `
			INSERT INTO resources (id, institution_id, name, intro, category, cover_image, attachment, attachment_name,
				price, version, status, sales_count, view_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			ON CONFLICT (id) DO UPDATE SET
				institution_id = EXCLUDED.institution_id, name = EXCLUDED.name, intro = EXCLUDED.intro,
				category = EXCLUDED.category, cover_image = EXCLUDED.cover_image, attachment = EXCLUDED.attachment,
				attachment_name = EXCLUDED.attachment_name, price = EXCLUDED.price, version = EXCLUDED.version,
				status = EXCLUDED.status, sales_count = EXCLUDED.sales_count, view_count = EXCLUDED.view_count,
				updated_at = EXCLUDED.updated_at
		`, r.ID, r.InstitutionID, r.Name, r.Intro, r.Category, r.CoverImage, r.Attachment, r.AttachmentName,
			r.Price, r.Version, r.Status, r.SalesCount, r.ViewCount, parseDate(r.CreatedAt), parseDate(r.UpdatedAt))
		if err != nil {
			return fmt.Errorf("insert resource %s: %w", r.ID, err)
		}

		for _, t := range r.Tags {
			_, err := tx.Exec(ctx, `
				INSERT INTO resource_tags (id, resource_id, tag_type, tag_value)
				VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET tag_type = EXCLUDED.tag_type, tag_value = EXCLUDED.tag_value
			`, t.ID, r.ID, t.TagType, t.TagValue)
			if err != nil {
				return fmt.Errorf("insert resource tag %s: %w", t.ID, err)
			}
		}
	}
	return nil
}

func seedOrders(ctx context.Context, tx pgx.Tx) error {
	orders := []Order{
		{ID: "order-001", OrderNo: "ORD-20240315-1001", BuyerID: "inst-002", SellerID: "inst-001", ResourceID: "res-001", Price: 5800, PlatformFee: 870, SellerIncome: 4930, Status: "paid", PaidAt: str("2024-03-15 10:30:00"), CreatedAt: "2024-03-15 10:28:00"},
		{ID: "order-002", OrderNo: "ORD-20240318-1002", BuyerID: "inst-004", SellerID: "inst-001", ResourceID: "res-001", Price: 5800, PlatformFee: 870, SellerIncome: 4930, Status: "paid", PaidAt: str("2024-03-18 14:20:00"), CreatedAt: "2024-03-18 14:18:00"},
		{ID: "order-003", OrderNo: "ORD-20240320-1003", BuyerID: "inst-002", SellerID: "inst-003", ResourceID: "res-002", Price: 4200, PlatformFee: 630, SellerIncome: 3570, Status: "paid", PaidAt: str("2024-03-20 09:15:00"), CreatedAt: "2024-03-20 09:12:00"},
		{ID: "order-004", OrderNo: "ORD-20240322-1004", BuyerID: "inst-004", SellerID: "inst-003", ResourceID: "res-005", Price: 1500, PlatformFee: 225, SellerIncome: 1275, Status: "paid", PaidAt: str("2024-03-22 16:45:00"), CreatedAt: "2024-03-22 16:42:00"},
		{ID: "order-005", OrderNo: "ORD-20240325-1005", BuyerID: "inst-002", SellerID: "inst-001", ResourceID: "res-003", Price: 3600, PlatformFee: 540, SellerIncome: 3060, Status: "paid", PaidAt: str("2024-03-25 11:00:00"), CreatedAt: "2024-03-25 10:58:00"},
		{ID: "order-006", OrderNo: "ORD-20240328-1006", BuyerID: "inst-004", SellerID: "inst-006", ResourceID: "res-004", Price: 2800, PlatformFee: 420, SellerIncome: 2380, Status: "paid", PaidAt: str("2024-03-28 13:30:00"), CreatedAt: "2024-03-28 13:28:00"},
	}

	auths := []Authorization{
		{ID: "auth-001", OrderID: "order-001", BuyerID: "inst-002", ResourceID: "res-001", AuthCode: "AUTH-A3B7-C9D2-E4F1", Status: 1, CreatedAt: "2024-03-15 10:30:00"},
		{ID: "auth-002", OrderID: "order-002", BuyerID: "inst-004", ResourceID: "res-001", AuthCode: "AUTH-B5C1-D7E3-F9A2", Status: 1, CreatedAt: "2024-03-18 14:20:00"},
		{ID: "auth-003", OrderID: "order-003", BuyerID: "inst-002", ResourceID: "res-002", AuthCode: "AUTH-C2D8-E1F4-A6B3", Status: 1, CreatedAt: "2024-03-20 09:15:00"},
		{ID: "auth-004", OrderID: "order-004", BuyerID: "inst-004", ResourceID: "res-005", AuthCode: "AUTH-D9E2-F5A1-B7C4", Status: 1, CreatedAt: "2024-03-22 16:45:00"},
		{ID: "auth-005", OrderID: "order-005", BuyerID: "inst-002", ResourceID: "res-003", AuthCode: "AUTH-E4F9-A2B6-C8D1", Status: 1, CreatedAt: "2024-03-25 11:00:00"},
		{ID: "auth-006", OrderID: "order-006", BuyerID: "inst-004", ResourceID: "res-004", AuthCode: "AUTH-F1A5-B9C3-D7E2", Status: 1, CreatedAt: "2024-03-28 13:30:00"},
	}

	for _, o := range orders {
		_, err := tx.Exec(ctx, `
			INSERT INTO orders (id, order_no, buyer_id, seller_id, resource_id, price, platform_fee, seller_income, status, paid_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (id) DO UPDATE SET
				order_no = EXCLUDED.order_no, buyer_id = EXCLUDED.buyer_id, seller_id = EXCLUDED.seller_id,
				resource_id = EXCLUDED.resource_id, price = EXCLUDED.price, platform_fee = EXCLUDED.platform_fee,
				seller_income = EXCLUDED.seller_income, status = EXCLUDED.status, paid_at = EXCLUDED.paid_at,
				created_at = EXCLUDED.created_at
		`, o.ID, o.OrderNo, o.BuyerID, o.SellerID, o.ResourceID, o.Price, o.PlatformFee, o.SellerIncome,
			o.Status, parseOptionalDateTime(o.PaidAt), parseDateTime(o.CreatedAt))
		if err != nil {
			return fmt.Errorf("insert order %s: %w", o.ID, err)
		}
	}

	for _, a := range auths {
		_, err := tx.Exec(ctx, `
			INSERT INTO authorizations (id, order_id, buyer_id, resource_id, auth_code, status, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (id) DO UPDATE SET
				order_id = EXCLUDED.order_id, buyer_id = EXCLUDED.buyer_id, resource_id = EXCLUDED.resource_id,
				auth_code = EXCLUDED.auth_code, status = EXCLUDED.status, created_at = EXCLUDED.created_at
		`, a.ID, a.OrderID, a.BuyerID, a.ResourceID, a.AuthCode, a.Status, parseDateTime(a.CreatedAt))
		if err != nil {
			return fmt.Errorf("insert auth %s: %w", a.ID, err)
		}
	}
	return nil
}

func seedWithdrawals(ctx context.Context, tx pgx.Tx) error {
	withdrawals := []Withdrawal{
		{ID: "wd-001", InstitutionID: "inst-001", Amount: 5000, AccountType: "bank", AccountInfo: "中国工商银行 6222************8888", Status: "paid", HandledAt: str("2024-03-10 15:00:00"), CreatedAt: "2024-03-05 09:00:00"},
		{ID: "wd-002", InstitutionID: "inst-003", Amount: 3000, AccountType: "alipay", AccountInfo: "wangfang@yunzhi.com", Status: "approved", HandledAt: str("2024-03-20 10:00:00"), CreatedAt: "2024-03-18 14:00:00"},
		{ID: "wd-003", InstitutionID: "inst-006", Amount: 2000, AccountType: "bank", AccountInfo: "招商银行 6225************6666", Status: "pending", CreatedAt: "2024-03-28 11:00:00"},
	}

	for _, w := range withdrawals {
		_, err := tx.Exec(ctx, `
			INSERT INTO withdrawals (id, institution_id, amount, account_type, account_info, status, handled_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				institution_id = EXCLUDED.institution_id, amount = EXCLUDED.amount, account_type = EXCLUDED.account_type,
				account_info = EXCLUDED.account_info, status = EXCLUDED.status, handled_at = EXCLUDED.handled_at,
				created_at = EXCLUDED.created_at
		`, w.ID, w.InstitutionID, w.Amount, w.AccountType, w.AccountInfo, w.Status, parseOptionalDateTime(w.HandledAt), parseDateTime(w.CreatedAt))
		if err != nil {
			return fmt.Errorf("insert withdrawal %s: %w", w.ID, err)
		}
	}
	return nil
}

func seedBanners(ctx context.Context, tx pgx.Tx) error {
	banners := []Banner{
		{ID: "bn-001", Title: "春季教学资源采购节", Image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80&auto=format&fit=crop", Link: "/", Sort: 1, Enabled: true},
		{ID: "bn-002", Title: "网络安全精品资源推荐", Image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80&auto=format&fit=crop", Link: "/", Sort: 2, Enabled: true},
		{ID: "bn-003", Title: "新入驻企业资源上线", Image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&q=80&auto=format&fit=crop", Link: "/", Sort: 3, Enabled: true},
	}

	for _, b := range banners {
		_, err := tx.Exec(ctx, `
			INSERT INTO banners (id, title, image, link, sort, enabled)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title, image = EXCLUDED.image, link = EXCLUDED.link,
				sort = EXCLUDED.sort, enabled = EXCLUDED.enabled
		`, b.ID, b.Title, b.Image, b.Link, b.Sort, b.Enabled)
		if err != nil {
			return fmt.Errorf("insert banner %s: %w", b.ID, err)
		}
	}
	return nil
}

func seedPlatformConfig(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO platform_configs (key, value) VALUES
			('platform_fee_rate', '0.15'),
			('min_withdrawal_amount', '100')
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO platform_links (platform, url, enabled) VALUES
			('alliance', '/portal', true),
			('career', '/job/landing', true),
			('scene', '/scene/landing', true),
			('course', '/lesson/landing', true),
			('ability', '/evaluation/landing', true),
			('ai', '/portal', false),
			('resource', '/', true),
			('opc', '/portal', false),
			('decision', '/portal', false),
			('research', '/portal', false),
			('affairs', '/portal', false),
			('mall', '/', true)
		ON CONFLICT (platform) DO UPDATE SET url = EXCLUDED.url, enabled = EXCLUDED.enabled
	`)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO app_modules (id, platform, title, description, href, sort_order) VALUES
			('aaaaaaaa-1111-1111-1111-111111111111', 'system', '租户信息管理', '管理租户基本信息与配置', '/portal/apps/system/tenant', 1),
			('aaaaaaaa-1111-1111-1111-111111111112', 'system', '系统资源管理', '套餐、编码、行业、专业', '/portal/apps/system/resource/package', 2),
			('aaaaaaaa-1111-1111-1111-111111111113', 'system', '日志管理', '登录日志、操作日志查看', '/portal/apps/system/logs/login', 3),
			('aaaaaaaa-1111-1111-1111-111111111114', 'system', '组织用户管理', '组织架构、用户账户管理', '/portal/apps/system/org-user/org-structure', 4),
			('aaaaaaaa-1111-1111-1111-111111111115', 'system', '审批流程管理', '审批流配置与管理', '/portal/apps/system/approval', 5),
			('aaaaaaaa-1111-1111-1111-111111111121', 'career', '岗位管理', '产业岗位与学习路径', '/job/positions', 1),
			('aaaaaaaa-1111-1111-1111-111111111122', 'career', '批次管理', '岗位批次与推荐', '/job/batches', 2),
			('aaaaaaaa-1111-1111-1111-111111111131', 'scene', '场景管理', '实践场景与任务设计', '/scene/', 1),
			('aaaaaaaa-1111-1111-1111-111111111132', 'scene', '场景归档', '历史场景档案库', '/scene/archive', 2),
			('aaaaaaaa-1111-1111-1111-111111111141', 'course', '体系课管理', '体系课程资源建设', '/lesson/admin/system', 1),
			('aaaaaaaa-1111-1111-1111-111111111142', 'course', '颗粒课管理', '颗粒化课程资源', '/lesson/admin/granular', 2),
			('aaaaaaaa-1111-1111-1111-111111111143', 'course', '混合课管理', '混合课模板与档案', '/lesson/admin/hybrid', 3),
			('aaaaaaaa-1111-1111-1111-111111111151', 'ability', '题库管理', '测评题库与试卷', '/evaluation/question-banks', 1),
			('aaaaaaaa-1111-1111-1111-111111111152', 'ability', '考试管理', '考试场次与结果', '/evaluation/exam-usage', 2),
			('aaaaaaaa-1111-1111-1111-111111111153', 'ability', '微证书', '认证规则与颁发', '/evaluation/certificates/templates', 3),
			('aaaaaaaa-1111-1111-1111-111111111161', 'resource', '资源商城', '教学资源交易', 'http://111.170.170.202:3010/login', 1)
		ON CONFLICT (id) DO UPDATE SET
			platform = EXCLUDED.platform, title = EXCLUDED.title,
			description = EXCLUDED.description, href = EXCLUDED.href, sort_order = EXCLUDED.sort_order
	`)
	return err
}

func seedUsers(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	users := []struct {
		ID            uuid.UUID
		InstitutionID *string
		RoleCode      string
		OrgNodeID     *uuid.UUID
		MajorID       *uuid.UUID
		Role          string
		Platform      string
		Username      string
		Password      string
		Name          string
		Email         string
		Phone         string
		StudentNo     *string
	}{
		{
			ID:       uuid.MustParse("71111111-1111-1111-1111-111111111111"),
			RoleCode: "platform_admin",
			Role:     "operator", Platform: "saas", Username: "operator", Password: "operator123",
			Name: "平台管理员", Email: "admin@zhiyu.com", Phone: "13800000001",
		},
		{
			ID:            uuid.MustParse("71111111-1111-1111-1111-111111111112"),
			InstitutionID: str("inst-002"),
			RoleCode:      "school_admin",
			OrgNodeID:     uuidPtr("31111111-1111-1111-1111-111111111111"),
			Role:          "school", Platform: "saas", Username: "school", Password: "school123",
			Name: "李华", Email: "lihua@bitc.edu.cn", Phone: "13900000002",
		},
		{
			ID:            uuid.MustParse("71111111-1111-1111-1111-111111111113"),
			InstitutionID: str("inst-001"),
			RoleCode:      "enterprise_mentor",
			OrgNodeID:     nil,
			Role:          "enterprise", Platform: "saas", Username: "enterprise", Password: "enterprise123",
			Name: "张明", Email: "zhangming@cybersec.com", Phone: "13800000003",
		},
		{
			ID:            uuid.MustParse("71111111-1111-1111-1111-111111111114"),
			InstitutionID: str("inst-002"),
			RoleCode:      "teacher",
			OrgNodeID:     uuidPtr("31111111-1111-1111-1111-111111111112"),
			MajorID:       uuidPtr("51111111-1111-1111-1111-111111111111"),
			Role:          "school", Platform: "portal", Username: "teacher", Password: "teacher123",
			Name: "王老师", Email: "teacher@bitc.edu.cn", Phone: "13900000004",
		},
		{
			ID:            uuid.MustParse("71111111-1111-1111-1111-111111111115"),
			InstitutionID: str("inst-002"),
			RoleCode:      "student",
			OrgNodeID:     uuidPtr("31111111-1111-1111-1111-111111111114"),
			MajorID:       uuidPtr("51111111-1111-1111-1111-111111111111"),
			Role:          "school", Platform: "portal", Username: "student", Password: "student123",
			Name: "张学生", Email: "student@bitc.edu.cn", Phone: "13900000005", StudentNo: str("20230101"),
		},
		{
			ID:            uuid.MustParse("71111111-1111-1111-1111-111111111116"),
			InstitutionID: str("inst-002"),
			RoleCode:      "school_admin",
			OrgNodeID:     uuidPtr("31111111-1111-1111-1111-111111111111"),
			Role:          "school", Platform: "portal", Username: "school", Password: "school123",
			Name: "李华", Email: "lihua@bitc.edu.cn", Phone: "13900000002",
		},
	}

	for _, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password for %s: %w", u.Username, err)
		}

		var orgNodeID, majorID *uuid.UUID
		if u.OrgNodeID != nil {
			orgNodeID = u.OrgNodeID
		}
		if u.MajorID != nil {
			majorID = u.MajorID
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
				role, platform, login_name, username, password_hash, name, email, phone, avatar_url, student_no,
				status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				tenant_id = EXCLUDED.tenant_id, institution_id = EXCLUDED.institution_id,
				org_node_id = EXCLUDED.org_node_id,
				major_id = EXCLUDED.major_id, role = EXCLUDED.role, platform = EXCLUDED.platform,
				login_name = EXCLUDED.login_name, username = EXCLUDED.username,
				password_hash = EXCLUDED.password_hash, name = EXCLUDED.name,
				email = EXCLUDED.email, phone = EXCLUDED.phone, avatar_url = EXCLUDED.avatar_url,
				student_no = EXCLUDED.student_no, status = EXCLUDED.status, updated_at = NOW()
		`, u.ID, tenantID, u.InstitutionID, orgNodeID, majorID,
			u.Role, u.Platform, u.Username, u.Username, string(hash), u.Name, u.Email, u.Phone, nil, u.StudentNo)
		if err != nil {
			return fmt.Errorf("insert user %s: %w", u.Username, err)
		}

		// 绑定预设角色（角色即身份）
		_, err = tx.Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id)
			VALUES ($1, $2, (SELECT id FROM roles WHERE tenant_id = $3 AND code = $4 LIMIT 1))
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), u.ID, tenantID, u.RoleCode)
		if err != nil {
			return fmt.Errorf("assign role for user %s: %w", u.Username, err)
		}
	}

	// Seed platform admin as tenant admin
	_, err := tx.Exec(ctx, `
		UPDATE tenants SET admin_ids = ARRAY[$1::UUID] WHERE id = $2
	`, uuid.MustParse("71111111-1111-1111-1111-111111111111"), tenantID)
	if err != nil {
		return fmt.Errorf("update tenant admin_ids: %w", err)
	}

	return nil
}

func seedJobData(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	teacherID := uuid.MustParse("71111111-1111-1111-1111-111111111114")

	workflows := []struct {
		id          uuid.UUID
		name        string
		description string
		steps       string
	}{
		{
			uuid.MustParse("a1111111-1111-1111-1111-111111111111"),
			"二级学院审批",
			"由二级学院进行岗位信息审核",
			`[{"name":"学院审核","approverId":"71111111-1111-1111-1111-111111111112"}]`,
		},
		{
			uuid.MustParse("a1111111-1111-1111-1111-111111111112"),
			"教务处终审",
			"由教务处进行最终审核",
			`[{"name":"教务处终审","approverId":"71111111-1111-1111-1111-111111111114"}]`,
		},
	}
	for _, w := range workflows {
		_, err := tx.Exec(ctx, `
			INSERT INTO workflows (id, tenant_id, name, scene, description, steps, usage_count, status, created_at)
			VALUES ($1, $2, $3, 'job', $4, $5::jsonb, 0, 'active', NOW())
			ON CONFLICT (id) DO UPDATE SET
				tenant_id = EXCLUDED.tenant_id, name = EXCLUDED.name, scene = EXCLUDED.scene,
				description = EXCLUDED.description, steps = EXCLUDED.steps, usage_count = EXCLUDED.usage_count,
				status = EXCLUDED.status
		`, w.id, tenantID, w.name, w.description, w.steps)
		if err != nil {
			return fmt.Errorf("seed workflow %s: %w", w.name, err)
		}
	}

	batches := []struct {
		id         uuid.UUID
		name       string
		code       string
		orgNodeID  uuid.UUID
		major      string
		workflowID uuid.UUID
	}{
		{
			uuid.MustParse("a2222222-2222-2222-2222-222222222221"),
			"2024年春季岗位建设批次",
			"BATCH-2024-SPRING",
			uuid.MustParse("31111111-1111-1111-1111-111111111113"),
			"信息安全技术应用",
			uuid.MustParse("a1111111-1111-1111-1111-111111111111"),
		},
		{
			uuid.MustParse("a2222222-2222-2222-2222-222222222222"),
			"2024年秋季岗位建设批次",
			"BATCH-2024-FALL",
			uuid.MustParse("31111111-1111-1111-1111-111111111113"),
			"云计算技术应用",
			uuid.MustParse("a1111111-1111-1111-1111-111111111112"),
		},
	}
	for _, b := range batches {
		_, err := tx.Exec(ctx, `
			INSERT INTO batches (id, name, code, org_node_id, major, workflow_id, status,
				position_count, published_count, pending_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, 0, 0, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, code = EXCLUDED.code, org_node_id = EXCLUDED.org_node_id,
				major = EXCLUDED.major, workflow_id = EXCLUDED.workflow_id, status = EXCLUDED.status,
				position_count = EXCLUDED.position_count, published_count = EXCLUDED.published_count,
				pending_count = EXCLUDED.pending_count, updated_at = NOW()
		`, b.id, b.name, b.code, b.orgNodeID, b.major, b.workflowID)
		if err != nil {
			return fmt.Errorf("seed batch %s: %w", b.name, err)
		}
	}

	abilityPoints := []struct {
		id          uuid.UUID
		name        string
		description string
		category    string
	}{
		{uuid.MustParse("a3333333-3333-3333-3333-333333333331"), "网络安全基础", "掌握网络安全基本概念与防护原理", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333332"), "渗透测试", "具备 Web 与系统渗透测试能力", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333333"), "漏洞分析", "能够分析常见安全漏洞成因与利用方式", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333334"), "安全运维", "熟悉安全设备配置与日常运维", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333335"), "代码审计", "具备源代码安全审计与修复能力", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333336"), "应急响应", "能够处置安全事件并开展溯源分析", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333337"), "云计算基础", "掌握云计算架构与主流平台操作", "technical"},
		{uuid.MustParse("a3333333-3333-3333-3333-333333333338"), "容器安全", "熟悉 Docker/Kubernetes 安全配置", "technical"},
	}
	for _, ap := range abilityPoints {
		_, err := tx.Exec(ctx, `
			INSERT INTO ability_points (id, name, description, category, is_public, created_at)
			VALUES ($1, $2, $3, $4, true, NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
				is_public = EXCLUDED.is_public
		`, ap.id, ap.name, ap.description, ap.category)
		if err != nil {
			return fmt.Errorf("seed ability point %s: %w", ap.name, err)
		}
	}

	positions := []struct {
		id           uuid.UUID
		batchID      uuid.UUID
		name         string
		shortName    string
		positionType string
		salaryMin    int
		salaryMax    int
		description  string
		requirements []string
		careerPath   string
		version      string
		status       string
		majorIDs     []uuid.UUID
	}{
		{
			uuid.MustParse("a4444444-4444-4444-4444-444444444441"),
			uuid.MustParse("a2222222-2222-2222-2222-222222222221"),
			"网络安全运维工程师",
			"安全运维",
			"enterprise",
			8000, 15000,
			"负责企业网络安全设备运维、安全策略配置及日常安全监控。",
			[]string{"熟悉防火墙、IDS/IPS 配置", "具备 Linux 系统运维经验", "了解常见网络协议"},
			"安全运维工程师 → 安全架构师 → 安全总监",
			"v1.0",
			"draft",
			[]uuid.UUID{uuid.MustParse("51111111-1111-1111-1111-111111111111")},
		},
		{
			uuid.MustParse("a4444444-4444-4444-4444-444444444442"),
			uuid.MustParse("a2222222-2222-2222-2222-222222222221"),
			"渗透测试工程师",
			"渗透测试",
			"enterprise",
			10000, 20000,
			"开展 Web 应用、移动应用及内网渗透测试，输出安全测试报告。",
			[]string{"熟练掌握渗透测试工具", "具备漏洞挖掘与利用能力", "能够编写测试报告"},
			"渗透测试工程师 → 红队专家 → 安全研究负责人",
			"v1.0",
			"pending",
			[]uuid.UUID{uuid.MustParse("51111111-1111-1111-1111-111111111111")},
		},
		{
			uuid.MustParse("a4444444-4444-4444-4444-444444444443"),
			uuid.MustParse("a2222222-2222-2222-2222-222222222221"),
			"信息安全教学岗",
			"安全教学",
			"teaching",
			6000, 12000,
			"面向高职学生开展信息安全课程教学与实训指导。",
			[]string{"具备信息安全专业背景", "熟悉高职教学方法", "持有相关职业资格证书"},
			"专任教师 → 专业负责人 → 教学副院长",
			"v1.0",
			"approved",
			[]uuid.UUID{uuid.MustParse("51111111-1111-1111-1111-111111111111")},
		},
		{
			uuid.MustParse("a4444444-4444-4444-4444-444444444444"),
			uuid.MustParse("a2222222-2222-2222-2222-222222222222"),
			"云计算运维工程师",
			"云运维",
			"enterprise",
			9000, 18000,
			"负责云平台资源管理、容器编排及云安全策略落地。",
			[]string{"熟悉 OpenStack/Docker/Kubernetes", "具备云网络与安全配置经验", "了解 DevOps 流程"},
			"云运维工程师 → 云架构师 → 技术总监",
			"v1.0",
			"published",
			[]uuid.UUID{uuid.MustParse("51111111-1111-1111-1111-111111111112")},
		},
		{
			uuid.MustParse("a4444444-4444-4444-4444-444444444445"),
			uuid.MustParse("a2222222-2222-2222-2222-222222222222"),
			"云计算技术应用教学岗",
			"云教学",
			"teaching",
			6000, 12000,
			"承担云计算技术应用专业课程教学与实验指导。",
			[]string{"具备云计算专业背景", "能够设计实验实训项目", "熟悉主流云平台操作"},
			"专任教师 → 专业负责人 → 系主任",
			"v1.0",
			"archived",
			[]uuid.UUID{uuid.MustParse("51111111-1111-1111-1111-111111111112")},
		},
	}
	for _, p := range positions {
		_, err := tx.Exec(ctx, `
			INSERT INTO career_positions (id, batch_id, name, short_name, position_type, salary_min, salary_max,
				description, requirements, career_path, version, status, created_by, major_ids, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				batch_id = EXCLUDED.batch_id, name = EXCLUDED.name, short_name = EXCLUDED.short_name,
				position_type = EXCLUDED.position_type, salary_min = EXCLUDED.salary_min, salary_max = EXCLUDED.salary_max,
				description = EXCLUDED.description, requirements = EXCLUDED.requirements, career_path = EXCLUDED.career_path,
				version = EXCLUDED.version, status = EXCLUDED.status, created_by = EXCLUDED.created_by,
				major_ids = EXCLUDED.major_ids, updated_at = NOW()
		`, p.id, p.batchID, p.name, p.shortName, p.positionType, p.salaryMin, p.salaryMax,
			p.description, p.requirements, p.careerPath, p.version, p.status, teacherID, p.majorIDs)
		if err != nil {
			return fmt.Errorf("seed career position %s: %w", p.name, err)
		}
	}

	responsibilities := []struct {
		id       uuid.UUID
		position uuid.UUID
		name     string
		desc     string
		sort     int
	}{
		{uuid.MustParse("a5555555-5555-5555-5555-555555555551"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "安全设备运维", "负责防火墙、IDS/IPS、WAF 等安全设备的日常运维与策略调优", 1},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555552"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "安全策略管理", "制定并维护网络安全策略、访问控制策略", 2},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555553"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "安全事件监控", "监控安全告警，进行初步分析与应急响应", 3},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555554"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "Web 渗透测试", "对 Web 应用进行黑盒/白盒渗透测试", 1},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555555"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "内网渗透测试", "开展内网横向移动与权限提升测试", 2},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555556"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "安全报告编写", "整理测试过程与结果，输出渗透测试报告", 3},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555557"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), "课程教学", "承担网络安全相关课程理论教学", 1},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555558"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), "实训指导", "指导学生完成安全运维与渗透测试实训", 2},
		{uuid.MustParse("a5555555-5555-5555-5555-555555555559"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), "云平台运维", "负责云平台计算、网络、存储资源管理", 1},
		{uuid.MustParse("a5555555-5555-5555-5555-55555555555a"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), "容器编排管理", "管理 Docker/Kubernetes 容器集群与安全配置", 2},
		{uuid.MustParse("a5555555-5555-5555-5555-55555555555b"), uuid.MustParse("a4444444-4444-4444-4444-444444444445"), "云计算课程教学", "承担云计算技术应用课程教学", 1},
		{uuid.MustParse("a5555555-5555-5555-5555-55555555555c"), uuid.MustParse("a4444444-4444-4444-4444-444444444445"), "实验指导", "指导学生完成云平台与容器实验", 2},
	}
	for _, r := range responsibilities {
		_, err := tx.Exec(ctx, `
			INSERT INTO position_responsibilities (id, career_position_id, name, description, sort_order)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				career_position_id = EXCLUDED.career_position_id, name = EXCLUDED.name,
				description = EXCLUDED.description, sort_order = EXCLUDED.sort_order
		`, r.id, r.position, r.name, r.desc, r.sort)
		if err != nil {
			return fmt.Errorf("seed responsibility %s: %w", r.name, err)
		}
	}

	bindings := []struct {
		id             uuid.UUID
		position       uuid.UUID
		responsibility uuid.UUID
		ability        uuid.UUID
		level          string
		weight         float64
	}{
		{uuid.MustParse("a6666666-6666-6666-6666-666666666661"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), uuid.MustParse("a5555555-5555-5555-5555-555555555551"), uuid.MustParse("a3333333-3333-3333-3333-333333333331"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666662"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), uuid.MustParse("a5555555-5555-5555-5555-555555555551"), uuid.MustParse("a3333333-3333-3333-3333-333333333334"), "L3", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666663"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), uuid.MustParse("a5555555-5555-5555-5555-555555555552"), uuid.MustParse("a3333333-3333-3333-3333-333333333331"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666664"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), uuid.MustParse("a5555555-5555-5555-5555-555555555553"), uuid.MustParse("a3333333-3333-3333-3333-333333333336"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666665"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), uuid.MustParse("a5555555-5555-5555-5555-555555555554"), uuid.MustParse("a3333333-3333-3333-3333-333333333332"), "L3", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666666"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), uuid.MustParse("a5555555-5555-5555-5555-555555555554"), uuid.MustParse("a3333333-3333-3333-3333-333333333333"), "L2", 0.50},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666667"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), uuid.MustParse("a5555555-5555-5555-5555-555555555555"), uuid.MustParse("a3333333-3333-3333-3333-333333333332"), "L3", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666668"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), uuid.MustParse("a5555555-5555-5555-5555-555555555556"), uuid.MustParse("a3333333-3333-3333-3333-333333333333"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666669"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), uuid.MustParse("a5555555-5555-5555-5555-555555555557"), uuid.MustParse("a3333333-3333-3333-3333-333333333331"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666a"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), uuid.MustParse("a5555555-5555-5555-5555-555555555557"), uuid.MustParse("a3333333-3333-3333-3333-333333333332"), "L2", 0.50},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666b"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), uuid.MustParse("a5555555-5555-5555-5555-555555555558"), uuid.MustParse("a3333333-3333-3333-3333-333333333334"), "L3", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666c"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), uuid.MustParse("a5555555-5555-5555-5555-555555555559"), uuid.MustParse("a3333333-3333-3333-3333-333333333337"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666d"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), uuid.MustParse("a5555555-5555-5555-5555-555555555559"), uuid.MustParse("a3333333-3333-3333-3333-333333333338"), "L2", 0.50},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666e"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), uuid.MustParse("a5555555-5555-5555-5555-55555555555a"), uuid.MustParse("a3333333-3333-3333-3333-333333333338"), "L3", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-66666666666f"), uuid.MustParse("a4444444-4444-4444-4444-444444444445"), uuid.MustParse("a5555555-5555-5555-5555-55555555555b"), uuid.MustParse("a3333333-3333-3333-3333-333333333337"), "L2", 1.00},
		{uuid.MustParse("a6666666-6666-6666-6666-666666666670"), uuid.MustParse("a4444444-4444-4444-4444-444444444445"), uuid.MustParse("a5555555-5555-5555-5555-55555555555c"), uuid.MustParse("a3333333-3333-3333-3333-333333333338"), "L2", 1.00},
	}
	for _, b := range bindings {
		_, err := tx.Exec(ctx, `
			INSERT INTO position_ability_bindings (id, career_position_id, responsibility_id, ability_point_id,
				source, domain, required_level, rubric_description, attributes, weight)
			VALUES ($1, $2, $3, $4, 'custom', '', $5, '', '{}', $6)
			ON CONFLICT (id) DO UPDATE SET
				career_position_id = EXCLUDED.career_position_id, responsibility_id = EXCLUDED.responsibility_id,
				ability_point_id = EXCLUDED.ability_point_id, source = EXCLUDED.source, domain = EXCLUDED.domain,
				required_level = EXCLUDED.required_level, rubric_description = EXCLUDED.rubric_description,
				attributes = EXCLUDED.attributes, weight = EXCLUDED.weight
		`, b.id, b.position, b.responsibility, b.ability, b.level, b.weight)
		if err != nil {
			return fmt.Errorf("seed binding %s: %w", b.id, err)
		}
	}

	domains := []struct {
		id       uuid.UUID
		position uuid.UUID
		name     string
		desc     string
		bindings []uuid.UUID
		sort     int
	}{
		{uuid.MustParse("a7777777-7777-7777-7777-777777777771"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "安全运维域", "覆盖安全设备运维与事件监控能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-666666666661"), uuid.MustParse("a6666666-6666-6666-6666-666666666662"), uuid.MustParse("a6666666-6666-6666-6666-666666666664")}, 1},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777772"), uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "网络防护域", "覆盖网络安全策略与基础防护能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-666666666661"), uuid.MustParse("a6666666-6666-6666-6666-666666666663")}, 2},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777773"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "渗透测试域", "覆盖 Web 与内网渗透测试能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-666666666665"), uuid.MustParse("a6666666-6666-6666-6666-666666666666"), uuid.MustParse("a6666666-6666-6666-6666-666666666667")}, 1},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777774"), uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "漏洞分析域", "覆盖漏洞挖掘与分析能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-666666666666"), uuid.MustParse("a6666666-6666-6666-6666-666666666668")}, 2},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777775"), uuid.MustParse("a4444444-4444-4444-4444-444444444443"), "教学能力域", "覆盖信息安全教学与实训指导能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-666666666669"), uuid.MustParse("a6666666-6666-6666-6666-66666666666a"), uuid.MustParse("a6666666-6666-6666-6666-66666666666b")}, 1},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777776"), uuid.MustParse("a4444444-4444-4444-4444-444444444444"), "云计算运维域", "覆盖云平台与容器运维能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-66666666666c"), uuid.MustParse("a6666666-6666-6666-6666-66666666666d"), uuid.MustParse("a6666666-6666-6666-6666-66666666666e")}, 1},
		{uuid.MustParse("a7777777-7777-7777-7777-777777777777"), uuid.MustParse("a4444444-4444-4444-4444-444444444445"), "云计算教学域", "覆盖云计算课程教学与实验指导能力", []uuid.UUID{uuid.MustParse("a6666666-6666-6666-6666-66666666666f"), uuid.MustParse("a6666666-6666-6666-6666-666666666670")}, 1},
	}
	for _, d := range domains {
		_, err := tx.Exec(ctx, `
			INSERT INTO ability_domains (id, career_position_id, name, description, binding_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				career_position_id = EXCLUDED.career_position_id, name = EXCLUDED.name,
				description = EXCLUDED.description, binding_ids = EXCLUDED.binding_ids, sort_order = EXCLUDED.sort_order
		`, d.id, d.position, d.name, d.desc, d.bindings, d.sort)
		if err != nil {
			return fmt.Errorf("seed ability domain %s: %w", d.name, err)
		}
	}

	recommendations := []struct {
		id       uuid.UUID
		major    string
		position uuid.UUID
		posType  string
		reason   string
		sort     int
	}{
		{uuid.MustParse("a8888888-8888-8888-8888-888888888881"), "信息安全技术应用", uuid.MustParse("a4444444-4444-4444-4444-444444444441"), "enterprise", "契合信息安全专业核心能力，岗位需求量大", 1},
		{uuid.MustParse("a8888888-8888-8888-8888-888888888882"), "信息安全技术应用", uuid.MustParse("a4444444-4444-4444-4444-444444444442"), "enterprise", "适合具备渗透测试兴趣的学生发展方向", 2},
	}
	for _, r := range recommendations {
		_, err := tx.Exec(ctx, `
			INSERT INTO position_recommendations (id, major, career_position_id, position_type, reason, sort_order, is_enabled, created_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				major = EXCLUDED.major, career_position_id = EXCLUDED.career_position_id,
				position_type = EXCLUDED.position_type, reason = EXCLUDED.reason, sort_order = EXCLUDED.sort_order,
				is_enabled = EXCLUDED.is_enabled, created_by = EXCLUDED.created_by, updated_at = NOW()
		`, r.id, r.major, r.position, r.posType, r.reason, r.sort, teacherID)
		if err != nil {
			return fmt.Errorf("seed recommendation %s: %w", r.major, err)
		}
	}

	learnRoads := []struct {
		id     uuid.UUID
		name   string
		desc   string
		posIDs []uuid.UUID
		steps  string
	}{
		{
			uuid.MustParse("a9999999-9999-9999-9999-999999999991"),
			"信息安全工程师成长路径",
			"从安全运维到渗透测试的完整学习路径",
			[]uuid.UUID{
				uuid.MustParse("a4444444-4444-4444-4444-444444444441"),
				uuid.MustParse("a4444444-4444-4444-4444-444444444442"),
				uuid.MustParse("a4444444-4444-4444-4444-444444444443"),
			},
			`[{"name":"网络安全基础","abilityPointIds":["a3333333-3333-3333-3333-333333333331"]},{"name":"安全运维实践","abilityPointIds":["a3333333-3333-3333-3333-333333333334"]},{"name":"渗透测试进阶","abilityPointIds":["a3333333-3333-3333-3333-333333333332","a3333333-3333-3333-3333-333333333333"]}]`,
		},
		{
			uuid.MustParse("a9999999-9999-9999-9999-999999999992"),
			"云计算工程师成长路径",
			"从云计算基础到容器安全的完整学习路径",
			[]uuid.UUID{
				uuid.MustParse("a4444444-4444-4444-4444-444444444444"),
				uuid.MustParse("a4444444-4444-4444-4444-444444444445"),
			},
			`[{"name":"云计算基础","abilityPointIds":["a3333333-3333-3333-3333-333333333337"]},{"name":"容器安全","abilityPointIds":["a3333333-3333-3333-3333-333333333338"]},{"name":"云平台运维实战","abilityPointIds":["a3333333-3333-3333-3333-333333333337","a3333333-3333-3333-3333-333333333338"]}]`,
		},
	}
	for _, lr := range learnRoads {
		_, err := tx.Exec(ctx, `
			INSERT INTO learn_roads (id, name, description, position_ids, steps, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, description = EXCLUDED.description, position_ids = EXCLUDED.position_ids,
				steps = EXCLUDED.steps, updated_at = NOW()
		`, lr.id, lr.name, lr.desc, lr.posIDs, lr.steps)
		if err != nil {
			return fmt.Errorf("seed learn road %s: %w", lr.name, err)
		}
	}

	banners := []struct {
		id     uuid.UUID
		title  string
		image  string
		link   string
		sort   int
		active bool
	}{
		{
			uuid.MustParse("aa111111-1111-1111-1111-111111111111"),
			"网络安全岗位推荐",
			"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80&auto=format&fit=crop",
			"/job/positions",
			1,
			true,
		},
		{
			uuid.MustParse("aa111111-1111-1111-1111-111111111112"),
			"云计算岗位推荐",
			"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop",
			"/job/positions",
			2,
			true,
		},
	}
	for _, b := range banners {
		_, err := tx.Exec(ctx, `
			INSERT INTO banner_configs (id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title, image_url = EXCLUDED.image_url, link_url = EXCLUDED.link_url,
				sort_order = EXCLUDED.sort_order, is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
		`, b.id, b.title, b.image, b.link, b.sort, b.active)
		if err != nil {
			return fmt.Errorf("seed banner config %s: %w", b.title, err)
		}
	}

	return nil
}

func seedSceneData(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	teacherID := uuid.MustParse("71111111-1111-1111-1111-111111111114")

	workflows := []struct {
		id          uuid.UUID
		name        string
		description string
		steps       string
	}{
		{
			uuid.MustParse("b1111111-1111-1111-1111-111111111111"),
			"场景审批流程",
			"由教研室进行场景审核",
			`[{"name":"教研室审核","approverId":"71111111-1111-1111-1111-111111111114"}]`,
		},
	}
	for _, w := range workflows {
		_, err := tx.Exec(ctx, `
			INSERT INTO workflows (id, tenant_id, name, scene, description, steps, usage_count, status, created_at)
			VALUES ($1, $2, $3, 'scene', $4, $5::jsonb, 0, 'active', NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, scene = EXCLUDED.scene, description = EXCLUDED.description,
				steps = EXCLUDED.steps, status = EXCLUDED.status
		`, w.id, tenantID, w.name, w.description, w.steps)
		if err != nil {
			return fmt.Errorf("seed scene workflow %s: %w", w.name, err)
		}
	}

	batches := []struct {
		id         uuid.UUID
		name       string
		code       string
		orgNodeID  uuid.UUID
		major      string
		workflowID uuid.UUID
	}{
		{
			uuid.MustParse("b2222222-2222-2222-2222-222222222221"),
			"2024年春季场景建设批次",
			"SCENE-BATCH-2024-SPRING",
			uuid.MustParse("31111111-1111-1111-1111-111111111113"),
			"信息安全技术应用",
			uuid.MustParse("b1111111-1111-1111-1111-111111111111"),
		},
	}
	for _, b := range batches {
		_, err := tx.Exec(ctx, `
			INSERT INTO scene_batches (id, name, code, org_node_id, major, workflow_id, status, scenario_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, code = EXCLUDED.code, org_node_id = EXCLUDED.org_node_id,
				major = EXCLUDED.major, workflow_id = EXCLUDED.workflow_id, status = EXCLUDED.status,
				scenario_count = EXCLUDED.scenario_count, updated_at = NOW()
		`, b.id, b.name, b.code, b.orgNodeID, b.major, b.workflowID)
		if err != nil {
			return fmt.Errorf("seed scene batch %s: %w", b.name, err)
		}
	}

	scenarios := []struct {
		id         uuid.UUID
		batchID    uuid.UUID
		name       string
		code       string
		status     string
		difficulty int
	}{
		{
			uuid.MustParse("b3333333-3333-3333-3333-333333333331"),
			uuid.MustParse("b2222222-2222-2222-2222-222222222221"),
			"企业级前端项目开发实战",
			"SC-2026-0001",
			"draft",
			3,
		},
		{
			uuid.MustParse("b3333333-3333-3333-3333-333333333332"),
			uuid.MustParse("b2222222-2222-2222-2222-222222222221"),
			"渗透测试实战场景",
			"SC-2026-0002",
			"pending",
			4,
		},
		{
			uuid.MustParse("b3333333-3333-3333-3333-333333333333"),
			uuid.MustParse("b2222222-2222-2222-2222-222222222221"),
			"云计算平台搭建与运维",
			"SC-2026-0003",
			"published",
			3,
		},
	}
	for _, s := range scenarios {
		_, err := tx.Exec(ctx, `
			INSERT INTO scenarios (id, name, code, batch_id, difficulty, version, status, creator_id, co_builder_ids, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'v1.0', $6, $7, ARRAY[$8::UUID], NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, code = EXCLUDED.code, batch_id = EXCLUDED.batch_id,
				difficulty = EXCLUDED.difficulty, version = EXCLUDED.version, status = EXCLUDED.status,
				creator_id = EXCLUDED.creator_id, co_builder_ids = EXCLUDED.co_builder_ids, updated_at = NOW()
		`, s.id, s.name, s.code, s.batchID, s.difficulty, s.status, teacherID, teacherID)
		if err != nil {
			return fmt.Errorf("seed scenario %s: %w", s.name, err)
		}
	}

	return nil
}

func seedLessonData(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	teacherID := uuid.MustParse("71111111-1111-1111-1111-111111111114")

	workflows := []struct {
		id          uuid.UUID
		name        string
		description string
		steps       string
	}{
		{
			uuid.MustParse("c1111111-1111-1111-1111-111111111111"),
			"课程审批流程",
			"由二级学院进行课程审核",
			`[{"name":"学院审核","approverId":"71111111-1111-1111-1111-111111111114"}]`,
		},
	}
	for _, w := range workflows {
		_, err := tx.Exec(ctx, `
			INSERT INTO workflows (id, tenant_id, name, scene, description, steps, usage_count, status, created_at)
			VALUES ($1, $2, $3, 'lesson', $4, $5::jsonb, 0, 'active', NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, scene = EXCLUDED.scene, description = EXCLUDED.description,
				steps = EXCLUDED.steps, status = EXCLUDED.status
		`, w.id, tenantID, w.name, w.description, w.steps)
		if err != nil {
			return fmt.Errorf("seed lesson workflow %s: %w", w.name, err)
		}
	}

	batches := []struct {
		id         uuid.UUID
		name       string
		code       string
		orgNodeID  uuid.UUID
		major      string
		workflowID uuid.UUID
	}{
		{
			uuid.MustParse("c2222222-2222-2222-2222-222222222221"),
			"2024年春季课程建设批次",
			"COURSE-BATCH-2024-SPRING",
			uuid.MustParse("31111111-1111-1111-1111-111111111113"),
			"信息安全技术应用",
			uuid.MustParse("c1111111-1111-1111-1111-111111111111"),
		},
	}
	for _, b := range batches {
		_, err := tx.Exec(ctx, `
			INSERT INTO lesson_batches (id, name, code, org_node_id, major, workflow_id, status, course_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, code = EXCLUDED.code, org_node_id = EXCLUDED.org_node_id,
				major = EXCLUDED.major, workflow_id = EXCLUDED.workflow_id, status = EXCLUDED.status,
				updated_at = NOW()
		`, b.id, b.name, b.code, b.orgNodeID, b.major, b.workflowID)
		if err != nil {
			return fmt.Errorf("seed lesson batch %s: %w", b.name, err)
		}
	}

	courses := []struct {
		id         uuid.UUID
		name       string
		code       string
		courseType string
		category   string
		status     string
		batchID    uuid.UUID
	}{
		{
			uuid.MustParse("c3333333-3333-3333-3333-333333333331"),
			"Web 应用安全开发",
			"C-2026-0001",
			"system",
			"专业核心课",
			"draft",
			uuid.MustParse("c2222222-2222-2222-2222-222222222221"),
		},
		{
			uuid.MustParse("c3333333-3333-3333-3333-333333333332"),
			"网络安全运维基础",
			"C-2026-0002",
			"system",
			"专业基础课",
			"pending",
			uuid.MustParse("c2222222-2222-2222-2222-222222222221"),
		},
		{
			uuid.MustParse("c3333333-3333-3333-3333-333333333333"),
			"云计算平台搭建",
			"C-2026-0003",
			"system",
			"专业核心课",
			"published",
			uuid.MustParse("c2222222-2222-2222-2222-222222222221"),
		},
	}
	for _, c := range courses {
		_, err := tx.Exec(ctx, `
			INSERT INTO courses (id, code, name, type, category, status, creator_id, batch_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				code = EXCLUDED.code, name = EXCLUDED.name, type = EXCLUDED.type,
				category = EXCLUDED.category, status = EXCLUDED.status, creator_id = EXCLUDED.creator_id,
				co_creator_ids = '{}', batch_id = EXCLUDED.batch_id, updated_at = NOW()
		`, c.id, c.code, c.name, c.courseType, c.category, c.status, teacherID, c.batchID)
		if err != nil {
			return fmt.Errorf("seed course %s: %w", c.name, err)
		}
	}

	return nil
}

func seedEvaluationData(ctx context.Context, tx pgx.Tx) error {
	tenantID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	teacherID := uuid.MustParse("71111111-1111-1111-1111-111111111114")

	workflows := []struct {
		id          uuid.UUID
		name        string
		description string
		steps       string
	}{
		{
			uuid.MustParse("d1111111-1111-1111-1111-111111111111"),
			"题库审批流程",
			"由教研室进行题库审核",
			`[{"name":"教研室审核","approverId":"71111111-1111-1111-1111-111111111114"}]`,
		},
	}
	for _, w := range workflows {
		_, err := tx.Exec(ctx, `
			INSERT INTO workflows (id, tenant_id, name, scene, description, steps, usage_count, status, created_at)
			VALUES ($1, $2, $3, 'evaluation', $4, $5::jsonb, 0, 'active', NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, scene = EXCLUDED.scene, description = EXCLUDED.description,
				steps = EXCLUDED.steps, status = EXCLUDED.status
		`, w.id, tenantID, w.name, w.description, w.steps)
		if err != nil {
			return fmt.Errorf("seed evaluation workflow %s: %w", w.name, err)
		}
	}

	batches := []struct {
		id         uuid.UUID
		name       string
		code       string
		orgNodeID  uuid.UUID
		major      string
		workflowID uuid.UUID
	}{
		{
			uuid.MustParse("d2222222-2222-2222-2222-222222222221"),
			"2024年春季题库建设批次",
			"EVAL-BATCH-2024-SPRING",
			uuid.MustParse("31111111-1111-1111-1111-111111111113"),
			"信息安全技术应用",
			uuid.MustParse("d1111111-1111-1111-1111-111111111111"),
		},
	}
	for _, b := range batches {
		_, err := tx.Exec(ctx, `
			INSERT INTO evaluation_batches (id, name, code, org_node_id, major, workflow_id, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, code = EXCLUDED.code, org_node_id = EXCLUDED.org_node_id,
				major = EXCLUDED.major, workflow_id = EXCLUDED.workflow_id, status = EXCLUDED.status,
				updated_at = NOW()
		`, b.id, b.name, b.code, b.orgNodeID, b.major, b.workflowID)
		if err != nil {
			return fmt.Errorf("seed evaluation batch %s: %w", b.name, err)
		}
	}

	banks := []struct {
		id      uuid.UUID
		batchID uuid.UUID
		name    string
		status  string
	}{
		{
			uuid.MustParse("d3333333-3333-3333-3333-333333333331"),
			uuid.MustParse("d2222222-2222-2222-2222-222222222221"),
			"网络安全基础题库",
			"draft",
		},
		{
			uuid.MustParse("d3333333-3333-3333-3333-333333333332"),
			uuid.MustParse("d2222222-2222-2222-2222-222222222221"),
			"渗透测试题库",
			"published",
		},
	}
	for _, b := range banks {
		_, err := tx.Exec(ctx, `
			INSERT INTO question_banks (id, name, description, status, question_count, creator_id, collaborator_ids, batch_id, version, owner_type, is_draft_pool, created_at, updated_at)
			VALUES ($1, $2, '', $3, 0, $4, ARRAY[$5::UUID], $6, 'v1.0', 'mine', false, NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, question_count = EXCLUDED.question_count,
				creator_id = EXCLUDED.creator_id, collaborator_ids = EXCLUDED.collaborator_ids, batch_id = EXCLUDED.batch_id,
				version = EXCLUDED.version, updated_at = NOW()
		`, b.id, b.name, b.status, teacherID, teacherID, b.batchID)
		if err != nil {
			return fmt.Errorf("seed question bank %s: %w", b.name, err)
		}
	}

	exams := []struct {
		id       uuid.UUID
		batchID  uuid.UUID
		name     string
		status   string
		duration int
	}{
		{
			uuid.MustParse("d4444444-4444-4444-4444-444444444441"),
			uuid.MustParse("d2222222-2222-2222-2222-222222222221"),
			"Web 安全期中测试",
			"draft",
			90,
		},
		{
			uuid.MustParse("d4444444-4444-4444-4444-444444444442"),
			uuid.MustParse("d2222222-2222-2222-2222-222222222221"),
			"渗透测试期末试卷",
			"published",
			120,
		},
	}
	for _, e := range exams {
		_, err := tx.Exec(ctx, `
			INSERT INTO exams (id, name, description, status, duration, creator_id, collaborator_ids, batch_id, version, owner_type, created_at, updated_at)
			VALUES ($1, $2, '', $3, $4, $5, ARRAY[$6::UUID], $7, 'v1.0', 'mine', NOW(), NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, duration = EXCLUDED.duration,
				creator_id = EXCLUDED.creator_id, collaborator_ids = EXCLUDED.collaborator_ids, batch_id = EXCLUDED.batch_id,
				version = EXCLUDED.version, updated_at = NOW()
		`, e.id, e.name, e.status, e.duration, teacherID, teacherID, e.batchID)
		if err != nil {
			return fmt.Errorf("seed exam %s: %w", e.name, err)
		}
	}

	return nil
}

func str(s string) *string {
	return &s
}

func uuidPtr(s string) *uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return nil
	}
	return &id
}

func parseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

func parseDateTime(s string) time.Time {
	t, _ := time.Parse("2006-01-02 15:04:05", s)
	return t
}

func parseOptionalDateTime(s *string) *time.Time {
	if s == nil {
		return nil
	}
	t := parseDateTime(*s)
	return &t
}
