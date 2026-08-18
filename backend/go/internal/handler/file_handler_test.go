package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

func tenantClaims(tid string) *middleware.Claims {
	return &middleware.Claims{
		UserID:   "u-test",
		TenantID: &tid,
		Role:     domain.RoleTeacher,
	}
}

// 构造 /uploads/{tenantID}/{filename} 路由（等价于 router 中 OptionalJWT + Serve 的挂法）
func newUploadsRouter(h *FileHandler, secret string) chi.Router {
	r := chi.NewRouter()
	r.With(middleware.OptionalJWT(secret)).Get("/uploads/{tenantID}/{filename}", h.Serve)
	return r
}

func withClaims(r *http.Request, claims *middleware.Claims) *http.Request {
	return r.WithContext(middleware.WithUser(r.Context(), claims))
}

func tokenFor(t *testing.T, secret, tid string) string {
	t.Helper()
	tok, err := middleware.GenerateToken(secret, middleware.TokenInput{
		User: &domain.User{ID: "u-test", TenantID: &tid, Role: domain.RoleTeacher},
	})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func writeTestFile(t *testing.T, dir, tenant, name, content string) {
	t.Helper()
	tenantDir := filepath.Join(dir, tenant)
	if err := os.MkdirAll(tenantDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tenantDir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestFileServeRequiresAuth(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")

	h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}
	r := newUploadsRouter(h, "sec")
	svr := httptest.NewServer(r)
	defer svr.Close()

	cases := []struct {
		name   string
		header string
		cookie string
		want   int
	}{
		{"未登录返回401", "", "", http.StatusUnauthorized},
		{"跨租户返回403", tokenFor(t, "sec", "22222222-2222-2222-2222-222222222222"), "", http.StatusForbidden},
		{"同租户Header返回200", tokenFor(t, "sec", "11111111-1111-1111-1111-111111111111"), "", http.StatusOK},
		{"同租户Cookie返回200", "", tokenFor(t, "sec", "11111111-1111-1111-1111-111111111111"), http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, svr.URL+"/uploads/11111111-1111-1111-1111-111111111111/x.png", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", "Bearer "+tc.header)
			}
			if tc.cookie != "" {
				req.Header.Set("Cookie", "zhiyu_auth_portal="+tc.cookie)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.want {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.want)
			}
		})
	}
}

func TestFileServeRejectsPathTraversal(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")

	h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}

	req := httptest.NewRequest(http.MethodGet, "/uploads/11111111-1111-1111-1111-111111111111/x.png", nil)
	req = withClaims(req, tenantClaims("11111111-1111-1111-1111-111111111111"))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("tenantID", "11111111-1111-1111-1111-111111111111")
	rctx.URLParams.Add("filename", "../x.png")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.Serve(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("路径穿越应返回 400, got %d", w.Code)
	}
}

func TestFileServePublicAllianceFile(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")

	h := &FileHandler{
		UploadDir: dir,
		JWTSecret: "sec",
		IsPublicAllianceFile: func(_ context.Context, fileTenantID, fileURL string) (bool, error) {
			return fileTenantID == "11111111-1111-1111-1111-111111111111" && fileURL == "/uploads/11111111-1111-1111-1111-111111111111/x.png", nil
		},
	}
	r := newUploadsRouter(h, "sec")
	svr := httptest.NewServer(r)
	defer svr.Close()

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"公开文件未登录放行", "", http.StatusOK},
		{"公开文件跨租户放行", tokenFor(t, "sec", "22222222-2222-2222-2222-222222222222"), http.StatusOK},
		{"非公开文件未登录仍401", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			url := svr.URL + "/uploads/11111111-1111-1111-1111-111111111111/x.png"
			if tc.want == http.StatusUnauthorized {
				// 非公开场景：切换 IsPublicAllianceFile 返回 false 的文件路径
				url = svr.URL + "/uploads/11111111-1111-1111-1111-111111111111/y.png"
			}
			req, _ := http.NewRequest(http.MethodGet, url, nil)
			if tc.header != "" {
				req.Header.Set("Authorization", "Bearer "+tc.header)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.want {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.want)
			}
		})
	}
}

func TestFileServeSignedURL(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")

	h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}
	r := newUploadsRouter(h, "sec")
	svr := httptest.NewServer(r)
	defer svr.Close()

	sign := func(exp int64) string {
		mac := hmac.New(sha256.New, []byte("sec"))
		mac.Write([]byte("/uploads/11111111-1111-1111-1111-111111111111/x.png|" + strconv.FormatInt(exp, 10)))
		return hex.EncodeToString(mac.Sum(nil))
	}
	valid := time.Now().Add(time.Minute).Unix()
	expired := time.Now().Add(-time.Minute).Unix()

	cases := []struct {
		name       string
		query      string
		wantStatus int
	}{
		{"有效签名", "?exp=" + strconv.FormatInt(valid, 10) + "&sig=" + sign(valid), http.StatusOK},
		{"过期签名", "?exp=" + strconv.FormatInt(expired, 10) + "&sig=" + sign(expired), http.StatusUnauthorized},
		{"篡改签名", "?exp=" + strconv.FormatInt(valid, 10) + "&sig=deadbeef", http.StatusUnauthorized},
		{"无签名参数", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, svr.URL+"/uploads/11111111-1111-1111-1111-111111111111/x.png"+tc.query, nil)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.wantStatus {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.wantStatus)
			}
		})
	}
}

