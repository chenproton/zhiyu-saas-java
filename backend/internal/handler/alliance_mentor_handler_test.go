package handler_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ===== 阶段二（B10~B14）校企互动闭环测试 =====

// mentorFixture 导师测试夹具：企业 + 专家 + 引入 link + enterprise_mentor 角色。
type mentorFixture struct {
	enterpriseID string
	expertID     string
}

// setupMentorFixture 预置企业/专家/引入 link/enterprise_mentor 角色（linkPublic 控制 link.is_public）。
// 返回清理函数，调用方须 defer（须在 defer env.Cleanup() 之后注册，保证连接池关闭前执行）。
func setupMentorFixture(t *testing.T, env *testhelper.TestEnv, ctx context.Context, linkPublic bool) (mentorFixture, func()) {
	t.Helper()
	tenantID := testhelper.TestTenantID
	entID, expID, roleID := uuid.NewString(), uuid.NewString(), uuid.NewString()

	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name, enable_public) VALUES ($1,$2,$3,true)`,
		entID, tenantID, "导师测试企业-"+entID[:8]); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, is_public) VALUES ($1,$2,$3,$4,'active',true)`,
		expID, tenantID, "导师测试专家-"+expID[:8], entID); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, is_public) VALUES ($1,$2,$3)`,
		tenantID, entID, linkPublic); err != nil {
		t.Fatalf("预置 link 失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status, created_at)
		VALUES ($1,$2,'enterprise_mentor','企业导师','','{}',0,'active',NOW())
	`, roleID, tenantID); err != nil {
		t.Fatalf("预置角色失败: %v", err)
	}
	cleanup := func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_expert_mentor_links WHERE tenant_id = $1 AND expert_id = $2`, tenantID, expID)
		env.DB.Exec(ctx, `DELETE FROM user_roles WHERE role_id = $1`, roleID)
		env.DB.Exec(ctx, `DELETE FROM roles WHERE id = $1`, roleID)
		env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = $2`, tenantID, entID)
		env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, expID)
		env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
		env.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id = $1 AND username LIKE 'em_%'`, tenantID)
	}
	return mentorFixture{enterpriseID: entID, expertID: expID}, cleanup
}

func newMentorTestHandler(env *testhelper.TestEnv) *handler.AllianceMentorHandler {
	st := store.New(env.DB)
	return &handler.AllianceMentorHandler{Service: service.NewAllianceMentorService(service.New(st))}
}

// TestMentorLink_EnableIdempotentAndDisable B10：启用幂等（重复启用返回已有记录、不重建账号）、
// 停用仅置 enabled=false（不删影子账号）、停用后再启用复用同一账号。
func TestMentorLink_EnableIdempotentAndDisable(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	fx, cleanup := setupMentorFixture(t, env, ctx, true)
	defer cleanup()

	h := newMentorTestHandler(env)
	r := chi.NewRouter()
	r.Post("/alliance/experts/{id}/mentor-link", h.EnableMentorLink)
	r.Delete("/alliance/experts/{id}/mentor-link", h.DisableMentorLink)
	r.Get("/alliance/experts/mentor-options", h.ListMentorOptions)

	claims := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	type linkResp struct {
		UserID          string `json:"userId"`
		Enabled         bool   `json:"enabled"`
		Username        string `json:"username"`
		InitialPassword string `json:"initialPassword"`
	}

	// 1. 首次启用 → 201，返回影子账号 + 一次性初始密码
	w := doWithClaims(r, http.MethodPost, "/alliance/experts/"+fx.expertID+"/mentor-link", nil, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("enable: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var first linkResp
	if err := json.Unmarshal(w.Body.Bytes(), &first); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if first.UserID == "" || first.InitialPassword == "" {
		t.Fatalf("应返回影子账号与初始密码: %+v", first)
	}
	wantUsername := "em_" + fx.enterpriseID[:8] + "_" + fx.expertID[:8]
	if first.Username != wantUsername {
		t.Fatalf("username 规范化不符: got %q, want %q", first.Username, wantUsername)
	}
	// 影子账号属性：platform=portal、role=school、tenant=本校、绑定 enterprise_mentor
	var platform, role string
	if err := env.DB.QueryRow(ctx, `SELECT platform, role FROM users WHERE id = $1`, first.UserID).Scan(&platform, &role); err != nil {
		t.Fatalf("查询影子账号失败: %v", err)
	}
	if platform != "portal" || role != "school" {
		t.Fatalf("影子账号属性不符: platform=%s role=%s", platform, role)
	}
	var hasMentorRole bool
	if err := env.DB.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id
			WHERE ur.user_id = $1 AND r2.code = 'enterprise_mentor')
	`, first.UserID).Scan(&hasMentorRole); err != nil || !hasMentorRole {
		t.Fatalf("影子账号应绑定 enterprise_mentor 角色: %v %v", hasMentorRole, err)
	}

	// 2. 幂等：重复启用 → 200，同一影子账号，不再返回初始密码
	w = doWithClaims(r, http.MethodPost, "/alliance/experts/"+fx.expertID+"/mentor-link", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("re-enable: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var second linkResp
	if err := json.Unmarshal(w.Body.Bytes(), &second); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if second.UserID != first.UserID || second.InitialPassword != "" {
		t.Fatalf("幂等启用应复用账号且不返回密码: %+v", second)
	}

	// 3. mentor-options：已启用，userId 为影子账号
	w = doWithClaims(r, http.MethodGet, "/alliance/experts/mentor-options", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("mentor-options: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	options, _, err := testhelper.UnmarshalList[domain.AllianceMentorOption](w)
	if err != nil {
		t.Fatalf("unmarshal options: %v", err)
	}
	var opt *domain.AllianceMentorOption
	for i := range options {
		if options[i].ExpertID == fx.expertID {
			opt = &options[i]
		}
	}
	if opt == nil || !opt.Enabled || opt.UserID == nil || *opt.UserID != first.UserID {
		t.Fatalf("mentor-options 启用状态不符: %+v", opt)
	}
	if opt.EnterpriseID != fx.enterpriseID || opt.EnterpriseName == "" {
		t.Fatalf("mentor-options 企业信息不符: %+v", opt)
	}

	// 4. 停用 → enabled=false，账号保留；options 中 userId 为 null
	w = doWithClaims(r, http.MethodDelete, "/alliance/experts/"+fx.expertID+"/mentor-link", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("disable: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var userStillExists bool
	if err := env.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, first.UserID).Scan(&userStillExists); err != nil || !userStillExists {
		t.Fatalf("停用不应删除影子账号: %v %v", userStillExists, err)
	}
	w = doWithClaims(r, http.MethodGet, "/alliance/experts/mentor-options", nil, claims)
	options, _, _ = testhelper.UnmarshalList[domain.AllianceMentorOption](w)
	for i := range options {
		if options[i].ExpertID == fx.expertID {
			if options[i].Enabled || options[i].UserID != nil {
				t.Fatalf("停用后 options 应 enabled=false 且 userId=null: %+v", options[i])
			}
		}
	}

	// 5. 停用后再次启用 → 复用同一影子账号（不新建）
	w = doWithClaims(r, http.MethodPost, "/alliance/experts/"+fx.expertID+"/mentor-link", nil, claims)
	if w.Code != http.StatusOK {
		t.Fatalf("re-enable after disable: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var third linkResp
	if err := json.Unmarshal(w.Body.Bytes(), &third); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if third.UserID != first.UserID || !third.Enabled {
		t.Fatalf("再启用应复用原账号: %+v", third)
	}
}

// TestMentorLink_PermissionGuard B10 越权防线 + B13 角色收窄回归：
// 未引入企业的专家 403；不存在专家 404；学生/企业导师角色 403。
func TestMentorLink_PermissionGuard(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	h := newMentorTestHandler(env)
	r := chi.NewRouter()
	r.Post("/alliance/experts/{id}/mentor-link", h.EnableMentorLink)
	r.Get("/alliance/experts/mentor-options", h.ListMentorOptions)

	// 未引入企业 + 其专家
	entB, expB := uuid.NewString(), uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entB, tenantID, "越权导师企业-"+entB[:8]); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status) VALUES ($1,$2,$3,$4,'active')`,
		expB, tenantID, "越权导师专家", entB); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1`, expB)
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entB)

	teacher := claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11", domain.RoleTeacher)

	t.Run("unlinked enterprise expert forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/experts/"+expB+"/mentor-link", nil, teacher)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("nonexistent expert not found", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/alliance/experts/"+uuid.NewString()+"/mentor-link", nil, teacher)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("student forbidden", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts/mentor-options", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13", domain.RoleStudent))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("enterprise mentor forbidden (B13)", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/alliance/experts/mentor-options", nil, claimsWithRoles("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12", domain.RoleEnterpriseMentor))
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPublicAlliance_DoubleControl B11：public 接口双控过滤。
// 企业/专家：无 tenantId 全局（enable_public）；带 tenantId 叠加 link.is_public。
// 项目：归属双控通过的企业（enterprise_ids 关联）。
func TestPublicAlliance_DoubleControl(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	st := store.New(env.DB)
	h := &handler.AllianceHandler{Store: st.Alliance(), Links: st.AllianceEnterpriseLinks()}
	r := chi.NewRouter()
	r.Get("/alliance/public/enterprises", h.ListPublicEnterprises)
	r.Get("/alliance/public/experts", h.ListPublicExperts)
	r.Get("/alliance/public/projects", h.ListPublicProjects)
	r.Get("/alliance/public/stats", h.GetPublicStats)

	// entPub：enable_public=true 且 link.is_public=true（双控通过）
	// entLinkOff：enable_public=true 但 link.is_public=false（学校侧关闭）
	// entGlobalOff：enable_public=false（企业侧关闭）
	entPub, entLinkOff, entGlobalOff := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, e := range []struct {
		id      string
		enable  bool
		linkPub bool
	}{
		{entPub, true, true},
		{entLinkOff, true, false},
		{entGlobalOff, false, true},
	} {
		if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name, enable_public) VALUES ($1,$2,$3,$4)`,
			e.id, tenantID, "双控企业-"+e.id[:8], e.enable); err != nil {
			t.Fatalf("预置企业失败: %v", err)
		}
		if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, is_public) VALUES ($1,$2,$3)`,
			tenantID, e.id, e.linkPub); err != nil {
			t.Fatalf("预置 link 失败: %v", err)
		}
	}
	expPub, expLinkOff, expGlobalOff := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, e := range [][2]string{{expPub, entPub}, {expLinkOff, entLinkOff}, {expGlobalOff, entGlobalOff}} {
		if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, is_public) VALUES ($1,$2,$3,$4,'active',true)`,
			e[0], tenantID, "双控专家-"+e[0][:8], e[1]); err != nil {
			t.Fatalf("预置专家失败: %v", err)
		}
	}
	projPub, projLinkOff, projNoEnt := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, p := range []struct {
		id  string
		ent string
	}{
		{projPub, entPub},
		{projLinkOff, entLinkOff},
		{projNoEnt, ""},
	} {
		entJSON := `[]`
		if p.ent != "" {
			entJSON = `["` + p.ent + `"]`
		}
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO alliance_projects (id, tenant_id, name, phase, publish_status, enterprise_ids, is_public)
			VALUES ($1,$2,$3,'execution','published',$4::jsonb,true)
		`, p.id, tenantID, "双控项目-"+p.id[:8], entJSON); err != nil {
			t.Fatalf("预置项目失败: %v", err)
		}
	}
	// entTerminated：双控均开但合作已终止（status='terminated'），tenant 分支应排除；全局分支不用 link，不受影响
	entTerminated := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name, enable_public) VALUES ($1,$2,$3,true)`,
		entTerminated, tenantID, "终止合作企业-"+entTerminated[:8]); err != nil {
		t.Fatalf("预置终止合作企业失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_enterprise_links (tenant_id, enterprise_id, is_public, status) VALUES ($1,$2,true,'terminated')`,
		tenantID, entTerminated); err != nil {
		t.Fatalf("预置终止合作 link 失败: %v", err)
	}
	expTerminated, projTerminated := uuid.NewString(), uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, status, is_public) VALUES ($1,$2,$3,$4,'active',true)`,
		expTerminated, tenantID, "终止合作专家-"+expTerminated[:8], entTerminated); err != nil {
		t.Fatalf("预置终止合作专家失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_projects (id, tenant_id, name, phase, publish_status, enterprise_ids, is_public)
		VALUES ($1,$2,$3,'execution','published',$4::jsonb,true)
	`, projTerminated, tenantID, "终止合作项目-"+projTerminated[:8], `["`+entTerminated+`"]`); err != nil {
		t.Fatalf("预置终止合作项目失败: %v", err)
	}
	defer func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_projects WHERE id IN ($1,$2,$3,$4)`, projPub, projLinkOff, projNoEnt, projTerminated)
		env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id IN ($1,$2,$3,$4)`, expPub, expLinkOff, expGlobalOff, expTerminated)
		env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id IN ($2,$3,$4,$5)`, tenantID, entPub, entLinkOff, entGlobalOff, entTerminated)
		env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id IN ($1,$2,$3,$4)`, entPub, entLinkOff, entGlobalOff, entTerminated)
	}()

	get := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	containsID := func(body []byte, id string) bool {
		var resp struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		for _, it := range resp.Items {
			if it.ID == id {
				return true
			}
		}
		return false
	}

	t.Run("enterprises global: enable_public only", func(t *testing.T) {
		w := get("/alliance/public/enterprises")
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if !containsID(w.Body.Bytes(), entPub) || !containsID(w.Body.Bytes(), entLinkOff) {
			t.Fatalf("全局应包含所有 enable_public 企业: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), entGlobalOff) {
			t.Fatalf("enable_public=false 企业不应出现: %s", w.Body.String())
		}
	})

	t.Run("enterprises tenant: link.is_public double control", func(t *testing.T) {
		w := get("/alliance/public/enterprises?tenantId=" + tenantID)
		if !containsID(w.Body.Bytes(), entPub) {
			t.Fatalf("双控通过企业应出现: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), entLinkOff) || containsID(w.Body.Bytes(), entGlobalOff) || containsID(w.Body.Bytes(), entTerminated) {
			t.Fatalf("任一开关关闭或合作已终止即不展示: %s", w.Body.String())
		}
	})

	t.Run("experts global: enterprise enable_public + expert is_public", func(t *testing.T) {
		w := get("/alliance/public/experts")
		if !containsID(w.Body.Bytes(), expPub) || !containsID(w.Body.Bytes(), expLinkOff) {
			t.Fatalf("全局应包含 enable_public 企业的公开专家: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), expGlobalOff) {
			t.Fatalf("enable_public=false 企业的专家不应出现: %s", w.Body.String())
		}
	})

	t.Run("experts tenant: double control", func(t *testing.T) {
		w := get("/alliance/public/experts?tenantId=" + tenantID)
		if !containsID(w.Body.Bytes(), expPub) {
			t.Fatalf("双控通过企业的专家应出现: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), expLinkOff) || containsID(w.Body.Bytes(), expGlobalOff) || containsID(w.Body.Bytes(), expTerminated) {
			t.Fatalf("任一开关关闭或合作已终止即不展示: %s", w.Body.String())
		}
	})

	t.Run("projects: owned by double-controlled enterprises", func(t *testing.T) {
		w := get("/alliance/public/projects?tenantId=" + tenantID)
		if !containsID(w.Body.Bytes(), projPub) {
			t.Fatalf("双控通过企业的项目应出现: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), projLinkOff) || containsID(w.Body.Bytes(), projNoEnt) || containsID(w.Body.Bytes(), projTerminated) {
			t.Fatalf("未过双控/无企业归属/合作已终止的项目不应出现: %s", w.Body.String())
		}
		// 全局：entLinkOff 企业 enable_public=true，其项目可见
		w = get("/alliance/public/projects")
		if !containsID(w.Body.Bytes(), projPub) || !containsID(w.Body.Bytes(), projLinkOff) {
			t.Fatalf("全局应包含 enable_public 企业的项目: %s", w.Body.String())
		}
		if containsID(w.Body.Bytes(), projNoEnt) {
			t.Fatalf("无企业归属的项目不应出现: %s", w.Body.String())
		}
	})

	t.Run("stats tenant: double-controlled counts", func(t *testing.T) {
		w := get("/alliance/public/stats?tenantId=" + tenantID)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var stats struct {
			EnterpriseCount int `json:"enterpriseCount"`
			ExpertCount     int `json:"expertCount"`
			ProjectCount    int `json:"projectCount"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
			t.Fatalf("unmarshal stats: %v", err)
		}
		if stats.EnterpriseCount != 1 || stats.ExpertCount != 1 || stats.ProjectCount != 1 {
			t.Fatalf("双控统计应为各 1: %+v", stats)
		}
	})
}

// TestSaveMethods_MentorAssignment B12：任务级企业导师分配。
// subject_type='enterprise_mentor' 步骤的 assignedUserIds 必须 ∈ 本校已启用 mentor_links 影子账号。
func TestSaveMethods_MentorAssignment(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID
	fx, cleanup := setupMentorFixture(t, env, ctx, true)
	defer cleanup()

	// 已启用导师绑定（影子账号）
	mentorUserID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1,$2,'school','portal',$3,$4,'x','分配测试导师','active','{}')
	`, mentorUserID, tenantID, "em_assign_"+mentorUserID[:8], tenantID+"_em_assign_"+mentorUserID[:8]); err != nil {
		t.Fatalf("预置影子账号失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_expert_mentor_links (id, tenant_id, expert_id, user_id, enabled)
		VALUES ($1,$2,$3,$4,true)
	`, uuid.NewString(), tenantID, fx.expertID, mentorUserID); err != nil {
		t.Fatalf("预置导师绑定失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM users WHERE id = $1`, mentorUserID)

	scenarioID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, difficulty, creator_id)
		VALUES ($1, $2, '分配测试场景', 'CJ-ASSIGN', 'v1', 'published', 3, $3)
	`, scenarioID, tenantID, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scenarioID)
	taskID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO scenario_tasks (id, scenario_id, name, code, sort_order, task_type, difficulty, tenant_id)
		VALUES ($1, $2, '分配任务', 'RW-ASSIGN', 0, 'practice', 3, $3)
	`, taskID, scenarioID, tenantID)
	defer env.DB.Exec(ctx, "DELETE FROM scenario_tasks WHERE id = $1", taskID)
	defer env.DB.Exec(ctx, "DELETE FROM task_evaluation_methods WHERE task_id = $1", taskID)

	st := store.New(env.DB)
	taskSvc := service.NewTaskEvaluationService(service.New(st))
	subject := "enterprise_mentor"

	// 1. 合法分配 → 保存成功且 ListMethods 带回 assignedUserIds
	methods, err := taskSvc.SaveMethods(ctx, tenantID, taskID, testhelper.TestOperatorID, 0, []*service.MethodSaveInput{
		{
			MethodKey: "homework", IsEnabled: true, EvalObject: "individual",
			ReviewSteps: []service.ReviewStepSaveInput{
				{Label: "企业导师评审", Enabled: true, SubjectType: &subject, Weight: 100, SortOrder: 0, AssignedUserIDs: []string{mentorUserID}},
			},
		},
	})
	if err != nil {
		t.Fatalf("合法分配保存失败: %v", err)
	}
	if len(methods) != 1 || len(methods[0].ReviewSteps) != 1 {
		t.Fatalf("应返回 1 个方法 1 个步骤: %+v", methods)
	}
	got := methods[0].ReviewSteps[0].AssignedUserIDs
	if len(got) != 1 || got[0] != mentorUserID {
		t.Fatalf("assignedUserIds 未持久化: %+v", got)
	}

	// 2. 非法分配（非已启用影子账号）→ ErrInvalidMentorAssignment
	_, err = taskSvc.SaveMethods(ctx, tenantID, taskID, testhelper.TestOperatorID, 1, []*service.MethodSaveInput{
		{
			MethodKey: "homework", IsEnabled: true, EvalObject: "individual",
			ReviewSteps: []service.ReviewStepSaveInput{
				{Label: "企业导师评审", Enabled: true, SubjectType: &subject, Weight: 100, SortOrder: 0, AssignedUserIDs: []string{uuid.NewString()}},
			},
		},
	})
	if !errors.Is(err, service.ErrInvalidMentorAssignment) {
		t.Fatalf("非法分配应返回 ErrInvalidMentorAssignment: %v", err)
	}

	// 3. 非 enterprise_mentor 主体的 assignedUserIds 不持久化（落空数组）
	teacherSubject := "teacher"
	methods, err = taskSvc.SaveMethods(ctx, tenantID, taskID, testhelper.TestOperatorID, 2, []*service.MethodSaveInput{
		{
			MethodKey: "homework", IsEnabled: true, EvalObject: "individual",
			ReviewSteps: []service.ReviewStepSaveInput{
				{Label: "教师评审", Enabled: true, SubjectType: &teacherSubject, Weight: 100, SortOrder: 0, AssignedUserIDs: []string{mentorUserID}},
			},
		},
	})
	if err != nil {
		t.Fatalf("教师步骤保存失败: %v", err)
	}
	if len(methods[0].ReviewSteps[0].AssignedUserIDs) != 0 {
		t.Fatalf("非 enterprise_mentor 步骤不应持久化分配: %+v", methods[0].ReviewSteps[0].AssignedUserIDs)
	}
}
