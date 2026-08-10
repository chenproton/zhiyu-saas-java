package router

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/geo"
	"github.com/zhiyu-saas/backend/internal/handler"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

type contentRoutes interface {
	List(http.ResponseWriter, *http.Request)
	Get(http.ResponseWriter, *http.Request)
	Create(http.ResponseWriter, *http.Request)
	Update(http.ResponseWriter, *http.Request)
	Delete(http.ResponseWriter, *http.Request)
	Submit(http.ResponseWriter, *http.Request)
	Review(http.ResponseWriter, *http.Request)
	Publish(http.ResponseWriter, *http.Request)
	Archive(http.ResponseWriter, *http.Request)
	Unpublish(http.ResponseWriter, *http.Request)
	Withdraw(http.ResponseWriter, *http.Request)
	SaveDraft(http.ResponseWriter, *http.Request)
	Invite(http.ResponseWriter, *http.Request)
}

func registerContentRoutes(r chi.Router, base string, h contentRoutes) {
	r.Get(base, h.List)
	r.Get(base+"/{id}", h.Get)
	r.Post(base, h.Create)
	r.Put(base+"/{id}", h.Update)
	r.Delete(base+"/{id}", h.Delete)
	r.Post(base+"/{id}/submit", h.Submit)
	r.Post(base+"/{id}/review", h.Review)
	r.Post(base+"/{id}/publish", h.Publish)
	r.Post(base+"/{id}/archive", h.Archive)
	r.Post(base+"/{id}/unpublish", h.Unpublish)
	r.Post(base+"/{id}/withdraw", h.Withdraw)
	r.Post(base+"/{id}/save-draft", h.SaveDraft)
	r.Post(base+"/{id}/invite", h.Invite)
}

// registerContentWriteRoutes 只注册内容资源的写操作路由，
// 两个 GET（List/Get）由 registerContentReadRoutes 挂在更宽的角色组（如含学生的 jobViewer）。
// 试点：写路由统一挂租户归属中间件（跨租户 {id} 请求在路由层 404），
// 后续推广到全部 id 型资源路由后可收敛 handler 层手工归属校验。
func registerContentWriteRoutes(r chi.Router, base, table string, db *pgxpool.Pool, h contentRoutes) {
	r.Group(func(r chi.Router) {
		r.Use(authmw.TenantOwnedContent(db, table, "id"))
		r.Post(base, h.Create)
		r.Put(base+"/{id}", h.Update)
		r.Delete(base+"/{id}", h.Delete)
		r.Post(base+"/{id}/submit", h.Submit)
		r.Post(base+"/{id}/review", h.Review)
		r.Post(base+"/{id}/publish", h.Publish)
		r.Post(base+"/{id}/archive", h.Archive)
		r.Post(base+"/{id}/unpublish", h.Unpublish)
		r.Post(base+"/{id}/withdraw", h.Withdraw)
		r.Post(base+"/{id}/save-draft", h.SaveDraft)
		r.Post(base+"/{id}/invite", h.Invite)
	})
}

func registerContentReadRoutes(r chi.Router, base string, h contentRoutes) {
	r.Get(base, h.List)
	r.Get(base+"/{id}", h.Get)
}

type batchRoutes interface {
	List(http.ResponseWriter, *http.Request)
	Get(http.ResponseWriter, *http.Request)
	Create(http.ResponseWriter, *http.Request)
	Update(http.ResponseWriter, *http.Request)
	Delete(http.ResponseWriter, *http.Request)
	UpdateStatus(http.ResponseWriter, *http.Request)
}

func registerBatchRoutes(r chi.Router, base string, h batchRoutes) {
	r.Get(base, h.List)
	r.Get(base+"/{id}", h.Get)
	r.Post(base, h.Create)
	r.Put(base+"/{id}", h.Update)
	r.Delete(base+"/{id}", h.Delete)
	r.Post(base+"/{id}/status", h.UpdateStatus)
}

type Router struct {
	http.Handler
	handlers *Handlers
}

func (r *Router) Shutdown() {
	r.handlers.authHandler.Shutdown()
}

func New(db *pgxpool.Pool, jwtSecret string, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer, geo *geo.Searcher, aiSecret string) *Router {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// 注意：不使用 chi RealIP —— 它会用客户端可控的 X-Forwarded-For 覆盖 RemoteAddr，
	// 导致限流/操作日志的 IP 可被伪造绕过；RemoteAddr 保持为 TCP 连接真实地址
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "../public/uploads"
	}
	fileHandler := &handler.FileHandler{UploadDir: uploadDir, JWTSecret: jwtSecret}

	// /uploads/{tenantID}/{filename}：混合鉴权——签名 URL（公开，kkFileView 等
	// 无登录态服务端抓取）或登录态（Authorization 头 / HttpOnly cookie，<img> 直出），
	// 未登录且无签名返回 401，跨租户返回 403（见 FileHandler.Serve）
	r.With(authmw.OptionalJWT(jwtSecret)).Get("/uploads/{tenantID}/{filename}", fileHandler.Serve)

	h := NewHandlers(db, jwtSecret, fileHandler, redisClient, geo, aiSecret)

	// /health 保持进程存活探针（历史兼容），/health/ready 为就绪探针（DB+Redis）
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if db != nil {
			if err := db.Ping(ctx); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"status":"unavailable","reason":"db"}`))
				return
			}
		}
		if redisClient != nil {
			if err := redisClient.Ping(ctx).Err(); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"status":"unavailable","reason":"redis"}`))
				return
			}
		}
		w.Write([]byte(`{"status":"ok"}`))
	})

	RegisterAPIRoutes(r, jwtSecret, db, h, redisClient, oplogBuffer)

	return &Router{Handler: r, handlers: h}
}
