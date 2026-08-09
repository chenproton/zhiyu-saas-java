package handler_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
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

// TestTeachingPlanGenerate_AutoClasses 生成教学计划时自动带入人培方案关联专业（组织树同名「专业」节点）下的全部班级。
func TestTeachingPlanGenerate_AutoClasses(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	// 1. 组织类型：专业 / 班级
	majorTypeID := uuid.NewString()
	classTypeID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO org_types (id, tenant_id, name, category, is_default)
		VALUES ($1, $2, '专业', 'internal', FALSE)
	`, majorTypeID, tenantID)
	execOrFail(t, env, ctx, `
		INSERT INTO org_types (id, tenant_id, name, category, is_default)
		VALUES ($1, $2, '班级', 'internal', FALSE)
	`, classTypeID, tenantID)

	// 2. 组织树：软件技术 专业 → 软件1班/软件2班；其他专业 → 其他班（不应带入）
	majorOrgID := uuid.NewString()
	class1, class2 := uuid.NewString(), uuid.NewString()
	otherMajorOrgID := uuid.NewString()
	otherClass := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '软件技术', $3, NULL)
	`, majorOrgID, tenantID, majorTypeID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '软件1班', $3, $4)
	`, class1, tenantID, classTypeID, majorOrgID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '软件2班', $3, $4)
	`, class2, tenantID, classTypeID, majorOrgID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '网络技术', $3, NULL)
	`, otherMajorOrgID, tenantID, majorTypeID)
	execOrFail(t, env, ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '网络1班', $3, $4)
	`, otherClass, tenantID, classTypeID, otherMajorOrgID)

	// 3. 专业字典
	majorID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO majors (id, tenant_id, code, name) VALUES ($1, $2, 'RJJS', '软件技术')
	`, majorID, tenantID)

	// 4. 人培方案 + 课程（含普通课与场景课各一门）
	programID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO training_programs (id, tenant_id, name, major_id, entry_year, status)
		VALUES ($1, $2, '软件技术人才培养方案（2025级）', $3, 2025, 'published')
	`, programID, tenantID, majorID)
	execOrFail(t, env, ctx, `
		INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, semester, nature, sort_order)
		VALUES ($1, $2, '程序设计基础', 'RJ001', 4, 64, 1, '必修', 0)
	`, uuid.NewString(), programID)

	// 5. 学期
	termID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count)
		VALUES ($1, $2, '2025-2026-1', '2025-09-01', '2026-01-15', 16)
	`, termID, tenantID)

	// 6. 挂载生成接口
	st2 := store.New(env.DB)
	svc2 := service.New(st2)
	tpHandler := &handler.TeachingPlanHandler{Service: service.NewAffairsPlanService(svc2)}
	rr := chi.NewRouter()
	rr.Use(middleware.JWT(testhelper.TestJWTSecret))
	rr.Post("/affairs/teaching-plans", tpHandler.Generate)
	rr.Get("/affairs/teaching-plans/{id}", tpHandler.Get)

	token := env.NewTokenWithIdentity(testhelper.TestOperatorID, tenantID, domain.UserRoleOperator, nil, "school_admin")
	req := httptest.NewRequest(http.MethodPost, "/affairs/teaching-plans", bytes.NewBufferString(`{"programId":"`+programID+`","termId":"`+termID+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	rr.ServeHTTP(rec, req)
	w := rec
	if w.Code != http.StatusCreated {
		t.Fatalf("生成教学计划 status = %d, body = %s", w.Code, w.Body.String())
	}
	detail, err := testhelper.Unmarshal[handler.TeachingPlanDetailResponse](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(detail.Entries) != 1 {
		t.Fatalf("entries = %d, want 1", len(detail.Entries))
	}
	for _, e := range detail.Entries {
		if len(e.ClassNodeIDs) != 2 {
			t.Fatalf("entry[%s] classNodeIds = %v, want [%s, %s]", e.CourseName, e.ClassNodeIDs, class1, class2)
		}
		got := map[string]bool{}
		for _, id := range e.ClassNodeIDs {
			got[id] = true
		}
		if !got[class1] || !got[class2] {
			t.Fatalf("entry[%s] classNodeIds = %v, want 含 %s 与 %s", e.CourseName, e.ClassNodeIDs, class1, class2)
		}
		if got[otherClass] {
			t.Fatalf("entry[%s] 不应包含其他专业班级 %s", e.CourseName, otherClass)
		}
	}

	// 7. 清理（defer 化：断言失败提前退出也不残留）
	t.Cleanup(func() {
		for _, q := range []string{
			"DELETE FROM teaching_plans WHERE tenant_id = $1",
			"DELETE FROM training_programs WHERE tenant_id = $1",
			"DELETE FROM terms WHERE tenant_id = $1",
			"DELETE FROM organizations WHERE tenant_id = $1",
			"DELETE FROM org_types WHERE tenant_id = $1",
		} {
			env.DB.Exec(ctx, q, tenantID)
		}
		env.DB.Exec(ctx, "DELETE FROM majors WHERE id = $1", majorID)
	})
}
