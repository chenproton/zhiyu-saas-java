package cache

import (
	"net/http"

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

func LandingExamsKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		return "zhiyu:" + tenant + ":landing:exams"
	}
}

// DashboardKey 工作台仪表盘缓存键：按租户+用户隔离，避免跨用户串数据。
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
		return "zhiyu:" + tenant + ":dashboard:" + userID
	}
}

// PublicScenariosKey 场景列表缓存键：租户 + 查询参数（管理端与学生端查询参数不同，天然隔离）。
func PublicScenariosKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		key := "zhiyu:" + tenant + ":public:scenarios"
		v := r.URL.Query()
		for _, p := range []string{"search", "status", "batchId", "careerPositionId", "limit", "offset"} {
			if val := v.Get(p); val != "" {
				key += ":" + p + ":" + val
			}
		}
		return key
	}
}
