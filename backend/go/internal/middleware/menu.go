package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// MenuGrant 用户合并后的菜单授权视图（context 内传递，见 ADR-0008）。
type MenuGrant = domain.MenuGrant

const (
	// ContextKeyMenuGrant 携带 MenuContext 装载的用户菜单授权视图。
	ContextKeyMenuGrant contextKey = "menu_grant"
	// menuGrantCacheTTL 用户菜单授权缓存时长：权限变更（roles 配置页保存）
	// 最长 N 秒后生效，兼顾授权即时性与请求开销。
	menuGrantCacheTTL = 60 * time.Second
)

// MenuContext 装载用户菜单授权到 context（菜单驱动 RBAC 的统一数据源）：
//   - 新令牌不携带具体菜单路径（JWT 瘦身），统一查库合并全部角色的
//     permissions.menus（+ admin 标记），经 Redis 短缓存（60s）降低请求开销；
//   - 旧令牌（7 天有效期内带完整权限 map）在 db 为 nil 的测试环境回退解析
//     claims.Permissions；生产环境一律以库为准（角色权限变更即时生效）；
//   - 「无 menus = 全量」兜底：school_admin/platform_admin 角色合并结果为空时
//     视为全量放行（与前端 hasMenuPermission 短路语义一致）。
//
// 挂载位置：JWT → RequireActiveUser 之后、各业务授权组之前（portal 平台组内）。
func MenuContext(db *pgxpool.Pool, redisClient *redis.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				next.ServeHTTP(w, r)
				return
			}
			grant := loadMenuGrant(r, db, redisClient, claims)
			if grant != nil {
				ctx := context.WithValue(r.Context(), ContextKeyMenuGrant, grant)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CurrentMenuGrant 读取请求上下文中的用户菜单授权视图（MenuContext 装载后可用）。
func CurrentMenuGrant(r *http.Request) *MenuGrant {
	g, _ := r.Context().Value(ContextKeyMenuGrant).(*MenuGrant)
	return g
}

// HasMenuGrant 判定当前请求用户（MenuContext 装载后）是否拥有任一所需菜单授权。
func HasMenuGrant(r *http.Request, menuPaths ...string) bool {
	g := CurrentMenuGrant(r)
	if g == nil {
		return false
	}
	for _, m := range menuPaths {
		if g.Covers(m) {
			return true
		}
	}
	return false
}

// RequireMenu 菜单驱动的 API 授权中间件（ADR-0008）：
// 用户菜单授权（MenuContext 装载）覆盖任一所需菜单路径即放行；
// 未登录 401；无对应菜单授权 403。
// 调用方按「页面根菜单路径」声明（如 "/portal/apps/alliance/brands"），
// 子页面菜单（brands/employer 等）经 Covers 的同链匹配自动放行。
func RequireMenu(menuPaths ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if HasMenuGrant(r, menuPaths...) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}

// loadMenuGrant 加载用户菜单授权：优先 Redis 缓存，未命中查库合并，
// 写回缓存；db 为 nil（路由/权限装配测试）时回退旧令牌权限 map，再否则空视图。
func loadMenuGrant(r *http.Request, db *pgxpool.Pool, redisClient *redis.Client, claims *Claims) *MenuGrant {
	ctx := r.Context()

	// 测试环境回退：无 db 时用旧令牌（带完整权限 map）解析，保证
	// 中间件单测/路由装配测试可独立验证判定逻辑。
	if db == nil {
		if g := grantFromPermissions(claims.Permissions); g != nil {
			return applyFullAccessFallback(claims, g)
		}
		return applyFullAccessFallback(claims, &MenuGrant{GrantedPaths: map[string]bool{}})
	}

	// Redis 缓存命中直接返回。
	if redisClient != nil {
		if raw, err := redisClient.Get(ctx, menuGrantCacheKey(claims.UserID)).Bytes(); err == nil && len(raw) > 0 {
			var g MenuGrant
			if json.Unmarshal(raw, &g) == nil {
				return &g
			}
		}
	}

	g, err := store.New(db).Roles().GetUserMenuGrant(ctx, claims.UserID)
	if err != nil {
		// DB 异常 fail-closed：返回空授权视图（业务中间件据此 403），
		// 不阻断鉴权主链路（RequireActiveUser 已做会话校验）。
		g = &MenuGrant{GrantedPaths: map[string]bool{}}
	}
	g = applyFullAccessFallback(claims, g)

	if redisClient != nil {
		if raw, err := json.Marshal(g); err == nil {
			redisClient.Set(ctx, menuGrantCacheKey(claims.UserID), raw, menuGrantCacheTTL)
		}
	}
	return g
}

// applyFullAccessFallback 「无 menus = 全量」兜底：school_admin/platform_admin
// 角色合并结果为空（未显式配置菜单）时视为全量放行，与前端 hasMenuPermission
// 的角色短路语义一致（ADR-0008 决策 5）。
func applyFullAccessFallback(claims *Claims, g *MenuGrant) *MenuGrant {
	if g == nil || !g.Empty() {
		return g
	}
	for _, code := range claims.RoleCodes {
		if code == domain.RoleSchoolAdmin || code == domain.RolePlatformAdmin {
			g.Admin = true
			break
		}
	}
	return g
}

// grantFromPermissions 从完整权限 map 构建授权视图（旧令牌/测试环境回退）。
func grantFromPermissions(perms domain.JSONMap) *MenuGrant {
	if len(perms) == 0 {
		return nil
	}
	g := &MenuGrant{GrantedPaths: map[string]bool{}}
	g.Merge(perms)
	return g
}

func menuGrantCacheKey(userID string) string {
	return "menu:grant:" + userID
}
