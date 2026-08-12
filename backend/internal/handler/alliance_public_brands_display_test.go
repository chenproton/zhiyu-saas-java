package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAlliancePublicBrandsDisplaySwitch 公开品牌展示回归：
// - is_public=true 的 draft 品牌应出现在前台列表与详情（前台展示开关为唯一展示门槛）
// - is_public=true 的 archived 品牌不应展示（归档下架语义保留）
// - is_public=false 的品牌不应展示
func TestAlliancePublicBrandsDisplaySwitch(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	type brand struct {
		id  string
		row []any
	}
	brands := []brand{
		{ // 草稿 + 前台展示开：应可见
			id: uuid.NewString(),
			row: []any{uuid.NewString(), testhelper.TestTenantID, "employer",
				"公开测试草稿品牌-" + suffix, "draft", true},
		},
		{ // 已发布 + 前台展示关：不可见（开关为准）
			id: uuid.NewString(),
			row: []any{uuid.NewString(), testhelper.TestTenantID, "employer",
				"公开测试关开关品牌-" + suffix, "published", false},
		},
		{ // 已归档 + 前台展示开：不可见（归档下架）
			id: uuid.NewString(),
			row: []any{uuid.NewString(), testhelper.TestTenantID, "employer",
				"公开测试归档品牌-" + suffix, "archived", true},
		},
	}
	for _, b := range brands {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public, data)
			VALUES ($1, $2, $3, $4, $5, $6, '{}')
		`, b.row...); err != nil {
			t.Fatalf("预置品牌失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM alliance_brands WHERE id = $1`, b.id)
	}

	t.Run("列表：draft 开开关可见，archived/关开关不可见", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/brands?brandType=employer", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		type b struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		items, _, err := testhelper.UnmarshalList[b](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		byName := map[string]bool{}
		for _, it := range items {
			byName[it.Name] = true
		}
		if !byName["公开测试草稿品牌-"+suffix] {
			t.Fatalf("draft+开开关的品牌应出现在公开列表: %s", w.Body.String())
		}
		if byName["公开测试关开关品牌-"+suffix] {
			t.Fatalf("关开关的品牌不应出现在公开列表: %s", w.Body.String())
		}
		if byName["公开测试归档品牌-"+suffix] {
			t.Fatalf("归档品牌不应出现在公开列表: %s", w.Body.String())
		}
	})

	t.Run("详情：draft 开开关品牌可访问", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/brands/"+brands[0].id, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("draft 品牌详情应 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("详情：归档品牌 404", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/brands/"+brands[2].id, nil)
		if w.Code != http.StatusNotFound {
			t.Fatalf("归档品牌详情应 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}
