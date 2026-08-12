package middleware

import (
	"net/http"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// systemMenuPrefix 系统管理菜单路径前缀，与前端权限树一致。
const systemMenuPrefix = "/portal/apps/system"

// RequireRole returns a middleware that only allows users bound to at least
// one role whose code is in the given allow-list.
func RequireRole(allowedCodes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(allowedCodes) == 0 {
				http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
				return
			}
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			for _, code := range allowedCodes {
				if HasRole(claims, code) {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}

// RequireRoleOrMenu returns a middleware that allows users who are bound to
// at least one allowed role code OR who have any explicitly granted menu
// permission. This bridges the gap between frontend menu-based permission
// grants and backend API authorization.
func RequireRoleOrMenu(allowedCodes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			for _, code := range allowedCodes {
				if HasRole(claims, code) {
					next.ServeHTTP(w, r)
					return
				}
			}
			// 菜单权限放行仅限只读请求（GET/HEAD/OPTIONS）：
			// 菜单权限桥接的是前端页面可见性，写操作（POST/PUT/DELETE）必须走角色绑定，
			// 防止"有任意菜单即可操作全量 CRUD/审批"的授权绕过。
			if isReadOnlyMethod(r.Method) && HasAnyMenuPermission(claims) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}

// isReadOnlyMethod 判断 HTTP 方法是否为只读。
func isReadOnlyMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}

// HasRole reports whether the user is bound to a role with the given code.
func HasRole(claims *Claims, code string) bool {
	if claims == nil {
		return false
	}
	for _, c := range claims.RoleCodes {
		if c == code {
			return true
		}
	}
	return false
}

// HasAnyMenuPermission reports whether the user has at least one explicitly
// granted menu path in their permissions. Returns false when no menus key
// exists or no entry is set to true (empty menus = backward compat → full
// access, handled by HasSystemPermission).
// 新令牌读取精简载荷 HasMenu；旧令牌（7 天有效期内）回退解析完整权限 map。
func HasAnyMenuPermission(claims *Claims) bool {
	if claims == nil {
		return false
	}
	if claims.HasMenu {
		return true
	}
	if len(claims.Permissions) == 0 {
		return false
	}
	menusVal, ok := claims.Permissions["menus"]
	if !ok {
		return false
	}
	menus, ok := menusVal.(map[string]interface{})
	if !ok {
		return false
	}
	for _, granted := range menus {
		if val, ok := granted.(bool); ok && val {
			return true
		}
	}
	return false
}

// HasSystemPermission reports whether the user is allowed to access portal
// system management routes. It mirrors the frontend menu permission model:
//   - the admin flag grants all permissions.
//   - a granted menu path under /portal/apps/system allows system access.
//
// A business menu grant alone never implies system management access.
// Users with no permissions configuration are denied; callers such as
// RequireSystemPermission still admit school_admin/platform_admin by role, so
// tightening the default here does not affect role-based access.
// 新令牌读取精简载荷（Admin/SystemMenus）；旧令牌回退解析完整权限 map。
func HasSystemPermission(claims *Claims) bool {
	if claims == nil {
		return false
	}
	if claims.Admin || len(claims.SystemMenus) > 0 {
		return true
	}
	if len(claims.Permissions) == 0 {
		return false
	}
	if admin, ok := claims.Permissions["admin"].(bool); ok && admin {
		return true
	}
	menusVal, hasMenus := claims.Permissions["menus"]
	if !hasMenus {
		return false
	}
	menus, ok := menusVal.(map[string]interface{})
	if !ok {
		return false
	}
	for path, granted := range menus {
		if val, ok := granted.(bool); ok && val && strings.HasPrefix(path, systemMenuPrefix) {
			return true
		}
	}
	return false
}

// RequireSystemPermission returns a middleware that only allows users with
// system management menu permission, school_admin role, or platform_admin role.
func RequireSystemPermission() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if HasSystemPermission(claims) || HasRole(claims, domain.RoleSchoolAdmin) || HasRole(claims, domain.RolePlatformAdmin) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}

// RequireAllianceManager 联盟（产教融合）模块管理权限中间件（P3 业务权限声明化试点）：
// 语义与 handler.canManageAlliance 完全一致——教师/学校管理员/平台管理员，
// 或有系统设置菜单权限的角色可放行；企业导师（enterprise_mentor）仅保留
// 岗位/场景共建与测评打分，不再有联盟管理权限（B13 角色收窄）。
func RequireAllianceManager() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			for _, code := range []string{
				domain.RoleTeacher, domain.RoleSchoolAdmin, domain.RolePlatformAdmin,
			} {
				if HasRole(claims, code) {
					next.ServeHTTP(w, r)
					return
				}
			}
			if HasSystemPermission(claims) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}

// RequireUserRead returns a middleware that allows reading user lists/details
// for business users (teacher, school_admin, enterprise_mentor, platform_admin)
// and users with system management permissions. Write operations still require
// system admin access.
func RequireUserRead() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if HasSystemPermission(claims) {
				next.ServeHTTP(w, r)
				return
			}
			for _, code := range []string{domain.RoleTeacher, domain.RoleSchoolAdmin, domain.RoleEnterpriseMentor, domain.RolePlatformAdmin} {
				if HasRole(claims, code) {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}
