package service

import (
	"strings"
	"testing"
)

// stringsSlice 构造 n 条内容为 s 的字符串切片（护栏条目数边界测试用）。
func stringsSlice(n int, s string) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = s
	}
	return out
}

// abilitySlice 构造 n 条合法能力点上下文（护栏条目数边界测试用）。
func abilitySlice(n int) []PositionAbilityContext {
	out := make([]PositionAbilityContext, n)
	for i := range out {
		out[i] = PositionAbilityContext{Name: "能力点", Domain: "专业技能", Description: "描述"}
	}
	return out
}

// existingTasksSlice 构造 n 条合法现有任务（护栏条目数边界测试用）。
func existingTasksSlice(n int) []ScenarioExistingTask {
	out := make([]ScenarioExistingTask, n)
	for i := range out {
		out[i] = ScenarioExistingTask{Name: "任务", Type: "training", Difficulty: 3}
	}
	return out
}

// TestValidatePositionAssistInput 岗位上下文护栏：条目数/单条长度/边界值。
func TestValidatePositionAssistInput(t *testing.T) {
	long := strings.Repeat("a", AIPositionMaxTextSize+1)
	atLimit := strings.Repeat("a", AIPositionMaxTextSize)

	cases := []struct {
		name    string
		in      PositionAssistInput
		wantErr bool
	}{
		{name: "空输入通过", in: PositionAssistInput{}},
		{name: "Name 恰为上限通过", in: PositionAssistInput{Name: atLimit}},
		{name: "Name 超长拒绝", in: PositionAssistInput{Name: long}, wantErr: true},
		{name: "ShortName 超长拒绝", in: PositionAssistInput{ShortName: long}, wantErr: true},
		{name: "Industry 超长拒绝", in: PositionAssistInput{Industry: long}, wantErr: true},
		{name: "Description 超长拒绝", in: PositionAssistInput{Description: long}, wantErr: true},
		{name: "CareerPath 超长拒绝", in: PositionAssistInput{CareerPath: long}, wantErr: true},
		{name: "ResponsibilityName 超长拒绝", in: PositionAssistInput{ResponsibilityName: long}, wantErr: true},
		{name: "Majors 条数恰为上限通过", in: PositionAssistInput{Majors: stringsSlice(AIPositionMaxItems, "专业")}},
		{name: "Majors 条数超限拒绝", in: PositionAssistInput{Majors: stringsSlice(AIPositionMaxItems+1, "专业")}, wantErr: true},
		{name: "单条 Majors 超长拒绝", in: PositionAssistInput{Majors: []string{"正常", long}}, wantErr: true},
		{name: "Responsibilities 条数超限拒绝", in: PositionAssistInput{Responsibilities: stringsSlice(AIPositionMaxItems+1, "职责")}, wantErr: true},
		{name: "单条 Requirements 超长拒绝", in: PositionAssistInput{Requirements: []string{long}}, wantErr: true},
		{name: "Abilities 条数恰为上限通过", in: PositionAssistInput{Abilities: abilitySlice(AIPositionMaxItems)}},
		{name: "Abilities 条数超限拒绝", in: PositionAssistInput{Abilities: abilitySlice(AIPositionMaxItems + 1)}, wantErr: true},
		{name: "Ability.Name 超长拒绝", in: PositionAssistInput{Abilities: []PositionAbilityContext{{Name: long}}}, wantErr: true},
		{name: "Ability.Domain 超长拒绝", in: PositionAssistInput{Abilities: []PositionAbilityContext{{Domain: long}}}, wantErr: true},
		{name: "Ability.Description 超长拒绝", in: PositionAssistInput{Abilities: []PositionAbilityContext{{Description: long}}}, wantErr: true},
		{name: "Attributes 条数超限拒绝", in: PositionAssistInput{Abilities: []PositionAbilityContext{{Attributes: stringsSlice(AIPositionMaxItems+1, "技能")}}}, wantErr: true},
		{name: "单条 Attribute 超长拒绝", in: PositionAssistInput{Abilities: []PositionAbilityContext{{Attributes: []string{"技能", long}}}}, wantErr: true},
		{
			name: "全字段边界通过",
			in: PositionAssistInput{
				Name: atLimit, ShortName: atLimit, Industry: atLimit, Description: atLimit,
				CareerPath: atLimit, ResponsibilityName: atLimit,
				Majors:           stringsSlice(AIPositionMaxItems, "专业"),
				Responsibilities: stringsSlice(AIPositionMaxItems, "职责"),
				Requirements:     stringsSlice(AIPositionMaxItems, "要求"),
				Abilities: []PositionAbilityContext{
					{Name: atLimit, Domain: atLimit, Description: atLimit, Attributes: stringsSlice(AIPositionMaxItems, "技能")},
				},
			},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidatePositionAssistInput(c.in)
			if c.wantErr && err == nil {
				t.Fatal("应校验失败")
			}
			if !c.wantErr && err != nil {
				t.Fatalf("不应校验失败: %v", err)
			}
		})
	}
}

