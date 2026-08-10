package handler

import (
	"errors"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// 对话护栏：消息条数与单条长度上限。
const (
	aiChatMaxMessages    = 50
	aiChatMaxContentSize = 8000
)

// 岗位 AI 辅助护栏：上下文条目数与单条长度上限（防止单请求打爆租户额度）。
const (
	aiPositionMaxItems    = 50
	aiPositionMaxTextSize = 8000
)

// AIHandler 租户 AI 配置管理与对话入口（无 SQL，仅做 HTTP 适配）。
type AIHandler struct {
	Service *service.AIService
}

// tenantIDRequired 提取租户 ID；缺失时写 403 并返回空串。
func tenantIDRequired(w http.ResponseWriter, r *http.Request) string {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户上下文")
		return ""
	}
	return *claims.TenantID
}

// GetConfig GET /ai/config：查看当前租户 AI 配置（脱敏）。
func (h *AIHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID := tenantIDRequired(w, r)
	if tenantID == "" {
		return
	}
	view, err := h.Service.GetConfig(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "获取 AI 配置失败")
		return
	}
	respondJSON(w, http.StatusOK, view)
}

type saveAIConfigRequest struct {
	BaseURL string `json:"baseUrl"`
	APIKey  string `json:"apiKey"`
	Model   string `json:"model"`
}

// SaveConfig PUT /ai/config：保存当前租户 AI 配置；apiKey 留空表示不修改。
func (h *AIHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID := tenantIDRequired(w, r)
	if tenantID == "" {
		return
	}
	var req saveAIConfigRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.BaseURL == "" || req.Model == "" {
		respondError(w, http.StatusBadRequest, "baseUrl 与 model 不能为空")
		return
	}
	if err := h.Service.SaveConfig(r.Context(), tenantID, req.BaseURL, req.APIKey, req.Model); err != nil {
		if errors.Is(err, service.ErrAIKeyRequired) {
			respondError(w, http.StatusBadRequest, "首次配置必须填写 apiKey")
			return
		}
		respondServerError(w, r, err, "保存 AI 配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteConfig DELETE /ai/config：清除当前租户 AI 配置。
func (h *AIHandler) DeleteConfig(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID := tenantIDRequired(w, r)
	if tenantID == "" {
		return
	}
	if err := h.Service.DeleteConfig(r.Context(), tenantID); err != nil {
		respondServerError(w, r, err, "清除 AI 配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type aiChatRequest struct {
	Messages    []ai.Message `json:"messages"`
	Temperature *float64     `json:"temperature,omitempty"`
	MaxTokens   *int         `json:"maxTokens,omitempty"`
}

type aiChatResponse struct {
	Reply string   `json:"reply"`
	Usage ai.Usage `json:"usage"`
}

// Chat POST /ai/chat：租户内任意登录用户可用。
// 未配置 → 412 ai_not_configured；上游非 2xx → 502 + 上游 message。
func (h *AIHandler) Chat(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantIDRequired(w, r)
	if tenantID == "" {
		return
	}
	var req aiChatRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Messages) == 0 || len(req.Messages) > aiChatMaxMessages {
		respondError(w, http.StatusBadRequest, "messages 需为 1-50 条")
		return
	}
	for _, m := range req.Messages {
		if len(m.Content) > aiChatMaxContentSize {
			respondError(w, http.StatusBadRequest, "单条消息内容过长")
			return
		}
	}
	reply, usage, err := h.Service.Chat(r.Context(), tenantID, req.Messages, req.Temperature, req.MaxTokens)
	if errors.Is(err, service.ErrAINotConfigured) {
		respondError(w, http.StatusPreconditionFailed, "ai_not_configured")
		return
	}
	var upErr *ai.UpstreamError
	if errors.As(err, &upErr) {
		respondError(w, http.StatusBadGateway, upErr.Message)
		return
	}
	if err != nil {
		respondServerError(w, r, err, "AI 对话失败")
		return
	}
	respondJSON(w, http.StatusOK, aiChatResponse{Reply: reply, Usage: usage})
}

type aiPositionAssistRequest struct {
	Field    service.PositionAssistField `json:"field"`
	Position service.PositionAssistInput `json:"position"`
}

// PositionAssist POST /ai/position-assist：岗位 AI 辅助编写（润色/拆解/推荐）。
// 仅生成建议文本，不写库；错误映射与 /ai/chat 一致：
// 未配置 → 412 ai_not_configured；上游非 2xx → 502 + 上游 message。
func (h *AIHandler) PositionAssist(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantIDRequired(w, r)
	if tenantID == "" {
		return
	}
	var req aiPositionAssistRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !service.ValidPositionAssistField(req.Field) {
		respondError(w, http.StatusBadRequest, "field 不合法")
		return
	}
	if len(req.Position.Responsibilities) > aiPositionMaxItems || len(req.Position.Requirements) > aiPositionMaxItems {
		respondError(w, http.StatusBadRequest, "职责/要求条目数超限")
		return
	}
	if len(req.Position.Name) > aiPositionMaxTextSize || len(req.Position.Description) > aiPositionMaxTextSize {
		respondError(w, http.StatusBadRequest, "岗位信息过长")
		return
	}
	for _, it := range append(append([]string{}, req.Position.Responsibilities...), req.Position.Requirements...) {
		if len(it) > aiPositionMaxTextSize {
			respondError(w, http.StatusBadRequest, "单条职责/要求内容过长")
			return
		}
	}
	result, err := h.Service.PositionAssist(r.Context(), tenantID, req.Field, req.Position)
	if errors.Is(err, service.ErrAINotConfigured) {
		respondError(w, http.StatusPreconditionFailed, "ai_not_configured")
		return
	}
	var upErr *ai.UpstreamError
	if errors.As(err, &upErr) {
		respondError(w, http.StatusBadGateway, upErr.Message)
		return
	}
	if err != nil {
		respondServerError(w, r, err, "AI 岗位编写失败")
		return
	}
	respondJSON(w, http.StatusOK, result)
}
