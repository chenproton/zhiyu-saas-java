package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/crypto"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionAssistField 岗位 AI 辅助生成的目标字段。
type PositionAssistField string

const (
	PositionAssistPolish           PositionAssistField = "polish"           // 基础信息润色（名称/简称/简介/薪资）
	PositionAssistResponsibilities PositionAssistField = "responsibilities" // 工作职责条目
	PositionAssistRequirements     PositionAssistField = "requirements"     // 任职要求条目
	PositionAssistCareerPath       PositionAssistField = "careerPath"       // 晋升路径
	PositionAssistCertificates     PositionAssistField = "certificates"     // 证书推荐
	PositionAssistAbilities        PositionAssistField = "abilities"        // 按工作职责拆解能力点
	PositionAssistCompetency       PositionAssistField = "competency"       // 能力绑定掌握程度+胜任标准填充
)

// PositionAssistInput 岗位 AI 辅助请求的业务上下文（供提示词使用，不含 id 等无关字段）。
type PositionAssistInput struct {
	Name             string   `json:"name"`
	ShortName        string   `json:"shortName"`
	Industry         string   `json:"industry"`
	Majors           []string `json:"majors"`
	SalaryRange      [2]int   `json:"salaryRange"`
	Description      string   `json:"description"`
	Responsibilities []string `json:"responsibilities"`
	Requirements     []string `json:"requirements"`
	CareerPath       string   `json:"careerPath"`
	// abilities 字段使用：当前待拆解的工作职责名称
	ResponsibilityName string `json:"responsibilityName"`
	// competency 字段使用：现有能力绑定清单（名称/领域/属性/描述）
	Abilities []PositionAbilityContext `json:"abilities"`
}

// PositionAbilityContext 能力绑定上下文（供 competency 提示词使用）。
type PositionAbilityContext struct {
	Name        string   `json:"name"`
	Domain      string   `json:"domain"`
	Attributes  []string `json:"attributes"`
	Description string   `json:"description"`
}

// PositionPolish AI 润色的基础信息结果。
// 行业/专业为字典 ID 且已有表单选择器，不由 LLM 生成。
type PositionPolish struct {
	Name        string `json:"name"`
	ShortName   string `json:"shortName"`
	Description string `json:"description"`
	SalaryMin   int    `json:"salaryMin"`
	SalaryMax   int    `json:"salaryMax"`
}

// AISuggestedCertificate AI 推荐的证书（自由条目，不写证书库）。
type AISuggestedCertificate struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
}

// AISuggestedAbility AI 为某职责拆解的能力点（source=custom 写入绑定）。
type AISuggestedAbility struct {
	Name              string   `json:"name"`
	Domain            string   `json:"domain"`
	Attributes        []string `json:"attributes"`
	RubricDescription string   `json:"rubricDescription"`
}

// AICompetencyFill AI 为单个能力绑定填充的掌握程度与胜任标准。
type AICompetencyFill struct {
	Name              string `json:"name"`
	Level             string `json:"level"`
	RubricDescription string `json:"rubricDescription"`
}

// PositionAssistResult 岗位 AI 辅助结果：仅包含请求 field 对应的字段。
type PositionAssistResult struct {
	Field            PositionAssistField      `json:"field"`
	Polish           *PositionPolish          `json:"polish,omitempty"`
	Responsibilities []string                 `json:"responsibilities,omitempty"`
	Requirements     []string                 `json:"requirements,omitempty"`
	CareerPath       string                   `json:"careerPath,omitempty"`
	Certificates     []AISuggestedCertificate `json:"certificates,omitempty"`
	Abilities        []AISuggestedAbility     `json:"abilities,omitempty"`
	Competencies     []AICompetencyFill       `json:"competencies,omitempty"`
}

// ValidPositionAssistField 校验 field 枚举。
func ValidPositionAssistField(f PositionAssistField) bool {
	switch f {
	case PositionAssistPolish, PositionAssistResponsibilities, PositionAssistRequirements,
		PositionAssistCareerPath, PositionAssistCertificates,
		PositionAssistAbilities, PositionAssistCompetency:
		return true
	}
	return false
}

