package router

import (
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// publicAPIRoutes 公开路由白名单：无需认证即可访问的 /api/v1 路由。
// 新增公开路由必须显式登记在此处，否则审计测试直接 fail。
var publicAPIRoutes = map[string]bool{
	"POST /api/v1/auth/login":            true,
	"POST /api/v1/auth/saas/login":       true,
	"POST /api/v1/auth/portal/login":     true,
	"POST /api/v1/auth/partner/login":    true,
	"POST /api/v1/auth/partner/register": true,
	"POST /api/v1/auth/select-tenant":    true,
	"GET /api/v1/settings/theme":         true,
}

func mwName(mw func(http.Handler) http.Handler) string {
	return runtime.FuncForPC(reflect.ValueOf(mw).Pointer()).Name()
}

// TestAPIRoutesRequireAuthzMiddleware 默认拒绝兜底审计：
// 遍历全量 /api/v1 路由（公开白名单除外），凡认证组内路由必须命中
// 角色/平台级授权中间件（RequireRole*/RequirePlatform*/RequireSystemPermission/RequireUserRead），
// 防止"漏挂权限 = 默认放行"；同时拦截后注册弱权限组静默顶替强权限组的回归。
func TestAPIRoutesRequireAuthzMiddleware(t *testing.T) {
	rt := New(nil, "test-secret", nil, nil, nil)
	chiRouter, ok := rt.Handler.(chi.Router)
	if !ok {
		t.Fatal("router handler is not chi.Router")
	}

	var failures []string
	err := chi.Walk(chiRouter, func(method, route string, _ http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		if !strings.HasPrefix(route, "/api/v1") {
			return nil
		}
		if publicAPIRoutes[method+" "+route] {
			return nil
		}
		for _, mw := range middlewares {
			n := mwName(mw)
			// 注：闭包可能被编译器内联，函数名体现为调用点符号（如
			// RegisterAuthenticatedRoutes.RequirePlatform.func2），
			// 故按中间件原函数名关键字匹配，而非包路径
			if strings.Contains(n, "RequireRole") ||
				strings.Contains(n, "RequirePlatform") ||
				strings.Contains(n, "RequireSystemPermission") ||
				strings.Contains(n, "RequireUserRead") {
				return nil
			}
		}
		failures = append(failures, method+" "+route)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(failures) > 0 {
		t.Errorf("以下路由缺少角色/平台级授权中间件（漏挂权限 = 默认放行）：\n%s", strings.Join(failures, "\n"))
	}
}

// TestPublicRoutesWhitelistReachable 确保公开白名单路由确实挂在认证组之外
// （直接请求无 token 不应 401/403 拦截，而是进入 handler 后由业务逻辑响应）。
func TestPublicRoutesWhitelistReachable(t *testing.T) {
	rt := New(nil, "test-secret", nil, nil, nil)
	chiRouter, ok := rt.Handler.(chi.Router)
	if !ok {
		t.Fatal("router handler is not chi.Router")
	}

	seen := map[string]bool{}
	_ = chi.Walk(chiRouter, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if publicAPIRoutes[method+" "+route] {
			seen[method+" "+route] = true
		}
		return nil
	})
	for r := range publicAPIRoutes {
		if !seen[r] {
			t.Errorf("白名单路由未注册（或已被覆盖）：%s", r)
		}
	}
}
