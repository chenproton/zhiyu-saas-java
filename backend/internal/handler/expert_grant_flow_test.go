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
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// seedSchoolPosition 预置学校自建岗位（published）。
func seedSchoolPosition(t *testing.T, env *testhelper.TestEnv, name string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := env.DB.Exec(context.Background(), `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, version, created_by)
		VALUES ($1, $2, $3, $4, 'internship', 'published', 'school', 'V1.0', $5)
	`, id, testhelper.TestTenantID, "sch-"+uuid.NewString()[:8], name, testhelper.TestOperatorID); err != nil {
		t.Fatalf("预置学校岗位失败: %v", err)
	}
	return id
}

func cleanupPosition(ctx context.Context, env *testhelper.TestEnv, id string) {
	env.DB.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id = $1`, id)
	env.DB.Exec(ctx, `DELETE FROM position_ability_bindings WHERE career_position_id = $1`, id)
	env.DB.Exec(ctx, `DELETE FROM position_certificates WHERE career_position_id = $1`, id)
	env.DB.Exec(ctx, `DELETE FROM position_responsibilities WHERE career_position_id = $1`, id)
	env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, id)
}

// TestGrant_AuthorizeAndVisibleInCoBuild 学校-企业资源授权：授权后企业 co-build
// 列表/详情可见学校自建岗位；未授权企业不可见。
func TestGrant_AuthorizeAndVisibleInCoBuild(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// 注册企业 A（带企业主体）
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	entName := "授权测试企业-" + suffix
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": entName,
		"username":       "grant_ent_" + suffix,
		"password":       "abc12345",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("注册企业失败: %d %s", w.Code, w.Body.String())
	}
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	entTenantID := *reg.User.TenantID
	ent, err := store.New(env.DB).Alliance().GetEnterpriseByTenant(ctx, entTenantID)
	if err != nil {
		t.Fatalf("查询企业主体: %v", err)
	}
	defer cleanupPartnerTenant(env, entTenantID)

	// 学校-企业 link（active）
	linkID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, status)
		VALUES ($1, $2, $3, 'active')
	`, linkID, testhelper.TestTenantID, ent.ID); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE id = $1`, linkID)

	// 学校自建岗位
	posID := seedSchoolPosition(t, env, "学校自建岗位-"+suffix)
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, posID)

	// 学校授权
	allianceH := &handler.AllianceHandler{Store: store.New(env.DB).Alliance(), Links: store.New(env.DB).AllianceEnterpriseLinks(), Grants: store.New(env.DB).AllianceGrants()}
	rAlliance := chi.NewRouter()
	rAlliance.Put("/alliance/grants", allianceH.SaveGrants)
	teacherClaims := claimsWithRoles(uuid.NewString(), domain.RoleTeacher)
	wa := doWithClaims(rAlliance, http.MethodPut, "/alliance/grants", map[string]interface{}{
		"enterpriseId": ent.ID,
		"resourceType": "position",
		"resourceIds":  []string{posID},
	}, teacherClaims)
	if wa.Code != http.StatusOK {
		t.Fatalf("授权失败: %d %s", wa.Code, wa.Body.String())
	}

	// 企业侧 co-build 列表应包含被授权岗位
	st := store.New(env.DB)
	svc := service.New(st)
	cobH := &handler.PartnerCoBuildHandler{Service: service.NewPartnerCoBuildService(svc)}
	rCob := chi.NewRouter()
	rCob.Get("/partner/co-build/positions", cobH.ListPositions)
	rCob.Get("/partner/co-build/positions/{id}", cobH.GetPosition)
	entClaims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &entTenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseAdmin},
	}
	wp := doWithClaims(rCob, http.MethodGet, "/partner/co-build/positions", nil, entClaims)
	if wp.Code != http.StatusOK {
		t.Fatalf("列表失败: %d %s", wp.Code, wp.Body.String())
	}
	items, _, err := testhelper.UnmarshalList[domain.PartnerCoBuildPosition](wp)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	found := false
	for _, it := range items {
		if it.ID == posID {
			found = true
		}
	}
	if !found {
		t.Fatalf("授权后企业列表应包含学校自建岗位: %s", wp.Body.String())
	}

	// 未授权企业 B 不可见
	w0 := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": "未授权企业-" + suffix,
		"username":       "grant_ent_b_" + suffix,
		"password":       "abc12345",
	})
	var regB partnerLoginResp
	if err := json.Unmarshal(w0.Body.Bytes(), &regB); err != nil {
		t.Fatalf("unmarshal B: %v", err)
	}
	defer cleanupPartnerTenant(env, *regB.User.TenantID)
	entBClaims := &middleware.Claims{
		UserID:    regB.User.ID,
		TenantID:  regB.User.TenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseAdmin},
	}
	wpB := doWithClaims(rCob, http.MethodGet, "/partner/co-build/positions/"+posID, nil, entBClaims)
	if wpB.Code != http.StatusNotFound {
		t.Fatalf("未授权企业应 404: %d %s", wpB.Code, wpB.Body.String())
	}
}

// TestExpert_CreateWithAccountAndMe 创建专家自动生成账号：专家账号可登录，
// /experts/me 返回本人档案，编辑本人档案生效。
func TestExpert_CreateWithAccountAndMe(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg := setupPartnerRouter(t, env, "专家账号测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	// 创建专家（带账号）
	expertUsername := "expert_" + uuid.NewString()[:8]
	w := doWithClaims(r, http.MethodPost, "/partner/experts", map[string]interface{}{
		"name":     "带账号专家",
		"username": expertUsername,
		"password": "abc12345",
	}, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("创建专家失败: %d %s", w.Code, w.Body.String())
	}
	var created struct {
		Expert domain.AllianceExpert `json:"expert"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if created.Expert.UserID == nil {
		t.Fatalf("专家应绑定账号 user_id")
	}

	// 专家账号可登录 partner 平台
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/login", authH.PartnerLogin)
	wl := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/login", map[string]interface{}{
		"username": expertUsername,
		"password": "abc12345",
	})
	if wl.Code != http.StatusOK {
		t.Fatalf("专家账号登录失败: %d %s", wl.Code, wl.Body.String())
	}
	var lr partnerLoginResp
	if err := json.Unmarshal(wl.Body.Bytes(), &lr); err != nil {
		t.Fatalf("unmarshal login: %v", err)
	}
	if lr.User.ID != *created.Expert.UserID {
		t.Fatalf("登录用户应为专家绑定账号")
	}

	// 专家 me 接口返回本人档案
	expertClaims := &middleware.Claims{
		UserID:    lr.User.ID,
		TenantID:  lr.User.TenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseMember},
	}
	wm := doWithClaims(r, http.MethodGet, "/partner/experts/me", nil, expertClaims)
	if wm.Code != http.StatusOK {
		t.Fatalf("me 失败: %d %s", wm.Code, wm.Body.String())
	}
	var me domain.AllianceExpert
	if err := json.Unmarshal(wm.Body.Bytes(), &me); err != nil {
		t.Fatalf("unmarshal me: %v", err)
	}
	if me.Name != "带账号专家" {
		t.Fatalf("me 应返回本人档案: %s", wm.Body.String())
	}

	// 专家编辑本人档案
	wu := doWithClaims(r, http.MethodPut, "/partner/experts/me", map[string]interface{}{
		"name":     "带账号专家改",
		"isPublic": true,
	}, expertClaims)
	if wu.Code != http.StatusOK {
		t.Fatalf("更新本人档案失败: %d %s", wu.Code, wu.Body.String())
	}
	var updated domain.AllianceExpert
	if err := json.Unmarshal(wu.Body.Bytes(), &updated); err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.Name != "带账号专家改" {
		t.Fatalf("本人档案更新未生效: %s", wu.Body.String())
	}
}

