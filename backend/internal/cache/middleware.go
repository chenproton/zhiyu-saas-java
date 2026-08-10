package cache

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type KeyFunc func(r *http.Request) string

// InvalidatePrefix 删除匹配前缀的全部缓存键（SCAN 游标循环，避免超过单批数量时残留陈旧缓存）。
func InvalidatePrefix(ctx context.Context, client *redis.Client, prefix string) {
	if client == nil {
		return
	}
	iter := client.Scan(ctx, 0, prefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		_ = client.Del(ctx, iter.Val()).Err()
	}
}

func Cached(client *redis.Client, ttl time.Duration, keyFunc KeyFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}
			if client == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := keyFunc(r)
			cached, err := client.Get(r.Context(), key).Bytes()
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache", "HIT")
				w.Write(cached)
				return
			}

			crw := &cachedResponseWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(crw, r)

			if crw.status >= 200 && crw.status < 300 && crw.body.Len() > 0 {
				// 使用独立超时上下文写入缓存，避免客户端断开导致缓存永不写入
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				client.Set(ctx, key, crw.body.Bytes(), ttl)
				cancel()
			}
		})
	}
}

type cachedResponseWriter struct {
	http.ResponseWriter
	status  int
	body    bytes.Buffer
	written bool
}

func (w *cachedResponseWriter) WriteHeader(status int) {
	w.status = status
	if !w.written {
		w.ResponseWriter.WriteHeader(status)
		w.written = true
	}
}

func (w *cachedResponseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	if !w.written {
		w.written = true
		w.ResponseWriter.WriteHeader(w.status)
	}
	return w.ResponseWriter.Write(b)
}

func clientIP(r *http.Request) string {
	// 经宿主 nginx 反代时 RemoteAddr 恒为 nginx 地址（全站共享同一限流桶），
	// 优先取 X-Forwarded-For 首段区分真实客户端；伪造 XFF 只会绕过自身限流，不影响他人
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first := strings.TrimSpace(strings.Split(xff, ",")[0]); first != "" {
			return first
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func RateLimit(client *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return rateLimitWithKey(client, limit, window, func(r *http.Request) string {
		return "zhiyu:ratelimit:" + clientIP(r)
	})
}

// RateLimitByUser 按登录用户限流（未登录退回 IP 维度），
// 用于导入/导出/上传等对"单用户资源消耗"更敏感的接口。
func RateLimitByUser(client *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return rateLimitWithKey(client, limit, window, func(r *http.Request) string {
		uid := middleware.CurrentUser(r)
		if uid != nil && uid.UserID != "" {
			return "zhiyu:ratelimit:user:" + uid.UserID
		}
		return "zhiyu:ratelimit:" + clientIP(r)
	})
}

func rateLimitWithKey(client *redis.Client, limit int, window time.Duration, keyOf func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if client == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := keyOf(r)
			ctx := r.Context()

			current, err := client.Incr(ctx, key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if current == 1 {
				// 设置过期失败时回滚，避免 key 永久存在导致该用户被永久限流
				if err := client.Expire(ctx, key, window).Err(); err != nil {
					client.Del(ctx, key)
				}
			}

			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(max(0, limit-int(current))))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(window).Unix(), 10))

			if current > int64(limit) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"too many requests","code":429}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
