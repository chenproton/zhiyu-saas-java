package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/crypto"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ScenarioAssistField 场景 AI 辅助生成的目标字段。
type ScenarioAssistField string

const (
	ScenarioAssistPolish          ScenarioAssistField = "polish"          // 场景基础信息润色（名称/介绍/难度 + 行业专业建议）
	ScenarioAssistTaskPolish      ScenarioAssistField = "taskPolish"      // 任务基础信息润色（名称/背景/难度）
	ScenarioAssistTaskDescription ScenarioAssistField = "taskDescription" // 任务说明生成
	ScenarioAssistTaskKnowledge   ScenarioAssistField = "taskKnowledge"   // 考查知识点推荐
	ScenarioAssistTaskAbility     ScenarioAssistField = "taskAbility"     // 考查能力点推荐（匹配岗位绑定能力点）
	ScenarioAssistTaskResource    ScenarioAssistField = "taskResource"    // 任务资源推荐
	ScenarioAssistTaskChain       ScenarioAssistField = "taskChain"       // 任务链结构建议
)

// ErrScenarioAssistNoPosition 场景未关联目标岗位（taskAbility 前置条件）。
var ErrScenarioAssistNoPosition = errors.New("service: scenario has no career position")

func validScenarioAssistField(f ScenarioAssistField) bool {
	switch f {
	case ScenarioAssistPolish, ScenarioAssistTaskPolish, ScenarioAssistTaskDescription,
		ScenarioAssistTaskKnowledge, ScenarioAssistTaskAbility, ScenarioAssistTaskResource,
		ScenarioAssistTaskChain:
		return true
	}
	return false
}

// ScenarioAssistInput 场景/任务 AI 辅助请求上下文（前端已把字典 ID 解析为名称）。
type ScenarioAssistInput struct {
	Name            string   `json:"name"`
	Background      string   `json:"background"`
	Difficulty      int      `json:"difficulty"`
	IndustryNames   []string `json:"industryNames"`
	ProfessionNames []string `json:"professionNames"`
	PositionID      string   `json:"positionId"`
	PositionName    string   `json:"positionName"`

	// task* 字段使用：当前任务上下文
	TaskName        string `json:"taskName"`
	TaskBackground  string `json:"taskBackground"`
	TaskDescription string `json:"taskDescription"`
	TaskDifficulty  int    `json:"taskDifficulty"`

	// taskChain 使用：现有任务清单与用户意图
	ExistingTasks []ScenarioExistingTask `json:"existingTasks"`
	Intention     string                 `json:"intention"`
}

// ScenarioExistingTask 现有任务摘要（taskChain 上下文）。
type ScenarioExistingTask struct {
	Name       string `json:"name"`
	Type       string `json:"type"` // training | assessment
	Difficulty int    `json:"difficulty"`
}

// ScenarioPolish 场景基础信息润色结果。
type ScenarioPolish struct {
	Name       string `json:"name"`
	Background string `json:"background"`
	Difficulty int    `json:"difficulty"`
}

// ScenarioTaskPolish 任务基础信息润色结果。
type ScenarioTaskPolish struct {
	Name       string `json:"name"`
	Background string `json:"background"`
	Difficulty int    `json:"difficulty"`
}

// ScenarioSuggestion 实体推荐条目：matchedId 非空表示命中现有对象（引用优先），否则需新建/引导添加。
type ScenarioSuggestion struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type,omitempty"` // taskResource：资源类型枚举
	MatchedID   string `json:"matchedId,omitempty"`
	MatchedName string `json:"matchedName,omitempty"`
}

// ScenarioTaskChainTask 任务链建议中的单个任务。
type ScenarioTaskChainTask struct {
	Name           string `json:"name"`
	Type           string `json:"type"` // training | assessment
	Difficulty     int    `json:"difficulty"`
	EstimatedHours int    `json:"estimatedHours"`
	Description    string `json:"description"`
}