// TestSourceEdit_DraftAndMerge 学校自建岗位授权编辑：企业复制 draft → 编辑 →
// 审批通过（service.ReviewApproval）→ 原资源内容被覆盖、draft 删除。
func TestSourceEdit_DraftAndMerge(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	svc := service.New(st)

	// 注册企业 A
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": "编辑合并企业-" + suffix,
		"username":       "merge_ent_" + suffix,
		"password":       "abc12345",
	})
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	entTenantID := *reg.User.TenantID
	ent, err := st.Alliance().GetEnterpriseByTenant(ctx, entTenantID)
	if err != nil {
		t.Fatalf("企业主体: %v", err)
	}
	defer cleanupPartnerTenant(env, entTenantID)

	// link + 授权
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, status) VALUES ($1,$2,$3,'active')`,
		uuid.NewString(), testhelper.TestTenantID, ent.ID); err != nil {
		t.Fatalf("link: %v", err)
	}
	posID := seedSchoolPosition(t, env, "待编辑学校岗位-"+suffix)
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, posID)
	if err := st.AllianceGrants().Upsert(ctx, testhelper.TestTenantID, ent.ID, "position", []string{posID}, testhelper.TestOperatorID); err != nil {
		t.Fatalf("授权: %v", err)
	}

	// 企业复制为 draft
	cobH := &handler.PartnerCoBuildHandler{Service: service.NewPartnerCoBuildService(svc)}
	rCob := chi.NewRouter()
	rCob.Post("/partner/co-build/positions/{id}/edit", cobH.EditSourcePosition)
	entClaims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &entTenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseAdmin},
	}
	we := doWithClaims(rCob, http.MethodPost, "/partner/co-build/positions/"+posID+"/edit", nil, entClaims)
	if we.Code != http.StatusOK {
		t.Fatalf("复制 draft 失败: %d %s", we.Code, we.Body.String())
	}
	var draft domain.CareerPosition
	if err := json.Unmarshal(we.Body.Bytes(), &draft); err != nil {
		t.Fatalf("unmarshal draft: %v", err)
	}
	if draft.SourceResourceID == nil || *draft.SourceResourceID != posID {
		t.Fatalf("draft 应关联源资源: %s", we.Body.String())
	}

	// 修改 draft 名称
	if _, err := env.DB.Exec(ctx, `UPDATE career_positions SET name = $1 WHERE id = $2`,
		"编辑后的岗位名-"+suffix, draft.ID); err != nil {
		t.Fatalf("更新 draft: %v", err)
	}

	// 审批通过后合并（store 层直调 MergeSourceEditDraft，模拟 ReviewApproval 的合并分支）
	merged, err := st.MergeSourceEditDraft(ctx, st.Q(), "career_position", draft.ID, testhelper.TestTenantID)
	if err != nil {
		t.Fatalf("合并: %v", err)
	}
	if !merged {
		t.Fatalf("应判定为编辑稿并合并")
	}

	// 原资源被覆盖 + draft 删除
	var srcName string
	if err := env.DB.QueryRow(ctx, `SELECT name FROM career_positions WHERE id = $1`, posID).Scan(&srcName); err != nil {
		t.Fatalf("查原资源: %v", err)
	}
	if srcName != "编辑后的岗位名-"+suffix {
		t.Fatalf("原资源应被 draft 覆盖: %s", srcName)
	}
	var draftCount int
	if err := env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM career_positions WHERE id = $1`, draft.ID).Scan(&draftCount); err != nil {
		t.Fatalf("查 draft: %v", err)
	}
	if draftCount != 0 {
		t.Fatalf("draft 应已删除")
	}
}

