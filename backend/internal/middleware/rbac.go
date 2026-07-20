package middleware

import (
	"net/http"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// RequireRole returns a middleware that only allows users bound to at least
// one role whose code is in the given allow-list. The empty allow-list means no
// restriction (useful when the caller builds the list conditionally).
func RequireRole(allowedCodes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(allowedCodes) == 0 {
				next.ServeHTTP(w, r)
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

// RequirePermission returns a middleware that checks the user's merged role
// permissions. Permissions are expected to be stored as a nested map:
//
//	{
//	  "moduleName": {
//	    "pageName": {
//	      "buttons": ["create", "delete"]
//	    }
//	  }
//	}
//
// If the user has no permissions stored, access is denied. Admin flag
// (`permissions.admin == true`) grants all permissions.
func RequirePermission(module, page, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := CurrentUser(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if !hasPermission(claims.Permissions, module, page, action) {
				http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func hasPermission(perms domain.JSONMap, module, page, action string) bool {
	if len(perms) == 0 {
		return false
	}
	if admin, ok := perms["admin"].(bool); ok && admin {
		return true
	}
	modVal, ok := perms[module]
	if !ok {
		return false
	}
	mod, ok := modVal.(map[string]interface{})
	if !ok {
		return false
	}
	pageVal, ok := mod[page]
	if !ok {
		return false
	}
	// page can be a list of actions or a { buttons: [] } object.
	switch p := pageVal.(type) {
	case []interface{}:
		for _, v := range p {
			if s, ok := v.(string); ok && s == action {
				return true
			}
		}
		return false
	case map[string]interface{}:
		buttonsVal, ok := p["buttons"]
		if !ok {
			return false
		}
		buttons, ok := buttonsVal.([]interface{})
		if !ok {
			return false
		}
		for _, v := range buttons {
			if s, ok := v.(string); ok && s == action {
				return true
			}
		}
		return false
	default:
		return false
	}
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

// HasSystemPermission reports whether the user is allowed to access portal
// system management routes. It mirrors the frontend menu permission model:
// - no permissions object, or no "menus" key, means no menu restriction
//   (backward compatible with the default school_admin role).
// - admin flag grants all permissions.
// - a granted menu path under /portal/apps/system allows system access.
func HasSystemPermission(claims *Claims) bool {
	if claims == nil {
		return false
	}
	if len(claims.Permissions) == 0 {
		return true
	}
	if admin, ok := claims.Permissions["admin"].(bool); ok && admin {
		return true
	}
	menusVal, hasMenus := claims.Permissions["menus"]
	if !hasMenus {
		return true
	}
	menus, ok := menusVal.(map[string]interface{})
	if !ok {
		return true
	}
	for path, granted := range menus {
		if val, ok := granted.(bool); ok && val && strings.HasPrefix(path, "/portal/apps/system") {
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
			if HasSystemPermission(claims) || HasRole(claims, "school_admin") || HasRole(claims, "platform_admin") {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		})
	}
}
