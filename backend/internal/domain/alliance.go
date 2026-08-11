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
	CreatedAt                  time.Time       `json:"createdAt"`
	UpdatedAt                  time.Time       `json:"updatedAt"`
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
type AllianceEnterpriseAgreement struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenantId"`
	EnterpriseID string          `json:"enterpriseId"`
	Name         string          `json:"name"`
	Type         *string         `json:"type,omitempty"`
	StartDate    *string         `json:"startDate,omitempty"`
	EndDate      *string         `json:"endDate,omitempty"`
	Status       string          `json:"status"`
	Content      *string         `json:"content,omitempty"`
	Attachments  json.RawMessage `json:"attachments,omitempty"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

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
