package handler

import (
	"bytes"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// TestRespondServerErrorIncludesRequestID 验收标准 P2：任意 5xx 结构化日志含 request_id，
// 与 X-Request-ID 请求头/响应头对应，便于按请求号检索日志链路。
func TestRespondServerErrorIncludesRequestID(t *testing.T) {
	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	defer slog.SetDefault(slog.New(slog.NewTextHandler(nil, nil)))

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		respondServerError(w, r, errors.New("boom"), "测试失败")
	})
	h := chimw.RequestID(inner)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "req-abc-123")
	h.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	logs := buf.String()
	if !strings.Contains(logs, "request_id=req-abc-123") {
		t.Fatalf("5xx 日志应包含 request_id，实际：\n%s", logs)
	}
	if !strings.Contains(logs, "error=boom") {
		t.Fatalf("5xx 日志应包含原始 error，实际：\n%s", logs)
	}
}
