package middleware

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// RequirePlatform 强制 JWT 中的 Platform 字段匹配目标平台，拒绝跨平台请求。
// 平台隔离：SaaS 运营端（超管控制台）与 Portal 教育端使用独立 token 通道，
// 防止 portal token 访问运营管理接口、saas token 访问教育业务接口。
func RequirePlatform(platform domain.UserPlatform) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if claims.Platform != platform {
				http.Error(w, `{"error":"platform mismatch"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
