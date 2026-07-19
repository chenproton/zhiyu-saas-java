package domain

import "time"

// Status types and constants now defined in status.go (shared with all modules)

type PositionType string

const (
	PositionTypeEnterprise PositionType = "enterprise"
	PositionTypeTeaching   PositionType = "teaching"
)

type AbilityCategory string

const (
	AbilityCategoryKnowledge AbilityCategory = "knowledge"
	AbilityCategorySkill     AbilityCategory = "skill"
	AbilityCategoryQuality   AbilityCategory = "quality"
)

type AbilityPointSource string

const (
	AbilityPointSourcePublic AbilityPointSource = "public"
	AbilityPointSourceCustom AbilityPointSource = "custom"
)

// BatchStatus type and constants now defined in status.go (shared)

type CareerPosition struct {
	ID            string               `json:"id"`
	BatchID       *string              `json:"batchId,omitempty"`
	Name          string               `json:"name"`
	ShortName     *string              `json:"shortName,omitempty"`
	IndustryID    *string              `json:"industryId,omitempty"`
	MajorIDs      []string             `json:"majorIds"`
	MajorNames    []string             `json:"majorNames,omitempty"`
	PositionType  PositionType         `json:"positionType"`
	SalaryMin     *int                 `json:"salaryMin,omitempty"`
	SalaryMax     *int                 `json:"salaryMax,omitempty"`
	CoverImage    *string              `json:"coverImage,omitempty"`
	Description   *string              `json:"description,omitempty"`
	Requirements  []string             `json:"requirements"`
	CareerPath    *string              `json:"careerPath,omitempty"`
	Version       string               `json:"version"`
	Status        CareerPositionStatus `json:"status"`
	CreatedBy     string               `json:"createdBy"`
	Collaborators []string             `json:"collaborators"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}

type PositionCertificate struct {
	ID               string  `json:"id"`
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url,omitempty"`
	Description      *string `json:"description,omitempty"`
	ImageURL         *string `json:"imageUrl,omitempty"`
}

type PositionResponsibility struct {
	ID               string  `json:"id"`
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	Description      *string `json:"description,omitempty"`
	SortOrder        int     `json:"sortOrder"`
}

type AbilityPoint struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Category    AbilityCategory `json:"category"`
	Code        *string         `json:"code,omitempty"`
	Domain      *string         `json:"domain,omitempty"`
	IsPublic    bool            `json:"isPublic"`
	CreatedAt   time.Time       `json:"createdAt"`
}

type PositionAbilityBinding struct {
	ID                string             `json:"id"`
	CareerPositionID  string             `json:"careerPositionId"`
	ResponsibilityID  string             `json:"responsibilityId"`
	AbilityPointID    string             `json:"abilityPointId"`
	Source            AbilityPointSource `json:"source"`
	Domain            *string            `json:"domain,omitempty"`
	RequiredLevel     string             `json:"requiredLevel"`
	RubricDescription *string            `json:"rubricDescription,omitempty"`
	Attributes        []string           `json:"attributes"`
	Weight            float64            `json:"weight"`
}

type AbilityDomain struct {
	ID               string   `json:"id"`
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description,omitempty"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

type JobBatch struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	Code           *string     `json:"code,omitempty"`
	OrgNodeID      *string     `json:"orgNodeId,omitempty"`
	MajorID        *string     `json:"majorId,omitempty"`
	MajorName      *string     `json:"majorName,omitempty"`
	WorkflowID     *string     `json:"workflowId,omitempty"`
	Status         BatchStatus `json:"status"`
	PositionCount  int         `json:"positionCount"`
	PublishedCount int         `json:"publishedCount"`
	PendingCount   int         `json:"pendingCount"`
	CreatedAt      time.Time   `json:"createdAt"`
	UpdatedAt      time.Time   `json:"updatedAt"`
}

type PositionRecommendation struct {
	ID               string    `json:"id"`
	MajorID          *string   `json:"majorId,omitempty"`
	MajorName        *string   `json:"majorName,omitempty"`
	CareerPositionID string    `json:"careerPositionId"`
	PositionType     string    `json:"positionType"`
	Reason           *string   `json:"reason,omitempty"`
	SortOrder        int       `json:"sortOrder"`
	IsEnabled        bool      `json:"isEnabled"`
	CreatedBy        string    `json:"createdBy"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type LearnRoadStep struct {
	Name        string   `json:"name"`
	Description *string  `json:"description,omitempty"`
	ResourceIDs []string `json:"resourceIds,omitempty"`
}

type LearnRoad struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	PositionIDs []string  `json:"positionIds"`
	Steps       JSONSlice `json:"steps,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
