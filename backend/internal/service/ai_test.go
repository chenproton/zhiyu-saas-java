package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/crypto"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// setupAITest 需要 TEST_DATABASE_URL（真实库才能建表验证加密落库与脱敏视图）。
// 无 DB 时按仓库惯例 Skip，保证 `go test ./...` 不挂。
func setupAITest(t *testing.T) (*pgxpool.Pool, *AIService, string) {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		fmt.Println("[service] TEST_DATABASE_URL not set — integration test SKIPPED")
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}
	t.Cleanup(pool.Close)

	for _, mig := range []string{
		"../../migrations/147_tenant_ai_configs.up.sql",
		"../../migrations/149_ai_usage_logs.up.sql",
	} {
		upSQL, err := os.ReadFile(mig)
		if err != nil {
			t.Fatalf("read migration %s: %v", mig, err)
		}
		if _, err := pool.Exec(ctx, string(upSQL)); err != nil && !strings.Contains(err.Error(), "already exists") {
			t.Fatalf("apply migration %s: %v", mig, err)
		}
	}

	tenantID := uuid.NewString()
	if _, err := pool.Exec(ctx,
		`INSERT INTO tenants (id, name, code, status) VALUES ($1, 'AI 测试租户', $2, 'active')`,
		tenantID, "ai-test-"+tenantID[:8]); err != nil {
		t.Fatalf("insert tenant: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM tenants WHERE id = $1`, tenantID)
	})

	svc := NewAIService(New(store.New(pool)), nil, ai.NewClient(), "test-ai-secret")
	return pool, svc, tenantID
}

