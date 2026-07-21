package domain

import "time"

type ScenarioStatus string

const (
	ScenarioStatusDraft     ScenarioStatus = "draft"
	ScenarioStatusPending   ScenarioStatus = "pending"
	ScenarioStatusApproved  ScenarioStatus = "approved"
	ScenarioStatusRejected  ScenarioStatus = "rejected"
	ScenarioStatusPublished ScenarioStatus = "published"
	ScenarioStatusArchived  ScenarioStatus = "archived"
)

type Scenario struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Code            string         `json:"code"`
	CoverImage      *string        `json:"coverImage,omitempty"`
	CareerPositionID *string       `json:"careerPositionId,omitempty"`
	IndustryIDs     []string       `json:"industryIds,omitempty"`
	IndustryNames   []string       `json:"industryNames,omitempty"`
	ProfessionIDs   []string       `json:"professionIds,omitempty"`
	ProfessionNames []string       `json:"professionNames,omitempty"`
	BatchID         *string        `json:"batchId,omitempty"`
	Difficulty      int            `json:"difficulty"`
	Version         string         `json:"version"`
	Status          ScenarioStatus `json:"status"`
	Background      *string        `json:"background,omitempty"`
	DeliveryGoal    *string        `json:"deliveryGoal,omitempty"`
	CreatorID       string         `json:"creatorId"`
	CoBuilderIDs    []string       `json:"coBuilderIds,omitempty"`
	TenantID        *string        `json:"tenantId,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	PublishTime     *time.Time     `json:"publishTime,omitempty"`
	ViewCount       int            `json:"viewCount"`
}

type ScenarioTask struct {
	ID                  string              `json:"id"`
	ScenarioID          string              `json:"scenarioId"`
	Name                string              `json:"name"`
	Code                string              `json:"code"`
	SortOrder           int                 `json:"sortOrder"`
	Description         *string             `json:"description,omitempty"`
	DetailedDescription *string             `json:"detailedDescription,omitempty"`
	DescriptionPdf      *string             `json:"descriptionPdf,omitempty"`
	EstimatedHours      float64             `json:"estimatedHours"`
	TaskType            string              `json:"taskType"`
	Difficulty          int                 `json:"difficulty"`
	Background          *string             `json:"background,omitempty"`
	DependencyIDs       []string            `json:"dependencyIds,omitempty"`
	IsReferenced        bool                `json:"isReferenced"`
	SourceScenarioID    *string             `json:"sourceScenarioId,omitempty"`
	KnowledgePointIDs   []string            `json:"knowledgePointIds,omitempty"`
	AbilityPointIDs     []string            `json:"abilityPointIds,omitempty"`
	ResourceIDs         []string            `json:"resourceIds,omitempty"`
	EvalData            JSONMap             `json:"evalData,omitempty"`
	TenantID            *string             `json:"tenantId,omitempty"`
}

type TaskEvaluationConfig struct {
	ID            string    `json:"id"`
	TaskID        string    `json:"taskId"`
	MethodKey     string    `json:"methodKey"`
	Weight        float64   `json:"weight"`
	EvalObjects   JSONMap   `json:"evalObjects,omitempty"`
	EvalSubjects  JSONSlice `json:"evalSubjects,omitempty"`
	EvalResources JSONMap   `json:"evalResources,omitempty"`
}

type TaskEvalPoint struct {
	ID                string   `json:"id"`
	ConfigID          string   `json:"configId"`
	Name              string   `json:"name"`
	Description       *string  `json:"description,omitempty"`
	Weight            float64  `json:"weight"`
	MaxScore          float64  `json:"maxScore"`
	ScoringMethod     string   `json:"scoringMethod"`
	GradeMapping      JSONMap  `json:"gradeMapping,omitempty"`
	SubType           *string  `json:"subType,omitempty"`
	KnowledgePointIDs []string `json:"knowledgePointIds,omitempty"`
	AbilityPointIDs   []string `json:"abilityPointIds,omitempty"`
	SortOrder         int      `json:"sortOrder"`
}

type TaskReviewStep struct {
	ID          string  `json:"id"`
	ConfigID    string  `json:"configId"`
	Label       string  `json:"label"`
	Description *string `json:"description,omitempty"`
	Enabled     bool    `json:"enabled"`
	SubjectType *string `json:"subjectType,omitempty"`
	Weight      float64 `json:"weight"`
	SortOrder   int     `json:"sortOrder"`
}

type TaskResource struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Type              string    `json:"type"`
	URL               *string   `json:"url,omitempty"`
	Description       *string   `json:"description,omitempty"`
	Thumbnail         *string   `json:"thumbnail,omitempty"`
	Size              *string   `json:"size,omitempty"`
	KnowledgePointIDs []string  `json:"knowledgePointIds,omitempty"`
	ExtraData         JSONMap   `json:"extraData,omitempty"`
	UploadedBy        *string   `json:"uploadedBy,omitempty"`
	UploadedAt        time.Time `json:"uploadedAt"`
}

type TaskResourceBinding struct {
	ID         string `json:"id"`
	TaskID     string `json:"taskId"`
	ResourceID string `json:"resourceId"`
}

type TaskKnowledgeBinding struct {
	ID               string `json:"id"`
	TaskID           string `json:"taskId"`
	KnowledgePointID string `json:"knowledgePointId"`
}

type TaskAbilityBinding struct {
	ID             string `json:"id"`
	TaskID         string `json:"taskId"`
	AbilityPointID string `json:"abilityPointId"`
}

type ScenarioWeightConfig struct {
	ID         string  `json:"id"`
	ScenarioID string  `json:"scenarioId"`
	TaskID     string  `json:"taskId"`
	Weight     float64 `json:"weight"`
}

type ScenarioGradeMapping struct {
	ID          string  `json:"id"`
	ScenarioID  string  `json:"scenarioId"`
	TaskID      *string `json:"taskId,omitempty"`
	Level       string  `json:"level"`
	MinScore    float64 `json:"minScore"`
	MaxScore    float64 `json:"maxScore"`
	Description *string `json:"description,omitempty"`
	Color       *string `json:"color,omitempty"`
}

// SceneBatchStatus removed — defined in status.go

type SceneBatch struct {
	ID            string           `json:"id"`
	Name          string           `json:"name"`
	Code          *string          `json:"code,omitempty"`
	OrgNodeID     *string          `json:"orgNodeId,omitempty"`
	MajorID       *string          `json:"majorId,omitempty"`
	MajorName     *string          `json:"majorName,omitempty"`
	WorkflowID    *string          `json:"workflowId,omitempty"`
	Status        SceneBatchStatus `json:"status"`
	ScenarioCount int              `json:"scenarioCount"`
	CreatedAt     time.Time        `json:"createdAt"`
	UpdatedAt     time.Time        `json:"updatedAt"`
}
