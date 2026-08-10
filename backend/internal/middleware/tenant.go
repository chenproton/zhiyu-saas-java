package middleware

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TenantOwnedContent 内容资源租户归属中间件（P3 试点）：
// 路由声明「资源表 + id 参数名」，请求携带 {id} 时先校验资源属于当前租户，
// 跨租户/不存在一律 404（与 handler 内 checkTenantAccess 语义一致，前置到路由层）。
// 无 {id} 的请求（如创建）直接放行。
//
// 试点范围：内容写路由（exams/scenarios），验证后推广到其余 id 型资源路由，
// 逐步收敛 handler 层 73 处手工 verifyTenantOwnership 调用。
func TenantOwnedContent(db *pgxpool.Pool, table, idParam string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			id := chi.URLParam(r, idParam)
			if id == "" {
				next.ServeHTTP(w, r)
				return
			}
			tenantID, err := store.New(db).ContentActions().GetTenantID(r.Context(), table, id)
			if err != nil || tenantID != *claims.TenantID {
				http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
