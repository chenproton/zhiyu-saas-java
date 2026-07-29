package cache

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/redis/go-redis/v9"

	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

const (
	KeyPlatformLinks = "zhiyu:public:platform-links"
	KeyAppModules    = "zhiyu:public:app-modules"

	fmtDashboard = "zhiyu:%s:dashboard:%s"

	fmtDictIndustries    = "zhiyu:%s:dict:industries"
	fmtDictMajors        = "zhiyu:%s:dict:majors"
	fmtDictOrgTypes      = "zhiyu:%s:dict:org-types"
	fmtDictRoles         = "zhiyu:%s:dict:roles"
	fmtDictStaffTitles   = "zhiyu:%s:dict:staff-titles"
	fmtDictResourceCodes = "zhiyu:%s:dict:resource-codes"

	fmtTemplate = "zhiyu:%s:template:%s"
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

func TenantKey(format string) KeyFunc {
	return func(r *http.Request) string {
		return fmt.Sprintf(format, tenantFromRequest(r))
	}
}

func DashboardKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		claims := authmw.CurrentUser(r)
		role := "default"
		if claims != nil {
			role = string(claims.Role)
		}
		return fmt.Sprintf(fmtDashboard, tenant, role)
	}
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

func TemplateKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		name := strings.TrimPrefix(r.URL.Path, "/api/v1/templates/")
		return fmt.Sprintf(fmtTemplate, tenant, name)
	}
}

func InvalidateByPrefix(ctx context.Context, client *redis.Client, prefix string) {
	iter := client.Scan(ctx, 0, prefix, 100).Iterator()
	for iter.Next(ctx) {
		client.Del(ctx, iter.Val())
	}
}

func InvalidateDict(ctx context.Context, client *redis.Client, tenantID string) {
	client.Del(ctx,
		fmt.Sprintf(fmtDictIndustries, tenantID),
		fmt.Sprintf(fmtDictMajors, tenantID),
		fmt.Sprintf(fmtDictOrgTypes, tenantID),
		fmt.Sprintf(fmtDictRoles, tenantID),
		fmt.Sprintf(fmtDictStaffTitles, tenantID),
		fmt.Sprintf(fmtDictResourceCodes, tenantID))
}

func DropdownKey() KeyFunc {
	return func(r *http.Request) string {
		tenant := tenantFromRequest(r)
		entity := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/"), "/")[0]
		return fmt.Sprintf("zhiyu:%s:dict:%s", tenant, entity)
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
