package domain

import "time"

type WorkspaceDashboard struct {
	Role           string                    `json:"role"`
	Announcements  []WorkspaceAnnouncement   `json:"announcements"`
	Todos          []WorkspaceTodo           `json:"todos"`
	Schedule       []WorkspaceScheduleEvent  `json:"schedule"`
	Stats          *WorkspaceStats           `json:"stats,omitempty"`
	ResourceStats  []WorkspaceResourceStat   `json:"resourceStats,omitempty"`
	PersonnelStats []WorkspacePersonnelStat  `json:"personnelStats,omitempty"`
	ResourceGrowth []WorkspaceResourceGrowth `json:"resourceGrowth,omitempty"`

	// Student workspace data
	Courses      []WorkspaceCourse       `json:"courses"`
	SceneTasks   []WorkspaceSceneTask    `json:"sceneTasks"`
	Exams        []WorkspaceExam         `json:"exams"`
	LearningPath []WorkspaceLearningPath `json:"learningPath"`

	// Teacher workspace data
	TeacherCourses []WorkspaceTeacherCourse `json:"teacherCourses"`
	ClassPlans     []WorkspaceClassPlan     `json:"classPlans"`
	ClassSessions  []WorkspaceClassSession  `json:"classSessions"`
}

type WorkspaceAnnouncement struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	IsNew     bool      `json:"isNew"`
	Date      string    `json:"date"`
	CreatedAt time.Time `json:"createdAt"`
}

type WorkspaceTodo struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Type     string `json:"type"`
	Count    int    `json:"count"`
	Urgent   bool   `json:"urgent"`
	Deadline string `json:"deadline,omitempty"`
}

type WorkspaceScheduleEvent struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Type       string `json:"type"`
	DayOfWeek  int    `json:"dayOfWeek"`
	Period     string `json:"period"`
	Teacher    string `json:"teacher,omitempty"`
	Location   string `json:"location,omitempty"`
	Status     string `json:"status,omitempty"`
	ClassName  string `json:"className,omitempty"`
	ScenarioID string `json:"scenarioId,omitempty"`
	CourseID   string `json:"courseId,omitempty"`
}

type WorkspaceStats struct {
	Label1 string `json:"label1"`
	Value1 int    `json:"value1"`
	Label2 string `json:"label2"`
	Value2 int    `json:"value2"`
}

type WorkspaceResourceStat struct {
	Label string `json:"label"`
	Value int    `json:"value"`
	Icon  string `json:"icon,omitempty"`
	Href  string `json:"href,omitempty"`
}

type WorkspacePersonnelStat struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

type WorkspaceResourceGrowth struct {
	Month           string `json:"month"`
	Courses         int    `json:"courses"`
	Scenarios       int    `json:"scenarios"`
	CareerPositions int    `json:"careerPositions"`
	QuestionBanks   int    `json:"questionBanks"`
	Exams           int    `json:"exams"`
	ExamUsages      int    `json:"examUsages"`
}

type WorkspaceCourse struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Teacher      string `json:"teacher"`
	Credit       int    `json:"credit"`
	Hours        int    `json:"hours"`
	Progress     int    `json:"progress"`
	Cover        string `json:"cover"`
	Status       string `json:"status"`
	NextTask     string `json:"nextTask,omitempty"`
	NextDeadline string `json:"nextDeadline,omitempty"`
}

type WorkspaceSceneTask struct {
	ID          string   `json:"id"`
	ScenarioID  string   `json:"scenarioId"`
	SceneName   string   `json:"sceneName"`
	TaskName    string   `json:"taskName"`
	Position    string   `json:"position"`
	AbilityTags []string `json:"abilityTags"`
	Status      string   `json:"status"`
	Deadline    string   `json:"deadline"`
	Score       *int     `json:"score,omitempty"`
	TotalScore  int      `json:"totalScore"`
	Difficulty  string   `json:"difficulty"`
}

type WorkspaceExam struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Status     string `json:"status"`
	StartTime  string `json:"startTime"`
	EndTime    string `json:"endTime"`
	Duration   int    `json:"duration"`
	Score      *int   `json:"score,omitempty"`
	TotalScore int    `json:"totalScore"`
}

type WorkspaceLearningPath struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Resources string `json:"resources"`
	Duration  string `json:"duration"`
}

type WorkspaceTeacherCourse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Code         string `json:"code"`
	Type         string `json:"type"`
	ClassName    string `json:"className"`
	Term         string `json:"term"`
	Students     int    `json:"students"`
	Hours        int    `json:"hours"`
	Progress     int    `json:"progress"`
	Cover        string `json:"cover"`
	Status       string `json:"status"`
	NextTask     string `json:"nextTask,omitempty"`
	NextDeadline string `json:"nextDeadline,omitempty"`
}

type WorkspaceClassPlan struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Course     string `json:"course"`
	Term       string `json:"term"`
	Students   int    `json:"students"`
	Teacher    string `json:"teacher"`
	Status     string `json:"status"`
	ScenarioID string `json:"scenarioId,omitempty"`
	CourseID   string `json:"courseId,omitempty"`
}

type WorkspaceClassSession struct {
	ID       string `json:"id"`
	CourseID string `json:"courseId"`
	Venue    string `json:"venue"`
	Week     int    `json:"week"`
	Weekday  string `json:"weekday"`
	Period   string `json:"period"`
	Status   string `json:"status"`
}
