package domain

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// JSONMap / JSONSlice are generic containers for JSONB columns.
type JSONMap map[string]interface{}

func (m JSONMap) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

func (m *JSONMap) Scan(src interface{}) error {
	if src == nil {
		*m = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return nil
	}
	return json.Unmarshal(data, (*map[string]interface{})(m))
}

type JSONSlice []interface{}

// StringSlice is a JSON-serializable string slice for JSONB columns.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) { return json.Marshal(s) }

func (s *StringSlice) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		*s = nil
		return nil
	}
	return json.Unmarshal(data, (*[]string)(s))
}

type TenantStatus string

const (
	TenantStatusActive   TenantStatus = "active"
	TenantStatusInactive TenantStatus = "inactive"
)

// TenantType 租户类型：学校租户（默认）/ 企业租户（partner 平台）。
type TenantType string

const (
	TenantTypeSchool     TenantType = "school"
	TenantTypeEnterprise TenantType = "enterprise"
)

type OrgTypeCategory string

const (
	OrgTypeCategoryInternal OrgTypeCategory = "internal"
	OrgTypeCategoryBusiness OrgTypeCategory = "business"
	OrgTypeCategoryExternal OrgTypeCategory = "external"
)

type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "pending"
	ApprovalStatusApproved ApprovalStatus = "approved"
	ApprovalStatusRejected ApprovalStatus = "rejected"
)

type WorkflowStatus string

const (
	WorkflowStatusActive   WorkflowStatus = "active"
	WorkflowStatusInactive WorkflowStatus = "inactive"
)

type Tenant struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Code              string          `json:"code"`
	Type              TenantType      `json:"type"`
	LogoURL           *string         `json:"logoUrl,omitempty"`
	Domain            *string         `json:"domain,omitempty"`
	EnterpriseCode    *string         `json:"enterpriseCode,omitempty"`
	Contact           *string         `json:"contact,omitempty"`
	Phone             *string         `json:"phone,omitempty"`
	Address           *string         `json:"address,omitempty"`
	Description       *string         `json:"description,omitempty"`
	ShortName         *string         `json:"shortName,omitempty"`
	SchoolType        *string         `json:"schoolType,omitempty"`
	Province          *string         `json:"province,omitempty"`
	City              *string         `json:"city,omitempty"`
	Website           *string         `json:"website,omitempty"`
	ContactPhone      *string         `json:"contactPhone,omitempty"`
	ScaleData         json.RawMessage `json:"scaleData,omitempty"`
	SecondaryColleges json.RawMessage `json:"secondaryColleges,omitempty"`
	EducationLevel    *string         `json:"educationLevel,omitempty"`
	EducationNature   *string         `json:"educationNature,omitempty"`
	AdminIDs          []string        `json:"adminIds,omitempty"`
	Status            TenantStatus    `json:"status"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

type OrgType struct {
	ID          string          `json:"id"`
	TenantID    string          `json:"tenantId"`
	Name        string          `json:"name"`
	Category    OrgTypeCategory `json:"category"`
	Description *string         `json:"description,omitempty"`
	IsDefault   bool            `json:"isDefault"`
	CreatedAt   time.Time       `json:"createdAt"`
}

type Organization struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Name        string    `json:"name"`
	TypeID      string    `json:"typeId"`
	ParentID    *string   `json:"parentId,omitempty"`
	SortOrder   int       `json:"sortOrder"`
	MemberCount int       `json:"memberCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Major struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Alias     *string   `json:"alias,omitempty"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Industry struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	ParentID  *string   `json:"parentId,omitempty"`
	Enabled   bool      `json:"enabled"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ResourceCode struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	Type        string    `json:"type"`
	CreatedAt   time.Time `json:"createdAt"`
}

type SubscriptionPackage struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	Name       string    `json:"name"`
	ValidUntil *string   `json:"validUntil,omitempty"`
	Modules    JSONMap   `json:"modules"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type UserExtensionField struct {
	ID                  string    `json:"id"`
	TenantID            string    `json:"tenantId"`
	FieldKey            string    `json:"fieldKey"`
	FieldName           string    `json:"fieldName"`
	FieldType           string    `json:"fieldType"`
	IsEnabled           bool      `json:"isEnabled"`
	IsRequired          bool      `json:"isRequired"`
	ApplicableRoleCodes []string  `json:"applicableRoleCodes"`
	SlotNumber          int       `json:"slotNumber"`
	CreatedAt           time.Time `json:"createdAt"`
}

type StaffTitle struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	UserCount   int       `json:"userCount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Role struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	Permissions JSONMap   `json:"permissions"`
	UserCount   int       `json:"userCount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

type LoginLog struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	UserID    *string   `json:"userId,omitempty"`
	UserName  *string   `json:"userName,omitempty"`
	IP        *string   `json:"ip,omitempty"`
	Location  *string   `json:"location,omitempty"`
	Device    *string   `json:"device,omitempty"`
	Status    *string   `json:"status,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type OperationLog struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	UserID     *string   `json:"userId,omitempty"`
	UserName   *string   `json:"userName,omitempty"`
	Module     *string   `json:"module,omitempty"`
	Action     string    `json:"action"`
	TargetType *string   `json:"targetType,omitempty"`
	TargetID   *string   `json:"targetId,omitempty"`
	Detail     *string   `json:"detail,omitempty"`
	IP         *string   `json:"ip,omitempty"`
	Status     *string   `json:"status,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Workflow struct {
	ID          string         `json:"id"`
	TenantID    *string        `json:"tenantId,omitempty"`
	Name        string         `json:"name"`
	Scene       *string        `json:"scene,omitempty"`
	Description *string        `json:"description,omitempty"`
	Steps       JSONSlice      `json:"steps"`
	MajorIds    StringSlice    `json:"majorIds"`
	UsageCount  int            `json:"usageCount"`
	Status      WorkflowStatus `json:"status"`
	CreatedAt   time.Time      `json:"createdAt"`
}

type ApprovalRecord struct {
	ID             string    `json:"id"`
	TenantID       *string   `json:"tenantId,omitempty"`
	TargetType     string    `json:"targetType"`
	TargetID       string    `json:"targetId"`
	WorkflowID     *string   `json:"workflowId,omitempty"`
	CurrentStepIdx int       `json:"currentStepIdx"`
	Status         string    `json:"status"`
	SubmitterID    string    `json:"submitterId"`
	History        JSONSlice `json:"history"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