// ScenarioTaskChain 任务链结构建议。
type ScenarioTaskChain struct {
	TaskCount       int                     `json:"taskCount"`
	AssessmentCount int                     `json:"assessmentCount"`
	TrainingCount   int                     `json:"trainingCount"`
	Tasks           []ScenarioTaskChainTask `json:"tasks"`
}

// ScenarioAssistResult 场景 AI 辅助结果：仅包含请求 field 对应的字段。
type ScenarioAssistResult struct {
	Field                 ScenarioAssistField  `json:"field"`
	Polish                *ScenarioPolish      `json:"polish,omitempty"`
	IndustrySuggestions   []ScenarioSuggestion `json:"industrySuggestions,omitempty"`
	ProfessionSuggestions []ScenarioSuggestion `json:"professionSuggestions,omitempty"`
	Task                  *ScenarioTaskPolish  `json:"task,omitempty"`
	TaskDescription       string               `json:"taskDescription,omitempty"`
	Suggestions           []ScenarioSuggestion `json:"suggestions,omitempty"`
	Chain                 *ScenarioTaskChain   `json:"chain,omitempty"`
}

// scenarioAssistSystemPrompt 系统提示词：只输出 JSON，贴合场景与岗位。
const scenarioAssistSystemPrompt = `你是一名资深的实践场景教学设计专家，擅长设计面向职业教育的实践场景与任务链。
要求：
1. 只输出 JSON，不要输出任何解释、Markdown 代码块或额外文字。
2. 所有内容使用简体中文。
3. 内容必须贴合给定的场景主题、目标岗位与行业，不要生搬硬套。
4. 不得虚构岗位信息，不得输出与任务无关的内容。`

// scenarioResourceTypes 资源类型枚举（与 domain.ResourceType* 一致）。
const scenarioResourceTypes = "document（文档）/ spreadsheet（表格）/ image（图片）/ link（链接）/ audio（音频）/ video（视频）/ archive（压缩包）/ venue（场地）/ facility（设施）/ software（软件）/ other（其他）"

