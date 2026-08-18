package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAlliancePublicMilestones 公开里程碑接口回归：
// - 公开项目（is_public=true + 关联 enable_public 企业）的里程碑可见
// - 未公开项目 / 关联非公开企业的项目里程碑被排除
// - tenantId 分支按本校链接双控校验（terminated 合作排除）
func TestAlliancePublicMilestones(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	suffix := uuid.NewString()[:8]

	entPub, entPriv := uuid.NewString(), uuid.NewString()
	for id, enable := range map[string]bool{entPub: true, entPriv: false} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO partner_enterprises (id, tenant_id, name, enable_public)
			VALUES ($1, $2, $3, $4)
		`, id, testhelper.TestTenantID, "公开里程碑测试企业-"+suffix+"-"+id[:4], enable); err != nil {
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

	// pPub：公开项目（关联 entPub）；pHidden：is_public=false；pPriv：关联非公开企业
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
		`, p.id, testhelper.TestTenantID, "里程碑测试项目-"+suffix+"-"+p.id[:4], p.entID, p.isPublic); err != nil {
			t.Fatalf("预置项目失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_projects WHERE id IN ($1,$2,$3)`, pPub, pHidden, pPriv)

	// pPub 两条里程碑：一条完成一条未完成；pHidden/pPriv 各一条
	msPubDone, msPubTodo := uuid.NewString(), uuid.NewString()
	msHidden, msPriv := uuid.NewString(), uuid.NewString()
	seed := []struct {
		id        string
		projectID string
		name      string
		done      bool
	}{
		{msPubDone, pPub, "里程碑-完成-" + suffix, true},
		{msPubTodo, pPub, "里程碑-进行中-" + suffix, false},
		{msHidden, pHidden, "里程碑-隐藏项目-" + suffix, false},
		{msPriv, pPriv, "里程碑-私企项目-" + suffix, false},
	}
	for _, m := range seed {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_project_milestones (id, tenant_id, project_id, name, is_completed, sort_order)
			VALUES ($1, $2, $3, $4, $5, 1)
		`, m.id, testhelper.TestTenantID, m.projectID, m.name, m.done); err != nil {
			t.Fatalf("预置里程碑失败: %v", err)
		}
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_project_milestones WHERE id IN ($1,$2,$3,$4)`, msPubDone, msPubTodo, msHidden, msPriv)

	type item struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		IsCompleted bool   `json:"isCompleted"`
	}

	type projectItem struct {
		ID       string `json:"id"`
		Progress int    `json:"progress"`
	}

	t.Run("公开项目列表返回里程碑完成率 progress", func(t *testing.T) {
		// pPub 两条里程碑一完成一未完成 → 50%；无里程碑项目 → 0%
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/projects?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[projectItem](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		found := false
		for _, p := range items {
			if p.ID == pPub {
				found = true
				if p.Progress != 50 {
					t.Fatalf("pPub progress 应为 50, got %d", p.Progress)
				}
			}
		}
		if !found {
			t.Fatalf("公开列表应包含 pPub: %s", w.Body.String())
		}
		w2 := env.Do(http.MethodGet, "/api/v1/alliance/public/projects/"+pPub+"?tenantId="+testhelper.TestTenantID, nil)
		if w2.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
		}
		var detail projectItem
		detail, err = testhelper.Unmarshal[projectItem](w2)
		if err != nil {
			t.Fatalf("unmarshal detail: %v", err)
		}
		if detail.Progress != 50 {
			t.Fatalf("详情 progress 应为 50, got %d", detail.Progress)
		}
	})

	t.Run("tenant 双控：仅公开项目的里程碑", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/projects/"+pPub+"/milestones?tenantId="+testhelper.TestTenantID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items) != 2 {
			t.Fatalf("应返回 2 条里程碑: %s", w.Body.String())
		}
	})

	t.Run("tenant 双控：隐藏项目/非公开企业项目排除", func(t *testing.T) {
		for _, pid := range []string{pHidden, pPriv} {
			w := env.Do(http.MethodGet, "/api/v1/alliance/public/projects/"+pid+"/milestones?tenantId="+testhelper.TestTenantID, nil)
			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
			}
			items, _, err := testhelper.UnmarshalList[item](w)
			if err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if len(items) != 0 {
				t.Fatalf("项目 %s 的里程碑不应公开: %s", pid, w.Body.String())
			}
		}
	})

	t.Run("无 tenantId 全局：隐藏项目仍排除", func(t *testing.T) {
		w := env.Do(http.MethodGet, "/api/v1/alliance/public/projects/"+pPub+"/milestones", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[item](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items) != 2 {
			t.Fatalf("应返回 2 条里程碑: %s", w.Body.String())
		}
		w2 := env.Do(http.MethodGet, "/api/v1/alliance/public/projects/"+pHidden+"/milestones", nil)
		items2, _, err := testhelper.UnmarshalList[item](w2)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if len(items2) != 0 {
			t.Fatalf("隐藏项目里程碑不应公开: %s", w2.Body.String())
		}
	})
}
