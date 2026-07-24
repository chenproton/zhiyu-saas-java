package domain

import "time"

type ResourceType string

const (
	ResourceTypeDocument    ResourceType = "document"
	ResourceTypeSpreadsheet ResourceType = "spreadsheet"
	ResourceTypeImage       ResourceType = "image"
	ResourceTypeLink        ResourceType = "link"
	ResourceTypeAudio       ResourceType = "audio"
	ResourceTypeVideo       ResourceType = "video"
	ResourceTypeArchive     ResourceType = "archive"
	ResourceTypeVenue       ResourceType = "venue"
	ResourceTypeFacility    ResourceType = "facility"
	ResourceTypeSoftware    ResourceType = "software"
	ResourceTypeOther       ResourceType = "other"
)

type ResourceLibraryItem struct {
	ID               string       `json:"id"`
	TenantID         string       `json:"tenantId"`
	Name             string       `json:"name"`
	ResourceType     ResourceType `json:"resourceType"`
	URL              *string      `json:"url,omitempty"`
	Description      *string      `json:"description,omitempty"`
	Thumbnail        *string      `json:"thumbnail,omitempty"`
	FileSize         *int64       `json:"fileSize,omitempty"`
	Metadata         JSONMap      `json:"metadata,omitempty"`
	UploadedBy       *string      `json:"uploadedBy,omitempty"`
	UploaderName     *string      `json:"uploaderName,omitempty"`
	UploaderOrgName  *string      `json:"uploaderOrgName,omitempty"`
	UploaderMajorName *string     `json:"uploaderMajorName,omitempty"`
	CreatedAt        time.Time    `json:"createdAt"`
	UpdatedAt        time.Time    `json:"updatedAt"`
}

type OnSiteQuestionLibraryItem struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenantId"`
	QuestionText     string    `json:"questionText"`
	Answer           *string   `json:"answer,omitempty"`
	QuestionType     string    `json:"questionType"`
	Score            float64   `json:"score"`
	Difficulty       *string   `json:"difficulty,omitempty"`
	KnowledgePointIDs []string `json:"knowledgePointIds,omitempty"`
	Tags             []string  `json:"tags,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}
