package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
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

// setupCoBuildRouter 注册测试企业并装配资源共建路由，返回路由、member claims、注册信息与企业主体 ID。
func setupCoBuildRouter(t *testing.T, env *testhelper.TestEnv, namePrefix string) (chi.Router, *middleware.Claims, partnerLoginResp, string) {
	t.Helper()
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": namePrefix + "-" + suffix,
		"username":       "partner_cb_" + suffix,
		"password":       "abc12345",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("注册失败: %d: %s", w.Code, w.Body.String())
	}
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	tenantID := *reg.User.TenantID
	enterpriseID := partnerEnterpriseID(t, env, tenantID)

	svc := service.New(store.New(env.DB))
	h := &handler.PartnerCoBuildHandler{Service: service.NewPartnerCoBuildService(svc)}
	r := chi.NewRouter()
	r.Get("/partner/co-build/positions", h.ListPositions)
	r.Post("/partner/co-build/positions", h.CreatePosition)
	r.Get("/partner/co-build/positions/{id}", h.GetPosition)
	r.Put("/partner/co-build/positions/{id}", h.UpdatePosition)
	r.Delete("/partner/co-build/positions/{id}", h.DeletePosition)
	r.Post("/partner/co-build/positions/{id}/submit", h.SubmitPosition)
	r.Post("/partner/co-build/positions/{id}/withdraw", h.WithdrawPosition)
	r.Post("/partner/co-build/positions/{id}/save-full", h.SaveFullPosition)
	r.Get("/partner/co-build/positions/{id}/responsibilities", h.ListPositionResponsibilities)
	r.Get("/partner/co-build/positions/{id}/certificates", h.ListPositionCertificates)
	r.Get("/partner/co-build/positions/{id}/ability-bindings", h.ListPositionAbilityBindings)
	r.Get("/partner/co-build/positions/{id}/ability-domains", h.ListPositionAbilityDomains)
	r.Get("/partner/co-build/scenes", h.ListScenarios)
	r.Post("/partner/co-build/scenes", h.CreateScenario)
	r.Get("/partner/co-build/scenes/{id}", h.GetScenario)
	r.Put("/partner/co-build/scenes/{id}", h.UpdateScenario)
	r.Delete("/partner/co-build/scenes/{id}", h.DeleteScenario)
	r.Post("/partner/co-build/scenes/{id}/submit", h.SubmitScenario)
	r.Post("/partner/co-build/scenes/{id}/withdraw", h.WithdrawScenario)
	r.Get("/partner/co-build/scenes/{id}/tasks", h.ListTasks)
	r.Get("/partner/co-build/scenes/{id}/weights", h.ListScenarioWeights)
	r.Put("/partner/co-build/scenes/{id}/weights", h.SaveScenarioWeights)
	r.Post("/partner/co-build/scenes/{id}/tasks", h.CreateTask)
	r.Post("/partner/co-build/scenes/{id}/tasks/reorder", h.ReorderTasks)
	r.Put("/partner/co-build/tasks/{taskId}", h.UpdateTask)
	r.Delete("/partner/co-build/tasks/{taskId}", h.DeleteTask)
	r.Get("/partner/co-build/tasks/{taskId}/evaluation-methods", h.GetTaskEvaluationMethods)
	r.Put("/partner/co-build/tasks/{taskId}/evaluation-methods", h.PutTaskEvaluationMethods)
	r.Get("/partner/co-build/schools/{tenantId}/abilities", h.ListSchoolAbilities)
	r.Get("/partner/co-build/schools/{tenantId}/evaluation-methods", h.ListSchoolEvaluationMethods)
	r.Get("/partner/co-build/schools/{tenantId}/co-builders", h.ListSchoolCoBuilders)
	r.Get("/partner/co-build/schools/{tenantId}/knowledge-points", h.ListSchoolKnowledgePoints)
	r.Get("/partner/co-build/schools/{tenantId}/courses", h.ListSchoolCourses)
	r.Get("/partner/co-build/schools/{tenantId}/ability-bindings", h.ListSchoolAbilityBindings)
	r.Get("/partner/co-build/schools/{tenantId}/question-banks", h.ListSchoolQuestionBanks)
	r.Get("/partner/co-build/schools/{tenantId}/questions", h.ListSchoolQuestions)
	r.Get("/partner/co-build/schools/{tenantId}/random-draw-questions", h.ListSchoolRandomDrawQuestions)
	r.Get("/partner/co-build/schools/{tenantId}/exams", h.ListSchoolExams)
	r.Get("/partner/co-build/schools/{tenantId}/majors", h.ListSchoolMajors)
	r.Get("/partner/co-build/schools/{tenantId}/scenarios", h.ListSchoolScenarios)
	r.Get("/partner/co-build/schools/{tenantId}/tasks", h.ListSchoolTasks)
	r.Get("/partner/co-build/schools/{tenantId}/resources", h.ListSchoolResources)

	// enterprise_member 亦可操作共建（路由层 partnerUser 组）
	claims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &tenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseMember},
	}
	return r, claims, reg, enterpriseID
}

// cleanupCoBuildRows 清理学校租户内的共建数据（在校租户删除前执行）。
func cleanupCoBuildRows(env *testhelper.TestEnv, schoolTenantID string) {
	ctx := context.Background()
	env.DB.Exec(ctx, `DELETE FROM approval_records WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM task_evaluation_methods WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM scenario_tasks WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM scenarios WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM ability_domains WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM position_ability_bindings WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM position_responsibilities WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM position_certificates WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM certificate_library WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM ability_points WHERE tenant_id = $1`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id IN (SELECT id FROM career_positions WHERE tenant_id = $1)`, schoolTenantID)
	env.DB.Exec(ctx, `DELETE FROM career_positions WHERE tenant_id = $1`, schoolTenantID)
}

// countPendingApproval 直查审批记录数（验证 submit → approval_records 链路）。
func countPendingApproval(t *testing.T, env *testhelper.TestEnv, targetType, targetID string) int {
	t.Helper()
	var cnt int
	if err := env.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM approval_records WHERE target_type = $1 AND target_id = $2 AND status = 'pending'`,
		targetType, targetID).Scan(&cnt); err != nil {
		t.Fatalf("查询审批记录失败: %v", err)
	}
	return cnt
}

