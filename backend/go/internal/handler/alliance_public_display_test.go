package handler_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAlliancePublicDisplayFields 前台展示字段回归：
// - 公开企业列表（tenant 分支）返回学校侧评级 rating
// - 公开专家返回归属企业名称 enterpriseName（不再回退显示 UUID）
// - 公开列表分页 offset 生效
func TestAlliancePublicDisplayFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	entID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO partner_enterprises (id, tenant_id, name, enable_public)
		VALUES ($1, $2, $3, true)
	`, entID, testhelper.TestTenantID, "展示字段测试企业-"+suffix); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)

	linkID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, is_public, rating)
		VALUES ($1, $2, $3, true, 'strategic')
	`, linkID, testhelper.TestTenantID, entID); err != nil {
		t.Fatalf("预置企业关联失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE id = $1`, linkID)

	expID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, is_public, status)
		VALUES ($1, $2, $3, $4, true, 'active')
	`, expID, testhelper.TestTenantID, "展示字段测试专家-"+suffix, entID); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, expID)

	t.Run("公开企业列表返回评级", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/enterprises?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		type ent struct {
			ID     string  `json:"id"`
			Rating *string `json:"rating"`
		}
		items, _, err := testhelper.UnmarshalList[ent](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		for _, it := range items {
			if it.ID == entID {
				if it.Rating == nil || *it.Rating != "strategic" {
					t.Fatalf("企业评级应返回 strategic: %s", w.Body.String())
				}
				return
			}
		}
		t.Fatalf("测试企业未出现在列表: %s", w.Body.String())
	})

	t.Run("公开专家返回企业名称", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/experts?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		type exp struct {
			ID             string  `json:"id"`
			EnterpriseName *string `json:"enterpriseName"`
		}
		items, _, err := testhelper.UnmarshalList[exp](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		for _, it := range items {
			if it.ID == expID {
				if it.EnterpriseName == nil || *it.EnterpriseName != "展示字段测试企业-"+suffix {
					t.Fatalf("专家应返回企业名称: %s", w.Body.String())
				}
				return
			}
		}
		t.Fatalf("测试专家未出现在列表: %s", w.Body.String())
	})

	t.Run("公开专家详情返回企业名称", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/experts/"+expID+"?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "展示字段测试企业-"+suffix) {
			t.Fatalf("详情应包含企业名称: %s", w.Body.String())
		}
	})

	t.Run("公开列表分页 offset 生效", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/experts?tenantId="+testhelper.TestTenantID+"&limit=1&offset=1", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		type exp struct {
			ID string `json:"id"`
		}
		items, _, err := testhelper.UnmarshalList[exp](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		for _, it := range items {
			if it.ID == expID {
				t.Fatalf("offset=1 不应返回第一条专家: %s", w.Body.String())
			}
		}
	})
}
