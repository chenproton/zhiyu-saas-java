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
// - is_public=false 协议被排除（业务 status 不再参与展示过滤）
// - 仅关联非 enable_public 企业的协议被排除
// - 响应不含 content/attachments 等敏感字段
// 需要 TEST_DATABASE_URL（testhelper 未配置时自动 skip）。
func TestAlliancePublicAgreements(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	// 三家企业：一家 enable_public，一家不开启，一家双控均开但合作已终止（tenant 分支应排除）
	entPub, entPriv, entTerm := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for id, enable := range map[string]bool{entPub: true, entPriv: false, entTerm: true} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO partner_enterprises (id, tenant_id, name, enable_public)
			VALUES ($1, $2, $3, $4)
		`, id, testhelper.TestTenantID, "公开协议测试企业-"+suffix+"-"+id[:4], enable); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id IN ($1,$2,$3)`, entPub, entPriv, entTerm)

	// 学校-企业关联（is_public=true），供 tenantId 双控分支使用；
	// entTerm 的 link 双控均开但 status='terminated'，tenant 分支应排除
	linkID, linkTermID := uuid.NewString(), uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, is_public)
		VALUES ($1, $2, $3, true)
	`, linkID, testhelper.TestTenantID, entPub); err != nil {
		t.Fatalf("预置企业关联失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, is_public, status)
		VALUES ($1, $2, $3, true, 'terminated')
	`, linkTermID, testhelper.TestTenantID, entTerm); err != nil {
		t.Fatalf("预置终止合作关联失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE id IN ($1,$2)`, linkID, linkTermID)

	secretContent := "SECRET-AGREEMENT-CONTENT-" + suffix
	secretAttachment := "secret-agreement-" + suffix + ".pdf"

	// 公开项目（关联公开企业 entPub），供"仅关联项目"的协议 a5 使用
	projectID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_projects (id, tenant_id, name, enterprise_ids, is_public)
		VALUES ($1, $2, $3, jsonb_build_array($4::text), true)
	`, projectID, testhelper.TestTenantID, "公开协议关联项目-"+suffix, entPub); err != nil {
		t.Fatalf("预置项目失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_projects WHERE id = $1`, projectID)

	// a1 应可见（is_public=true + 公开企业，status=draft 不再影响展示）；a2 is_public=false 排除；
	// a3 仅关联非公开企业排除；a4 关联已终止合作企业（tenant 分支排除）；
	// a5 仅关联项目（project_ids，未直接关联企业）——经项目二次关联应可见
	a1, a2, a3, a4, a5 := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	seed := []struct {
		id       string
		name     string
		status   string
		isPublic bool
		entID    string
		projID   string
		content  string
	}{
		{a1, "公开协议-" + suffix, "draft", true, entPub, "", secretContent},
		{a2, "隐藏协议-" + suffix, "active", false, entPub, "", secretContent},
		{a3, "私企协议-" + suffix, "active", true, entPriv, "", secretContent},
		{a4, "终止合作协议-" + suffix, "active", true, entTerm, "", secretContent},
		{a5, "项目协议-" + suffix, "active", true, "", projectID, secretContent},
	}
	for _, s := range seed {
		var q string
		args := []any{s.id, testhelper.TestTenantID, s.name, s.status, s.content, secretAttachment, s.isPublic}
		if s.entID != "" {
			q = `
				INSERT INTO alliance_agreements (id, tenant_id, name, status, enterprise_ids, content, attachments, is_public)
				VALUES ($1, $2, $3, $4, jsonb_build_array($5::text), $6, jsonb_build_array($7::text), $8)`
			args = []any{s.id, testhelper.TestTenantID, s.name, s.status, s.entID, s.content, secretAttachment, s.isPublic}
		} else {
			q = `
				INSERT INTO alliance_agreements (id, tenant_id, name, status, project_ids, content, attachments, is_public)
				VALUES ($1, $2, $3, $4, jsonb_build_array($5::text), $6, jsonb_build_array($7::text), $8)`
			args = []any{s.id, testhelper.TestTenantID, s.name, s.status, s.projID, s.content, secretAttachment, s.isPublic}
		}
		if _, err := env.DB.Exec(ctx, q, args...); err != nil {
			t.Fatalf("预置协议失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_agreements WHERE id IN ($1,$2,$3,$4,$5)`, a1, a2, a3, a4, a5)

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
		// 应返回：直接关联的 a1 + 仅项目关联的 a5
		ids := map[string]bool{}
		for _, it := range items {
			ids[it.ID] = true
		}
		if len(items) != 2 || !ids[a1] || !ids[a5] {
			t.Fatalf("应返回 a1 与 a5（项目二次关联）: %s", w.Body.String())
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
		var foundA1, foundA5 bool
		for _, it := range items {
			if it.ID == a2 || it.ID == a3 {
				t.Fatalf("is_public=false/非公开企业协议不应公开: %s", w.Body.String())
			}
			if it.ID == a1 {
				foundA1 = true
			}
			if it.ID == a5 {
				foundA5 = true
			}
		}
		if !foundA1 || !foundA5 {
			t.Fatalf("公开协议 a1/a5 未返回: %s", w.Body.String())
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
