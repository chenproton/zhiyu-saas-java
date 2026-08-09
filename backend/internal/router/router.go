package router

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/handler"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

// debugScheduleLogger 临时调试中间件：捕获 /affairs/schedules 请求的详细上下文，
// 用于定位用户浏览器返回 404 的根因。定位完成后应移除。
func debugScheduleLogger() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.Contains(r.URL.Path, "/affairs/schedules") {
				next.ServeHTTP(w, r)
				return
			}
			bodyBuf := &bytes.Buffer{}
			if r.Body != nil {
				bodyBytes, _ := io.ReadAll(r.Body)
				bodyBuf.Write(bodyBytes)
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}
			respBuf := &bytes.Buffer{}
			rec := &responseRecorder{ResponseWriter: w, body: respBuf, statusCode: http.StatusOK}
			slog.Info("[debug-schedules] request start",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.String("host", r.Host),
				slog.String("remote", r.RemoteAddr),
				slog.String("authorization", r.Header.Get("Authorization")),
				slog.String("content-type", r.Header.Get("Content-Type")),
				slog.String("request-body", strings.TrimSpace(bodyBuf.String())),
			)
			next.ServeHTTP(rec, r)
			slog.Info("[debug-schedules] request end",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.statusCode),
				slog.String("response-body", strings.TrimSpace(respBuf.String())),
			)
		})
	}
}

type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

func (rr *responseRecorder) Write(p []byte) (int, error) {
	rr.body.Write(p)
	return rr.ResponseWriter.Write(p)
}

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
func registerContentWriteRoutes(r chi.Router, base string, h contentRoutes) {
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

func New(db *pgxpool.Pool, jwtSecret string, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) *Router {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// 注意：不使用 chi RealIP —— 它会用客户端可控的 X-Forwarded-For 覆盖 RemoteAddr，
	// 导致限流/操作日志的 IP 可被伪造绕过；RemoteAddr 保持为 TCP 连接真实地址
	r.Use(debugScheduleLogger())
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
	fileHandler := &handler.FileHandler{UploadDir: uploadDir}

	r.Get("/uploads/{filename}", fileHandler.Serve)

	r.Group(func(r chi.Router) {
		r.Use(authmw.JWT(jwtSecret))
		r.Use(authmw.OperationLog(db, oplogBuffer))
		r.Post("/api/v1/files/upload", fileHandler.Upload)
		r.Get("/api/v1/files/preview", fileHandler.Preview)
	})

	h := NewHandlers(db, jwtSecret, fileHandler, redisClient)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	RegisterAPIRoutes(r, jwtSecret, db, h, redisClient, oplogBuffer)

	return &Router{Handler: r, handlers: h}
}
