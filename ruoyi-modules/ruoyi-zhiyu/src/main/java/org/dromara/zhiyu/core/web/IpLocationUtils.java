package org.dromara.zhiyu.core.web;

import cn.hutool.core.util.StrUtil;
import org.dromara.common.core.utils.NetUtils;
import org.dromara.common.core.utils.ip.RegionUtils;

/**
 * 登录日志 IP 归属地（对齐 Go internal/geo/geo.go 的 Location 输出格式："省 市"）。
 *
 * <p>框架 {@link RegionUtils} 返回 ip2region 原始分段「国家|省份|城市|运营商」
 * （且把 "0" 替换为 "未知"），与 Go 端格式不一致，本类做适配：</p>
 * <ul>
 *   <li>内网/保留地址或查询失败 → 空串（Go 语义；不同于框架 AddressUtils 的"内网IP"/"XX XX"）；</li>
 *   <li>中国地址省略国家 → "广东省 深圳市"；直辖市（市=省）→ "北京市"；</li>
 *   <li>国外地址 → "国家 省份"（如 "美国 加利福尼亚州"）。</li>
 * </ul>
 *
 * @author zhiyu
 */
public final class IpLocationUtils {

    private IpLocationUtils() {
    }

    /**
     * 查询 IP 归属地，返回 Go 兼容的 "省 市" 格式；内网/非法/查询失败返回空串。
     */
    public static String location(String ip) {
        if (StrUtil.isBlank(ip)) {
            return "";
        }
        ip = ip.trim();
        boolean isIpv4 = NetUtils.isIPv4(ip);
        boolean isIpv6 = NetUtils.isIPv6(ip);
        if (!isIpv4 && !isIpv6) {
            return "";
        }
        // 内网不查询（对齐 Go：IsPrivate/IsLoopback 等返回空串）
        if ((isIpv4 && NetUtils.isInnerIP(ip)) || (isIpv6 && NetUtils.isInnerIPv6(ip))) {
            return "";
        }
        String region;
        try {
            region = RegionUtils.getRegion(ip);
        } catch (Throwable t) {
            // xdb 缺失/初始化失败等一律降级为空串（对齐 Go geo.Searcher 为 nil 时地点留空）
            return "";
        }
        return formatRegion(region);
    }

    /**
     * 将 ip2region 原始分段规整为 Go 格式（纯函数，便于单测）。
     * 输入形如 "中国|广东省|深圳市|电信"（框架已将 "0" 替换为 "未知"，此处视同缺失）。
     */
    public static String formatRegion(String region) {
        if (region == null || region.isBlank() || RegionUtils.UNKNOWN_ADDRESS.equals(region.trim())) {
            return "";
        }
        String[] parts = region.split("\\|", -1);
        String country = norm(parts.length > 0 ? parts[0] : "");
        String province = norm(parts.length > 1 ? parts[1] : "");
        String city = norm(parts.length > 2 ? parts[2] : "");

        // IANA 保留网段/内网：无实际归属地（对齐 Go 的 Reserved/保留/内网IP 判定）
        if ("Reserved".equals(country) || "保留".equals(country)
            || "Reserved".equals(province) || "保留".equals(province) || "内网IP".equals(province)
            || province.isEmpty()) {
            return "";
        }
        if (!country.isEmpty() && !"中国".equals(country)) {
            return country + " " + province;
        }
        if (city.isEmpty() || city.equals(province)) {
            return province;
        }
        return province + " " + city;
    }

    /** 分段规范化：去空白，"未知"/"0" 视为缺失 */
    private static String norm(String part) {
        String s = part == null ? "" : part.trim();
        if (RegionUtils.UNKNOWN_ADDRESS.equals(s) || "0".equals(s)) {
            return "";
        }
        return s;
    }
}
