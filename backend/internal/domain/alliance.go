package domain

import (
	"encoding/json"
	"time"
)

// ===== 学校信息 =====
type AllianceSchoolInfo struct {
	ID               string          `json:"id"`
	TenantID         string          `json:"tenantId"`
	Name             string          `json:"name"`
	ShortName        *string         `json:"shortName,omitempty"`
	SchoolType       *string         `json:"schoolType,omitempty"`
	Province         *string         `json:"province,omitempty"`
	City             *string         `json:"city,omitempty"`
	Address          *string         `json:"address,omitempty"`
	Website          *string         `json:"website,omitempty"`
	ContactPhone     *string         `json:"contactPhone,omitempty"`
	Description      *string         `json:"description,omitempty"`
	LogoURL          *string         `json:"logoUrl,omitempty"`
	ScaleData        json.RawMessage `json:"scaleData,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
}

// ===== 合作企业 =====
type AllianceEnterprise struct {
	ID                         string          `json:"id"`
	TenantID                   string          `json:"tenantId"`
	Name                       string          `json:"name"`
	EnterpriseType             string          `json:"enterpriseType"`
	Industry                   *string         `json:"industry,omitempty"`
	Region                     *string         `json:"region,omitempty"`
	Description                *string         `json:"description,omitempty"`
	LogoURL                    *string         `json:"logoUrl,omitempty"`
	CoverImage                 *string         `json:"coverImage,omitempty"`
	Status                     string          `json:"status"`
	Rating                     *string         `json:"rating,omitempty"`
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
	SecondaryColleges          json.RawMessage `json:"secondaryColleges,omitempty"`
	RatingRecord               json.RawMessage `json:"ratingRecord,omitempty"`
	IsPublic                   bool            `json:"isPublic"`
	CreatedAt                  time.Time       `json:"createdAt"`
	UpdatedAt                  time.Time       `json:"updatedAt"`
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
	ID               string          `json:"id"`
	TenantID         string          `json:"tenantId"`
	Name             string          `json:"name"`
	Type             *string         `json:"type,omitempty"`
	Description      *string         `json:"description,omitempty"`
	Phase            string          `json:"phase"`
	PublishStatus    string          `json:"publishStatus"`
	StartDate        *string         `json:"startDate,omitempty"`
	EndDate          *string         `json:"endDate,omitempty"`
	Budget           *string         `json:"budget,omitempty"`
	CoverImage       *string         `json:"coverImage,omitempty"`
	EnterpriseIDs    json.RawMessage `json:"enterpriseIds,omitempty"`
	AgreementIDs     json.RawMessage `json:"agreementIds,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic         bool            `json:"isPublic"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
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
	ID               string          `json:"id"`
	TenantID         string          `json:"tenantId"`
	Title            string          `json:"title"`
	Type             string          `json:"type"`
	Description      *string         `json:"description,omitempty"`
	AchievementDate  *string         `json:"achievementDate,omitempty"`
	CoverImage       *string         `json:"coverImage,omitempty"`
	Attachments      json.RawMessage `json:"attachments,omitempty"`
	CitationReason   *string         `json:"citationReason,omitempty"`
	Images           json.RawMessage `json:"images,omitempty"`
	OwnerPersons     json.RawMessage `json:"ownerPersons,omitempty"`
	CoBuilders       json.RawMessage `json:"coBuilders,omitempty"`
	EnterpriseIDs    json.RawMessage `json:"enterpriseIds,omitempty"`
	ProjectIDs       json.RawMessage `json:"projectIds,omitempty"`
	RelatedPositions json.RawMessage `json:"relatedPositions,omitempty"`
	RelatedScenes    json.RawMessage `json:"relatedScenes,omitempty"`
	RelatedCourses   json.RawMessage `json:"relatedCourses,omitempty"`
	Status           string          `json:"status"`
	ViewCount        int             `json:"viewCount"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic         bool            `json:"isPublic"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
}

// ===== 专家资源库 =====
type AllianceExpert struct {
	ID                string          `json:"id"`
	TenantID          string          `json:"tenantId"`
	Name              string          `json:"name"`
	Gender            *string         `json:"gender,omitempty"`
	Age               *int            `json:"age,omitempty"`
	Title             *string         `json:"title,omitempty"`
	Position          *string         `json:"position,omitempty"`
	ExpertType        *string         `json:"expertType,omitempty"`
	Industry          *string         `json:"industry,omitempty"`
	ProfessionalFields json.RawMessage `json:"professionalFields,omitempty"`
	Specialties       json.RawMessage `json:"specialties,omitempty"`
	ExperienceYears   *int            `json:"experienceYears,omitempty"`
	Education         *string         `json:"education,omitempty"`
	Introduction      *string         `json:"introduction,omitempty"`
	WorkExperience    *string         `json:"workExperience,omitempty"`
	City              *string         `json:"city,omitempty"`
	AvatarURL         *string         `json:"avatarUrl,omitempty"`
	CoverImage        *string         `json:"coverImage,omitempty"`
	Photos            json.RawMessage `json:"photos,omitempty"`
	Attachments       json.RawMessage `json:"attachments,omitempty"`
	EnterpriseID      *string         `json:"enterpriseId,omitempty"`
	Rating            *string         `json:"rating,omitempty"`
	Status            string          `json:"status"`
	PartnerSource     *string         `json:"partnerSource,omitempty"`
	PositionDirection *string         `json:"positionDirection,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	IsPublic          bool            `json:"isPublic"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
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
	Attachments   json.RawMessage `json:"attachments,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
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

// ===== 品牌专题页 =====
type AllianceBrandTopic struct {
	ID              string          `json:"id"`
	TenantID        string          `json:"tenantId"`
	Name            string          `json:"name"`
	Theme           *string         `json:"theme,omitempty"`
	Description     *string         `json:"description,omitempty"`
	Layout          string          `json:"layout"`
	CoverImage      *string         `json:"coverImage,omitempty"`
	ContentBlocks   json.RawMessage `json:"contentBlocks,omitempty"`
	RelatedBrandIDs json.RawMessage `json:"relatedBrandIds,omitempty"`
	Status          string          `json:"status"`
	IsRecommended   bool            `json:"isRecommended"`
	SortOrder       int             `json:"sortOrder"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}
