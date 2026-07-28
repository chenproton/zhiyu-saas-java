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
	StatusReviewing ContentStatus = "reviewing"

	// Batch states
	StatusOpen   ContentStatus = "open"
	StatusClosed ContentStatus = "closed"

	// Certification states
	StatusReady        ContentStatus = "ready"
	StatusNotSubmitted ContentStatus = "not_submitted"
	StatusNone         ContentStatus = "none"

	// Institution states
	InstitutionStatusDisabled ContentStatus = "disabled"
)

// 别名：保持各模块类型兼容，底层统一
type (
	InstitutionStatus    = ContentStatus
	QuestionBankStatus   = ContentStatus
	ExamStatus           = ContentStatus
	CareerPositionStatus = ContentStatus
	CourseStatus         = ContentStatus
	ScenarioStatus       = ContentStatus
	BatchStatus          = ContentStatus
	LessonBatchStatus    = ContentStatus
	SceneBatchStatus     = ContentStatus
)

// 保留旧的 const 块，值指向新的共享常量
const (
	InstitutionStatusPending  = StatusPending
	InstitutionStatusApproved = StatusApproved

	QuestionBankStatusDraft     = StatusDraft
	QuestionBankStatusPending   = StatusPending
	QuestionBankStatusApproved  = StatusApproved
	QuestionBankStatusRejected  = StatusRejected
	QuestionBankStatusPublished = StatusPublished
	QuestionBankStatusArchived  = StatusArchived

	ExamStatusDraft     = StatusDraft
	ExamStatusPending   = StatusPending
	ExamStatusApproved  = StatusApproved
	ExamStatusRejected  = StatusRejected
	ExamStatusPublished = StatusPublished
	ExamStatusArchived  = StatusArchived

	CareerPositionStatusDraft     = StatusDraft
	CareerPositionStatusPending   = StatusPending
	CareerPositionStatusApproved  = StatusApproved
	CareerPositionStatusRejected  = StatusRejected
	CareerPositionStatusPublished = StatusPublished
	CareerPositionStatusArchived  = StatusArchived

	CourseStatusDraft     = StatusDraft
	CourseStatusPending   = StatusPending
	CourseStatusApproved  = StatusApproved
	CourseStatusRejected  = StatusRejected
	CourseStatusPublished = StatusPublished
	CourseStatusArchived  = StatusArchived

	ScenarioStatusDraft     = StatusDraft
	ScenarioStatusPending   = StatusPending
	ScenarioStatusApproved  = StatusApproved
	ScenarioStatusRejected  = StatusRejected
	ScenarioStatusPublished = StatusPublished
	ScenarioStatusArchived  = StatusArchived

	BatchStatusOpen   = StatusOpen
	BatchStatusClosed = StatusClosed

	LessonBatchStatusOpen   = StatusOpen
	LessonBatchStatusClosed = StatusClosed

	SceneBatchStatusOpen   = StatusOpen
	SceneBatchStatusClosed = StatusClosed
)
