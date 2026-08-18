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
// state 由全部嵌套 recordingRouter 共享：chi 同 method+path 的重复注册
// 发生在不同 Group/Route 子路由上，每个子路由一个独立 recorder 会各自
// 维护自己的 seen，跨组重复检测不到（曾漏检 lesson/courses 宽授权被窄授权顶替）。
type recordingRouter struct {
	chi.Router
	t     *testing.T
	state *recorderState
}

type recorderState struct {
	seen map[string]string // method+pattern → 首次注册来源
	dups []string
}

func newRecordingRouter(t *testing.T, base chi.Router, shared *recorderState) *recordingRouter {
	if shared == nil {
		shared = &recorderState{seen: map[string]string{}}
	}
	return &recordingRouter{Router: base, t: t, state: shared}
}

func (r *recordingRouter) record(method, pattern string) {
	key := method + " " + pattern
	if src, ok := r.state.seen[key]; ok {
		r.state.dups = append(r.state.dups, fmt.Sprintf("  %s（首次注册于 %s，重复注册于 %s）", key, src, r.t.Name()))
		return
	}
	r.state.seen[key] = r.t.Name()
}

func (r *recordingRouter) wrap(inner chi.Router) chi.Router {
	return newRecordingRouter(r.t, inner, r.state)
}

func (r *recordingRouter) With(mws ...func(http.Handler) http.Handler) chi.Router {
	return r.wrap(r.Router.With(mws...))
}

func (r *recordingRouter) Group(fn func(r chi.Router)) chi.Router {
	return r.wrap(r.Router.Group(func(sr chi.Router) { fn(newRecordingRouter(r.t, sr, r.state)) }))
}

func (r *recordingRouter) Route(pattern string, fn func(r chi.Router)) chi.Router {
	return r.wrap(r.Router.Route(pattern, func(sr chi.Router) { fn(newRecordingRouter(r.t, sr, r.state)) }))
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

// 已知豁免的双注册（2026-08-19 审计基线）：这些是「宽授权只读面（含落地页菜单）在
// 管理面之后注册」的有意双注册——后注册的宽授权组生效，学生/落地页用户可读，
// 语义正确（ADR-0008 只读面）。豁免白名单防止历史双注册污染新回归检测；
// 新增接口必须零重复，否则走 dups 失败分支。
var knownDualRegistrations = map[string]bool{
	"GET /": true, "POST /": true, "PUT /{id}": true, "DELETE /{id}": true,
	"GET /achievements": true, "GET /achievements/{id}": true,
	"GET /agreements": true, "GET /brands": true, "GET /brands/{id}": true,
	"GET /brands/talent-ranking": true,
	"GET /employment-projects":   true, "GET /employment-projects/{id}": true,
	"GET /enterprises": true, "GET /enterprises/{id}": true,
	"GET /experts": true, "GET /experts/{id}": true,
	"GET /job/ability-domains": true, "GET /job/ability-domains/{id}": true,
	"GET /job/position-abilities":    true,
	"GET /job/position-certificates": true, "GET /job/position-certificates/{id}": true,
	"GET /job/position-responsibilities": true, "GET /job/position-responsibilities/{id}": true,
	"GET /library/on-site-questions": true, "GET /library/on-site-questions/{id}": true,
	"GET /library/resources": true, "GET /library/resources/{id}": true,
	"GET /library/resources/stats": true,
	"GET /organizations":           true, "GET /organizations/{id}": true, "GET /organizations/tree": true,
	"GET /org-types": true, "GET /org-types/{id}": true,
	"GET /projects": true, "GET /projects/{id}": true, "GET /projects/{pid}/milestones": true,
	"GET /school-info": true, "GET /tenants/{id}": true,
}

// TestNoDuplicateRouteRegistration 注册期重复检测：
// 同一 method+pattern 被注册两次即 fail——chi 会静默覆盖，后注册者顶替先注册者，
// 弱权限组可能顶替强权限组（曾导致 /files/sign-url 被 partner 组顶替、
// /lesson/courses 宽授权 List 被 lesson 管理面顶替导致岗位知识图谱 403）。
func TestNoDuplicateRouteRegistration(t *testing.T) {
	rec := newRecordingRouter(t, chi.NewRouter(), nil)
	h := NewHandlers(nil, "test-secret", &handler.FileHandler{}, nil, nil, "test-secret", "")
	RegisterAPIRoutes(rec, "test-secret", "", nil, h, nil, nil)
	var newDups []string
	for _, d := range rec.state.dups {
		key := strings.TrimSpace(strings.SplitN(d, "（", 2)[0])
		if knownDualRegistrations[key] {
			continue
		}
		newDups = append(newDups, d)
	}
	if len(newDups) > 0 {
		t.Errorf("检测到同 method+path 重复注册（chi 静默覆盖，弱权限组可顶替强权限组）：\n%s", strings.Join(newDups, "\n"))
	}
}
