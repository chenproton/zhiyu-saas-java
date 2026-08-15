// 流式对话扩展（ai-development.md §6）：SSE 解析 + 增量回调。
// 只在 ai.Client 内与上游通信，业务侧经 AIService.ChatStream 编排，
// handler 只负责把 delta 透传给前端（http.Flusher）。
package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// streamClient 流式专用 HTTP 客户端：不设整体超时（长连接输出耗时不可预估），
// 生命周期由调用方 ctx 控制（handler 绑定请求 ctx，客户端断开即中断上游）。
var streamHTTPClient = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DialContext:         (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
	},
}

type chatCompletionStreamRequest struct {
	Model          string            `json:"model"`
	Messages       []Message         `json:"messages"`
	Temperature    *float64          `json:"temperature,omitempty"`
	MaxTokens      *int              `json:"max_tokens,omitempty"`
	Stream         bool              `json:"stream"`
	StreamOptions  *streamOptions    `json:"stream_options,omitempty"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
}

type streamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type chatCompletionChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *Usage `json:"usage,omitempty"`
}

// ChatCompletionStream 调用 {BaseURL}/chat/completions（stream=true），
// 解析 SSE 增量并经 onDelta 回调（回调返回 error 即中断流，用于客户端断开透传）。
// 返回聚合全文与用量（经 stream_options.include_usage 请求；上游不回则为零值）。
// 不做自动重试（约定 5）；非 2xx 映射 UpstreamError 且脱敏。
func (c *Client) ChatCompletionStream(ctx context.Context, cfg Config, req ChatRequest, onDelta func(string) error) (string, Usage, error) {
	var usage Usage
	payload, err := json.Marshal(chatCompletionStreamRequest{
		Model:          cfg.Model,
		Messages:       req.Messages,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
		Stream:         true,
		StreamOptions:  &streamOptions{IncludeUsage: true},
		ResponseFormat: req.ResponseFormat,
	})
	if err != nil {
		return "", usage, err
	}

	url := strings.TrimRight(cfg.BaseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return "", usage, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := streamHTTPClient.Do(httpReq)
	if err != nil {
		return "", usage, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		var errBody struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		msg := fmt.Sprintf("upstream returned status %d", resp.StatusCode)
		if json.Unmarshal(body, &errBody) == nil && errBody.Error.Message != "" {
			msg = errBody.Error.Message
		}
		return "", usage, &UpstreamError{StatusCode: resp.StatusCode, Message: SanitizeUpstreamMessage(msg)}
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	// SSE 行可能较长（单 delta 含大块文本），放宽到 1MB
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk chatCompletionChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue // 容忍噪声行（注释/心跳），不中断整流
		}
		if chunk.Usage != nil {
			usage = *chunk.Usage
		}
		for _, choice := range chunk.Choices {
			if choice.Delta.Content == "" {
				continue
			}
			full.WriteString(choice.Delta.Content)
			if onDelta != nil {
				if err := onDelta(choice.Delta.Content); err != nil {
					return full.String(), usage, err
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return full.String(), usage, fmt.Errorf("read upstream stream: %w", err)
	}
	return full.String(), usage, nil
}
