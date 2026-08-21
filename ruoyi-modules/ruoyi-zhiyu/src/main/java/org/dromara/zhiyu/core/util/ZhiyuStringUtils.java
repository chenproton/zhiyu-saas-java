package org.dromara.zhiyu.core.util;

/**
 * zhiyu 业务字符串小工具（收敛各 service 私有副本）。
 *
 * @author zhiyu
 */
public final class ZhiyuStringUtils {

    private ZhiyuStringUtils() {
    }

    /** 空白串归一为 null（空白视为无值）。 */
    public static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