func TestAISaveThenGetMasked(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	if err := svc.SaveConfig(ctx, tenantID, "https://api.openai.com/v1", "sk-abcd1234", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	view, err := svc.GetConfig(ctx, tenantID)
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if !view.Configured {
		t.Fatal("保存后 configured 应为 true")
	}
	if view.BaseURL != "https://api.openai.com/v1" || view.Model != "gpt-4o-mini" {
		t.Fatalf("视图字段错误: %+v", view)
	}
	// 脱敏：不得包含明文 key 本体，仅保留末 4 位
	if strings.Contains(view.APIKeyMasked, "abcd") {
		t.Fatalf("api key 未脱敏: %q", view.APIKeyMasked)
	}
	if view.APIKeyMasked != "sk-****1234" {
		t.Fatalf("apiKeyMasked = %q, want sk-****1234", view.APIKeyMasked)
	}
}

func TestAISaveEmptyKeyKeepsOriginal(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	if err := svc.SaveConfig(ctx, tenantID, "https://api.openai.com/v1", "sk-original99", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	// 空 apiKey 更新 model，应保留原 key
	if err := svc.SaveConfig(ctx, tenantID, "https://api.deepseek.com/v1", "", "deepseek-chat"); err != nil {
		t.Fatalf("SaveConfig（空 key 保留）: %v", err)
	}
	st := store.New(poolFromService(t, svc))
	cfg, err := st.AIConfigs().Get(ctx, tenantID)
	if err != nil {
		t.Fatalf("store Get: %v", err)
	}
	plain, err := crypto.Decrypt("test-ai-secret", cfg.APIKeyEncrypted)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if plain != "sk-original99" {
		t.Fatalf("空 key 保存后原 key 被覆盖: %q", plain)
	}
	if cfg.Model != "deepseek-chat" || cfg.BaseURL != "https://api.deepseek.com/v1" {
		t.Fatalf("base_url/model 未更新: %+v", cfg)
	}
}

// poolFromService 仅为测试可读性：从 AIService 底层 store 取回连接池。
func poolFromService(t *testing.T, svc *AIService) *pgxpool.Pool {
	t.Helper()
	pool, ok := svc.Store().Q().(*pgxpool.Pool)
	if !ok {
		t.Fatalf("底层查询器不是连接池: %T", svc.Store().Q())
	}
	return pool
}

func TestAISaveFirstTimeWithoutKeyRejected(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	if err := svc.SaveConfig(context.Background(), tenantID, "https://api.openai.com/v1", "", "gpt-4o-mini"); !errors.Is(err, ErrAIKeyRequired) {
		t.Fatalf("首次配置空 key 应返回 ErrAIKeyRequired, got: %v", err)
	}
}

func TestAIChatNotConfigured(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	_, _, err := svc.Chat(context.Background(), tenantID, uuid.NewString(), []ai.Message{{Role: "user", Content: "hi"}}, nil, nil)
	if !errors.Is(err, ErrAINotConfigured) {
		t.Fatalf("未配置租户 Chat 应返回 ErrAINotConfigured, got: %v", err)
	}
}

func TestAIGetConfigNotConfigured(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	view, err := svc.GetConfig(context.Background(), tenantID)
	if err != nil {
		t.Fatalf("未配置 GetConfig 不应报错: %v", err)
	}
	if view.Configured {
		t.Fatal("未配置 configured 应为 false")
	}
}

// dailyByDate 便于按日期断言每日序列。
func dailyByDate(stats *AIUsageStats) map[string]AIUsageDay {
	m := make(map[string]AIUsageDay, len(stats.Daily))
	for _, d := range stats.Daily {
		m[d.Date] = d
	}
	return m
}

// assertDailyContinuous 校验每日序列长度 30、日期连续且以今天结尾。
func assertDailyContinuous(t *testing.T, stats *AIUsageStats) {
	t.Helper()
	if len(stats.Daily) != aiUsageDailyDays {
		t.Fatalf("Daily 长度 = %d, want %d", len(stats.Daily), aiUsageDailyDays)
	}
	prev, err := time.Parse("2006-01-02", stats.Daily[0].Date)
	if err != nil {
		t.Fatalf("解析首日日期: %v", err)
	}
	for i, d := range stats.Daily[1:] {
		cur, err := time.Parse("2006-01-02", d.Date)
		if err != nil {
			t.Fatalf("解析日期 %q: %v", d.Date, err)
		}
		if !cur.Equal(prev.AddDate(0, 0, 1)) {
			t.Fatalf("Daily 日期不连续: [%d]=%s 应为 %s 的后一天", i+1, d.Date, prev.Format("2006-01-02"))
		}
		prev = cur
	}
	if stats.Daily[len(stats.Daily)-1].Date != time.Now().Format("2006-01-02") {
		t.Fatalf("Daily 最后一天应为今天, got %s", stats.Daily[len(stats.Daily)-1].Date)
	}
}

func TestAIUsageStatsAggregates(t *testing.T) {
	pool, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	now := time.Now()
	noon := func(daysAgo int) time.Time {
		d := now.AddDate(0, 0, -daysAgo)
		return time.Date(d.Year(), d.Month(), d.Day(), 12, 0, 0, 0, d.Location())
	}
	// 今天 2 条、3 天前 1 条（均在 30 天窗口内）；40 天前 1 条（计入全量合计，不进每日序列）
	rows := []struct {
		daysAgo                 int
		prompt, completion, tot int
	}{
		{0, 60, 40, 100},
		{0, 30, 20, 50},
		{3, 120, 80, 200},
		{40, 180, 120, 300},
	}
	for _, r := range rows {
		if _, err := pool.Exec(ctx, `
			INSERT INTO ai_usage_logs (tenant_id, model, prompt_tokens, completion_tokens, total_tokens, created_at)
			VALUES ($1, 'gpt-4o-mini', $2, $3, $4, $5)
		`, tenantID, r.prompt, r.completion, r.tot, noon(r.daysAgo)); err != nil {
			t.Fatalf("insert usage log: %v", err)
		}
	}

	stats, err := svc.GetUsageStats(ctx, tenantID)
	if err != nil {
		t.Fatalf("GetUsageStats: %v", err)
	}
	if stats.TotalRequests != 4 || stats.TotalTokens != 650 {
		t.Fatalf("totals = (%d, %d), want (4, 650)", stats.TotalRequests, stats.TotalTokens)
	}
	assertDailyContinuous(t, stats)

	byDate := dailyByDate(stats)
	todayKey := now.Format("2006-01-02")
	if d := byDate[todayKey]; d.Tokens != 150 || d.Requests != 2 {
		t.Fatalf("今天 = %+v, want tokens=150 requests=2", d)
	}
	threeDaysKey := now.AddDate(0, 0, -3).Format("2006-01-02")
	if d := byDate[threeDaysKey]; d.Tokens != 200 || d.Requests != 1 {
		t.Fatalf("3 天前 = %+v, want tokens=200 requests=1", d)
	}
	// 无数据日期补 0
	fiveDaysKey := now.AddDate(0, 0, -5).Format("2006-01-02")
	if d := byDate[fiveDaysKey]; d.Tokens != 0 || d.Requests != 0 {
		t.Fatalf("无数据日期应为 0, got %+v", d)
	}
	// 40 天前的记录不在 30 天窗口内
	if _, ok := byDate[now.AddDate(0, 0, -40).Format("2006-01-02")]; ok {
		t.Fatal("40 天前的日期不应出现在近 30 天序列中")
	}
}

func TestAIUsageStatsEmpty(t *testing.T) {
	_, svc, tenantID := setupAITest(t)
	stats, err := svc.GetUsageStats(context.Background(), tenantID)
	if err != nil {
		t.Fatalf("GetUsageStats: %v", err)
	}
	if stats.TotalRequests != 0 || stats.TotalTokens != 0 {
		t.Fatalf("无数据 totals 应为 0, got (%d, %d)", stats.TotalRequests, stats.TotalTokens)
	}
	assertDailyContinuous(t, stats)
	for _, d := range stats.Daily {
		if d.Tokens != 0 || d.Requests != 0 {
			t.Fatalf("无数据租户每日应全 0, got %+v", d)
		}
	}
}

// TestAIChatRecordsUsage 回归：Chat 成功后自动落库 token 用量（mock 上游 server）。
func TestAIChatRecordsUsage(t *testing.T) {
	pool, svc, tenantID := setupAITest(t)
	ctx := context.Background()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"choices": [{"message": {"role": "assistant", "content": "你好"}}],
			"usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
		}`))
	}))
	defer srv.Close()

	if err := svc.SaveConfig(ctx, tenantID, srv.URL, "sk-test-key", "gpt-4o-mini"); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	userID := uuid.NewString()
	reply, usage, err := svc.Chat(ctx, tenantID, userID, []ai.Message{{Role: "user", Content: "hi"}}, nil, nil)
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if reply != "你好" || usage.TotalTokens != 15 {
		t.Fatalf("Chat 返回错误: reply=%q usage=%+v", reply, usage)
	}

	var (
		gotModel                                  string
		gotUserID                                 *string
		gotPrompt, gotCompletion, gotTotal, count int
	)
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(MAX(user_id::text), ''), MAX(model),
		       COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0), COALESCE(SUM(total_tokens), 0)
		FROM ai_usage_logs WHERE tenant_id = $1
	`, tenantID).Scan(&count, &gotUserID, &gotModel, &gotPrompt, &gotCompletion, &gotTotal); err != nil {
		t.Fatalf("query usage logs: %v", err)
	}
	if count != 1 {
		t.Fatalf("usage logs 条数 = %d, want 1", count)
	}
	if gotUserID == nil || *gotUserID != userID {
		t.Fatalf("user_id = %v, want %s", gotUserID, userID)
	}
	if gotModel != "gpt-4o-mini" || gotPrompt != 10 || gotCompletion != 5 || gotTotal != 15 {
		t.Fatalf("用量记录错误: model=%s prompt=%d completion=%d total=%d", gotModel, gotPrompt, gotCompletion, gotTotal)
	}
}

