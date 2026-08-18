package store

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// DailyUsage 单日用量聚合（按 created_at 自然日分组）。
type DailyUsage struct {
	Day      time.Time
	Tokens   int64
	Requests int64
}

// AIUsageStore AI 调用用量记录持久化。
type AIUsageStore struct {
	q Queryer
}

// NewAIUsageStore 创建 AI 用量 store。
func NewAIUsageStore(q Queryer) *AIUsageStore {
	return &AIUsageStore{q: q}
}

// Insert 写入一条用量记录（UserID 为空时落 NULL）。
func (s *AIUsageStore) Insert(ctx context.Context, log *domain.AIUsageLog) error {
	var userID any
	if log.UserID != "" {
		userID = log.UserID
	}
	_, err := s.q.Exec(ctx, `
		INSERT INTO ai_usage_logs (tenant_id, user_id, model, prompt_tokens, completion_tokens, total_tokens)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, log.TenantID, userID, log.Model, log.PromptTokens, log.CompletionTokens, log.TotalTokens)
	return err
}

// Totals 租户全量统计：总请求次数与总 token 消耗。
func (s *AIUsageStore) Totals(ctx context.Context, tenantID string) (totalRequests int64, totalTokens int64, err error) {
	err = s.q.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_tokens), 0)
		FROM ai_usage_logs WHERE tenant_id = $1
	`, tenantID).Scan(&totalRequests, &totalTokens)
	return totalRequests, totalTokens, err
}

// Daily 按自然日聚合 since 以来的 token 消耗与请求次数（升序）。
func (s *AIUsageStore) Daily(ctx context.Context, tenantID string, since time.Time) ([]DailyUsage, error) {
	rows, err := s.q.Query(ctx, `
		SELECT date_trunc('day', created_at) AS day,
		       COALESCE(SUM(total_tokens), 0) AS tokens,
		       COUNT(*) AS requests
		FROM ai_usage_logs
		WHERE tenant_id = $1 AND created_at >= $2
		GROUP BY 1 ORDER BY 1
	`, tenantID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DailyUsage
	for rows.Next() {
		var d DailyUsage
		if err := rows.Scan(&d.Day, &d.Tokens, &d.Requests); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
