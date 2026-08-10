package middleware

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// RequirePlatform 强制 JWT 中的 Platform 字段匹配目标平台，拒绝跨平台请求。
// 平台隔离：SaaS 运营端（超管控制台）与 Portal 教育端使用独立 token 通道，
// 防止 portal token 访问运营管理接口、saas token 访问教育业务接口。
func RequirePlatform(platform domain.UserPlatform) func(http.Handler) http.Handler {
	return requirePlatformIn(platform)
}

// RequireAnyPlatform 强制 JWT 中的 Platform 命中白名单之一（多平台共用接口用）。
// 注意：同 method+path 在多个平台组内分别注册会被 chi 静默覆盖（后注册顶替先注册），
// 多平台接口必须单点注册 + 本中间件，而非重复注册。
func RequireAnyPlatform(platforms ...domain.UserPlatform) func(http.Handler) http.Handler {
	return requirePlatformIn(platforms...)
}

func requirePlatformIn(platforms ...domain.UserPlatform) func(http.Handler) http.Handler {
	allowed := make(map[domain.UserPlatform]bool, len(platforms))
	for _, p := range platforms {
		allowed[p] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if len(allowed) == 0 || !allowed[claims.Platform] {
				http.Error(w, `{"error":"platform mismatch"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
