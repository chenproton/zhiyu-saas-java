package domain

import (
	"encoding/json"
	"time"
)

// ===== 学校信息 =====
type AllianceSchoolInfo struct {
	ID                string          `json:"id"`
	TenantID          string          `json:"tenantId"`
	Name              string          `json:"name"`
	ShortName         *string         `json:"shortName,omitempty"`
	SchoolType        *string         `json:"schoolType,omitempty"`
	Province          *string         `json:"province,omitempty"`
	City              *string         `json:"city,omitempty"`
	Address           *string         `json:"address,omitempty"`
	Website           *string         `json:"website,omitempty"`
	ContactPhone      *string         `json:"contactPhone,omitempty"`
	Description       *string         `json:"description,omitempty"`
	LogoURL           *string         `json:"logoUrl,omitempty"`
	ScaleData         json.RawMessage `json:"scaleData,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

// ===== 企业主体（partner_enterprises，全局唯一，归属企业租户） =====
// 学校管理字段（评级/状态/类型/前台展示/二级学院）已下沉到 AllianceEnterpriseLink。
type AllianceEnterprise struct {
	ID                         string          `json:"id"`
	TenantID                   string          `json:"tenantId"`
	Name                       string          `json:"name"`
	Industry                   *string         `json:"industry,omitempty"`
	Region                     *string         `json:"region,omitempty"`
	Description                *string         `json:"description,omitempty"`
	LogoURL                    *string         `json:"logoUrl,omitempty"`
	CoverImage                 *string         `json:"coverImage,omitempty"`
	CooperationTypes           json.RawMessage `json:"cooperationTypes,omitempty"`
	ContactPerson              *string         `json:"contactPerson,omitempty"`
	ContactPhone               *string         `json:"contactPhone,omitempty"`
	ContactEmail               *string         `json:"contactEmail,omitempty"`
	Address                    *string         `json:"address,omitempty"`
	UnifiedSocialCreditCode    *string         `json:"unifiedSocialCreditCode,omitempty"`
	EstablishedYear            *int            `json:"establishedYear,omitempty"`
	EmployeeCount              *int            `json:"employeeCount,omitempty"`
	BusinessLicensePhotos      json.RawMessage `json:"businessLicensePhotos,omitempty"`
	QualificationPhotos        json.RawMessage `json:"qualificationPhotos,omitempty"`
	IntellectualPropertyPhotos json.RawMessage `json:"intellectualPropertyPhotos,omitempty"`
	CoverPhotos                json.RawMessage `json:"coverPhotos,omitempty"`
	EnablePublic               bool            `json:"enablePublic"`
	// 学校侧评级（link.rating）；仅租户范围的公开列表返回，前台评级筛选用
	Rating *string `json:"rating,omitempty"`
	// 门户前台公开列表返回：该校与该企业的合作内容统计（仅 ListPublicEnterprises 带 tenantId 分支返回）
	ProjectCount     int       `json:"projectCount,omitempty"`
	AgreementCount   int       `json:"agreementCount,omitempty"`
	AchievementCount int       `json:"achievementCount,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// ===== 学校-企业合作关联（alliance_enterprise_links，tenant_id = 学校租户） =====
type AllianceEnterpriseLink struct {
	ID                string          `json:"id"`
	TenantID          string          `json:"tenantId"`
	EnterpriseID      string          `json:"enterpriseId"`
	RelationType      string          `json:"relationType"`
	Status            string          `json:"status"`
	Rating            *string         `json:"rating,omitempty"`
	EnterpriseType    string          `json:"enterpriseType"`
	IsPublic          bool            `json:"isPublic"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	CreatedBy         *string         `json:"createdBy,omitempty"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

// ===== 学校侧企业合并视图：全局主体（只读）+ link 学校侧管理字段 =====
// json 字段名与原学校侧 AllianceEnterprise 契约兼容（status/rating/enterpriseType/isPublic/secondaryColleges 保持原名）。
type AllianceLinkedEnterprise struct {
	AllianceEnterprise
	LinkID            string          `json:"linkId"`
	RelationType      string          `json:"relationType"`
	Status            string          `json:"status"`
	Rating            *string         `json:"rating,omitempty"`
	EnterpriseType    string          `json:"enterpriseType"`
	IsPublic          bool            `json:"isPublic"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
}

// ===== 学校-企业资源授权（alliance_resource_grants） =====
// 企业级授权：学校把岗位/场景资源的编辑权授予合作企业（企业内专家/管理员可见）。

// AllianceResourceGrant 学校对企业的资源编辑授权（按资源类型一行，resource_ids 覆盖式保存）。
type AllianceResourceGrant struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenantId"`
	EnterpriseID string    `json:"enterpriseId"`
	ResourceType string    `json:"resourceType"` // position | scene
	ResourceIDs  []string  `json:"resourceIds"`
	CreatedBy    *string   `json:"createdBy,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// AllianceGrantResourceOption 学校可授权资源候选（企业共建 + 学校自建）。
type AllianceGrantResourceOption struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`   // position | scene
	Source     string `json:"source"` // enterprise（企业共建）| school（学校自建）
	SchoolName string `json:"schoolName,omitempty"`
}

// ===== 企业侧合作学校反向视图（link + 学校名称） =====
type AlliancePartnerSchool struct {
	LinkID         string    `json:"linkId"`
	TenantID       string    `json:"tenantId"`
	SchoolName     string    `json:"schoolName"`
	RelationType   string    `json:"relationType"`
	Status         string    `json:"status"`
	Rating         *string   `json:"rating,omitempty"`
	EnterpriseType string    `json:"enterpriseType"`
	IsPublic       bool      `json:"isPublic"`
	CreatedAt      time.Time `json:"createdAt"`
}

// ===== 企业侧合作内容只读视图（GET /partner/cooperation） =====

// AlliancePartnerCooperationProject 学校关联本企业的合作项目条目。
type AlliancePartnerCooperationProject struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Phase     string    `json:"phase"`
	IsPublic  bool      `json:"isPublic"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// AlliancePartnerCooperationAchievement 学校关联本企业的合作成果条目。
type AlliancePartnerCooperationAchievement struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	IsPublic  bool      `json:"isPublic"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// AlliancePartnerCooperationAgreement 学校关联本企业的合作协议条目。
type AlliancePartnerCooperationAgreement struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      *string   `json:"type,omitempty"`
	Status    string    `json:"status"`
	IsPublic  bool      `json:"isPublic"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// AlliancePartnerCooperationSchool 单个合作学校聚合视图（三类内容合计 ≥1 条才返回）。
type AlliancePartnerCooperationSchool struct {
	TenantID     string                                  `json:"tenantId"`
	SchoolName   string                                  `json:"schoolName"`
	Projects     []AlliancePartnerCooperationProject     `json:"projects"`
	Achievements []AlliancePartnerCooperationAchievement `json:"achievements"`
	Agreements   []AlliancePartnerCooperationAgreement   `json:"agreements"`
}

// ===== 企业侧合作内容详情（GET /partner/cooperation/{kind}/{id}，只读，受合作关联过滤） =====

// AlliancePartnerCooperationProjectDetail 合作项目详情（含里程碑）。
type AlliancePartnerCooperationProjectDetail struct {
	ID                string                     `json:"id"`
	Name              string                     `json:"name"`
	Type              *string                    `json:"type,omitempty"`
	Description       *string                    `json:"description,omitempty"`
	Phase             string                     `json:"phase"`
	PublishStatus     string                     `json:"publishStatus"`
	StartDate         *string                    `json:"startDate,omitempty"`
	EndDate           *string                    `json:"endDate,omitempty"`
	Budget            *string                    `json:"budget,omitempty"`
	SecondaryColleges []string                   `json:"secondaryColleges"`
	IsPublic          bool                       `json:"isPublic"`
	CreatedAt         time.Time                  `json:"createdAt"`
	UpdatedAt         time.Time                  `json:"updatedAt"`
	Milestones        []AllianceProjectMilestone `json:"milestones"`
}

// AlliancePartnerCooperationAchievementDetail 合作成果详情。
type AlliancePartnerCooperationAchievementDetail struct {
	ID                string    `json:"id"`
	Title             string    `json:"title"`
	Type              string    `json:"type"`
	Description       *string   `json:"description,omitempty"`
	AchievementDate   *string   `json:"achievementDate,omitempty"`
	CitationReason    *string   `json:"citationReason,omitempty"`
	OwnerPersons      []string  `json:"ownerPersons"`
	CoBuilders        []string  `json:"coBuilders"`
	SecondaryColleges []string  `json:"secondaryColleges"`
	Status            string    `json:"status"`
	ViewCount         int       `json:"viewCount"`
	IsPublic          bool      `json:"isPublic"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// AlliancePartnerCooperationAgreementDetail 合作协议详情（企业为合作当事方，可见正文）。
type AlliancePartnerCooperationAgreementDetail struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      *string   `json:"type,omitempty"`
	Content   *string   `json:"content,omitempty"`
	StartDate *string   `json:"startDate,omitempty"`
	EndDate   *string   `json:"endDate,omitempty"`
	Status    string    `json:"status"`
	IsPublic  bool      `json:"isPublic"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ===== 企业侧专家测评任务只读条目（GET /partner/mentor-tasks） =====
type AlliancePartnerMentorTask struct {
	TaskID        string    `json:"taskId"`
	TaskName      string    `json:"taskName"`
	StepLabel     string    `json:"stepLabel"`
	SchoolName    string    `json:"schoolName"`
	ExpertName    string    `json:"expertName"`
	AssignedCount int       `json:"assignedCount"`
	GradedCount   int       `json:"gradedCount"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// ===== 专家 ↔ 学校影子账号（阶段二互动流程使用） =====
type AllianceExpertMentorLink struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	ExpertID  string    `json:"expertId"`
	UserID    string    `json:"userId"`
	Enabled   bool      `json:"enabled"`
	CreatedBy *string   `json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// ===== 共建导师选择器数据源（本校已引入企业的专家 + 影子账号启用状态） =====
// UserID 为影子账号 id，未启用时为 null（前端共建人选择器/任务分配据此区分）。
type AllianceMentorOption struct {
	ExpertID       string  `json:"expertId"`
	Name           string  `json:"name"`
	Title          *string `json:"title,omitempty"`
	EnterpriseID   string  `json:"enterpriseId"`
	EnterpriseName string  `json:"enterpriseName"`
	Enabled        bool    `json:"enabled"`
	UserID         *string `json:"userId"`
}

// ===== 企业合作协议 =====
// ===== 合作项目 =====
type AllianceProject struct {
	ID                string          `json:"id"`
	TenantID          string          `json:"tenantId"`
	Name              string          `json:"name"`
	Type              *string         `json:"type,omitempty"`
	Description       *string         `json:"description,omitempty"`
	Phase             string          `json:"phase"`
	PublishStatus     string          `json:"publishStatus"`
	StartDate         *string         `json:"startDate,omitempty"`
	EndDate           *string         `json:"endDate,omitempty"`
	Budget            *string         `json:"budget,omitempty"`
	CoverImage        *string         `json:"coverImage,omitempty"`
	EnterpriseIDs     json.RawMessage `json:"enterpriseIds,omitempty"`
	AgreementIDs      json.RawMessage `json:"agreementIds,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic          bool            `json:"isPublic"`
	CreatedBy         *string         `json:"createdBy,omitempty"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
	// Progress 里程碑完成率（0-100），仅公开接口返回：已完成里程碑数 / 里程碑总数 × 100
	Progress int `json:"progress"`
}

// ===== 项目里程碑 =====
type AllianceProjectMilestone struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenantId"`
	ProjectID     string    `json:"projectId"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	DueDate       *string   `json:"dueDate,omitempty"`
	CompletedDate *string   `json:"completedDate,omitempty"`
	IsCompleted   bool      `json:"isCompleted"`
	SortOrder     int       `json:"sortOrder"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// ===== 合作成果 =====
type AllianceAchievement struct {
	ID                string          `json:"id"`
	TenantID          string          `json:"tenantId"`
	Title             string          `json:"title"`
	Type              string          `json:"type"`
	Description       *string         `json:"description,omitempty"`
	AchievementDate   *string         `json:"achievementDate,omitempty"`
	CoverImage        *string         `json:"coverImage,omitempty"`
	Attachments       json.RawMessage `json:"attachments,omitempty"`
	CitationReason    *string         `json:"citationReason,omitempty"`
	Images            json.RawMessage `json:"images,omitempty"`
	OwnerPersons      json.RawMessage `json:"ownerPersons,omitempty"`
	CoBuilders        json.RawMessage `json:"coBuilders,omitempty"`
	EnterpriseIDs     json.RawMessage `json:"enterpriseIds,omitempty"`
	ProjectIDs        json.RawMessage `json:"projectIds,omitempty"`
	RelatedPositions  json.RawMessage `json:"relatedPositions,omitempty"`
	RelatedScenes     json.RawMessage `json:"relatedScenes,omitempty"`
	RelatedCourses    json.RawMessage `json:"relatedCourses,omitempty"`
	Status            string          `json:"status"`
	ViewCount         int             `json:"viewCount"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic          bool            `json:"isPublic"`
	CreatedBy         *string         `json:"createdBy,omitempty"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

// ===== 专家资源库 =====
type AllianceExpert struct {
	ID                 string          `json:"id"`
	TenantID           string          `json:"tenantId"`
	Name               string          `json:"name"`
	Gender             *string         `json:"gender,omitempty"`
	Age                *int            `json:"age,omitempty"`
	Title              *string         `json:"title,omitempty"`
	Position           *string         `json:"position,omitempty"`
	ExpertType         *string         `json:"expertType,omitempty"`
	Industry           *string         `json:"industry,omitempty"`
	ProfessionalFields json.RawMessage `json:"professionalFields,omitempty"`
	Specialties        json.RawMessage `json:"specialties,omitempty"`
	ExperienceYears    *int            `json:"experienceYears,omitempty"`
	Education          *string         `json:"education,omitempty"`
	Introduction       *string         `json:"introduction,omitempty"`
	WorkExperience     *string         `json:"workExperience,omitempty"`
	City               *string         `json:"city,omitempty"`
	AvatarURL          *string         `json:"avatarUrl,omitempty"`
	CoverImage         *string         `json:"coverImage,omitempty"`
	Photos             json.RawMessage `json:"photos,omitempty"`
	Attachments        json.RawMessage `json:"attachments,omitempty"`
	EnterpriseID       *string         `json:"enterpriseId,omitempty"`
	EnterpriseName     *string         `json:"enterpriseName,omitempty"`
	Organization       *string         `json:"organization,omitempty"`
	Rating             *string         `json:"rating,omitempty"`
	Status             string          `json:"status"`
	PartnerSource      *string         `json:"partnerSource,omitempty"`
	PositionDirection  *string         `json:"positionDirection,omitempty"`
	SecondaryColleges  json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic           bool            `json:"isPublic"`
	// UserID 专家档案绑定的企业成员账号（users.id，可空）
	UserID    *string   `json:"userId,omitempty"`
	CreatedBy *string   `json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ===== 合作协议（独立模块） =====
type AllianceAgreement struct {
	ID            string          `json:"id"`
	TenantID      string          `json:"tenantId"`
	Name          string          `json:"name"`
	Type          *string         `json:"type,omitempty"`
	Content       *string         `json:"content,omitempty"`
	StartDate     *string         `json:"startDate,omitempty"`
	EndDate       *string         `json:"endDate,omitempty"`
	Status        string          `json:"status"`
	EnterpriseIDs json.RawMessage `json:"enterpriseIds,omitempty"`
	ProjectIDs    json.RawMessage `json:"projectIds,omitempty"`
	Attachments   json.RawMessage `json:"attachments,omitempty"`
	IsPublic      bool            `json:"isPublic"`
	CreatedBy     *string         `json:"createdBy,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
}

// AlliancePublicAgreement 门户前台公开协议视图：不暴露 content/attachments 等敏感字段。
type AlliancePublicAgreement struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Type          *string         `json:"type,omitempty"`
	Status        string          `json:"status"`
	StartDate     *string         `json:"startDate,omitempty"`
	EndDate       *string         `json:"endDate,omitempty"`
	EnterpriseIDs json.RawMessage `json:"enterpriseIds,omitempty"`
	ProjectIDs    json.RawMessage `json:"projectIds,omitempty"`
}

// ===== 合作权限 =====
type AlliancePermission struct {
	ID                  string          `json:"id"`
	TenantID            string          `json:"tenantId"`
	AccountName         string          `json:"accountName"`
	AccountType         string          `json:"accountType"`
	EnterpriseID        *string         `json:"enterpriseId,omitempty"`
	ExpertID            *string         `json:"expertId,omitempty"`
	IsEnabled           bool            `json:"isEnabled"`
	ResourcePermissions json.RawMessage `json:"resourcePermissions,omitempty"`
	PlatformPermissions json.RawMessage `json:"platformPermissions,omitempty"`
	CreatedAt           time.Time       `json:"createdAt"`
	UpdatedAt           time.Time       `json:"updatedAt"`
}

// ===== 字典项 =====
type AllianceDictionary struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	DictType  string    `json:"dictType"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
}

// ===== 品牌内容 =====
type AllianceBrand struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenantId"`
	BrandType    string          `json:"brandType"`
	Name         string          `json:"name"`
	Status       string          `json:"status"`
	IsPublic     bool            `json:"isPublic"`
	IsFeatured   bool            `json:"isFeatured"`
	CoverImage   *string         `json:"coverImage,omitempty"`
	CoverVideo   *string         `json:"coverVideo,omitempty"`
	Description  *string         `json:"description,omitempty"`
	Data         json.RawMessage `json:"data,omitempty"`
	StudentID    *string         `json:"studentId,omitempty"`
	EnterpriseID *string         `json:"enterpriseId,omitempty"`
	PositionID   *string         `json:"positionId,omitempty"`
	MajorID      *string         `json:"majorId,omitempty"`
	TeacherID    *string         `json:"teacherId,omitempty"`
	ExpertID     *string         `json:"expertId,omitempty"`
	SortOrder    int             `json:"sortOrder"`
	ViewCount    int             `json:"viewCount"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

// EmployerBrand 雇主品牌视图（brandType=employer 时附带引用企业资料，只读）。
type EmployerBrand struct {
	AllianceBrand
	EnterpriseName          *string `json:"enterpriseName,omitempty"`
	EnterpriseLogo          *string `json:"enterpriseLogo,omitempty"`
	EnterpriseIndustry      *string `json:"enterpriseIndustry,omitempty"`
	EnterpriseRegion        *string `json:"enterpriseRegion,omitempty"`
	EnterpriseDescription   *string `json:"enterpriseDescription,omitempty"`
	EnterpriseCreditCode    *string `json:"enterpriseCreditCode,omitempty"`
	EnterpriseContactPerson *string `json:"enterpriseContactPerson,omitempty"`
	EnterpriseContactPhone  *string `json:"enterpriseContactPhone,omitempty"`
	EnterpriseContactEmail  *string `json:"enterpriseContactEmail,omitempty"`
	EnterpriseAddress       *string `json:"enterpriseAddress,omitempty"`
}

// BrandMajorRankConfig 人才画像排名-专业启用配置（每专业是否展示 + 前 N 名上限）。
type BrandMajorRankConfig struct {
	MajorID   string `json:"majorId"`
	Enabled   bool   `json:"enabled"`
	RankLimit int    `json:"rankLimit"`
}

// TalentRankPosition 学生单个岗位评估明细（job_ability_results 一行）。
type TalentRankPosition struct {
	PositionID            string          `json:"positionId"`
	PositionName          string          `json:"positionName"`
	AchievementRate       float64         `json:"achievementRate"`
	PositionCompetency    *float64        `json:"positionCompetency,omitempty"`
	PositionCompetencyV2  *float64        `json:"positionCompetencyV2,omitempty"`
	AbilityCognitionScore *float64        `json:"abilityCognitionScore,omitempty"`
	TotalAbilityPoints    int             `json:"totalAbilityPoints"`
	AchievedAbilityPoints int             `json:"achievedAbilityPoints"`
	Grade                 *string         `json:"grade,omitempty"`
	EvaluatedAt           time.Time       `json:"evaluatedAt"`
	AbilityPointDetails   json.RawMessage `json:"abilityPointDetails,omitempty"`
}

// TalentRankStudent 学生画像排名行（多岗位四指标平均，无评估数据时指标为空）。
type TalentRankStudent struct {
	StudentID                string               `json:"studentId"`
	StudentNo                string               `json:"studentNo"`
	Name                     string               `json:"name"`
	MajorID                  *string              `json:"majorId,omitempty"`
	MajorName                string               `json:"majorName"`
	ClassName                string               `json:"className"`
	DepartmentName           string               `json:"departmentName"`
	AvgAchievementRate       *float64             `json:"avgAchievementRate,omitempty"`
	AvgPositionCompetency    *float64             `json:"avgPositionCompetency,omitempty"`
	AvgPositionCompetencyV2  *float64             `json:"avgPositionCompetencyV2,omitempty"`
	AvgAbilityCognitionScore *float64             `json:"avgAbilityCognitionScore,omitempty"`
	PositionCount            int                  `json:"positionCount"`
	LatestEvaluatedAt        *time.Time           `json:"latestEvaluatedAt,omitempty"`
	Positions                []TalentRankPosition `json:"positions,omitempty"`
}

// TalentRankMajorGroup 人才画像排名-专业分组。
type TalentRankMajorGroup struct {
	MajorID      string              `json:"majorId"`
	MajorName    string              `json:"majorName"`
	Enabled      bool                `json:"enabled"`
	RankLimit    int                 `json:"rankLimit"`
	StudentCount int                 `json:"studentCount"`
	Students     []TalentRankStudent `json:"students"`
}
