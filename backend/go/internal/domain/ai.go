package domain

import "time"

// TenantAIConfig 租户级 AI 服务接入配置（OpenAI 兼容端点）。
// APIKeyEncrypted 为密文（AES-256-GCM），任何对外响应都不得携带该字段。
type TenantAIConfig struct {
	TenantID        string    `json:"tenantId"`
	BaseURL         string    `json:"baseUrl"`
	APIKeyEncrypted string    `json:"-"`
	Model           string    `json:"model"`
	Extra           JSONMap   `json:"extra,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// AIUsageLog 一次 LLM 调用的 token 用量记录（上游调用成功后落库）。
type AIUsageLog struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenantId"`
	UserID           string    `json:"userId,omitempty"`
	Model            string    `json:"model"`
	PromptTokens     int       `json:"promptTokens"`
	CompletionTokens int       `json:"completionTokens"`
	TotalTokens      int       `json:"totalTokens"`
	CreatedAt        time.Time `json:"createdAt"`
}
