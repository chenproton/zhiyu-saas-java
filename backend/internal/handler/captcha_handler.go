package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/service"
)

// CaptchaHandler 滑块验证码：生成端点公开，校验随登录请求进行。
type CaptchaHandler struct {
	Service *service.CaptchaService
}

// Get 生成滑块验证码（主图/拼图块 base64 + 初始位置），答案仅存服务端。
func (h *CaptchaHandler) Get(w http.ResponseWriter, r *http.Request) {
	out, err := h.Service.Generate(r.Context())
	if err != nil {
		respondServerError(w, r, err, "生成验证码失败")
		return
	}
	respondJSON(w, http.StatusOK, out)
}
