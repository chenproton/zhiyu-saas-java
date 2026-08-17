// AI 智能服务中心：智能体 CRUD + 流式对话编排（spec §3.2/§5.2）。
package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 智能体输入护栏（handler 同样校验，service 兜底）。
const (
	aiAgentNameMax      = 100
	aiAgentDescMax      = 500
	aiAgentGreetingMax  = 500
	aiAgentPromptMax    = 4000
	aiAgentMaxKBLinks   = 5
	aiChatMessageMaxLen = 2000
	aiConvTitleRunes    = 30
)

// AgentInput 智能体创建/编辑输入。
type AgentInput struct {
	Name         string   `json:"name"`
	Avatar       string   `json:"avatar"`
	Description  string   `json:"description"`
	CoverImage   string   `json:"coverImage"` // /uploads 相对路径，可空
	Greeting     string   `json:"greeting"`
	SystemPrompt string   `json:"systemPrompt"`
	KbIDs        []string `json:"kbIds"`
	MajorID      string   `json:"majorId"`      // 系统专业字典，可空=不限
	DepartmentID string   `json:"departmentId"` // 系统院系字典，可空=不限
}

// CreateAgent 创建智能体（任何登录用户；创建即私有）。
func (svc *AICenterService) CreateAgent(ctx context.Context, tenantID, ownerID string, in AgentInput) (*domain.AIAgent, error) {
	a := &domain.AIAgent{
		TenantID:     tenantID,
		OwnerID:      ownerID,
		Name:         strings.TrimSpace(in.Name),
		Avatar:       strings.TrimSpace(in.Avatar),
		Description:  strings.TrimSpace(in.Description),
		CoverImage:   strings.TrimSpace(in.CoverImage),
		Greeting:     strings.TrimSpace(in.Greeting),
		SystemPrompt: strings.TrimSpace(in.SystemPrompt),
		MajorID:      strOrNil(in.MajorID),
		DepartmentID: strOrNil(in.DepartmentID),
	}
	if err := svc.validateAgentKBLinks(ctx, tenantID, ownerID, in.KbIDs); err != nil {
		return nil, err
	}
	if err := svc.s.Store().AICenter().CreateAgent(ctx, a); err != nil {
		return nil, err
	}
	if err := svc.s.Store().AICenter().ReplaceAgentKBs(ctx, tenantID, a.ID, in.KbIDs); err != nil {
		return nil, err
	}
	a.KbIDs = in.KbIDs
	if a.KbIDs == nil {
		a.KbIDs = []string{}
	}
	return a, nil
}

// ErrAIAgentTooManyKBs 关联知识库超限（handler 映射 400）。
var ErrAIAgentTooManyKBs = errors.New("关联知识库最多 5 个")

// ErrAIConversationTitleRequired 会话重命名空标题（handler 映射 400）。
var ErrAIConversationTitleRequired = errors.New("会话标题不能为空")

// validateAgentKBLinks 关联校验：owner 对每个库须为 owner/协作者，或库已发布（spec §4.6）。
func (svc *AICenterService) validateAgentKBLinks(ctx context.Context, tenantID, ownerID string, kbIDs []string) error {
	if len(kbIDs) > aiAgentMaxKBLinks {
		return ErrAIAgentTooManyKBs
	}
	seen := map[string]bool{}
	for _, kbID := range kbIDs {
		if seen[kbID] {
			continue
		}
		seen[kbID] = true
		kb, err := svc.s.Store().AICenter().GetKB(ctx, tenantID, kbID)
		if err != nil {
			return err
		}
		if _, err := svc.resolveKBRole(ctx, kb, ownerID, false); err != nil {
			return store.ErrForbidden // 关联了不可见库
		}
	}
	return nil
}

