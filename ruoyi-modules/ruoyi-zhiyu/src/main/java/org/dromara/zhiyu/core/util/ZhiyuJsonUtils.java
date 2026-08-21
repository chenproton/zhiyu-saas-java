package org.dromara.zhiyu.core.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

/**
 * zhiyu 模块 JSON 工具（收敛各类 private static final ObjectMapper 副本与 fallback 型 toJson 副本）。
 *
 * <p>Jackson 2（com.fasterxml）实例，模块内统一共享；框架 JsonUtils 为 Jackson 3
 * （tools.jackson），类型不兼容故不直接复用。</p>
 *
 * @author zhiyu
 */
@Slf4j
public final class ZhiyuJsonUtils {

    private ZhiyuJsonUtils() {
    }

    /** 共享 ObjectMapper（线程安全，替代各类 private MAPPER 副本）。 */
    public static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * 序列化为 JSON 文本；value 为 null 或序列化失败时返回 fallback（失败记 warn 留痕）。
     */
    public static String toJson(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("对象序列化 JSON 失败，降级为 fallback", e);
            return fallback;
        }
    }
}