// seedCoBuiltPositionForGrant 预置企业共建岗位（source_enterprise_id 标记，指定状态）。
func seedCoBuiltPositionForGrant(t *testing.T, env *testhelper.TestEnv, enterpriseID, name, status string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := env.DB.Exec(context.Background(), `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, source_enterprise_id, version, created_by)
		VALUES ($1, $2, $3, $4, 'enterprise', $5, 'enterprise', $6, 'V1.0', $7)
	`, id, testhelper.TestTenantID, "gw-"+uuid.NewString()[:8], name, status, enterpriseID, testhelper.TestOperatorID); err != nil {
		t.Fatalf("预置共建岗位: %v", err)
	}
	return id
}

// grantedSetByType 直查某学校-企业某类型授权 id 集合。
func grantedSetByType(t *testing.T, env *testhelper.TestEnv, tenantID, enterpriseID, resourceType string) map[string]bool {
	t.Helper()
	var ids []string
	if err := env.DB.QueryRow(context.Background(), `
		SELECT resource_ids::text[] FROM alliance_resource_grants
		WHERE tenant_id = $1 AND enterprise_id = $2 AND resource_type = $3
	`, tenantID, enterpriseID, resourceType).Scan(&ids); err != nil {
		t.Fatalf("查询授权集合: %v", err)
	}
	got := make(map[string]bool, len(ids))
	for _, id := range ids {
		got[id] = true
	}
	return got
}

