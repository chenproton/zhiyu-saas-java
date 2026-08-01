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

func StaticKey(key string) KeyFunc {
	return func(r *http.Request) string { return key }
}

func PublicPositionsKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		key := "zhiyu:" + tenant + ":public:positions"
		v := r.URL.Query()
		for _, p := range []string{"page", "pageSize", "search", "industryId", "majorId"} {
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
		key := "zhiyu:" + tenant + ":landing:exams"
		v := r.URL.Query()
		for _, p := range []string{"search", "batchId", "page", "pageSize"} {
			if val := v.Get(p); val != "" {
				key += ":" + p + ":" + val
			}
		}
		return key
	}
}