// GetAgent 智能体详情（published 或 owner 或 school_admin 只读体验；附关联库）。
func (svc *AICenterService) GetAgent(ctx context.Context, tenantID, agentID, userID string, isAdmin bool) (*domain.AIAgent, error) {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	if a.OwnerID != userID && a.Status != domain.AIContentStatusPublished && !isAdmin {
		return nil, store.ErrNotFound
	}
	// 浏览量（v2.2.1 统一）：浏览详情即 +1（全局 view_counters 机制，不排 owner）
	svc.s.Store().AICenter().IncrementAgentView(ctx, tenantID, agentID)
	a.ViewCount++
	kbs, err := svc.s.Store().AICenter().ListAgentKBs(ctx, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	a.KbIDs = make([]string, 0, len(kbs))
	a.KbNames = make([]string, 0, len(kbs))
	for _, kb := range kbs {
		a.KbIDs = append(a.KbIDs, kb.ID)
		a.KbNames = append(a.KbNames, kb.Name)
	}
	return a, nil
}

// ListMyAgents 我的智能体。
func (svc *AICenterService) ListMyAgents(ctx context.Context, tenantID, userID string) ([]domain.AIAgent, error) {
	return svc.s.Store().AICenter().ListMyAgents(ctx, tenantID, userID)
}

// ListSquareAgents 广场智能体。
func (svc *AICenterService) ListSquareAgents(ctx context.Context, tenantID, q, sort string, page, pageSize int, majorID, departmentID string, updatedAfter *time.Time) ([]domain.AIAgent, int, error) {
	return svc.s.Store().AICenter().ListSquareAgents(ctx, tenantID, q, sort, page, pageSize, majorID, departmentID, updatedAfter)
}

// UpdateAgent 编辑智能体（仅 owner；published 可直接编辑，状态不变——spec §9.2）。
func (svc *AICenterService) UpdateAgent(ctx context.Context, tenantID, agentID, userID string, in AgentInput) error {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	if a.OwnerID != userID {
		return store.ErrForbidden
	}
	if err := svc.validateAgentKBLinks(ctx, tenantID, userID, in.KbIDs); err != nil {
		return err
	}
	a.Name = strings.TrimSpace(in.Name)
	a.Avatar = strings.TrimSpace(in.Avatar)
	a.Description = strings.TrimSpace(in.Description)
	a.CoverImage = strings.TrimSpace(in.CoverImage)
	a.Greeting = strings.TrimSpace(in.Greeting)
	a.SystemPrompt = strings.TrimSpace(in.SystemPrompt)
	a.MajorID = strOrNil(in.MajorID)
	a.DepartmentID = strOrNil(in.DepartmentID)
	if err := svc.s.Store().AICenter().UpdateAgent(ctx, a); err != nil {
		return err
	}
	return svc.s.Store().AICenter().ReplaceAgentKBs(ctx, tenantID, agentID, in.KbIDs)
}

// DeleteAgent 删除智能体（仅 owner，仅 private/rejected）。
func (svc *AICenterService) DeleteAgent(ctx context.Context, tenantID, agentID, userID string) error {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	if a.OwnerID != userID {
		return store.ErrForbidden
	}
	if a.Status != domain.AIContentStatusPrivate && a.Status != domain.AIContentStatusRejected {
		return ErrAIInvalidTransition
	}
	return svc.s.Store().AICenter().DeleteAgent(ctx, tenantID, agentID)
}

// SubmitAgent 提交审核：private/rejected → pending；返回警告（关联私有库对他人不可见，spec §2.2）。
func (svc *AICenterService) SubmitAgent(ctx context.Context, tenantID, agentID, userID string) ([]string, error) {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	if a.OwnerID != userID {
		return nil, store.ErrForbidden
	}
	if err := svc.s.Store().AICenter().SetAgentStatus(ctx, tenantID, agentID, domain.AIContentStatusPending, "", "",
		domain.AIContentStatusPrivate, domain.AIContentStatusRejected); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, ErrAIInvalidTransition
		}
		return nil, err
	}
	if err := svc.s.Store().AICenter().InsertReviewLog(ctx, &domain.AIReviewLog{
		TenantID: tenantID, TargetType: "agent", TargetID: agentID, Action: domain.AIReviewActionSubmit, ActorID: userID,
	}); err != nil {
		return nil, err
	}
	// 警告：关联的未发布库对其他用户不可见（召回按请求者权限过滤）
	var warnings []string
	kbs, err := svc.s.Store().AICenter().ListAgentKBs(ctx, tenantID, agentID)
	if err == nil {
		for _, kb := range kbs {
			if kb.Status != domain.AIContentStatusPublished {
				warnings = append(warnings, "关联的知识库「"+kb.Name+"」未发布，其他用户对话时不会检索其内容")
			}
		}
	}
	return warnings, nil
}

// UnpublishAgent 下架（owner）：published → private。
func (svc *AICenterService) UnpublishAgent(ctx context.Context, tenantID, agentID, userID string) error {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	if a.OwnerID != userID {
		return store.ErrForbidden
	}
	if err := svc.s.Store().AICenter().SetAgentStatus(ctx, tenantID, agentID, domain.AIContentStatusPrivate, "", "",
		domain.AIContentStatusPublished); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return ErrAIInvalidTransition
		}
		return err
	}
	return svc.s.Store().AICenter().InsertReviewLog(ctx, &domain.AIReviewLog{
		TenantID: tenantID, TargetType: "agent", TargetID: agentID, Action: domain.AIReviewActionUnpublish, ActorID: userID,
	})
}

