package domain

import (
	"time"
)

type InstitutionType string

const (
	InstitutionTypeSchool     InstitutionType = "school"
	InstitutionTypeEnterprise InstitutionType = "enterprise"
)

// InstitutionStatus removed — defined in status.go

type UserRole string

const (
	UserRoleSchool     UserRole = "school"
	UserRoleEnterprise UserRole = "enterprise"
	UserRoleOperator   UserRole = "operator"
)

// 业务角色 code 常量（单一真相：路由权限、handler 角色判断、store 种子数据/查询共用）。
const (
	RolePlatformAdmin    = "platform_admin"
	RoleSchoolAdmin      = "school_admin"
	RoleTeacher          = "teacher"
	RoleStudent          = "student"
	RoleEnterpriseMentor = "enterprise_mentor"
)

type UserPlatform string

const (
	UserPlatformPortal UserPlatform = "portal"
	UserPlatformSaas   UserPlatform = "saas"
)

type User struct {
	ID            string       `json:"id"`
	TenantID      *string      `json:"tenantId,omitempty"`
	InstitutionID *string      `json:"institutionId,omitempty"`
	OrgNodeID     *string      `json:"orgNodeId,omitempty"`
	MajorID       *string      `json:"majorId,omitempty"`
	Role          UserRole     `json:"role"`
	Platform      UserPlatform `json:"platform"`
	RoleIDs       []string     `json:"roleIds,omitempty"`
	RoleCodes     []string     `json:"roleCodes,omitempty"`
	RoleNames     []string     `json:"roleNames,omitempty"`
	LoginName     *string      `json:"loginName,omitempty"`
	Username      string       `json:"username"`
	PasswordHash  string       `json:"-"`
	Name          string       `json:"name"`
	Email         *string      `json:"email,omitempty"`
	Phone         *string      `json:"phone,omitempty"`
	AvatarURL     *string      `json:"avatarUrl,omitempty"`
	StudentNo     *string      `json:"studentNo,omitempty"`
	WorkID        *string      `json:"workId,omitempty"`
	IDCard        *string      `json:"idCard,omitempty"`
	TitleIDs      []string     `json:"titleIds,omitempty"`
	Oauth         JSONMap      `json:"oauth,omitempty"`
	Status        string       `json:"status"`
	GraduateYear  *int         `json:"graduateYear,omitempty"`
	LastLoginAt   *time.Time   `json:"lastLoginAt,omitempty"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

type Institution struct {
	ID                string            `json:"id"`
	Type              InstitutionType   `json:"type"`
	Name              string            `json:"name"`
	CreditCode        string            `json:"creditCode"`
	Logo              *string           `json:"logo,omitempty"`
	Intro             string            `json:"intro"`
	ContactName       string            `json:"contactName"`
	ContactPhone      string            `json:"contactPhone"`
	ContactEmail      string            `json:"contactEmail"`
	QualificationFile *string           `json:"qualificationFile,omitempty"`
	ExpertiseTags     []string          `json:"expertiseTags"`
	Status            InstitutionStatus `json:"status"`
	OrgCode           string            `json:"orgCode"`
	Balance           float64           `json:"balance"`
	TotalSpent        float64           `json:"totalSpent"`
	TotalIncome       float64           `json:"totalIncome"`
	CreatedAt         time.Time         `json:"createdAt"`
	UpdatedAt         time.Time         `json:"updatedAt"`
}
