package router_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/router"
)

// TestAffairsSchedulesRouteRegistered 回归防护：
// 此前线上偶发 POST /api/v1/affairs/schedules 返回 404，
// 而源码与当前直接探测均显示路由已注册。该测试确保生产路由装配后，
// 该端点至少能被 JWT 中间件命中（返回 401），而不是 404。
func TestAffairsSchedulesRouteRegistered(t *testing.T) {
	// 仅验证路由注册，无需真实数据库；未携带 token 时应在 JWT 层返回 401。
	h := router.NewHandlers(nil, "test-secret", &handler.FileHandler{UploadDir: ""}, nil, nil)
	r := chi.NewRouter()
	router.RegisterAPIRoutes(r, "test-secret", nil, h, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/affairs/schedules", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code == http.StatusNotFound {
		t.Fatalf("POST /api/v1/affairs/schedules returned 404, route not registered")
	}
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated request, got %d", w.Code)
	}
}
