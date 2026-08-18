package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAlliancePublicAchievementProjectLink 公开成果"经项目二次关联"可见性回归：
// - 成果仅关联项目（project_ids，未直接关联企业）时，公开列表与详情均可见
// - 未公开成果 / 关联非公开项目的成果仍排除
func TestAlliancePublicAchievementProjectLink(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	entPub, entPriv := uuid.NewString(), uuid.NewString()
	for id, enable := range map[string]bool{entPub: true, entPriv: false} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO partner_enterprises (id, tenant_id, name, enable_public)
			VALUES ($1, $2, $3, $4)
		`, id, testhelper.TestTenantID, "成果二次关联测试企业-"+suffix+"-"+id[:4], enable); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id IN ($1,$2)`, entPub, entPriv)

	linkID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, is_public)
		VALUES ($1, $2, $3, true)
	`, linkID, testhelper.TestTenantID, entPub); err != nil {
		t.Fatalf("预置企业关联失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE id = $1`, linkID)

	// pPub：公开项目（关联公开企业）；pHidden：is_public=false；pPriv：关联非公开企业
	pPub, pHidden, pPriv := uuid.NewString(), uuid.NewString(), uuid.NewString()
	projects := []struct {
		id       string
		isPublic bool
		entID    string
	}{
		{pPub, true, entPub},
		{pHidden, false, entPub},
		{pPriv, true, entPriv},
	}
	for _, p := range projects {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_projects (id, tenant_id, name, enterprise_ids, is_public)
			VALUES ($1, $2, $3, jsonb_build_array($4::text), $5)
		`, p.id, testhelper.TestTenantID, "成果二次关联测试项目-"+suffix+"-"+p.id[:4], p.entID, p.isPublic); err != nil {
			t.Fatalf("预置项目失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_projects WHERE id IN ($1,$2,$3)`, pPub, pHidden, pPriv)

	// ach1：仅关联 pPub（应可见）；achHidden：is_public=false；achPriv：仅关联 pPriv（应排除）
	ach1, achHidden, achPriv := uuid.NewString(), uuid.NewString(), uuid.NewString()
	seed := []struct {
		id       string
		isPublic bool
		projID   string
	}{
		{ach1, true, pPub},
		{achHidden, false, pPub},
		{achPriv, true, pPriv},
	}
	for _, a := range seed {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_achievements (id, tenant_id, title, project_ids, is_public)
			VALUES ($1, $2, $3, jsonb_build_array($4::text), $5)
		`, a.id, testhelper.TestTenantID, "成果二次关联测试成果-"+suffix+"-"+a.id[:4], a.projID, a.isPublic); err != nil {
			t.Fatalf("预置成果失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_achievements WHERE id IN ($1,$2,$3)`, ach1, achHidden, achPriv)

	type item struct {
		ID string `json:"id"`
	}

	t.Run("tenant 列表：仅项目关联的成果可见", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/achievements?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		ids := map[string]bool{}
		for _, it := range items {
			ids[it.ID] = true
		}
		if len(items) != 1 || !ids[ach1] {
			t.Fatalf("应只返回经项目关联的 %s: %s", ach1, w.Body.String())
		}
	})

	t.Run("tenant 详情：仅项目关联的成果可打开", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/achievements/"+ach1+"?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("tenant 详情：非公开项目关联的成果不可打开", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/achievements/"+achPriv+"?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("全局列表：仅项目关联且项目公开的成果可见", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/achievements", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		ids := map[string]bool{}
		for _, it := range items {
			ids[it.ID] = true
		}
		if !ids[ach1] || ids[achPriv] || ids[achHidden] {
			t.Fatalf("应只含 %s: %s", ach1, w.Body.String())
		}
	})
}
