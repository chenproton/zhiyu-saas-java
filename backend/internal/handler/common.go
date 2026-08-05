package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// emptyStrToNil 将空字符串转为 nil，避免将空字符串写入 UUID 列导致 database error。
// 实现委托 store.StrPtrIfNonEmpty（唯一实现）。
func emptyStrToNil(s *string) *string {
	if s == nil {
		return nil
	}
	return store.StrPtrIfNonEmpty(*s)
}

// coalesceStringSlice 将 nil 切片转为空切片，避免 SQL 参数中写入 NULL。
func coalesceStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
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

// validatePassword 校验明文密码是否满足强度要求。
func validatePassword(password string) error {
	if password == "" {
		return errors.New("密码不能为空")
	}
	if !isStrongPassword(password) {
		return errors.New("密码长度至少 8 位，且需同时包含字母和数字")
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// isForeignKeyViolation 判断是否为外键约束冲突（用于区分"被引用不可删"与内部错误）。
func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// ListResponse 通用列表响应（{items, total}），替代各 handler 重复的 XxxListResponse。
type ListResponse[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// respondServerError 统一返回 500 并记录原始错误，便于线上排查。
func respondServerError(w http.ResponseWriter, r *http.Request, err error, message string) {
	errDetail := "<nil>"
	if err != nil {
		errDetail = err.Error()
	}
	slog.Error("handler server error",
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
		slog.String("message", message),
		slog.String("error", errDetail),
	)
	respondError(w, http.StatusInternalServerError, message)
}

// maxJSONBodySize limits JSON request bodies to 10MB to prevent unbounded reads.
const maxJSONBodySize = 10 << 20 // 10MB

// decodeBody 解析 JSON 请求体，失败时写 400 响应并返回 false。
func decodeBody(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodySize)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return false
	}
	return true
}

// MaxPageSize limits the number of items per page to prevent unbounded queries.
const MaxPageSize = 200

// parseInt 委托 store.ParseInt（唯一实现）。
func parseInt(s string, defaultVal int) (int, error) {
	return store.ParseInt(s, defaultVal)
}

// parsePageLimit 委托 store.ParsePageLimit（唯一实现）。
func parsePageLimit(s string, defaultVal int) (int, error) {
	return store.ParsePageLimit(s, defaultVal)
}

// itoa 委托 store.Itoa（唯一实现）。
func itoa(i int) string {
	return store.Itoa(i)
}

// platformAdminOnly returns true if the caller is a platform admin.
func platformAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, domain.RolePlatformAdmin)
}

// schoolAdminOnly returns true if the caller is a school admin.
func schoolAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, domain.RoleSchoolAdmin)
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

// canManageAlliance reports whether the caller may manage the alliance
// (产教融合) module. 产教融合平台面向业务角色开放（教师/学校管理员/企业导师/平台
// 管理员），与教师菜单中可见的 alliance 页面保持一致；有系统设置菜单权限的角色亦放行。
func canManageAlliance(claims *middleware.Claims) bool {
	if claims == nil {
		return false
	}
	for _, code := range []string{
		domain.RoleTeacher, domain.RoleSchoolAdmin, domain.RoleEnterpriseMentor, domain.RolePlatformAdmin,
	} {
		if middleware.HasRole(claims, code) {
			return true
		}
	}
	return middleware.HasSystemPermission(claims)
}

// canReadTenantScoped returns true if the caller has a tenant to scope reads to.
// 教育域数据一律租户内可见，不再为 platform_admin 提供跨租户特权
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

// generateEntityCode returns a human-readable code like "GW-A3B7C9D1".
func generateEntityCode(prefix string) string {
	return store.GenerateEntityCode(prefix)
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

// jsonMapBytes 将 JSONMap 序列化为 []byte（nil 返回 "{}"）。
func jsonMapBytes(m domain.JSONMap) []byte {
	if m == nil {
		return []byte("{}")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return b
}

func jsonSliceToUUIDSlice(ids domain.JSONSlice) []string {
	out := make([]string, 0, len(ids))
	for _, v := range ids {
		s, ok := v.(string)
		if !ok || s == "" || strings.HasPrefix(s, "kp-custom-") {
			continue
		}
		out = append(out, s)
	}
	return out
}

// jsonRawMessageToJSONMap 将 json.RawMessage 解析为 JSONMap。
func jsonRawMessageToJSONMap(raw json.RawMessage) domain.JSONMap {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.JSONMap{}
	}
	var m domain.JSONMap
	_ = json.Unmarshal(raw, &m)
	if m == nil {
		return domain.JSONMap{}
	}
	return m
}

// goAsync 启动安全后台 goroutine：panic 记录日志不崩进程；wg 非空时自动 Done。
func goAsync(wg *sync.WaitGroup, fn func()) {
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("background goroutine panic", "panic", rec)
			}
		}()
		if wg != nil {
			defer wg.Done()
		}
		fn()
	}()
}

// recordViewAsync 异步记录视图计数，不阻塞详情读取；失败仅记日志。
func recordViewAsync(increment func(ctx context.Context, targetID string, userID, tenantID any) error, targetID string, userID, tenantID any) {
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("record view panic", "targetID", targetID, "panic", rec)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := increment(ctx, targetID, userID, tenantID); err != nil {
			slog.Error("record view failed", "targetID", targetID, "error", err)
		}
	}()
}
