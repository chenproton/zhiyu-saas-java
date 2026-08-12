package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type contextKey string

const (
	ContextKeyUser contextKey = "user"
	// ContextKeyUserCandidates 携带全部可解析的 claims（OptionalJWT 多 cookie 场景），
	// Serve 端按 URL 租户在候选中匹配取用（双端登录时 portal/partner cookie 共存）。
	ContextKeyUserCandidates contextKey = "user_candidates"
)

// AuthCookieNameLegacy 早期版本的统一 cookie 名（兼容读取：升级前已下发的
// cookie 无平台区分，升级后按 claims.Platform 写入平台独立 cookie 并自然替换）。
const AuthCookieNameLegacy = "zhiyu_auth"

// authCookieNames 平台独立 cookie 名：portal/partner 共用同一域名时，
// 单一 cookie 会被后登录的平台覆盖，导致另一端 <img> 资源请求 403；
// 按平台各写各的，浏览器同时携带，Serve 端按租户匹配取用。
var authCookieNames = map[domain.UserPlatform]string{
	domain.UserPlatformPortal:  "zhiyu_auth_portal",
	domain.UserPlatformPartner: "zhiyu_auth_partner",
	domain.UserPlatformSaas:    "zhiyu_auth_saas",
}

// authCookieName 返回平台对应的 cookie 名，未知平台回落旧 cookie 名。
func authCookieName(platform domain.UserPlatform) string {
	if n, ok := authCookieNames[platform]; ok {
		return n
	}
	return AuthCookieNameLegacy
}

// authCookieCandidates 读取 cookie 时尝试的顺序：平台独立 cookie → 旧 cookie。
func authCookieCandidates(r *http.Request) []string {
	names := []string{
		authCookieNames[domain.UserPlatformPortal],
		authCookieNames[domain.UserPlatformPartner],
		authCookieNames[domain.UserPlatformSaas],
		AuthCookieNameLegacy,
	}
	seen := map[string]bool{}
	var out []string
	for _, n := range names {
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		if c, err := r.Cookie(n); err == nil && c.Value != "" {
			out = append(out, c.Value)
		}
	}
	return out
}

type Claims struct {
	UserID        string              `json:"userId"`
	TenantID      *string             `json:"tenantId,omitempty"`
	InstitutionID *string             `json:"institutionId,omitempty"`
	RoleCodes     []string            `json:"roleCodes,omitempty"`
	OrgNodeID     *string             `json:"orgNodeId,omitempty"`
	Role          domain.UserRole     `json:"role"`
	Platform      domain.UserPlatform `json:"platform"`
	Username      string              `json:"username"`
	// 权限精简载荷（JWT 瘦身）：仅保留服务端鉴权实际消费的字段，
	// 避免完整权限 map（含全部菜单路径与操作码）写入 token 导致
	// Set-Cookie 超过浏览器 4096 字节上限、响应头超 nginx 缓冲区。
	Admin       bool     `json:"admin,omitempty"`
	HasMenu     bool     `json:"hasMenu,omitempty"`
	SystemMenus []string `json:"systemMenus,omitempty"`
	// Permissions 仅用于兼容旧令牌（签发后 7 天内）的鉴权回退，
	// 新令牌不再写入完整权限 map。
	Permissions domain.JSONMap `json:"permissions,omitempty"`
	jwt.RegisteredClaims
}

func JWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := tokenClaims(r, secret)
			if !ok {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}
			ensureAuthCookie(w, r, claims)

			ctx := context.WithValue(r.Context(), ContextKeyUser, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalJWT 解析 Authorization 头或文件通道 cookie 中的令牌；
// 令牌缺失/无效时不拦截请求（无 claims 继续放行），由业务侧决定如何响应。
// 用于 /uploads 这类既需签名 URL（公开）又需登录鉴权（cookie/header）的混合场景。
// 双端登录（portal+partner cookie 共存）时，全部候选 claims 一并放入
// ContextKeyUserCandidates，供 Serve 按 URL 租户匹配取用。
func OptionalJWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claimsList := tokenClaimsAll(r, secret)
			if len(claimsList) == 0 {
				next.ServeHTTP(w, r)
				return
			}
			ensureAuthCookie(w, r, claimsList[0])
			ctx := context.WithValue(r.Context(), ContextKeyUser, claimsList[0])
			ctx = context.WithValue(ctx, ContextKeyUserCandidates, claimsList)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserCandidates 返回本次请求全部可解析的 claims（多 cookie 场景按序），
// 首个为默认（header 优先），其余为其它平台/会话的候选。
func UserCandidates(r *http.Request) []*Claims {
	v, _ := r.Context().Value(ContextKeyUserCandidates).([]*Claims)
	return v
}

// ensureAuthCookie 认证成功后按需补发文件通道 cookie：
// 修复「部署前登录的旧会话」——localStorage 有 token 但浏览器从未获得
// 文件 cookie，<img> 等无 Authorization 头的 /uploads 请求将 401。
// 按 claims.Platform 写入平台独立 cookie（portal/partner 互不覆盖）；
// 仅在 token 来自 Authorization 头且对应 cookie 缺失/不一致时补发（幂等），
// 旧会话用户任意一次 API 调用即自动治愈，无需重新登录。
func ensureAuthCookie(w http.ResponseWriter, r *http.Request, claims *Claims) {
	auth := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	if tokenStr == "" || tokenStr == auth {
		return
	}
	name := authCookieName(claims.Platform)
	if c, err := r.Cookie(name); err == nil && c.Value == tokenStr {
		return
	}
	SetAuthCookie(w, claims.Platform, tokenStr)
}

// tokenClaims 从 Authorization: Bearer 头（优先）或文件通道 cookie
// （平台独立 cookie + 旧 cookie 兼容）中解析 JWT，返回首个有效 claims。
// 强制 UserID 非空：排除预授权令牌（同密钥 HS256 但无 userId）等
// 签名正确但结构不全的令牌类型混淆。
func tokenClaims(r *http.Request, secret string) (*Claims, bool) {
	auth := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	if tokenStr == "" || tokenStr == auth {
		for _, v := range authCookieCandidates(r) {
			tokenStr = v
			if tokenStr != "" {
				break
			}
		}
	}
	if tokenStr == "" {
		return nil, false
	}
	return parseToken(tokenStr, secret)
}

// tokenClaimsAll 解析 header（优先）+ 全部 cookie 候选，返回所有有效 claims。
func tokenClaimsAll(r *http.Request, secret string) []*Claims {
	var out []*Claims
	if auth := r.Header.Get("Authorization"); auth != "" {
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		if tokenStr != auth {
			if c, ok := parseToken(tokenStr, secret); ok {
				out = append(out, c)
			}
		}
	}
	for _, v := range authCookieCandidates(r) {
		if c, ok := parseToken(v, secret); ok {
			out = append(out, c)
		}
	}
	return out
}

func parseToken(tokenStr, secret string) (*Claims, bool) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return nil, false
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || claims.UserID == "" {
		return nil, false
	}
	return claims, true
}

// SetAuthCookie 下发平台独立的登录态 Cookie（HttpOnly + SameSite=Lax，仅 /uploads 路径）。
// 调用时机与 GenerateToken 一一对应，保证文件资源请求与 Bearer 通道同源同权；
// portal/partner 各自独立，同一浏览器双端登录互不覆盖。
func SetAuthCookie(w http.ResponseWriter, platform domain.UserPlatform, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName(platform),
		Value:    token,
		Path:     "/uploads",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})
}

func CurrentUser(r *http.Request) *Claims {
	u, _ := r.Context().Value(ContextKeyUser).(*Claims)
	return u
}

// WithUser 将 claims 写入 context，与 OptionalJWT/JWT 使用同一 ContextKey。
func WithUser(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, ContextKeyUser, claims)
}

type TokenInput struct {
	User        *domain.User
	RoleCodes   []string
	Permissions domain.JSONMap
}

func GenerateToken(secret string, input TokenInput) (string, error) {
	user := input.User
	claims := Claims{
		UserID:        user.ID,
		TenantID:      user.TenantID,
		InstitutionID: user.InstitutionID,
		RoleCodes:     input.RoleCodes,
		OrgNodeID:     user.OrgNodeID,
		Role:          user.Role,
		Platform:      user.Platform,
		Username:      user.Username,
		Admin:         hasAdminFlag(input.Permissions),
		HasMenu:       hasAnyGrantedMenu(input.Permissions),
		SystemMenus:   grantedSystemMenus(input.Permissions),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// hasAdminFlag 判断权限 map 是否含 admin: true（超管全权限标记）。
func hasAdminFlag(perms domain.JSONMap) bool {
	v, ok := perms["admin"].(bool)
	return ok && v
}

// hasAnyGrantedMenu 判断权限 map 中是否有任意勾选的菜单路径。
func hasAnyGrantedMenu(perms domain.JSONMap) bool {
	for _, granted := range menusOf(perms) {
		if v, ok := granted.(bool); ok && v {
			return true
		}
	}
	return false
}

// grantedSystemMenus 收集权限 map 中勾选的系统管理（/portal/apps/system）菜单路径。
func grantedSystemMenus(perms domain.JSONMap) []string {
	var out []string
	for path, granted := range menusOf(perms) {
		if v, ok := granted.(bool); ok && v && strings.HasPrefix(path, systemMenuPrefix) {
			out = append(out, path)
		}
	}
	return out
}

// menusOf 提取权限 map 中的 menus 子 map，结构不符时返回空。
func menusOf(perms domain.JSONMap) map[string]interface{} {
	m, _ := perms["menus"].(map[string]interface{})
	return m
}
