package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAlliancePublicAgreements 公开协议接口回归：
// - draft 协议被排除
// - 仅关联非 enable_public 企业的协议被排除
// - 响应不含 content/attachments 等敏感字段
// 需要 TEST_DATABASE_URL（testhelper 未配置时自动 skip）。
func TestAlliancePublicAgreements(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	// 两家企业：一家 enable_public，一家不开启
	entPub, entPriv := uuid.NewString(), uuid.NewString()
	for id, enable := range map[string]bool{entPub: true, entPriv: false} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO partner_enterprises (id, tenant_id, name, enable_public)
			VALUES ($1, $2, $3, $4)
		`, id, testhelper.TestTenantID, "公开协议测试企业-"+suffix+"-"+id[:4], enable); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id IN ($1,$2)`, entPub, entPriv)

	// 学校-企业关联（is_public=true），供 tenantId 双控分支使用
	linkID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, is_public)
		VALUES ($1, $2, $3, true)
	`, linkID, testhelper.TestTenantID, entPub); err != nil {
		t.Fatalf("预置企业关联失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE id = $1`, linkID)

	secretContent := "SECRET-AGREEMENT-CONTENT-" + suffix
	secretAttachment := "secret-agreement-" + suffix + ".pdf"

	// a1 应可见（active + 公开企业）；a2 draft 排除；a3 仅关联非公开企业排除
	a1, a2, a3 := uuid.NewString(), uuid.NewString(), uuid.NewString()
	seed := []struct {
		id      string
		name    string
		status  string
		entID   string
		content string
	}{
		{a1, "公开协议-" + suffix, "active", entPub, secretContent},
		{a2, "草稿协议-" + suffix, "draft", entPub, secretContent},
		{a3, "私企协议-" + suffix, "active", entPriv, secretContent},
	}
	for _, s := range seed {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_agreements (id, tenant_id, name, status, enterprise_ids, content, attachments)
			VALUES ($1, $2, $3, $4, jsonb_build_array($5::text), $6, jsonb_build_array($7::text))
		`, s.id, testhelper.TestTenantID, s.name, s.status, s.entID, s.content, secretAttachment); err != nil {
			t.Fatalf("预置协议失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_agreements WHERE id IN ($1,$2,$3)`, a1, a2, a3)

	type item struct {
		ID            string   `json:"id"`
		Name          string   `json:"name"`
		Status        string   `json:"status"`
		EnterpriseIDs []string `json:"enterpriseIds"`
	}

	t.Run("tenant 双控过滤", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/agreements?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items) != 1 || items[0].ID != a1 {
			t.Fatalf("应只返回公开协议 %s: %s", a1, w.Body.String())
		}
	})

	t.Run("无 tenantId 全局过滤", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/agreements", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		var found bool
		for _, it := range items {
			if it.ID == a2 || it.ID == a3 {
				t.Fatalf("draft/非公开企业协议不应公开: %s", w.Body.String())
			}
			if it.ID == a1 {
				found = true
			}
		}
		if !found {
			t.Fatalf("公开协议 %s 未返回: %s", a1, w.Body.String())
		}
	})

	t.Run("敏感字段不下发", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/agreements?tenantId="+testhelper.TestTenantID, nil)
		body := w.Body.String()
		if strings.Contains(body, secretContent) || strings.Contains(body, secretAttachment) {
			t.Fatalf("协议正文/附件不应出现在公开响应: %s", body)
		}
		// 结构层面确认 DTO 不含 content/attachments 键
		var raw []map[string]json.RawMessage
		if err := json.Unmarshal([]byte(body[strings.Index(body, "["):strings.LastIndex(body, "]")+1]), &raw); err == nil {
			for _, m := range raw {
				if _, ok := m["content"]; ok {
					t.Fatalf("公开 DTO 不应含 content 键: %s", body)
				}
				if _, ok := m["attachments"]; ok {
					t.Fatalf("公开 DTO 不应含 attachments 键: %s", body)
				}
			}
		}
	})
}
