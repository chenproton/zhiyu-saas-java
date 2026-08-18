package domain

import "time"

// TagItem 资源标签（租户隔离，可绑定任意资源类型）。
type TagItem struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenantId"`
	Name          string    `json:"name"`
	Color         string    `json:"color"`
	ResourceCount int       `json:"resourceCount,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// ResourceTagRelation 资源与标签的绑定关系（resourceType/resourceID 多态引用）。
type ResourceTagRelation struct {
	ResourceID string    `json:"resourceId"`
	Tags       []TagItem `json:"tags"`
}

// 资源标签绑定的 resource_type 常量（与列表页资源类型一一对应）。
const (
	TagResourceTypeKnowledgePoint  = "knowledge_point"
	TagResourceTypeResourceLibrary = "resource_library"
	TagResourceTypeAbilityPoint    = "ability_point"
	TagResourceTypeCertificate     = "certificate_library"
	TagResourceTypeRandomDrawQ     = "random_draw_question"
)
