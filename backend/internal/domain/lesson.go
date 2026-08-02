package domain

import "time"

// Status types and constants now defined in status.go (shared with all modules)

type Course struct {
	ID                string       `json:"id"`
	Code              string       `json:"code"`
	Name              string       `json:"name"`
	Type              string       `json:"type"`
	Category          string       `json:"category"`
	MajorID           *string      `json:"majorId,omitempty"`
	MajorName         *string      `json:"majorName,omitempty"`
	TeacherID         *string      `json:"teacherId,omitempty"`
	IndustryID        *string      `json:"industryId,omitempty"`
	IndustryName      *string      `json:"industryName,omitempty"`
	Version           *string      `json:"version,omitempty"`
	OnlineHours       *float64     `json:"onlineHours,omitempty"`
	OfflineHours      *float64     `json:"offlineHours,omitempty"`
	OnlineWeight      *float64     `json:"onlineWeight,omitempty"`
	OfflineWeight     *float64     `json:"offlineWeight,omitempty"`
	Semester          *string      `json:"semester,omitempty"`
	ClassName         *string      `json:"className,omitempty"`
	Status            CourseStatus `json:"status"`
	CoverColor        *string      `json:"coverColor,omitempty"`
	CoverImage        *string      `json:"coverImage,omitempty"`
	CourseTag         *string      `json:"courseTag,omitempty"`
	Difficulty        *int         `json:"difficulty,omitempty"`
	Description       *string      `json:"description,omitempty"`
	KnowledgePointIds JSONSlice    `json:"knowledgePointIds,omitempty"`
	AbilityPointIds   JSONSlice    `json:"abilityPointIds,omitempty"`
	ResourceIds       JSONSlice    `json:"resourceIds,omitempty"`
	CreatorID         string       `json:"creatorId"`
	CoCreatorIds      JSONSlice    `json:"coCreatorIds,omitempty"`
	BatchID           *string      `json:"batchId,omitempty"`
	BatchName         *string      `json:"batchName,omitempty"`
	EvalData          JSONMap      `json:"evalData,omitempty"`
	NodeCount         int          `json:"nodeCount"`
	ResourceCount     int          `json:"resourceCount"`
	ViewCount         int          `json:"viewCount"`
	StudyCount        int          `json:"studyCount"`
	CreatedAt         time.Time    `json:"createdAt"`
	UpdatedAt         time.Time    `json:"updatedAt"`
}

type KnowledgePoint struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Code              *string   `json:"code,omitempty"`
	Description       *string   `json:"description,omitempty"`
	Category          *string   `json:"category,omitempty"`
	Linked            bool      `json:"linked"`
	GranularLessonIds JSONSlice `json:"granularLessonIds,omitempty"`
	CreatorID         *string   `json:"creatorId,omitempty"`
	SourceType        *string   `json:"sourceType,omitempty"`
	SourceID          *string   `json:"sourceId,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type NodeQuiz struct {
	ID        string `json:"id"`
	NodeID    string `json:"nodeId"`
	Title     string `json:"title"`
	Type      string `json:"type"`
	TimeLimit *int   `json:"timeLimit,omitempty"`
}

type NodeQuizQuestion struct {
	ID        string  `json:"id"`
	QuizID    string  `json:"quizId"`
	Type      string  `json:"type"`
	Question  string  `json:"question"`
	Options   JSONMap `json:"options,omitempty"`
	Answer    *string `json:"answer,omitempty"`
	Score     float64 `json:"score"`
	SortOrder int     `json:"sortOrder"`
}

type NodeHomework struct {
	ID             string     `json:"id"`
	NodeID         string     `json:"nodeId"`
	Title          string     `json:"title"`
	Requirement    *string    `json:"requirement,omitempty"`
	NeedAttachment bool       `json:"needAttachment"`
	Deadline       *time.Time `json:"deadline,omitempty"`
}

type HybridNodeModule struct {
	ID        string  `json:"id"`
	NodeID    string  `json:"nodeId"`
	ModuleKey string  `json:"moduleKey"`
	Mode      string  `json:"mode"`
	Data      JSONMap `json:"data"`
}

type LessonBatch struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Code        *string           `json:"code,omitempty"`
	OrgNodeID   *string           `json:"orgNodeId,omitempty"`
	MajorID     *string           `json:"majorId,omitempty"`
	MajorName   *string           `json:"majorName,omitempty"`
	WorkflowID  *string           `json:"workflowId,omitempty"`
	Status      LessonBatchStatus `json:"status"`
	CourseCount *int              `json:"courseCount,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

type LessonBehaviorRecord struct {
	ID               string    `json:"id"`
	CourseID         string    `json:"courseId"`
	StudentUserID    string    `json:"studentUserId"`
	StudentName      string    `json:"studentName"`
	RecordDate       string    `json:"recordDate"`
	Attendance       string    `json:"attendance"`
	QuizScore        *float64  `json:"quizScore,omitempty"`
	InteractionCount int       `json:"interactionCount"`
	PraiseCount      int       `json:"praiseCount"`
	RushCorrectCount int       `json:"rushCorrectCount"`
	RushAvgTimeSec   *int      `json:"rushAvgTimeSec,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type NodeResource struct {
	ID          string    `json:"id"`
	NodeID      string    `json:"nodeId"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	URL         *string   `json:"url,omitempty"`
	Description *string   `json:"description,omitempty"`
	Size        *int      `json:"size,omitempty"`
	UploadedBy  *string   `json:"uploadedBy,omitempty"`
	UploadedAt  time.Time `json:"uploadedAt"`
}
