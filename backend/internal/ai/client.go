// Package ai 是 OpenAI 兼容 API 的统一调用网关（非流式）。
// 每个租户使用自己的 base_url/api_key/model，token 成本租户自负。
package ai

import (
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

// Message 对话消息（OpenAI chat 格式）。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest 对话请求参数；指针/map 字段缺省时不透传给上游。
type ChatRequest struct {
	Messages       []Message         `json:"messages"`
	Temperature    *float64          `json:"temperature,omitempty"`
	MaxTokens      *int              `json:"max_tokens,omitempty"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
}

// Usage 上游返回的 token 用量。
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Config 单个租户的 AI 服务接入配置。
type Config struct {
	BaseURL string
	APIKey  string
	Model   string
}

// UpstreamError 上游 AI 服务返回非 2xx；不透传原始 body，只提取 error.message。
type UpstreamError struct {
	StatusCode int
	Message    string
}

func (e *UpstreamError) Error() string {
	return fmt.Sprintf("ai upstream error (status %d): %s", e.StatusCode, e.Message)
}

// Client OpenAI 兼容 API 客户端，共享连接池 Transport。
type Client struct {
	httpClient *http.Client
}

// NewClient 创建客户端：整体超时 60s，Transport 复用空闲连接。
func NewClient() *Client {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DialContext:         (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
	}
	return &Client{httpClient: &http.Client{Transport: transport, Timeout: 60 * time.Second}}
}

type chatCompletionRequest struct {
	Model          string            `json:"model"`
	Messages       []Message         `json:"messages"`
	Temperature    *float64          `json:"temperature,omitempty"`
	MaxTokens      *int              `json:"max_tokens,omitempty"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
	Usage Usage `json:"usage"`
}

// ChatCompletion 调用 {BaseURL}/chat/completions（非流式），返回回复文本与用量。
func (c *Client) ChatCompletion(ctx context.Context, cfg Config, req ChatRequest) (string, Usage, error) {
	var usage Usage
	payload, err := json.Marshal(chatCompletionRequest{
		Model:          cfg.Model,
		Messages:       req.Messages,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
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

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", usage, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", usage, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		msg := fmt.Sprintf("upstream returned status %d", resp.StatusCode)
		if json.Unmarshal(body, &errBody) == nil && errBody.Error.Message != "" {
			msg = errBody.Error.Message
		}
		return "", usage, &UpstreamError{StatusCode: resp.StatusCode, Message: msg}
	}

	var cr chatCompletionResponse
	if err := json.Unmarshal(body, &cr); err != nil {
		return "", usage, fmt.Errorf("parse upstream response: %w", err)
	}
	if len(cr.Choices) == 0 {
		return "", cr.Usage, fmt.Errorf("upstream returned no choices")
	}
	return cr.Choices[0].Message.Content, cr.Usage, nil
}
