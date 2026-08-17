package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"
	"unicode"

	chimw "github.com/go-chi/chi/v5/middleware"
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
	return store.IsUniqueViolation(err)
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

// errorResponse 统一错误响应体：code 供前端按错误类型分支，
// error 保留人类可读消息（历史兼容）。
type errorResponse struct {
	Code    string `json:"code"`
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, errorResponse{
		Code:  codeFor(status),
		Error: message,
	})
}

// respondServerError 统一返回 500 并记录原始错误（含 request_id，与
// X-Request-ID 响应头对应，便于按请求号检索日志链路）。
// 客户端已取消（context canceled，如页面跳转/关闭导致的在途请求中断）时静默退出：
// 请求方已放弃，返回 500 无意义且污染日志（巡检点击跳转会大量触发）。
func respondServerError(w http.ResponseWriter, r *http.Request, err error, message string) {
	if errors.Is(err, context.Canceled) {
		return
	}
	errDetail := "<nil>"
	if err != nil {
		errDetail = err.Error()
	}
	reqID := chimw.GetReqID(r.Context())
	logAttrs := []any{
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
		slog.String("message", message),
		slog.String("error", errDetail),
	}
	if reqID != "" {
		logAttrs = append(logAttrs, slog.String("request_id", reqID))
	}
	slog.Error("handler server error", logAttrs...)
	respondError(w, http.StatusInternalServerError, message)
}

// maxJSONBodySize limits JSON request bodies to 10MB to prevent unbounded reads.
const maxJSONBodySize = 10 << 20 // 10MB

// decodeBody 解析 JSON 请求体，失败时写 400 响应并返回 false。
// 空请求体（io.EOF）视为成功：目标 struct 保持零值，必填字段由后续校验拦截
// （如 POST /alliance/enterprises/:id/link 等无请求体接口）。
func decodeBody(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodySize)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			return true
		}
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

// parseLimitOffset 解析 limit/offset 查询参数并钳制到合法范围。
// 非法/越界参数回落到默认值（与全站 list 接口的容忍语义一致）。
func parseLimitOffset(r *http.Request, defaultLimit int) (limit, offset int) {
	limit = defaultLimit
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), defaultLimit); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	return limit, offset
}

// parseDateRange 解析 startDate/endDate（YYYY-MM-DD）查询参数为时间范围。
// 两个参数均可省略；endDate 按"含当天"处理（内部转换为次日零点开区间）。
// 放在 handler 层是因为它只做 HTTP 查询参数的解析校验，无 SQL 语义。
// 返回 ok=false 时已写入 400 错误响应。
func parseDateRange(w http.ResponseWriter, r *http.Request) (from, to *time.Time, ok bool) {
	parse := func(v string) (time.Time, bool) {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			respondError(w, http.StatusBadRequest, "日期格式应为 YYYY-MM-DD")
			return t, false
		}
		return t, true
	}
	if v := r.URL.Query().Get("startDate"); v != "" {
		t, ok := parse(v)
		if !ok {
			return nil, nil, false
		}
		from = &t
	}
	if v := r.URL.Query().Get("endDate"); v != "" {
		t, ok := parse(v)
		if !ok {
			return nil, nil, false
		}
		t = t.AddDate(0, 0, 1)
		to = &t
	}
	return from, to, true
}

// safeHandler 以 panic-recover 兜底执行 handler 主体，避免 panic 直接击穿 HTTP 栈。
// label 用于日志定位（如 "[CloneCourse]"）。
func safeHandler(w http.ResponseWriter, r *http.Request, label string, fn func()) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error(label+" panic recovered", "panic", rec, "stack", string(debug.Stack()))
			respondServerError(w, r, fmt.Errorf("panic: %v", rec), "服务器内部错误")
		}
	}()
	fn()
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
// 保留角色判断：school_admin 是「无 menus=全量」与关键写白名单（密码/租户状态/
// 有效期/审批终审）的兜底主体（ADR-0008 决策 5）。
func schoolAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, domain.RoleSchoolAdmin)
}