// TestPartnerCoBuild_PositionFlow member 全流程：建岗位（draft+来源标记）→ 提交（审批记录）→
// 撤回（记录清理）→ 再提交 → 学校审批通过后禁止编辑/删除。
func TestPartnerCoBuild_PositionFlow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "共建流程测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "共建流程学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	var positionID string
	t.Run("create draft with source mark", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
			"schoolTenantId": schoolID,
			"name":           "共建岗位-" + suffix,
			"positionType":   "enterprise",
		}, claims)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var pos domain.CareerPosition
		if err := json.Unmarshal(w.Body.Bytes(), &pos); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.Status != domain.StatusDraft {
			t.Fatalf("新建应为 draft, got %s", pos.Status)
		}
		if pos.SourceType != "enterprise" {
			t.Fatalf("sourceType 应为 enterprise, got %s", pos.SourceType)
		}
		if pos.SourceEnterpriseID == nil || *pos.SourceEnterpriseID != enterpriseID {
			t.Fatalf("sourceEnterpriseId 应为本企业: %v", pos.SourceEnterpriseID)
		}
		if pos.TenantID != schoolID {
			t.Fatalf("岗位应落在学校租户, got %s", pos.TenantID)
		}
		if pos.CreatedBy != reg.User.ID {
			t.Fatalf("createdBy 应为企业用户, got %s", pos.CreatedBy)
		}
		positionID = pos.ID
	})
	if positionID == "" {
		t.Fatalf("创建岗位失败，跳过后续用例")
	}

	t.Run("list shows school name and source", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.PartnerCoBuildPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 || items[0].ID != positionID {
			t.Fatalf("列表应恰含新建岗位: total=%d body=%s", total, w.Body.String())
		}
		if items[0].SchoolName != "共建流程学校-"+suffix {
			t.Fatalf("列表应带学校名称: %+v", items[0])
		}
	})

	t.Run("submit creates approval record", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+positionID+"/submit", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var pos domain.CareerPosition
		if err := json.Unmarshal(w.Body.Bytes(), &pos); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.Status != domain.StatusPending {
			t.Fatalf("提交后应为 pending, got %s", pos.Status)
		}
		if cnt := countPendingApproval(t, env, "career_position", positionID); cnt != 1 {
			t.Fatalf("学校审批中心应有 1 条待审批记录, got %d", cnt)
		}
	})

	t.Run("withdraw removes approval record", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+positionID+"/withdraw", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if cnt := countPendingApproval(t, env, "career_position", positionID); cnt != 0 {
			t.Fatalf("撤回后待审批记录应被清理, got %d", cnt)
		}
	})

	t.Run("resubmit then approved blocks write", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+positionID+"/submit", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("再次提交应成功, got %d: %s", w.Code, w.Body.String())
		}
		// 学校侧审批通过（直改状态，模拟审批中心 Review 效果）
		if _, err := env.DB.Exec(context.Background(),
			`UPDATE career_positions SET status = 'approved' WHERE id = $1`, positionID); err != nil {
			t.Fatalf("预置 approved 失败: %v", err)
		}
		w = doWithClaims(r, http.MethodPut, "/partner/co-build/positions/"+positionID, map[string]interface{}{
			"name": "共建岗位改-" + suffix,
		}, claims)
		if w.Code != http.StatusConflict {
			t.Fatalf("approved 后更新应 409, got %d: %s", w.Code, w.Body.String())
		}
		w = doWithClaims(r, http.MethodDelete, "/partner/co-build/positions/"+positionID, nil, claims)
		if w.Code != http.StatusConflict {
			t.Fatalf("approved 后删除应 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("school side list carries sourceType", func(t *testing.T) {
		svc := service.New(store.New(env.DB))
		ph := &handler.PositionHandler{Service: service.NewPositionService(svc)}
		schoolRouter := chi.NewRouter()
		schoolRouter.Get("/job/positions", ph.List)
		schoolClaims := &middleware.Claims{
			UserID:    uuid.NewString(),
			TenantID:  &schoolID,
			Platform:  domain.UserPlatformPortal,
			RoleCodes: []string{domain.RoleSchoolAdmin},
		}
		w := doWithClaims(schoolRouter, http.MethodGet, "/job/positions", nil, schoolClaims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, _, err := testhelper.UnmarshalList[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		var found bool
		for _, p := range items {
			if p.ID == positionID {
				found = true
				if p.SourceType != "enterprise" || p.SourceEnterpriseID == nil || *p.SourceEnterpriseID != enterpriseID {
					t.Fatalf("学校端列表应带来源标记: %+v", p)
				}
			}
		}
		if !found {
			t.Fatalf("学校端列表应包含共建岗位: %s", w.Body.String())
		}
	})
}

// TestPartnerCoBuild_LinkAndOwnershipGuards 无 link/terminated link 写操作 403；他企业资源 404。
func TestPartnerCoBuild_LinkAndOwnershipGuards(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "共建守卫测试企业甲")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	ctx := context.Background()
	suffix := uuid.NewString()[:8]
	// 无 link 学校
	noLinkSchool := createSchoolTenant(t, env, "无合作学校-"+suffix)
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM tenants WHERE id = $1`, noLinkSchool) })
	// terminated link 学校
	termSchool := createSchoolTenant(t, env, "终止合作学校-"+suffix)
	linkSchoolEnterprise(t, env, termSchool, enterpriseID, "terminated")
	// active link 学校（用于造本企业资源）
	activeSchool := createSchoolTenant(t, env, "守卫 active 学校-"+suffix)
	linkSchoolEnterprise(t, env, activeSchool, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, activeSchool) })

	t.Run("create without link 403", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
			"schoolTenantId": noLinkSchool,
			"name":           "无合作岗位-" + suffix,
			"positionType":   "enterprise",
		}, claims)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("create with terminated link 403", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
			"schoolTenantId": termSchool,
			"name":           "终止合作岗位-" + suffix,
			"positionType":   "enterprise",
		}, claims)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("school read lists require active link", func(t *testing.T) {
		if w := doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+termSchool+"/abilities", nil, claims); w.Code != http.StatusForbidden {
			t.Fatalf("terminated 学校能力列表应 403, got %d: %s", w.Code, w.Body.String())
		}
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+activeSchool+"/abilities", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("active 学校能力列表应 200, got %d: %s", w.Code, w.Body.String())
		}
		w = doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+activeSchool+"/evaluation-methods", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("active 学校测评方法列表应 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 本企业资源（active 学校）
	w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
		"schoolTenantId": activeSchool,
		"name":           "本企业岗位-" + suffix,
		"positionType":   "enterprise",
	}, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("预置本企业岗位失败: %d: %s", w.Code, w.Body.String())
	}
	var ownPos domain.CareerPosition
	if err := json.Unmarshal(w.Body.Bytes(), &ownPos); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	t.Run("other enterprise gets 404", func(t *testing.T) {
		_, claimsB, regB, _ := setupCoBuildRouter(t, env, "共建守卫测试企业乙")
		defer cleanupPartnerTenant(env, *regB.User.TenantID)
		if w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+ownPos.ID, nil, claimsB); w.Code != http.StatusNotFound {
			t.Fatalf("他企业 Get 应 404, got %d: %s", w.Code, w.Body.String())
		}
		if w := doWithClaims(r, http.MethodPut, "/partner/co-build/positions/"+ownPos.ID, map[string]interface{}{"name": "篡改"}, claimsB); w.Code != http.StatusNotFound {
			t.Fatalf("他企业 Update 应 404, got %d: %s", w.Code, w.Body.String())
		}
		if w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+ownPos.ID+"/submit", nil, claimsB); w.Code != http.StatusNotFound {
			t.Fatalf("他企业 Submit 应 404, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// TestPartnerCoBuild_ScenarioTaskFlow 场景全流程：建场景 → 建任务 → 重排 → 测评方式 → 删任务 → 提交/撤回。
// TestPartnerCoBuild_GrantedDirectEdit 学校授权资源直接编辑：合作 link 非 active（negotiating）
// 亦可保存；保存后状态回写草稿（发布由学校端进行）。
func TestPartnerCoBuild_GrantedDirectEdit(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	ctx := context.Background()
	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "授权直编测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "授权直编学校-"+suffix)
	// negotiating 而非 active：验证保存不再要求 active link
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "negotiating")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	st := store.New(env.DB)
	grant := func(resourceType, resourceID string) {
		t.Helper()
		if err := st.AllianceGrants().Upsert(ctx, schoolID, enterpriseID, resourceType, []string{resourceID}, reg.User.ID); err != nil {
			t.Fatalf("授权失败: %v", err)
		}
	}

	t.Run("granted published position save resets to draft", func(t *testing.T) {
		pos, err := st.Positions().Create(ctx, env.DB, schoolID, &store.PositionCreateParams{
			Name:          "学校自建岗位-" + suffix,
			PositionType:  "enterprise",
			Version:       "V1.0",
			Status:        domain.StatusPublished,
			CreatedBy:     reg.User.ID,
			SourceType:    "school",
			Collaborators: []string{},
			Requirements:  []string{"需求一"},
		})
		if err != nil {
			t.Fatalf("创建学校岗位失败: %v", err)
		}
		grant("position", pos.ID)

		// 编辑页加载（读）可用
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+pos.ID, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("授权资源读取应 200, got %d: %s", w.Code, w.Body.String())
		}
		// save-full 保存：不再 403，保存后回写草稿
		w = doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+pos.ID+"/save-full", map[string]interface{}{
			"name":         "学校自建岗位改-" + suffix,
			"positionType": "enterprise",
			"version":      "V1.1",
			"requirements": []string{"需求一"},
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("授权资源保存应 200, got %d: %s", w.Code, w.Body.String())
		}
		var saved domain.CareerPosition
		if err := json.Unmarshal(w.Body.Bytes(), &saved); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if saved.Status != domain.StatusDraft {
			t.Fatalf("保存后应回写草稿, got %s", saved.Status)
		}
		if saved.SourceType != "school" {
			t.Fatalf("学校自建资源不应被改写来源标记, got %s", saved.SourceType)
		}
		// 未授权企业不可见（404）
		otherRouter, otherClaims, otherReg, _ := setupCoBuildRouter(t, env, "无关企业-"+suffix)
		defer cleanupPartnerTenant(env, *otherReg.User.TenantID)
		w = doWithClaims(otherRouter, http.MethodGet, "/partner/co-build/positions/"+pos.ID, nil, otherClaims)
		if w.Code != http.StatusNotFound {
			t.Fatalf("未授权企业读取应 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("granted published scenario update resets to draft", func(t *testing.T) {
		sc, err := st.Scenarios().Create(ctx, schoolID, &store.ScenarioCreateParams{
			Name:          "学校自建场景-" + suffix,
			Difficulty:    3,
			Version:       "V1.0",
			CreatorID:     reg.User.ID,
			IndustryIDs:   []string{},
			ProfessionIDs: []string{},
			CoBuilderIDs:  []string{},
		})
		if err != nil {
			t.Fatalf("创建学校场景失败: %v", err)
		}
		if _, err := env.DB.Exec(ctx, `UPDATE scenarios SET status = 'published' WHERE id = $1`, sc.ID); err != nil {
			t.Fatalf("置为已发布失败: %v", err)
		}
		grant("scene", sc.ID)

		w := doWithClaims(r, http.MethodPut, "/partner/co-build/scenes/"+sc.ID, map[string]interface{}{
			"name":       "学校自建场景改-" + suffix,
			"difficulty": 4,
			"version":    "V1.1",
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("授权场景保存应 200, got %d: %s", w.Code, w.Body.String())
		}
		var saved domain.Scenario
		if err := json.Unmarshal(w.Body.Bytes(), &saved); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if saved.Status != domain.StatusDraft {
			t.Fatalf("保存后应回写草稿, got %s", saved.Status)
		}
	})
}

func TestPartnerCoBuild_ScenarioTaskFlow(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "共建场景测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "共建场景学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	var scenarioID string
	t.Run("create scenario with source mark", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes", map[string]interface{}{
			"schoolTenantId": schoolID,
			"name":           "共建场景-" + suffix,
			"difficulty":     1,
		}, claims)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var sc domain.Scenario
		if err := json.Unmarshal(w.Body.Bytes(), &sc); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if sc.Status != domain.StatusDraft || sc.SourceType != "enterprise" ||
			sc.SourceEnterpriseID == nil || *sc.SourceEnterpriseID != enterpriseID {
			t.Fatalf("场景应为 draft+enterprise 来源: %+v", sc)
		}
		if sc.TenantID == nil || *sc.TenantID != schoolID {
			t.Fatalf("场景应落在学校租户: %+v", sc.TenantID)
		}
		scenarioID = sc.ID
	})
	if scenarioID == "" {
		t.Fatalf("创建场景失败，跳过后续用例")
	}

	var taskID string
	t.Run("create task", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes/"+scenarioID+"/tasks", map[string]interface{}{
			"name":           "共建任务-" + suffix,
			"code":           "task-" + suffix,
			"taskType":       "normal",
			"difficulty":     1,
			"estimatedHours": 1,
		}, claims)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		var task domain.ScenarioTask
		if err := json.Unmarshal(w.Body.Bytes(), &task); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if task.TenantID == nil || *task.TenantID != schoolID {
			t.Fatalf("任务应落在学校租户: %+v", task.TenantID)
		}
		taskID = task.ID
	})

	t.Run("list tasks", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/scenes/"+scenarioID+"/tasks", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.ScenarioTask](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 || items[0].ID != taskID {
			t.Fatalf("任务列表应恰含新建任务: total=%d", total)
		}
	})

	t.Run("reorder tasks", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes/"+scenarioID+"/tasks/reorder", map[string]interface{}{
			"taskIds": []string{taskID},
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("evaluation methods roundtrip", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPut, "/partner/co-build/tasks/"+taskID+"/evaluation-methods", map[string]interface{}{
			"version": 0,
			"methods": []interface{}{},
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		w = doWithClaims(r, http.MethodGet, "/partner/co-build/tasks/"+taskID+"/evaluation-methods", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp struct {
			Methods []domain.TaskEvaluationMethod `json:"methods"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
	})

	t.Run("delete task", func(t *testing.T) {
		w := doWithClaims(r, http.MethodDelete, "/partner/co-build/tasks/"+taskID, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("submit creates approval record, withdraw cleans", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes/"+scenarioID+"/submit", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if cnt := countPendingApproval(t, env, "scenario", scenarioID); cnt != 1 {
			t.Fatalf("场景提交后应有 1 条待审批记录, got %d", cnt)
		}
		w = doWithClaims(r, http.MethodPost, "/partner/co-build/scenes/"+scenarioID+"/withdraw", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		if cnt := countPendingApproval(t, env, "scenario", scenarioID); cnt != 0 {
			t.Fatalf("场景撤回后待审批记录应被清理, got %d", cnt)
		}
	})
}

// TestPartnerCoBuild_PositionSubResources 岗位编辑子资源只读端点：
// save-full 写入职责/证书/能力绑定/能力域后，4 个端点各返回对应数据（形状与 portal 一致）；他企业 404。
func TestPartnerCoBuild_PositionSubResources(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "共建子资源测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "共建子资源学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
		"schoolTenantId": schoolID,
		"name":           "子资源岗位-" + suffix,
		"positionType":   "enterprise",
	}, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("创建岗位失败: %d: %s", w.Code, w.Body.String())
	}
	var pos domain.CareerPosition
	if err := json.Unmarshal(w.Body.Bytes(), &pos); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	positionID := pos.ID

	t.Run("save-full seeds sub resources", func(t *testing.T) {
		w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions/"+positionID+"/save-full", map[string]interface{}{
			"name":         "子资源岗位-" + suffix,
			"positionType": "enterprise",
			"responsibilities": []interface{}{
				map[string]interface{}{"id": "r1", "name": "职责甲-" + suffix},
			},
			"certificates": []interface{}{
				map[string]interface{}{"id": "c1", "name": "证书甲-" + suffix},
			},
			"abilityBindings": []interface{}{
				map[string]interface{}{
					"id": "b1", "responsibilityId": "r1", "source": "custom",
					"name": "能力甲-" + suffix, "level": "L2",
				},
			},
			"abilityDomains": []interface{}{
				map[string]interface{}{"id": "d1", "name": "域甲-" + suffix, "bindingIds": []string{"b1"}},
			},
		}, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	var responsibilityID, bindingID string
	t.Run("responsibilities endpoint", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/responsibilities", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionResponsibility](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 || items[0].Name != "职责甲-"+suffix {
			t.Fatalf("职责列表不符: total=%d body=%s", total, w.Body.String())
		}
		if items[0].CareerPositionID != positionID {
			t.Fatalf("职责应归属岗位: %+v", items[0])
		}
		responsibilityID = items[0].ID
	})

	t.Run("certificates endpoint", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/certificates", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionCertificate](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 || items[0].Name != "证书甲-"+suffix {
			t.Fatalf("证书列表不符: total=%d body=%s", total, w.Body.String())
		}
		if items[0].CertificateLibraryID == "" {
			t.Fatalf("证书应带证书库 ID: %+v", items[0])
		}
	})

	t.Run("ability bindings endpoint", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/ability-bindings", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionAbilityBinding](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 {
			t.Fatalf("绑定列表不符: total=%d body=%s", total, w.Body.String())
		}
		b := items[0]
		if b.AbilityName == nil || *b.AbilityName != "能力甲-"+suffix {
			t.Fatalf("绑定应 JOIN 出能力点名称: %+v", b)
		}
		if b.ResponsibilityID != responsibilityID {
			t.Fatalf("绑定应关联服务端职责 ID %s, got %s", responsibilityID, b.ResponsibilityID)
		}
		if b.RequiredLevel != "L2" || b.Source != domain.AbilityPointSourceCustom {
			t.Fatalf("绑定字段不符: %+v", b)
		}
		bindingID = b.ID
	})

	t.Run("ability domains endpoint", func(t *testing.T) {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/ability-domains", nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		items, total, err := testhelper.UnmarshalList[domain.AbilityDomain](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if total != 1 || len(items) != 1 || items[0].Name != "域甲-"+suffix {
			t.Fatalf("能力域列表不符: total=%d body=%s", total, w.Body.String())
		}
		if len(items[0].BindingIDs) != 1 || items[0].BindingIDs[0] != bindingID {
			t.Fatalf("能力域应关联服务端绑定 ID %s: %+v", bindingID, items[0])
		}
	})

	t.Run("other enterprise gets 404", func(t *testing.T) {
		_, claimsB, regB, _ := setupCoBuildRouter(t, env, "共建子资源测试企业乙")
		defer cleanupPartnerTenant(env, *regB.User.TenantID)
		for _, sub := range []string{"responsibilities", "certificates", "ability-bindings", "ability-domains"} {
			if w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/"+sub, nil, claimsB); w.Code != http.StatusNotFound {
				t.Fatalf("他企业 GET %s 应 404, got %d: %s", sub, w.Code, w.Body.String())
			}
		}
	})
}

