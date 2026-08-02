package cache

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type KeyFunc func(r *http.Request) string

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
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func RateLimit(client *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if client == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := fmt.Sprintf("zhiyu:ratelimit:%s", clientIP(r))
			ctx := r.Context()

			current, err := client.Incr(ctx, key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if current == 1 {
				// 设置过期失败时回滚，避免 key 永久存在导致该 IP 被永久限流
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
