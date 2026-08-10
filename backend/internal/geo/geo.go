package geo

import (
	"log/slog"
	"net"
	"strings"

	"github.com/lionsoul2014/ip2region/binding/golang/service"
)

// Searcher 基于 ip2region（v2.2 xdb）的 IP 归属地查询器。
// service.Ip2Region 内部为查询池，线程安全，可并发调用。
type Searcher struct {
	ip2r *service.Ip2Region
}

// NewSearcher 加载 xdb 数据文件；路径为空或加载失败时返回 nil（调用方需容忍空地点）。
func NewSearcher(xdbPath string) *Searcher {
	if xdbPath == "" {
		return nil
	}
	ip2r, err := service.NewIp2RegionWithPath(xdbPath, "")
	if err != nil {
		slog.Warn("ip2region 加载失败，登录地点将为空", "path", xdbPath, "error", err)
		return nil
	}
	return &Searcher{ip2r: ip2r}
}

// Location 查询 IP 归属地，返回"省 市"格式（如"广东省 深圳市"）；
// 内网/保留地址或查询失败返回空串。中国地址省略国家，国外地址返回"国家 省份"。
func (s *Searcher) Location(ip string) string {
	if s == nil || s.ip2r == nil {
		return ""
	}
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.IsPrivate() || parsed.IsLoopback() || parsed.IsUnspecified() ||
		parsed.IsLinkLocalUnicast() || parsed.IsMulticast() {
		return ""
	}
	region, err := s.ip2r.Search(ip)
	if err != nil || region == "" {
		return ""
	}
	// v2.2 xdb 返回格式：国家|省份|城市|运营商|国家代码
	parts := strings.Split(region, "|")
	country, province, city := "", "", ""
	if len(parts) > 0 {
		country = strings.TrimSpace(parts[0])
	}
	if len(parts) > 1 {
		province = strings.TrimSpace(parts[1])
	}
	if len(parts) > 2 {
		city = strings.TrimSpace(parts[2])
	}
	if province == "" || province == "0" || province == "内网IP" {
		return ""
	}
	if country != "" && country != "中国" {
		if province == "" {
			return country
		}
		return country + " " + province
	}
	if city == "" || city == "0" || city == province {
		return province
	}
	return province + " " + city
}
