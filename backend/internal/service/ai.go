package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/crypto"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ErrAINotConfigured 租户尚未配置 AI 服务（handler 映射为 412）。
var ErrAINotConfigured = errors.New("service: tenant ai not configured")

// ErrAIKeyRequired 首次配置必须填写 api_key（handler 映射为 400）。
var ErrAIKeyRequired = errors.New("service: api key required on first setup")

// aiConfigCacheTTL 配置缓存有效期。
const aiConfigCacheTTL = 10 * time.Minute

// AIConfigView 配置对外视图：永不包含明文/密文 api key。
type AIConfigView struct {
	Configured   bool   `json:"configured"`
	BaseURL      string `json:"baseUrl,omitempty"`
	Model        string `json:"model,omitempty"`
	APIKeyMasked string `json:"apiKeyMasked,omitempty"`
}

// AIService 租户 AI 配置管理与对话编排。
type AIService struct {
	*Service
	st     *store.Store
	redis  *redis.Client
	client *ai.Client
	secret string
}

// NewAIService 创建 AI 服务；redis 可为 nil（无缓存直查 DB）。
func NewAIService(s *Service, redisClient *redis.Client, client *ai.Client, secret string) *AIService {
	return &AIService{Service: s, st: s.Store(), redis: redisClient, client: client, secret: secret}
}

func aiConfigCacheKey(tenantID string) string {
	return "ai:cfg:" + tenantID
}

// loadConfig 读穿缓存获取配置（缓存存密文版 JSON，命中后由调用方在内存中解密）；
// Redis 任意错误降级直查 DB 并尽力回填，不影响主流程。
func (s *AIService) loadConfig(ctx context.Context, tenantID string) (*domain.TenantAIConfig, error) {
	key := aiConfigCacheKey(tenantID)
	if s.redis != nil {
		if data, err := s.redis.Get(ctx, key).Bytes(); err == nil {
			var cfg domain.TenantAIConfig
			if json.Unmarshal(data, &cfg) == nil {
				return &cfg, nil
			}
		}
	}
	cfg, err := s.st.AIConfigs().Get(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if s.redis != nil {
		if data, mErr := json.Marshal(cfg); mErr == nil {
			_ = s.redis.Set(ctx, key, data, aiConfigCacheTTL).Err()
		}
	}
	return cfg, nil
}

// invalidateCache 失效配置缓存（尽力而为，失败不报错）。
func (s *AIService) invalidateCache(ctx context.Context, tenantID string) {
	if s.redis != nil {
		_ = s.redis.Del(ctx, aiConfigCacheKey(tenantID)).Err()
	}
}

// maskAPIKey 脱敏展示：sk-****+末 4 位；不足 4 位全遮蔽。
func maskAPIKey(key string) string {
	if len(key) < 4 {
		return "****"
	}
	return "sk-****" + key[len(key)-4:]
}

// GetConfig 返回租户 AI 配置视图；未配置返回 configured=false（不报错）。
func (s *AIService) GetConfig(ctx context.Context, tenantID string) (*AIConfigView, error) {
	cfg, err := s.loadConfig(ctx, tenantID)
	if errors.Is(err, store.ErrAIConfigNotFound) {
		return &AIConfigView{Configured: false}, nil
	}
	if err != nil {
		return nil, err
	}
	plain, err := crypto.Decrypt(s.secret, cfg.APIKeyEncrypted)
	if err != nil {
		return nil, err
	}
	return &AIConfigView{
		Configured:   true,
		BaseURL:      cfg.BaseURL,
		Model:        cfg.Model,
		APIKeyMasked: maskAPIKey(plain),
	}, nil
}

// SaveConfig 保存租户 AI 配置。apiKey 为空时保留已有 key；
// 无已有配置且 key 为空视为参数错误。
func (s *AIService) SaveConfig(ctx context.Context, tenantID, baseURL, apiKey, model string) error {
	if baseURL == "" || model == "" {
		return errors.New("base_url 与 model 不能为空")
	}
	keyToStore := apiKey
	if keyToStore == "" {
		existing, err := s.st.AIConfigs().Get(ctx, tenantID)
		if errors.Is(err, store.ErrAIConfigNotFound) {
			return ErrAIKeyRequired
		}
		if err != nil {
			return err
		}
		plain, err := crypto.Decrypt(s.secret, existing.APIKeyEncrypted)
		if err != nil {
			return err
		}
		keyToStore = plain
	}
	encrypted, err := crypto.Encrypt(s.secret, keyToStore)
	if err != nil {
		return err
	}
	if err := s.st.AIConfigs().Upsert(ctx, &domain.TenantAIConfig{
		TenantID:        tenantID,
		BaseURL:         baseURL,
		APIKeyEncrypted: encrypted,
		Model:           model,
		Extra:           domain.JSONMap{},
	}); err != nil {
		return err
	}
	s.invalidateCache(ctx, tenantID)
	return nil
}

// DeleteConfig 删除租户 AI 配置并失效缓存。
func (s *AIService) DeleteConfig(ctx context.Context, tenantID string) error {
	if err := s.st.AIConfigs().Delete(ctx, tenantID); err != nil {
		return err
	}
	s.invalidateCache(ctx, tenantID)
	return nil
}

// Chat 用租户自有 AI 配置发起对话（非流式）。
// 未配置返回 ErrAINotConfigured；上游错误以 *ai.UpstreamError 透传。
func (s *AIService) Chat(ctx context.Context, tenantID string, messages []ai.Message, temperature *float64, maxTokens *int) (string, ai.Usage, error) {
	var usage ai.Usage
	cfg, err := s.loadConfig(ctx, tenantID)
	if errors.Is(err, store.ErrAIConfigNotFound) {
		return "", usage, ErrAINotConfigured
	}
	if err != nil {
		return "", usage, err
	}
	apiKey, err := crypto.Decrypt(s.secret, cfg.APIKeyEncrypted)
	if err != nil {
		return "", usage, err
	}
	return s.client.ChatCompletion(ctx, ai.Config{
		BaseURL: cfg.BaseURL,
		APIKey:  apiKey,
		Model:   cfg.Model,
	}, ai.ChatRequest{
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
	})
}
