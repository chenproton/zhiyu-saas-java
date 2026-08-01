package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// sanitizeIdentifier validates that identifier is one of the allowed values.
// It returns the identifier unchanged if valid, otherwise an error.
func sanitizeIdentifier(identifier string, allowed []string) (string, error) {
	for _, a := range allowed {
		if identifier == a {
			return identifier, nil
		}
	}
	return "", fmt.Errorf("invalid identifier: %s", identifier)
}

// emptyStrToNil 将空字符串转为 nil，避免将空字符串写入 UUID 列导致 database error。
func emptyStrToNil(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

// strPtrIfNonEmpty 将非空字符串转为 *string，空字符串返回 nil。
func strPtrIfNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// coalesceStringSlice 将 nil 切片转为空切片，避免 SQL 参数中写入 NULL。
func coalesceStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// generateSecurePassword 生成指定长度的随机十六进制密码。
func generateSecurePassword(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

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

// decodeBody 解析 JSON 请求体，失败时写 400 响应并返回 false。
func decodeBody(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return false
	}
	return true
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

func itoa(i int) string {
	return strconv.Itoa(i)
}

// withTx 创建事务、执行 fn，根据 fn 返回值决定 commit 或 rollback。
// fn 返回 error 时自动 rollback，否则 commit。
func withTx(ctx context.Context, db *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// lookupIDByNameTables 是 lookupIDByName 允许查询的表名白名单。
var lookupIDByNameTables = []string{
	"ability_points", "ability_domains", "alliance_agreements", "alliance_enterprises",
	"alliance_experts", "alliance_projects", "batches", "career_positions", "certificate_library",
	"courses", "evaluation_batches", "exams", "industries", "institutions",
	"knowledge_points", "lesson_batches", "majors", "organizations", "question_banks", "questions",
	"resource_library", "roles", "scene_batches", "scenarios", "staff_titles", "subscription_packages", "terms", "users",
}

// lookupIDByName 按表名+租户+名称查询记录 ID，不存在时返回空字符串。
func lookupIDByName(ctx context.Context, db *pgxpool.Pool, tableName, tenantID, name string) (string, error) {
	table, err := sanitizeIdentifier(tableName, lookupIDByNameTables)
	if err != nil {
		return "", fmt.Errorf("不支持的表名: %s", tableName)
	}
	var id string
	err = db.QueryRow(ctx,
		fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND name=$2 LIMIT 1", table),
		tenantID, name,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		slog.Error("lookupIDByName查询失败", "table", tableName, "error", err)
		return "", err
	}
	return id, nil
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

// canManageUsers reports whether the caller may manage portal users
// (staff titles, extension fields, user CRUD).
func canManageUsers(r *http.Request) bool {
	return canManagePortal(middleware.CurrentUser(r))
}

// requireOperator reports whether the request is from a platform operator.
func requireOperator(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	return claims != nil && canManagePlatform(claims)
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
	if _, err := sanitizeIdentifier(table, allowedUniqueCodeTables); err != nil {
		return "", err
	}
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

// allowedUniqueCodeTables lists the tables that may be passed to generateUniqueEntityCode.
var allowedUniqueCodeTables = []string{
	"career_positions",
	"courses",
	"exams",
	"question_banks",
	"questions",
	"scenarios",
	"training_programs",
}

// executeListQuery adapts store.ExecuteListQuery to the legacy handler signature:
// it extracts explicit list parameters (search/limit/offset/tenant) from the
// request and forwards all query values via ListParams.Values so that
// ExtraFilter callbacks can read filter parameters without touching HTTP.
// The actual SQL assembly lives in store/query.go.
// listParamsFromRequest 从请求提取显式列表参数（search/limit/offset/tenant/query 值）。
// tenantScoped 为 true 且缺少租户时返回 ok=false（调用方应响应 403）。
func listParamsFromRequest(r *http.Request, tenantScoped bool) (store.ListParams, bool) {
	p := store.ListParams{
		Search: r.URL.Query().Get("search"),
		Values: map[string]string{},
	}
	for k, vs := range r.URL.Query() {
		if len(vs) > 0 {
			p.Values[k] = vs[0]
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := parseInt(v, 0); err == nil && n > 0 {
			p.Limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := parseInt(v, 0); err == nil && n >= 0 {
			p.Offset = n
		}
	}
	if tenantScoped {
		if tenantID, ok := tenantFilter(middleware.CurrentUser(r)); ok {
			p.TenantID = tenantID
		} else {
			return p, false
		}
	}
	return p, true
}

// executeListQuery 适配 store.ExecuteListQuery 到旧式调用点：内部经
// listParamsFromRequest 提取显式参数。SQL 装配位于 store/query.go。
func executeListQuery[T any](ctx context.Context, db store.ListQueryDB, r *http.Request, cfg store.ListQueryConfig[T], scanRows ...func(pgx.Rows) ([]T, error)) ([]T, int, error) {
	p, ok := listParamsFromRequest(r, cfg.TenantScoped)
	if !ok {
		return nil, 0, store.ErrMissingTenant
	}
	return store.ExecuteListQuery(ctx, db, p, cfg, scanRows...)
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
	if err != nil {
		return err
	}
	_, _ = db.Exec(ctx, `
		INSERT INTO view_counters (target_type, target_id, cnt)
		VALUES ($1, $2, 1)
		ON CONFLICT (target_type, target_id) DO UPDATE SET cnt = view_counters.cnt + 1, updated_at = now()
	`, targetType, targetID)
	return nil
}
