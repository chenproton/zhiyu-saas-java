package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/zhiyu-saas/backend/internal/ai"
)

// TestPositionAssistNotConfigured 未配置 AI 的租户调用岗位辅助应返回 ErrAINotConfigured。
func TestPositionAssistNotConfigured(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	ctx := context.Background()
	_, err := svc.PositionAssist(ctx, tenantID, PositionAssistResponsibilities, PositionAssistInput{
		Name:     "Java 后端开发工程师",
		Industry: "互联网/IT",
	})
	if !errors.Is(err, ErrAINotConfigured) {
		t.Fatalf("未配置租户 PositionAssist 应返回 ErrAINotConfigured, got: %v", err)
	}
}

func TestPositionAssistInvalidField(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	_, err := svc.PositionAssist(context.Background(), tenantID, "bogus", PositionAssistInput{})
	if err == nil {
		t.Fatal("非法 field 应报错")
	}
}

func TestValidPositionAssistField(t *testing.T) {
	for _, f := range []PositionAssistField{
		PositionAssistPolish, PositionAssistResponsibilities, PositionAssistRequirements,
		PositionAssistCareerPath, PositionAssistCertificates,
		PositionAssistAbilities, PositionAssistCompetency,
	} {
		if !ValidPositionAssistField(f) {
			t.Fatalf("field %q 应为合法值", f)
		}
	}
	if ValidPositionAssistField("bogus") {
		t.Fatal("bogus 不应合法")
	}
}

// TestExtractJSONObject 提取器应容忍 markdown 包裹与前后噪声。
func TestExtractJSONObject(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "plain json",
			in:   `{"name":"测试"}`,
			want: `{"name":"测试"}`,
		},
		{
			name: "markdown fenced",
			in:   "```json\n{\"name\":\"测试\"}\n```",
			want: `{"name":"测试"}`,
		},
		{
			name: "prefixed noise",
			in:   "好的，结果如下：\n{\"name\":\"测试\"}",
			want: `{"name":"测试"}`,
		},
		{
			name: "surrounding text",
			in:   "说明文字 {\"a\":1} 结束",
			want: `{"a":1}`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := extractJSONObject(c.in)
			if err != nil {
				t.Fatalf("extractJSONObject: %v", err)
			}
			if string(got) != c.want {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
	if _, err := extractJSONObject("没有任何 json"); err == nil {
		t.Fatal("无 JSON 时应报错")
	}
}

// TestParsePositionAssistOutput 各 field 解析与空结果判定。
func TestParsePositionAssistOutput(t *testing.T) {
	cases := []struct {
		name      string
		field     PositionAssistField
		text      string
		wantField string
		wantErr   bool
	}{
		{
			name:  "polish",
			field: PositionAssistPolish,
			text:  `{"name":"后端开发工程师","shortName":"后端开发","description":"负责业务系统开发","salaryMin":15000,"salaryMax":30000}`,
		},
		{
			name:    "polish empty name",
			field:   PositionAssistPolish,
			text:    `{"name":"  ","shortName":"","description":"","salaryMin":0,"salaryMax":0}`,
			wantErr: true,
		},
		{
			name:  "responsibilities",
			field: PositionAssistResponsibilities,
			text:  "```json\n{\"responsibilities\":[\" 编写接口 \",\"\" ,\"排查问题\"]}\n```",
		},
		{
			name:    "responsibilities empty",
			field:   PositionAssistResponsibilities,
			text:    `{"responsibilities":[]}`,
			wantErr: true,
		},
		{
			name:  "requirements",
			field: PositionAssistRequirements,
			text:  `{"requirements":["本科及以上学历","熟悉 Java"]}`,
		},
		{
			name:  "careerPath",
			field: PositionAssistCareerPath,
			text:  `{"careerPath":"初级工程师 → 工程师 → 高级工程师"}`,
		},
		{
			name:    "careerPath empty",
			field:   PositionAssistCareerPath,
			text:    `{"careerPath":""}`,
			wantErr: true,
		},
		{
			name:  "certificates",
			field: PositionAssistCertificates,
			text:  `{"certificates":[{"name":"软考","description":"国家认证","url":""},{"name":"","description":"x","url":""}]}`,
		},
		{
			name:    "certificates empty",
			field:   PositionAssistCertificates,
			text:    `{"certificates":[]}`,
			wantErr: true,
		},
		{
			name:  "abilities",
			field: PositionAssistAbilities,
			text:  `{"abilities":[{"name":"微服务架构设计","domain":"专业技能","attributes":["技能","其他"],"rubricDescription":"能独立完成微服务拆分"}]}`,
		},
		{
			name:    "abilities empty",
			field:   PositionAssistAbilities,
			text:    `{"abilities":[{"name":" ","domain":"x","attributes":[],"rubricDescription":""}]}`,
			wantErr: true,
		},
		{
			name:  "competency",
			field: PositionAssistCompetency,
			text:  `{"competencies":[{"name":"微服务架构设计","level":"proficient","rubricDescription":"能独立完成架构设计"},{"name":"xx","level":"bogus","rubricDescription":"非法等级应被过滤"}]}`,
		},
		{
			name:    "competency empty",
			field:   PositionAssistCompetency,
			text:    `{"competencies":[{"name":"","level":"master","rubricDescription":""}]}`,
			wantErr: true,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := &PositionAssistResult{}
			err := parsePositionAssistOutput(c.field, c.text, result)
			if c.wantErr {
				if err == nil {
					t.Fatal("应解析失败")
				}
				return
			}
			if err != nil {
				t.Fatalf("parsePositionAssistOutput: %v", err)
			}
			// Field 由 PositionAssist 入口设置，解析函数只填充内容
			if result.Polish != nil && result.Polish.Name == "" {
				t.Fatal("polish.name 不应为空")
			}
			if len(result.Responsibilities) == 2 && (result.Responsibilities[0] != "编写接口" || result.Responsibilities[1] != "排查问题") {
				t.Fatalf("responsibilities 未去空/去噪: %v", result.Responsibilities)
			}
			if len(result.Certificates) == 1 && result.Certificates[0].Name != "软考" {
				t.Fatalf("certificates 未过滤空 name: %v", result.Certificates)
			}
			if len(result.Abilities) == 1 {
				a := result.Abilities[0]
				if a.Name != "微服务架构设计" || len(a.Attributes) != 1 || a.Attributes[0] != "技能" {
					t.Fatalf("abilities 属性过滤/字段错误: %+v", a)
				}
			}
			if len(result.Competencies) == 1 {
				c := result.Competencies[0]
				if c.Name != "微服务架构设计" || c.Level != "proficient" {
					t.Fatalf("competency 未过滤非法等级: %+v", c)
				}
			}
		})
	}
}

