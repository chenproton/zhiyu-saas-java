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

const ContextKeyUser contextKey = "user"

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
	Permissions   domain.JSONMap      `json:"permissions,omitempty"`
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

// OptionalJWT 解析 Authorization 头或 AuthCookieName cookie 中的令牌；
// 令牌缺失/无效时不拦截请求（无 claims 继续放行），由业务侧决定如何响应。
// 用于 /uploads 这类既需签名 URL（公开）又需登录鉴权（cookie/header）的混合场景。
func OptionalJWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := tokenClaims(r, secret)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			ensureAuthCookie(w, r, claims)
			ctx := context.WithValue(r.Context(), ContextKeyUser, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
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
// （平台独立 cookie + 旧 cookie 兼容）中解析 JWT，返回 claims。
// 强制 UserID 非空：排除预授权令牌（同密钥 HS256 但无 userId）等
// 签名正确但结构不全的令牌类型混淆。
func tokenClaims(r *http.Request, secret string) (*Claims, bool) {
	tokenStr := ""
	auth := r.Header.Get("Authorization")
	if auth != "" {
		tokenStr = strings.TrimPrefix(auth, "Bearer ")
		if tokenStr == auth {
			return nil, false
		}
	}
	if tokenStr == "" {
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
		Permissions:   input.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
