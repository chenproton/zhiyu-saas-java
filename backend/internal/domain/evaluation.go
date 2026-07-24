package domain

import "time"

// Status types and constants now defined in status.go (shared with all modules)

// QuestionBank represents a repository of questions.
type QuestionBank struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	CoverImage          *string   `json:"coverImage,omitempty"`
	Status              string    `json:"status"`
	QuestionCount       int       `json:"questionCount"`
	CreatorID           *string   `json:"creatorId,omitempty"`
	CreatorName         string    `json:"creatorName,omitempty"`
	CollaboratorIDs     []string  `json:"collaboratorIds,omitempty"`
	CollaboratorNames   []string  `json:"collaboratorNames,omitempty"`
	CollaboratorDeptIDs []string  `json:"collaboratorDeptIds,omitempty"`
	BatchID             *string   `json:"batchId,omitempty"`
	Version             string    `json:"version"`
	OwnerType           string    `json:"ownerType"`
	IsDraftPool         bool      `json:"isDraftPool"`
	KnowledgePointIDs   []string  `json:"knowledgePointIds,omitempty"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// QuestionType represents the type of a question.
type QuestionType string

const (
	QuestionTypeSingle      QuestionType = "single"
	QuestionTypeMultiple    QuestionType = "multiple"
	QuestionTypeJudge       QuestionType = "judge"
	QuestionTypeFill        QuestionType = "fill"
	QuestionTypeEssay       QuestionType = "essay"
	QuestionTypeShortAnswer QuestionType = "short_answer"
)

// Question represents a single question entry.
type Question struct {
	ID              string       `json:"id"`
	BankID          string       `json:"bankId"`
	Type            QuestionType `json:"type"`
	Content         string       `json:"content"`
	Options         []string     `json:"options,omitempty"`
	Answer          JSONSlice    `json:"answer"`
	Analysis        *string      `json:"analysis,omitempty"`
	Score           float64      `json:"score"`
	Difficulty      *string      `json:"difficulty,omitempty"`
	KnowledgePoints []string     `json:"knowledgePoints,omitempty"`
	CreatorID       *string      `json:"creatorId,omitempty"`
	Source          *string      `json:"source,omitempty"`
	Status          string       `json:"status"`
	CreatedAt       time.Time    `json:"createdAt"`
}

// ExamQuestion represents a snapshot of a question inside an exam.
type ExamQuestion struct {
	ID         string       `json:"id"`
	ExamID     string       `json:"examId"`
	QuestionID string       `json:"questionId"`
	Type       QuestionType `json:"type"`
	Content    string       `json:"content"`
	Options    []string     `json:"options,omitempty"`
	Answer     JSONSlice    `json:"answer"`
	Analysis   *string      `json:"analysis,omitempty"`
	Score      float64      `json:"score"`
	Order      int          `json:"order"`
}

// Exam represents an exam paper.
type Exam struct {
	ID                  string         `json:"id"`
	Name                string         `json:"name"`
	Description         string         `json:"description"`
	Status              string         `json:"status"`
	TotalScore          float64        `json:"totalScore"`
	Duration            int            `json:"duration"`
	Questions           []ExamQuestion `json:"questions,omitempty"`
	CoverImage          *string        `json:"coverImage,omitempty"`
	CollaboratorIDs     []string       `json:"collaboratorIds,omitempty"`
	CollaboratorNames   []string       `json:"collaboratorNames,omitempty"`
	CollaboratorDeptIDs []string       `json:"collaboratorDeptIds,omitempty"`
	BatchID             *string        `json:"batchId,omitempty"`
	Version             string         `json:"version"`
	OwnerType           string         `json:"ownerType"`
	CreatorID           *string        `json:"creatorId,omitempty"`
	CreatorName         string         `json:"creatorName,omitempty"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
}

// ExamUsage represents a usage record of an exam.
type ExamUsage struct {
	ID          string    `json:"id"`
	ExamID      string    `json:"examId"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	StartTime   *string   `json:"startTime,omitempty"`
	EndTime     *string   `json:"endTime,omitempty"`
	Duration    *int      `json:"duration,omitempty"`
	TargetType  *string   `json:"targetType,omitempty"`
	TargetIDs   []string  `json:"targetIds"`
	Status      string    `json:"status"`
	CreatorID   *string   `json:"creatorId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ExamResult represents a student's submission result for an exam usage.
type ExamResult struct {
	ID           string    `json:"id"`
	ExamUsageID  string    `json:"examUsageId"`
	UserID       string    `json:"userId"`
	StudentName  string    `json:"studentName"`
	ClassName    string    `json:"className"`
	Grade        string    `json:"grade"`
	MajorID      *string   `json:"majorId,omitempty"`
	MajorName    *string   `json:"majorName,omitempty"`
	Score        float64   `json:"score"`
	TotalScore   float64   `json:"totalScore"`
	IsPass       bool      `json:"isPass"`
	Answers      JSONMap   `json:"answers,omitempty"`
	SubmitTime   time.Time `json:"submitTime"`
	CreatedAt    time.Time `json:"createdAt"`
}

// EvaluationMethodCategory represents a top-level evaluation category.
type EvaluationMethodCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Order int   `json:"order"`
}