// ==================== 流式对话编排 ====================

// ChatEmit SSE 事件回调（handler 负责写流；返回 error 中断对话，用于客户端断开）。
type ChatEmit func(event string, payload any) error

// AgentChat 智能体流式对话（spec §3.2 时序）。
// 开始前错误（未配置/越权/非法会话）直接返回 error 由 handler 映射 HTTP；
// 流启动后错误经 emit("error") 下发。
func (svc *AICenterService) AgentChat(ctx context.Context, tenantID, agentID, userID string, isAdmin bool, conversationID, message string, emit ChatEmit) error {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	if a.OwnerID != userID && a.Status != domain.AIContentStatusPublished && !isAdmin {
		return store.ErrNotFound // 不可见即不存在
	}

	// AI 配置预检：未配置在 SSE 开始前返回 412（spec §5.5），且置于会话创建之前，
	// 避免未配置租户每次对话尝试都留下孤儿会话行
	cfg, err := svc.ai.GetConfig(ctx, tenantID)
	if err != nil {
		return err
	}
	if !cfg.Configured {
		return ErrAINotConfigured
	}

	// 会话：复用（校验归属）或新建
	var cv *domain.AIConversation
	if conversationID != "" {
		cv, err = svc.s.Store().AICenter().GetConversation(ctx, tenantID, conversationID)
		if err != nil {
			return err
		}
		if cv.UserID != userID || cv.AgentID != agentID {
			return store.ErrForbidden
		}
	} else {
		cv = &domain.AIConversation{TenantID: tenantID, AgentID: agentID, UserID: userID}
		if err := svc.s.Store().AICenter().CreateConversation(ctx, cv); err != nil {
			return err
		}
	}

	// 召回（安全锚点：SQL 层按请求者可见性过滤）
	kbs, err := svc.s.Store().AICenter().ListAgentKBs(ctx, tenantID, agentID)
	if err != nil {
		return err
	}
	kbIDs := make([]string, 0, len(kbs))
	for _, kb := range kbs {
		kbIDs = append(kbIDs, kb.ID)
	}
	chunks, err := svc.retrieveChunks(ctx, tenantID, userID, kbIDs, message)
	if err != nil {
		return err
	}
	sources := chunksToSources(chunks)

	// 历史上下文（近 5 轮）
	var history []domain.AIMessage
	if conversationID != "" {
		history, err = svc.s.Store().AICenter().ListRecentMessages(ctx, tenantID, cv.ID, aiContextHistoryLimit)
		if err != nil {
			return err
		}
	}

	// 用户消息落库 + 会话标题/活跃时间
	userMsg := &domain.AIMessage{TenantID: tenantID, ConversationID: cv.ID, Role: "user", Content: message}
	if err := svc.s.Store().AICenter().InsertMessage(ctx, userMsg); err != nil {
		return err
	}
	svc.s.Store().AICenter().TouchConversation(ctx, tenantID, cv.ID, truncateRunes(message, aiConvTitleRunes))

	// 首事件：meta + sources（在首个 delta 前发出；上游连接失败时这些事件已在流内——
	// 但 GetConfig 预检已覆盖「未配置」，上游失败经 error 事件下发）
	if err := emit("meta", map[string]string{"conversationId": cv.ID, "messageId": userMsg.ID}); err != nil {
		return err
	}
	if len(sources) > 0 {
		if err := emit("sources", sources); err != nil {
			return err
		}
	}

	messages := buildChatMessages(a.SystemPrompt, chunks, history, message)
	reply, _, err := svc.ai.ChatStream(ctx, tenantID, userID, messages, nil, nil, func(delta string) error {
		return emit("delta", map[string]string{"text": delta})
	})
	if err != nil {
		// 流中途失败：error 事件 + 不落残缺 assistant 消息（spec §9.2）
		if emitErr := emit("error", map[string]string{"code": "upstream_error", "message": upstreamMessage(err)}); emitErr != nil {
			return emitErr
		}
		return nil // 已下发 error 事件，HTTP 层不再报错
	}

	// assistant 消息落库（带溯源）+ 计数（best-effort）
	assistantMsg := &domain.AIMessage{TenantID: tenantID, ConversationID: cv.ID, Role: "assistant", Content: reply, Sources: sources}
	if err := svc.s.Store().AICenter().InsertMessage(ctx, assistantMsg); err != nil {
		return err
	}
	svc.s.Store().AICenter().IncrementAgentChatCount(ctx, tenantID, agentID)
	if len(chunks) > 0 {
		hitKBs := map[string]bool{}
		var ids []string
		for _, c := range chunks {
			if !hitKBs[c.KbID] {
				hitKBs[c.KbID] = true
				ids = append(ids, c.KbID)
			}
		}
		svc.s.Store().AICenter().IncrementKBAskCount(ctx, tenantID, ids)
	}
	svc.s.Store().AICenter().TouchConversation(ctx, tenantID, cv.ID, "")
	return emit("done", map[string]any{"messageId": assistantMsg.ID})
}

