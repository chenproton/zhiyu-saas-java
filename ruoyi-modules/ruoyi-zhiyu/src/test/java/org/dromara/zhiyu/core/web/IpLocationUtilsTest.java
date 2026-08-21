package org.dromara.zhiyu.core.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * IP 归属地格式适配单测（对齐 Go geo.Location 的 "省 市" 输出）。
 *
 * <p>只测纯函数 formatRegion 与不触达 xdb 的 location 分支（内网/非法输入），
 * 避免单测依赖 ip2region 数据文件。</p>
 */
@Tag("local")
class IpLocationUtilsTest {

    @Test
    @DisplayName("中国地址省略国家：省 市")
    void chinaProvinceCity() {
        assertEquals("广东省 深圳市", IpLocationUtils.formatRegion("中国|广东省|深圳市|电信"));
    }

    @Test
    @DisplayName("城市缺失（0/未知）时只返回省份")
    void chinaProvinceOnly() {
        assertEquals("广东省", IpLocationUtils.formatRegion("中国|广东省|未知|电信"));
        assertEquals("广东省", IpLocationUtils.formatRegion("中国|广东省|0|电信"));
    }

    @Test
    @DisplayName("直辖市（市=省）只返回一段")
    void municipality() {
        assertEquals("北京市", IpLocationUtils.formatRegion("中国|北京市|北京市|联通"));
    }

    @Test
    @DisplayName("国外地址返回 国家 省份")
    void foreign() {
        assertEquals("美国 加利福尼亚州", IpLocationUtils.formatRegion("美国|加利福尼亚州|洛杉矶|"));
    }

    @Test
    @DisplayName("保留网段/内网/空串返回空（对齐 Go Reserved/保留/内网IP 判定）")
    void reserved() {
        assertEquals("", IpLocationUtils.formatRegion("Reserved|Reserved|Reserved|"));
        assertEquals("", IpLocationUtils.formatRegion("保留|保留|保留|"));
        assertEquals("", IpLocationUtils.formatRegion("中国|内网IP|内网IP|"));
        assertEquals("", IpLocationUtils.formatRegion("中国|未知|未知|"));
        assertEquals("", IpLocationUtils.formatRegion("未知"));
        assertEquals("", IpLocationUtils.formatRegion(""));
        assertEquals("", IpLocationUtils.formatRegion(null));
    }

    @Test
    @DisplayName("location：非法 IP 与内网地址返回空串（不触达 xdb）")
    void locationEarlyReturn() {
        assertEquals("", IpLocationUtils.location(null));
        assertEquals("", IpLocationUtils.location(""));
        assertEquals("", IpLocationUtils.location("not-an-ip"));
        assertEquals("", IpLocationUtils.location("127.0.0.1"));
        assertEquals("", IpLocationUtils.location("192.168.1.1"));
        assertEquals("", IpLocationUtils.location("10.0.0.8"));
        assertEquals("", IpLocationUtils.location("::1"));
    }
}
