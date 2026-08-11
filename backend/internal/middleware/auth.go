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

// AuthCookieName 登录成功后下发的 HttpOnly Cookie（仅 /uploads 路径发送），
// 供 <img> 等无法携带 Authorization 头的资源请求通过认证。
const AuthCookieName = "zhiyu_auth"

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
			ensureAuthCookie(w, r)

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
			ensureAuthCookie(w, r)
			ctx := context.WithValue(r.Context(), ContextKeyUser, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ensureAuthCookie 认证成功后按需补发文件通道 cookie：
// 修复「部署前登录的旧会话」——localStorage 有 token 但浏览器从未获得
// zhiyu_auth cookie，<img> 等无 Authorization 头的 /uploads 请求将 401。
// 仅在 token 来自 Authorization 头且 cookie 缺失/不一致时补发（幂等），
// 旧会话用户任意一次 API 调用即自动治愈，无需重新登录。
func ensureAuthCookie(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	if tokenStr == "" || tokenStr == auth {
		return
	}
	if c, err := r.Cookie(AuthCookieName); err == nil && c.Value == tokenStr {
		return
	}
	SetAuthCookie(w, tokenStr)
}

// tokenClaims 从 Authorization: Bearer 头（优先）或 AuthCookieName cookie
// 中解析 JWT，返回 claims。强制 UserID 非空：排除预授权令牌（同密钥 HS256
// 但无 userId）等签名正确但结构不全的令牌类型混淆。
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
		if c, err := r.Cookie(AuthCookieName); err == nil {
			tokenStr = c.Value
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

// SetAuthCookie 下发登录态 Cookie（HttpOnly + SameSite=Lax，仅 /uploads 路径）。
// 调用时机与 GenerateToken 一一对应，保证文件资源请求与 Bearer 通道同源同权。
func SetAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     AuthCookieName,
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