// scenarioAssistPrompt 构造单字段生成提示词（纯函数，便于测试）。
func scenarioAssistPrompt(field ScenarioAssistField, in ScenarioAssistInput) string {
	var task, spec string
	switch field {
	case ScenarioAssistPolish:
		task = "润色并补全该实践场景的基础信息：\n" +
			"1. 场景名称：更专业规范的叫法（不超过 30 字）；\n" +
			"2. 场景介绍：200-300 字的背景介绍，包含背景、意义与学习目标；\n" +
			"3. 难度等级：1-5 整数（1 入门 / 2 基础 / 3 中级 / 4 高级 / 5 专家），贴合岗位要求；\n" +
			"4. industryNames：建议 0-2 个面向行业名称（常见行业通用名）；\n" +
			"5. professionNames：建议 0-2 个适用专业名称（常见专业通用名）。"
		spec = `{"name": "string", "background": "string", "difficulty": 1-5, "industryNames": ["string"], "professionNames": ["string"]}`
	case ScenarioAssistTaskPolish:
		task = "润色并补全该任务的基础信息：\n" +
			"1. 任务名称：动词开头、一句话（不超过 30 字）；\n" +
			"2. 任务背景：100-200 字的任务背景介绍，说明任务在场景中的位置与目的；\n" +
			"3. 难度等级：1-5 整数。"
		spec = `{"name": "string", "background": "string", "difficulty": 1-5}`
	case ScenarioAssistTaskDescription:
		task = "为该任务生成完整的任务说明（Markdown 格式，600-1200 字），包含：任务目标、具体子目标、交付要求（格式/篇幅）、测评要求（准确性/完整性/清晰度/实用性/规范性）。"
		spec = `{"description": "string"}`
	case ScenarioAssistTaskKnowledge:
		task = "根据任务内容推荐 3-5 个该任务应考查的知识点，name 为知识点名称（通用名词短语，不超过 20 字），description 为一句说明（不超过 40 字）。"
		spec = `{"knowledgePoints": [{"name": "string", "description": "string"}]}`
	case ScenarioAssistTaskAbility:
		task = "根据任务内容推荐 3-5 个该任务应考查的岗位能力点，name 为能力点名称（名词短语，不超过 20 字）。"
		spec = `{"abilities": [{"name": "string"}]}`
	case ScenarioAssistTaskResource:
		task = "根据任务内容推荐 2-4 个任务所需配套资源：\n" +
			"1. name：资源名称（不超过 30 字）；\n" +
			"2. type：资源类型，必须从以下枚举中选择一个：" + scenarioResourceTypes + "；\n" +
			"3. description：一句资源用途说明（不超过 40 字）。"
		spec = `{"resources": [{"name": "string", "type": "string", "description": "string"}]}`
	case ScenarioAssistTaskChain:
		task = "为场景设计任务链结构，3-8 个任务，训练（training）与考核（assessment）合理配比、难度递进（与现有任务不重复）：\n" +
			"1. name：任务名称（动词开头，不超过 30 字）；\n" +
			"2. type：training（训练任务）或 assessment（考核任务）；\n" +
			"3. difficulty：1-5 整数；\n" +
			"4. estimatedHours：预估学时（1-40 整数）；\n" +
			"5. description：一句话任务描述（不超过 80 字）。"
		spec = `{"tasks": [{"name": "string", "type": "training|assessment", "difficulty": 1-5, "estimatedHours": number, "description": "string"}]}`
	default:
		return ""
	}

	var b strings.Builder
	b.WriteString("场景信息：\n")
	if in.Name != "" {
		b.WriteString("- 场景名称：" + in.Name + "\n")
	}
	if in.Background != "" {
		b.WriteString("- 场景介绍：" + in.Background + "\n")
	}
	if in.PositionName != "" {
		b.WriteString("- 目标岗位：" + in.PositionName + "\n")
	}
	if len(in.IndustryNames) > 0 {
		b.WriteString("- 面向行业：" + strings.Join(in.IndustryNames, "、") + "\n")
	}
	if len(in.ProfessionNames) > 0 {
		b.WriteString("- 适用专业：" + strings.Join(in.ProfessionNames, "、") + "\n")
	}
	if in.Difficulty > 0 {
		b.WriteString(fmt.Sprintf("- 场景难度：%d 星\n", in.Difficulty))
	}
	if in.TaskName != "" {
		b.WriteString("- 任务名称：" + in.TaskName + "\n")
	}
	if in.TaskBackground != "" {
		b.WriteString("- 任务背景：" + in.TaskBackground + "\n")
	}
	if in.TaskDescription != "" {
		b.WriteString("- 现有任务说明：" + in.TaskDescription + "\n")
	}
	if in.TaskDifficulty > 0 {
		b.WriteString(fmt.Sprintf("- 任务难度：%d 星\n", in.TaskDifficulty))
	}
	if len(in.ExistingTasks) > 0 {
		b.WriteString("- 现有任务链：\n")
		for _, t := range in.ExistingTasks {
			b.WriteString(fmt.Sprintf("  · %s（%s，%d 星）\n", t.Name, t.Type, t.Difficulty))
		}
	}
	if in.Intention != "" {
		b.WriteString("- 用户期望：" + in.Intention + "\n")
	}

	b.WriteString("\n任务：" + task + "\n")
	b.WriteString("\n输出格式（严格 JSON，字段名与下方一致）：\n" + spec)
	return b.String()
}

// scenarioResourceTypeWhitelist 资源类型白名单（与 domain.ResourceType* 一致）。
var scenarioResourceTypeWhitelist = map[string]bool{
	"document": true, "spreadsheet": true, "image": true, "link": true,
	"audio": true, "video": true, "archive": true, "venue": true,
	"facility": true, "software": true, "other": true,
}

