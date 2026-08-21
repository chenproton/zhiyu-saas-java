package org.dromara.zhiyu.service.impl.affairs;

import java.util.Map;
import java.util.Set;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;

/**
 * 内容型实体（人培方案/教学计划）共享的状态流转允许表（对齐 Go allowedStatusTransitions）。
 *
 * @author zhiyu
 */
final class ContentActionSupport {

    static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        ZhiyuStatusConstants.DRAFT, Set.of(ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.REJECTED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.PENDING, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.APPROVED, ZhiyuStatusConstants.REJECTED),
        ZhiyuStatusConstants.APPROVED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PUBLISHED, "archived"),
        ZhiyuStatusConstants.PUBLISHED, Set.of(ZhiyuStatusConstants.DRAFT, "archived"),
        "archived", Set.of(ZhiyuStatusConstants.DRAFT)
    );

    private ContentActionSupport() {
    }

    static boolean canTransition(String from, String to) {
        Set<String> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }
}