// KBAsk 知识库库内问答/效果预览（SSE；不写会话，仅计数；可见者可用）。
func (svc *AICenterService) KBAsk(ctx context.Context, tenantID, kbID, userID string, isAdmin bool, message string, emit ChatEmit) error {
	kb, _, err := svc.getKBWithRole(ctx, tenantID, kbID, userID, isAdmin)
	if err != nil {
		return err
	}
	cfg, err := svc.ai.GetConfig(ctx, tenantID)
	if err != nil {
		return err
	}
	if !cfg.Configured {
		return ErrAINotConfigured
	}
	chunks, err := svc.retrieveChunks(ctx, tenantID, userID, []string{kb.ID}, message)
	if err != nil {
		return err
	}
	sources := chunksToSources(chunks)
	if len(sources) > 0 {
		if err := emit("sources", sources); err != nil {
			return err
		}
	}
	systemPrompt := "你是知识库「" + kb.Name + "」的问答助手，基于提供的知识库资料回答用户问题。"
	messages := buildChatMessages(systemPrompt, chunks, nil, message)
	reply, _, err := svc.ai.ChatStream(ctx, tenantID, userID, messages, nil, nil, func(delta string) error {
		return emit("delta", map[string]string{"text": delta})
	})
	if err != nil {
		if emitErr := emit("error", map[string]string{"code": "upstream_error", "message": upstreamMessage(err)}); emitErr != nil {
			return emitErr
		}
		return nil
	}
	svc.s.Store().AICenter().IncrementKBAskCount(ctx, tenantID, []string{kb.ID})
	// 问答记录落库（v2.2 B6：我的提问历史；尽力而为，失败不影响回答）
	ask := &domain.AIKBAsk{TenantID: tenantID, KbID: kb.ID, UserID: userID, Question: message, Answer: reply}
	_ = svc.s.Store().AICenter().InsertKBAsk(ctx, ask)
	return emit("done", map[string]any{"answer": reply})
}

// upstreamMessage 上游错误取脱敏 message 返回前端（ai.Client 已做密钥脱敏）。
func upstreamMessage(err error) string {
	var ue *ai.UpstreamError
	if errors.As(err, &ue) {
		return "AI 服务暂不可用：" + ue.Message
	}
	return "AI 服务调用失败，请稍后重试"
}

// ==================== 会话 ====================

// ListConversations 我在某智能体下的会话（可见性与 GetAgent 一致：published 或 owner，
// 避免以「200 空列表 vs 404」探测私有智能体存在性）。
func (svc *AICenterService) ListConversations(ctx context.Context, tenantID, agentID, userID string) ([]domain.AIConversation, error) {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	if a.OwnerID != userID && a.Status != domain.AIContentStatusPublished {
		return nil, store.ErrNotFound
	}
	return svc.s.Store().AICenter().ListConversations(ctx, tenantID, agentID, userID)
}

// GetConversationMessages 会话消息（仅本人）。
func (svc *AICenterService) GetConversationMessages(ctx context.Context, tenantID, conversationID, userID string) (*domain.AIConversation, []domain.AIMessage, error) {
	cv, err := svc.s.Store().AICenter().GetConversation(ctx, tenantID, conversationID)
	if err != nil {
		return nil, nil, err
	}
	if cv.UserID != userID {
		return nil, nil, store.ErrForbidden
	}
	msgs, err := svc.s.Store().AICenter().ListMessages(ctx, tenantID, conversationID, 500)
	if err != nil {
		return nil, nil, err
	}
	return cv, msgs, nil
}

// DeleteConversation 删除会话（仅本人）。
func (svc *AICenterService) DeleteConversation(ctx context.Context, tenantID, conversationID, userID string) error {
	return svc.s.Store().AICenter().DeleteConversation(ctx, tenantID, conversationID, userID)
}

// RenameConversation 重命名会话（仅本人；空标题拒绝）。
func (svc *AICenterService) RenameConversation(ctx context.Context, tenantID, conversationID, userID, title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return ErrAIConversationTitleRequired
	}
	runes := []rune(title)
	if len(runes) > 100 {
		title = string(runes[:100])
	}
	return svc.s.Store().AICenter().RenameConversation(ctx, tenantID, conversationID, userID, title)
}
