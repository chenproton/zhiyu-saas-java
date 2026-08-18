package domain

import "time"

type AffairsBatch struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Code           *string   `json:"code,omitempty"`
	OrgNodeID      *string   `json:"orgNodeId,omitempty"`
	MajorID        *string   `json:"majorId,omitempty"`
	MajorName      *string   `json:"majorName,omitempty"`
	WorkflowID     *string   `json:"workflowId,omitempty"`
	Status         string    `json:"status"`
	ProgramCount   int       `json:"programCount"`
	PublishedCount int       `json:"publishedCount"`
	PendingCount   int       `json:"pendingCount"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
