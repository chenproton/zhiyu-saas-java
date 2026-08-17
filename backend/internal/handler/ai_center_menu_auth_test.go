package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestAICenterAdmin_MenuDriven AI 管理端菜单驱动授权（ADR-0008）：
// 自定义角色在 roles 页勾选 AI 管理菜单（/portal/apps/ai/admin/reviews、
// /portal/apps/ai/admin/integrations）即获得审核/挂接管理权限，不再限
// school_admin 角色；未配置的模块 API 仍按菜单拒绝。
func TestAICenterAdmin_MenuDriven(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	customRawID := "ai-custom-menu-001"
	token := env.NewTokenWithIdentity(customRawID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "custom_role")

	// 该用户被 testhelper 绑定 aux admin 全量角色：收窄为「仅 AI 管理菜单」，
	// 验证菜单精确授权（非全量）。
	realID := uuid.NewSHA1(uuid.NameSpaceOID, []byte("testaux:"+customRawID)).String()
	roleID := uuid.NewSHA1(uuid.NameSpaceOID, []byte("auxadmin-role:"+realID)).String()
	if _, err := env.DB.Exec(ctx, `
		UPDATE roles SET permissions = $1 WHERE id = $2
	`, `{"menus":{"/portal/apps/ai/admin/reviews":true,"/portal/apps/ai/admin/integrations":true}}`, roleID); err != nil {
		t.Fatalf("update role perms: %v", err)
	}

	t.Run("勾选 AI 管理菜单可用审核", func(t *testing.T) {
		w := env.DoWithToken(http.MethodGet, "/api/v1/ai/admin/reviews?type=kb", nil, token)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
	t.Run("勾选 AI 管理菜单可用挂接", func(t *testing.T) {
		w := env.DoWithToken(http.MethodGet, "/api/v1/ai/admin/integrations", nil, token)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
	t.Run("未配置其他模块菜单仍拒绝", func(t *testing.T) {
		w := env.DoWithToken(http.MethodGet, "/api/v1/job/positions", nil, token)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
}
