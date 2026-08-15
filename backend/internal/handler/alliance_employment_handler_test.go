package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// 就业服务管理（供需大厅）权限单测：不依赖 DB——以下路径在权限检查后、
// 触达 store 之前即返回，nil Store 不会 panic。

func newEmploymentRouter(h *handler.AllianceEmploymentHandler) chi.Router {
	r := chi.NewRouter()
	r.Post("/alliance/public/employment-jobs/{id}/apply", h.ApplyPublicEmploymentJob)
	r.Get("/alliance/public/employment-applications/mine", h.ListMyEmploymentApplications)
	return r
}

func doEmployment(r chi.Router, method, path, body string, claims *middleware.Claims) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if claims != nil {
		req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// 投递仅学生：无 claims → 401；教师角色 → 403（触达 store 前返回）。
func TestApplyEmploymentJob_RequiresStudent(t *testing.T) {
	h := &handler.AllianceEmploymentHandler{Store: nil}
	r := newEmploymentRouter(h)

	if rec := doEmployment(r, http.MethodPost, "/alliance/public/employment-jobs/j1/apply", `{"coverLetter":"x"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("无登录 claims 应 401，实得 %d", rec.Code)
	}

	teacher := claimsWithRoles("u1", "teacher")
	if rec := doEmployment(r, http.MethodPost, "/alliance/public/employment-jobs/j1/apply", `{"coverLetter":"x"}`, teacher); rec.Code != http.StatusForbidden {
		t.Fatalf("教师投递应 403，实得 %d", rec.Code)
	}
}

// 求职信长度护栏：>2000 字 → 400（触达 store 前返回）。
func TestApplyEmploymentJob_CoverLetterLimit(t *testing.T) {
	h := &handler.AllianceEmploymentHandler{Store: nil}
	r := newEmploymentRouter(h)
	student := claimsWithRoles("u1", "student")
	long := `{"coverLetter":"` + strings.Repeat("好", 2001) + `"}`
	if rec := doEmployment(r, http.MethodPost, "/alliance/public/employment-jobs/j1/apply", long, student); rec.Code != http.StatusBadRequest {
		t.Fatalf("超长求职信应 400，实得 %d", rec.Code)
	}
}

// 我的投递仅学生：教师 → 403。
func TestListMyEmploymentApplications_RequiresStudent(t *testing.T) {
	h := &handler.AllianceEmploymentHandler{Store: nil}
	r := newEmploymentRouter(h)
	teacher := claimsWithRoles("u1", "teacher")
	if rec := doEmployment(r, http.MethodGet, "/alliance/public/employment-applications/mine", "", teacher); rec.Code != http.StatusForbidden {
		t.Fatalf("教师查看我的投递应 403，实得 %d", rec.Code)
	}
}

// partner 端缺租户 claims → 403（触达 store 前返回）。
func TestPartnerEmployment_RequiresTenant(t *testing.T) {
	h := &handler.PartnerEmploymentHandler{}
	r := chi.NewRouter()
	r.Get("/partner/employment-projects", h.ListProjects)
	r.Get("/partner/employment-jobs", h.ListJobs)

	noTenant := &middleware.Claims{UserID: "u1", RoleCodes: []string{"enterprise_admin"}}
	if rec := doEmployment(r, http.MethodGet, "/partner/employment-projects", "", noTenant); rec.Code != http.StatusForbidden {
		t.Fatalf("缺租户应 403，实得 %d", rec.Code)
	}
	if rec := doEmployment(r, http.MethodGet, "/partner/employment-jobs", "", nil); rec.Code != http.StatusForbidden {
		t.Fatalf("无 claims 应 403，实得 %d", rec.Code)
	}
}
