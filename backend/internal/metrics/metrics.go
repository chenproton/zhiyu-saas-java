// Package metrics 提供 Prometheus 监控指标：HTTP 请求量/耗时/5xx 率 + DB 连接池。
package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequests = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "zhiyu",
		Subsystem: "http",
		Name:      "requests_total",
		Help:      "HTTP 请求总数",
	}, []string{"method", "route", "status"})

	httpDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "zhiyu",
		Subsystem: "http",
		Name:      "request_duration_seconds",
		Help:      "HTTP 请求耗时",
		Buckets:   prometheus.DefBuckets,
	}, []string{"method", "route"})

	dbPoolTotal = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: "zhiyu",
		Subsystem: "db",
		Name:      "pool_total_conns",
		Help:      "DB 连接池总连接数",
	}, func() float64 {
		if pool == nil {
			return 0
		}
		return float64(pool.Stat().TotalConns())
	})

	dbPoolIdle = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: "zhiyu",
		Subsystem: "db",
		Name:      "pool_idle_conns",
		Help:      "DB 连接池空闲连接数",
	}, func() float64 {
		if pool == nil {
			return 0
		}
		return float64(pool.Stat().IdleConns())
	})
)

var pool *pgxpool.Pool

// RegisterPool 注册 DB 连接池统计源（router 初始化时调用）。
func RegisterPool(p *pgxpool.Pool) {
	pool = p
}

// Handler 返回 /metrics 端点处理器。
func Handler() http.Handler {
	return promhttp.Handler()
}

// Middleware 采集 HTTP 请求指标（路由模式为标签，避免 URL 参数高基数）。
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		route := r.URL.Path
		if rctx := chi.RouteContext(r.Context()); rctx != nil && rctx.RoutePattern() != "" {
			route = rctx.RoutePattern()
		}
		status := strconv.Itoa(rw.status)
		httpRequests.WithLabelValues(r.Method, route, status).Inc()
		httpDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (w *statusRecorder) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func init() {
	prometheus.MustRegister(httpRequests, httpDuration, dbPoolTotal, dbPoolIdle)
}