// parseScenarioAssistOutput 按 field 解析 LLM 输出并填充结果；空结果/非法枚举视为解析失败。
// 实体建议（行业/专业/知识点/能力点/资源）只填 name 等原始字段，matched 由服务端匹配步骤补齐。
func parseScenarioAssistOutput(field ScenarioAssistField, text string, result *ScenarioAssistResult) error {
	raw, err := extractJSONObject(text)
	if err != nil {
		return fmt.Errorf("parse scenario assist output: %w", err)
	}
	switch field {
	case ScenarioAssistPolish:
		var out struct {
			Name            string   `json:"name"`
			Background      string   `json:"background"`
			Difficulty      int      `json:"difficulty"`
			IndustryNames   []string `json:"industryNames"`
			ProfessionNames []string `json:"professionNames"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse polish output: %w", err)
		}
		if strings.TrimSpace(out.Name) == "" || strings.TrimSpace(out.Background) == "" {
			return errors.New("ai returned empty polish result")
		}
		out.Difficulty = clampDifficulty(out.Difficulty)
		result.Polish = &ScenarioPolish{Name: strings.TrimSpace(out.Name), Background: strings.TrimSpace(out.Background), Difficulty: out.Difficulty}
		result.IndustrySuggestions = trimSuggestionNames(out.IndustryNames)
		result.ProfessionSuggestions = trimSuggestionNames(out.ProfessionNames)
	case ScenarioAssistTaskPolish:
		var out struct {
			Name       string `json:"name"`
			Background string `json:"background"`
			Difficulty int    `json:"difficulty"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskPolish output: %w", err)
		}
		if strings.TrimSpace(out.Name) == "" {
			return errors.New("ai returned empty taskPolish result")
		}
		result.Task = &ScenarioTaskPolish{
			Name:       strings.TrimSpace(out.Name),
			Background: strings.TrimSpace(out.Background),
			Difficulty: clampDifficulty(out.Difficulty),
		}
	case ScenarioAssistTaskDescription:
		var out struct {
			Description string `json:"description"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskDescription output: %w", err)
		}
		if strings.TrimSpace(out.Description) == "" {
			return errors.New("ai returned empty taskDescription")
		}
		result.TaskDescription = strings.TrimSpace(out.Description)
	case ScenarioAssistTaskKnowledge:
		var out struct {
			Items []struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			} `json:"knowledgePoints"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskKnowledge output: %w", err)
		}
		result.Suggestions = make([]ScenarioSuggestion, 0, len(out.Items))
		for _, it := range out.Items {
			it.Name = strings.TrimSpace(it.Name)
			if it.Name == "" {
				continue
			}
			result.Suggestions = append(result.Suggestions, ScenarioSuggestion{Name: it.Name, Description: strings.TrimSpace(it.Description)})
		}
		if len(result.Suggestions) == 0 {
			return errors.New("ai returned empty taskKnowledge")
		}
	case ScenarioAssistTaskAbility:
		var out struct {
			Items []struct {
				Name string `json:"name"`
			} `json:"abilities"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskAbility output: %w", err)
		}
		names := make([]string, 0, len(out.Items))
		for _, it := range out.Items {
			names = append(names, it.Name)
		}
		result.Suggestions = trimSuggestionNames(names)
		if len(result.Suggestions) == 0 {
			return errors.New("ai returned empty taskAbility")
		}
	case ScenarioAssistTaskResource:
		var out struct {
			Items []struct {
				Name        string `json:"name"`
				Type        string `json:"type"`
				Description string `json:"description"`
			} `json:"resources"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskResource output: %w", err)
		}
		result.Suggestions = make([]ScenarioSuggestion, 0, len(out.Items))
		for _, it := range out.Items {
			it.Name = strings.TrimSpace(it.Name)
			it.Type = strings.TrimSpace(it.Type)
			if it.Name == "" || !scenarioResourceTypeWhitelist[it.Type] {
				continue
			}
			result.Suggestions = append(result.Suggestions, ScenarioSuggestion{Name: it.Name, Type: it.Type, Description: strings.TrimSpace(it.Description)})
		}
		if len(result.Suggestions) == 0 {
			return errors.New("ai returned empty taskResource")
		}
	case ScenarioAssistTaskChain:
		var out struct {
			Tasks []ScenarioTaskChainTask `json:"tasks"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse taskChain output: %w", err)
		}
		chain := &ScenarioTaskChain{}
		for _, t := range out.Tasks {
			t.Name = strings.TrimSpace(t.Name)
			if t.Name == "" || (t.Type != "training" && t.Type != "assessment") {
				continue
			}
			t.Difficulty = clampDifficulty(t.Difficulty)
			t.Description = strings.TrimSpace(t.Description)
			if t.EstimatedHours < 1 {
				t.EstimatedHours = 2
			}
			if t.EstimatedHours > 40 {
				t.EstimatedHours = 40
			}
			chain.Tasks = append(chain.Tasks, t)
		}
		if len(chain.Tasks) == 0 {
			return errors.New("ai returned empty taskChain")
		}
		chain.TaskCount = len(chain.Tasks)
		for _, t := range chain.Tasks {
			if t.Type == "assessment" {
				chain.AssessmentCount++
			} else {
				chain.TrainingCount++
			}
		}
		result.Chain = chain
	default:
		return fmt.Errorf("service: unsupported scenario assist field %q", field)
	}
	return nil
}

func clampDifficulty(d int) int {
	if d < 1 || d > 5 {
		return 3
	}
	return d
}

func trimSuggestionNames(names []string) []ScenarioSuggestion {
	out := make([]ScenarioSuggestion, 0, len(names))
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n != "" {
			out = append(out, ScenarioSuggestion{Name: n})
		}
	}
	return out
}

// ScenarioAssist 用租户自有 AI 配置生成场景/任务内容建议。
// 实体建议（行业/专业/知识点/能力点/资源）在解析后经服务端按名精确匹配现有对象（引用优先）：
// 命中回填 matchedId/matchedName，未命中留空由前端引导新建。
func (s *AIService) ScenarioAssist(ctx context.Context, tenantID, userID string, field ScenarioAssistField, in ScenarioAssistInput) (*ScenarioAssistResult, error) {
	if !validScenarioAssistField(field) {
		return nil, fmt.Errorf("service: unsupported scenario assist field %q", field)
	}
	if field == ScenarioAssistTaskAbility && strings.TrimSpace(in.PositionID) == "" {
		return nil, ErrScenarioAssistNoPosition
	}
	cfg, err := s.loadConfig(ctx, tenantID)
	if errors.Is(err, store.ErrAIConfigNotFound) {
		return nil, ErrAINotConfigured
	}
	if err != nil {
		return nil, err
	}
	apiKey, err := crypto.Decrypt(s.secret, cfg.APIKeyEncrypted)
	if err != nil {
		return nil, err
	}

	prompt := scenarioAssistPrompt(field, in)
	if prompt == "" {
		return nil, fmt.Errorf("service: unsupported scenario assist field %q", field)
	}
	messages := []ai.Message{
		{Role: "system", Content: scenarioAssistSystemPrompt},
		{Role: "user", Content: prompt},
	}
	result := &ScenarioAssistResult{Field: field}
	if err := s.chatJSONWithRepair(ctx, tenantID, userID, ai.Config{BaseURL: cfg.BaseURL, APIKey: apiKey, Model: cfg.Model}, messages, func(text string) error {
		return parseScenarioAssistOutput(field, text, result)
	}); err != nil {
		return nil, err
	}
	if err := s.matchScenarioSuggestions(ctx, tenantID, field, in, result); err != nil {
		return nil, err
	}
	return result, nil
}

// matchScenarioSuggestions 引用优先：按名精确匹配现有对象并回填 matched 信息。
func (s *AIService) matchScenarioSuggestions(ctx context.Context, tenantID string, field ScenarioAssistField, in ScenarioAssistInput, result *ScenarioAssistResult) error {
	switch field {
	case ScenarioAssistPolish:
		if len(result.IndustrySuggestions) > 0 {
			items, err := s.st.Industries().FindByNames(ctx, tenantID, suggestionNames(result.IndustrySuggestions))
			if err != nil {
				return err
			}
			fillMatched(result.IndustrySuggestions, industryNameMap(items))
		}
		if len(result.ProfessionSuggestions) > 0 {
			items, err := s.st.Majors().FindByNames(ctx, tenantID, suggestionNames(result.ProfessionSuggestions))
			if err != nil {
				return err
			}
			fillMatched(result.ProfessionSuggestions, majorNameMap(items))
		}
	case ScenarioAssistTaskKnowledge:
		items, err := s.st.KnowledgePoints().FindByNames(ctx, tenantID, suggestionNames(result.Suggestions))
		if err != nil {
			return err
		}
		fillMatched(result.Suggestions, knowledgePointNameMap(items))
	case ScenarioAssistTaskAbility:
		// 匹配域 = 该岗位的绑定能力点（任务考查能力点只能从绑定中选择）
		bindings, _, err := s.st.PositionAbilities().List(ctx, store.ListParams{
			TenantID: tenantID,
			Limit:    1000,
			Values:   map[string]string{"careerPositionId": in.PositionID},
		}, s.st.PositionAbilities().ListConfig())
		if err != nil {
			return err
		}
		byName := make(map[string]string, len(bindings))
		for _, b := range bindings {
			if b.AbilityName != nil && *b.AbilityName != "" {
				byName[*b.AbilityName] = b.AbilityPointID
			}
		}
		fillMatched(result.Suggestions, byName)
	case ScenarioAssistTaskResource:
		// 资源匹配需按类型分组（FindByNames 需指定 resourceType）
		byType := make(map[string][]string)
		for _, sg := range result.Suggestions {
			byType[sg.Type] = append(byType[sg.Type], sg.Name)
		}
		for resourceType, names := range byType {
			items, err := s.st.ResourceLibrary().FindByNames(ctx, tenantID, resourceType, names)
			if err != nil {
				return err
			}
			byName := make(map[string]string, len(items))
			for _, it := range items {
				byName[it.Name] = it.ID
			}
			for i := range result.Suggestions {
				sg := &result.Suggestions[i]
				if sg.MatchedID == "" && sg.Type == resourceType {
					if id, ok := byName[sg.Name]; ok {
						sg.MatchedID = id
						sg.MatchedName = sg.Name
					}
				}
			}
		}
	}
	return nil
}

func suggestionNames(items []ScenarioSuggestion) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		out = append(out, it.Name)
	}
	return out
}

func fillMatched(items []ScenarioSuggestion, byName map[string]string) {
	for i := range items {
		if id, ok := byName[items[i].Name]; ok {
			items[i].MatchedID = id
			items[i].MatchedName = items[i].Name
		}
	}
}

func industryNameMap(items []domain.Industry) map[string]string {
	out := make(map[string]string, len(items))
	for _, it := range items {
		out[it.Name] = it.ID
	}
	return out
}

func majorNameMap(items []domain.Major) map[string]string {
	out := make(map[string]string, len(items))
	for _, it := range items {
		out[it.Name] = it.ID
	}
	return out
}

func knowledgePointNameMap(items []domain.KnowledgePoint) map[string]string {
	out := make(map[string]string, len(items))
	for _, it := range items {
		out[it.Name] = it.ID
	}
	return out
}