// TestGrant_SaveMergesCoBuilt 学校保存授权时自动并入企业共建资源：
// 共建岗位始终处于授权状态（不被整组覆盖误删），归档共建资源不并入。
func TestGrant_SaveMergesCoBuilt(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// 注册企业 A + active link
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": "合并授权企业-" + suffix,
		"username":       "merge_grant_" + suffix,
		"password":       "abc12345",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("注册企业失败: %d %s", w.Code, w.Body.String())
	}
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	ent, err := store.New(env.DB).Alliance().GetEnterpriseByTenant(ctx, *reg.User.TenantID)
	if err != nil {
		t.Fatalf("查询企业主体: %v", err)
	}
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, status) VALUES ($1,$2,$3,'active')`,
		uuid.NewString(), testhelper.TestTenantID, ent.ID); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}

	// 共建岗位（已发布 + 已归档各一）+ 学校自建岗位
	coBuiltID := seedCoBuiltPositionForGrant(t, env, ent.ID, "共建岗位-"+suffix, "published")
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, coBuiltID)
	archivedID := seedCoBuiltPositionForGrant(t, env, ent.ID, "归档共建岗位-"+suffix, "archived")
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, archivedID)
	schoolPosID := seedSchoolPosition(t, env, "学校自建岗位-"+suffix)
	defer env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, schoolPosID)

	allianceH := &handler.AllianceHandler{Store: store.New(env.DB).Alliance(), Links: store.New(env.DB).AllianceEnterpriseLinks(), Grants: store.New(env.DB).AllianceGrants()}
	rAlliance := chi.NewRouter()
	rAlliance.Put("/alliance/grants", allianceH.SaveGrants)
	teacherClaims := claimsWithRoles(uuid.NewString(), domain.RoleTeacher)

	// 只勾选学校自建岗位保存 → 共建岗位自动并入，归档的不并入
	wa := doWithClaims(rAlliance, http.MethodPut, "/alliance/grants", map[string]interface{}{
		"enterpriseId": ent.ID,
		"resourceType": "position",
		"resourceIds":  []string{schoolPosID},
	}, teacherClaims)
	if wa.Code != http.StatusOK {
		t.Fatalf("保存授权失败: %d %s", wa.Code, wa.Body.String())
	}
	got := grantedSetByType(t, env, testhelper.TestTenantID, ent.ID, "position")
	if len(got) != 2 || !got[schoolPosID] || !got[coBuiltID] {
		t.Fatalf("应并入非归档共建岗位并保留学校自建: %v", got)
	}
	if got[archivedID] {
		t.Fatalf("归档共建岗位不应并入: %v", got)
	}

	// 清空授权保存 → 共建岗位仍保留
	wb := doWithClaims(rAlliance, http.MethodPut, "/alliance/grants", map[string]interface{}{
		"enterpriseId": ent.ID,
		"resourceType": "position",
		"resourceIds":  []string{},
	}, teacherClaims)
	if wb.Code != http.StatusOK {
		t.Fatalf("清空授权失败: %d %s", wb.Code, wb.Body.String())
	}
	got = grantedSetByType(t, env, testhelper.TestTenantID, ent.ID, "position")
	if len(got) != 1 || !got[coBuiltID] {
		t.Fatalf("清空后共建岗位应保留: %v", got)
	}

	// 场景类型同样并入
	sceneID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO scenarios (id, tenant_id, code, name, status, source_type, source_enterprise_id, version, creator_id)
		VALUES ($1, $2, $3, $4, 'draft', 'enterprise', $5, 'V1.0', $6)
	`, sceneID, testhelper.TestTenantID, "cj-"+suffix, "共建场景-"+suffix, ent.ID, testhelper.TestOperatorID); err != nil {
		t.Fatalf("预置共建场景: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, sceneID)
	wc := doWithClaims(rAlliance, http.MethodPut, "/alliance/grants", map[string]interface{}{
		"enterpriseId": ent.ID,
		"resourceType": "scene",
		"resourceIds":  []string{},
	}, teacherClaims)
	if wc.Code != http.StatusOK {
		t.Fatalf("保存场景授权失败: %d %s", wc.Code, wc.Body.String())
	}
	got = grantedSetByType(t, env, testhelper.TestTenantID, ent.ID, "scene")
	if len(got) != 1 || !got[sceneID] {
		t.Fatalf("场景共建资源应并入: %v", got)
	}

	// 清理授权记录（企业租户删除前）
	env.DB.Exec(ctx, `DELETE FROM alliance_resource_grants WHERE tenant_id = $1`, testhelper.TestTenantID)
}