func TestMaskAPIKey(t *testing.T) {
	if got := maskAPIKey("abc"); got != "****" {
		t.Fatalf("短 key 应全遮蔽, got %q", got)
	}
	if got := maskAPIKey("sk-abcd1234"); got != "sk-****1234" {
		t.Fatalf("maskAPIKey = %q, want sk-****1234", got)
	}
}

// TestAIConfigCacheEntryRoundtrip 回归：缓存载荷必须保留密文 key。
// 曾因直接 json.Marshal(domain.TenantAIConfig)（APIKeyEncrypted 带 json:"-"）
// 导致缓存命中后 key 丢失、Chat 报 crypto: invalid token。
func TestAIConfigCacheEntryRoundtrip(t *testing.T) {
	cfg := &domain.TenantAIConfig{
		TenantID:        "t1",
		BaseURL:         "https://api.openai.com/v1",
		APIKeyEncrypted: "enc-key-abc",
		Model:           "gpt-4o-mini",
	}
	data, err := json.Marshal(aiConfigCacheEntry{
		TenantID:        cfg.TenantID,
		BaseURL:         cfg.BaseURL,
		APIKeyEncrypted: cfg.APIKeyEncrypted,
		Model:           cfg.Model,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var entry aiConfigCacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if entry.APIKeyEncrypted != cfg.APIKeyEncrypted {
		t.Fatalf("缓存载荷丢失密文 key: %q", entry.APIKeyEncrypted)
	}
}
