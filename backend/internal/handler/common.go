package handler

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// isStrongPassword requires at least 8 characters and at least one letter and one digit.
func isStrongPassword(password string) bool {
	if len(password) < 8 {
		return false
	}
	var hasLetter, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
		if hasLetter && hasDigit {
			return true
		}
	}
	return false
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// MaxPageSize limits the number of items per page to prevent unbounded queries.
const MaxPageSize = 200

func parseInt(s string, defaultVal int) (int, error) {
	if s == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal, err
	}
	return v, nil
}

func parsePageLimit(s string, defaultVal int) (int, error) {
	v, err := parseInt(s, defaultVal)
	if err != nil {
		return defaultVal, err
	}
	if v > MaxPageSize {
		v = MaxPageSize
	}
	if v < 1 {
		v = defaultVal
	}
	return v, nil
}

func executeCountQuery(ctx context.Context, db interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}, query string, args []interface{}) int {
	var total int
	if err := db.QueryRow(ctx, query, args...).Scan(&total); err != nil {
		slog.Error("count query failed", "error", err, "query", query)
		return 0
	}
	return total
}

func itoa(i int) string {
	return strconv.Itoa(i)
}

func parseFloat(s string, defaultVal float64) (float64, error) {
	if s == "" {
		return defaultVal, nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal, err
	}
	return v, nil
}

// platformAdminOnly returns true if the caller is a platform admin.
func platformAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, "platform_admin")
}

// schoolAdminOnly returns true if the caller is a school admin.
func schoolAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, "school_admin")
}

// canManagePortal returns true for portal system management.
// It prefers the permission-based system menu check so that custom roles
// granted system settings menus also work, while keeping school_admin and
// platform_admin as fallbacks for backward compatibility.
func canManagePortal(claims *middleware.Claims) bool {
	return middleware.HasSystemPermission(claims) || schoolAdminOnly(claims) || canManagePlatform(claims)
}

// canManagePlatform returns true for platform-level configuration/operation.
func canManagePlatform(claims *middleware.Claims) bool {
	return platformAdminOnly(claims)
}

// canModifyContent returns true for business-resource write operations.
func canModifyContent(claims *middleware.Claims) bool {
	if claims == nil {
		return false
	}
	for _, code := range []string{"teacher", "school_admin", "enterprise_mentor"} {
		if middleware.HasRole(claims, code) {
			return true
		}
	}
	return false
}

// canReadTenantScoped returns true if the caller has a tenant to scope reads to.
// 教育域数据一律租户内可见，不再为 platform_admin 提供跨租户特权
// （跨租户运营操作走 superadmin 控制台的独立路径）。
func canReadTenantScoped(claims *middleware.Claims) bool {
	if claims == nil {
		return false
	}
	return claims.TenantID != nil && *claims.TenantID != ""
}

// tenantFilter returns the tenant_id value to filter by. ok=false when the
// caller has no tenant and cannot access tenant-scoped data.
func tenantFilter(claims *middleware.Claims) (tenantID string, ok bool) {
	if claims == nil {
		return "", false
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		return "", false
	}
	return *claims.TenantID, true
}

// requireTenant resolves the caller's tenant for tenant-scoped writes.
// Writes a 403 response and returns ok=false when the caller has no tenant.
func requireTenant(w http.ResponseWriter, r *http.Request) (string, bool) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "missing tenant")
		return "", false
	}
	return *claims.TenantID, true
}

// institutionFilter returns the institution_id value to filter by, or an empty
// string when the caller is a platform admin. ok=false means the caller has no
// institution and cannot read institution-scoped lists.
func institutionFilter(claims *middleware.Claims) (institutionID string, ok bool) {
	if claims == nil {
		return "", false
	}
	if platformAdminOnly(claims) {
		return "", true
	}
	if claims.InstitutionID == nil || *claims.InstitutionID == "" {
		return "", false
	}
	return *claims.InstitutionID, true
}

func ptrEqual[T comparable](a, b *T) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// verifyTenantOwnership checks that the entity's tenantID matches the caller's tenant.
// Writes a 403 response and returns false when they don't match.
func verifyTenantOwnership(w http.ResponseWriter, r *http.Request, entityTenantID string) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "missing tenant")
		return false
	}
	if entityTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "access denied: entity does not belong to your tenant")
		return false
	}
	return true
}

// verifyRequestTenant validates that the tenantId from the request body matches the
// caller's tenant. Writes a 403 and returns false if they differ.
func verifyRequestTenant(w http.ResponseWriter, r *http.Request, requestTenantID string) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "missing tenant")
		return false
	}
	if requestTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "access denied: cannot create entity for another tenant")
		return false
	}
	return true
}

const entityCodeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// generateEntityCode returns a human-readable code like "GW-A3B7C9D1".
func generateEntityCode(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// Fall back to a deterministic but still formatted value on entropy failure.
		return fmt.Sprintf("%s-%08d", prefix, 0)
	}
	for i := range b {
		b[i] = entityCodeAlphabet[int(b[i])%len(entityCodeAlphabet)]
	}
	return fmt.Sprintf("%s-%s", prefix, string(b))
}

// generateUniqueEntityCode generates a code and ensures it does not already exist
// in the given tenant-scoped table. It retries a few times on collision.
func generateUniqueEntityCode(ctx context.Context, db interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}, prefix, table, tenantID string) (string, error) {
	for i := 0; i < 10; i++ {
		code := generateEntityCode(prefix)
		var exists bool
		err := db.QueryRow(ctx, fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id=$1 AND code=$2)", table), tenantID, code).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique %s code", prefix)
}
