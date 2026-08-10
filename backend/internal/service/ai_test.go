package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/crypto"
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

	upSQL, err := os.ReadFile("../../migrations/147_tenant_ai_configs.up.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	if _, err := pool.Exec(ctx, string(upSQL)); err != nil && !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("apply migration 147: %v", err)
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
	_, _, err := svc.Chat(context.Background(), tenantID, []ai.Message{{Role: "user", Content: "hi"}}, nil, nil)
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

func TestMaskAPIKey(t *testing.T) {
	if got := maskAPIKey("abc"); got != "****" {
		t.Fatalf("短 key 应全遮蔽, got %q", got)
	}
	if got := maskAPIKey("sk-abcd1234"); got != "sk-****1234" {
		t.Fatalf("maskAPIKey = %q, want sk-****1234", got)
	}
}
