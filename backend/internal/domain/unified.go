package domain

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// JSONMap / JSONSlice are generic containers for JSONB columns.
type JSONMap map[string]interface{}

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
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Code           string       `json:"code"`
	LogoURL        *string      `json:"logoUrl,omitempty"`
	Domain         *string      `json:"domain,omitempty"`
	EnterpriseCode *string      `json:"enterpriseCode,omitempty"`
	Contact        *string      `json:"contact,omitempty"`
	Phone          *string      `json:"phone,omitempty"`
	Address        *string      `json:"address,omitempty"`
	Description    *string      `json:"description,omitempty"`
	AdminIDs       []string     `json:"adminIds,omitempty"`
	Status         TenantStatus `json:"status"`
	CreatedAt      time.Time    `json:"createdAt"`
	UpdatedAt      time.Time    `json:"updatedAt"`
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
	ID           string    `json:"id"`
	TenantID     string    `json:"tenantId"`
	Name         string    `json:"name"`
	TypeID       string    `json:"typeId"`
	ParentID     *string   `json:"parentId,omitempty"`
	SortOrder    int       `json:"sortOrder"`
	MemberCount  int       `json:"memberCount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Major struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	OrgNodeID  *string   `json:"orgNodeId,omitempty"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Alias      *string   `json:"alias,omitempty"`
	Enabled    bool      `json:"enabled"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Industry struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	ParentID   *string   `json:"parentId,omitempty"`
	Enabled    bool      `json:"enabled"`
	SortOrder  int       `json:"sortOrder"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
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
	ID                          string    `json:"id"`
	TenantID                    string    `json:"tenantId"`
	FieldKey                    string    `json:"fieldKey"`
	FieldName                   string    `json:"fieldName"`
	FieldType                   string    `json:"fieldType"`
	IsEnabled                   bool      `json:"isEnabled"`
	IsRequired                  bool      `json:"isRequired"`
	ApplicableRoleCodes         []string  `json:"applicableRoleCodes"`
	SlotNumber                  int       `json:"slotNumber"`
	CreatedAt                   time.Time `json:"createdAt"`
}

type UserRelation struct {
	ID                   string    `json:"id"`
	TenantID             string    `json:"tenantId"`
	InitiatorID          string    `json:"initiatorId"`
	InitiatorOrgNodeID   *string   `json:"initiatorOrgNodeId,omitempty"`
	TargetID             string    `json:"targetId"`
	TargetOrgNodeID      *string   `json:"targetOrgNodeId,omitempty"`
	RelationType         string    `json:"relationType"`
	Description          *string   `json:"description,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
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

type UserRoleBinding struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	RoleID string `json:"roleId"`
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

type AppModule struct {
	ID          string `json:"id"`
	Platform    string `json:"platform"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Href        string `json:"href,omitempty"`
	SortOrder   int    `json:"sortOrder"`
}

type PlatformLink struct {
	ID       string `json:"id"`
	Platform string `json:"platform"`
	URL      string `json:"url"`
	Enabled  bool   `json:"enabled"`
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