// positionAssistSystemPrompt 系统提示词：只输出 JSON，贴合岗位信息。
const positionAssistSystemPrompt = `你是一名资深的企业岗位职业标准建设专家，擅长撰写规范、专业的岗位职业描述文档。
要求：
1. 只输出 JSON，不要输出任何解释、Markdown 代码块或额外文字。
2. 所有内容使用简体中文。
3. 内容必须贴合给定的岗位名称、行业与已有描述，不要生搬硬套。
4. 不得虚构岗位信息，不得输出与岗位无关的内容。`

// positionAssistPrompt 构造单字段生成提示词（纯函数，便于测试）。
func positionAssistPrompt(field PositionAssistField, in PositionAssistInput) string {
	var task, spec string
	switch field {
	case PositionAssistPolish:
		task = "润色该岗位的基础信息：\n" +
			"1. 岗位名称：更专业规范的叫法，语义与原名称一致；\n" +
			"2. 岗位简称：简短称呼（不超过 8 字）；\n" +
			"3. 岗位简介：150 字以内的背景介绍，结合行业与岗位特点；\n" +
			"4. 参考薪资范围（元/月）：贴合行业与岗位的合理区间。"
		spec = `{"name": "string", "shortName": "string", "description": "string", "salaryMin": number, "salaryMax": number}`
	case PositionAssistResponsibilities:
		task = "将工作职责拆解为 5-8 条专业条目：每条以动词开头、一句话表述、不超过 40 字，避免重复，贴合行业特点。"
		spec = `{"responsibilities": ["string", "string", ...]}`
	case PositionAssistRequirements:
		task = "输出 5-8 条任职要求，覆盖学历专业、经验、专业技能、软素质等维度，贴合岗位与行业特点。"
		spec = `{"requirements": ["string", "string", ...]}`
	case PositionAssistCareerPath:
		task = "给出该岗位的纵向晋升路径，用 → 连接各阶段，格式如：初级工程师 → 工程师 → 高级工程师 → 专家 → 架构师 → 技术总监。"
		spec = `{"careerPath": "string"}`
	case PositionAssistCertificates:
		task = "推荐 2-3 个与该岗位相关的职业资格证书：name 为证书全称，description 为一句介绍（40 字以内），url 为证书官网地址（不确定时留空字符串）。"
		spec = `{"certificates": [{"name": "string", "description": "string", "url": "string"}]}`
	case PositionAssistAbilities:
		task = "针对「" + in.ResponsibilityName + "」这条工作职责，拆解 3-5 个岗位能力点：\n" +
			"1. name：能力点名称（名词短语，如：微服务架构设计）；\n" +
			"2. domain：所属能力领域，必须从以下枚举中选一个：岗位与行业认知 / 专业知识 / 专业技能 / 通用能力 / 职业素养/价值观；\n" +
			"3. attributes：能力属性数组，从 知识 / 素养 / 技能 中选 1 个；\n" +
			"4. rubricDescription：胜任标准描述，一句话（40 字以内），描述该能力点在本岗位的达标表现。"
		spec = `{"abilities": [{"name": "string", "domain": "string", "attributes": ["string"], "rubricDescription": "string"}]}`
	case PositionAssistCompetency:
		task = "为下方能力点清单中的每个能力点，输出：\n" +
			"1. level：掌握程度，必须从枚举中选择：understand（了解）/ comprehend（理解）/ master（掌握）/ proficient（熟练）/ expert（精通）；\n" +
			"2. rubricDescription：胜任标准描述，结合能力点与岗位，一句话（40-60 字）。"
		spec = `{"competencies": [{"name": "string", "level": "understand|comprehend|master|proficient|expert", "rubricDescription": "string"}]}`
	default:
		return ""
	}

	var b strings.Builder
	b.WriteString("岗位信息：\n")
	b.WriteString("- 岗位名称：" + in.Name + "\n")
	if in.ShortName != "" {
		b.WriteString("- 岗位简称：" + in.ShortName + "\n")
	}
	if in.Industry != "" {
		b.WriteString("- 所属行业：" + in.Industry + "\n")
	}
	if len(in.Majors) > 0 {
		b.WriteString("- 适用专业：" + strings.Join(in.Majors, "、") + "\n")
	}
	if in.SalaryRange != [2]int{} {
		b.WriteString(fmt.Sprintf("- 参考薪资：%d - %d 元/月\n", in.SalaryRange[0], in.SalaryRange[1]))
	}
	if in.Description != "" {
		b.WriteString("- 岗位简介：" + in.Description + "\n")
	}
	if len(in.Responsibilities) > 0 {
		b.WriteString("- 工作职责：\n")
		for _, r := range in.Responsibilities {
			b.WriteString("  · " + r + "\n")
		}
	}
	if len(in.Requirements) > 0 {
		b.WriteString("- 任职要求：\n")
		for _, r := range in.Requirements {
			b.WriteString("  · " + r + "\n")
		}
	}
	if in.CareerPath != "" {
		b.WriteString("- 晋升路径：" + in.CareerPath + "\n")
	}
	if field == PositionAssistCompetency && len(in.Abilities) > 0 {
		b.WriteString("- 能力点清单：\n")
		for _, a := range in.Abilities {
			b.WriteString(fmt.Sprintf("  · %s（领域：%s；属性：%s；现有描述：%s）\n",
				a.Name, a.Domain, strings.Join(a.Attributes, "/"), a.Description))
		}
	}

	b.WriteString("\n任务：" + task + "\n")
	b.WriteString("\n输出格式（严格 JSON，字段名与下方一致）：\n" + spec)
	return b.String()
}