// TestPartnerCoBuild_GrantedPositionSubResources 学校授权（grant）岗位的子资源只读接口
// 应对被授权企业开放（列表/详情可见性与子资源一致性回归：曾因 ownedPosition 仅认共建
// 导致授权岗位子资源全部 404）。
func TestPartnerCoBuild_GrantedPositionSubResources(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "授权子资源测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "授权子资源学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	// 学校自建并发布岗位（source_enterprise_id 为空），带子资源数据
	positionID := uuid.NewString()
	if _, err := env.DB.Exec(context.Background(), `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, version, created_by)
		VALUES ($1, $2, $3, $4, 'enterprise', 'published', 'V1.0', $5)
	`, positionID, schoolID, "gr-"+suffix, "授权岗位-"+suffix, testhelper.TestOperatorID); err != nil {
		t.Fatalf("预置学校岗位失败: %v", err)
	}
	responsibilityID := uuid.NewString()
	if _, err := env.DB.Exec(context.Background(), `
		INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order)
		VALUES ($1, $2, $3, $4, 0)
	`, responsibilityID, schoolID, positionID, "授权职责-"+suffix); err != nil {
		t.Fatalf("预置岗位职责失败: %v", err)
	}

	// 学校把岗位授权给企业
	svc := store.New(env.DB)
	if err := svc.AllianceGrants().Upsert(context.Background(), schoolID, enterpriseID, "position", []string{positionID}, testhelper.TestOperatorID); err != nil {
		t.Fatalf("预置授权失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(context.Background(), `DELETE FROM alliance_resource_grants WHERE tenant_id = $1`, schoolID)
	})

	for _, sub := range []string{"responsibilities", "certificates", "ability-bindings", "ability-domains"} {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/"+sub, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("授权岗位 GET %s 应 200, got %d: %s", sub, w.Code, w.Body.String())
		}
	}
	w := doWithClaims(r, http.MethodGet, "/partner/co-build/positions/"+positionID+"/responsibilities", nil, claims)
	items, total, err := testhelper.UnmarshalList[domain.PositionResponsibility](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Name != "授权职责-"+suffix {
		t.Fatalf("授权岗位职责列表不符: total=%d body=%s", total, w.Body.String())
	}
}

