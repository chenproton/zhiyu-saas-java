package handler

import "net/http"

// 统一错误码常量表：respondError 自动按 HTTP 状态映射 code 字段，
// 前端按 code 分支（而非中文消息），新增错误类型时在此登记。
const (
	CodeBadRequest      = "bad_request"
	CodeUnauthorized    = "unauthorized"
	CodeForbidden       = "forbidden"
	CodeNotFound        = "not_found"
	CodeConflict        = "conflict"
	CodeTooManyRequests = "too_many_requests"
	CodeInternalError   = "internal_error"
	CodeAINotConfigured = "ai_not_configured"
	CodeAIUpstreamError = "ai_upstream_error"
)

// statusToCode HTTP 状态 → 错误码映射；未登记的状态兜底 internal_error。
var statusToCode = map[int]string{
	http.StatusBadRequest:          CodeBadRequest,
	http.StatusUnauthorized:        CodeUnauthorized,
	http.StatusForbidden:           CodeForbidden,
	http.StatusNotFound:            CodeNotFound,
	http.StatusConflict:            CodeConflict,
	http.StatusTooManyRequests:     CodeTooManyRequests,
	http.StatusInternalServerError: CodeInternalError,
}

// codeFor 返回状态对应的错误码，未登记时按业务侧自定义映射兜底。
func codeFor(status int) string {
	if c, ok := statusToCode[status]; ok {
		return c
	}
	return CodeInternalError
}