// PositionAssist 用租户自有 AI 配置生成岗位内容建议。
// 未配置返回 ErrAINotConfigured；上游错误以 *ai.UpstreamError 透传；解析失败返回普通 error。
// 上游调用成功后 best-effort 记录 token 用量（同 Chat）。
func (s *AIService) PositionAssist(ctx context.Context, tenantID, userID string, field PositionAssistField, in PositionAssistInput) (*PositionAssistResult, error) {
	if !ValidPositionAssistField(field) {
		return nil, fmt.Errorf("service: unsupported position assist field %q", field)
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

	prompt := positionAssistPrompt(field, in)
	if prompt == "" {
		return nil, fmt.Errorf("service: unsupported position assist field %q", field)
	}
	messages := []ai.Message{
		{Role: "system", Content: positionAssistSystemPrompt},
		{Role: "user", Content: prompt},
	}
	text, usage, err := s.chatWithJSONModeFallback(ctx, ai.Config{BaseURL: cfg.BaseURL, APIKey: apiKey, Model: cfg.Model}, messages)
	if err != nil {
		return nil, err
	}
	s.recordUsage(ctx, tenantID, userID, cfg.Model, usage)

	result := &PositionAssistResult{Field: field}
	if err := parsePositionAssistOutput(field, text, result); err != nil {
		return nil, err
	}
	return result, nil
}

// chatWithJSONModeFallback 优先以 response_format json_object 请求；
// 部分 OpenAI 兼容服务不支持该参数（400/422），去掉后重试一次。
// 返回最终成功调用的用量（重试成功的返回重试那次）。
func (s *AIService) chatWithJSONModeFallback(ctx context.Context, cfg ai.Config, messages []ai.Message) (string, ai.Usage, error) {
	temperature := 0.4
	text, usage, err := s.client.ChatCompletion(ctx, cfg, ai.ChatRequest{
		Messages:       messages,
		Temperature:    &temperature,
		ResponseFormat: map[string]string{"type": "json_object"},
	})
	if err == nil {
		return text, usage, nil
	}
	var upErr *ai.UpstreamError
	if errors.As(err, &upErr) && (upErr.StatusCode == 400 || upErr.StatusCode == 422) {
		retry, retryUsage, retryErr := s.client.ChatCompletion(ctx, cfg, ai.ChatRequest{
			Messages:    messages,
			Temperature: &temperature,
		})
		if retryErr == nil {
			return retry, retryUsage, nil
		}
	}
	return "", ai.Usage{}, err
}

// extractJSONObject 从 LLM 输出中提取 JSON 对象：容忍 ```json 代码块包裹与前后说明文字。
func extractJSONObject(text string) ([]byte, error) {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "```") {
		if nl := strings.IndexByte(trimmed, '\n'); nl > 0 {
			trimmed = trimmed[nl+1:]
		}
		if end := strings.LastIndex(trimmed, "```"); end > 0 {
			trimmed = strings.TrimSpace(trimmed[:end])
		}
	}
	start := strings.IndexByte(trimmed, '{')
	end := strings.LastIndexByte(trimmed, '}')
	if start < 0 || end <= start {
		return nil, fmt.Errorf("no json object found in output")
	}
	return []byte(trimmed[start : end+1]), nil
}

