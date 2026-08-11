package service

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
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

// aiConfigCacheEntry 缓存载荷：独立结构，不直接序列化 domain.TenantAIConfig——
// 其 APIKeyEncrypted 带 json:"-"，直接 marshal 会丢 key，命中缓存后解密必失败。
type aiConfigCacheEntry struct {
	TenantID        string `json:"t"`
	BaseURL         string `json:"b"`
	APIKeyEncrypted string `json:"k"`
	Model           string `json:"m"`
}

// loadConfig 读穿缓存获取配置（缓存存密文版 JSON，命中后由调用方在内存中解密）；
// Redis 任意错误降级直查 DB 并尽力回填，不影响主流程。
func (s *AIService) loadConfig(ctx context.Context, tenantID string) (*domain.TenantAIConfig, error) {
	key := aiConfigCacheKey(tenantID)
	if s.redis != nil {
		if data, err := s.redis.Get(ctx, key).Bytes(); err == nil {
			var entry aiConfigCacheEntry
			// APIKeyEncrypted 为空视为坏缓存（如旧版本写入的缺 key 载荷），按未命中处理
			if json.Unmarshal(data, &entry) == nil && entry.APIKeyEncrypted != "" {
				return &domain.TenantAIConfig{
					TenantID:        entry.TenantID,
					BaseURL:         entry.BaseURL,
					APIKeyEncrypted: entry.APIKeyEncrypted,
					Model:           entry.Model,
				}, nil
			}
		}
	}
	cfg, err := s.st.AIConfigs().Get(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if s.redis != nil {
		if data, mErr := json.Marshal(aiConfigCacheEntry{
			TenantID:        cfg.TenantID,
			BaseURL:         cfg.BaseURL,
			APIKeyEncrypted: cfg.APIKeyEncrypted,
			Model:           cfg.Model,
		}); mErr == nil {
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

// AIUsageDay 单日用量（对外视图，Date 为 2006-01-02 格式）。
type AIUsageDay struct {
	Date     string `json:"date"`
	Tokens   int64  `json:"tokens"`
	Requests int64  `json:"requests"`
}

// AIUsageStats 租户 AI 用量统计：全量合计 + AI 套餐 token 额度 + 近 30 天每日序列（缺数据日期补 0）。
type AIUsageStats struct {
	TotalRequests int64 `json:"totalRequests"`
	TotalTokens   int64 `json:"totalTokens"`
	// TokenQuota AI 套餐 token 额度（来自订阅 ai_token_quota，未设置时为 0）。
	TokenQuota int64        `json:"tokenQuota"`
	Daily      []AIUsageDay `json:"daily"`
}

// aiUsageDailyDays 用量看板每日序列天数（含今天）。
const aiUsageDailyDays = 30

// recordUsage best-effort 记录 token 用量：落库失败只记日志，不影响主流程。
// 所有 LLM 调用路径（Chat/PositionAssist 等）成功后都必须调用。
func (s *AIService) recordUsage(ctx context.Context, tenantID, userID, model string, usage ai.Usage) {
	if err := s.st.AIUsage().Insert(ctx, &domain.AIUsageLog{
		TenantID:         tenantID,
		UserID:           userID,
		Model:            model,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
	}); err != nil {
		slog.Warn("record ai usage failed", "tenantId", tenantID, "error", err)
	}
}

// Chat 用租户自有 AI 配置发起对话（非流式）。
// 未配置返回 ErrAINotConfigured；上游错误以 *ai.UpstreamError 透传。
// 上游调用成功后 best-effort 记录 token 用量（落库失败只记日志，不影响响应）。
func (s *AIService) Chat(ctx context.Context, tenantID, userID string, messages []ai.Message, temperature *float64, maxTokens *int) (string, ai.Usage, error) {
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
	reply, usage, err := s.client.ChatCompletion(ctx, ai.Config{
		BaseURL: cfg.BaseURL,
		APIKey:  apiKey,
		Model:   cfg.Model,
	}, ai.ChatRequest{
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
	})
	if err != nil {
		return "", usage, err
	}
	s.recordUsage(ctx, tenantID, userID, cfg.Model, usage)
	return reply, usage, nil
}

// GetUsageStats 返回租户 AI 用量统计：全量请求数/Token 数 + 套餐 token 额度 + 近 30 天每日序列，
// 无数据的日期补 0，前端可直接渲染。订阅缺失时额度按 0 处理，不阻塞用量统计。
func (s *AIService) GetUsageStats(ctx context.Context, tenantID string) (*AIUsageStats, error) {
	totalRequests, totalTokens, err := s.st.AIUsage().Totals(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var quota int64
	if sub, err := s.st.Subscriptions().GetByTenant(ctx, tenantID); err == nil {
		quota = sub.AITokenQuota
	} else if !errors.Is(err, store.ErrNotFound) {
		slog.Warn("load subscription for ai usage failed", "tenantId", tenantID, "error", err)
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	since := today.AddDate(0, 0, -(aiUsageDailyDays - 1))
	rows, err := s.st.AIUsage().Daily(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}
	byDay := make(map[string]store.DailyUsage, len(rows))
	for _, r := range rows {
		byDay[r.Day.Format("2006-01-02")] = r
	}
	daily := make([]AIUsageDay, 0, aiUsageDailyDays)
	for d := since; !d.After(today); d = d.AddDate(0, 0, 1) {
		day := AIUsageDay{Date: d.Format("2006-01-02")}
		if r, ok := byDay[day.Date]; ok {
			day.Tokens = r.Tokens
			day.Requests = r.Requests
		}
		daily = append(daily, day)
	}
	return &AIUsageStats{
		TotalRequests: totalRequests,
		TotalTokens:   totalTokens,
		TokenQuota:    quota,
		Daily:         daily,
	}, nil
}
