package service

// AI 中心 v2.2（A+B 优化包，spec docs/spec/ai-service-center.md §11 v2.2）：
// 浏览量统计 / KB 问答记录 / YIKnow 通用会话 / 智能体预览 / 收藏列表纳入。
import (
	"context"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ==================== B6 知识库问答记录 ====================

// ListMyKBAsks 我在该库下的提问历史（可见性与 GetKB 一致）。
func (svc *AICenterService) ListMyKBAsks(ctx context.Context, tenantID, kbID, userID string) ([]domain.AIKBAsk, error) {
	if _, _, err := svc.getKBWithRole(ctx, tenantID, kbID, userID); err != nil {
		return nil, err
	}
	return svc.s.Store().AICenter().ListMyKBAsks(ctx, tenantID, kbID, userID)
}

// ==================== A1 YIKnow 通用会话 ====================

// ListGeneralConversations 我的 YIKnow 会话列表。
func (svc *AICenterService) ListGeneralConversations(ctx context.Context, tenantID, userID string) ([]domain.AIConversation, error) {
	return svc.s.Store().AICenter().ListGeneralConversations(ctx, tenantID, userID)
}

// YIKnowChat 通用助手流式对话（无检索、无智能体提示词；会话持久化，agent_id 为空）。
func (svc *AICenterService) YIKnowChat(ctx context.Context, tenantID, userID, conversationID, message string, emit ChatEmit) error {
	// AI 配置预检：未配置在 SSE 开始前返回 412，且置于会话创建之前，避免未配置时留孤儿会话
	cfg, err := svc.ai.GetConfig(ctx, tenantID)
	if err != nil {
		return err
	}
	if !cfg.Configured {
		return ErrAINotConfigured
	}

	// 会话：复用（校验归属与通用性）或新建
	var cv *domain.AIConversation
	if conversationID != "" {
		cv, err = svc.s.Store().AICenter().GetConversation(ctx, tenantID, conversationID)
		if err != nil {
			return err
		}
		if cv.UserID != userID || cv.AgentID != "" {
			return store.ErrForbidden
		}
	} else {
		cv = &domain.AIConversation{TenantID: tenantID, AgentID: "", UserID: userID}
		if err := svc.s.Store().AICenter().CreateConversation(ctx, cv); err != nil {
			return err
		}
	}

	// 历史上下文（近 5 轮）
	var history []domain.AIMessage
	if conversationID != "" {
		var err error
		history, err = svc.s.Store().AICenter().ListRecentMessages(ctx, tenantID, cv.ID, aiContextHistoryLimit)
		if err != nil {
			return err
		}
	}

	userMsg := &domain.AIMessage{TenantID: tenantID, ConversationID: cv.ID, Role: "user", Content: message}
	if err := svc.s.Store().AICenter().InsertMessage(ctx, userMsg); err != nil {
		return err
	}
	svc.s.Store().AICenter().TouchConversation(ctx, tenantID, cv.ID, truncateRunes(message, aiConvTitleRunes))

	if err := emit("meta", map[string]string{"conversationId": cv.ID, "messageId": userMsg.ID}); err != nil {
		return err
	}
	messages := buildChatMessages("你是 YIKnow 智能助手，面向职业院校师生提供学习、教学与办公辅助。", nil, history, message)
	reply, _, err := svc.ai.ChatStream(ctx, tenantID, userID, messages, nil, nil, func(delta string) error {
		return emit("delta", map[string]string{"text": delta})
	})
	if err != nil {
		if emitErr := emit("error", map[string]string{"code": "upstream_error", "message": upstreamMessage(err)}); emitErr != nil {
			return emitErr
		}
		return nil
	}
	assistantMsg := &domain.AIMessage{TenantID: tenantID, ConversationID: cv.ID, Role: "assistant", Content: reply, Sources: []domain.AIMessageSource{}}
	if err := svc.s.Store().AICenter().InsertMessage(ctx, assistantMsg); err != nil {
		return err
	}
	return emit("done", map[string]any{"answer": reply})
}

// ==================== B7 智能体预览（owner 专属，不落库/不计数） ====================

// PreviewAgent 编辑器内实时试聊：用表单中的最新提示词（未保存也可预览）。
// 仅 owner；不持久化消息、不增对话数；关联库检索用当前已保存的关联（提示词预览为主）。
func (svc *AICenterService) PreviewAgent(ctx context.Context, tenantID, agentID, userID, systemPrompt, message string) (string, error) {
	a, err := svc.s.Store().AICenter().GetAgent(ctx, tenantID, agentID)
	if err != nil {
		return "", err
	}
	if a.OwnerID != userID {
		return "", store.ErrForbidden
	}
	prompt := strings.TrimSpace(systemPrompt)
	if prompt == "" {
		prompt = a.SystemPrompt
	}
	messages := buildChatMessages(prompt, nil, nil, message)
	reply, _, err := svc.ai.Chat(ctx, tenantID, userID, messages, nil, nil)
	if err != nil {
		return "", err
	}
	return reply, nil
}
