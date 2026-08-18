package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
)

// TestScenarioAssistPrompt 提示词应包含场景/任务上下文与输出规范（纯函数校验，不调 LLM）。
func TestScenarioAssistPrompt(t *testing.T) {
	in := ScenarioAssistInput{
		Name:            "电商平台实战场景",
		Background:      "面向电商开发的实践场景",
		PositionName:    "后端开发工程师",
		IndustryNames:   []string{"互联网/IT"},
		ProfessionNames: []string{"软件工程"},
		TaskName:        "搭建订单服务",
		Intention:       "从前端基础到全栈实战",
	}
	p := scenarioAssistPrompt(ScenarioAssistPolish, in)
	for _, want := range []string{"电商平台实战场景", "后端开发工程师", `"difficulty"`, `"industryNames"`, `"positionName"`} {
		if !strings.Contains(p, want) {
			t.Fatalf("polish prompt 缺少 %q:\n%s", want, p)
		}
	}
	p2 := scenarioAssistPrompt(ScenarioAssistTaskChain, in)
	for _, want := range []string{"3-8 个任务", `"training|assessment"`, "用户期望"} {
		if !strings.Contains(p2, want) {
			t.Fatalf("taskChain prompt 缺少 %q:\n%s", want, p2)
		}
	}
	p3 := scenarioAssistPrompt(ScenarioAssistTaskResource, in)
	for _, want := range []string{"software（软件）", `"resources"`} {
		if !strings.Contains(p3, want) {
			t.Fatalf("taskResource prompt 缺少 %q:\n%s", want, p3)
		}
	}
	if scenarioAssistPrompt("bogus", in) != "" {
		t.Fatal("非法 field 提示词应为空")
	}
}

