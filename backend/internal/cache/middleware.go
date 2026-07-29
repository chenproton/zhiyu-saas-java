package cache

import (
	"bytes"
	"context"
	"fmt"
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
				client.Set(r.Context(), key, crw.body.Bytes(), ttl)
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

func RateLimit(client *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if client == nil {
				next.ServeHTTP(w, r)
				return
			}

			ip := r.RemoteAddr
			key := fmt.Sprintf("zhiyu:ratelimit:%s", ip)
			ctx := r.Context()

			current, err := client.Incr(ctx, key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if current == 1 {
				client.Expire(ctx, key, window)
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

func NewRateLimiter(client *redis.Client) *RateLimiter {
	return &RateLimiter{client: client}
}

type RateLimiter struct {
	client *redis.Client
}

func (rl *RateLimiter) For(target string, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if rl.client == nil {
				next.ServeHTTP(w, r)
				return
			}

			key := fmt.Sprintf("zhiyu:ratelimit:%s:%s", target, r.RemoteAddr)
			ctx := r.Context()

			current, err := rl.client.Incr(ctx, key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if current == 1 {
				rl.client.Expire(ctx, key, window)
			}

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

func RunInterval(ctx context.Context, interval time.Duration, fn func(context.Context)) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				fn(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}
