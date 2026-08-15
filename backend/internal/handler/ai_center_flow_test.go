package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// AI 智能服务中心集成测试（docs/spec/ai-service-center.md §3/§5）。
// 覆盖：知识库生命周期与可见性矩阵、协作者共建、审核上架、广场、收藏、
// 智能体对话 SSE（mock 上游）、§2.2 检索越权防线（私有库不泄露）。

const (
	aiTestOwnerID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11"
	aiTestOtherID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12"
	aiTestAdminID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13"
	aiTestXTenantID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01" // 跨租户用户
	aiTestXTenant   = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02"
)

func aiSeedUsers(t *testing.T, env *testhelper.TestEnv) {
	t.Helper()
	ctx := context.Background()
	// 清理历史测试残留（FK 引用方先删）
	for _, tbl := range []string{
		"ai_review_logs", "ai_messages", "ai_conversations", "ai_agent_kbs", "ai_agents",
		"ai_kb_collaborators", "ai_kb_chunks", "ai_kb_documents", "ai_knowledge_bases", "ai_integrations",
	} {
		env.DB.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id IN ($1,$2)", testhelper.TestTenantID, aiTestXTenant)
	}
	env.DB.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'X Tenant', 'xtest', 'active') ON CONFLICT (id) DO NOTHING`, aiTestXTenant)

	insert := func(id, tenantID, username, name string) {
		env.DB.Exec(ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, password_changed_at)
			VALUES ($1, $2, 'school', 'portal', $3, $4, 'x', $5, 'active', '{}', NOW() - interval '1 day')
			ON CONFLICT (id) DO NOTHING
		`, id, tenantID, username, username, name)
	}
	insert(aiTestOwnerID, testhelper.TestTenantID, "aiowner", "AI 拥有者")
	insert(aiTestOtherID, testhelper.TestTenantID, "aiother", "AI 旁观者")
	insert(aiTestAdminID, testhelper.TestTenantID, "aiadmin", "AI 管理员")
	insert(aiTestXTenantID, aiTestXTenant, "aixuser", "跨租户用户")
}

func aiTokens(env *testhelper.TestEnv) (owner, other, admin, xtenant string) {
	owner = env.NewTokenWithIdentity(aiTestOwnerID, testhelper.TestTenantID, domain.UserRoleSchool, nil, domain.RoleTeacher)
	other = env.NewTokenWithIdentity(aiTestOtherID, testhelper.TestTenantID, domain.UserRoleSchool, nil, domain.RoleStudent)
	admin = env.NewTokenWithIdentity(aiTestAdminID, testhelper.TestTenantID, domain.UserRoleSchool, nil, domain.RoleSchoolAdmin)
	xtenant = env.NewTokenWithIdentity(aiTestXTenantID, aiTestXTenant, domain.UserRoleSchool, nil, domain.RoleTeacher)
	return
}