// assertGranted 断言学校-企业某类型授权记录是否包含指定资源 id。
func assertGranted(t *testing.T, env *testhelper.TestEnv, schoolTenantID, enterpriseID, resourceType, resourceID string, want bool) {
	t.Helper()
	var exists bool
	if err := env.DB.QueryRow(context.Background(), `
		SELECT EXISTS(
			SELECT 1 FROM alliance_resource_grants
			WHERE tenant_id = $1 AND enterprise_id = $2 AND resource_type = $3 AND $4::uuid = ANY(resource_ids)
		)`, schoolTenantID, enterpriseID, resourceType, resourceID).Scan(&exists); err != nil {
		t.Fatalf("查询授权记录失败: %v", err)
	}
	if exists != want {
		t.Fatalf("授权记录存在性应为 %v, got %v (type=%s id=%s)", want, exists, resourceType, resourceID)
	}
}

// TestPartnerCoBuild_AutoGrantLifecycle 新建共建岗位/场景自动关联授权给当前企业
// （与学校授权资源统一处理），删除后授权记录同步清理。
func TestPartnerCoBuild_AutoGrantLifecycle(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "自动授权测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "自动授权学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	// 新建岗位 → 自动授权
	w := doWithClaims(r, http.MethodPost, "/partner/co-build/positions", map[string]interface{}{
		"schoolTenantId": schoolID,
		"name":           "自动授权岗位-" + suffix,
		"positionType":   "enterprise",
	}, claims)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var pos domain.CareerPosition
	if err := json.Unmarshal(w.Body.Bytes(), &pos); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	assertGranted(t, env, schoolID, enterpriseID, "position", pos.ID, true)

	// 新建场景 → 自动授权
	ws := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes", map[string]interface{}{
		"schoolTenantId": schoolID,
		"name":           "自动授权场景-" + suffix,
	}, claims)
	if ws.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", ws.Code, ws.Body.String())
	}
	var sc domain.Scenario
	if err := json.Unmarshal(ws.Body.Bytes(), &sc); err != nil {
		t.Fatalf("unmarshal scene: %v", err)
	}
	assertGranted(t, env, schoolID, enterpriseID, "scene", sc.ID, true)

	// 删除岗位 → 授权记录同步清理
	wd := doWithClaims(r, http.MethodDelete, "/partner/co-build/positions/"+pos.ID, nil, claims)
	if wd.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wd.Code, wd.Body.String())
	}
	assertGranted(t, env, schoolID, enterpriseID, "position", pos.ID, false)

	// 删除场景 → 授权记录同步清理
	wsd := doWithClaims(r, http.MethodDelete, "/partner/co-build/scenes/"+sc.ID, nil, claims)
	if wsd.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wsd.Code, wsd.Body.String())
	}
	assertGranted(t, env, schoolID, enterpriseID, "scene", sc.ID, false)

	// 其他企业不应拿到本企业共建资源的授权记录
	if _, err := env.DB.Exec(ctx, `DELETE FROM alliance_resource_grants WHERE tenant_id = $1`, schoolID); err != nil {
		t.Fatalf("清理授权记录: %v", err)
	}
}

