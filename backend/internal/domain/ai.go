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
