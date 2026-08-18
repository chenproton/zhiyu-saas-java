package domain

// ContentStatus 是所有内容实体的公共状态枚举
type ContentStatus string

const (
	StatusDraft     ContentStatus = "draft"
	StatusPending   ContentStatus = "pending"
	StatusApproved  ContentStatus = "approved"
	StatusRejected  ContentStatus = "rejected"
	StatusPublished ContentStatus = "published"
	StatusArchived  ContentStatus = "archived"

	// Batch states
	StatusOpen   ContentStatus = "open"
	StatusClosed ContentStatus = "closed"

	// Certification states
	StatusNotSubmitted ContentStatus = "not_submitted"
)

// 别名：保持各模块类型兼容，底层统一
type (
	InstitutionStatus    = ContentStatus
	CareerPositionStatus = ContentStatus
	CourseStatus         = ContentStatus
	ScenarioStatus       = ContentStatus
	BatchStatus          = ContentStatus
	LessonBatchStatus    = ContentStatus
	SceneBatchStatus     = ContentStatus
)

// 保留旧的 const 块，值指向新的共享常量
const (
	CareerPositionStatusDraft = StatusDraft

	BatchStatusOpen   = StatusOpen
	BatchStatusClosed = StatusClosed

	LessonBatchStatusOpen   = StatusOpen
	LessonBatchStatusClosed = StatusClosed

	SceneBatchStatusOpen   = StatusOpen
	SceneBatchStatusClosed = StatusClosed
)
