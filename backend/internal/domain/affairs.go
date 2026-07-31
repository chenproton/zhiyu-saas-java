package domain

import "time"

// Term 学期。
type Term struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	StartDate  string    `json:"startDate"`
	EndDate    string    `json:"endDate"`
	WeeksCount int       `json:"weeksCount"`
	IsCurrent  bool      `json:"isCurrent"`
	CreatedAt  time.Time `json:"createdAt"`
}

// TrainingProgram 人才培养方案。
type TrainingProgram struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Code           *string   `json:"code,omitempty"`
	MajorID        *string   `json:"majorId,omitempty"`
	MajorName      string    `json:"majorName,omitempty"`
	EntryYear      int       `json:"entryYear"`
	Level          *string   `json:"level,omitempty"`
	Duration       *int      `json:"duration,omitempty"`
	TotalCredits   *float64  `json:"totalCredits,omitempty"`
	Status         string    `json:"status"`
	Description    *string   `json:"description,omitempty"`
	CourseCount    int       `json:"courseCount"`
	CreatedBy      *string   `json:"createdBy,omitempty"`
	CreatedByName  string    `json:"createdByName,omitempty"`
	Collaborators  []string  `json:"collaborators,omitempty"`
	CollaboratorNames []string `json:"collaboratorNames,omitempty"`
	BatchID        *string   `json:"batchId,omitempty"`
	BatchName      string    `json:"batchName,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// TrainingProgramCourse 人培方案课程（通过 position_id 关联岗位下的所有场景，或通过 course_id 关联体系课）。
type TrainingProgramCourse struct {
	ID           string  `json:"id"`
	ProgramID    string  `json:"programId"`
	Name         string  `json:"name"`
	Code         *string `json:"code,omitempty"`
	Credits      float64 `json:"credits"`
	Hours        int     `json:"hours"`
	Semester     int     `json:"semester"`
	Nature       string  `json:"nature"`
	Assessment   *string `json:"assessment,omitempty"`
	PositionID   *string `json:"positionId,omitempty"`
	PositionName string  `json:"positionName,omitempty"`
	CourseID     *string `json:"courseId,omitempty"`
	CourseName   string  `json:"courseName,omitempty"`
	SortOrder    int     `json:"sortOrder"`
}

// TeachingPlan 教学计划（从人培方案按学期生成）。
type TeachingPlan struct {
	ID          string     `json:"id"`
	ProgramID   string     `json:"programId"`
	ProgramName string     `json:"programName,omitempty"`
	TermID      string     `json:"termId"`
	TermName    string     `json:"termName,omitempty"`
	MajorID     *string    `json:"majorId,omitempty"`
	MajorName   string     `json:"majorName,omitempty"`
	EntryYear   int        `json:"entryYear"`
	Status      string     `json:"status"`
	EntryCount  int        `json:"entryCount"`
	GeneratedAt time.Time  `json:"generatedAt"`
	ConfirmedAt *time.Time `json:"confirmedAt,omitempty"`
}

// TeachingPlanEntry 教学计划条目（排课的待排来源）。
type TeachingPlanEntry struct {
	ID            string   `json:"id"`
	PlanID        string   `json:"planId"`
	CourseName    string   `json:"courseName"`
	CourseCode    *string  `json:"courseCode,omitempty"`
	Type          string   `json:"type"` // theory/practice/scene
	Nature        *string  `json:"nature,omitempty"`
	Credits       float64  `json:"credits"`
	TotalHours    int      `json:"totalHours"`
	WeekHours     int      `json:"weekHours"`
	StartWeek     int      `json:"startWeek"`
	EndWeek       int      `json:"endWeek"`
	WeekPattern   string   `json:"weekPattern"`
	ClassNodeID   *string  `json:"classNodeId,omitempty"`
	ClassName     string   `json:"className,omitempty"`
	ClassNodeIDs  []string `json:"classNodeIds,omitempty"`
	ClassNames    []string `json:"classNames,omitempty"`
	TeacherID     *string  `json:"teacherId,omitempty"`
	TeacherName   string   `json:"teacherName,omitempty"`
	TeacherType   *string  `json:"teacherType,omitempty"`
	VenueType     *string  `json:"venueType,omitempty"`
	ScenarioID    *string  `json:"scenarioId,omitempty"`
	ScenarioName  string   `json:"scenarioName,omitempty"`
	PositionName  string   `json:"positionName,omitempty"`
	CourseID        *string `json:"courseId,omitempty"`
	LinkedCourseName string  `json:"linkedCourseName,omitempty"`
	Status        string   `json:"status"`
}

// Venue 场地。
type Venue struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Capacity  *int      `json:"capacity,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// PeriodSlot 节次。
type PeriodSlot struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sortOrder"`
	StartTime *string `json:"startTime,omitempty"`
	EndTime   *string `json:"endTime,omitempty"`
}

// ScheduleEntry 排课结果（课表核心实体）。
type ScheduleEntry struct {
	ID           string    `json:"id"`
	TermID       string    `json:"termId"`
	PlanEntryID  *string   `json:"planEntryId,omitempty"`
	CourseName   string    `json:"courseName"`
	CourseCode   *string   `json:"courseCode,omitempty"`
	CourseID     *string   `json:"courseId,omitempty"`
	Type         string    `json:"type"` // traditional/scene
	ClassNodeID  string    `json:"classNodeId"`
	ClassName    string    `json:"className,omitempty"`
	TeacherID    *string   `json:"teacherId,omitempty"`
	TeacherName  string    `json:"teacherName,omitempty"`
	DayOfWeek    int       `json:"dayOfWeek"`
	Periods      JSONSlice `json:"periods"`
	StartWeek    int       `json:"startWeek"`
	EndWeek      int       `json:"endWeek"`
	WeekPattern  string    `json:"weekPattern"`
	VenueID      *string   `json:"venueId,omitempty"`
	VenueName    string    `json:"venueName,omitempty"`
	ScenarioID   *string   `json:"scenarioId,omitempty"`
	ScenarioName string    `json:"scenarioName,omitempty"`
	Source       string    `json:"source"`
	Status       string    `json:"status"`
	Version      int       `json:"version"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// ScheduleConflict 排课冲突详情（409 响应体）。
type ScheduleConflict struct {
	Kind        string    `json:"kind"` // teacher/class/venue
	EntryID     string    `json:"entryId"`
	CourseName  string    `json:"courseName"`
	ClassName   string    `json:"className,omitempty"`
	TeacherName string    `json:"teacherName,omitempty"`
	VenueName   string    `json:"venueName,omitempty"`
	DayOfWeek   int       `json:"dayOfWeek"`
	Periods     JSONSlice `json:"periods"`
	StartWeek   int       `json:"startWeek"`
	EndWeek     int       `json:"endWeek"`
	WeekPattern string    `json:"weekPattern"`
}