// parsePositionAssistOutput 按 field 解析 LLM 输出并填充结果；空结果视为解析失败。
func parsePositionAssistOutput(field PositionAssistField, text string, result *PositionAssistResult) error {
	raw, err := extractJSONObject(text)
	if err != nil {
		return fmt.Errorf("parse position assist output: %w", err)
	}
	switch field {
	case PositionAssistPolish:
		var p PositionPolish
		if err := json.Unmarshal(raw, &p); err != nil {
			return fmt.Errorf("parse polish output: %w", err)
		}
		if strings.TrimSpace(p.Name) == "" {
			return errors.New("ai returned empty polish result")
		}
		result.Polish = &p
	case PositionAssistResponsibilities:
		var out struct {
			Items []string `json:"responsibilities"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse responsibilities output: %w", err)
		}
		result.Responsibilities = trimNonEmpty(out.Items)
		if len(result.Responsibilities) == 0 {
			return errors.New("ai returned empty responsibilities")
		}
	case PositionAssistRequirements:
		var out struct {
			Items []string `json:"requirements"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse requirements output: %w", err)
		}
		result.Requirements = trimNonEmpty(out.Items)
		if len(result.Requirements) == 0 {
			return errors.New("ai returned empty requirements")
		}
	case PositionAssistCareerPath:
		var out struct {
			Path string `json:"careerPath"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse careerPath output: %w", err)
		}
		result.CareerPath = strings.TrimSpace(out.Path)
		if result.CareerPath == "" {
			return errors.New("ai returned empty careerPath")
		}
	case PositionAssistCertificates:
		var out struct {
			Items []AISuggestedCertificate `json:"certificates"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse certificates output: %w", err)
		}
		for _, c := range out.Items {
			c.Name = strings.TrimSpace(c.Name)
			if c.Name != "" {
				result.Certificates = append(result.Certificates, c)
			}
		}
		if len(result.Certificates) == 0 {
			return errors.New("ai returned empty certificates")
		}
	case PositionAssistAbilities:
		var out struct {
			Items []AISuggestedAbility `json:"abilities"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse abilities output: %w", err)
		}
		for _, a := range out.Items {
			a.Name = strings.TrimSpace(a.Name)
			if a.Name == "" {
				continue
			}
			// 属性只保留 知识/素养/技能；领域/描述留空则清理
			a.Attributes = filterAbilityAttributes(a.Attributes)
			a.Domain = strings.TrimSpace(a.Domain)
			a.RubricDescription = strings.TrimSpace(a.RubricDescription)
			result.Abilities = append(result.Abilities, a)
		}
		if len(result.Abilities) == 0 {
			return errors.New("ai returned empty abilities")
		}
	case PositionAssistCompetency:
		var out struct {
			Items []AICompetencyFill `json:"competencies"`
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			return fmt.Errorf("parse competency output: %w", err)
		}
		for _, c := range out.Items {
			c.Name = strings.TrimSpace(c.Name)
			if c.Name == "" || !validCompetencyLevel(c.Level) {
				continue
			}
			c.RubricDescription = strings.TrimSpace(c.RubricDescription)
			result.Competencies = append(result.Competencies, c)
		}
		if len(result.Competencies) == 0 {
			return errors.New("ai returned empty competencies")
		}
	default:
		return fmt.Errorf("service: unsupported position assist field %q", field)
	}
	return nil
}

// abilityAttributeWhitelist 能力属性白名单（与前端 ABILITY_ATTRIBUTES 一致）。
var abilityAttributeWhitelist = map[string]bool{"知识": true, "素养": true, "技能": true}

func filterAbilityAttributes(items []string) []string {
	out := make([]string, 0, 1)
	for _, it := range items {
		it = strings.TrimSpace(it)
		if abilityAttributeWhitelist[it] && !containsString(out, it) {
			out = append(out, it)
		}
	}
	if len(out) == 0 {
		out = append(out, "技能")
	}
	return out
}

// validCompetencyLevel 校验掌握程度枚举。
func validCompetencyLevel(level string) bool {
	switch level {
	case "understand", "comprehend", "master", "proficient", "expert":
		return true
	}
	return false
}

func trimNonEmpty(items []string) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		it = strings.TrimSpace(it)
		if it != "" {
			out = append(out, it)
		}
	}
	return out
}