func TestUploadTenantDirAndWhitelist(t *testing.T) {
	dir := t.TempDir()
	h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}

	upload := func(t *testing.T, filename string, body []byte) *httptest.ResponseRecorder {
		var b strings.Builder
		mw := multipart.NewWriter(&b)
		fw, err := mw.CreateFormFile("file", filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := fw.Write(body); err != nil {
			t.Fatal(err)
		}
		mw.Close()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", strings.NewReader(b.String()))
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req = withClaims(req, tenantClaims("11111111-1111-1111-1111-111111111111"))
		w := httptest.NewRecorder()
		h.Upload(w, req)
		return w
	}

	if code := upload(t, "evil.exe", []byte("MZ...")).Code; code != http.StatusBadRequest {
		t.Fatalf("exe 应被白名单拒绝, got %d", code)
	}
	if code := upload(t, "fake.png", []byte("<html><script>alert(1)</script></html>")).Code; code != http.StatusBadRequest {
		t.Fatalf("伪装图片的 HTML 应被 sniff 拒绝, got %d", code)
	}
	if code := upload(t, "ok.png", []byte("\x89PNG\r\n\x1a\n...data")).Code; code != http.StatusCreated {
		t.Fatalf("正常 png 应上传成功, got %d", code)
	}
	// 上传后按租户目录落盘
	entries, err := os.ReadDir(filepath.Join(dir, "11111111-1111-1111-1111-111111111111"))
	if err != nil || len(entries) != 1 {
		t.Fatalf("文件应落在租户子目录, err=%v entries=%d", err, len(entries))
	}
	// 未登录不允许上传
	req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", nil)
	w := httptest.NewRecorder()
	h.Upload(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("未登录上传应 403, got %d", w.Code)
	}
}

// TestFileServeDualPlatformCookies 双端登录共存：浏览器同时携带 portal/partner cookie，
// 访问任一租户文件均应 200（Serve 按 URL 租户在候选 claims 中匹配）。
func TestFileServeDualPlatformCookies(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")
	writeTestFile(t, dir, "22222222-2222-2222-2222-222222222222", "y.png", "pngdata")

	h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}
	r := newUploadsRouter(h, "sec")
	svr := httptest.NewServer(r)
	defer svr.Close()

	portalTok := tokenFor(t, "sec", "11111111-1111-1111-1111-111111111111")
	partnerTok := tokenFor(t, "sec", "22222222-2222-2222-2222-222222222222")

	for _, tc := range []struct {
		name string
		file string
		want int
	}{
		{"portal 租户文件", "11111111-1111-1111-1111-111111111111/x.png", http.StatusOK},
		{"partner 租户文件", "22222222-2222-2222-2222-222222222222/y.png", http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, svr.URL+"/uploads/"+tc.file, nil)
			req.Header.Set("Cookie", "zhiyu_auth_portal="+portalTok+"; zhiyu_auth_partner="+partnerTok)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tc.want {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.want)
			}
		})
	}
}

// TestFileServeCrossTenantPublicEnterprise 联盟公开企业文件跨租户放行：
// 学校租户（22222222-2222-2222-2222-222222222222）登录访问企业租户（11111111-1111-1111-1111-111111111111）文件时，CrossTenantAccess
// 判定通过返回 200，未配置/判定拒绝保持 403。
func TestFileServeCrossTenantPublicEnterprise(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, dir, "11111111-1111-1111-1111-111111111111", "x.png", "pngdata")

	accessCheck := func(_ context.Context, fileTenantID, viewerTenantID string) (bool, error) {
		return fileTenantID == "11111111-1111-1111-1111-111111111111" && viewerTenantID == "22222222-2222-2222-2222-222222222222", nil
	}

	t.Run("判定通过返回200", func(t *testing.T) {
		h := &FileHandler{UploadDir: dir, JWTSecret: "sec", CrossTenantAccess: accessCheck}
		r := newUploadsRouter(h, "sec")
		req, _ := http.NewRequest(http.MethodGet, "/uploads/11111111-1111-1111-1111-111111111111/x.png", nil)
		req = withClaims(req, tenantClaims("22222222-2222-2222-2222-222222222222"))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
	})

	t.Run("判定拒绝仍403", func(t *testing.T) {
		h := &FileHandler{UploadDir: dir, JWTSecret: "sec", CrossTenantAccess: accessCheck}
		r := newUploadsRouter(h, "sec")
		req, _ := http.NewRequest(http.MethodGet, "/uploads/11111111-1111-1111-1111-111111111111/x.png", nil)
		req = withClaims(req, tenantClaims("33333333-3333-3333-3333-333333333333"))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})

	t.Run("未配置保持403", func(t *testing.T) {
		h := &FileHandler{UploadDir: dir, JWTSecret: "sec"}
		r := newUploadsRouter(h, "sec")
		req, _ := http.NewRequest(http.MethodGet, "/uploads/11111111-1111-1111-1111-111111111111/x.png", nil)
		req = withClaims(req, tenantClaims("22222222-2222-2222-2222-222222222222"))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})
}