// TestValidScenarioAssistField 场景 field 枚举校验：合法返回 true、非法返回 false。
func TestValidScenarioAssistField(t *testing.T) {
	for _, f := range []ScenarioAssistField{
		ScenarioAssistPolish, ScenarioAssistTaskPolish, ScenarioAssistTaskDescription,
		ScenarioAssistTaskKnowledge, ScenarioAssistTaskAbility, ScenarioAssistTaskResource,
		ScenarioAssistTaskChain,
	} {
		if !ValidScenarioAssistField(f) {
			t.Fatalf("field %q 应为合法值", f)
		}
	}
	for _, f := range []ScenarioAssistField{"", "bogus", "Polish", "taskchain", "task_chain"} {
		if ValidScenarioAssistField(f) {
			t.Fatalf("field %q 不应合法", f)
		}
	}
}

// TestValidateScenarioAssistInput 场景上下文护栏：文本长度/条目数/任务类型枚举/边界值。
func TestValidateScenarioAssistInput(t *testing.T) {
	long := strings.Repeat("a", AIScenarioMaxTextSize+1)
	atLimit := strings.Repeat("a", AIScenarioMaxTextSize)

	cases := []struct {
		name    string
		in      ScenarioAssistInput
		wantErr bool
	}{
		{name: "空输入通过", in: ScenarioAssistInput{}},
		{name: "Name 超长拒绝", in: ScenarioAssistInput{Name: long}, wantErr: true},
		{name: "Background 超长拒绝", in: ScenarioAssistInput{Background: long}, wantErr: true},
		{name: "TaskName 超长拒绝", in: ScenarioAssistInput{TaskName: long}, wantErr: true},
		{name: "TaskDescription 超长拒绝", in: ScenarioAssistInput{TaskDescription: long}, wantErr: true},
		{name: "PositionName 超长拒绝", in: ScenarioAssistInput{PositionName: long}, wantErr: true},
		{name: "行业/专业合计恰为上限通过", in: ScenarioAssistInput{IndustryNames: stringsSlice(AIScenarioMaxSuggestionLen, "行业")}},
		{name: "行业/专业合计超限拒绝", in: ScenarioAssistInput{
			IndustryNames:   stringsSlice(AIScenarioMaxSuggestionLen-1, "行业"),
			ProfessionNames: stringsSlice(2, "专业"),
		}, wantErr: true},
		{name: "单条行业名称超长拒绝", in: ScenarioAssistInput{IndustryNames: []string{long}}, wantErr: true},
		{name: "单条专业名称超长拒绝", in: ScenarioAssistInput{ProfessionNames: []string{long}}, wantErr: true},
		{name: "现有任务恰为上限通过", in: ScenarioAssistInput{ExistingTasks: existingTasksSlice(AIScenarioMaxChainTasks)}},
		{name: "现有任务超限拒绝", in: ScenarioAssistInput{ExistingTasks: existingTasksSlice(AIScenarioMaxChainTasks + 1)}, wantErr: true},
		{name: "单条任务名称超长拒绝", in: ScenarioAssistInput{
			ExistingTasks: []ScenarioExistingTask{{Name: long, Type: "training", Difficulty: 3}},
		}, wantErr: true},
		{name: "任务类型为空拒绝", in: ScenarioAssistInput{
			ExistingTasks: []ScenarioExistingTask{{Name: "任务", Difficulty: 3}},
		}, wantErr: true},
		{name: "任务类型非法拒绝", in: ScenarioAssistInput{
			ExistingTasks: []ScenarioExistingTask{{Name: "任务", Type: "bogus", Difficulty: 3}},
		}, wantErr: true},
		{name: "Intention 恰为上限通过", in: ScenarioAssistInput{Intention: strings.Repeat("a", AIScenarioMaxIntentionLen)}},
		{name: "Intention 超长拒绝", in: ScenarioAssistInput{Intention: strings.Repeat("a", AIScenarioMaxIntentionLen+1)}, wantErr: true},
		{
			name: "全字段边界通过",
			in: ScenarioAssistInput{
				Name: atLimit, Background: atLimit, TaskName: atLimit, TaskBackground: atLimit,
				TaskDescription: atLimit, PositionName: atLimit,
				IndustryNames:   stringsSlice(AIScenarioMaxSuggestionLen/2, "行业"),
				ProfessionNames: stringsSlice(AIScenarioMaxSuggestionLen/2, "专业"),
				ExistingTasks:   existingTasksSlice(AIScenarioMaxChainTasks),
				Intention:       strings.Repeat("a", AIScenarioMaxIntentionLen),
			},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidateScenarioAssistInput(c.in)
			if c.wantErr && err == nil {
				t.Fatal("应校验失败")
			}
			if !c.wantErr && err != nil {
				t.Fatalf("不应校验失败: %v", err)
			}
		})
	}
}