// TestAICenter_KBLifecycleAndVisibility 知识库生命周期 + 可见性矩阵 + 审核上架 + 收藏。
func TestAICenter_KBLifecycleAndVisibility(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	aiSeedUsers(t, env)
	owner, other, admin, xtenant := aiTokens(env)

	// 创建（owner）
	w := env.DoWithToken("POST", "/api/v1/ai/kb", map[string]any{
		"name": "学生手册知识库", "description": "校规校纪", "tags": []string{"制度"},
	}, owner)
	if w.Code != http.StatusCreated {
		t.Fatalf("create kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	kb, _ := testhelper.Unmarshal[domain.AIKnowledgeBase](w)
	if kb.Status != "private" {
		t.Fatalf("new kb should be private, got %s", kb.Status)
	}

	// 私有可见性：other 404，跨租户 404
	if w := env.DoWithToken("GET", "/api/v1/ai/kb/"+kb.ID, nil, other); w.Code != http.StatusNotFound {
		t.Fatalf("private kb should be 404 for other, got %d", w.Code)
	}
	if w := env.DoWithToken("GET", "/api/v1/ai/kb/"+kb.ID, nil, xtenant); w.Code != http.StatusNotFound {
		t.Fatalf("private kb should be 404 cross-tenant, got %d: %s", w.Code, w.Body.String())
	}

	// 协作者：owner 邀请 other 为 viewer → other 可读不可写
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/collaborators", kb.ID), map[string]string{
		"userId": aiTestOtherID, "role": "viewer",
	}, owner); w.Code != http.StatusOK {
		t.Fatalf("add collaborator: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/kb/"+kb.ID, nil, other)
	if w.Code != http.StatusOK {
		t.Fatalf("collaborator should see kb, got %d", w.Code)
	}
	kbView, _ := testhelper.Unmarshal[domain.AIKnowledgeBase](w)
	if kbView.MyRole != "viewer" {
		t.Fatalf("expected myRole=viewer, got %s", kbView.MyRole)
	}
	// 列表（scope=collaborating）同样返回真实协作角色
	w = env.DoWithToken("GET", "/api/v1/ai/kb?scope=collaborating", nil, other)
	listResp, _ := testhelper.Unmarshal[map[string]any](w)
	if items, _ := listResp["items"].([]any); len(items) != 1 {
		t.Fatalf("collaborating list should have 1 item, got %d", len(items))
	} else if role, _ := items[0].(map[string]any)["myRole"].(string); role != "viewer" {
		t.Fatalf("list myRole should be viewer, got %s", role)
	}
	if w := env.DoWithToken("PUT", "/api/v1/ai/kb/"+kb.ID, map[string]string{"name": "篡改"}, other); w.Code != http.StatusForbidden {
		t.Fatalf("viewer must not edit kb, got %d", w.Code)
	}
	// owner 不能被加为协作者
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/collaborators", kb.ID), map[string]string{
		"userId": aiTestOwnerID, "role": "editor",
	}, owner); w.Code != http.StatusBadRequest {
		t.Fatalf("owner as collaborator should 400, got %d", w.Code)
	}
	// PUT 改角色走路径 userId（不读 body）；改后 editor 可编辑
	if w := env.DoWithToken("PUT", fmt.Sprintf("/api/v1/ai/kb/%s/collaborators/%s", kb.ID, aiTestOtherID), map[string]string{
		"role": "editor",
	}, owner); w.Code != http.StatusOK {
		t.Fatalf("update collaborator role via path: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	if w := env.DoWithToken("PUT", "/api/v1/ai/kb/"+kb.ID, map[string]string{"name": "学生手册知识库"}, other); w.Code != http.StatusOK {
		t.Fatalf("editor should edit kb after role change, got %d", w.Code)
	}
	// 改回 viewer 保持后续断言语义
	env.DoWithToken("PUT", fmt.Sprintf("/api/v1/ai/kb/%s/collaborators/%s", kb.ID, aiTestOtherID), map[string]string{
		"role": "viewer",
	}, owner)

	// 提交审核 → pending；广场不可见
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/submit", kb.ID), nil, owner); w.Code != http.StatusOK {
		t.Fatalf("submit kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/square/kbs?q=学生手册", nil, other)
	sq, _ := testhelper.Unmarshal[map[string]any](w)
	if total, _ := sq["total"].(float64); total != 0 {
		t.Fatalf("pending kb must not appear in square, total=%v", total)
	}

	// 学生不能审核（RequireRole school_admin）
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/reviews/kb/%s/approve", kb.ID), nil, other); w.Code != http.StatusForbidden {
		t.Fatalf("student review should 403, got %d", w.Code)
	}

	// 管理员驳回（无理由 → 400；有理由 → rejected）
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/reviews/kb/%s/reject", kb.ID), map[string]string{"comment": ""}, admin); w.Code != http.StatusBadRequest {
		t.Fatalf("reject without comment should 400, got %d", w.Code)
	}
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/reviews/kb/%s/reject", kb.ID), map[string]string{"comment": "内容需完善"}, admin); w.Code != http.StatusOK {
		t.Fatalf("reject kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/kb/"+kb.ID, nil, owner)
	kb2, _ := testhelper.Unmarshal[domain.AIKnowledgeBase](w)
	if kb2.Status != "rejected" || kb2.ReviewComment != "内容需完善" {
		t.Fatalf("expected rejected+comment, got %s/%s", kb2.Status, kb2.ReviewComment)
	}

	// 重新提交 → 通过 → published → 广场可见 + 可收藏
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/submit", kb.ID), nil, owner); w.Code != http.StatusOK {
		t.Fatalf("resubmit kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/reviews/kb/%s/approve", kb.ID), nil, admin); w.Code != http.StatusOK {
		t.Fatalf("approve kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/square/kbs?q=学生手册", nil, other)
	sq, _ = testhelper.Unmarshal[map[string]any](w)
	if total, _ := sq["total"].(float64); total != 1 {
		t.Fatalf("published kb should appear in square, total=%v", total)
	}
	w = env.DoWithToken("POST", "/api/v1/favorites/ai_kb/"+kb.ID, nil, other)
	if w.Code != http.StatusOK {
		t.Fatalf("favorite published kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 下架 → 广场消失；删除仅 draft/rejected 可删（published 不可删）
	if w := env.DoWithToken("DELETE", "/api/v1/ai/kb/"+kb.ID, nil, owner); w.Code != http.StatusConflict {
		t.Fatalf("published kb delete should 409, got %d", w.Code)
	}
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/unpublish", kb.ID), nil, owner); w.Code != http.StatusOK {
		t.Fatalf("unpublish kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/square/kbs?q=学生手册", nil, other)
	sq, _ = testhelper.Unmarshal[map[string]any](w)
	if total, _ := sq["total"].(float64); total != 0 {
		t.Fatalf("unpublished kb must leave square, total=%v", total)
	}
	if w := env.DoWithToken("DELETE", "/api/v1/ai/kb/"+kb.ID, nil, owner); w.Code != http.StatusOK {
		t.Fatalf("delete private kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
}

// mockAISSEServer 返回 SSE 流式响应的 mock 上游。
func mockAISSEServer(t *testing.T, reply string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			http.Error(w, "not found", 404)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\n", reply)
		fmt.Fprint(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15}}\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
}

// TestAICenter_AgentChatStream 智能体 SSE 对话 + §2.2 私有库泄露防线。
func TestAICenter_AgentChatStream(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	aiSeedUsers(t, env)
	owner, other, admin, xtenant := aiTokens(env)
	ctx := context.Background()

	upstream := mockAISSEServer(t, "这是来自知识库的回答")
	defer upstream.Close()

	// 配置租户 AI（school_admin 经 systemAdmin 组）
	w := env.DoWithToken("PUT", "/api/v1/ai/config", map[string]string{
		"baseUrl": upstream.URL, "apiKey": "sk-testkey123456", "model": "test-model",
	}, admin)
	if w.Code != http.StatusOK {
		t.Fatalf("save ai config: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// owner 建私有库 + 直接落 ready 文档与分块（绕过解析流水线，检索锚点测试聚焦可见性过滤）
	w = env.DoWithToken("POST", "/api/v1/ai/kb", map[string]any{"name": "奖学金私有库"}, owner)
	if w.Code != http.StatusCreated {
		t.Fatalf("create kb: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	kb, _ := testhelper.Unmarshal[domain.AIKnowledgeBase](w)
	var docID string
	err := env.DB.QueryRow(ctx, `
		INSERT INTO ai_kb_documents (tenant_id, kb_id, uploader_id, name, file_path, status, chunk_count)
		VALUES ($1, $2, $3, '奖学金办法.pdf', '/tmp/x.pdf', 'ready', 1) RETURNING id
	`, testhelper.TestTenantID, kb.ID, aiTestOwnerID).Scan(&docID)
	if err != nil {
		t.Fatalf("insert doc: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO ai_kb_chunks (tenant_id, doc_id, kb_id, seq, content)
		VALUES ($1, $2, $3, 1, '奖学金申请条件如下：绩点需达到 3.5 以上，且无不及格科目。')
	`, testhelper.TestTenantID, docID, kb.ID); err != nil {
		t.Fatalf("insert chunk: %v", err)
	}

	// owner 建智能体关联私有库 → 提交（应带 warnings）→ 管理员通过
	w = env.DoWithToken("POST", "/api/v1/ai/agents", map[string]any{
		"name": "奖学金助手", "systemPrompt": "你是奖学金政策答疑助手", "kbIds": []string{kb.ID},
	}, owner)
	if w.Code != http.StatusCreated {
		t.Fatalf("create agent: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	agent, _ := testhelper.Unmarshal[domain.AIAgent](w)

	// other 不可见私有智能体
	if w := env.DoWithToken("GET", "/api/v1/ai/agents/"+agent.ID, nil, other); w.Code != http.StatusNotFound {
		t.Fatalf("private agent should 404 for other, got %d", w.Code)
	}
	// 存在性探测防线：私有智能体的会话列表对非 owner 也是 404（不是 200 空列表）
	if w := env.DoWithToken("GET", fmt.Sprintf("/api/v1/ai/agents/%s/conversations", agent.ID), nil, other); w.Code != http.StatusNotFound {
		t.Fatalf("private agent conversations should 404 for other, got %d", w.Code)
	}
	// 关联库护栏：>5 个 → 400（不是 500）
	if w := env.DoWithToken("POST", "/api/v1/ai/agents", map[string]any{
		"name": "超限助手", "systemPrompt": "x", "kbIds": []string{kb.ID, kb.ID, kb.ID, kb.ID, kb.ID, kb.ID},
	}, owner); w.Code != http.StatusBadRequest {
		t.Fatalf(">5 kb links should 400, got %d", w.Code)
	}

	w = env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/agents/%s/submit", agent.ID), nil, owner)
	if w.Code != http.StatusOK {
		t.Fatalf("submit agent: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	submitResp, _ := testhelper.Unmarshal[map[string]any](w)
	if warns, _ := submitResp["warnings"].([]any); len(warns) == 0 {
		t.Fatalf("submit with private kb should return warnings")
	}
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/reviews/agent/%s/approve", agent.ID), nil, admin); w.Code != http.StatusOK {
		t.Fatalf("approve agent: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// ★ 泄露防线：other 对话已发布智能体，关联的是 owner 的私有库 → 不得召回 → 无 sources 事件
	w = env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/agents/%s/chat", agent.ID), map[string]string{
		"message": "奖学金申请条件是什么",
	}, other)
	if w.Code != http.StatusOK {
		t.Fatalf("agent chat: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	body := w.Body.String()
	if !strings.Contains(body, "event: meta") || !strings.Contains(body, "event: delta") || !strings.Contains(body, "这是来自知识库的回答") {
		t.Fatalf("SSE stream incomplete: %s", body)
	}
	if strings.Contains(body, "event: sources") {
		t.Fatalf("LEAK: other user got sources from owner's private kb: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Fatalf("missing done event: %s", body)
	}

	// owner 对话：可见自己的私有库 → sources 事件应出现
	w = env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/agents/%s/chat", agent.ID), map[string]string{
		"message": "奖学金申请条件是什么",
	}, owner)
	if w.Code != http.StatusOK {
		t.Fatalf("owner chat: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	if !strings.Contains(w.Body.String(), "event: sources") || !strings.Contains(w.Body.String(), "奖学金办法.pdf") {
		t.Fatalf("owner should get sources from own kb: %s", w.Body.String())
	}

	// 会话持久化：other 拉取自己的会话列表与消息
	w = env.DoWithToken("GET", fmt.Sprintf("/api/v1/ai/agents/%s/conversations", agent.ID), nil, other)
	convs, _ := testhelper.Unmarshal[map[string]any](w)
	items, _ := convs["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected 1 conversation, got %d", len(items))
	}
	convID := items[0].(map[string]any)["id"].(string)
	w = env.DoWithToken("GET", "/api/v1/ai/conversations/"+convID, nil, other)
	detail, _ := testhelper.Unmarshal[map[string]any](w)
	msgs, _ := detail["messages"].([]any)
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages (user+assistant), got %d", len(msgs))
	}
	// 他人会话不可读
	if w := env.DoWithToken("GET", "/api/v1/ai/conversations/"+convID, nil, owner); w.Code != http.StatusForbidden {
		t.Fatalf("conversation should 403 for non-owner, got %d", w.Code)
	}

	// 跨租户不可见已发布智能体
	if w := env.DoWithToken("GET", "/api/v1/ai/agents/"+agent.ID, nil, xtenant); w.Code != http.StatusNotFound {
		t.Fatalf("cross-tenant agent should 404, got %d", w.Code)
	}

	// 智能体计数
	var chatCount int64
	if err := env.DB.QueryRow(ctx, `SELECT chat_count FROM ai_agents WHERE id = $1`, agent.ID).Scan(&chatCount); err != nil || chatCount != 2 {
		t.Fatalf("chat_count should be 2, got %d (err=%v)", chatCount, err)
	}
	// 私有库 ask_count 只被 owner 那次对话增加
	var askCount int64
	if err := env.DB.QueryRow(ctx, `SELECT ask_count FROM ai_knowledge_bases WHERE id = $1`, kb.ID).Scan(&askCount); err != nil || askCount != 1 {
		t.Fatalf("ask_count should be 1 (owner only), got %d (err=%v)", askCount, err)
	}
}

// TestAICenter_AdminIntegrations 第三方挂接 CRUD + 上下架 + URL 白名单。
func TestAICenter_AdminIntegrations(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	aiSeedUsers(t, env)
	_, other, admin, _ := aiTokens(env)

	// 学生不可管理
	if w := env.DoWithToken("POST", "/api/v1/ai/admin/integrations", map[string]any{
		"kind": "app", "name": "X", "url": "https://x.com",
	}, other); w.Code != http.StatusForbidden {
		t.Fatalf("student manage integrations should 403, got %d", w.Code)
	}

	// javascript: URL 拒绝
	if w := env.DoWithToken("POST", "/api/v1/ai/admin/integrations", map[string]any{
		"kind": "app", "name": "XSS", "url": "javascript:alert(1)",
	}, admin); w.Code != http.StatusBadRequest {
		t.Fatalf("javascript url should 400, got %d", w.Code)
	}

	// 创建 → 广场可见 → 下架 → 广场不可见
	w := env.DoWithToken("POST", "/api/v1/ai/admin/integrations", map[string]any{
		"kind": "app", "name": "Dify 平台", "url": "https://dify.example.com", "icon": "🤖", "sort": 1,
	}, admin)
	if w.Code != http.StatusCreated {
		t.Fatalf("create integration: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	it, _ := testhelper.Unmarshal[domain.AIIntegration](w)

	w = env.DoWithToken("GET", "/api/v1/ai/integrations?kind=app", nil, other)
	list, _ := testhelper.Unmarshal[map[string]any](w)
	if items, _ := list["items"].([]any); len(items) != 1 {
		t.Fatalf("square should list active integration, got %d", len(items))
	}

	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/admin/integrations/%s/toggle", it.ID), map[string]string{"status": "inactive"}, admin); w.Code != http.StatusOK {
		t.Fatalf("toggle off: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	w = env.DoWithToken("GET", "/api/v1/ai/integrations?kind=app", nil, other)
	list, _ = testhelper.Unmarshal[map[string]any](w)
	if items, _ := list["items"].([]any); len(items) != 0 {
		t.Fatalf("inactive integration must leave square, got %d", len(items))
	}
}

// TestAICenter_KBAsk 知识库库内问答（SSE + 溯源 + 限私有可见）。
func TestAICenter_KBAsk(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	aiSeedUsers(t, env)
	owner, other, admin, _ := aiTokens(env)
	ctx := context.Background()

	upstream := mockAISSEServer(t, "请假需提前三天")
	defer upstream.Close()
	if w := env.DoWithToken("PUT", "/api/v1/ai/config", map[string]string{
		"baseUrl": upstream.URL, "apiKey": "sk-testkey123456", "model": "test-model",
	}, admin); w.Code != http.StatusOK {
		t.Fatalf("save ai config: %d", w.Code)
	}

	w := env.DoWithToken("POST", "/api/v1/ai/kb", map[string]any{"name": "制度库"}, owner)
	kb, _ := testhelper.Unmarshal[domain.AIKnowledgeBase](w)
	var docID string
	if err := env.DB.QueryRow(ctx, `
		INSERT INTO ai_kb_documents (tenant_id, kb_id, uploader_id, name, file_path, status, chunk_count)
		VALUES ($1, $2, $3, '学生手册.pdf', '/tmp/y.pdf', 'ready', 1) RETURNING id
	`, testhelper.TestTenantID, kb.ID, aiTestOwnerID).Scan(&docID); err != nil {
		t.Fatalf("insert doc: %v", err)
	}
	env.DB.Exec(ctx, `
		INSERT INTO ai_kb_chunks (tenant_id, doc_id, kb_id, seq, content)
		VALUES ($1, $2, $3, 2, '请假流程：学生需提前三天在系统提交申请，由辅导员审批。')
	`, testhelper.TestTenantID, docID, kb.ID)

	// other 对私有库 ask → 404
	if w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/ask", kb.ID), map[string]string{"message": "怎么请假"}, other); w.Code != http.StatusNotFound {
		t.Fatalf("private kb ask should 404, got %d", w.Code)
	}

	// owner ask → SSE 含 sources（含文档名与段号）
	w = env.DoWithToken("POST", fmt.Sprintf("/api/v1/ai/kb/%s/ask", kb.ID), map[string]string{"message": "请假流程是什么"}, owner)
	if w.Code != http.StatusOK {
		t.Fatalf("kb ask: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	body := w.Body.String()
	if !strings.Contains(body, "event: sources") || !strings.Contains(body, "学生手册.pdf") || !strings.Contains(body, "event: delta") {
		t.Fatalf("kb ask SSE incomplete: %s", body)
	}
}

// 防止未使用导入告警（time 预留给后续断言时间字段）。
var _ = time.Now

// TestAICenter_EmptyListsReturnEmptyArray 回归：空列表必须序列化为 [] 而非 null
// （Go nil slice → JSON null，前端 items.length 直接崩；本次事故根因）。
func TestAICenter_EmptyListsReturnEmptyArray(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	aiSeedUsers(t, env)
	owner, _, admin, _ := aiTokens(env)

	endpoints := []struct {
		path  string
		token string
	}{
		{"/api/v1/ai/kb", owner},
		{"/api/v1/ai/kb?scope=collaborating", owner},
		{"/api/v1/ai/agents", owner},
		{"/api/v1/ai/square/kbs", owner},
		{"/api/v1/ai/square/agents", owner},
		{"/api/v1/ai/integrations", owner},
		{"/api/v1/ai/admin/reviews?type=kb", admin},
		{"/api/v1/ai/admin/reviews?type=agent", admin},
		{"/api/v1/ai/admin/integrations", admin},
	}
	for _, ep := range endpoints {
		w := env.DoWithToken("GET", ep.path, nil, ep.token)
		if w.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", ep.path, w.Code, testhelper.ErrMsg(w))
		}
		resp, _ := testhelper.Unmarshal[map[string]any](w)
		items, ok := resp["items"].([]any)
		if !ok || items == nil {
			t.Fatalf("%s: items must be [] not null, body=%s", ep.path, w.Body.String())
		}
	}
}