// TestPositionAssistPromptAbilitiesAndCompetency 新字段提示词应包含职责/能力点清单上下文。
func TestPositionAssistPromptAbilitiesAndCompetency(t *testing.T) {
	in := PositionAssistInput{
		Name:               "Java 后端开发工程师",
		Industry:           "互联网/IT",
		Description:        "负责后端服务开发",
		Responsibilities:   []string{"接口开发", "系统设计"},
		ResponsibilityName: "系统设计",
	}
	p := positionAssistPrompt(PositionAssistAbilities, in)
	for _, want := range []string{"系统设计", "岗位与行业认知", "知识 / 素养 / 技能", `"abilities"`} {
		if !strings.Contains(p, want) {
			t.Fatalf("abilities prompt 缺少 %q:\n%s", want, p)
		}
	}

	in.Abilities = []PositionAbilityContext{
		{Name: "微服务架构设计", Domain: "专业技能", Attributes: []string{"技能"}},
	}
	p2 := positionAssistPrompt(PositionAssistCompetency, in)
	for _, want := range []string{"微服务架构设计", "proficient", "expert", `"competencies"`} {
		if !strings.Contains(p2, want) {
			t.Fatalf("competency prompt 缺少 %q:\n%s", want, p2)
		}
	}
}

// TestPositionAssistPrompt 提示词应包含岗位上下文与输出规范（纯函数校验，不调 LLM）。
func TestPositionAssistPrompt(t *testing.T) {
	in := PositionAssistInput{
		Name:             "Java 后端开发工程师",
		Industry:         "互联网/IT",
		SalaryRange:      [2]int{15000, 30000},
		Description:      "负责后端服务开发",
		Responsibilities: []string{"接口开发"},
		Requirements:     []string{"本科"},
		CareerPath:       "初级 → 高级",
	}
	p := positionAssistPrompt(PositionAssistResponsibilities, in)
	for _, want := range []string{"岗位名称：Java 后端开发工程师", "所属行业：互联网/IT", "接口开发", `"responsibilities"`} {
		if !strings.Contains(p, want) {
			t.Fatalf("prompt 缺少 %q:\n%s", want, p)
		}
	}
	if positionAssistPrompt("bogus", in) != "" {
		t.Fatal("非法 field 提示词应为空")
	}
}

// TestChatWithJSONModeFallback 无 DB 时对客户端行为做冒烟（仅构造一次调用验证不 panic）。
// 说明：真实上游调用需测试账号，这里只验证方法签名可用；上游逻辑由 ai/client 单测覆盖。
func TestChatWithJSONModeFallbackSmoke(t *testing.T) {
	if os.Getenv("TEST_DATABASE_URL") == "" {
		fmt.Println("[service] TEST_DATABASE_URL not set — fallback smoke SKIPPED")
		t.Skip("TEST_DATABASE_URL not set, skipping")
	}
	_, svc, _ := setupAITest(t)
	_, err := svc.chatWithJSONModeFallback(context.Background(), ai.Config{
		BaseURL: "http://127.0.0.1:1", APIKey: "sk-test", Model: "m",
	}, []ai.Message{{Role: "user", Content: "hi"}})
	if err == nil {
		t.Fatal("不可达上游应报错")
	}
}
