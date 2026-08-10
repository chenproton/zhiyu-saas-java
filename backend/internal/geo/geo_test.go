package geo

import (
	"os"
	"strings"
	"testing"
)

// findXDB 按常见路径定位 ip2region 数据文件（仓库 offline/ 或容器内 /app/data/）。
func findXDB() string {
	candidates := []string{
		"../../../offline/ip2region_v4.xdb", // backend/internal/geo → 仓库根
		"/app/data/ip2region_v4.xdb",        // 生产容器内
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func TestLocation(t *testing.T) {
	s := NewSearcher(findXDB())
	if s == nil {
		t.Skip("ip2region xdb 数据文件缺失，跳过")
	}

	cases := []struct {
		ip     string
		expect string // 子串匹配；空串表示期望空地点
	}{
		{ip: "114.114.114.114", expect: "南京"},
		{ip: "223.5.5.5", expect: "杭州"},
		{ip: "1.2.4.8", expect: "北京"},
		{ip: "8.8.8.8", expect: "United States"},
		{ip: "127.0.0.1", expect: ""},
		{ip: "10.1.2.3", expect: ""},
		{ip: "192.168.1.1", expect: ""},
		{ip: "172.16.0.1", expect: ""},
		{ip: "not-an-ip", expect: ""},
		{ip: "", expect: ""},
	}
	for _, tc := range cases {
		got := s.Location(tc.ip)
		if tc.expect == "" {
			if got != "" {
				t.Errorf("Location(%q) = %q, want empty", tc.ip, got)
			}
			continue
		}
		if !strings.Contains(got, tc.expect) {
			t.Errorf("Location(%q) = %q, want contains %q", tc.ip, got, tc.expect)
		}
	}
}
