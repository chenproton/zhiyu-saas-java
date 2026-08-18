package handler

import (
	"net/http"
	"testing"
)

// TestCodeForAIRoutes AI 错误码「声明层=发射层」回归测试：
// 契约（docs/spec/02-api-contract.md §4.2）声明 412→ai_not_configured、502→ai_upstream_error，
// 此前 statusToCode 缺这两档映射导致实际响应体 code 兜底 internal_error。
func TestCodeForAIRoutes(t *testing.T) {
	cases := []struct {
		status int
		want   string
	}{
		{http.StatusPreconditionFailed, CodeAINotConfigured},
		{http.StatusBadGateway, CodeAIUpstreamError},
		{http.StatusBadRequest, CodeBadRequest},
		{http.StatusUnauthorized, CodeUnauthorized},
		{http.StatusForbidden, CodeForbidden},
		{http.StatusNotFound, CodeNotFound},
		{http.StatusConflict, CodeConflict},
		{http.StatusTooManyRequests, CodeTooManyRequests},
		{http.StatusInternalServerError, CodeInternalError},
	}
	for _, c := range cases {
		if got := codeFor(c.status); got != c.want {
			t.Errorf("codeFor(%d) = %q, want %q", c.status, got, c.want)
		}
	}
}
