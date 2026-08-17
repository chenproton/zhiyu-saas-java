package org.dromara.zhiyu.core.page;

import lombok.Data;

/**
 * zhiyu 分页查询参数（对齐 Go 版 limit/offset 约定，maxPageSize=200）。
 *
 * <p>zhiyu-saas 前端列表请求统一使用 limit/offset（个别接口用 page/pageSize），
 * 与框架 PageQuery（pageNum/pageSize）不同，故在 Controller 层直接接收本对象。</p>
 *
 * @author zhiyu
 */
@Data
public class LimitOffsetQuery {

    /** 最大页大小（Go 版 maxPageSize=200） */
    public static final long MAX_PAGE_SIZE = 200;

    /** 每页条数（默认 20，上限 200） */
    private long limit = 20;

    /** 偏移量（默认 0） */
    private long offset = 0;

    /**
     * 归一化并夹取页大小到 [1, 200]。
     *
     * @return 归一化后的 limit
     */
    public long normalizedLimit() {
        if (limit <= 0) {
            return 20;
        }
        return Math.min(limit, MAX_PAGE_SIZE);
    }

    /**
     * 归一化偏移量（负值归零）。
     *
     * @return 归一化后的 offset
     */
    public long normalizedOffset() {
        return Math.max(offset, 0);
    }
}
