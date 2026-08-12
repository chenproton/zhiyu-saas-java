package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestGrantResourceOptions_AllSchoolResources 可授权资源候选：
// 返回本校全部岗位/场景（所有状态），携带批次分组、状态与来源企业信息；
// 他租户资源不出现。
func TestGrantResourceOptions_AllSchoolResources(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	// 预置企业主体（企业来源岗位/场景指向）
	entID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entID, tenantID, "授权来源企业-"+entID[:8]); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)

	// 批次（岗位批次 + 场景批次）
	batchID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO batches (id, tenant_id, name) VALUES ($1,$2,$3)`,
		batchID, tenantID, "岗位批次A"); err != nil {
		t.Fatalf("预置岗位批次失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM batches WHERE id = $1`, batchID)
	sceneBatchID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO scene_batches (id, tenant_id, name) VALUES ($1,$2,$3)`,
		sceneBatchID, tenantID, "场景批次A"); err != nil {
		t.Fatalf("预置场景批次失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM scene_batches WHERE id = $1`, sceneBatchID)

	// 岗位：学校自建草稿（带批次）、学校自建已发布（无批次）、企业来源已归档（带批次）
	posDraft, posPublished, posEnt := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, p := range []struct {
		id       string
		name     string
		status   string
		batch    *string
		sourceID *string
	}{
		{posDraft, "自建草稿岗位", "draft", &batchID, nil},
		{posPublished, "自建发布岗位", "published", nil, nil},
		{posEnt, "企业来源岗位", "archived", &batchID, &entID},
	} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, source_enterprise_id, batch_id, version, created_by)
			VALUES ($1,$2,$3,$4,'internship',$5, CASE WHEN $6 IS NULL THEN 'school' ELSE 'enterprise' END, $6, $7, 'V1.0', $8)
		`, p.id, tenantID, "opt-"+p.id[:8], p.name, p.status, p.sourceID, p.batch, testhelper.TestOperatorID); err != nil {
			t.Fatalf("预置岗位失败: %v", err)
		}
	}
	defer cleanupPosition(ctx, env, posDraft)
	defer cleanupPosition(ctx, env, posPublished)
	defer cleanupPosition(ctx, env, posEnt)

	// 场景：草稿（带批次）、已发布
	sceneDraft, scenePublished := uuid.NewString(), uuid.NewString()
	for _, s := range []struct {
		id     string
		name   string
		status string
	}{
		{sceneDraft, "自建草稿场景", "draft"},
		{scenePublished, "自建发布场景", "published"},
	} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO scenarios (id, tenant_id, name, code, version, status, difficulty, creator_id, batch_id)
			VALUES ($1,$2,$3,$4,'1.0',$5,3,$6,$7)
		`, s.id, tenantID, s.name, "opt-scn-"+s.id[:8], s.status, testhelper.TestOperatorID, sceneBatchID); err != nil {
			t.Fatalf("预置场景失败: %v", err)
		}
		defer env.DB.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, s.id)
	}

	// 他租户资源（不应出现）
	otherTenantID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO tenants (id, name, type, status) VALUES ($1,$2,'school','active')`,
		otherTenantID, "他校-"+otherTenantID[:8]); err != nil {
		t.Fatalf("预置他校失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, otherTenantID)
	otherPosID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, version)
		VALUES ($1,$2,$3,'他校岗位','internship','published','school','V1.0')
	`, otherPosID, otherTenantID, "opt-other-"+otherPosID[:8]); err != nil {
		t.Fatalf("预置他校岗位失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, otherPosID)

	h := &handler.AllianceHandler{Store: store.New(env.DB).Alliance(), Grants: store.New(env.DB).AllianceGrants()}
	r := chi.NewRouter()
	r.Get("/alliance/grants/resource-options", h.ListGrantResourceOptions)
	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	w := doWithClaims(r, http.MethodGet, "/alliance/grants/resource-options?enterpriseId="+entID, nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []domain.AllianceGrantResourceOption `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	byID := map[string]domain.AllianceGrantResourceOption{}
	for _, it := range resp.Items {
		byID[it.ID] = it
	}

	check := func(id, wantStatus string, wantBatch *string, wantSource string, wantEntID *string) {
		o, ok := byID[id]
		if !ok {
			t.Fatalf("资源 %s 应出现在候选中: %s", id, w.Body.String())
		}
		if o.Status != wantStatus {
			t.Fatalf("%s 状态不符: got %s want %s", id, o.Status, wantStatus)
		}
		gotBatch := o.BatchID
		if (gotBatch == nil) != (wantBatch == nil) || (gotBatch != nil && *gotBatch != *wantBatch) {
			t.Fatalf("%s 批次不符: got %v want %v", id, gotBatch, wantBatch)
		}
		if o.Source != wantSource {
			t.Fatalf("%s 来源类型不符: got %s want %s", id, o.Source, wantSource)
		}
		gotEnt := o.SourceEnterpriseID
		if (gotEnt == nil) != (wantEntID == nil) || (gotEnt != nil && *gotEnt != *wantEntID) {
			t.Fatalf("%s 来源企业不符: got %v want %v", id, gotEnt, wantEntID)
		}
		if wantEntID != nil && (o.SourceEnterpriseName == nil || *o.SourceEnterpriseName == "") {
			t.Fatalf("%s 应返回来源企业名称", id)
		}
		if o.BatchName == nil || *o.BatchName == "" {
			t.Fatalf("%s 应返回批次名称", id)
		}
	}
	check(posDraft, "draft", &batchID, "school", nil)
	check(posPublished, "published", nil, "school", nil)
	check(posEnt, "archived", &batchID, "enterprise", &entID)
	check(sceneDraft, "draft", &sceneBatchID, "school", nil)
	check(scenePublished, "published", &sceneBatchID, "school", nil)

	if _, ok := byID[otherPosID]; ok {
		t.Fatalf("他租户岗位不应出现在候选中")
	}
}