// EvaluationMethod represents a second-level evaluation method.
type EvaluationMethod struct {
	ID              string  `json:"id"`
	CategoryID      string  `json:"categoryId"`
	Name            string  `json:"name"`
	Enabled         bool    `json:"enabled"`
	SubCategoryName *string `json:"subCategoryName,omitempty"`
	Description     *string `json:"description,omitempty"`
	DocLink         *string `json:"docLink,omitempty"`
}

// SceneEvaluationResult represents the result of a scene task evaluation.
type SceneEvaluationResult struct {
	ID               string   `json:"id"`
	TaskID           string   `json:"taskId"`
	SceneID          *string  `json:"sceneId,omitempty"`
	MethodKey        string   `json:"methodKey"`
	EvaluateeID      string   `json:"evaluateeId"`
	EvaluatorID      string   `json:"evaluatorId"`
	EvaluatorType    string   `json:"evaluatorType"`
	Status           string   `json:"status"`
	TotalScore       *float64 `json:"totalScore,omitempty"`
	MaxScore         float64  `json:"maxScore"`
	EvalPointScores  JSONMap  `json:"evalPointScores"`
	ObjectiveAnswers JSONMap  `json:"objectiveAnswers"`
	SubjectiveContent JSONMap `json:"subjectiveContent"`
	DrawnQuestions   JSONMap  `json:"drawnQuestions"`
	Comment          *string  `json:"comment,omitempty"`
	GradedAt         *time.Time `json:"gradedAt,omitempty"`
	GradedBy         *string  `json:"gradedBy,omitempty"`
}

// JobAbilityResult represents a job ability evaluation result.
type JobAbilityResult struct {
	ID                    string  `json:"id"`
	CareerPositionID      string  `json:"careerPositionId"`
	UserID                string  `json:"userId"`
	ClassName             *string `json:"className,omitempty"`
	MajorID                 *string `json:"majorId,omitempty"`
	MajorName               *string `json:"majorName,omitempty"`
	TotalAbilityPoints    int     `json:"totalAbilityPoints"`
	AchievedAbilityPoints int     `json:"achievedAbilityPoints"`
	AchievementRate       float64 `json:"achievementRate"`
	Grade                 *string `json:"grade,omitempty"`
	EvaluatedAt           string  `json:"evaluatedAt"`
}

