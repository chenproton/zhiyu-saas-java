package cache

import (
	"net/http"
	"strings"

	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

const (
	KeyPlatformLinks = "zhiyu:public:platform-links"
	KeyAppModules    = "zhiyu:public:app-modules"
)

func tenantFromRequest(r *http.Request) string {
	claims := authmw.CurrentUser(r)
	if claims != nil && claims.TenantID != nil {
		return *claims.TenantID
	}
	return "global"
}

func StaticKey(key string) KeyFunc {
	return func(r *http.Request) string { return key }
}

func PublicPositionsKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		parts := []string{tenant}
		v := r.URL.Query()
		for _, p := range []string{"page", "pageSize", "search", "industryId", "majorId"} {
			if val := v.Get(p); val != "" {
				parts = append(parts, p+":"+val)
			}
		}
		return "zhiyu:" + strings.Join(parts, ":public:positions")
	}
}

func LandingExamsKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		parts := []string{tenant}
		v := r.URL.Query()
		for _, p := range []string{"search", "batchId", "page", "pageSize"} {
			if val := v.Get(p); val != "" {
				parts = append(parts, p+":"+val)
			}
		}
		return "zhiyu:" + strings.Join(parts, ":landing:exams")
	}
}
