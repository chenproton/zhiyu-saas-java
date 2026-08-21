package org.dromara.zhiyu.service.impl.affairs;

import java.util.Map;
import java.util.Set;

/**
 * 内容型实体（人培方案/教学计划）共享的状态流转允许表（对齐 Go allowedStatusTransitions）。
 *
 * @author zhiyu
 */
final class ContentActionSupport {

    static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "draft", Set.of("pending", "archived"),
        "rejected", Set.of("draft", "pending", "archived"),
        "pending", Set.of("draft", "approved", "rejected"),
        "approved", Set.of("draft", "published", "archived"),
        "published", Set.of("draft", "archived"),
        "archived", Set.of("draft")
    );

    private ContentActionSupport() {
    }

    static boolean canTransition(String from, String to) {
        Set<String> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }
}