// CertificationRule represents a position certification rule.
type CertificationRule struct {
	ID              string    `json:"id"`
	CareerPositionID string   `json:"careerPositionId"`
	Status          string    `json:"status"`
	RuleSource      string    `json:"ruleSource"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// CertificationAbilityItem represents an ability item under a certification rule.
type CertificationAbilityItem struct {
	ID        string `json:"id"`
	RuleID    string `json:"ruleId"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

// CertificationAbilityPoint represents an ability point under an ability item.
type CertificationAbilityPoint struct {
	ID                 string    `json:"id"`
	ItemID             string    `json:"itemId"`
	AbilityPointID     string    `json:"abilityPointId"`
	MappingType        string    `json:"mappingType"`
	CustomLevelMapping JSONSlice `json:"customLevelMapping,omitempty"`
	RequiredLevel      string    `json:"requiredLevel"`
	Weight             float64   `json:"weight"`
}

// CertificationRelatedTask represents a related task for a certification ability point.
type CertificationRelatedTask struct {
	ID          string  `json:"id"`
	CertPointID string  `json:"certPointId"`
	TaskID      string  `json:"taskId"`
	MaxScore    float64 `json:"maxScore"`
	Weight      float64 `json:"weight"`
}

// StudentAbilityPortrait represents a student's ability portrait.
type StudentAbilityPortrait struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"userId"`
	CareerPositionID    string    `json:"careerPositionId"`
	OverallGrade        *string   `json:"overallGrade,omitempty"`
	DomainScores        JSONSlice `json:"domainScores"`
	ClassRank           *int      `json:"classRank,omitempty"`
	ClassTotal          *int      `json:"classTotal,omitempty"`
	MajorRank           *int      `json:"majorRank,omitempty"`
	MajorTotal          *int      `json:"majorTotal,omitempty"`
	CompletedCourses    int       `json:"completedCourses"`
	CompletedScenes     int       `json:"completedScenes"`
	TotalCredits        float64   `json:"totalCredits"`
	CourseRecords       JSONSlice `json:"courseRecords"`
	GraduationQualified bool      `json:"graduationQualified"`
	AttendanceRate      *float64  `json:"attendanceRate,omitempty"`
	DiplomaBadge        *string   `json:"diplomaBadge,omitempty"`
	DualBadge           *string   `json:"dualBadge,omitempty"`
	ArchiveCount        int       `json:"archiveCount"`
	RecommendPositions  JSONSlice `json:"recommendPositions"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// StudentAbilityArchive represents a student's ability archive material.
type StudentAbilityArchive struct {
	ID              string    `json:"id"`
	UserID          string    `json:"userId"`
	MaterialType    string    `json:"materialType"`
	MaterialName    string    `json:"materialName"`
	IssuingOrg      *string   `json:"issuingOrg,omitempty"`
	ObtainDate      *string   `json:"obtainDate,omitempty"`
	Level           *string   `json:"level,omitempty"`
	AuditStatus     string    `json:"auditStatus"`
	AuditRemark     *string   `json:"auditRemark,omitempty"`
	ConvertedCredit float64   `json:"convertedCredit"`
	Direction       string    `json:"direction"`
	IsEnabled       bool      `json:"isEnabled"`
	CreatedAt       time.Time `json:"createdAt"`
}

// GraduationProjectTopic represents a graduation project topic.
type GraduationProjectTopic struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	CareerPositionID  string    `json:"careerPositionId"`
	College           *string   `json:"college,omitempty"`
	Source            string    `json:"source"`
	Status            string    `json:"status"`
	Capacity          int       `json:"capacity"`
	AppliedCount      int       `json:"appliedCount"`
	AdvisorID         *string   `json:"advisorId,omitempty"`
	EnterpriseMentorID *string  `json:"enterpriseMentorId,omitempty"`
	StartDate         *string   `json:"startDate,omitempty"`
	EndDate           *string   `json:"endDate,omitempty"`
	Description       *string   `json:"description,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

// GraduationProjectArchive represents a graduation project archive.
type GraduationProjectArchive struct {
	ID               string    `json:"id"`
	TopicID          string    `json:"topicId"`
	UserID           string    `json:"userId"`
	Phase            string    `json:"phase"`
	DocStatus        string    `json:"docStatus"`
	DocCount         int       `json:"docCount"`
	HasRectification bool      `json:"hasRectification"`
	LastUpdated      time.Time `json:"lastUpdated"`
}

// GraduationProjectEvaluation represents a graduation project evaluation.
type GraduationProjectEvaluation struct {
	ID                 string    `json:"id"`
	TopicID            string    `json:"topicId"`
	UserID             string    `json:"userId"`
	AdvisorScore       *float64  `json:"advisorScore,omitempty"`
	EnterpriseScore    *float64  `json:"enterpriseScore,omitempty"`
	DefenseScore       *float64  `json:"defenseScore,omitempty"`
	ComprehensiveGrade *string   `json:"comprehensiveGrade,omitempty"`
	IsExcellent        bool      `json:"isExcellent"`
	Status             string    `json:"status"`
	EvaluatedAt        time.Time `json:"evaluatedAt"`
}

// GraduationQueryResult represents a graduation query result.
type GraduationQueryResult struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"userId"`
	ClassName          *string   `json:"className,omitempty"`
	MajorName          *string   `json:"majorName,omitempty"`
	CreditCompleted    float64   `json:"creditCompleted"`
	CreditRequired     float64   `json:"creditRequired"`
	ScenePassed        int       `json:"scenePassed"`
	SceneRequired      int       `json:"sceneRequired"`
	ProjectGrade       *string   `json:"projectGrade,omitempty"`
	GraduationStatus   string    `json:"graduationStatus"`
	AbilityCertStatus  string    `json:"abilityCertStatus"`
	RectificationCount int       `json:"rectificationCount"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// MicroCertTemplate represents a micro certificate template.
type MicroCertTemplate struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	CertTypeID   string    `json:"certTypeId"`
	CertTypeName string    `json:"certTypeName"`
	Content      string    `json:"content"`
	CoverImage   *string   `json:"coverImage,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CertIssuanceRecord represents a certificate issuance record.
type CertIssuanceRecord struct {
	ID           string     `json:"id"`
	TemplateID   string     `json:"templateId"`
	UserID       string     `json:"userId"`
	CertNumber   string     `json:"certNumber"`
	IssueDate    time.Time  `json:"issueDate"`
	ExpireDate   *time.Time `json:"expireDate,omitempty"`
	Status       string     `json:"status"`
	RevokedAt    *time.Time `json:"revokedAt,omitempty"`
	RevokeReason *string    `json:"revokeReason,omitempty"`
}

// AppealRecord represents an appeal record.
type AppealRecord struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`
	Reason    string    `json:"reason"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// EvaluationBatch represents a batch grouping for evaluations.
type EvaluationBatch struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Code       *string   `json:"code,omitempty"`
	OrgNodeID  *string   `json:"orgNodeId,omitempty"`
	MajorID    *string   `json:"majorId,omitempty"`
	MajorName  *string   `json:"majorName,omitempty"`
	WorkflowID *string   `json:"workflowId,omitempty"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// RandomDrawQuestion represents a 现场问答 question stored in the system-wide pool.
type RandomDrawQuestion struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	Answer      *string   `json:"answer,omitempty"`
	Major       *string   `json:"major,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