// TestPartnerCoBuild_ScenarioWeights 共建场景任务权重：保存后读取一致，未授权企业 403。
func TestPartnerCoBuild_ScenarioWeights(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "权重测试企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "权重测试学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	// 新建场景
	ws := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes", map[string]interface{}{
		"schoolTenantId": schoolID,
		"name":           "权重场景-" + suffix,
	}, claims)
	if ws.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", ws.Code, ws.Body.String())
	}
	var sc domain.Scenario
	if err := json.Unmarshal(ws.Body.Bytes(), &sc); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// 新建任务
	wt := doWithClaims(r, http.MethodPost, "/partner/co-build/scenes/"+sc.ID+"/tasks", map[string]interface{}{
		"name": "权重任务-" + suffix, "code": "TK-" + suffix, "taskType": "assessment", "difficulty": 2,
	}, claims)
	if wt.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", wt.Code, wt.Body.String())
	}
	var task domain.ScenarioTask
	if err := json.Unmarshal(wt.Body.Bytes(), &task); err != nil {
		t.Fatalf("unmarshal task: %v", err)
	}

	// 保存权重
	wp := doWithClaims(r, http.MethodPut, "/partner/co-build/scenes/"+sc.ID+"/weights", map[string]interface{}{
		"weights": []map[string]interface{}{{"taskId": task.ID, "weight": 60}},
	}, claims)
	if wp.Code != http.StatusOK {
		t.Fatalf("保存权重失败: %d %s", wp.Code, wp.Body.String())
	}

	// 读取一致
	wl := doWithClaims(r, http.MethodGet, "/partner/co-build/scenes/"+sc.ID+"/weights", nil, claims)
	if wl.Code != http.StatusOK {
		t.Fatalf("读取权重失败: %d %s", wl.Code, wl.Body.String())
	}
	items, total, err := testhelper.UnmarshalList[domain.ScenarioWeightConfig](wl)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].TaskID != task.ID || items[0].Weight != 60 {
		t.Fatalf("权重不符: total=%d items=%+v", total, items)
	}

	// 未授权企业 403
	_, claimsB, regB, _ := setupCoBuildRouter(t, env, "权重测试企业乙")
	defer cleanupPartnerTenant(env, *regB.User.TenantID)
	wf := doWithClaims(r, http.MethodPut, "/partner/co-build/scenes/"+sc.ID+"/weights", map[string]interface{}{
		"weights": []map[string]interface{}{{"taskId": task.ID, "weight": 30}},
	}, claimsB)
	if wf.Code != http.StatusNotFound {
		t.Fatalf("他企业保存权重应 404, got %d: %s", wf.Code, wf.Body.String())
	}

	// 清理
	env.DB.Exec(ctx, `DELETE FROM scenario_weight_configs WHERE scenario_id = $1`, sc.ID)
}

