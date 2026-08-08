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
			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(auth, "Bearer ")
			if tokenStr == auth {
				http.Error(w, `{"error":"invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			}, jwt.WithValidMethods([]string{"HS256"}))
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*Claims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}
			// 强制 UserID 非空：排除预授权令牌（同密钥 HS256 但无 userId）等
			// 签名正确但结构不全的令牌类型混淆，避免空 UserID 请求穿透到业务查询
			if claims.UserID == "" {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUser, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func CurrentUser(r *http.Request) *Claims {
	u, _ := r.Context().Value(ContextKeyUser).(*Claims)
	return u
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
