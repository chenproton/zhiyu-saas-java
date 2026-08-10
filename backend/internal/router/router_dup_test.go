package router

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/handler"
)

// recordingRouter 记录所有路由注册的 (method, pattern)，用于检测
// chi 同 method+path 静默覆盖（后注册顶替先注册，弱权限组可顶替强权限组）。
// 复用真实 chi.Router 完成注册，仅拦截注册入口做记录。
type recordingRouter struct {
	chi.Router
	t    *testing.T
	seen map[string]string // method+pattern → 首次注册来源
	dups []string
}

func newRecordingRouter(t *testing.T, base chi.Router) *recordingRouter {
	return &recordingRouter{Router: base, t: t, seen: map[string]string{}}
}

func (r *recordingRouter) record(method, pattern string) {
	key := method + " " + pattern
	if src, ok := r.seen[key]; ok {
		r.dups = append(r.dups, fmt.Sprintf("  %s（首次注册于 %s，重复注册于 %s）", key, src, r.t.Name()))
		return
	}
	r.seen[key] = r.t.Name()
}

func (r *recordingRouter) wrap(inner chi.Router) chi.Router {
	return newRecordingRouter(r.t, inner)
}

func (r *recordingRouter) With(mws ...func(http.Handler) http.Handler) chi.Router {
	return r.wrap(r.Router.With(mws...))
}

func (r *recordingRouter) Group(fn func(r chi.Router)) chi.Router {
	return r.wrap(r.Router.Group(func(sr chi.Router) { fn(newRecordingRouter(r.t, sr)) }))
}

func (r *recordingRouter) Route(pattern string, fn func(r chi.Router)) chi.Router {
	return r.wrap(r.Router.Route(pattern, func(sr chi.Router) { fn(newRecordingRouter(r.t, sr)) }))
}

func (r *recordingRouter) Mount(pattern string, h http.Handler) { r.Router.Mount(pattern, h) }
func (r *recordingRouter) Handle(pattern string, h http.Handler) {
	r.record("*", pattern)
	r.Router.Handle(pattern, h)
}
func (r *recordingRouter) HandleFunc(pattern string, h http.HandlerFunc) {
	r.record("*", pattern)
	r.Router.HandleFunc(pattern, h)
}
func (r *recordingRouter) Method(method, pattern string, h http.Handler) {
	r.record(method, pattern)
	r.Router.Method(method, pattern, h)
}
func (r *recordingRouter) MethodFunc(method, pattern string, h http.HandlerFunc) {
	r.record(method, pattern)
	r.Router.MethodFunc(method, pattern, h)
}

func (r *recordingRouter) Connect(pattern string, h http.HandlerFunc) {
	r.record("CONNECT", pattern)
	r.Router.Connect(pattern, h)
}
func (r *recordingRouter) Delete(pattern string, h http.HandlerFunc) {
	r.record("DELETE", pattern)
	r.Router.Delete(pattern, h)
}
func (r *recordingRouter) Get(pattern string, h http.HandlerFunc) {
	r.record("GET", pattern)
	r.Router.Get(pattern, h)
}
func (r *recordingRouter) Head(pattern string, h http.HandlerFunc) {
	r.record("HEAD", pattern)
	r.Router.Head(pattern, h)
}
func (r *recordingRouter) Options(pattern string, h http.HandlerFunc) {
	r.record("OPTIONS", pattern)
	r.Router.Options(pattern, h)
}
func (r *recordingRouter) Patch(pattern string, h http.HandlerFunc) {
	r.record("PATCH", pattern)
	r.Router.Patch(pattern, h)
}
func (r *recordingRouter) Post(pattern string, h http.HandlerFunc) {
	r.record("POST", pattern)
	r.Router.Post(pattern, h)
}
func (r *recordingRouter) Put(pattern string, h http.HandlerFunc) {
	r.record("PUT", pattern)
	r.Router.Put(pattern, h)
}
func (r *recordingRouter) Query(pattern string, h http.HandlerFunc) {
	r.record("QUERY", pattern)
	r.Router.Query(pattern, h)
}
func (r *recordingRouter) Trace(pattern string, h http.HandlerFunc) {
	r.record("TRACE", pattern)
	r.Router.Trace(pattern, h)
}

// TestNoDuplicateRouteRegistration 注册期重复检测：
// 同一 method+pattern 被注册两次即 fail——chi 会静默覆盖，后注册者顶替先注册者，
// 弱权限组可能顶替强权限组（曾导致 /files/sign-url 被 partner 组顶替）。
func TestNoDuplicateRouteRegistration(t *testing.T) {
	rec := newRecordingRouter(t, chi.NewRouter())
	h := NewHandlers(nil, "test-secret", &handler.FileHandler{}, nil, nil, "test-secret")
	RegisterAPIRoutes(rec, "test-secret", nil, h, nil, nil)
	if len(rec.dups) > 0 {
		t.Errorf("检测到同 method+path 重复注册（chi 静默覆盖，弱权限组可顶替强权限组）：\n%s", strings.Join(rec.dups, "\n"))
	}
}