// TestPartnerCoBuild_ListSchoolCoBuilders 共建人候选接口：返回学校教师（排除学生）
// 与企业专家（绑定账号），无 active link 的学校 403。
func TestPartnerCoBuild_ListSchoolCoBuilders(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	svc := service.New(store.New(env.DB))
	h := &handler.PartnerCoBuildHandler{Service: service.NewPartnerCoBuildService(svc)}
	r := chi.NewRouter()
	r.Get("/partner/co-build/schools/{tenantId}/co-builders", h.ListSchoolCoBuilders)

	// 注册企业 + 学校 + active link
	authH := newPartnerAuthHandler(env)
	r0 := chi.NewRouter()
	r0.Post("/auth/partner/register", authH.PartnerRegister)
	suffix := uuid.NewString()[:8]
	w := doNoAuthJSON(r0, http.MethodPost, "/auth/partner/register", map[string]interface{}{
		"enterpriseName": "共建人候选企业-" + suffix,
		"username":       "cobuilder_ent_" + suffix,
		"password":       "abc12345",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("注册失败: %d: %s", w.Code, w.Body.String())
	}
	var reg partnerLoginResp
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	entTenantID := *reg.User.TenantID
	enterpriseID := partnerEnterpriseID(t, env, entTenantID)
	defer cleanupPartnerTenant(env, entTenantID)

	schoolID := createSchoolTenant(t, env, "共建人候选学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	// 预置学校教师/学生（学生绑定 student 角色，应被排除）
	teacherID := uuid.NewString()
	studentID := uuid.NewString()
	for _, u := range []struct {
		id, name string
	}{{teacherID, "共建教师-" + suffix}, {studentID, "学生-" + suffix}} {
		if _, err := env.DB.Exec(ctx, `
			INSERT INTO users (id, tenant_id, role, platform, username, password_hash, name, status)
			VALUES ($1, $2, 'school', 'portal', $3, 'hash', $4, 'active') ON CONFLICT (id) DO NOTHING
		`, u.id, schoolID, "cob_user_"+u.id[:8], u.name); err != nil {
			t.Fatalf("预置用户失败: %v", err)
		}
	}
	studentRoleID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO roles (id, tenant_id, code, name, status) VALUES ($1, $2, 'student', '学生', 'active')
	`, studentRoleID, schoolID); err != nil {
		t.Fatalf("预置学生角色失败: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3)
	`, uuid.NewString(), studentID, studentRoleID); err != nil {
		t.Fatalf("预置学生角色绑定失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])`, []string{teacherID, studentID})
		env.DB.Exec(ctx, `DELETE FROM roles WHERE id = $1`, studentRoleID)
		env.DB.Exec(ctx, `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{teacherID, studentID})
	})

	// 预置企业专家（绑定企业账号）
	expertID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_experts (id, tenant_id, name, title, enterprise_id, user_id, status)
		VALUES ($1, $2, $3, '资深专家', $4, $5, 'active')
	`, expertID, schoolID, "共建专家-"+suffix, enterpriseID, reg.User.ID); err != nil {
		t.Fatalf("预置专家失败: %v", err)
	}
	// 无绑定账号的专家不可选
	noAccountExpertID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO alliance_experts (id, tenant_id, name, enterprise_id, user_id, status)
		VALUES ($1, $2, $3, $4, NULL, 'active')
	`, noAccountExpertID, schoolID, "无账号专家-"+suffix, enterpriseID); err != nil {
		t.Fatalf("预置无账号专家失败: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE id = ANY($1::uuid[])`, []string{expertID, noAccountExpertID})
	})

	claims := &middleware.Claims{
		UserID:    reg.User.ID,
		TenantID:  &entTenantID,
		Platform:  domain.UserPlatformPartner,
		RoleCodes: []string{domain.RoleEnterpriseMember},
	}

	// 正常返回：教师 + 专家，学生与无账号专家被排除
	wk := doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+schoolID+"/co-builders", nil, claims)
	if wk.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", wk.Code, wk.Body.String())
	}
	items, total, err := testhelper.UnmarshalList[domain.CoBuildUserOption](wk)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if total != 2 {
		t.Fatalf("应返回教师+专家两条, total=%d body=%s", total, wk.Body.String())
	}
	byID := map[string]domain.CoBuildUserOption{}
	for _, it := range items {
		byID[it.ID] = it
	}
	if _, ok := byID[teacherID]; !ok {
		t.Fatalf("应包含学校教师: %+v", items)
	}
	if byID[teacherID].Group != "teacher" {
		t.Fatalf("教师分组应为 teacher: %+v", byID[teacherID])
	}
	expert, ok := byID[reg.User.ID]
	if !ok {
		t.Fatalf("应包含企业专家（按绑定账号）: %+v", items)
	}
	if expert.Group != "expert" || expert.ExpertID != expertID || expert.EnterpriseName == "" {
		t.Fatalf("专家字段不符: %+v", expert)
	}
	if _, ok := byID[studentID]; ok {
		t.Fatalf("学生不应出现在共建人候选: %+v", items)
	}
	if _, ok := byID[noAccountExpertID]; ok {
		t.Fatalf("无绑定账号专家不应出现: %+v", items)
	}

	// 未合作学校 403
	otherSchoolID := createSchoolTenant(t, env, "共建人候选无关学校-"+suffix)
	t.Cleanup(func() { cleanupCoBuildRows(env, otherSchoolID) })
	wf := doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+otherSchoolID+"/co-builders", nil, claims)
	if wf.Code != http.StatusForbidden {
		t.Fatalf("无合作学校应 403, got %d: %s", wf.Code, wf.Body.String())
	}
}

