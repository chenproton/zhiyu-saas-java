package domain

// LevelMapping 能力点分档配置项（level 为掌握程度代码：understand/comprehend/master/proficient/expert）。
type LevelMapping struct {
	Level string  `json:"level"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
}

// CertificationModelTask 能力点关联的测评任务（场景任务或课程）。
type CertificationModelTask struct {
	TaskID       string  `json:"taskId"`
	TaskName     string  `json:"taskName"`
	ScenarioName string  `json:"scenarioName"`
	TaskType     string  `json:"taskType"` // "scene" | "course"
	Weight       float64 `json:"weight"`
}

// CertificationModelPoint 岗位能力点（掌握程度要求/胜任标准来自 position_ability_bindings）。
type CertificationModelPoint struct {
	AbilityPointID    string                   `json:"abilityPointId"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description"`
	RequiredLevel     string                   `json:"requiredLevel"`
	RubricDescription string                   `json:"rubricDescription"`
	Weight            float64                  `json:"weight"`
	Tasks             []CertificationModelTask `json:"tasks"`
	// LevelMapping 能力点自定义五档分数线（[{level,min,max}×5]）；为空表示使用系统默认档位
	LevelMapping JSONSlice `json:"levelMapping,omitempty"`
}

// CertificationModelDomain 能力域（按 position_ability_bindings.domain 分组）。
type CertificationModelDomain struct {
	Name   string                    `json:"name"`
	Points []CertificationModelPoint `json:"points"`
}
