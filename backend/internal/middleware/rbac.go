package middleware

import (
	"net/http"
	"strings"
)

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
			if HasAnyMenuPermission(claims) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
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

// IsPlatformAdmin is a convenience helper for handlers that need a quick
// role check.
func IsPlatformAdmin(claims *Claims) bool {
	return HasRole(claims, "platform_admin")
}

// IsSchoolAdmin is a convenience helper for portal system management routes.
func IsSchoolAdmin(claims *Claims) bool {
	return HasRole(claims, "school_admin")
}

// HasAnyMenuPermission reports whether the user has at least one explicitly
// granted menu path in their permissions. Returns false when no menus key
// exists or no entry is set to true (empty menus = backward compat → full
// access, handled by HasSystemPermission).
func HasAnyMenuPermission(claims *Claims) bool {
	if claims == nil || len(claims.Permissions) == 0 {
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
//   - any explicitly granted business menu path also allows system access
//     (reference-data APIs such as industries/majors are needed by all modules).
//
// Users with no permissions configuration are denied; callers such as
// RequireSystemPermission still admit school_admin/platform_admin by role, so
// tightening the default here does not affect role-based access.
func HasSystemPermission(claims *Claims) bool {
	if claims == nil {
		return false
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
		if val, ok := granted.(bool); ok && val && strings.HasPrefix(path, "/portal/apps/system") {
			return true
		}
	}
	if HasAnyMenuPermission(claims) {
		return true
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
			if HasSystemPermission(claims) || HasRole(claims, "school_admin") || HasRole(claims, "platform_admin") {
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
			for _, code := range []string{"teacher", "school_admin", "enterprise_mentor", "platform_admin"} {
				if HasRole(claims, code) {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}
