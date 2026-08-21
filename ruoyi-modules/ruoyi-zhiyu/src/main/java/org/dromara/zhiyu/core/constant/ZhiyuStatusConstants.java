package org.dromara.zhiyu.core.constant;

/**
 * zhiyu 业务状态字面量常量（收敛各 service 散落的状态比较/赋值字面量）。
 *
 * <p>不同子域同字符串的状态值（如场景的 draft 与考试的 draft）共用同一常量；
 * 仅限 Java 代码侧使用，SQL 文本（@Select 等注解内单引号字面量）不引用。</p>
 *
 * @author zhiyu
 */
public final class ZhiyuStatusConstants {

    private ZhiyuStatusConstants() {
    }

    /** 草稿。 */
    public static final String DRAFT = "draft";
    /** 已发布。 */
    public static final String PUBLISHED = "published";
    /** 待处理/审批中。 */
    public static final String PENDING = "pending";
    /** 已通过。 */
    public static final String APPROVED = "approved";
    /** 已驳回。 */
    public static final String REJECTED = "rejected";
}
