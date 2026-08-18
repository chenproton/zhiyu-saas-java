package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := []struct {
		name       string
		remoteAddr string
		xff        string
		xRealIP    string
		want       string
	}{
		{
			name:       "经 nginx 转发取 X-Forwarded-For 首个地址",
			remoteAddr: "127.0.0.1:54321",
			xff:        "203.0.113.7, 10.0.0.1",
			want:       "203.0.113.7",
		},
		{
			name:       "X-Forwarded-For 缺失时取 X-Real-IP",
			remoteAddr: "127.0.0.1:54321",
			xRealIP:    "198.51.100.9",
			want:       "198.51.100.9",
		},
		{
			name:       "代理头缺失时回退 RemoteAddr",
			remoteAddr: "127.0.0.1:54321",
			want:       "127.0.0.1",
		},
		{
			name:       "X-Forwarded-For 非法地址时跳过取下一项",
			remoteAddr: "172.18.0.1:54321",
			xff:        "not-an-ip, 198.51.100.10",
			want:       "198.51.100.10",
		},
		{
			name:       "直连方为公网地址时不信任代理头",
			remoteAddr: "203.0.113.9:54321",
			xff:        "6.6.6.6",
			want:       "203.0.113.9",
		},
		{
			name:       "内网直连容器场景同样信任代理头",
			remoteAddr: "172.18.0.2:54321",
			xff:        "203.0.113.11",
			want:       "203.0.113.11",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "http://localhost/", nil)
			req.RemoteAddr = tc.remoteAddr
			if tc.xff != "" {
				req.Header.Set("X-Forwarded-For", tc.xff)
			}
			if tc.xRealIP != "" {
				req.Header.Set("X-Real-IP", tc.xRealIP)
			}
			if got := ClientIP(req); got != tc.want {
				t.Errorf("ClientIP() = %q, want %q", got, tc.want)
			}
		})
	}
}