// TestPartnerCoBuild_SchoolDataEndpoints 合作学校只读数据端点：知识点库/微课程/能力绑定/
// 题库/题目/随机抽题/试卷/专业/场景/任务/资源库均返回该校数据，未合作学校 403。
func TestPartnerCoBuild_SchoolDataEndpoints(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	r, claims, reg, enterpriseID := setupCoBuildRouter(t, env, "学校数据端点企业")
	defer cleanupPartnerTenant(env, *reg.User.TenantID)

	suffix := uuid.NewString()[:8]
	schoolID := createSchoolTenant(t, env, "学校数据端点学校-"+suffix)
	linkSchoolEnterprise(t, env, schoolID, enterpriseID, "active")
	t.Cleanup(func() { cleanupCoBuildRows(env, schoolID) })

	// ===== 预置学校数据 =====
	kpID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name, code) VALUES ($1,$2,$3,$4)`,
		kpID, schoolID, "知识点甲-"+suffix, "K1"); err != nil {
		t.Fatalf("预置知识点: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM knowledge_points WHERE id = $1`, kpID) })

	courseID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id) VALUES ($1,$2,$3,$4,'granular','微课','published',$5)`,
		courseID, schoolID, "C1-"+suffix, "微课程甲-"+suffix, reg.User.ID); err != nil {
		t.Fatalf("预置微课程: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM courses WHERE id = $1`, courseID) })

	abilityID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO ability_points (id, tenant_id, name, code) VALUES ($1,$2,$3,$4)`,
		abilityID, schoolID, "能力点甲-"+suffix, "AB1"); err != nil {
		t.Fatalf("预置能力点: %v", err)
	}
	posID := uuid.NewString()
	bindingID := uuid.NewString()
	responsibilityID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, version, created_by) VALUES ($1,$2,$3,$4,'enterprise','draft','enterprise','V1.0',$5)`,
		posID, schoolID, "GW-"+suffix, "能力绑定岗位-"+suffix, reg.User.ID); err != nil {
		t.Fatalf("预置岗位: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order) VALUES ($1,$2,$3,$4,0)`,
		responsibilityID, schoolID, posID, "职责甲-"+suffix); err != nil {
		t.Fatalf("预置职责: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO position_ability_bindings (id, career_position_id, responsibility_id, ability_point_id, required_level, tenant_id) VALUES ($1,$2,$3,$4,'L1',$5)`,
		bindingID, posID, responsibilityID, abilityID, schoolID); err != nil {
		t.Fatalf("预置能力绑定: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM position_ability_bindings WHERE id = $1`, bindingID)
		env.DB.Exec(ctx, `DELETE FROM position_responsibilities WHERE id = $1`, responsibilityID)
		env.DB.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, posID)
		env.DB.Exec(ctx, `DELETE FROM ability_points WHERE id = $1`, abilityID)
	})

	bankID := uuid.NewString()
	questionID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO question_banks (id, tenant_id, name, status, question_count, creator_id, version, owner_type, is_draft_pool, code) VALUES ($1,$2,$3,'published',1,$4,'V1.0','public',false,$5)`,
		bankID, schoolID, "题库甲-"+suffix, reg.User.ID, "BK1-"+suffix); err != nil {
		t.Fatalf("预置题库: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO questions (id, bank_id, tenant_id, type, content, answer, score, difficulty, status, code) VALUES ($1,$2,$3,'choice',$4,'A',5,3,'published',$5)`,
		questionID, bankID, schoolID, "题目甲-"+suffix, "Q1-"+suffix); err != nil {
		t.Fatalf("预置题目: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM questions WHERE id = $1`, questionID)
		env.DB.Exec(ctx, `DELETE FROM question_banks WHERE id = $1`, bankID)
	})

	rdqID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO random_draw_questions (id, tenant_id, name) VALUES ($1,$2,$3)`,
		rdqID, schoolID, "随机题甲-"+suffix); err != nil {
		t.Fatalf("预置随机抽题: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM random_draw_questions WHERE id = $1`, rdqID) })

	examID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO exams (id, tenant_id, name, status, duration, creator_id, code, is_temp) VALUES ($1,$2,$3,'published',60,$4,$5,false)`,
		examID, schoolID, "试卷甲-"+suffix, reg.User.ID, "EX1-"+suffix); err != nil {
		t.Fatalf("预置试卷: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM exams WHERE id = $1`, examID) })

	majorID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,$3,$4)`,
		majorID, schoolID, "MJ1-"+suffix, "专业甲-"+suffix); err != nil {
		t.Fatalf("预置专业: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM majors WHERE id = $1`, majorID) })

	sceneID := uuid.NewString()
	taskID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO scenarios (id, tenant_id, code, name, status, version, difficulty, creator_id) VALUES ($1,$2,$3,$4,'published','V1.0',3,$5)`,
		sceneID, schoolID, "CJ-"+suffix, "克隆候选场景-"+suffix, reg.User.ID); err != nil {
		t.Fatalf("预置场景: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `INSERT INTO scenario_tasks (id, scenario_id, tenant_id, name, code, sort_order, task_type, difficulty) VALUES ($1,$2,$3,$4,$5,0,'assessment',1)`,
		taskID, sceneID, schoolID, "克隆候选任务-"+suffix, "TK-"+suffix); err != nil {
		t.Fatalf("预置任务: %v", err)
	}
	t.Cleanup(func() {
		env.DB.Exec(ctx, `DELETE FROM scenario_tasks WHERE id = $1`, taskID)
		env.DB.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, sceneID)
	})

	resourceID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,'document',$4)`,
		resourceID, schoolID, "资源甲-"+suffix, reg.User.ID); err != nil {
		t.Fatalf("预置资源: %v", err)
	}
	t.Cleanup(func() { env.DB.Exec(ctx, `DELETE FROM resource_library WHERE id = $1`, resourceID) })

	// ===== 逐端点断言 =====
	type endpointCheck struct {
		path   string
		expect string
		query  string
	}
	checks := []endpointCheck{
		{"/partner/co-build/schools/" + schoolID + "/knowledge-points", kpID, ""},
		{"/partner/co-build/schools/" + schoolID + "/courses", courseID, ""},
		{"/partner/co-build/schools/" + schoolID + "/ability-bindings?careerPositionId=" + posID, bindingID, ""},
		{"/partner/co-build/schools/" + schoolID + "/question-banks", bankID, ""},
		{"/partner/co-build/schools/" + schoolID + "/questions?bankId=" + bankID, questionID, ""},
		{"/partner/co-build/schools/" + schoolID + "/random-draw-questions", rdqID, ""},
		{"/partner/co-build/schools/" + schoolID + "/exams", examID, ""},
		{"/partner/co-build/schools/" + schoolID + "/majors", majorID, ""},
		{"/partner/co-build/schools/" + schoolID + "/scenarios", sceneID, ""},
		{"/partner/co-build/schools/" + schoolID + "/tasks", taskID, ""},
		{"/partner/co-build/schools/" + schoolID + "/resources", resourceID, ""},
	}
	for _, c := range checks {
		w := doWithClaims(r, http.MethodGet, c.path, nil, claims)
		if w.Code != http.StatusOK {
			t.Fatalf("GET %s 应 200, got %d: %s", c.path, w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), c.expect) {
			t.Fatalf("GET %s 应包含预置数据 %s, body=%s", c.path, c.expect, w.Body.String())
		}
	}

	// 未合作学校 403（代表性抽查）
	otherSchoolID := createSchoolTenant(t, env, "学校数据无关学校-"+suffix)
	t.Cleanup(func() { cleanupCoBuildRows(env, otherSchoolID) })
	for _, p := range []string{"knowledge-points", "question-banks", "resources"} {
		w := doWithClaims(r, http.MethodGet, "/partner/co-build/schools/"+otherSchoolID+"/"+p, nil, claims)
		if w.Code != http.StatusForbidden {
			t.Fatalf("无合作学校 GET %s 应 403, got %d: %s", p, w.Code, w.Body.String())
		}
	}
}
