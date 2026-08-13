package cache

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

func tenantFromRequest(r *http.Request) string {
	claims := authmw.CurrentUser(r)
	if claims != nil && claims.TenantID != nil {
		return *claims.TenantID
	}
	return "global"
}

func PublicPositionsKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		key := "zhiyu:" + tenant + ":public:positions"
		v := r.URL.Query()
		for _, p := range []string{"search", "positionType", "limit", "offset"} {
			if val := v.Get(p); val != "" {
				key += ":" + p + ":" + val
			}
		}
		return key
	}
}

// DashboardKey 工作台仪表盘缓存键：按租户+用户+角色隔离，避免跨用户/跨角色串数据
// （同一用户切换角色时视图不同，role 缺失会命中对方视图缓存）。
func DashboardKey() KeyFunc {
	return func(r *http.Request) string {
		claims := authmw.CurrentUser(r)
		tenant := "global"
		if claims != nil && claims.TenantID != nil {
			tenant = *claims.TenantID
		}
		userID := ""
		if claims != nil {
			userID = claims.UserID
		}
		role := r.URL.Query().Get("role")
		return "zhiyu:" + tenant + ":dashboard:" + userID + ":role:" + role
	}
}

// PublicScenariosKey 场景列表缓存键：租户 + 查询参数 + 学生角色段。
// 学生列表由服务端强制过滤为已发布（越权加固 A3），与教师查询参数相同但结果不同，
// 键中必须带角色段，否则学生会命中教师缓存的未过滤列表。
func PublicScenariosKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		key := "zhiyu:" + tenant + ":public:scenarios"
		if authmw.HasRole(authmw.CurrentUser(r), domain.RoleStudent) {
			key += ":role:student"
		}
		v := r.URL.Query()
		for _, p := range []string{"search", "status", "batchId", "careerPositionId", "limit", "offset"} {
			if val := v.Get(p); val != "" {
				key += ":" + p + ":" + val
			}
		}
		return key
	}
}
