package ai

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestChatCompletionStream SSE 流式解析：delta 聚合、用量提取、[DONE] 终止、噪声行容忍。
func TestChatCompletionStream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk-test" {
			http.Error(w, `{"error":{"message":"bad key"}}`, 401)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, ": heartbeat\n\n") // 注释/心跳噪声行应被容忍
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"，世界\"}}]}\n\n")
		fmt.Fprint(w, "data: not-json\n\n") // 坏行容忍
		fmt.Fprint(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	var deltas []string
	full, usage, err := NewClient().ChatCompletionStream(context.Background(),
		Config{BaseURL: srv.URL, APIKey: "sk-test", Model: "m"},
		ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}},
		func(d string) error { deltas = append(deltas, d); return nil })
	if err != nil {
		t.Fatalf("stream: %v", err)
	}
	if full != "你好，世界" || strings.Join(deltas, "") != full {
		t.Fatalf("aggregation mismatch: full=%q deltas=%v", full, deltas)
	}
	if usage.TotalTokens != 5 {
		t.Fatalf("usage not captured: %+v", usage)
	}
}

// TestChatCompletionStreamUpstreamError 非 2xx 映射 UpstreamError 且脱敏。
func TestChatCompletionStreamUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"invalid api key sk-abcdef123456 provided"}}`, 401)
	}))
	defer srv.Close()

	_, _, err := NewClient().ChatCompletionStream(context.Background(),
		Config{BaseURL: srv.URL, APIKey: "sk-x", Model: "m"},
		ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}}, nil)
	var ue *UpstreamError
	if err == nil || !isUpstream(err, &ue) {
		t.Fatalf("expected UpstreamError, got %v", err)
	}
	if ue.StatusCode != 401 || strings.Contains(ue.Message, "sk-abcdef") {
		t.Fatalf("upstream error not sanitized: %+v", ue)
	}
}

func isUpstream(err error, out **UpstreamError) bool {
	for err != nil {
		if e, ok := err.(*UpstreamError); ok {
			*out = e
			return true
		}
		type unwrapper interface{ Unwrap() error }
		u, ok := err.(unwrapper)
		if !ok {
			return false
		}
		err = u.Unwrap()
	}
	return false
}

// TestChatCompletionStreamDeltaAbort onDelta 返回 error 即中断流（客户端断开语义）。
func TestChatCompletionStreamDeltaAbort(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		for i := 0; i < 5; i++ {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":\"%d\"}}]}\n\n", i)
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	stop := fmt.Errorf("client gone")
	n := 0
	_, _, err := NewClient().ChatCompletionStream(context.Background(),
		Config{BaseURL: srv.URL, APIKey: "k", Model: "m"},
		ChatRequest{Messages: []Message{{Role: "user", Content: "hi"}}},
		func(d string) error {
			n++
			return stop
		})
	if err != stop || n != 1 {
		t.Fatalf("abort semantics wrong: n=%d err=%v", n, err)
	}
}
