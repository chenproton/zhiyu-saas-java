package ai

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestChatCompletionSuccess(t *testing.T) {
	var gotAuth string
	var gotBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"choices": [{"message": {"role": "assistant", "content": "你好，世界"}}],
			"usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
		}`))
	}))
	defer srv.Close()

	c := NewClient()
	reply, usage, err := c.ChatCompletion(context.Background(), Config{
		BaseURL: srv.URL,
		APIKey:  "sk-test-key",
		Model:   "gpt-4o-mini",
	}, ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}})
	if err != nil {
		t.Fatalf("ChatCompletion: %v", err)
	}
	if reply != "你好，世界" {
		t.Fatalf("reply = %q, want %q", reply, "你好，世界")
	}
	if usage.TotalTokens != 15 || usage.PromptTokens != 10 || usage.CompletionTokens != 5 {
		t.Fatalf("usage 解析错误: %+v", usage)
	}
	if gotAuth != "Bearer sk-test-key" {
		t.Fatalf("Authorization = %q, want %q", gotAuth, "Bearer sk-test-key")
	}
	if gotBody["model"] != "gpt-4o-mini" {
		t.Fatalf("model = %v, want gpt-4o-mini", gotBody["model"])
	}
}

func TestChatCompletionTrimsTrailingSlash(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices": [{"message": {"role": "assistant", "content": "ok"}}], "usage": {}}`))
	}))
	defer srv.Close()

	c := NewClient()
	if _, _, err := c.ChatCompletion(context.Background(), Config{
		BaseURL: srv.URL + "/v1/",
		APIKey:  "k",
		Model:   "m",
	}, ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}}); err != nil {
		t.Fatalf("ChatCompletion: %v", err)
	}
	if gotPath != "/v1/chat/completions" {
		t.Fatalf("path = %q, want /v1/chat/completions", gotPath)
	}
}

func TestChatCompletionUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error": {"message": "Incorrect API key provided"}}`))
	}))
	defer srv.Close()

	c := NewClient()
	_, _, err := c.ChatCompletion(context.Background(), Config{
		BaseURL: srv.URL,
		APIKey:  "bad-key",
		Model:   "m",
	}, ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}})
	var upErr *UpstreamError
	if !errors.As(err, &upErr) {
		t.Fatalf("应返回 *UpstreamError, got: %T %v", err, err)
	}
	if upErr.StatusCode != http.StatusUnauthorized {
		t.Fatalf("StatusCode = %d, want 401", upErr.StatusCode)
	}
	if upErr.Message != "Incorrect API key provided" {
		t.Fatalf("Message = %q", upErr.Message)
	}
}

func TestChatCompletionUpstreamErrorNonJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("bad gateway"))
	}))
	defer srv.Close()

	c := NewClient()
	_, _, err := c.ChatCompletion(context.Background(), Config{
		BaseURL: srv.URL,
		APIKey:  "k",
		Model:   "m",
	}, ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}})
	var upErr *UpstreamError
	if !errors.As(err, &upErr) {
		t.Fatalf("应返回 *UpstreamError, got: %T %v", err, err)
	}
	if upErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("StatusCode = %d, want 502", upErr.StatusCode)
	}
	// 非 JSON body 不透传原文，只带状态码兜底信息
	if upErr.Message == "bad gateway" {
		t.Fatal("不应透传原始 body")
	}
}
