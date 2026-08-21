package org.dromara.zhiyu.core.page;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * zhiyu 列表响应（对齐 Go 版 ListResponse：{items, total}）。
 *
 * <p>前端 React 代码不动，列表接口统一返回本结构（区别于框架 PageResult 的
 * rows/total）。分页参数使用 limit/offset（后端最大 pageSize=200）。</p>
 *
 * @param <T> 列表元素类型
 * @author zhiyu
 */
public record ListResponse<T>(List<T> items, long total) implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 构建列表响应。
     *
     * @param items 数据列表
     * @param total 总条数
     * @return ListResponse
     */
    public static <T> ListResponse<T> of(List<T> items, long total) {
        return new ListResponse<>(items, total);
    }
}
