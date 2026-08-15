package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ChatStream 用租户自有 AI 配置发起流式对话：配置加载/解密/缓存与非流式 Chat 一致，
// delta 经回调透传（handler 负责 SSE 写流）；上游成功后 best-effort 记录 token 用量
// （上游未回 usage 时记零值，仍记一次请求）。
// 未配置返回 ErrAINotConfigured；上游错误以 *ai.UpstreamError 透传。
func (s *AIService) ChatStream(ctx context.Context, tenantID, userID string, messages []ai.Message, temperature *float64, maxTokens *int, onDelta func(string) error) (string, ai.Usage, error) {
	var usage ai.Usage
	cfg, err := s.loadConfig(ctx, tenantID)
	if errors.Is(err, store.ErrAIConfigNotFound) {
		return "", usage, ErrAINotConfigured
	}
	if err != nil {
		return "", usage, err
	}
	apiKey, err := s.decryptKey(cfg.APIKeyEncrypted)
	if err != nil {
		return "", usage, err
	}
	reply, usage, err := s.client.ChatCompletionStream(ctx, ai.Config{
		BaseURL: cfg.BaseURL,
		APIKey:  apiKey,
		Model:   cfg.Model,
	}, ai.ChatRequest{
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
	}, onDelta)
	if err != nil {
		return reply, usage, err
	}
	s.recordUsage(ctx, tenantID, userID, cfg.Model, usage)
	return reply, usage, nil
}