// TestParseScenarioAssistOutput 各 field 解析、枚举过滤与空结果判定。
func TestParseScenarioAssistOutput(t *testing.T) {
	cases := []struct {
		name    string
		field   ScenarioAssistField
		text    string
		check   func(t *testing.T, r *ScenarioAssistResult)
		wantErr bool
	}{
		{
			name:  "polish",
			field: ScenarioAssistPolish,
			text:  `{"name":"电商实战场景","background":"介绍","difficulty":4,"industryNames":["互联网/IT",""],"professionNames":["软件工程"],"positionName":" 后端开发工程师 "}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if r.Polish == nil || r.Polish.Difficulty != 4 || r.Polish.Name != "电商实战场景" {
					t.Fatalf("polish 结果错误: %+v", r.Polish)
				}
				if len(r.IndustrySuggestions) != 1 || r.IndustrySuggestions[0].Name != "互联网/IT" {
					t.Fatalf("industrySuggestions 未去空: %+v", r.IndustrySuggestions)
				}
				if r.PositionSuggestion == nil || r.PositionSuggestion.Name != "后端开发工程师" {
					t.Fatalf("positionSuggestion 未解析/去空格: %+v", r.PositionSuggestion)
				}
			},
		},
		{
			name:    "polish empty",
			field:   ScenarioAssistPolish,
			text:    `{"name":"","background":"","difficulty":0}`,
			wantErr: true,
		},
		{
			name:  "taskPolish clamps difficulty",
			field: ScenarioAssistTaskPolish,
			text:  `{"name":"搭建订单服务","background":"背景","difficulty":9}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if r.Task == nil || r.Task.Difficulty != 3 {
					t.Fatalf("taskPolish 难度应钳制为 3: %+v", r.Task)
				}
			},
		},
		{
			name:  "taskDescription",
			field: ScenarioAssistTaskDescription,
			text:  `{"description":"## 任务目标\n完成订单服务搭建"}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if !strings.Contains(r.TaskDescription, "任务目标") {
					t.Fatalf("taskDescription 错误: %q", r.TaskDescription)
				}
			},
		},
		{
			name:  "taskKnowledge",
			field: ScenarioAssistTaskKnowledge,
			text:  `{"knowledgePoints":[{"name":"数据库事务","description":"事务隔离级别"},{"name":"","description":"空名过滤"}]}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if len(r.Suggestions) != 1 || r.Suggestions[0].Name != "数据库事务" {
					t.Fatalf("taskKnowledge 未过滤空名: %+v", r.Suggestions)
				}
			},
		},
		{
			name:  "taskResource filters illegal type",
			field: ScenarioAssistTaskResource,
			text:  `{"resources":[{"name":"部署手册","type":"software","description":"x"},{"name":"坏类型","type":"hack","description":"y"}]}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if len(r.Suggestions) != 1 || r.Suggestions[0].Type != "software" {
					t.Fatalf("taskResource 未过滤非法类型: %+v", r.Suggestions)
				}
			},
		},
		{
			name:  "taskChain filters invalid entries",
			field: ScenarioAssistTaskChain,
			text:  `{"tasks":[{"name":"需求分析","type":"training","difficulty":2,"estimatedHours":4,"description":"d"},{"name":"","type":"assessment","difficulty":3,"estimatedHours":2,"description":"x"},{"name":"项目答辩","type":"assessment","difficulty":4,"estimatedHours":8,"description":"d"}]}`,
			check: func(t *testing.T, r *ScenarioAssistResult) {
				if r.Chain == nil || r.Chain.TaskCount != 2 {
					t.Fatalf("taskChain 数量错误: %+v", r.Chain)
				}
				if r.Chain.AssessmentCount != 1 || r.Chain.TrainingCount != 1 {
					t.Fatalf("taskChain 类型统计错误: %+v", r.Chain)
				}
			},
		},
		{
			name:    "taskChain empty",
			field:   ScenarioAssistTaskChain,
			text:    `{"tasks":[]}`,
			wantErr: true,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := &ScenarioAssistResult{}
			err := parseScenarioAssistOutput(c.field, c.text, r)
			if c.wantErr {
				if err == nil {
					t.Fatal("应解析失败")
				}
				return
			}
			if err != nil {
				t.Fatalf("parseScenarioAssistOutput: %v", err)
			}
			c.check(t, r)
		})
	}
}

// TestScenarioAssistPreconditions 无配置/非法 field/无岗位前置校验（不依赖 DB）。
func TestScenarioAssistPreconditions(t *testing.T) {
	svc := NewAIService(New(nil), nil, nil, "test-secret")
	ctx := context.Background()
	if _, err := svc.ScenarioAssist(ctx, "t", "u", "bogus", ScenarioAssistInput{}); err == nil {
		t.Fatal("非法 field 应报错")
	}
	if _, err := svc.ScenarioAssist(ctx, "t", "u", ScenarioAssistTaskAbility, ScenarioAssistInput{}); !errors.Is(err, ErrScenarioAssistNoPosition) {
		t.Fatalf("taskAbility 无岗位应返回 ErrScenarioAssistNoPosition, got: %v", err)
	}
}

// TestScenarioAssistPolishMatch 行业/专业建议应服务端精确匹配并回填 matchedId（引用优先）。
func TestScenarioAssistPolishMatch(t *testing.T) {
	pool, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	industryID := uuid.NewString()
	if _, err := pool.Exec(ctx,
		`INSERT INTO industries (id, tenant_id, code, name, enabled, sort_order) VALUES ($1, $2, 'IND-AI', '人工智能', true, 0)`,
		industryID, tenantID); err != nil {
		t.Fatalf("insert industry: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM industries WHERE id = $1`, industryID) })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"{\"name\":\"AI 应用实战场景\",\"background\":\"介绍\",\"difficulty\":4,\"industryNames\":[\"人工智能\",\"虚拟行业\"],\"professionNames\":[]}"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`))
	}))
	defer srv.Close()
	if err := svc.SaveConfig(ctx, tenantID, srv.URL, "sk-test-key", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	res, err := svc.ScenarioAssist(ctx, tenantID, uuid.NewString(), ScenarioAssistPolish, ScenarioAssistInput{Name: "AI 应用实战场景"})
	if err != nil {
		t.Fatalf("ScenarioAssist: %v", err)
	}
	if len(res.IndustrySuggestions) != 2 {
		t.Fatalf("industrySuggestions 数量 = %d, want 2", len(res.IndustrySuggestions))
	}
	if res.IndustrySuggestions[0].Name != "人工智能" || res.IndustrySuggestions[0].MatchedID != industryID {
		t.Fatalf("已存在行业应回填 matchedId: %+v", res.IndustrySuggestions[0])
	}
	if res.IndustrySuggestions[1].Name != "虚拟行业" || res.IndustrySuggestions[1].MatchedID != "" {
		t.Fatalf("不存在行业不应有 matchedId: %+v", res.IndustrySuggestions[1])
	}
}

// TestScenarioAssistTaskKnowledgeMatch 知识点建议应匹配现有对象回填 ID；未命中留空。
func TestScenarioAssistTaskKnowledgeMatch(t *testing.T) {
	pool, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	kpID := uuid.NewString()
	if _, err := pool.Exec(ctx,
		`INSERT INTO knowledge_points (id, tenant_id, name, linked, granular_lesson_ids) VALUES ($1, $2, '数据库事务', false, '{}')`,
		kpID, tenantID); err != nil {
		t.Fatalf("insert knowledge point: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM knowledge_points WHERE id = $1`, kpID) })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"{\"knowledgePoints\":[{\"name\":\"数据库事务\",\"description\":\"ACID\"},{\"name\":\"JVM 调优\",\"description\":\"x\"}]}"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`))
	}))
	defer srv.Close()
	if err := svc.SaveConfig(ctx, tenantID, srv.URL, "sk-test-key", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	res, err := svc.ScenarioAssist(ctx, tenantID, uuid.NewString(), ScenarioAssistTaskKnowledge, ScenarioAssistInput{TaskName: "订单服务开发"})
	if err != nil {
		t.Fatalf("ScenarioAssist: %v", err)
	}
	if len(res.Suggestions) != 2 {
		t.Fatalf("suggestions 数量 = %d, want 2", len(res.Suggestions))
	}
	if res.Suggestions[0].MatchedID != kpID {
		t.Fatalf("已存在知识点应回填 matchedId: %+v", res.Suggestions[0])
	}
	if res.Suggestions[1].MatchedID != "" {
		t.Fatalf("未命中知识点 matchedId 应为空: %+v", res.Suggestions[1])
	}
}

// TestScenarioAssistRepairRetry 上游首次输出非 JSON 时应追加修复指令重试一次并成功，
// 且两次成功调用的 token 用量都应落库。
func TestScenarioAssistRepairRetry(t *testing.T) {
	pool, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if calls.Add(1) == 1 {
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"抱歉我无法输出 JSON"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`))
			return
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"{\"description\":\"## 任务目标\\n完成订单服务搭建\"}"}}],"usage":{"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}}`))
	}))
	defer srv.Close()
	if err := svc.SaveConfig(ctx, tenantID, srv.URL, "sk-test-key", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	res, err := svc.ScenarioAssist(ctx, tenantID, uuid.NewString(), ScenarioAssistTaskDescription, ScenarioAssistInput{TaskName: "订单服务"})
	if err != nil {
		t.Fatalf("ScenarioAssist（修复重试后）应成功: %v", err)
	}
	if !strings.Contains(res.TaskDescription, "任务目标") {
		t.Fatalf("taskDescription 错误: %q", res.TaskDescription)
	}
	if calls.Load() != 2 {
		t.Fatalf("上游调用次数 = %d, want 2", calls.Load())
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM ai_usage_logs WHERE tenant_id = $1`, tenantID).Scan(&count); err != nil {
		t.Fatalf("query usage logs: %v", err)
	}
	if count != 2 {
		t.Fatalf("usage logs 条数 = %d, want 2", count)
	}
}

// TestScenarioAssistTaskAbilityNoPositionIntegration 未关联岗位时 handler 前置错误在 service 层同样生效。
func TestScenarioAssistTaskAbilityNoPositionIntegration(t *testing.T) {
	if os.Getenv("TEST_DATABASE_URL") == "" {
		fmt.Println("[service] TEST_DATABASE_URL not set — integration SKIPPED")
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	_, svc, tenantID := setupAITest(t)
	_, err := svc.ScenarioAssist(context.Background(), tenantID, "user-1", ScenarioAssistTaskAbility, ScenarioAssistInput{})
	if !errors.Is(err, ErrScenarioAssistNoPosition) {
		t.Fatalf("应返回 ErrScenarioAssistNoPosition, got: %v", err)
	}
}
