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
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
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
		respondError(w, http.StatusForbidden, "缺少租户信息")
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
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return false
	}
	if entityTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "无权操作：资源不属于您的租户")
		return false
	}
	return true
}

// verifyRequestTenant validates that the tenantId from the request body matches the
// caller's tenant. Writes a 403 and returns false if they differ.
func verifyRequestTenant(w http.ResponseWriter, r *http.Request, requestTenantID string) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return false
	}
	if requestTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "无权操作：不能为其他租户创建资源")
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
	return "", fmt.Errorf("生成唯一%s编码失败", prefix)
}

// listQueryBuilder accumulates WHERE conditions and positional arguments for
// the generic list query helper. Use nextArg to reserve the next placeholder(s)
// and addCondition to append a condition using those placeholders.
type listQueryBuilder struct {
	where []string
	args  []any
	idx   int
}

func (qb *listQueryBuilder) nextArg(args ...any) string {
	out := make([]string, len(args))
	for i, a := range args {
		out[i] = "$" + itoa(qb.idx)
		qb.args = append(qb.args, a)
		qb.idx++
	}
	if len(out) == 1 {
		return out[0]
	}
	return strings.Join(out, ", ")
}

func (qb *listQueryBuilder) addCondition(cond string) {
	qb.where = append(qb.where, cond)
}

func (qb *listQueryBuilder) whereClause() string {
	if len(qb.where) == 0 {
		return "1=1"
	}
	return strings.Join(qb.where, " AND ")
}

// listQueryFilter adds extra WHERE conditions to a list query. Callers should
// use qb.nextArg to obtain the correct placeholder and addCondition to append.
type listQueryFilter func(r *http.Request, qb *listQueryBuilder)

// listQueryConfig configures executeListQuery for a specific entity type.
type listQueryConfig[T any] struct {
	Table         string
	SelectColumns string
	TenantScoped  bool
	TenantColumn  string
	SearchColumns []string
	SearchParam   string // query parameter name for search; defaults to "search"
	OrderBy       string
	NoPagination  bool // when true, no LIMIT/OFFSET is appended (full list)
	DefaultLimit  int  // fallback page size when limit param is missing; defaults to 50
	ExtraFilter   listQueryFilter
	ScanRows      func(pgx.Rows) ([]T, error)
}

type listQueryDB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// executeListQuery builds and runs a paginated, tenant-scoped list query with
// optional search and extra filters. It returns the scanned items, total count
// and an error. A "missing tenant" error means the caller has no tenant and
// should respond with 403.
func executeListQuery[T any](ctx context.Context, db listQueryDB, r *http.Request, cfg listQueryConfig[T], scanRows ...func(pgx.Rows) ([]T, error)) ([]T, int, error) {
	scanner := cfg.ScanRows
	if len(scanRows) > 0 {
		scanner = scanRows[0]
	}
	if scanner == nil {
		return nil, 0, errors.New("scanRows not configured")
	}

	qb := &listQueryBuilder{idx: 1}

	if cfg.TenantScoped {
		tenantID, ok := tenantFilter(middleware.CurrentUser(r))
		if !ok {
			return nil, 0, errors.New("missing tenant")
		}
		col := cfg.TenantColumn
		if col == "" {
			col = "tenant_id"
		}
		qb.addCondition(col + " = " + qb.nextArg(tenantID))
	}

	searchParam := cfg.SearchParam
	if searchParam == "" {
		searchParam = "search"
	}
	search := r.URL.Query().Get(searchParam)
	if search != "" && len(cfg.SearchColumns) > 0 {
		ph := qb.nextArg("%" + search + "%")
		conds := make([]string, len(cfg.SearchColumns))
		for i, col := range cfg.SearchColumns {
			conds[i] = col + " ILIKE " + ph
		}
		qb.addCondition("(" + strings.Join(conds, " OR ") + ")")
	}

	if cfg.ExtraFilter != nil {
		cfg.ExtraFilter(r, qb)
	}

	where := qb.whereClause()
	countQuery := "SELECT COUNT(*) FROM " + cfg.Table + " WHERE " + where
	var total int
	if err := db.QueryRow(ctx, countQuery, qb.args...).Scan(&total); err != nil {
		slog.Error("count query failed", "error", err, "query", countQuery)
		total = 0
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	defaultLimit := cfg.DefaultLimit
	if defaultLimit <= 0 {
		defaultLimit = 50
	}
	limit := defaultLimit
	offset := 0
	if v, err := parsePageLimit(limitStr, defaultLimit); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	orderBy := cfg.OrderBy
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	query := "SELECT " + cfg.SelectColumns + " FROM " + cfg.Table + " WHERE " + where + " ORDER BY " + orderBy
	if !cfg.NoPagination {
		limPh := qb.nextArg(limit)
		offPh := qb.nextArg(offset)
		query += " LIMIT " + limPh + " OFFSET " + offPh
	}

	rows, err := db.Query(ctx, query, qb.args...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	items, err := scanner(rows)
	if err != nil {
		return nil, total, err
	}
	return items, total, nil
}

// recordView inserts a view log entry for the given target.
func recordView(ctx context.Context, db *pgxpool.Pool, targetType, targetID string, claims *middleware.Claims) error {
	var userID, tenantID any
	if claims != nil {
		userID = claims.UserID
		if claims.TenantID != nil {
			tenantID = *claims.TenantID
		}
	}
	_, err := db.Exec(ctx, `
		INSERT INTO view_logs (target_type, target_id, user_id, tenant_id)
		VALUES ($1, $2, $3, $4)
	`, targetType, targetID, userID, tenantID)
	return err
}
