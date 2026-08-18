package cache

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

// TestRateLimitNamespaceIsolation 验证不同 namespace 的限流器使用独立计数桶：
// 场景 A（如主题读取）高频请求不得挤占场景 B（如验证码）的额度。
// 回归背景：历史上所有 RateLimit 共享同一 Redis key（zhiyu:ratelimit:<ip>），
// 冒烟巡检的高频主题/公开读取把验证码 10 次/分钟额度耗尽，登录被误限 429。
func TestRateLimitNamespaceIsolation(t *testing.T) {
	const limitA = 2
	const limitB = 5
	const window = time.Minute
	limiterA := RateLimit(nil, "ns-a", limitA, window)
	limiterB := RateLimit(nil, "ns-b", limitB, window)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handlerA := limiterA(next)
	handlerB := limiterB(next)

	req := func(h http.Handler) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		return rec
	}

	// 场景 A 打满自己的额度
	for i := 0; i < limitA; i++ {
		if rec := req(handlerA); rec.Code != http.StatusOK {
			t.Fatalf("ns-a request %d: got status %d, want 200", i+1, rec.Code)
		}
	}
	if rec := req(handlerA); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("ns-a over limit: got status %d, want 429", rec.Code)
	}

	// 场景 B 不受影响：仍按自身额度放行
	for i := 0; i < limitB; i++ {
		if rec := req(handlerB); rec.Code != http.StatusOK {
			t.Fatalf("ns-b request %d: got status %d, want 200（namespace 应隔离计数）", i+1, rec.Code)
		}
	}
	if rec := req(handlerB); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("ns-b over limit: got status %d, want 429", rec.Code)
	}
}

// TestRateLimitMemoryFallback 验证 client == nil 时降级为内存限流：
// limit 次内放行、超限 429 且响应头/响应体正确（不依赖真实 Redis）。
func TestRateLimitMemoryFallback(t *testing.T) {
	const limit = 3
	const window = time.Minute
	limiter := RateLimit(nil, "test", limit, window)

	var hits int
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	})
	handler := limiter(next)

	// limit 次内全部放行，且 X-RateLimit-* 头递减正确
	for i := 0; i < limit; i++ {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: got status %d, want 200", i+1, rec.Code)
		}
		if got := rec.Header().Get("X-RateLimit-Limit"); got != strconv.Itoa(limit) {
			t.Fatalf("request %d: X-RateLimit-Limit = %q, want %d", i+1, got, limit)
		}
		wantRemaining := limit - i - 1
		if got := rec.Header().Get("X-RateLimit-Remaining"); got != strconv.Itoa(wantRemaining) {
			t.Fatalf("request %d: X-RateLimit-Remaining = %q, want %d", i+1, got, wantRemaining)
		}
		if got := rec.Header().Get("X-RateLimit-Reset"); got == "" {
			t.Fatalf("request %d: X-RateLimit-Reset 未设置", i+1)
		}
	}
	if hits != limit {
		t.Fatalf("handler hits = %d, want %d", hits, limit)
	}

	// 第 limit+1 次请求超限 → 429，响应体与头正确，handler 不再被调用
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("over limit: got status %d, want 429", rec.Code)
	}
	if got := rec.Body.String(); got != `{"error":"too many requests","code":429}` {
		t.Fatalf("429 body = %q", got)
	}
	if got := rec.Header().Get("X-RateLimit-Remaining"); got != "0" {
		t.Fatalf("over limit: X-RateLimit-Remaining = %q, want 0", got)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("over limit: Content-Type = %q, want application/json", got)
	}
	if hits != limit {
		t.Fatalf("handler hits after 429 = %d, want %d（超限请求不应透传）", hits, limit)
	}
}

// TestRateLimitMemoryWindowReset 验证窗口过期后计数重置（50ms 短窗口），
// 过期后重新放行。
func TestRateLimitMemoryWindowReset(t *testing.T) {
	const limit = 2
	const window = 50 * time.Millisecond
	limiter := RateLimit(nil, "test", limit, window)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := limiter(next)
	req := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		return rec
	}

	for i := 0; i < limit; i++ {
		if rec := req(); rec.Code != http.StatusOK {
			t.Fatalf("window request %d: got status %d, want 200", i+1, rec.Code)
		}
	}
	if rec := req(); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("within window: got status %d, want 429", rec.Code)
	}

	// 窗口过期后计数重置，重新放行
	time.Sleep(window + 20*time.Millisecond)
	rec := req()
	if rec.Code != http.StatusOK {
		t.Fatalf("after window expiry: got status %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("X-RateLimit-Remaining"); got != strconv.Itoa(limit-1) {
		t.Fatalf("after window expiry: X-RateLimit-Remaining = %q, want %d", got, limit-1)
	}
}