// canManagePortal returns true for portal system management.
// 菜单驱动（ADR-0008）：自定义角色配置任一 /portal/apps/system 菜单即可管理；
// school_admin/platform_admin 角色与系统菜单授权（HasSystemPermission）兜底。
func canManagePortal(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		return false
	}
	if middleware.HasSystemPermission(claims) || schoolAdminOnly(claims) || platformAdminOnly(claims) {
		return true
	}
	if g := menuGrantFor(r); g != nil {
		return g.CoversPrefix("/portal/apps/system")
	}
	return false
}

// canManagePlatform returns true for platform-level configuration/operation.
func canManagePlatform(claims *middleware.Claims) bool {
	return platformAdminOnly(claims)
}

// canManageUsers reports whether the caller may manage portal users
// (staff titles, extension fields, user CRUD).
func canManageUsers(r *http.Request) bool {
	return canManagePortal(r)
}

// forcePublishedForStudent 学生角色强制 status=published（防枚举未发布资源：
// 场景/试卷等仅展示已发布内容）。非学生角色不改动参数，返回 false。
func forcePublishedForStudent(r *http.Request, params *store.ListParams) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || !middleware.HasRole(claims, domain.RoleStudent) {
		return false
	}
	if params.Values == nil {
		params.Values = map[string]string{}
	}
	params.Values["status"] = string(domain.StatusPublished)
	return true
}

// canManageAlliance reports whether the caller may manage the alliance
// (产教融合) module. 菜单驱动（ADR-0008）：配置任一联盟菜单（管理面或前台
// /portal/apps/alliance、/portal/alliance）即视为联盟管理权限；B13 企业导师
// 默认不勾联盟菜单即无权限（配置可覆盖）；系统菜单授权兜底。
func canManageAlliance(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		return false
	}
	if middleware.HasSystemPermission(claims) {
		return true
	}
	if g := menuGrantFor(r); g != nil {
		return g.CoversPrefix("/portal/apps/alliance") || g.CoversPrefix("/portal/alliance")
	}
	return false
}

// menuGrantFor 解析请求的菜单授权视图：优先 MenuContext 装载的 grant；
// 无 grant 时回退旧令牌/测试直调场景的完整权限 map（claims.Permissions），
// 与 middleware.loadMenuGrant 的旧令牌回退一致。
func menuGrantFor(r *http.Request) *domain.MenuGrant {
	if g := middleware.CurrentMenuGrant(r); g != nil {
		return g
	}
	claims := middleware.CurrentUser(r)
	if claims == nil || len(claims.Permissions) == 0 {
		return nil
	}
	g := &domain.MenuGrant{GrantedPaths: map[string]bool{}}
	g.Merge(claims.Permissions)
	return g
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

// tenantIDOf 取 claims 中的租户 ID；未登录或无租户时返回空串
// （store 层租户强制的调用方在多数场景下已通过 requireTenant/verifyTenantOwnership 校验）。
func tenantIDOf(claims *middleware.Claims) string {
	if claims == nil || claims.TenantID == nil {
		return ""
	}
	return *claims.TenantID
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
	return store.MarshalJSONBytes(m, "{}")
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

// —— 指针小工具（统一收敛：原 job_banner/lesson_behavior/resource_import 各自定义）——

// derefInt 指针解引用，nil 回退默认值。
func derefInt(p *int, fallback int) int {
	if p == nil {
		return fallback
	}
	return *p
}

// derefBool 指针解引用，nil 回退默认值。
func derefBool(p *bool, fallback bool) bool {
	if p == nil {
		return fallback
	}
	return *p
}

// coalesceStringSlicePtr 把可选字符串切片指针归一为切片（nil → 空切片）。
func coalesceStringSlicePtr(s *[]string) []string {
	if s == nil {
		return []string{}
	}
	return *s
}

// countPtr 指针非 nil 计 1，nil 计 0（计数语义）。
func countPtr(v *int) int {
	if v == nil {
		return 0
	}
	return 1
}

// boolPtr 构造 bool 指针。
func boolPtr(b bool) *bool { return &b }
